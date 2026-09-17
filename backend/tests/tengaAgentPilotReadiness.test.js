const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengaagent-pilot-readiness-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "pilot-readiness-jwt-secret";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "pilot-readiness-refresh-secret";
process.env.AUTH_CHALLENGE_SECRET = process.env.AUTH_CHALLENGE_SECRET || "pilot-readiness-auth-challenge-secret";
process.env.OPENAI_API_KEY = "test-openai-key";

const Organization = require("../models/tengaAgent/Organization");
const Agent = require("../models/tengaAgent/Agent");
const WhatsAppConnection = require("../models/tengaAgent/WhatsAppConnection");
const Subscription = require("../models/tengaAgent/Subscription");
const Usage = require("../models/tengaAgent/Usage");
const {
  getEnvStatus,
  getTenantPilotReadiness,
  summarizeEnv,
} = require("../services/tengaAgent/pilotReadinessService");
const {
  ensureSubscriptionForOrganization,
} = require("../services/tengaAgent/billingService");

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create({
    instance: { launchTimeout: 60000 },
  });

  await mongoose.connect(mongod.getUri(), {
    serverSelectionTimeoutMS: 60000,
    socketTimeoutMS: 60000,
  });
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();

  process.env.TENGAAGENT_WHATSAPP_VERIFY_TOKEN = "";
  process.env.TENGAAGENT_WHATSAPP_APP_SECRET = "";
  process.env.TENGAAGENT_WHATSAPP_ACCESS_TOKEN = "";
  process.env.TENGAAGENT_WHATSAPP_GRAPH_VERSION = "";
  process.env.TENGAAGENT_WHATSAPP_AUTO_REPLY_ENABLED = "false";
  process.env.TENGAAGENT_WHATSAPP_VOICE_ENABLED = "false";
  process.env.TENGAAGENT_CALENDAR_ENCRYPTION_KEY = "";
  process.env.GOOGLE_CALENDAR_CLIENT_ID = "";
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "";
  process.env.MICROSOFT_CALENDAR_CLIENT_ID = "";
  process.env.MICROSOFT_CALENDAR_CLIENT_SECRET = "";
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

const createTenant = async ({ plan = "growth" } = {}) => {
  const organization = await Organization.create({
    name: "Pilot Ventures",
    slug: `pilot-${new mongoose.Types.ObjectId().toString().slice(-8)}`,
    plan,
    status: "active",
  });

  const agent = await Agent.create({
    organizationId: organization._id,
    key: "receptionist",
    name: "Pilot Agent",
    status: "active",
  });

  await ensureSubscriptionForOrganization(organization);
  return { organization, agent };
};

describe("TengaAgent pilot readiness", () => {
  it("reports environment booleans without exposing secret values", () => {
    process.env.TENGAAGENT_WHATSAPP_VERIFY_TOKEN = "super-secret-verify-token";
    process.env.TENGAAGENT_WHATSAPP_APP_SECRET = "super-secret-app-secret";
    process.env.TENGAAGENT_WHATSAPP_ACCESS_TOKEN = "super-secret-access-token";
    process.env.TENGAAGENT_WHATSAPP_GRAPH_VERSION = "v23.0";

    const checks = getEnvStatus();
    const serialized = JSON.stringify(checks);

    expect(checks.whatsapp.verifyToken).toBe(true);
    expect(checks.whatsapp.appSecret).toBe(true);
    expect(checks.whatsapp.accessToken).toBe(true);
    expect(checks.whatsapp.graphVersion).toBe(true);
    expect(serialized).not.toContain("super-secret");
  });

  it("keeps web pilot readiness independent of optional channel integrations", async () => {
    const { organization } = await createTenant({ plan: "starter" });

    const readiness = await getTenantPilotReadiness({
      organizationId: organization._id,
    });

    expect(readiness.pilotReady).toBe(true);
    expect(readiness.channelReady.web).toBe(true);
    expect(readiness.channelReady.whatsapp).toBe(false);
    expect(readiness.channelReady.voiceNotes).toBe(false);
  });

  it("requires both server configuration and a tenant phone mapping for WhatsApp", async () => {
    process.env.TENGAAGENT_WHATSAPP_VERIFY_TOKEN = "verify";
    process.env.TENGAAGENT_WHATSAPP_APP_SECRET = "app-secret";
    process.env.TENGAAGENT_WHATSAPP_ACCESS_TOKEN = "access-token";
    process.env.TENGAAGENT_WHATSAPP_GRAPH_VERSION = "v23.0";

    const { organization, agent } = await createTenant({ plan: "growth" });

    let readiness = await getTenantPilotReadiness({
      organizationId: organization._id,
    });
    expect(readiness.environment.whatsappReady).toBe(true);
    expect(readiness.channelReady.whatsapp).toBe(false);

    await WhatsAppConnection.create({
      organizationId: organization._id,
      agentId: agent._id,
      phoneNumberId: "pilot-phone-number-id",
      status: "active",
    });

    readiness = await getTenantPilotReadiness({
      organizationId: organization._id,
    });
    expect(readiness.channelReady.whatsapp).toBe(true);
  });

  it("requires explicit voice enablement and OpenAI readiness before voice notes are ready", async () => {
    process.env.TENGAAGENT_WHATSAPP_VERIFY_TOKEN = "verify";
    process.env.TENGAAGENT_WHATSAPP_APP_SECRET = "app-secret";
    process.env.TENGAAGENT_WHATSAPP_ACCESS_TOKEN = "access-token";
    process.env.TENGAAGENT_WHATSAPP_GRAPH_VERSION = "v23.0";

    const { organization, agent } = await createTenant({ plan: "growth" });
    await WhatsAppConnection.create({
      organizationId: organization._id,
      agentId: agent._id,
      phoneNumberId: "pilot-voice-phone-id",
      status: "active",
    });

    let readiness = await getTenantPilotReadiness({
      organizationId: organization._id,
    });
    expect(readiness.channelReady.voiceNotes).toBe(false);

    process.env.TENGAAGENT_WHATSAPP_VOICE_ENABLED = "true";
    readiness = await getTenantPilotReadiness({
      organizationId: organization._id,
    });
    expect(readiness.environment.voiceReady).toBe(true);
    expect(readiness.channelReady.voiceNotes).toBe(true);
  });

  it("summarizes Google and Microsoft calendar readiness independently", () => {
    const base = getEnvStatus();
    expect(summarizeEnv(base).googleCalendarReady).toBe(false);
    expect(summarizeEnv(base).microsoftCalendarReady).toBe(false);

    process.env.TENGAAGENT_CALENDAR_ENCRYPTION_KEY = "12345678901234567890123456789012";
    process.env.GOOGLE_CALENDAR_CLIENT_ID = "google-id";
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "google-secret";

    const google = summarizeEnv(getEnvStatus());
    expect(google.googleCalendarReady).toBe(true);
    expect(google.microsoftCalendarReady).toBe(false);
  });
});
