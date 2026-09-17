const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengaagent-pilot-readiness-route-test";
process.env.JWT_SECRET =
  "pilot-route-jwt-secret-2026-at-least-32-characters";
process.env.JWT_REFRESH_SECRET =
  "pilot-route-refresh-secret-2026-at-least-32-characters";
process.env.AUTH_CHALLENGE_SECRET =
  "pilot-route-auth-secret-2026-at-least-32-characters";
process.env.MEDIA_SIGNING_SECRET =
  "pilot-route-media-secret-2026-at-least-32-characters";
process.env.OPENAI_API_KEY = "test-openai-key";

jest.mock(
  "../middleware/auth",
  () => (req, res, next) => {
    const userId = req.headers["x-test-user-id"];
    if (!userId) {
      return res.status(401).json({ error: "No token" });
    }

    req.user = {
      id: userId,
      _id: userId,
    };
    req.userId = userId;
    return next();
  }
);

const app = require("../app");
const User = require("../models/User");
const Organization = require("../models/tengaAgent/Organization");
const Agent = require("../models/tengaAgent/Agent");
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
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

const createOwner = async () => {
  const userId = new mongoose.Types.ObjectId();
  const user = await User.create({
    name: "Pilot Owner",
    username: `pilotowner${userId.toString().slice(-8)}`,
    email: `pilot-${userId}@example.com`,
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
      .set("x-test-user-id", String(owner.user._id));

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.readiness.organization.id).toBe(
      String(owner.organization._id)
    );
    expect(response.body.readiness.channelReady.web).toBe(true);
    expect(response.body.readiness.channelReady.whatsapp).toBe(false);
    expect(response.body.readiness.requirements.core).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "JWT_SECRET" }),
        expect.objectContaining({ key: "OPENAI_API_KEY" }),
      ])
    );

    const raw = JSON.stringify(response.body);
    expect(raw).not.toContain(process.env.JWT_SECRET);
    expect(raw).not.toContain(process.env.JWT_REFRESH_SECRET);
    expect(raw).not.toContain(process.env.AUTH_CHALLENGE_SECRET);
    expect(raw).not.toContain(process.env.MEDIA_SIGNING_SECRET);
    expect(raw).not.toContain("test-openai-key");
  });
});