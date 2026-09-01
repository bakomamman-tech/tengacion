const mongoose = require("mongoose");

const AutomationRegistryEntry = require("../models/AutomationRegistryEntry");
const IntelligenceProduct = require("../models/IntelligenceProduct");
const MetricContract = require("../models/MetricContract");
const NetworkProgramEnrollment = require("../models/NetworkProgramEnrollment");
const PartnerAccessGraduation = require("../models/PartnerAccessGraduation");
const PredictiveWarning = require("../models/PredictiveWarning");
const {
  INTELLIGENCE_PRODUCT_CATALOG,
  METRIC_CONTRACT_CATALOG,
  buildAutomationRegistry,
  buildMetricContracts,
  buildNetworkIntelligenceOperatingView,
  buildPartnerGraduation,
} = require("../services/networkIntelligenceOperatingService");

const now = new Date("2026-09-01T12:00:00.000Z");
const userId = new mongoose.Types.ObjectId();
const creatorId = new mongoose.Types.ObjectId();

describe("next thirty network, intelligence, and automation controls", () => {
  test("publishes the exact thirty-package sequence with conservative empty-state readiness", () => {
    const view = buildNetworkIntelligenceOperatingView({ now });

    expect(view.roadmapPackages).toHaveLength(30);
    expect(view.roadmapPackages[0].key).toBe("NETWORK-002");
    expect(view.roadmapPackages[13].key).toBe("NETWORK-015");
    expect(view.roadmapPackages[14].key).toBe("INTELLIGENCE-001");
    expect(view.roadmapPackages[28].key).toBe("INTELLIGENCE-015");
    expect(view.roadmapPackages[29].key).toBe("AUTOMATION-001");
    expect(view.summary.roadmapPackagesComplete).toBe(30);
    expect(view.readiness.network.decision).toBe("hold_or_repeat_with_measurement");
    expect(view.readiness.intelligence.decision).toBe("hold_for_trusted_evidence");
    expect(view.dataLimits).toMatchObject({
      privateFanRowsExposed: false,
      disputedMetricsCanDriveDecisions: false,
      partnerInterestGrantsAccess: false,
      predictiveWarningsAreTruth: false,
      automationExecutionEnabled: false,
    });
  });

  test("derives stale trust at read time and prevents it from driving intelligence", () => {
    const metrics = buildMetricContracts([{
      _id: new mongoose.Types.ObjectId(),
      metricKey: "gmv",
      title: "Gross merchandise value",
      ownerName: "Finance Lead",
      ownerRole: "Finance",
      sourceAuthorities: ["revenue_ledger"],
      calculation: "Sum stored settled gross amounts.",
      freshnessMinutes: 60,
      limitations: "Settled records only.",
      privacyClass: "finance_restricted",
      decisionsAllowed: ["internal_reporting"],
      exportPolicy: "internal_only",
      trustState: "trusted",
      trustReason: "Reconciled at review time",
      observedAt: "2026-09-01T08:00:00.000Z",
      reviewedAt: "2026-09-01T08:05:00.000Z",
      reviewAt: "2026-09-02T00:00:00.000Z",
    }], now);

    expect(METRIC_CONTRACT_CATALOG).toHaveLength(15);
    expect(metrics.contracts).toHaveLength(15);
    expect(metrics.contracts.find((row) => row.metricKey === "gmv")).toMatchObject({
      trustState: "stale",
      storedTrustState: "trusted",
      canDriveDecision: false,
    });
    expect(metrics.summary).toMatchObject({ configured: 1, stale: 1, blocked: 14 });
  });

  test("requires all reviewed gates before partner or API graduation", () => {
    const result = buildPartnerGraduation([{
      _id: new mongoose.Types.ObjectId(),
      integration: new mongoose.Types.ObjectId(),
      currentLevel: "scheduled_export",
      proposedLevel: "approved_api_integration",
      status: "review_required",
      ownerName: "Partner Lead",
      ownerRole: "Partnerships",
      gates: [{ key: "privacy", status: "ready", evidence: "Privacy review 17", reviewedAt: now }],
      prohibitedData: ["private_user_behavior"],
      reviewAt: "2026-09-10T00:00:00.000Z",
      expiresAt: "2026-10-01T00:00:00.000Z",
    }], now);

    expect(result.assessments[0].summary).toMatchObject({ ready: 1, total: 12 });
    expect(result.assessments[0].summary.blockers).toContain("stable_data_contract");
    expect(result.summary.approvedApi).toBe(0);
    expect(result.enthusiasmBoundary).toMatch(/never substitutes/i);
  });

  test("keeps AUTOMATION-001 a non-executing registry", () => {
    const registry = buildAutomationRegistry([{
      _id: new mongoose.Types.ObjectId(),
      automationKey: "support_triage_suggestion",
      title: "Support triage suggestion",
      ownerName: "Support Lead",
      ownerRole: "Support",
      surface: "admin_support",
      actorAffected: "support_agent",
      trigger: "Backlog threshold warning",
      inputSignals: ["support_backlog"],
      actionType: "suggestion",
      riskLevel: "medium",
      approvalRequirement: "Support and trust review",
      auditEvent: "automation_support_triage_suggestion",
      userVisibleStatus: "suggested",
      pauseControl: "Disable suggestion",
      rollbackPlan: "Remove output and retain manual queue",
      successMetric: "time_to_first_response",
      guardrailMetrics: ["incorrect_priority_rate"],
      reviewCadence: "weekly",
      state: "designed",
      reviewAt: "2026-09-10T00:00:00.000Z",
    }]);

    expect(registry.summary).toMatchObject({ registered: 1, designed: 1, executionEnabled: 0 });
    expect(registry.entries[0].executionAuthority).toBe("none_in_automation_001");
    expect(registry.launchBoundary).toMatch(/rejects pilot or active/i);
  });

  test("enforces consent, trust, approval, warning review, and automation rollback at model level", async () => {
    const networkProgram = new NetworkProgramEnrollment({
      programKey: "launch_network_one", programType: "launch_collaboration", creatorProfile: creatorId, creatorUser: userId,
      status: "active", ownerName: "Lead", ownerRole: "Ecosystem", creatorBenefit: "Benefit", creatorCommitment: "Commit",
      successMetric: "incremental_actions", stopCondition: "Pause", reviewAt: now, createdBy: userId,
    });
    await expect(networkProgram.validate()).rejects.toThrow(/recorded creator consent/i);

    const trustedWithoutObservation = new MetricContract({
      metricKey: "gmv", title: "GMV", ownerName: "Lead", ownerRole: "Finance", sourceAuthorities: ["ledger"],
      calculation: "Sum", freshnessMinutes: 60, limitations: "Settled only", privacyClass: "finance_restricted",
      exportPolicy: "internal_only", trustState: "trusted", trustReason: "Reviewed", reviewedAt: now, reviewAt: now, createdBy: userId,
    });
    await expect(trustedWithoutObservation.validate()).rejects.toThrow(/observed-at timestamp/i);

    const activeProduct = new IntelligenceProduct({
      productKey: INTELLIGENCE_PRODUCT_CATALOG[0].key, title: "Creator opportunity", audience: "creator", ownerName: "Lead", ownerRole: "Data",
      cadence: "weekly", sourceMetricKeys: ["gmv"], confidencePolicy: "Withhold on stale", privacyPolicy: "Creator-self only",
      permittedActions: ["explain"], reviewerRole: "Data governance", withdrawalPath: "Pause", status: "active", qualityState: "trusted",
      reviewAt: now, createdBy: userId,
    });
    await expect(activeProduct.validate()).rejects.toThrow(/recorded human approval/i);

    const resolvedWarning = new PredictiveWarning({
      warningKey: "support_backlog_one", warningType: "support_backlog", ownerName: "Lead", ownerRole: "Support",
      confidence: 0.7, impact: "Slow response", runbookPath: "support/backlog", reviewPath: "support/review", rollbackPath: "support/rollback",
      status: "closed", observedAt: now, reviewAt: now, createdBy: userId,
    });
    await expect(resolvedWarning.validate()).rejects.toThrow(/review note/i);

    const unsafeAutomation = new AutomationRegistryEntry({
      automationKey: "unsafe", title: "Unsafe", ownerName: "Lead", ownerRole: "Ops", surface: "admin", actorAffected: "user",
      trigger: "Signal", actionType: "bounded_execution", riskLevel: "high", approvalRequirement: "Review", auditEvent: "unsafe_action",
      userVisibleStatus: "automated", pauseControl: "Pause", rollbackPlan: "Rollback", successMetric: "success", state: "active", reviewAt: now, createdBy: userId,
    });
    await expect(unsafeAutomation.validate()).rejects.toThrow(/human approval/i);

    const graduation = new PartnerAccessGraduation({
      integration: new mongoose.Types.ObjectId(), currentLevel: "api_candidate", proposedLevel: "approved_api_integration", status: "active",
      ownerName: "Lead", ownerRole: "Partner", gates: [], prohibitedData: ["payment_identifiers", "private_user_behavior", "identity_verification", "moderation_sensitive_detail"],
      approvalReason: "Ready", approvedBy: userId, approvedAt: now, reviewAt: now, expiresAt: "2026-10-01T00:00:00.000Z", createdBy: userId,
    });
    await expect(graduation.validate()).rejects.toThrow(/missing reviewed gates/i);
  });
});
