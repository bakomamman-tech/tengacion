const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-launch-growth-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "launch_growth_test_secret_123456789012";

const app = require("../app");
const AuditLog = require("../models/AuditLog");
const CreatorProfile = require("../models/CreatorProfile");
const RevenueCampaign = require("../models/RevenueCampaign");
const User = require("../models/User");

let mongod;

const issueSessionToken = async (userId) => {
  const sessionId = new mongoose.Types.ObjectId().toString();
  await User.updateOne(
    { _id: userId },
    { $push: { sessions: { sessionId, createdAt: new Date(), lastSeenAt: new Date() } } }
  );
  return jwt.sign(
    { id: userId.toString(), tv: 0, sid: sessionId },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );
};

const createAdminToken = async () => {
  const admin = await User.create({
    name: "Launch Growth Admin",
    username: "launch_growth_admin",
    email: "launch-growth-admin@test.com",
    password: "Password123!",
    role: "admin",
    isVerified: true,
    emailVerified: true,
  });
  return { admin, token: await issueSessionToken(admin._id) };
};

describe("launch growth admin routes", () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
    await mongoose.connect(mongod.getUri(), {
      serverSelectionTimeoutMS: 60000,
      socketTimeoutMS: 60000,
    });
  });

  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
  });

  afterAll(async () => {
    try {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.dropDatabase();
      }
    } finally {
      await mongoose.disconnect().catch(() => null);
      if (mongod) await mongod.stop();
    }
  });

  test("keeps the next-ten operating report behind admin authentication", async () => {
    await request(app)
      .get("/api/admin/analytics/launch-growth-operating-system?range=30d")
      .expect(401);

    const { token } = await createAdminToken();
    const response = await request(app)
      .get("/api/admin/analytics/launch-growth-operating-system?range=30d")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.roadmapPackages).toHaveLength(10);
    expect(response.body.payoutAutomation.controls.moneyMovementAutomated).toBe(false);
    expect(response.body.dataLimits.note).toMatch(/bounded/i);
  });

  test("creates an incomplete campaign as a draft but blocks activation without readiness evidence", async () => {
    const { token } = await createAdminToken();
    const created = await request(app)
      .post("/api/admin/growth/revenue-campaigns")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "First creator drop", type: "creator_drop" })
      .expect(201);

    expect(created.body.campaign).toMatchObject({
      status: "draft",
      readinessState: "blocked",
      ledgerTrackingKey: "campaign_first_creator_drop",
    });
    expect(created.body.campaign.blockers).toEqual(expect.arrayContaining([
      "owner",
      "window",
      "eligibility",
      "margin",
      "refunds",
      "metric",
      "rollback",
    ]));

    await request(app)
      .patch(`/api/admin/growth/revenue-campaigns/${created.body.campaign.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "ready", reason: "Attempt activation" })
      .expect(409);

    expect(await RevenueCampaign.countDocuments({ status: "draft" })).toBe(1);
    expect(await AuditLog.countDocuments({ action: "admin.revenue_campaign.create" })).toBe(1);
  });

  test("persists creator program enrollment with an accountable owner and audit evidence", async () => {
    const { token } = await createAdminToken();
    const creatorUser = await User.create({
      name: "Cohort Creator",
      username: "cohort_creator",
      email: "cohort-creator@test.com",
      password: "Password123!",
      role: "artist",
      isArtist: true,
      isVerified: true,
    });
    const profile = await CreatorProfile.create({
      userId: creatorUser._id,
      displayName: "Cohort Creator",
      creatorTypes: ["music"],
      acceptedTerms: true,
      acceptedCopyrightDeclaration: true,
      onboardingComplete: true,
      status: "active",
    });

    const response = await request(app)
      .post("/api/admin/growth/creator-programs/enroll")
      .set("Authorization", `Bearer ${token}`)
      .send({
        creatorProfileId: profile._id.toString(),
        programKey: "first_paid_drop",
        ownerName: "Creator Success Lead",
        adminNote: "Creator confirmed promotion participation.",
      })
      .expect(201);

    expect(response.body.enrollment).toMatchObject({
      creatorProfileId: profile._id.toString(),
      programKey: "first_paid_drop",
      status: "enrolled",
      ownerName: "Creator Success Lead",
    });
    expect(response.body.enrollment.checklist.length).toBeGreaterThan(0);
    expect(await AuditLog.countDocuments({ action: "admin.creator_lifecycle.enroll" })).toBe(1);
  });

  test("audits payout preflight while returning no authority to move money", async () => {
    const { token } = await createAdminToken();
    const response = await request(app)
      .post("/api/admin/finance/payout-automation/preflight")
      .set("Authorization", `Bearer ${token}`)
      .send({})
      .expect(200);

    expect(response.body.moneyMovementAuthorized).toBe(false);
    expect(response.body.candidateRequestIds).toEqual([]);
    expect(await AuditLog.countDocuments({ action: "admin.payout_automation.preflight" })).toBe(1);
  });
});
