const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-expansion-platform-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "expansion_platform_test_secret_123456789012";

const app = require("../app");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const AuditLog = require("../models/AuditLog");
const AutomationSuggestion = require("../models/AutomationSuggestion");
const CreatorLaunchPlan = require("../models/CreatorLaunchPlan");
const CreatorProfile = require("../models/CreatorProfile");
const ExpansionExperiment = require("../models/ExpansionExperiment");
const GovernanceDecision = require("../models/GovernanceDecision");
const ReferralAttribution = require("../models/ReferralAttribution");
const User = require("../models/User");

let mongod;

const issueSessionToken = async (userId) => {
  const sessionId = new mongoose.Types.ObjectId().toString();
  await User.updateOne({ _id: userId }, { $push: { sessions: { sessionId, createdAt: new Date(), lastSeenAt: new Date() } } });
  return jwt.sign({ id: userId.toString(), tv: 0, sid: sessionId }, process.env.JWT_SECRET, { expiresIn: "2h" });
};

const createUser = async ({ suffix, role = "user" }) => {
  const user = await User.create({
    name: `Expansion ${suffix}`,
    username: `expansion_${suffix}`,
    email: `expansion_${suffix}@test.com`,
    password: "Password123!",
    role,
    isArtist: role === "artist",
    isVerified: true,
    emailVerified: true,
  });
  return { user, token: await issueSessionToken(user._id) };
};

const createCreator = async () => {
  const session = await createUser({ suffix: "creator", role: "artist" });
  const profile = await CreatorProfile.create({
    userId: session.user._id,
    displayName: "Expansion Creator",
    fullName: "Expansion Creator",
    bio: "Creator launch test profile",
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
  return { ...session, profile };
};

describe("expansion and platform protected routes", () => {
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

  test("protects creator planning and the operating report by role", async () => {
    await request(app).post("/api/creator/launch-plans").send({}).expect(401);
    await request(app).get("/api/admin/analytics/expansion-platform-operating-system?range=30d").expect(401);

    const viewer = await createUser({ suffix: "viewer" });
    await request(app)
      .get("/api/admin/analytics/expansion-platform-operating-system?range=30d")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(403);
  });

  test("lets a creator persist a playbook plan and submit elevated risk for review", async () => {
    const creator = await createCreator();
    const { token } = creator;
    const admin = await createUser({ suffix: "launch_reviewer", role: "admin" });
    const created = await request(app)
      .post("/api/creator/launch-plans")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Creator live night",
        playbookType: "live_event_launch",
        offerType: "live_event_pass",
        launchAt: "2026-09-20T18:00:00.000Z",
        price: 5000,
        coverReady: true,
        announcementDraft: "Reviewed event announcement",
        fanUpdatePlan: "One reminder and one event update",
      })
      .expect(201);

    expect(created.body.plan).toMatchObject({ status: "planning", riskLevel: "elevated", playbookType: "live_event_launch" });

    await request(app)
      .patch(`/api/creator/launch-plans/${created.body.plan.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "review_required", reason: "Submit live event for trust and operations review" })
      .expect(200);

    await request(app)
      .patch(`/api/admin/growth/creator-launch-plans/${created.body.plan.id}/review`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ decision: "approved", note: "Finance and trust controls reviewed" })
      .expect(200);

    const changedAfterApproval = await request(app)
      .patch(`/api/creator/launch-plans/${created.body.plan.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Creator live night - revised" })
      .expect(200);

    expect(changedAfterApproval.body.plan).toMatchObject({
      status: "review_required",
      reviewedAt: null,
      reviewNote: "",
    });
    expect(await CreatorLaunchPlan.countDocuments({ status: "review_required" })).toBe(1);
  });

  test("creates a privacy-safe referral redirect and deduplicated milestone", async () => {
    const creator = await createCreator();
    const referralResponse = await request(app)
      .post("/api/creator/referrals")
      .set("Authorization", `Bearer ${creator.token}`)
      .send({ sourceType: "creator_profile_share", sourceKey: "expansion_creator", destinationPath: "/creator/expansion_creator", label: "Profile share" })
      .expect(201);
    const referral = referralResponse.body.referral;

    await request(app)
      .post("/api/creator/referrals")
      .set("Authorization", `Bearer ${creator.token}`)
      .send({ sourceType: "creator_profile_share", destinationPath: "/\\evil.example", label: "Unsafe redirect" })
      .expect(400);

    await request(app).get(referral.sharePath).expect(302).expect("Location", /\/creator\/expansion_creator\?ref=/);

    const viewer = await createUser({ suffix: "referred_viewer" });
    await request(app)
      .post(`/api/referrals/${referral.token}/milestones`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .send({ milestone: "first_follow" })
      .expect(409);

    await AnalyticsEvent.create({
      type: "creator_followed",
      userId: viewer.user._id,
      actorRole: "user",
      targetId: creator.profile._id,
      targetType: "creator",
      contentType: "creator",
      metadata: { creatorId: creator.profile._id.toString(), source: "creator_follow_toggle" },
    });
    await User.updateOne(
      { _id: viewer.user._id },
      { $addToSet: { following: creator.user._id } }
    );

    await request(app)
      .post(`/api/referrals/${referral.token}/milestones`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .send({ milestone: "first_follow" })
      .expect(200, { recorded: true, milestone: "first_follow" });
    await request(app)
      .post(`/api/referrals/${referral.token}/milestones`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .send({ milestone: "first_follow" })
      .expect(200, { recorded: false, milestone: "first_follow" });

    const stored = await ReferralAttribution.findById(referral.id).lean();
    expect(stored.counters).toMatchObject({ inviteSent: 1, linkOpened: 1, firstFollow: 1 });
    expect(JSON.stringify(stored)).not.toContain(viewer.user._id.toString());
  });

  test("persists audited experiment, suggestion-only automation, and independent governance", async () => {
    const firstAdmin = await createUser({ suffix: "admin_one", role: "admin" });
    const secondAdmin = await createUser({ suffix: "admin_two", role: "admin" });

    const experiment = await request(app)
      .post("/api/admin/growth/experiments")
      .set("Authorization", `Bearer ${firstAdmin.token}`)
      .send({
        name: "Creator launch prompt", hypothesis: "A playbook prompt improves completed plans", ownerName: "Data Lead", cohort: "New creators", surface: "creator_dashboard",
        variants: [{ key: "control", description: "No prompt", allocationPercent: 50 }, { key: "playbook", description: "Playbook prompt", allocationPercent: 50 }],
        primaryMetric: "activation", guardrailMetrics: ["support_load", "complaint_rate"], stopCondition: "Stop if complaints rise",
        startAt: "2026-09-01T00:00:00.000Z", endAt: "2026-09-08T00:00:00.000Z", decisionAt: "2026-09-09T00:00:00.000Z",
      })
      .expect(201);

    await request(app)
      .post("/api/admin/operations/automation-suggestions")
      .set("Authorization", `Bearer ${firstAdmin.token}`)
      .send({ suggestionType: "payout_queue_priority", targetType: "payout", targetId: "queue-1", title: "Review oldest verified request", suggestedAction: "Prioritize for human review", confidence: 0.8, sourceSignals: { ageHours: 48 }, authorizesSensitiveAction: true, expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() })
      .expect(201);

    const governance = await request(app)
      .post("/api/admin/governance/decisions")
      .set("Authorization", `Bearer ${firstAdmin.token}`)
      .send({
        workflowType: "sponsored_campaign", subjectType: "campaign", subjectId: "campaign-1", title: "Sponsor collection review", ownerName: "Partner Lead", ownerRole: "Partnerships", riskLevel: "high",
        requiredReviewRoles: ["product", "trust"], evidence: [{ key: "creator_consent", reference: "consent-record-1" }], rollbackPlan: "Pause all sponsored surfaces", expiresAt: "2026-10-01T00:00:00.000Z", followUpAt: "2026-09-15T00:00:00.000Z",
      })
      .expect(201);

    await request(app)
      .patch(`/api/admin/governance/decisions/${governance.body.decision.id}`)
      .set("Authorization", `Bearer ${firstAdmin.token}`)
      .send({ approvalRole: "product", approvalDecision: "approved", reason: "Product evidence reviewed" })
      .expect(200);
    await request(app)
      .patch(`/api/admin/governance/decisions/${governance.body.decision.id}`)
      .set("Authorization", `Bearer ${firstAdmin.token}`)
      .send({ approvalRole: "trust", approvalDecision: "approved", reason: "Try to self-approve both roles" })
      .expect(409);
    await request(app)
      .patch(`/api/admin/governance/decisions/${governance.body.decision.id}`)
      .set("Authorization", `Bearer ${secondAdmin.token}`)
      .send({ approvalRole: "trust", approvalDecision: "approved", status: "approved", reason: "Trust evidence independently reviewed" })
      .expect(200);

    expect(await ExpansionExperiment.countDocuments({ _id: experiment.body.experiment.id, status: "draft" })).toBe(1);
    expect(await AutomationSuggestion.countDocuments({ authorizesSensitiveAction: false })).toBe(1);
    expect(await GovernanceDecision.countDocuments({ status: "approved" })).toBe(1);
    expect(await AuditLog.countDocuments({ action: { $in: ["admin.expansion_experiment.create", "admin.automation_suggestion.create", "admin.governance_decision.create", "admin.governance_decision.update"] } })).toBeGreaterThanOrEqual(5);
  });
});
