const mongoose = require("mongoose");

const AssuranceControl = require("../models/AssuranceControl");
const AssuranceEvidencePack = require("../models/AssuranceEvidencePack");
const AuditControlTest = require("../models/AuditControlTest");
const AuditDomain = require("../models/AuditDomain");
const AuditFinding = require("../models/AuditFinding");
const ResilienceDrill = require("../models/ResilienceDrill");
const ResilienceGate = require("../models/ResilienceGate");
const ResilienceIncident = require("../models/ResilienceIncident");
const ResilienceObjective = require("../models/ResilienceObjective");

const ROADMAP_PACKAGES = Object.freeze([
  ["RESILIENCE-002", "Map graceful degradation modes"],
  ["RESILIENCE-003", "Create incident command and communication standards"],
  ["RESILIENCE-004", "Define cross-functional incident classes"],
  ["RESILIENCE-005", "Choose first resilience drills"],
  ["RESILIENCE-006", "Launch resilience dashboard"],
  ["RESILIENCE-007", "Run money movement and access drills"],
  ["RESILIENCE-008", "Run partner, API, and data resilience drills"],
  ["RESILIENCE-009", "Run trust, safety, and market resilience drills"],
  ["RESILIENCE-010", "Run Akuso resilience drills"],
  ["RESILIENCE-011", "Convert drills into resilience gates"],
  ["RESILIENCE-012", "Harden continuity and user-facing status"],
  ["RESILIENCE-013", "Standardize recovery and correction workflows"],
  ["RESILIENCE-014", "Review resilience economics and capacity"],
  ["RESILIENCE-015", "Publish resilience readiness report"],
  ["ASSURANCE-001", "Create the assurance control registry"],
  ["ASSURANCE-002", "Define evidence pack standards"],
  ["ASSURANCE-003", "Map finance and revenue assurance controls"],
  ["ASSURANCE-004", "Map partner, API, data, trust, and rights controls"],
  ["ASSURANCE-005", "Define Akuso assurance controls"],
  ["ASSURANCE-006", "Launch the assurance dashboard"],
  ["ASSURANCE-007", "Run the first finance and revenue assurance close"],
  ["ASSURANCE-008", "Produce partner, API, and market assurance packs"],
  ["ASSURANCE-009", "Operationalize data, experiment, and recommendation assurance"],
  ["ASSURANCE-010", "Run trust, safety, rights, privacy, and Akuso reviews"],
  ["ASSURANCE-011", "Convert assurance reviews into readiness gates"],
  ["ASSURANCE-012", "Build a due diligence and external assurance room"],
  ["ASSURANCE-013", "Add continuous control monitoring"],
  ["ASSURANCE-014", "Publish the assurance operating report"],
  ["ASSURANCE-015", "Choose the next maturity focus"],
  ["AUDIT-001", "Create the audit universe"],
  ["AUDIT-002", "Define evidence room standards"],
  ["AUDIT-003", "Standardize control testing"],
  ["AUDIT-004", "Define findings, remediation, and retest workflow"],
  ["AUDIT-005", "Select first internal audit domains"],
  ["AUDIT-006", "Run finance and money movement audit"],
  ["AUDIT-007", "Run privacy, security, data, and vendor audit"],
  ["AUDIT-008", "Run content, rights, moderation, and market audit"],
  ["AUDIT-009", "Run partner, sponsor, API, export, and reporting audit"],
  ["AUDIT-010", "Run Akuso and AI governance audit"],
  ["AUDIT-011", "Publish first audit findings report"],
].map(([key, title]) => ({ key, title, status: "COMPLETE" })));

const DEGRADATION_MODE_CATALOG = Object.freeze([
  ["checkout_payment", "queue_only", "Payment confirmation is delayed. Keep your reference; no second payment is needed yet."],
  ["entitlement_grants", "queue_only", "Access is delayed while your confirmed purchase is reconciled."],
  ["payout_requests", "manual_review_only", "Payout review is taking longer than expected. Your request remains queued for finance review."],
  ["creator_launches", "paused", "This launch is paused while required checks recover. The creator dashboard shows the next safe step."],
  ["campaign_launches", "paused", "This campaign is paused. No additional audience actions will be sent until review completes."],
  ["partner_exports", "queue_only", "The report is delayed and will not be shared until its data is current and reviewed."],
  ["api_access", "read_only", "API writes are temporarily unavailable. Existing approved read access may be limited."],
  ["notifications", "paused", "Non-essential notifications are paused while delivery and consent checks are reviewed."],
  ["recommendations", "degraded", "Discovery is using a conservative fallback while recommendation quality is reviewed."],
  ["akuso_responses", "manual_review_only", "Akuso is in incident mode and may provide limited, source-grounded guidance only."],
].map(([workflow, fallbackMode, userStatusCopy]) => ({
  workflow,
  modes: ResilienceIncident.DEGRADATION_MODES,
  fallbackMode,
  userStatusCopy,
  privacyRule: "Expose user impact, safe action, next update, and support path; keep internal risk and private evidence restricted.",
})));

const INCIDENT_CLASS_CATALOG = Object.freeze({
  finance: ["checkout_failure", "webhook_delay", "entitlement_mismatch", "payout_queue_blocker", "reconciliation_gap", "refund_dispute_spike"],
  partnerApi: ["export_failure", "dashboard_outage", "api_abuse", "rate_limit_surge", "partner_access_leak_risk", "revocation_failure"],
  dataTrust: ["stale_metric", "disputed_metric", "support_backlog_surge", "moderation_queue_surge", "rights_takedown_surge", "recommendation_complaint_spike", "notification_complaint_spike"],
  akuso: ["eval_regression", "unsafe_answer", "hallucinated_feature_claim", "fallback_spike", "model_cost_surge"],
});

const DRILL_CATALOG = Object.freeze([
  ["checkout_provider_outage", "money_access"], ["webhook_delay", "money_access"],
  ["entitlement_mismatch", "money_access"], ["payout_reconciliation_gap", "money_access"],
  ["refund_dispute_spike", "money_access"], ["partner_export_failure", "partner_api_data"],
  ["scoped_dashboard_outage", "partner_api_data"], ["api_rate_limit_surge", "partner_api_data"],
  ["api_abuse_signal", "partner_api_data"], ["partner_access_revocation", "partner_api_data"],
  ["stale_executive_metric", "partner_api_data"], ["disputed_partner_metric", "partner_api_data"],
  ["support_backlog_surge", "trust_safety_market"], ["moderation_queue_surge", "trust_safety_market"],
  ["rights_takedown_surge", "trust_safety_market"], ["recommendation_complaint_spike", "trust_safety_market"],
  ["notification_complaint_spike", "trust_safety_market"], ["referral_abuse_spike", "trust_safety_market"],
  ["market_readiness_regression", "trust_safety_market"], ["akuso_eval_regression", "akuso"],
  ["akuso_unsafe_answer", "akuso"], ["akuso_hallucinated_feature", "akuso"],
  ["akuso_fallback_spike", "akuso"], ["akuso_latency_cost_surge", "akuso"],
  ["akuso_missing_incident_source", "akuso"],
].map(([scenarioKey, domain]) => ({ scenarioKey, domain })));

const RESILIENCE_GATE_CATALOG = Object.freeze([
  "checkout_entitlement_resilience", "payout_settlement_resilience", "partner_export_api_resilience",
  "data_product_reliability", "support_moderation_capacity", "rights_response_capacity",
  "recommendation_notification_rollback", "akuso_eval_incident_mode_resilience",
].map((gateKey) => ({
  gateKey,
  requiredFields: ["target", "evidence", "owner", "review_cadence", "blocker", "rollback_or_pause", "launch_or_partner_implication"],
  approvalRule: "Current observed evidence, named reviewer, expiry, and no unresolved blocker are required.",
})));

const CONTINUITY_STATUS_CATALOG = Object.freeze([
  "payment_pending", "entitlement_delayed", "payout_under_review", "export_delayed", "partner_access_paused",
  "api_degraded", "campaign_paused", "recommendation_fallback", "notification_paused", "akuso_incident_mode",
].map((key) => ({ key, fields: ["current_state", "next_update", "user_action", "support_path", "safe_fallback", "internal_owner"] })));

const RECOVERY_WORKFLOW_CATALOG = Object.freeze([
  "payment_verification_replay", "webhook_replay", "entitlement_reconciliation", "payout_retry_eligibility",
  "refund_dispute_correction", "partner_report_correction", "api_incident_correction", "metric_correction",
  "recommendation_rollback", "akuso_eval_prompt_correction",
].map((key) => ({ key, required: ["owner", "source_of_truth", "audit_event", "communication", "completion_evidence", "post_incident_review"] })));

const ASSURANCE_CONTROL_CATALOG = Object.freeze([
  ["checkout_initiation", "finance"], ["payment_verification", "finance"], ["webhook_processing", "finance"],
  ["entitlement_grants", "finance"], ["payout_requests", "finance"], ["wallet_balances", "finance"],
  ["refunds_disputes", "finance"], ["partner_exports", "partner_api"], ["api_access", "partner_api"],
  ["data_products", "data_product"], ["experiments", "data_product"], ["recommendations", "data_product"],
  ["automations", "data_product"], ["privacy_requests", "trust_rights"], ["moderation", "trust_rights"],
  ["rights_takedowns", "trust_rights"], ["notifications", "trust_rights"], ["akuso", "akuso"],
].map(([controlKey, workstream]) => ({ controlKey, workstream })));

const EVIDENCE_PACK_STANDARD = Object.freeze({
  sections: ["workflow_summary", "owner_reviewer", "readiness", "source_systems", "metrics", "exceptions", "reconciliation", "incidents", "impact", "approval_history", "open_risks", "next_review"],
  freshnessLevels: AssuranceControl.FRESHNESS_LEVELS,
  audienceViews: ["internal_operations", "finance", "creator_support", "partner_success", "executive_review", "audit_due_diligence"],
  externalRule: "Only current, reviewed, sanitized packs with explicit sharing approval may leave internal operations.",
});

const ASSURANCE_GATE_CATALOG = Object.freeze([
  "finance_close_readiness", "creator_balance_confidence", "payout_settlement_readiness", "partner_access_readiness",
  "api_access_readiness", "market_launch_readiness", "data_product_readiness", "experiment_readiness",
  "recommendation_readiness", "privacy_consent_readiness", "moderation_rights_readiness", "akuso_readiness",
].map((gateKey) => ({ gateKey, fields: ["evidence", "owner", "reviewer", "exception_threshold", "blocker", "approval_duration", "rereview_trigger", "revocation_or_pause"] })));

const CONTINUOUS_MONITOR_CATALOG = Object.freeze([
  "evidence_freshness", "missing_owners", "overdue_reviews", "repeated_exceptions", "finance_close_variance",
  "partner_access_drift", "api_scope_drift", "data_contract_failures", "experiment_guardrail_breaches",
  "recommendation_complaint_spikes", "privacy_sla_misses", "moderation_rights_sla_misses",
  "akuso_eval_regressions", "akuso_unsupported_claims", "akuso_cost_budget_breaches",
]);

const DUE_DILIGENCE_ROOM_STANDARD = Object.freeze({
  sections: ["company_product_scope", "creator_commerce", "payment_entitlement", "payout_settlement", "refund_dispute", "data_governance", "partner_access", "api_controls", "privacy_consent", "moderation_rights", "incident_resilience", "akuso_governance", "unresolved_risks_mitigations"],
  sharingLevels: AssuranceEvidencePack.SHARING_LEVELS,
  restrictedFields: ["user_rows", "payment_credentials", "private_content", "security_secrets", "safety_case_details", "akuso_memory"],
});

const AUDIT_UNIVERSE_CATALOG = Object.freeze(AuditDomain.AUDIT_DOMAINS.map((domainKey) => ({
  domainKey,
  requiredFields: ["control_family", "obligation", "policy", "workflow", "owner", "reviewer", "evidence", "impacts", "risk_score", "cadence", "readiness"],
})));

const FIRST_AUDIT_SCOPE_CATALOG = Object.freeze([
  ["purchase_entitlement_reconciliation", "payments_entitlements"],
  ["payout_eligibility_balance_confidence", "payouts_creator_balances"],
  ["privacy_request_deletion", "privacy_data_protection"],
  ["access_review_audit_logs", "security_access_audit_logs"],
  ["partner_export_approval_revocation", "apis_exports"],
  ["rights_takedown_appeal", "content_rights_takedowns"],
  ["akuso_grounding_refusal", "akuso_ai_governance"],
].map(([scopeKey, domainKey]) => ({ scopeKey, domainKey })));

const AUDIT_SAMPLE_CATALOG = Object.freeze({
  finance: ["checkout_initialization", "payment_verification", "webhook_processing", "entitlement_timing", "duplicate_prevention", "wallet_credit_accuracy", "payout_eligibility", "payout_outcome", "refund_handling", "dispute_handling", "commission_fee_calculation", "creator_balance_display", "settlement_close"],
  privacySecurityVendor: ["data_inventory", "purpose_access_scope", "retention_deletion", "privacy_request_closure", "consent_notifications", "access_grants_removals", "privileged_access", "audit_log_completeness", "vendor_review", "subprocessor_records", "incident_escalation"],
  contentRightsMarket: ["rights_declarations", "upload_terms", "takedown_intake", "takedown_decision", "appeals", "restricted_content", "moderation_aging", "enforcement_consistency", "recommendation_complaints", "campaign_compliance", "market_readiness", "support_escalation"],
  partnerApiReporting: ["partner_purpose", "sponsor_claim", "export_approval", "export_minimization", "dashboard_scope", "api_key_scope", "rate_limit_abuse", "revocation", "offboarding", "report_approval", "metric_confidence", "report_correction_withdrawal"],
  akusoAi: ["capability_register", "model_route", "prompt_policy_history", "source_grounding", "route_eval", "high_risk_refusal", "unsupported_claims", "privacy_memory_redaction", "role_scoped_memory", "incident_mode", "review_queue_conversion", "model_cost_routing"],
});

const AKUSO_RESILIENCE_ASSURANCE_AUDIT_POLICY = Object.freeze({
  may: ["explain_verified_incident_status", "draft_reviewable_support_copy", "summarize_evidence_freshness", "draft_assurance_packet", "summarize_tested_audit_counts", "route_to_owner"],
  prohibited: ["declare_recovery_without_evidence", "approve_gate", "close_finding", "accept_risk", "publish_external_pack", "expose_restricted_evidence", "make_legal_rights_moderation_finance_or_access_decision"],
  requiredContext: ["source", "timeframe", "freshness", "confidence", "limitations", "owner", "review_state"],
  evalSuites: ["incident_source_grounding", "recovery_claim_boundary", "evidence_freshness", "external_pack_privacy", "audit_result_accuracy", "risk_acceptance_refusal", "high_risk_workflow_refusal"],
  executionAuthority: "none",
});

const idOf = (value) => String(value?._id || value?.id || value || "");
const keyOf = (value = "") => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const asDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const sum = (items = []) => items.reduce((total, value) => total + Number(value || 0), 0);
const ratio = (a, b) => Number(b || 0) > 0 ? Number((Number(a || 0) / Number(b)).toFixed(4)) : 0;
const errorWithStatus = (message, status = 400) => Object.assign(new Error(message), { status });
const requireReason = (value) => {
  const reason = String(value || "").trim();
  if (!reason) throw errorWithStatus("A change reason is required", 400);
  return reason;
};
const assertId = (value, label) => {
  if (!mongoose.Types.ObjectId.isValid(String(value || ""))) throw errorWithStatus(`${label} is invalid`, 400);
};
const setDefined = (target, source, fields) => {
  fields.forEach((field) => { if (source[field] !== undefined) target[field] = source[field]; });
};
const effectiveEvidenceState = (row = {}, now = new Date()) => {
  const expiry = asDate(row.approvalExpiresAt || row.nextReviewAt);
  if (expiry && expiry <= now && row.readinessState === "ready") return "stale";
  return row.evidenceFreshness || row.evidenceState || "incomplete";
};

const serializeIncident = (row = {}) => ({
  id: idOf(row), incidentKey: row.incidentKey, incidentClass: row.incidentClass, severity: row.severity,
  affectedSurface: row.affectedSurface, userImpact: row.userImpact, workflowState: row.workflowState,
  degradedMode: row.degradedMode, ownerName: row.ownerName, ownerRole: row.ownerRole,
  responderTeams: row.responderTeams || [], currentMitigation: row.currentMitigation, nextUpdateAt: row.nextUpdateAt,
  rollbackOption: row.rollbackOption, supportCopy: row.supportCopy, postIncidentReviewOwner: row.postIncidentReviewOwner,
  runbookPath: row.runbookPath, status: row.status, detectedAt: row.detectedAt, startedAt: row.startedAt,
  mitigatedAt: row.mitigatedAt, recoveredAt: row.recoveredAt, closedAt: row.closedAt,
  recoveryEvidence: row.recoveryEvidence || "", communicationCount: (row.communications || []).length,
});

const serializeDrill = (row = {}) => ({
  id: idOf(row), drillKey: row.drillKey, scenarioKey: row.scenarioKey, domain: row.domain, scenario: row.scenario,
  ownerName: row.ownerName, ownerRole: row.ownerRole, participatingTeams: row.participatingTeams || [],
  expectedDegradedMode: row.expectedDegradedMode, rollbackPath: row.rollbackPath, communicationPath: row.communicationPath,
  successMetric: row.successMetric, followUpOwner: row.followUpOwner, scheduledAt: row.scheduledAt, status: row.status,
  startedAt: row.startedAt, completedAt: row.completedAt, humanReviewRecorded: Boolean(row.reviewedBy && row.reviewedAt),
  validationChecks: row.validationChecks || [], metrics: row.metrics || {}, findings: row.findings || [],
  runbookUpdates: row.runbookUpdates || [], workflowUpdates: row.workflowUpdates || [], akusoEvalFixtures: row.akusoEvalFixtures || [],
  costProxies: row.costProxies || {}, observed: ["completed", "failed"].includes(row.status),
});

const serializeGate = (row = {}, now = new Date()) => {
  const expired = Boolean(row.approvalExpiresAt && asDate(row.approvalExpiresAt) <= now);
  return {
    id: idOf(row), gateKey: row.gateKey, title: row.title, target: row.target,
    evidenceRequired: row.evidenceRequired || [], evidenceRefs: row.evidenceRefs || [], ownerName: row.ownerName,
    ownerRole: row.ownerRole, reviewerName: row.reviewerName, reviewCadence: row.reviewCadence,
    blockerCondition: row.blockerCondition, rollbackOrPauseCondition: row.rollbackOrPauseCondition,
    launchOrPartnerImplication: row.launchOrPartnerImplication, status: expired ? "expired" : row.status,
    nextReviewAt: row.nextReviewAt, approvalExpiresAt: row.approvalExpiresAt,
    humanApprovalRecorded: Boolean(row.approvedBy && row.approvedAt), decisionReason: row.decisionReason || "",
  };
};

const serializeControl = (row = {}, now = new Date()) => ({
  id: idOf(row), controlKey: row.controlKey, workflow: row.workflow, surface: row.surface,
  ownerName: row.ownerName, ownerRole: row.ownerRole, reviewerName: row.reviewerName, reviewerRole: row.reviewerRole,
  objective: row.objective, evidenceSource: row.evidenceSource, freshnessExpectation: row.freshnessExpectation,
  automationStatus: row.automationStatus, evidenceFreshness: effectiveEvidenceState(row, now),
  exceptionSeverity: row.exceptionSeverity, readinessImplication: row.readinessImplication,
  status: row.status, lastReviewAt: row.lastReviewAt, nextReviewAt: row.nextReviewAt,
  evidenceRefs: row.evidenceRefs || [], humanReviewRecorded: Boolean(row.reviewedBy && row.lastReviewAt),
});

const serializeEvidencePack = (row = {}, now = new Date(), { external = false } = {}) => ({
  id: idOf(row), packKey: row.packKey, packType: row.packType, title: row.title,
  workflowSummary: row.workflowSummary, ownerName: row.ownerName, ownerRole: row.ownerRole,
  reviewerName: row.reviewerName, controlKeys: row.controlKeys || [], sourceSystems: external ? undefined : row.sourceSystems || [],
  metricSnapshots: external ? undefined : row.metricSnapshots || [],
  exceptionSummary: {
    total: (row.exceptions || []).length,
    openHighCritical: (row.exceptions || []).filter((item) => ["high", "critical"].includes(item.severity) && !["resolved", "risk_accepted"].includes(item.status)).length,
  },
  exceptions: external ? undefined : row.exceptions || [], reconciliationStatus: row.reconciliationStatus,
  incidentRefs: external ? undefined : row.incidentRefs || [], impactSummary: row.impactSummary,
  openRisks: external ? undefined : row.openRisks || [], evidenceFreshness: effectiveEvidenceState(row, now),
  readinessState: effectiveEvidenceState(row, now) === "current" ? row.readinessState : (row.readinessState === "ready" ? "needs_review" : row.readinessState),
  sharingLevel: row.sharingLevel, externalShareApproved: Boolean(row.externalShareApproved),
  containsRestrictedDetails: Boolean(row.containsRestrictedDetails), nextReviewAt: row.nextReviewAt,
  approvalExpiresAt: row.approvalExpiresAt, humanReviewRecorded: Boolean(row.reviewedBy && row.reviewedAt),
});

const serializeAuditDomain = (row = {}, now = new Date()) => ({
  id: idOf(row), domainKey: row.domainKey, title: row.title, controlFamilies: row.controlFamilies || [],
  ownerName: row.ownerName, ownerRole: row.ownerRole, reviewerName: row.reviewerName, reviewerRole: row.reviewerRole,
  evidenceSources: row.evidenceSources || [], impact: row.impact || {}, riskScore: Number(row.riskScore || 0),
  reviewCadence: row.reviewCadence, readinessState: row.readinessState,
  evidenceState: effectiveEvidenceState(row, now), selectedForFirstAudit: Boolean(row.selectedForFirstAudit),
  scheduledAt: row.scheduledAt, nextReviewAt: row.nextReviewAt,
  evidenceRoom: row.evidenceRoom || {}, ownerSignoffRecorded: Boolean(row.auditOwnerSignoff),
});

const serializeControlTest = (row = {}, { external = false } = {}) => ({
  id: idOf(row), testKey: row.testKey, domainKey: row.domainKey, controlKey: row.controlKey,
  objective: row.objective, population: external ? undefined : row.population, populationCount: external ? undefined : row.populationCount,
  sampleSize: Number(row.sampleSize || 0), sampleSelectionMethod: external ? undefined : row.sampleSelectionMethod,
  testingMethod: row.testingMethod, expectedEvidence: external ? undefined : row.expectedEvidence || [],
  actualEvidenceRefs: external ? undefined : row.actualEvidenceRefs || [], result: row.result,
  exceptionSummary: external ? undefined : row.exceptionSummary, rootCause: external ? undefined : row.rootCause,
  reviewerName: external ? undefined : row.reviewerName, testedAt: row.testedAt,
  retestRequired: Boolean(row.retestRequired), retestDueAt: row.retestDueAt, evidenceState: row.evidenceState,
});

const serializeFinding = (row = {}, { external = false } = {}) => ({
  id: idOf(row), findingKey: row.findingKey, domainKey: row.domainKey, severity: row.severity,
  affectedObligation: external ? undefined : row.affectedObligation,
  affectedControl: external ? undefined : row.affectedControl,
  affectedUsersOrPartners: external ? undefined : row.affectedUsersOrPartners,
  rootCause: external ? undefined : row.rootCause, evidenceRefs: external ? undefined : row.evidenceRefs || [],
  ownerName: external ? undefined : row.ownerName, ownerRole: external ? undefined : row.ownerRole,
  dueAt: row.dueAt, remediationPlan: external ? undefined : row.remediationPlan,
  compensatingControl: external ? undefined : row.compensatingControl,
  acceptedRisk: external ? { accepted: Boolean(row.acceptedRisk?.accepted), expiresAt: row.acceptedRisk?.expiresAt } : row.acceptedRisk,
  retestOwnerName: external ? undefined : row.retestOwnerName, retestState: row.retestState, retestAt: row.retestAt,
  closureEvidenceRefs: external ? undefined : row.closureEvidenceRefs || [], status: row.status,
});

const buildResilienceView = ({ objectives = [], incidents = [], drills = [], gates = [], now = new Date() } = {}) => {
  const incidentRows = incidents.map(serializeIncident);
  const drillRows = drills.map(serializeDrill);
  const gateRows = gates.map((row) => serializeGate(row, now));
  const objectiveRows = objectives.map((row) => ({ flowKey: row.flowKey, status: row.status, recoveryPriority: row.recoveryPriority, reviewAt: row.reviewAt }));
  const openIncidents = incidentRows.filter((row) => !["recovered", "closed"].includes(row.status));
  const completedDrills = drillRows.filter((row) => row.observed);
  const approvedGates = gateRows.filter((row) => row.status === "approved");
  const knownCostFields = drillRows.flatMap((row) => Object.entries(row.costProxies || {}).filter(([key, value]) => key !== "currency" && value !== null && value !== undefined));
  const economics = {
    knownCostTotal: sum(knownCostFields.map(([, value]) => value)),
    observedCostFields: knownCostFields.length,
    currency: drillRows.find((row) => row.costProxies?.currency)?.costProxies?.currency || "NGN",
    instrumentationGaps: completedDrills.length && !knownCostFields.length ? ["drill_cost_proxies_missing"] : [],
    investmentOptions: ["infrastructure_capacity", "queue_tooling", "provider_redundancy", "support_staffing", "moderation_capacity", "data_quality_automation", "partner_access_controls", "akuso_routing_evals"],
  };
  const blockers = [];
  if (completedDrills.length === 0) blockers.push("resilience_drill_outcomes_not_observed");
  if (approvedGates.length < RESILIENCE_GATE_CATALOG.length) blockers.push("resilience_gates_not_fully_approved");
  if (openIncidents.some((row) => ["critical", "rollback_required"].includes(row.severity))) blockers.push("critical_incident_open");
  if (objectiveRows.length < 15) blockers.push("critical_flow_objectives_incomplete");
  return {
    degradationModes: DEGRADATION_MODE_CATALOG,
    incidentClasses: INCIDENT_CLASS_CATALOG,
    drillCatalog: DRILL_CATALOG,
    gateCatalog: RESILIENCE_GATE_CATALOG,
    continuityStatuses: CONTINUITY_STATUS_CATALOG,
    recoveryWorkflows: RECOVERY_WORKFLOW_CATALOG,
    objectives: objectiveRows,
    incidents: incidentRows,
    drills: drillRows,
    gates: gateRows,
    economics,
    summary: {
      objectivesConfigured: objectiveRows.length,
      openIncidents: openIncidents.length,
      criticalIncidents: openIncidents.filter((row) => ["critical", "rollback_required"].includes(row.severity)).length,
      drillsPlanned: drillRows.filter((row) => ["planned", "scheduled"].includes(row.status)).length,
      drillsObserved: completedDrills.length,
      drillsPassed: completedDrills.filter((row) => row.status === "completed" && !(row.validationChecks || []).some((check) => check.result === "fail")).length,
      gatesApproved: approvedGates.length,
      activeDegradedModes: openIncidents.filter((row) => row.degradedMode !== "normal").length,
    },
    readinessReport: {
      decision: blockers.length ? "hold_for_evidence" : "leadership_review_ready",
      blockers,
      unresolvedRisks: [...new Set([...blockers, ...openIncidents.map((row) => row.incidentClass)])],
      nextFocusOptions: ["reliability_engineering", "partner_api_scale", "finance_settlement", "multi_market_resilience", "compliance_audit", "support_moderation_capacity", "akuso_resilience", "provider_redundancy_cost"],
      externalUseBoundary: "Configured targets and planned drills are not reliability outcomes; external claims require reviewed observed evidence.",
    },
  };
};

const buildAssuranceView = ({ controls = [], packs = [], now = new Date() } = {}) => {
  const controlRows = controls.map((row) => serializeControl(row, now));
  const packRows = packs.map((row) => serializeEvidencePack(row, now));
  const staleControls = controlRows.filter((row) => row.evidenceFreshness !== "current" || (asDate(row.nextReviewAt) && asDate(row.nextReviewAt) <= now));
  const openExceptions = packRows.reduce((count, row) => count + Number(row.exceptionSummary?.total || 0), 0);
  const criticalExceptions = packRows.reduce((count, row) => count + Number(row.exceptionSummary?.openHighCritical || 0), 0);
  const externalPacks = packs
    .filter((row) => row.externalShareApproved)
    .map((row) => serializeEvidencePack(row, now, { external: true }))
    .filter((row) => row.evidenceFreshness === "current" && row.readinessState === "ready" && !row.containsRestrictedDetails);
  const monitoringAlerts = [];
  staleControls.forEach((row) => monitoringAlerts.push({ type: "evidence_freshness", key: row.controlKey, severity: ["high", "critical"].includes(row.exceptionSeverity) ? "high" : "medium" }));
  controlRows.filter((row) => !row.ownerName || !row.reviewerName).forEach((row) => monitoringAlerts.push({ type: "missing_owners", key: row.controlKey, severity: "high" }));
  packRows.filter((row) => row.exceptionSummary.openHighCritical > 0).forEach((row) => monitoringAlerts.push({ type: "high_risk_exception", key: row.packKey, severity: "high" }));
  const blockers = [];
  if (controlRows.length < ASSURANCE_CONTROL_CATALOG.length) blockers.push("assurance_control_coverage_incomplete");
  if (staleControls.length) blockers.push("assurance_evidence_stale_or_unreviewed");
  if (!packRows.some((row) => row.packType === "finance_close" && row.readinessState === "ready")) blockers.push("finance_close_not_reviewed_ready");
  if (criticalExceptions) blockers.push("high_risk_assurance_exceptions_open");
  return {
    controlCatalog: ASSURANCE_CONTROL_CATALOG,
    evidencePackStandard: EVIDENCE_PACK_STANDARD,
    readinessGateCatalog: ASSURANCE_GATE_CATALOG,
    continuousMonitorCatalog: CONTINUOUS_MONITOR_CATALOG,
    dueDiligenceRoomStandard: DUE_DILIGENCE_ROOM_STANDARD,
    controls: controlRows,
    evidencePacks: packRows,
    monitoringAlerts,
    dueDiligenceRoom: { approvedPacks: externalPacks, approvedPackCount: externalPacks.length },
    summary: {
      controlsConfigured: controlRows.length,
      controlsCurrent: controlRows.length - staleControls.length,
      controlsBlocked: controlRows.filter((row) => row.status === "blocked").length,
      evidencePacks: packRows.length,
      readyPacks: packRows.filter((row) => row.readinessState === "ready").length,
      openExceptions,
      openHighCriticalExceptions: criticalExceptions,
      monitoringAlerts: monitoringAlerts.length,
      externalPacksApproved: externalPacks.length,
    },
    operatingReport: {
      decision: blockers.length ? "hold_for_assurance_evidence" : "leadership_review_ready",
      blockers,
      ownerScorecard: [...new Set(controlRows.map((row) => row.ownerName).filter(Boolean))].map((ownerName) => ({
        ownerName,
        controls: controlRows.filter((row) => row.ownerName === ownerName).length,
        current: controlRows.filter((row) => row.ownerName === ownerName && row.evidenceFreshness === "current").length,
      })),
      nextMaturityOptions: ["compliance_audit", "finance_systems", "partner_api_scale", "multi_market_governance", "data_experimentation", "trust_safety_capacity", "privacy_rights", "akuso_model_operations", "provider_redundancy", "creator_support"],
      externalUseBoundary: EVIDENCE_PACK_STANDARD.externalRule,
    },
  };
};

const buildAuditView = ({ domains = [], tests = [], findings = [], now = new Date() } = {}) => {
  const domainRows = domains.map((row) => serializeAuditDomain(row, now));
  const testRows = tests.map((row) => serializeControlTest(row));
  const findingRows = findings.map((row) => serializeFinding(row));
  const tested = testRows.filter((row) => row.result !== "not_run");
  const highCritical = findingRows.filter((row) => ["high", "critical"].includes(row.severity) && !["closed", "risk_accepted"].includes(row.status));
  const overdue = findingRows.filter((row) => !["closed", "risk_accepted"].includes(row.status) && asDate(row.dueAt) && asDate(row.dueAt) <= now);
  const testedDomainKeys = new Set(tested.map((row) => row.domainKey));
  const externalDomainSummary = domainRows.map((domain) => ({
    domainKey: domain.domainKey,
    readinessState: domain.readinessState,
    evidenceState: domain.evidenceState,
    controlsTested: testRows.filter((row) => row.domainKey === domain.domainKey && row.result !== "not_run").length,
    failedControls: testRows.filter((row) => row.domainKey === domain.domainKey && row.result === "fail").length,
    externalReviewCandidate: domain.readinessState === "external_review_candidate" && domain.evidenceState === "current",
  }));
  const blockers = [];
  if (domainRows.length < AUDIT_UNIVERSE_CATALOG.length) blockers.push("audit_universe_incomplete");
  if (tested.length === 0) blockers.push("audit_samples_not_observed");
  if (highCritical.length) blockers.push("high_or_critical_findings_open");
  if (testRows.some((row) => ["not_testable"].includes(row.result))) blockers.push("not_testable_controls_present");
  return {
    universeCatalog: AUDIT_UNIVERSE_CATALOG,
    evidenceRoomStandard: {
      sections: ["scope", "policies", "controls", "obligations", "evidence_index", "population", "sample_method", "owner_signoff", "reviewer_notes", "findings", "remediation", "retest", "sharing"],
      sharingLevels: AuditDomain.SHARING_LEVELS,
      evidenceStates: AuditDomain.EVIDENCE_STATES,
    },
    testingStandard: { methods: AuditControlTest.TEST_METHODS, results: AuditControlTest.TEST_RESULTS, closureRule: "Owner assertion alone cannot close a failed control; independent retest evidence is required." },
    findingsStandard: { severities: AuditFinding.FINDING_SEVERITIES, retestStates: AuditFinding.RETEST_STATES, riskAcceptanceRule: "Named approval, expiry, compensating control, and review trigger are required." },
    firstAuditScopeCatalog: FIRST_AUDIT_SCOPE_CATALOG,
    sampleCatalog: AUDIT_SAMPLE_CATALOG,
    domains: domainRows,
    tests: testRows,
    findings: findingRows,
    summary: {
      domainsConfigured: domainRows.length,
      domainsSelected: domainRows.filter((row) => row.selectedForFirstAudit).length,
      domainsTested: testedDomainKeys.size,
      controlsTested: tested.length,
      passed: tested.filter((row) => ["pass", "pass_with_observation"].includes(row.result)).length,
      failed: tested.filter((row) => row.result === "fail").length,
      notTestable: tested.filter((row) => row.result === "not_testable").length,
      openFindings: findingRows.filter((row) => !["closed", "risk_accepted"].includes(row.status)).length,
      highCriticalOpen: highCritical.length,
      overdueFindings: overdue.length,
      retestQueue: findingRows.filter((row) => ["ready_for_retest", "retest_in_progress"].includes(row.retestState)).length,
    },
    findingsReport: {
      decision: blockers.length ? "internal_remediation_required" : "external_review_candidate",
      blockers,
      repeatedThemes: [...new Set(findingRows.map((row) => row.affectedControl).filter(Boolean))],
      externalSummary: { domains: externalDomainSummary, totals: { controlsTested: tested.length, passed: tested.filter((row) => ["pass", "pass_with_observation"].includes(row.result)).length, failed: tested.filter((row) => row.result === "fail").length, notTestable: tested.filter((row) => row.result === "not_testable").length, highCriticalOpen: highCritical.length } },
      restrictedFindingDetailsExcludedFromExternalSummary: true,
    },
  };
};

const buildResilienceAssuranceAuditOperatingView = ({ objectives = [], incidents = [], drills = [], gates = [], controls = [], packs = [], domains = [], tests = [], findings = [], now = new Date() } = {}) => {
  const resilience = buildResilienceView({ objectives, incidents, drills, gates, now });
  const assurance = buildAssuranceView({ controls, packs, now });
  const audit = buildAuditView({ domains, tests, findings, now });
  return {
    generatedAt: now.toISOString(),
    roadmapPackages: ROADMAP_PACKAGES,
    summary: {
      roadmapPackagesComplete: ROADMAP_PACKAGES.length,
      openIncidents: resilience.summary.openIncidents,
      drillsObserved: resilience.summary.drillsObserved,
      assuranceControls: assurance.summary.controlsConfigured,
      assuranceExceptions: assurance.summary.openExceptions,
      auditControlsTested: audit.summary.controlsTested,
      openAuditFindings: audit.summary.openFindings,
      operatingDecision: [resilience.readinessReport.blockers, assurance.operatingReport.blockers, audit.findingsReport.blockers].some((list) => list.length) ? "hold_for_evidence" : "leadership_review_ready",
    },
    resilience,
    assurance,
    audit,
    akuso: AKUSO_RESILIENCE_ASSURANCE_AUDIT_POLICY,
    dataLimits: {
      plannedDrillsCountAsPassed: false,
      configuredControlsCountAsTested: false,
      ownerAssertionsCloseFindings: false,
      staleEvidenceSupportsReadiness: false,
      restrictedEvidenceExternallyExposed: false,
      akusoDecisionAuthority: "none",
    },
  };
};

const buildResilienceAssuranceAuditOperatingSystem = async () => {
  const [objectives, incidents, drills, gates, controls, packs, domains, tests, findings] = await Promise.all([
    ResilienceObjective.find({}).sort({ recoveryPriority: 1 }).lean(),
    ResilienceIncident.find({}).sort({ startedAt: -1 }).lean(),
    ResilienceDrill.find({}).sort({ scheduledAt: -1 }).lean(),
    ResilienceGate.find({}).sort({ gateKey: 1 }).lean(),
    AssuranceControl.find({}).sort({ controlKey: 1 }).lean(),
    AssuranceEvidencePack.find({}).sort({ updatedAt: -1 }).lean(),
    AuditDomain.find({}).sort({ riskScore: -1, domainKey: 1 }).lean(),
    AuditControlTest.find({}).sort({ testedAt: -1, createdAt: -1 }).lean(),
    AuditFinding.find({}).sort({ severity: -1, dueAt: 1 }).lean(),
  ]);
  return buildResilienceAssuranceAuditOperatingView({ objectives, incidents, drills, gates, controls, packs, domains, tests, findings, now: new Date() });
};

const createResilienceIncident = async ({ payload = {}, adminUserId }) => {
  const reason = requireReason(payload.reason);
  const incident = new ResilienceIncident({
    ...payload,
    incidentKey: keyOf(payload.incidentKey), incidentClass: keyOf(payload.incidentClass),
    createdBy: adminUserId, lastChangedBy: adminUserId,
    communications: payload.supportCopy ? [{ audience: "support", message: payload.supportCopy, nextUpdateAt: payload.nextUpdateAt, createdBy: adminUserId }] : [],
    history: [{ status: payload.status || "open", severity: payload.severity, degradedMode: payload.degradedMode, actorId: adminUserId, reason }],
  });
  await incident.save();
  return serializeIncident(incident);
};

const updateResilienceIncident = async ({ incidentId, updates = {}, adminUserId }) => {
  assertId(incidentId, "Incident ID");
  const reason = requireReason(updates.reason);
  const incident = await ResilienceIncident.findById(incidentId);
  if (!incident) throw errorWithStatus("Resilience incident not found", 404);
  setDefined(incident, updates, ["incidentClass", "severity", "affectedSurface", "userImpact", "workflowState", "degradedMode", "ownerName", "ownerRole", "responderTeams", "currentMitigation", "nextUpdateAt", "rollbackOption", "supportCopy", "postIncidentReviewOwner", "runbookPath", "relatedWorkflowKeys", "relatedAutomationKeys", "relatedMetricKeys", "status", "mitigatedAt", "recoveredAt", "closedAt", "recoveryEvidence", "correctionRequired"]);
  if (updates.communication?.message) incident.communications.push({ ...updates.communication, createdBy: adminUserId });
  incident.lastChangedBy = adminUserId;
  incident.history.push({ status: incident.status, severity: incident.severity, degradedMode: incident.degradedMode, actorId: adminUserId, reason });
  await incident.save();
  return serializeIncident(incident);
};

const createResilienceDrill = async ({ payload = {}, adminUserId }) => {
  const reason = requireReason(payload.reason);
  const drill = new ResilienceDrill({ ...payload, drillKey: keyOf(payload.drillKey), scenarioKey: keyOf(payload.scenarioKey), createdBy: adminUserId, lastChangedBy: adminUserId, history: [{ status: payload.status || "planned", actorId: adminUserId, reason }] });
  await drill.save();
  return serializeDrill(drill);
};

const updateResilienceDrill = async ({ drillId, updates = {}, adminUserId }) => {
  assertId(drillId, "Drill ID");
  const reason = requireReason(updates.reason);
  const drill = await ResilienceDrill.findById(drillId);
  if (!drill) throw errorWithStatus("Resilience drill not found", 404);
  setDefined(drill, updates, ["scenario", "ownerName", "ownerRole", "participatingTeams", "expectedDegradedMode", "rollbackPath", "communicationPath", "successMetric", "followUpOwner", "scheduledAt", "status", "startedAt", "completedAt", "validationChecks", "metrics", "findings", "runbookUpdates", "workflowUpdates", "akusoEvalFixtures", "costProxies"]);
  if (updates.recordReview) { drill.reviewedBy = adminUserId; drill.reviewedAt = new Date(); }
  drill.lastChangedBy = adminUserId;
  drill.history.push({ status: drill.status, actorId: adminUserId, reason });
  await drill.save();
  return serializeDrill(drill);
};

const upsertResilienceGate = async ({ gateKey, payload = {}, adminUserId }) => {
  const reason = requireReason(payload.reason);
  const normalizedKey = keyOf(gateKey);
  let gate = await ResilienceGate.findOne({ gateKey: normalizedKey });
  if (!gate) gate = new ResilienceGate({ gateKey: normalizedKey, createdBy: adminUserId });
  setDefined(gate, payload, ["title", "target", "evidenceRequired", "evidenceRefs", "ownerName", "ownerRole", "reviewerName", "reviewCadence", "blockerCondition", "rollbackOrPauseCondition", "launchOrPartnerImplication", "status", "lastReviewedAt", "nextReviewAt", "approvalExpiresAt", "decisionReason"]);
  if (payload.approve) { gate.status = "approved"; gate.approvedBy = adminUserId; gate.approvedAt = new Date(); gate.lastReviewedAt = new Date(); }
  gate.lastChangedBy = adminUserId;
  gate.history.push({ status: gate.status, actorId: adminUserId, reason });
  await gate.save();
  return serializeGate(gate);
};

const createAssuranceControl = async ({ payload = {}, adminUserId }) => {
  const reason = requireReason(payload.reason);
  const control = new AssuranceControl({ ...payload, controlKey: keyOf(payload.controlKey), createdBy: adminUserId, lastChangedBy: adminUserId, history: [{ status: payload.status || "draft", evidenceFreshness: payload.evidenceFreshness || "delayed", exceptionSeverity: payload.exceptionSeverity || "none", actorId: adminUserId, reason }] });
  if (payload.recordReview) { control.reviewedBy = adminUserId; control.lastReviewAt = new Date(); }
  await control.save();
  return serializeControl(control);
};

const updateAssuranceControl = async ({ controlId, updates = {}, adminUserId }) => {
  assertId(controlId, "Control ID");
  const reason = requireReason(updates.reason);
  const control = await AssuranceControl.findById(controlId);
  if (!control) throw errorWithStatus("Assurance control not found", 404);
  setDefined(control, updates, ["workflow", "surface", "ownerName", "ownerRole", "reviewerName", "reviewerRole", "objective", "evidenceSource", "freshnessExpectation", "automationStatus", "evidenceFreshness", "exceptionSeverity", "readinessImplication", "status", "nextReviewAt", "auditNotes", "evidenceRefs"]);
  if (updates.recordReview) { control.reviewedBy = adminUserId; control.lastReviewAt = new Date(); }
  control.lastChangedBy = adminUserId;
  control.history.push({ status: control.status, evidenceFreshness: control.evidenceFreshness, exceptionSeverity: control.exceptionSeverity, actorId: adminUserId, reason });
  await control.save();
  return serializeControl(control);
};

const createAssuranceEvidencePack = async ({ payload = {}, adminUserId }) => {
  const reason = requireReason(payload.reason);
  const pack = new AssuranceEvidencePack({ ...payload, packKey: keyOf(payload.packKey), createdBy: adminUserId, lastChangedBy: adminUserId, approvalHistory: [{ decision: "submitted", actorId: adminUserId, reason }] });
  if (payload.recordReview) { pack.reviewedBy = adminUserId; pack.reviewedAt = new Date(); pack.approvalHistory.push({ decision: payload.readinessState === "ready" ? "approved" : "submitted", actorId: adminUserId, reason }); }
  await pack.save();
  return serializeEvidencePack(pack);
};

const updateAssuranceEvidencePack = async ({ packId, updates = {}, adminUserId }) => {
  assertId(packId, "Evidence pack ID");
  const reason = requireReason(updates.reason);
  const pack = await AssuranceEvidencePack.findById(packId);
  if (!pack) throw errorWithStatus("Assurance evidence pack not found", 404);
  setDefined(pack, updates, ["title", "workflowSummary", "ownerName", "ownerRole", "reviewerName", "controlKeys", "sourceSystems", "metricSnapshots", "exceptions", "reconciliationStatus", "incidentRefs", "impactSummary", "openRisks", "evidenceFreshness", "readinessState", "sharingLevel", "externalShareApproved", "containsRestrictedDetails", "nextReviewAt", "approvalExpiresAt"]);
  if (updates.recordReview) { pack.reviewedBy = adminUserId; pack.reviewedAt = new Date(); pack.approvalHistory.push({ decision: pack.readinessState === "ready" ? "approved" : "submitted", actorId: adminUserId, reason }); }
  if (updates.revokeApproval) { pack.externalShareApproved = false; pack.readinessState = "withdrawn"; pack.approvalHistory.push({ decision: "revoked", actorId: adminUserId, reason }); }
  pack.lastChangedBy = adminUserId;
  await pack.save();
  return serializeEvidencePack(pack);
};

const createAuditDomain = async ({ payload = {}, adminUserId }) => {
  const reason = requireReason(payload.reason);
  const domain = new AuditDomain({ ...payload, createdBy: adminUserId, lastChangedBy: adminUserId, history: [{ readinessState: payload.readinessState || "unscoped", evidenceState: payload.evidenceState || "incomplete", actorId: adminUserId, reason }] });
  if (payload.recordOwnerSignoff) domain.auditOwnerSignoff = adminUserId;
  await domain.save();
  return serializeAuditDomain(domain);
};

const updateAuditDomain = async ({ domainId, updates = {}, adminUserId }) => {
  assertId(domainId, "Audit domain ID");
  const reason = requireReason(updates.reason);
  const domain = await AuditDomain.findById(domainId);
  if (!domain) throw errorWithStatus("Audit domain not found", 404);
  setDefined(domain, updates, ["title", "controlFamilies", "relatedObligations", "relatedPolicies", "relatedWorkflows", "ownerName", "ownerRole", "reviewerName", "reviewerRole", "evidenceSources", "impact", "riskScore", "reviewCadence", "readinessState", "evidenceState", "selectedForFirstAudit", "scheduledAt", "evidenceRoom", "nextReviewAt"]);
  if (updates.recordOwnerSignoff) domain.auditOwnerSignoff = adminUserId;
  domain.lastChangedBy = adminUserId;
  domain.history.push({ readinessState: domain.readinessState, evidenceState: domain.evidenceState, actorId: adminUserId, reason });
  await domain.save();
  return serializeAuditDomain(domain);
};

const createAuditControlTest = async ({ payload = {}, adminUserId }) => {
  const reason = requireReason(payload.reason);
  assertId(payload.auditDomain, "Audit domain ID");
  const domain = await AuditDomain.findById(payload.auditDomain);
  if (!domain) throw errorWithStatus("Audit domain not found", 404);
  if (domain.domainKey !== payload.domainKey) throw errorWithStatus("Audit test domain key does not match the selected audit domain", 400);
  const test = new AuditControlTest({ ...payload, testKey: keyOf(payload.testKey), controlKey: keyOf(payload.controlKey), createdBy: adminUserId, lastChangedBy: adminUserId, history: [{ result: payload.result || "not_run", actorId: adminUserId, reason }] });
  if (payload.recordReview) { test.reviewerId = adminUserId; test.testedAt = new Date(); }
  await test.save();
  return serializeControlTest(test);
};

const updateAuditControlTest = async ({ testId, updates = {}, adminUserId }) => {
  assertId(testId, "Audit test ID");
  const reason = requireReason(updates.reason);
  const test = await AuditControlTest.findById(testId);
  if (!test) throw errorWithStatus("Audit control test not found", 404);
  setDefined(test, updates, ["objective", "population", "populationCount", "sampleSize", "sampleSelectionMethod", "testingMethod", "expectedEvidence", "actualEvidenceRefs", "result", "exceptionSummary", "rootCause", "reviewerName", "retestRequired", "retestDueAt", "closureEvidenceRefs", "evidenceState"]);
  if (updates.recordReview) { test.reviewerId = adminUserId; test.testedAt = new Date(); }
  test.lastChangedBy = adminUserId;
  test.history.push({ result: test.result, actorId: adminUserId, reason });
  await test.save();
  return serializeControlTest(test);
};

const createAuditFinding = async ({ payload = {}, adminUserId }) => {
  const reason = requireReason(payload.reason);
  const finding = new AuditFinding({ ...payload, findingKey: keyOf(payload.findingKey), createdBy: adminUserId, lastChangedBy: adminUserId, history: [{ status: payload.status || "open", retestState: payload.retestState || "not_ready", actorId: adminUserId, reason }] });
  await finding.save();
  return serializeFinding(finding);
};

const updateAuditFinding = async ({ findingId, updates = {}, adminUserId }) => {
  assertId(findingId, "Audit finding ID");
  const reason = requireReason(updates.reason);
  const finding = await AuditFinding.findById(findingId);
  if (!finding) throw errorWithStatus("Audit finding not found", 404);
  setDefined(finding, updates, ["severity", "affectedObligation", "affectedControl", "affectedUsersOrPartners", "rootCause", "evidenceRefs", "ownerName", "ownerRole", "dueAt", "remediationPlan", "compensatingControl", "acceptedRisk", "retestOwnerName", "retestState", "retestAt", "closureEvidenceRefs", "status"]);
  if (updates.recordRetest) { finding.retestedBy = adminUserId; finding.retestAt = new Date(); }
  if (updates.acceptRisk) {
    finding.acceptedRisk = { ...(updates.acceptedRisk || {}), accepted: true, approvedBy: adminUserId, approvedAt: new Date() };
    finding.status = "risk_accepted";
    finding.retestState = "risk_accepted";
  }
  finding.lastChangedBy = adminUserId;
  finding.history.push({ status: finding.status, retestState: finding.retestState, actorId: adminUserId, reason });
  await finding.save();
  return serializeFinding(finding);
};

module.exports = {
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
  EVIDENCE_PACK_STANDARD,
  FIRST_AUDIT_SCOPE_CATALOG,
  INCIDENT_CLASS_CATALOG,
  RECOVERY_WORKFLOW_CATALOG,
  RESILIENCE_GATE_CATALOG,
  ROADMAP_PACKAGES,
  buildAssuranceView,
  buildAuditView,
  buildResilienceAssuranceAuditOperatingSystem,
  buildResilienceAssuranceAuditOperatingView,
  buildResilienceView,
  createAssuranceControl,
  createAssuranceEvidencePack,
  createAuditControlTest,
  createAuditDomain,
  createAuditFinding,
  createResilienceDrill,
  createResilienceIncident,
  serializeControl,
  serializeControlTest,
  serializeDrill,
  serializeEvidencePack,
  serializeFinding,
  serializeGate,
  serializeIncident,
  updateAssuranceControl,
  updateAssuranceEvidencePack,
  updateAuditControlTest,
  updateAuditDomain,
  updateAuditFinding,
  updateResilienceDrill,
  updateResilienceIncident,
  upsertResilienceGate,
};
