const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengaagent-pilot-readiness-route-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "pilot-route-jwt-secret";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "pilot-route-refresh-secret";
process.env.AUTH_CHALLENGE_SECRET = process.env.AUTH_CHALLENGE_SECRET || "pilot-route-auth-secret";
process.env.OPENAI_API_KEY = "test-openai-key";

const app = require("../app");
const User = require("../models/User");
const Organization = require("../models/tengaAgent/Organization");
const Agent = require("../models/tengaAgent/Agent");
const Subscription = require("../models/tengaAgent/Subscription");
const Usage = require("../models/tengaAgent/Usage");
const { signAccessToken } = require("../services/tokenService");
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
  process.env.TENGAAGENT_WHATSAPP_VOICE_ENABLED = "false";
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

const createOwner = async () => {
  const user = await User.create({
    name: "Pilot Owner",
    email: `pilot-${new mongoose.Types.ObjectId()}@example.com`,
    password: "StrongPass123!",
  });

  const organization = await Organization.create({
    name: "Pilot Business",
    slug: `pilot-business-${new mongoose.Types.ObjectId().toString().slice(-8)}`,
    ownerUser: user._id,
    plan: "starter",
    status: "active",
  });

  await Agent.create({
    organizationId: organization._id,
    key: "receptionist",
    name: "TengaAgent",
    status: "active",
  });
  await ensureSubscriptionForOrganization(organization);

  return {
    user,
    organization,
    token: signAccessToken(user),
  };
};

describe("TengaAgent owner pilot readiness route", () => {
  it("requires authentication", async () => {
    const response = await request(app)
      .get("/api/tengaagent/owner/pilot-readiness");

    expect(response.status).toBe(401);
  });

  it("returns only readiness metadata for the authenticated owner's tenant", async () => {
    const owner = await createOwner();

    const response = await request(app)
      .get("/api/tengaagent/owner/pilot-readiness")
      .set("Authorization", `Bearer ${owner.token}`);

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.readiness.organization.id).toBe(
      String(owner.organization._id)
    );
    expect(response.body.readiness.channelReady.web).toBe(true);
    expect(response.body.readiness.channelReady.whatsapp).toBe(false);

    const raw = JSON.stringify(response.body);
    expect(raw).not.toContain("JWT_SECRET");
    expect(raw).not.toContain("OPENAI_API_KEY");
    expect(raw).not.toContain("test-openai-key");
  });
});
