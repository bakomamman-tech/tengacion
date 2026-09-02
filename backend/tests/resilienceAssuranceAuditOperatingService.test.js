const mongoose = require("mongoose");

const AssuranceControl = require("../models/AssuranceControl");
const AssuranceEvidencePack = require("../models/AssuranceEvidencePack");
const AuditControlTest = require("../models/AuditControlTest");
const AuditDomain = require("../models/AuditDomain");
const AuditFinding = require("../models/AuditFinding");
const ResilienceDrill = require("../models/ResilienceDrill");
const ResilienceGate = require("../models/ResilienceGate");
const {
  AKUSO_RESILIENCE_ASSURANCE_AUDIT_POLICY,
  ASSURANCE_CONTROL_CATALOG,
  ASSURANCE_GATE_CATALOG,
  AUDIT_SAMPLE_CATALOG,
  AUDIT_UNIVERSE_CATALOG,
  CONTINUITY_STATUS_CATALOG,
  CONTINUOUS_MONITOR_CATALOG,
  DEGRADATION_MODE_CATALOG,
  DRILL_CATALOG,
  DUE_DILIGENCE_ROOM_STANDARD,
  FIRST_AUDIT_SCOPE_CATALOG,
  INCIDENT_CLASS_CATALOG,
  RECOVERY_WORKFLOW_CATALOG,
  RESILIENCE_GATE_CATALOG,
  ROADMAP_PACKAGES,
  buildResilienceAssuranceAuditOperatingView,
} = require("../services/resilienceAssuranceAuditOperatingService");

const now = new Date("2026-09-02T12:00:00.000Z");
const adminId = new mongoose.Types.ObjectId();
const domainId = new mongoose.Types.ObjectId();

describe("next forty resilience, assurance, and audit controls", () => {
  test("publishes the exact roadmap continuation and keeps missing outcomes honest", () => {
    const view = buildResilienceAssuranceAuditOperatingView({ now });

    expect(ROADMAP_PACKAGES).toHaveLength(40);
    expect(ROADMAP_PACKAGES[0].key).toBe("RESILIENCE-002");
    expect(ROADMAP_PACKAGES[13].key).toBe("RESILIENCE-015");
    expect(ROADMAP_PACKAGES[14].key).toBe("ASSURANCE-001");
    expect(ROADMAP_PACKAGES[28].key).toBe("ASSURANCE-015");
    expect(ROADMAP_PACKAGES[29].key).toBe("AUDIT-001");
    expect(ROADMAP_PACKAGES[39].key).toBe("AUDIT-011");
    expect(view.summary).toMatchObject({ roadmapPackagesComplete: 40, drillsObserved: 0, assuranceControls: 0, auditControlsTested: 0, operatingDecision: "hold_for_evidence" });
    expect(view.resilience.readinessReport.blockers).toContain("resilience_drill_outcomes_not_observed");
    expect(view.assurance.operatingReport.blockers).toContain("assurance_control_coverage_incomplete");
    expect(view.audit.findingsReport.blockers).toContain("audit_samples_not_observed");
    expect(view.dataLimits).toMatchObject({ plannedDrillsCountAsPassed: false, configuredControlsCountAsTested: false, ownerAssertionsCloseFindings: false, staleEvidenceSupportsReadiness: false, restrictedEvidenceExternallyExposed: false, akusoDecisionAuthority: "none" });
  });

  test("defines the complete degradation, incident, drill, gate, assurance, due-diligence, and audit contracts", () => {
    expect(DEGRADATION_MODE_CATALOG).toHaveLength(10);
    expect(DEGRADATION_MODE_CATALOG.every((entry) => entry.modes.includes("rollback_required"))).toBe(true);
    expect(Object.values(INCIDENT_CLASS_CATALOG).flat()).toHaveLength(24);
    expect(DRILL_CATALOG).toHaveLength(25);
    expect(RESILIENCE_GATE_CATALOG).toHaveLength(8);
    expect(CONTINUITY_STATUS_CATALOG).toHaveLength(10);
    expect(RECOVERY_WORKFLOW_CATALOG).toHaveLength(10);
    expect(ASSURANCE_CONTROL_CATALOG).toHaveLength(18);
    expect(ASSURANCE_GATE_CATALOG).toHaveLength(12);
    expect(CONTINUOUS_MONITOR_CATALOG).toHaveLength(15);
    expect(DUE_DILIGENCE_ROOM_STANDARD.restrictedFields).toContain("akuso_memory");
    expect(AUDIT_UNIVERSE_CATALOG).toHaveLength(16);
    expect(FIRST_AUDIT_SCOPE_CATALOG).toHaveLength(7);
    expect(Object.values(AUDIT_SAMPLE_CATALOG).flat()).toHaveLength(60);
    expect(AKUSO_RESILIENCE_ASSURANCE_AUDIT_POLICY.executionAuthority).toBe("none");
    expect(AKUSO_RESILIENCE_ASSURANCE_AUDIT_POLICY.prohibited).toEqual(expect.arrayContaining(["approve_gate", "close_finding", "publish_external_pack"]));
  });

  test("requires observed, reviewed evidence before a resilience drill can complete", async () => {
    const base = {
      drillKey: "checkout-outage-2026-09", scenarioKey: "checkout_provider_outage", domain: "money_access",
      scenario: "Simulated provider outage", ownerName: "Reliability Lead", ownerRole: "Reliability operations",
      participatingTeams: ["finance", "support"], expectedDegradedMode: "queue_only",
      rollbackPath: "Pause checkout traffic", communicationPath: "Publish reviewed support status",
      successMetric: "Recovery within 30 minutes", followUpOwner: "Reliability Lead", scheduledAt: now,
      status: "completed", startedAt: now, completedAt: new Date(now.getTime() + 60000), createdBy: adminId,
      history: [{ status: "completed", actorId: adminId, reason: "Test" }],
    };
    await expect(new ResilienceDrill(base).validate()).rejects.toThrow(/recorded human review/i);
    const reviewed = new ResilienceDrill({ ...base, reviewedBy: adminId, reviewedAt: now, validationChecks: [{ key: "detection", result: "pass", evidenceRef: "incident-log-1" }] });
    await expect(reviewed.validate()).resolves.toBeUndefined();
  });

  test("requires stored evidence, expiry, and human approval for a resilience gate", async () => {
    const base = {
      gateKey: "checkout_entitlement_resilience", title: "Checkout and entitlement resilience",
      target: "Recovery within the reviewed objective", evidenceRequired: ["completed drill"],
      ownerName: "Reliability Lead", ownerRole: "Reliability operations", reviewerName: "Finance Lead",
      reviewCadence: "monthly", blockerCondition: "Critical drill failure",
      rollbackOrPauseCondition: "Pause paid traffic", launchOrPartnerImplication: "Block expansion",
      status: "approved", nextReviewAt: new Date("2026-10-01"), createdBy: adminId,
      history: [{ status: "approved", actorId: adminId, reason: "Test" }],
    };
    await expect(new ResilienceGate(base).validate()).rejects.toThrow(/human approval and expiry/i);
    const approved = new ResilienceGate({ ...base, evidenceRefs: ["drill-1"], approvedBy: adminId, approvedAt: now, approvalExpiresAt: new Date("2026-10-01") });
    await expect(approved.validate()).resolves.toBeUndefined();
  });

  test("prevents stale controls and restricted packs from supporting assurance readiness", async () => {
    const control = new AssuranceControl({
      controlKey: "payment_verification", workflow: "purchase_to_access", surface: "Checkout",
      ownerName: "Finance Lead", ownerRole: "Finance", reviewerName: "Reliability Lead", reviewerRole: "Reliability",
      objective: "Verify paid transactions", evidenceSource: "Payment webhook events", freshnessExpectation: "daily",
      automationStatus: "automated", evidenceFreshness: "stale", exceptionSeverity: "high",
      readinessImplication: "Block finance close", status: "active", lastReviewAt: now, nextReviewAt: new Date("2026-10-01"),
      reviewedBy: adminId, evidenceRefs: ["close-1"], createdBy: adminId,
      history: [{ status: "active", evidenceFreshness: "stale", exceptionSeverity: "high", actorId: adminId, reason: "Test" }],
    });
    await expect(control.validate()).rejects.toThrow(/non-current evidence/i);

    const pack = new AssuranceEvidencePack({
      packKey: "partner-pack", packType: "partner", title: "Partner assurance",
      workflowSummary: "Partner access review", ownerName: "Partner Lead", ownerRole: "Partnerships", reviewerName: "Privacy Lead",
      controlKeys: ["partner_exports"], sourceSystems: ["PartnerIntegration"], evidenceFreshness: "current",
      readinessState: "ready", sharingLevel: "partner_shareable", externalShareApproved: true,
      containsRestrictedDetails: true, nextReviewAt: new Date("2026-10-01"), approvalExpiresAt: new Date("2026-10-01"),
      reviewedBy: adminId, reviewedAt: now, createdBy: adminId,
    });
    await expect(pack.validate()).rejects.toThrow(/sanitized evidence/i);
    pack.containsRestrictedDetails = false;
    await expect(pack.validate()).resolves.toBeUndefined();
  });

  test("requires evidence-backed audit tests, retests, and bounded risk acceptance", async () => {
    const domain = new AuditDomain({
      domainKey: "payments_entitlements", title: "Payments and entitlements", controlFamilies: ["money movement"],
      relatedObligations: ["Purchase accuracy"], relatedPolicies: ["Payment policy"], relatedWorkflows: ["purchase_to_access"],
      ownerName: "Finance Lead", ownerRole: "Finance", reviewerName: "Audit Lead", reviewerRole: "Audit",
      evidenceSources: ["Purchases", "Entitlements"], impact: { userOrPartner: 5, financial: 5, privacy: 1, security: 2, ai: 0 },
      riskScore: 90, reviewCadence: "monthly", readinessState: "scheduled", evidenceState: "incomplete",
      selectedForFirstAudit: true, scheduledAt: now,
      evidenceRoom: { scopeSummary: "Purchase to entitlement reconciliation", sharingLevel: "restricted_internal_only" },
      nextReviewAt: new Date("2026-10-01"), createdBy: adminId,
      history: [{ readinessState: "scheduled", evidenceState: "incomplete", actorId: adminId, reason: "Test" }],
    });
    await expect(domain.validate()).resolves.toBeUndefined();

    const test = new AuditControlTest({
      testKey: "payment-sample-1", domainKey: "payments_entitlements", auditDomain: domainId,
      controlKey: "payment_verification", objective: "Every paid purchase is provider verified",
      population: "Paid purchases in the close window", populationCount: 20, sampleSize: 5,
      sampleSelectionMethod: "Risk-ranked and random sample", testingMethod: "sample_transaction_review",
      expectedEvidence: ["provider reference", "purchase state"], result: "pass", reviewerName: "Audit Lead",
      evidenceState: "current", createdBy: adminId, history: [{ result: "pass", actorId: adminId, reason: "Test" }],
    });
    await expect(test.validate()).rejects.toThrow(/actual evidence/i);
    test.actualEvidenceRefs = ["sample-index-1"]; test.reviewerId = adminId; test.testedAt = now;
    await expect(test.validate()).resolves.toBeUndefined();

    const finding = new AuditFinding({
      findingKey: "entitlement-gap", domainKey: "payments_entitlements", severity: "high",
      affectedObligation: "Paid access continuity", affectedControl: "entitlement_reconciliation",
      affectedUsersOrPartners: "Sampled paid users", rootCause: "Replay did not create access",
      evidenceRefs: ["sample-index-1"], ownerName: "Commerce Lead", ownerRole: "Commerce",
      dueAt: new Date("2026-09-15"), remediationPlan: "Repair replay and retest the failed sample",
      retestOwnerName: "Audit Lead", retestState: "passed", status: "closed", createdBy: adminId,
      history: [{ status: "closed", retestState: "passed", actorId: adminId, reason: "Test" }],
    });
    await expect(finding.validate()).rejects.toThrow(/independent retest/i);
    finding.closureEvidenceRefs = ["retest-1"]; finding.retestedBy = adminId; finding.retestAt = now;
    await expect(finding.validate()).resolves.toBeUndefined();
  });
});
