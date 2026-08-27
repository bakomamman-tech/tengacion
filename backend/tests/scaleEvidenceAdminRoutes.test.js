const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-scale-evidence-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "scale_evidence_test_secret_123456789012";

const app = require("../app");
const AuditLog = require("../models/AuditLog");
const ExpansionBet = require("../models/ExpansionBet");
const GrowthCalendarEntry = require("../models/GrowthCalendarEntry");
const PartnerPilot = require("../models/PartnerPilot");
const ProductionSloPolicy = require("../models/ProductionSloPolicy");
const User = require("../models/User");

let mongod;

const issueSessionToken = async (userId) => {
  const sessionId = new mongoose.Types.ObjectId().toString();
  await User.updateOne({ _id: userId }, { $push: { sessions: { sessionId, createdAt: new Date(), lastSeenAt: new Date() } } });
  return jwt.sign({ id: userId.toString(), tv: 0, sid: sessionId }, process.env.JWT_SECRET, { expiresIn: "2h" });
};

const createAdminToken = async () => {
  const admin = await User.create({
    name: "Scale Evidence Admin", username: "scale_evidence_admin", email: "scale-admin@test.com", password: "Password123!", role: "admin", isVerified: true, emailVerified: true,
  });
  return { admin, token: await issueSessionToken(admin._id) };
};

describe("scale evidence admin routes", () => {
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

  test("protects the scale evidence report behind admin authentication", async () => {
    await request(app).get("/api/admin/analytics/scale-evidence-operating-system?range=30d").expect(401);
  });

  test("creates and audits a ready four-week calendar entry", async () => {
    const { token } = await createAdminToken();
    const creatorId = new mongoose.Types.ObjectId().toString();
    const created = await request(app)
      .post("/api/admin/growth/calendar")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Launch week spotlight", type: "featured_drop", scheduledStartAt: "2026-09-01T00:00:00.000Z", scheduledEndAt: "2026-09-08T00:00:00.000Z",
        ownerName: "Growth Lead", audience: "Launch cohort fans", objective: "Measure paid conversion", callToAction: "Preview the drop", creatorIds: [creatorId],
      })
      .expect(201);

    await request(app)
      .patch(`/api/admin/growth/calendar/${created.body.entry.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "ready", reason: "Owner approved launch evidence" })
      .expect(200);

    expect(await GrowthCalendarEntry.countDocuments({ status: "ready" })).toBe(1);
    expect(await AuditLog.countDocuments({ action: { $in: ["admin.growth_calendar.create", "admin.growth_calendar.update"] } })).toBe(2);
  });

  test("rejects a sponsored pilot without a visible disclosure label", async () => {
    const { token } = await createAdminToken();
    await request(app)
      .post("/api/admin/partnerships/pilots")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Brand collection", type: "brand_collection", sponsored: true, ownerName: "Partner Lead", creatorScope: "Ten creators", fanScope: "Nigeria fans", geography: "Nigeria",
        offer: "Sponsored collection", reportingPackage: "Aggregate campaign report", rightsAndModerationPlan: "Pre-review every asset", financePlan: "Fixed capped fee", exitCriteria: "Stop on rights breach", reviewAt: "2026-09-30T00:00:00.000Z",
      })
      .expect(400);

    expect(await PartnerPilot.countDocuments()).toBe(0);
  });

  test("persists audited SLO targets and complete expansion research bets", async () => {
    const { token } = await createAdminToken();
    await request(app)
      .patch("/api/admin/reliability/slo-policies/checkout_initialization")
      .set("Authorization", `Bearer ${token}`)
      .send({ targetPercent: 99.7, windowDays: 28, reason: "Approve launch checkout budget" })
      .expect(200);

    const scores = ExpansionBet.SCORE_INPUT_KEYS.reduce((result, key) => ({ ...result, [key]: 3 }), {});
    await request(app)
      .post("/api/admin/growth/expansion-bets")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Kaduna campus seed", marketOrSegment: "Kaduna campus creators", ownerName: "Growth Lead", cohortDefinition: "Five verified campus creators", gate: "Three retained creators after 30 days",
        costCap: 500000, successMetric: "Retained paid fans", stopCondition: "Rights breach or cost cap reached", reviewAt: "2026-10-01T00:00:00.000Z", scores,
      })
      .expect(201);

    expect(await ProductionSloPolicy.countDocuments({ key: "checkout_initialization" })).toBe(1);
    expect(await ExpansionBet.countDocuments({ state: "research" })).toBe(1);
    expect(await AuditLog.countDocuments({ action: { $in: ["admin.slo_policy.update", "admin.expansion_bet.create"] } })).toBe(2);
  });
});
