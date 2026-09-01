const mongoose = require("mongoose");

const AutomationRegistryEntry = require("../models/AutomationRegistryEntry");
const AutomationRun = require("../models/AutomationRun");
const ResilienceObjective = require("../models/ResilienceObjective");
const WorkflowRun = require("../models/WorkflowRun");
const {
  AUTOMATION_CANDIDATES,
  AUTOMATION_RISK_POLICY,
  CRITICAL_FLOW_CATALOG,
  DEPENDENCY_CATALOG,
  ROADMAP_PACKAGES,
  WORKFLOW_CATALOG,
  buildAutomationOrchestrationOperatingView,
} = require("../services/automationOrchestrationOperatingService");

const now = new Date("2026-09-01T12:00:00.000Z");
const adminId = new mongoose.Types.ObjectId();

describe("next thirty automation, orchestration, and resilience controls", () => {
  test("publishes the exact continuation and keeps empty evidence states conservative", () => {
    const view = buildAutomationOrchestrationOperatingView({ now });

    expect(ROADMAP_PACKAGES).toHaveLength(30);
    expect(ROADMAP_PACKAGES[0].key).toBe("AUTOMATION-002");
    expect(ROADMAP_PACKAGES[13].key).toBe("AUTOMATION-015");
    expect(ROADMAP_PACKAGES[14].key).toBe("ORCHESTRATION-001");
    expect(ROADMAP_PACKAGES[28].key).toBe("ORCHESTRATION-015");
    expect(ROADMAP_PACKAGES[29].key).toBe("RESILIENCE-001");
    expect(view.summary.roadmapPackagesComplete).toBe(30);
    expect(view.automation.summary).toMatchObject({ registered: 0, runCount: 0, active: 0 });
    expect(view.orchestration.summary).toMatchObject({ configured: 0, activeRuns: 0 });
    expect(view.resilience.summary).toMatchObject({ required: 15, configured: 0, approved: 0 });
    expect(view.readiness.automation.blockers).toContain("automation_pilot_outcomes_not_observed");
    expect(view.readiness.orchestration.blockers).toContain("workflow_recipes_incomplete");
    expect(view.readiness.resilience.blockers).toContain("critical_flow_objectives_incomplete");
    expect(view.dataLimits).toMatchObject({ highRiskActionAutonomous: false, workflowStateOwnedByAkuso: false, privateFanRowsExposed: false });
  });

  test("defines reusable risk, candidate, dependency, workflow, and critical-flow contracts", () => {
    expect(AUTOMATION_RISK_POLICY.levels).toEqual([
      "informational", "draft_only", "suggestion", "low_risk_action", "review_gated_action", "prohibited_action",
    ]);
    expect(AUTOMATION_RISK_POLICY.reviewGatedActions).toEqual(expect.arrayContaining(["payout_release", "api_approval", "content_takedown"]));
    expect(AUTOMATION_RISK_POLICY.prohibitedActions).toContain("private_fan_data_disclosure");
    expect(AUTOMATION_CANDIDATES.creator).toHaveLength(7);
    expect(AUTOMATION_CANDIDATES.fan).toHaveLength(6);
    expect(AUTOMATION_CANDIDATES.partnerApi).toHaveLength(6);
    expect(AUTOMATION_CANDIDATES.finance).toHaveLength(6);
    expect(AUTOMATION_CANDIDATES.operations).toHaveLength(5);
    expect(DEPENDENCY_CATALOG).toHaveLength(14);
    expect(WORKFLOW_CATALOG).toHaveLength(21);
    expect(CRITICAL_FLOW_CATALOG).toHaveLength(15);
  });

  test("blocks prohibited automation runs and unreviewed sensitive completion", async () => {
    const base = {
      runKey: "run-one",
      automationRegistry: new mongoose.Types.ObjectId(),
      automationKey: "payout_release",
      workflowDomain: "finance",
      affectedActor: "finance",
      triggerSummary: "A payout is ready for review",
      sourceSignals: [{ key: "payout_status", sourceAuthority: "PayoutRequest", observedAt: now, confidence: 1 }],
      actionSummary: "Release payout",
      userVisibleMessage: "Your payout remains under review.",
      ownerName: "Finance Lead",
      ownerRole: "Finance operations",
      runbookPath: "/runbooks/payout-review",
      createdBy: adminId,
      history: [{ status: "triggered", actorId: adminId, reason: "Test" }],
    };

    await expect(new AutomationRun({ ...base, riskClass: "prohibited_action", status: "triggered" }).validate()).rejects.toThrow(/must be blocked/i);
    await expect(new AutomationRun({ ...base, runKey: "run-two", riskClass: "review_gated_action", status: "completed", humanReviewRequired: true }).validate()).rejects.toThrow(/human approval/i);
    await expect(new AutomationRun({ ...base, runKey: "run-three", riskClass: "review_gated_action", status: "completed", humanReviewRequired: true, review: { decision: "approved", reviewedBy: adminId, reviewedAt: now, reason: "Finance owner approved after ledger review" } }).validate()).resolves.toBeUndefined();
  });

  test("requires pilot approval, rollback evidence, and user controls before low-risk automation", async () => {
    const automation = new AutomationRegistryEntry({
      automationKey: "creator_catalog_reminder",
      title: "Creator catalog reminder",
      ownerName: "Creator Ops",
      ownerRole: "Creator operations",
      surface: "creator_dashboard",
      actorAffected: "creator",
      trigger: "Missing catalog metadata",
      inputSignals: ["catalog_quality"],
      actionType: "notification",
      riskLevel: "low",
      riskClass: "low_risk_action",
      workflowDomain: "creator",
      approvalRequirement: "Creator operations approval",
      approvedBy: [adminId],
      auditEvent: "automation_creator_catalog_reminder",
      userVisibleStatus: "automated",
      pauseControl: "Pause by creator or automation type",
      rollbackPlan: "Remove reminder and restore manual checklist",
      runbookPath: "/runbooks/catalog-reminder",
      successMetric: "catalog_completion",
      guardrailMetrics: ["creator_confusion"],
      reviewCadence: "weekly",
      state: "pilot",
      reviewAt: new Date("2026-09-10T00:00:00.000Z"),
      createdBy: adminId,
      history: [{ state: "pilot", actorId: adminId, reason: "Controlled pilot" }],
    });
    await expect(automation.validate()).rejects.toThrow(/pilotApprovedBy|recorded human approval/i);
    automation.pilotApprovedBy = adminId;
    automation.pilotApprovedAt = now;
    automation.rollbackTestedAt = now;
    automation.userControls = ["dismiss", "snooze", "request_help"];
    await expect(automation.validate()).resolves.toBeUndefined();
  });

  test("stops workflow progression on pending dependencies and guardrail breaches", async () => {
    const base = {
      runKey: "workflow-run",
      workflowDefinition: new mongoose.Types.ObjectId(),
      workflowKey: "creator_launch_readiness",
      workflowDomain: "creator_campaign",
      affectedUserType: "creator",
      ownerName: "Launch Lead",
      ownerRole: "Creator operations",
      dependencies: [{ type: "catalog_quality", ownerName: "Catalog Lead", state: "pending", userVisibleCopy: "Catalog checks are pending." }],
      humanReviewRequired: false,
      approval: { status: "not_required" },
      userVisibleStatus: "Launch checks are pending.",
      waitingOn: "Catalog review",
      nextStep: "Complete missing catalog details.",
      supportPath: "/support/creator-launch",
      createdBy: adminId,
      history: [{ state: "active", actorId: adminId, reason: "Test" }],
    };
    await expect(new WorkflowRun({ ...base, currentState: "active" }).validate()).rejects.toThrow(/block workflow progression/i);
    await expect(new WorkflowRun({ ...base, runKey: "workflow-run-two", currentState: "active", dependencies: [{ ...base.dependencies[0], state: "passed" }], metrics: { guardrailBreach: true } }).validate()).rejects.toThrow(/pause or roll back/i);
    await expect(new WorkflowRun({ ...base, runKey: "workflow-run-three", currentState: "active", dependencies: [{ ...base.dependencies[0], state: "passed" }] }).validate()).resolves.toBeUndefined();
  });

  test("requires reviewed recovery objectives for critical special-case delays", async () => {
    const objective = new ResilienceObjective({
      flowKey: "entitlement_grant_delay",
      ownerName: "Commerce Lead",
      ownerRole: "Commerce operations",
      measurementSource: "Entitlement audit events",
      availabilityTarget: 0.999,
      errorBudgetMinutes: 43,
      maximumDowntimeMinutes: 15,
      maximumDataDelayMinutes: 5,
      recoveryPriority: 2,
      pauseTrigger: "Pause new grants when error budget is exhausted",
      rollbackTrigger: "Roll back the latest entitlement change",
      status: "approved",
      reviewAt: new Date("2026-09-10T00:00:00.000Z"),
      createdBy: adminId,
      history: [{ status: "approved", actorId: adminId, reason: "SLO review" }],
    });
    await expect(objective.validate()).rejects.toThrow(/human review|delay objective/i);
    objective.reviewedBy = adminId;
    objective.reviewedAt = now;
    objective.maximumEntitlementDelayMinutes = 10;
    await expect(objective.validate()).resolves.toBeUndefined();
  });
});
