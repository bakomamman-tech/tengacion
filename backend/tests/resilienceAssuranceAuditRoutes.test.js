const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-resilience-assurance-audit-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "resilience_assurance_audit_test_secret_123456789";

const app = require("../app");
const AuditLog = require("../models/AuditLog");
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
    name: `Assurance ${suffix}`, username: `assurance_${suffix}`, email: `assurance_${suffix}@test.com`,
    password: "Password123!", role, isVerified: true, emailVerified: true,
  });
  return { user, token: await issueSessionToken(user._id) };
};

describe("resilience, assurance, and audit protected routes", () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
    await mongoose.connect(mongod.getUri(), { serverSelectionTimeoutMS: 60000, socketTimeoutMS: 60000 });
  });
  beforeEach(async () => { await mongoose.connection.db.dropDatabase(); });
  afterAll(async () => {
    try { if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase(); }
    finally { await mongoose.disconnect().catch(() => null); if (mongod) await mongod.stop(); }
  });

  test("protects the operating report by authenticated admin role", async () => {
    await request(app).get("/api/admin/analytics/resilience-assurance-audit-operating-system").expect(401);
    const viewer = await createUser({ suffix: "viewer" });
    await request(app).get("/api/admin/analytics/resilience-assurance-audit-operating-system").set("Authorization", `Bearer ${viewer.token}`).expect(403);
  });

  test("persists audited evidence without treating plans as observed outcomes", async () => {
    const admin = await createUser({ suffix: "admin", role: "admin" });
    const auth = { Authorization: `Bearer ${admin.token}` };
    const startedAt = new Date().toISOString();

    const incident = await request(app).post("/api/admin/resilience/incidents").set(auth).send({
      reason: "Open a shared incident record", incidentKey: "checkout-watch-1", incidentClass: "checkout_failure",
      severity: "degraded", affectedSurface: "Checkout", userImpact: "Some payment confirmations are delayed.",
      workflowState: "waiting_on_provider", degradedMode: "queue_only", ownerName: "Reliability Lead",
      ownerRole: "Reliability operations", responderTeams: ["finance", "support"],
      currentMitigation: "Queue verification and stop duplicate retries", nextUpdateAt: future(1),
      rollbackOption: "Pause checkout initialization", supportCopy: "Payment confirmation is delayed; keep the payment reference.",
      postIncidentReviewOwner: "Reliability Lead", runbookPath: "/runbooks/checkout-provider", detectedAt: startedAt, startedAt,
    }).expect(201);
    expect(incident.body.incident).toMatchObject({ incidentClass: "checkout_failure", degradedMode: "queue_only", status: "open" });

    const drill = await request(app).post("/api/admin/resilience/drills").set(auth).send({
      reason: "Schedule the first controlled drill", drillKey: "checkout-drill-1", scenarioKey: "checkout_provider_outage",
      domain: "money_access", scenario: "Simulate a provider outage without moving money", ownerName: "Reliability Lead",
      ownerRole: "Reliability operations", participatingTeams: ["finance", "support"], expectedDegradedMode: "queue_only",
      rollbackPath: "Restore the provider route after validation", communicationPath: "Use reviewed support copy",
      successMetric: "Recover within the objective", followUpOwner: "Reliability Lead", scheduledAt: future(3), status: "scheduled",
    }).expect(201);
    expect(drill.body.drill).toMatchObject({ status: "scheduled", observed: false });

    await request(app).put("/api/admin/resilience/gates/checkout_entitlement_resilience").set(auth).send({
      reason: "Configure the gate without claiming approval", title: "Checkout and entitlement resilience",
      target: "Meet the reviewed SLO", evidenceRequired: ["completed drill", "current incident review"],
      ownerName: "Reliability Lead", ownerRole: "Reliability operations", reviewerName: "Finance Lead",
      reviewCadence: "monthly", blockerCondition: "Critical drill failure or open incident",
      rollbackOrPauseCondition: "Pause paid traffic", launchOrPartnerImplication: "Hold launch expansion",
      status: "draft", nextReviewAt: future(30),
    }).expect(200);

    const control = await request(app).post("/api/admin/assurance/controls").set(auth).send({
      reason: "Register the payment verification control", controlKey: "payment_verification",
      workflow: "purchase_to_access", surface: "Checkout", ownerName: "Finance Lead", ownerRole: "Finance",
      reviewerName: "Reliability Lead", reviewerRole: "Reliability", objective: "Verify every paid transaction",
      evidenceSource: "Payment webhook events", freshnessExpectation: "daily", automationStatus: "automated",
      readinessImplication: "Block finance close when evidence is stale", nextReviewAt: future(7),
    }).expect(201);
    expect(control.body.control).toMatchObject({ status: "draft", evidenceFreshness: "delayed" });

    await request(app).post("/api/admin/assurance/evidence-packs").set(auth).send({
      reason: "Create an internal close evidence pack", packKey: "finance-close-draft", packType: "finance_close",
      title: "Finance close draft", workflowSummary: "Purchase, entitlement, refund, payout, and wallet close evidence",
      ownerName: "Finance Lead", ownerRole: "Finance", reviewerName: "Product Lead", controlKeys: ["payment_verification"],
      sourceSystems: ["Purchases", "Entitlements"], evidenceFreshness: "delayed", readinessState: "needs_review",
      sharingLevel: "internal_only", nextReviewAt: future(7),
    }).expect(201);

    const domain = await request(app).post("/api/admin/audit/domains").set(auth).send({
      reason: "Scope the first money movement audit", domainKey: "payments_entitlements", title: "Payments and entitlements",
      controlFamilies: ["money movement"], relatedObligations: ["Paid access accuracy"], relatedPolicies: ["Payment policy"],
      relatedWorkflows: ["purchase_to_access"], ownerName: "Finance Lead", ownerRole: "Finance",
      reviewerName: "Audit Lead", reviewerRole: "Audit", evidenceSources: ["Purchases", "Entitlements"],
      impact: { userOrPartner: 5, financial: 5, privacy: 1, security: 2, ai: 0 }, riskScore: 90,
      reviewCadence: "monthly", readinessState: "scheduled", evidenceState: "incomplete", selectedForFirstAudit: true,
      scheduledAt: future(2), evidenceRoom: { scopeSummary: "Purchase to entitlement samples", sharingLevel: "restricted_internal_only" },
      nextReviewAt: future(30),
    }).expect(201);

    const testRow = await request(app).post("/api/admin/audit/control-tests").set(auth).send({
      reason: "Queue the sample without claiming it ran", testKey: "payment-sample-1", domainKey: "payments_entitlements",
      auditDomain: domain.body.domain.id, controlKey: "payment_verification", objective: "Every paid purchase is provider verified",
      population: "Paid purchases in the audit window", populationCount: 20, sampleSize: 5,
      sampleSelectionMethod: "Risk-ranked and random sample", testingMethod: "sample_transaction_review",
      expectedEvidence: ["provider reference", "purchase state"], result: "not_run", reviewerName: "Audit Lead",
      evidenceState: "incomplete",
    }).expect(201);
    expect(testRow.body.test).toMatchObject({ result: "not_run", sampleSize: 5 });

    await request(app).post("/api/admin/audit/findings").set(auth).send({
      reason: "Record a scoped evidence gap", findingKey: "payment-evidence-gap", domainKey: "payments_entitlements",
      severity: "medium", affectedObligation: "Paid access accuracy", affectedControl: "payment_verification",
      affectedUsersOrPartners: "Audit population not yet sampled", rootCause: "Evidence index is incomplete",
      evidenceRefs: ["audit-room-index"], ownerName: "Finance Lead", ownerRole: "Finance", dueAt: future(14),
      remediationPlan: "Complete the evidence index before sampling", retestOwnerName: "Audit Lead",
    }).expect(201);

    const report = await request(app).get("/api/admin/analytics/resilience-assurance-audit-operating-system").set(auth).expect(200);
    expect(report.body.roadmapPackages).toHaveLength(40);
    expect(report.body.summary).toMatchObject({ roadmapPackagesComplete: 40, openIncidents: 1, drillsObserved: 0, assuranceControls: 1, auditControlsTested: 0, openAuditFindings: 1, operatingDecision: "hold_for_evidence" });
    expect(report.body.dataLimits).toMatchObject({ plannedDrillsCountAsPassed: false, configuredControlsCountAsTested: false, ownerAssertionsCloseFindings: false });

    const actions = await AuditLog.find({}).distinct("action");
    expect(actions).toEqual(expect.arrayContaining(["admin.resilience_incident.create", "admin.resilience_drill.create", "admin.resilience_gate.upsert", "admin.assurance_control.create", "admin.assurance_evidence_pack.create", "admin.audit_domain.create", "admin.audit_control_test.create", "admin.audit_finding.create"]));
  }, 30000);
});
