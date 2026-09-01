const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-automation-orchestration-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "automation_orchestration_test_secret_123456789";

const app = require("../app");
const AuditLog = require("../models/AuditLog");
const CreatorProfile = require("../models/CreatorProfile");
const User = require("../models/User");

let mongod;

const future = (days = 7) => new Date(Date.now() + (days * 24 * 60 * 60 * 1000)).toISOString();

const issueSessionToken = async (userId) => {
  const sessionId = new mongoose.Types.ObjectId().toString();
  await User.updateOne({ _id: userId }, { $push: { sessions: { sessionId, createdAt: new Date(), lastSeenAt: new Date() } } });
  return jwt.sign({ id: userId.toString(), tv: 0, sid: sessionId }, process.env.JWT_SECRET, { expiresIn: "2h" });
};

const createUser = async ({ suffix, role = "user" }) => {
  const user = await User.create({
    name: `Workflow ${suffix}`, username: `workflow_${suffix}`, email: `workflow_${suffix}@test.com`,
    password: "Password123!", role, isArtist: role === "artist", isVerified: true, emailVerified: true,
  });
  return { user, token: await issueSessionToken(user._id) };
};

describe("automation, orchestration, and resilience protected routes", () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
    await mongoose.connect(mongod.getUri(), { serverSelectionTimeoutMS: 60000, socketTimeoutMS: 60000 });
  });
  beforeEach(async () => { await mongoose.connection.db.dropDatabase(); });
  afterAll(async () => {
    try { if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase(); }
    finally { await mongoose.disconnect().catch(() => null); if (mongod) await mongod.stop(); }
  });

  test("protects the combined operating report by admin role", async () => {
    await request(app).get("/api/admin/analytics/automation-orchestration-operating-system?range=30d").expect(401);
    const viewer = await createUser({ suffix: "viewer" });
    await request(app).get("/api/admin/analytics/automation-orchestration-operating-system?range=30d").set("Authorization", `Bearer ${viewer.token}`).expect(403);
  });

  test("runs an audited low-risk pilot while retaining dependency and creator controls", async () => {
    const admin = await createUser({ suffix: "admin", role: "admin" });
    const creator = await createUser({ suffix: "creator", role: "artist" });
    const profile = await CreatorProfile.create({
      userId: creator.user._id, isCreator: true, displayName: "Workflow Creator", fullName: "Workflow Creator",
      bio: "Controlled workflow route test", phoneNumber: "08000000002", accountNumber: "1234567890",
      country: "Nigeria", countryOfResidence: "Nigeria", creatorTypes: ["music"], acceptedTerms: true,
      acceptedCopyrightDeclaration: true, onboardingCompleted: true, onboardingComplete: true, status: "active",
    });
    const adminAuth = { Authorization: `Bearer ${admin.token}` };
    const creatorAuth = { Authorization: `Bearer ${creator.token}` };

    const registry = await request(app).post("/api/admin/operations/automation-registry").set(adminAuth).send({
      automationKey: "creator_catalog_reminder", title: "Creator catalog reminder", ownerName: "Creator Ops",
      ownerRole: "Creator operations", surface: "creator_dashboard", actorAffected: "creator",
      trigger: "Missing catalog metadata", inputSignals: ["catalog_quality"], actionType: "notification",
      riskLevel: "low", auditEvent: "automation_creator_catalog_reminder", userVisibleStatus: "automated",
      successMetric: "catalog_completion", guardrailMetrics: ["creator_confusion"], reviewAt: future(10),
    }).expect(201);

    await request(app).patch(`/api/admin/operations/automation-registry/${registry.body.automation.id}`).set(adminAuth).send({ state: "designed", reason: "Candidate design reviewed" }).expect(200);
    const pilot = await request(app).patch(`/api/admin/operations/automation-control-plane/${registry.body.automation.id}`).set(adminAuth).send({
      state: "pilot", reason: "Approve a bounded creator reminder pilot", approvePilot: true,
      riskClass: "low_risk_action", workflowDomain: "creator", runbookPath: "/runbooks/catalog-reminder",
      userControls: ["dismiss", "snooze", "explain", "request_help", "hide_type"], rolloutPercent: 5,
      rollbackTestedAt: new Date().toISOString(),
    }).expect(200);
    expect(pilot.body.automation).toMatchObject({ state: "pilot", riskClass: "low_risk_action", approvalRecorded: true, rollbackTested: true });

    const automationRun = await request(app).post("/api/admin/operations/automation-runs").set(adminAuth).send({
      automationId: registry.body.automation.id, affectedUser: creator.user._id, creatorProfile: profile._id,
      affectedActor: "creator", status: "suggested", triggerSummary: "One catalog item is missing metadata.",
      sourceSignals: [{ key: "catalog_quality", sourceAuthority: "Creator catalog", observedAt: new Date().toISOString(), confidence: 0.95 }],
      actionSummary: "Remind the creator to review missing metadata.", userVisibleMessage: "Review one item with missing catalog details.",
    }).expect(201);
    await request(app).patch(`/api/creator/automation/runs/${automationRun.body.run.id}/control`).set(creatorAuth).send({ state: "dismissed", feedback: "not_relevant" }).expect(200);

    const definition = await request(app).post("/api/admin/orchestration/workflow-definitions").set(adminAuth).send({
      workflowKey: "creator_launch_readiness", title: "Creator launch readiness", ownerName: "Launch Lead",
      ownerRole: "Creator operations", participantTeams: ["creator_ops", "catalog"], startTrigger: "Creator requests launch review",
      dependencies: [{ type: "catalog_quality", sourceSystem: "Creator catalog", ownerName: "Catalog Lead", passCondition: "Required metadata passes", staleCondition: "Evidence is older than 24 hours", overridePolicy: "Named owner approval with expiry", escalationPath: "/admin/catalog", userVisibleCopy: "Catalog checks are pending." }],
      approvalGates: ["Launch owner review"], automationChecks: ["catalog_quality_check"],
      humanReviewGates: ["Launch approval"], escalationRules: ["Escalate after one business day"],
      userVisibleStatuses: ["Preflight", "Waiting for review", "Ready"], auditEvents: ["workflow_creator_launch_transition"],
      pauseCondition: "Pause on catalog or trust guardrail breach", rollbackCondition: "Return to the prior manual launch checklist",
      supportPath: "/support/creator-launch", externalCommunicationRule: "Creator status only; internal risk details excluded",
      successMetric: "launch_completion", guardrailMetrics: ["creator_confusion"], reviewCadence: "weekly",
      lifecycle: "pilot", approve: true, rollbackTestedAt: new Date().toISOString(), reviewAt: future(10),
    }).expect(201);

    const workflowRun = await request(app).post("/api/admin/orchestration/workflow-runs").set(adminAuth).send({
      definitionId: definition.body.definition.id, affectedUser: creator.user._id, creatorProfile: profile._id,
      userVisibleStatus: "Launch preflight is running.", waitingOn: "Catalog review", nextStep: "Complete missing catalog details.", expectedAt: future(1),
    }).expect(201);

    await request(app).patch(`/api/admin/orchestration/workflow-runs/${workflowRun.body.run.id}`).set(adminAuth).send({ currentState: "active", reason: "Try to bypass dependency" }).expect(400);
    const active = await request(app).patch(`/api/admin/orchestration/workflow-runs/${workflowRun.body.run.id}`).set(adminAuth).send({
      currentState: "active", reason: "Catalog evidence passed and launch owner approved",
      dependencyUpdates: [{ type: "catalog_quality", state: "passed", evidenceRef: "catalog-review-1", observedAt: new Date().toISOString(), expiresAt: future(1) }],
      approvalStatus: "approved", approvalGate: "Launch approval", userVisibleStatus: "Launch workflow is active.", waitingOn: "Creator", nextStep: "Review the launch checklist.",
    }).expect(200);
    expect(active.body.run).toMatchObject({ currentState: "active", approval: { status: "approved" } });
    await request(app).patch(`/api/creator/orchestration/workflows/${workflowRun.body.run.id}/control`).set(creatorAuth).send({ state: "help_requested" }).expect(200);

    await request(app).put("/api/admin/reliability/resilience-objectives/orchestration_state_transition").set(adminAuth).send({
      reason: "Approve the workflow transition objective", ownerName: "Workflow SRE", ownerRole: "Workflow operations",
      measurementSource: "Workflow transition audit events", availabilityTarget: 0.999, latencyTargetMs: 1500,
      errorBudgetMinutes: 43, maximumDowntimeMinutes: 15, maximumDataDelayMinutes: 5, recoveryPriority: 14,
      pauseTrigger: "Pause new transitions when the error budget is exhausted", rollbackTrigger: "Restore the last valid workflow state",
      status: "approved", approve: true, reviewAt: future(30),
    }).expect(200);

    const report = await request(app).get("/api/admin/analytics/automation-orchestration-operating-system?range=30d").set(adminAuth).expect(200);
    expect(report.body.roadmapPackages).toHaveLength(30);
    expect(report.body.summary).toMatchObject({ roadmapPackagesComplete: 30, automationPilots: 1, workflowDefinitions: 1, activeWorkflowRuns: 1, approvedResilienceObjectives: 1 });
    expect(report.body.dataLimits).toMatchObject({ highRiskActionAutonomous: false, workflowStateOwnedByAkuso: false });

    const actions = await AuditLog.find({}).distinct("action");
    expect(actions).toEqual(expect.arrayContaining(["admin.automation_control.transition", "admin.automation_run.create", "admin.workflow_definition.create", "admin.workflow_run.create", "admin.workflow_run.update", "admin.resilience_objective.upsert"]));
  }, 30000);
});
