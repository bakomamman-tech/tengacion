const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-network-intelligence-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "network_intelligence_test_secret_123456789";

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
    name: `Intelligence ${suffix}`,
    username: `intelligence_${suffix}`,
    email: `intelligence_${suffix}@test.com`,
    password: "Password123!",
    role,
    isArtist: role === "artist",
    isVerified: true,
    emailVerified: true,
  });
  return { user, token: await issueSessionToken(user._id) };
};

describe("network and intelligence protected routes", () => {
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
    await request(app).get("/api/admin/analytics/network-intelligence-operating-system?range=30d").expect(401);
    const viewer = await createUser({ suffix: "viewer" });
    await request(app)
      .get("/api/admin/analytics/network-intelligence-operating-system?range=30d")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(403);
  });

  test("persists audited governance records, creator feedback, and refuses automation activation", async () => {
    const admin = await createUser({ suffix: "admin", role: "admin" });
    const creator = await createUser({ suffix: "creator", role: "artist" });
    const profile = await CreatorProfile.create({
      userId: creator.user._id,
      isCreator: true,
      displayName: "Intelligence Creator",
      fullName: "Intelligence Creator",
      bio: "Controlled creator intelligence test",
      phoneNumber: "08000000001",
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
    const adminAuth = { Authorization: `Bearer ${admin.token}` };
    const creatorAuth = { Authorization: `Bearer ${creator.token}` };

    const program = await request(app)
      .post("/api/admin/growth/network-programs")
      .set(adminAuth)
      .send({ creatorProfileId: profile._id, programType: "launch_collaboration", ownerName: "Network Lead", reviewAt: "2026-09-15T00:00:00.000Z" })
      .expect(201);
    expect(program.body.program).toMatchObject({ status: "candidate", creatorConsentRecorded: false });

    const metric = await request(app)
      .post("/api/admin/intelligence/metric-contracts")
      .set(adminAuth)
      .send({ metricKey: "creator_program_outcomes", ownerName: "Data Lead", trustState: "trusted", trustReason: "Reviewed source", observedAt: "2026-09-01T10:00:00.000Z", reviewAt: "2026-09-10T00:00:00.000Z" })
      .expect(201);
    expect(metric.body.contract).toMatchObject({ metricKey: "creator_program_outcomes", canDriveDecision: true });

    const product = await request(app)
      .post("/api/admin/intelligence/products")
      .set(adminAuth)
      .send({ productKey: "creator_opportunity", ownerName: "Product Lead", status: "pilot", qualityState: "trusted", sourceMetricKeys: ["creator_program_outcomes"], confidence: 0.8, reviewAt: "2026-09-10T00:00:00.000Z", reason: "Controlled creator pilot" })
      .expect(201);

    const prompt = await request(app)
      .post("/api/admin/intelligence/creator-prompts")
      .set(adminAuth)
      .send({ creatorProfileId: profile._id, productId: product.body.product.id, title: "Review your next launch", explanation: "A reviewed creator-program signal suggests checking your next launch plan.", timeframeLabel: "Last 30 days", confidence: 0.8, expiresAt: "2026-10-01T00:00:00.000Z" })
      .expect(201);

    const feedback = await request(app)
      .patch(`/api/creator/intelligence/prompts/${prompt.body.prompt.id}`)
      .set(creatorAuth)
      .send({ status: "dismissed", feedback: "not_relevant" })
      .expect(200);
    expect(feedback.body.prompt).toMatchObject({ status: "dismissed", creatorFeedback: "not_relevant" });

    const automation = await request(app)
      .post("/api/admin/operations/automation-registry")
      .set(adminAuth)
      .send({ automationKey: "support_triage", title: "Support triage", ownerName: "Support Lead", surface: "admin_support", actorAffected: "support_agent", trigger: "Backlog warning", actionType: "suggestion", riskLevel: "medium", auditEvent: "automation_support_triage", userVisibleStatus: "suggested", successMetric: "response_time", guardrailMetrics: ["incorrect_priority"], reviewAt: "2026-09-10T00:00:00.000Z" })
      .expect(201);
    expect(automation.body.automation).toMatchObject({ state: "proposed", executionAuthority: "none_in_automation_001" });

    await request(app)
      .patch(`/api/admin/operations/automation-registry/${automation.body.automation.id}`)
      .set(adminAuth)
      .send({ state: "active", reason: "Activate now" })
      .expect(409);

    const report = await request(app)
      .get("/api/admin/analytics/network-intelligence-operating-system?range=30d")
      .set(adminAuth)
      .expect(200);
    expect(report.body.roadmapPackages).toHaveLength(30);
    expect(report.body.summary.roadmapPackagesComplete).toBe(30);
    expect(report.body.dataLimits.automationExecutionEnabled).toBe(false);

    const auditActions = await AuditLog.find({}).distinct("action");
    expect(auditActions).toEqual(expect.arrayContaining([
      "admin.network_program.create",
      "admin.metric_contract.create",
      "admin.intelligence_product.create",
      "admin.creator_intelligence_prompt.create",
      "admin.automation_registry.create",
    ]));
  });
});
