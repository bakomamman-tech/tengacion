const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengaagent-pilot-readiness-test";
process.env.JWT_SECRET = "pilot-readiness-jwt-secret-32-characters-plus";
process.env.JWT_REFRESH_SECRET = "pilot-readiness-refresh-secret-32-characters-plus";
process.env.AUTH_CHALLENGE_SECRET =
  "pilot-readiness-auth-challenge-secret-32-characters-plus";
process.env.MEDIA_SIGNING_SECRET =
  "pilot-readiness-media-signing-secret-32-characters-plus";
process.env.OPENAI_API_KEY = "test-openai-key";

const Organization = require("../models/tengaAgent/Organization");
const Agent = require("../models/tengaAgent/Agent");
const WhatsAppConnection = require("../models/tengaAgent/WhatsAppConnection");
const {
  getEnvStatus,
  getEnvironmentRequirements,
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
  process.env.SMTP_HOST = "";
  process.env.SMTP_PORT = "";
  process.env.SMTP_USER = "";
  process.env.SMTP_PASS = "";
  process.env.SMTP_FROM = "";
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
  it("reports environment booleans and key names without exposing secret values", () => {
    process.env.TENGAAGENT_WHATSAPP_VERIFY_TOKEN = "super-secret-verify-token";
    process.env.TENGAAGENT_WHATSAPP_APP_SECRET = "super-secret-app-secret";
    process.env.TENGAAGENT_WHATSAPP_ACCESS_TOKEN = "super-secret-access-token";
    process.env.TENGAAGENT_WHATSAPP_GRAPH_VERSION = "v23.0";

    const checks = getEnvStatus();
    const requirements = getEnvironmentRequirements();
    const serialized = JSON.stringify({ checks, requirements });

    expect(checks.core.mediaSigning).toBe(true);
    expect(checks.whatsapp.verifyToken).toBe(true);
    expect(checks.whatsapp.appSecret).toBe(true);
    expect(checks.whatsapp.accessToken).toBe(true);
    expect(checks.whatsapp.graphVersion).toBe(true);
    expect(requirements.whatsapp).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "TENGAAGENT_WHATSAPP_ACCESS_TOKEN",
          status: "configured",
        }),
      ])
    );
    expect(serialized).not.toContain("super-secret");
  });

  it("marks weak production secrets and malformed provider settings invalid", () => {
    const strongJwt = process.env.JWT_SECRET;
    const strongMedia = process.env.MEDIA_SIGNING_SECRET;
    process.env.JWT_SECRET = "too-short";
    process.env.MEDIA_SIGNING_SECRET = "short";
    process.env.TENGAAGENT_WHATSAPP_GRAPH_VERSION = "latest";
    process.env.SMTP_PORT = "not-a-port";

    const requirements = getEnvironmentRequirements();

    expect(
      requirements.core.find((entry) => entry.key === "JWT_SECRET")?.status
    ).toBe("invalid");
    expect(
      requirements.core.find(
        (entry) => entry.key === "MEDIA_SIGNING_SECRET"
      )?.status
    ).toBe("invalid");
    expect(
      requirements.whatsapp.find(
        (entry) => entry.key === "TENGAAGENT_WHATSAPP_GRAPH_VERSION"
      )?.status
    ).toBe("invalid");
    expect(
      requirements.email.find((entry) => entry.key === "SMTP_PORT")?.status
    ).toBe("invalid");

    process.env.JWT_SECRET = strongJwt;
    process.env.MEDIA_SIGNING_SECRET = strongMedia;
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
    expect(readiness.requirements.whatsapp[0].status).toBe("not_in_plan");
    expect(readiness.requirements.voice[0].status).toBe("not_in_plan");
  });

  it("requires server configuration, auto-reply enablement and a tenant phone mapping for WhatsApp", async () => {
    process.env.TENGAAGENT_WHATSAPP_VERIFY_TOKEN = "verify";
    process.env.TENGAAGENT_WHATSAPP_APP_SECRET = "app-secret";
    process.env.TENGAAGENT_WHATSAPP_ACCESS_TOKEN = "access-token";
    process.env.TENGAAGENT_WHATSAPP_GRAPH_VERSION = "v23.0";
    process.env.TENGAAGENT_WHATSAPP_AUTO_REPLY_ENABLED = "true";

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
    process.env.TENGAAGENT_WHATSAPP_AUTO_REPLY_ENABLED = "true";

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

  it("summarizes calendar and email readiness independently", () => {
    const base = getEnvStatus();
    expect(summarizeEnv(base).googleCalendarReady).toBe(false);
    expect(summarizeEnv(base).microsoftCalendarReady).toBe(false);
    expect(summarizeEnv(base).emailReady).toBe(false);

    process.env.TENGAAGENT_CALENDAR_ENCRYPTION_KEY =
      "12345678901234567890123456789012";
    process.env.GOOGLE_CALENDAR_CLIENT_ID = "google-id";
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "google-secret";
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "mailer";
    process.env.SMTP_PASS = "mailer-pass";
    process.env.SMTP_FROM = "noreply@example.com";

    const configured = summarizeEnv(getEnvStatus());
    expect(configured.googleCalendarReady).toBe(true);
    expect(configured.microsoftCalendarReady).toBe(false);
    expect(configured.emailReady).toBe(true);
  });
});
