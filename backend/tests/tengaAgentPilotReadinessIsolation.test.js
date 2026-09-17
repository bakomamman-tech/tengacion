const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengaagent-pilot-isolation-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "pilot-isolation-jwt";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "pilot-isolation-refresh";
process.env.AUTH_CHALLENGE_SECRET = process.env.AUTH_CHALLENGE_SECRET || "pilot-isolation-auth";
process.env.OPENAI_API_KEY = "test-openai-key";

const Organization = require("../models/tengaAgent/Organization");
const Agent = require("../models/tengaAgent/Agent");
const WhatsAppConnection = require("../models/tengaAgent/WhatsAppConnection");
const {
  ensureSubscriptionForOrganization,
} = require("../services/tengaAgent/billingService");
const {
  getTenantPilotReadiness,
} = require("../services/tengaAgent/pilotReadinessService");

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create({
    instance: { launchTimeout: 60000 },
  });
  await mongoose.connect(mongod.getUri());
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  process.env.TENGAAGENT_WHATSAPP_VERIFY_TOKEN = "verify";
  process.env.TENGAAGENT_WHATSAPP_APP_SECRET = "app-secret";
  process.env.TENGAAGENT_WHATSAPP_ACCESS_TOKEN = "access-token";
  process.env.TENGAAGENT_WHATSAPP_GRAPH_VERSION = "v23.0";
  process.env.TENGAAGENT_WHATSAPP_AUTO_REPLY_ENABLED = "true";
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

const createTenant = async (slug) => {
  const organization = await Organization.create({
    name: `${slug} Limited`,
    slug,
    plan: "growth",
    status: "active",
  });
  const agent = await Agent.create({
    organizationId: organization._id,
    key: "receptionist",
    name: `${slug} agent`,
    status: "active",
  });
  await ensureSubscriptionForOrganization(organization);
  return { organization, agent };
};

describe("TengaAgent pilot readiness isolation", () => {
  it("does not count another tenant's WhatsApp connection", async () => {
    const first = await createTenant("pilot-one");
    const second = await createTenant("pilot-two");

    await WhatsAppConnection.create({
      organizationId: second.organization._id,
      agentId: second.agent._id,
      phoneNumberId: "second-tenant-phone",
      status: "active",
    });

    const firstReadiness = await getTenantPilotReadiness({
      organizationId: first.organization._id,
    });
    const secondReadiness = await getTenantPilotReadiness({
      organizationId: second.organization._id,
    });

    expect(firstReadiness.integrations.activeWhatsAppConnections).toBe(0);
    expect(firstReadiness.channelReady.whatsapp).toBe(false);
    expect(secondReadiness.integrations.activeWhatsAppConnections).toBe(1);
    expect(secondReadiness.channelReady.whatsapp).toBe(true);
  });
});