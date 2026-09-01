const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-ecosystem-network-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "ecosystem_network_test_secret_123456789012";

const app = require("../app");
const AuditLog = require("../models/AuditLog");
const CreatorProfile = require("../models/CreatorProfile");
const User = require("../models/User");

let mongod;

const issueSessionToken = async (userId) => {
  const sessionId = new mongoose.Types.ObjectId().toString();
  await User.updateOne({ _id: userId }, { $push: { sessions: { sessionId, createdAt: new Date(), lastSeenAt: new Date() } } });
  return jwt.sign({ id: userId.toString(), tv: 0, sid: sessionId }, process.env.JWT_SECRET, { expiresIn: "2h" });
};

const createUser = async ({ suffix, role = "user" }) => {
  const user = await User.create({
    name: `Ecosystem ${suffix}`,
    username: `ecosystem_${suffix}`,
    email: `ecosystem_${suffix}@test.com`,
    password: "Password123!",
    role,
    isArtist: role === "artist",
    isVerified: true,
    emailVerified: true,
  });
  return { user, token: await issueSessionToken(user._id) };
};

describe("ecosystem and network protected routes", () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
    await mongoose.connect(mongod.getUri(), { serverSelectionTimeoutMS: 60000, socketTimeoutMS: 60000 });
  });

  beforeEach(async () => { await mongoose.connection.db.dropDatabase(); });

  afterAll(async () => {
    try {
      if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    } finally {
      await mongoose.disconnect().catch(() => null);
      if (mongod) await mongod.stop();
    }
  });

  test("protects the operating report by admin role", async () => {
    await request(app).get("/api/admin/analytics/ecosystem-network-operating-system?range=30d").expect(401);
    const viewer = await createUser({ suffix: "viewer" });
    await request(app)
      .get("/api/admin/analytics/ecosystem-network-operating-system?range=30d")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(403);
  });

  test("persists audited ecosystem controls and publishes the twenty-five-package view", async () => {
    const admin = await createUser({ suffix: "admin", role: "admin" });
    const creator = await createUser({ suffix: "creator", role: "artist" });
    const profile = await CreatorProfile.create({
      userId: creator.user._id,
      displayName: "Ecosystem Creator",
      fullName: "Ecosystem Creator",
      bio: "Controlled creator service test",
      phoneNumber: "08000000000",
      accountNumber: "1234567890",
      country: "Nigeria",
      countryOfResidence: "Nigeria",
      creatorTypes: ["music"],
      acceptedTerms: true,
      acceptedCopyrightDeclaration: true,
      onboardingCompleted: true,
      onboardingComplete: true,
      status: "active",
    });
    const auth = { Authorization: `Bearer ${admin.token}` };

    const service = await request(app)
      .post("/api/admin/growth/creator-services")
      .set(auth)
      .send({ creatorProfileId: profile._id, programKey: "launch_coaching", ownerName: "Creator Lead", reviewAt: "2026-09-15T00:00:00.000Z" })
      .expect(201);
    expect(service.body.enrollment).toMatchObject({ programKey: "launch_coaching", status: "candidate", serviceTier: "basic_support" });

    const loop = await request(app)
      .post("/api/admin/growth/community-loops")
      .set(auth)
      .send({ loopType: "saved_content_completion", ownerName: "Lifecycle Lead", scopeType: "creator", scopeId: profile._id, startAt: "2026-09-02T00:00:00.000Z", endAt: "2026-09-30T00:00:00.000Z", reviewAt: "2026-09-15T00:00:00.000Z" })
      .expect(201);
    expect(loop.body.communityLoop).toMatchObject({ status: "draft", loopType: "saved_content_completion" });

    const partner = await request(app)
      .post("/api/admin/partnerships/integrations")
      .set(auth)
      .send({ partnerName: "Campus Partner", partnerType: "school", level: "manual_report", ownerName: "Partner Lead", reviewAt: "2026-09-15T00:00:00.000Z", accessExpiresAt: "2026-10-01T00:00:00.000Z" })
      .expect(201);
    expect(partner.body.integration).toMatchObject({ level: "manual_report", status: "requested", fanLevelRowsExposed: false });

    const market = await request(app)
      .post("/api/admin/growth/market-readiness")
      .set(auth)
      .send({ marketName: "Kaduna Music", marketType: "community", ownerName: "Expansion Lead", costCap: 100000, reviewAt: "2026-09-15T00:00:00.000Z" })
      .expect(201);
    expect(market.body.market).toMatchObject({ state: "research", controlledLaunchEligible: false });

    const report = await request(app)
      .get("/api/admin/analytics/ecosystem-network-operating-system?range=30d")
      .set(auth)
      .expect(200);
    expect(report.body.roadmapPackages).toHaveLength(25);
    expect(report.body.summary).toMatchObject({ roadmapPackagesComplete: 25, networkState: "defined_not_launched" });
    expect(report.body.dataLimits.fanLevelRowsExposed).toBe(false);

    const auditActions = await AuditLog.find({}).distinct("action");
    expect(auditActions).toEqual(expect.arrayContaining([
      "admin.creator_service.enroll",
      "admin.community_loop.create",
      "admin.partner_integration.create",
      "admin.market_readiness.create",
    ]));
  });
});
