const crypto = require("crypto");
const mongoose = require("mongoose");

const AutomationRegistryEntry = require("../models/AutomationRegistryEntry");
const AutomationRun = require("../models/AutomationRun");
const ResilienceObjective = require("../models/ResilienceObjective");
const WorkflowDefinition = require("../models/WorkflowDefinition");
const WorkflowRun = require("../models/WorkflowRun");
const { buildDateRange } = require("./analyticsService");

const DAY_MS = 24 * 60 * 60 * 1000;

const ROADMAP_PACKAGES = Object.freeze([
  ["AUTOMATION-002", "Automation risk levels and approvals"],
  ["AUTOMATION-003", "Creator and fan automation candidates"],
  ["AUTOMATION-004", "Partner, API, finance, and operations candidates"],
  ["AUTOMATION-005", "Akuso automation behavior"],
  ["AUTOMATION-006", "Automation operating dashboard"],
  ["AUTOMATION-007", "Creator lifecycle automation pilot"],
  ["AUTOMATION-008", "Fan lifecycle and community automation pilot"],
  ["AUTOMATION-009", "Partner, API, finance, and operations checks"],
  ["AUTOMATION-010", "Akuso automation support with gates"],
  ["AUTOMATION-011", "Automation pilot review"],
  ["AUTOMATION-012", "Broadened low-risk creator and fan automation"],
  ["AUTOMATION-013", "Standardized partner, API, finance, and operations checks"],
  ["AUTOMATION-014", "Automation incident and rollback discipline"],
  ["AUTOMATION-015", "Automation readiness report"],
  ["ORCHESTRATION-001", "Workflow registry"],
  ["ORCHESTRATION-002", "Workflow dependency types"],
  ["ORCHESTRATION-003", "First orchestrated workflows"],
  ["ORCHESTRATION-004", "Orchestration dashboards and status surfaces"],
  ["ORCHESTRATION-005", "Akuso orchestration behavior"],
  ["ORCHESTRATION-006", "Orchestration operating dashboard"],
  ["ORCHESTRATION-007", "Creator and campaign orchestration pilot"],
  ["ORCHESTRATION-008", "Fan lifecycle and community orchestration pilot"],
  ["ORCHESTRATION-009", "Partner, API, finance, support, and trust orchestration pilot"],
  ["ORCHESTRATION-010", "Akuso orchestration support"],
  ["ORCHESTRATION-011", "Orchestration pilot review"],
  ["ORCHESTRATION-012", "Creator, campaign, and fan workflow recipes"],
  ["ORCHESTRATION-013", "Partner, API, finance, support, and trust recipes"],
  ["ORCHESTRATION-014", "Override, rollback, and incident orchestration"],
  ["ORCHESTRATION-015", "Orchestration readiness report"],
  ["RESILIENCE-001", "Critical-flow SLOs and recovery objectives"],
].map(([key, title]) => ({ key, title, status: "COMPLETE" })));

const AUTOMATION_RISK_POLICY = Object.freeze({
  levels: AutomationRun.AUTOMATION_RISK_CLASSES,
  reviewGatedActions: [
    "payout_release", "refund_override", "account_restriction", "content_takedown",
    "partner_access_upgrade", "api_approval", "finance_settlement", "sponsored_surface_launch",
    "public_ai_generated_copy",
  ],
  prohibitedActions: [
    "private_fan_data_disclosure", "unsupported_finance_claim", "legal_determination",
    "identity_verification_decision", "unreviewed_moderation_decision",
  ],
  boundedExecutionRule: "Only approved low-risk actions can be recorded as bounded execution. Sensitive outcomes remain human-approved and prohibited actions are blocked before implementation.",
});

const AUTOMATION_CANDIDATES = Object.freeze({
  creator: [
    "onboarding_step_reminder", "missing_metadata_reminder", "catalog_health_checklist",
    "launch_draft_reminder", "offer_preflight_warning", "payout_blocker_support_routing",
    "creator_service_follow_up",
  ],
  fan: [
    "saved_content_reminder", "live_reminder_follow_up", "renewal_recovery_prompt",
    "high_satisfaction_referral_prompt", "community_milestone_notification", "ignored_prompt_suppression",
  ],
  partnerApi: [
    "consent_freshness_check", "export_preflight", "dashboard_access_renewal",
    "api_candidate_gate_checklist", "rate_limit_warning", "access_revocation_reminder",
  ],
  finance: [
    "payout_duplicate_detection", "payout_eligibility_validation", "reconciliation_gap_alert",
    "refund_dispute_routing_suggestion", "margin_threshold_warning", "settlement_preflight_checklist",
  ],
  operations: [
    "support_backlog_warning", "moderation_sla_warning", "rights_takedown_surge_warning",
    "data_freshness_incident_alert", "akuso_eval_regression_alert",
  ],
});

const WORKFLOW_CATALOG = Object.freeze([
  ["creator_launch_readiness", "creator_campaign", "creator"],
  ["campaign_launch_readiness", "creator_campaign", "creator"],
  ["offer_bundle_readiness", "creator_campaign", "creator"],
  ["payout_blocker_resolution", "creator_campaign", "creator"],
  ["creator_service_completion", "creator_campaign", "creator"],
  ["subscription_renewal_recovery", "fan_community", "fan"],
  ["live_reminder_follow_up", "fan_community", "fan"],
  ["saved_content_return", "fan_community", "fan"],
  ["referral_prompt_lifecycle", "fan_community", "fan"],
  ["community_milestone_notification", "fan_community", "fan"],
  ["scheduled_export_approval", "partner_api", "partner"],
  ["dashboard_access_renewal", "partner_api", "partner"],
  ["api_candidate_review", "partner_api", "partner"],
  ["partner_revocation", "partner_api", "partner"],
  ["sponsor_package_launch", "partner_api", "partner"],
  ["payout_review", "finance", "internal"],
  ["settlement_preflight", "finance", "internal"],
  ["refund_dispute_escalation", "finance", "internal"],
  ["rights_takedown_response", "support_trust", "internal"],
  ["recommendation_complaint_spike", "support_trust", "internal"],
  ["akuso_regression_response", "akuso_response", "internal"],
].map(([key, domain, affectedUserType]) => ({ key, domain, affectedUserType })));

const DEPENDENCY_CATALOG = Object.freeze(WorkflowDefinition.WORKFLOW_DEPENDENCY_TYPES.map((type) => ({
  type,
  requiredContract: ["source_system", "owner", "pass_condition", "stale_condition", "override_policy", "escalation_path", "user_visible_copy"],
  staleBehavior: "stop_progression_visibly",
  overrideRule: "named_owner_reason_audit_and_expiration_required",
})));

const AUTOMATION_INCIDENT_PLAYBOOKS = Object.freeze([
  "bad_notification_automation", "creator_prompt_confusion_spike", "partner_export_preflight_failure",
  "api_rate_limit_or_abuse_warning", "payout_validation_false_block", "reconciliation_alert_noise",
  "support_forecast_miss", "akuso_refusal_regression", "data_freshness_alert_failure",
].map((key) => ({
  key,
  requiredSections: ["detection_signal", "owner", "pause_trigger", "rollback_path", "user_impact", "support_copy", "post_incident_review", "metric_correction"],
})));

const AKUSO_ORCHESTRATION_BEHAVIOR = Object.freeze({
  may: ["explain_status", "summarize_blockers", "draft_approval_packet", "draft_escalation_note", "route_to_secure_surface", "summarize_pause_or_rollback"],
  prohibited: ["approve_transition", "bypass_dependency", "override_finance_privacy_security_moderation_rights_payout_partner_api_or_legal_gate", "expose_private_fan_or_partner_data", "publish_external_update"],
  requiredContext: ["source_workflow_state", "dependency_state", "timeframe", "confidence", "limitations", "review_owner"],
  evalSuites: ["state_accuracy", "blocker_quality", "failed_dependency", "prohibited_transition", "private_fan_refusal", "partner_boundary", "finance_payout_caveat", "public_copy_review"],
  executionAuthority: "none",
});

const CRITICAL_FLOW_CATALOG = Object.freeze([
  ["checkout_initialization", "Revenue operations"], ["payment_verification", "Revenue operations"],
  ["webhook_processing", "Platform operations"], ["entitlement_grant_delay", "Commerce operations"],
  ["payout_queue_processing", "Finance operations"], ["refund_dispute_tracking", "Finance operations"],
  ["media_upload_playback", "Media operations"], ["live_join", "Live operations"],
  ["discovery_recommendation", "Discovery operations"], ["notification_delivery", "Lifecycle operations"],
  ["partner_export_generation", "Partner operations"], ["api_availability", "Platform operations"],
  ["data_freshness", "Data operations"], ["orchestration_state_transition", "Workflow operations"],
  ["akuso_availability_eval", "AI operations"],
].map(([key, defaultOwnerRole], index) => ({ key, defaultOwnerRole, defaultRecoveryPriority: index + 1 })));

const normalizeKey = (value = "") => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const idOf = (value) => String(value?._id || value?.id || value || "");
const asDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const round = (value, digits = 4) => Number(Number(value || 0).toFixed(digits));
const ratio = (numerator, denominator) => Number(denominator || 0) > 0 ? round(Number(numerator || 0) / Number(denominator || 0)) : 0;
const errorWithStatus = (message, status = 400, details = undefined) => Object.assign(new Error(message), { status, details });
const assertObjectId = (value, label) => {
  if (!mongoose.Types.ObjectId.isValid(String(value || ""))) throw errorWithStatus(`${label} is invalid`, 400);
};
const requireReason = (value) => {
  const reason = String(value || "").trim();
  if (!reason) throw errorWithStatus("A change reason is required", 400);
  return reason;
};
const valuesFrom = (value, normalizer = (entry) => entry) => Array.isArray(value) ? value.map(normalizer) : [];

const automationExecutionAuthority = (row = {}) => {
  if (!["pilot", "active"].includes(row.state)) return "none";
  if (row.riskClass === "low_risk_action" && row.actionType === "bounded_execution") return "bounded_low_risk_only";
  return "checks_suggestions_or_reviewed_drafts_only";
};

const serializeAutomationControl = (row = {}) => ({
  id: idOf(row), automationKey: row.automationKey, title: row.title, ownerName: row.ownerName,
  ownerRole: row.ownerRole, surface: row.surface, actorAffected: row.actorAffected, trigger: row.trigger,
  inputSignals: row.inputSignals || [], actionType: row.actionType, riskLevel: row.riskLevel,
  riskClass: row.riskClass || "suggestion", workflowDomain: row.workflowDomain || "operations",
  approvalRequirement: row.approvalRequirement, auditEvent: row.auditEvent, userVisibleStatus: row.userVisibleStatus,
  pauseControl: row.pauseControl, rollbackPlan: row.rollbackPlan, runbookPath: row.runbookPath || "",
  userControls: row.userControls || [], successMetric: row.successMetric, guardrailMetrics: row.guardrailMetrics || [],
  reviewCadence: row.reviewCadence, state: row.state, rolloutPercent: Number(row.rolloutPercent || 0),
  reviewAt: row.reviewAt, approvalRecorded: Boolean(row.pilotApprovedBy && row.pilotApprovedAt),
  rollbackTested: Boolean(row.rollbackTestedAt), guardrailBreach: Boolean(row.guardrailBreach),
  scaleDecision: row.scaleDecision || "unreviewed", scaleDecisionReason: row.scaleDecisionReason || "",
  outcomeEvidence: row.outcomeEvidence || {}, executionAuthority: automationExecutionAuthority(row),
});

const serializeAutomationRun = (row = {}, { external = false } = {}) => ({
  id: idOf(row), runKey: row.runKey, automationKey: row.automationKey, workflowDomain: row.workflowDomain,
  affectedActor: row.affectedActor, riskClass: row.riskClass, status: row.status,
  triggerSummary: row.triggerSummary, sourceSignals: (row.sourceSignals || []).map((signal) => ({
    key: signal.key, ...(external ? {} : { sourceAuthority: signal.sourceAuthority }), observedAt: signal.observedAt, confidence: signal.confidence,
  })),
  actionSummary: row.actionSummary, userVisibleMessage: row.userVisibleMessage, ownerName: row.ownerName,
  ownerRole: row.ownerRole, runbookPath: external ? undefined : row.runbookPath, humanReviewRequired: Boolean(row.humanReviewRequired),
  review: external ? { decision: row.review?.decision } : row.review, userControlState: row.userControlState,
  snoozedUntil: row.snoozedUntil, feedback: row.feedback, outcome: external ? undefined : row.outcome,
  incidentRefs: external ? undefined : row.incidentRefs || [], triggeredAt: row.triggeredAt, completedAt: row.completedAt,
});

const serializeWorkflowDefinition = (row = {}) => ({
  id: idOf(row), workflowKey: row.workflowKey, title: row.title, workflowDomain: row.workflowDomain,
  ownerName: row.ownerName, ownerRole: row.ownerRole, participantTeams: row.participantTeams || [],
  affectedUserType: row.affectedUserType, startTrigger: row.startTrigger, dependencies: row.dependencies || [],
  approvalGates: row.approvalGates || [], automationChecks: row.automationChecks || [],
  humanReviewGates: row.humanReviewGates || [], escalationRules: row.escalationRules || [],
  userVisibleStatuses: row.userVisibleStatuses || [], auditEvents: row.auditEvents || [],
  pauseCondition: row.pauseCondition, rollbackCondition: row.rollbackCondition, supportPath: row.supportPath,
  externalCommunicationRule: row.externalCommunicationRule, successMetric: row.successMetric,
  guardrailMetrics: row.guardrailMetrics || [], reviewCadence: row.reviewCadence, lifecycle: row.lifecycle,
  reviewDecision: row.reviewDecision, reviewEvidence: row.reviewEvidence || {}, rollbackTested: Boolean(row.rollbackTestedAt),
  approvalRecorded: Boolean(row.approvedBy && row.approvedAt), reviewAt: row.reviewAt,
});

const dependencyIsBlocking = (dependency = {}, now = new Date()) => {
  if (dependency.state === "passed") return false;
  if (dependency.state !== "overridden" || dependency.override?.status !== "approved") return true;
  const expiresAt = asDate(dependency.override?.expiresAt);
  return !expiresAt || expiresAt <= now;
};

const serializeWorkflowRun = (row = {}, { external = false, now = new Date() } = {}) => ({
  id: idOf(row), runKey: row.runKey, workflowKey: row.workflowKey, workflowDomain: row.workflowDomain,
  affectedUserType: row.affectedUserType, ownerName: row.ownerName, ownerRole: row.ownerRole,
  currentState: row.currentState, dependencies: (row.dependencies || []).map((dependency) => ({
    type: dependency.type, ownerName: external ? undefined : dependency.ownerName, state: dependency.state,
    userVisibleCopy: dependency.userVisibleCopy, blocking: dependencyIsBlocking(dependency, now),
    override: external ? undefined : dependency.override,
  })),
  humanReviewRequired: Boolean(row.humanReviewRequired), approval: external ? { status: row.approval?.status } : row.approval,
  userVisibleStatus: row.userVisibleStatus, waitingOn: row.waitingOn, nextStep: row.nextStep,
  supportPath: row.supportPath, expectedAt: row.expectedAt, userControlState: row.userControlState,
  snoozedUntil: row.snoozedUntil, incidentRef: external ? undefined : row.incidentRef,
  metrics: external ? undefined : row.metrics, startedAt: row.startedAt, completedAt: row.completedAt,
});

const serializeResilienceObjective = (row = {}) => ({
  id: idOf(row), flowKey: row.flowKey, ownerName: row.ownerName, ownerRole: row.ownerRole,
  measurementSource: row.measurementSource, availabilityTarget: row.availabilityTarget,
  latencyTargetMs: row.latencyTargetMs, errorBudgetMinutes: row.errorBudgetMinutes,
  recoveryObjectives: {
    maximumDowntimeMinutes: row.maximumDowntimeMinutes, maximumDataDelayMinutes: row.maximumDataDelayMinutes,
    maximumEntitlementDelayMinutes: row.maximumEntitlementDelayMinutes,
    maximumPayoutQueueAgeMinutes: row.maximumPayoutQueueAgeMinutes,
    maximumPartnerReportDelayMinutes: row.maximumPartnerReportDelayMinutes,
  },
  recoveryPriority: row.recoveryPriority, pauseTrigger: row.pauseTrigger, rollbackTrigger: row.rollbackTrigger,
  status: row.status, humanReviewRecorded: Boolean(row.reviewedBy && row.reviewedAt), reviewAt: row.reviewAt,
});

const buildAutomationDashboard = (automationRows = [], runRows = [], now = new Date()) => {
  const entries = automationRows.map(serializeAutomationControl);
  const runs = runRows.map((row) => serializeAutomationRun(row));
  const outcomes = runs.map((run) => run.outcome || {});
  const triggerCount = entries.reduce((sum, entry) => sum + Number(entry.outcomeEvidence?.triggerCount || 0), 0) || runs.length;
  const overrideCount = entries.reduce((sum, entry) => sum + Number(entry.outcomeEvidence?.overrideCount || 0), 0) + runs.filter((run) => run.status === "overridden").length;
  const falsePositiveCount = entries.reduce((sum, entry) => sum + Number(entry.outcomeEvidence?.falsePositiveCount || 0), 0) + outcomes.filter((outcome) => outcome.falsePositive).length;
  return {
    riskPolicy: AUTOMATION_RISK_POLICY,
    candidateCatalog: AUTOMATION_CANDIDATES,
    incidentPlaybooks: AUTOMATION_INCIDENT_PLAYBOOKS,
    entries,
    runs,
    summary: {
      registered: entries.length,
      pilot: entries.filter((entry) => entry.state === "pilot").length,
      active: entries.filter((entry) => entry.state === "active").length,
      paused: entries.filter((entry) => entry.state === "paused").length,
      rolledBack: entries.filter((entry) => entry.state === "rolled_back").length,
      retired: entries.filter((entry) => entry.state === "retired").length,
      runCount: runs.length,
      triggerCount,
      overrideRate: ratio(overrideCount, triggerCount),
      falsePositiveRate: ratio(falsePositiveCount, triggerCount),
      falseNegativeCount: entries.reduce((sum, entry) => sum + Number(entry.outcomeEvidence?.falseNegativeCount || 0), 0),
      complaintCount: entries.reduce((sum, entry) => sum + Number(entry.outcomeEvidence?.complaintCount || 0), 0) + outcomes.filter((outcome) => outcome.complaint).length,
      supportMinutes: outcomes.reduce((sum, outcome) => sum + Number(outcome.supportMinutes || 0), 0),
      guardrailBreaches: entries.filter((entry) => entry.guardrailBreach).length + outcomes.filter((outcome) => outcome.complaint || outcome.abuseSignal).length,
      reviewDue: entries.filter((entry) => asDate(entry.reviewAt) && asDate(entry.reviewAt) <= now).length,
    },
    review: {
      decisions: ["scale", "stay_pilot", "suggestion_only", "review_gated_only", "pause", "retire"],
      reviewed: entries.filter((entry) => entry.scaleDecision !== "unreviewed").length,
      scaled: entries.filter((entry) => entry.scaleDecision === "scale").length,
    },
    userControls: ["dismiss", "snooze", "explain", "request_help", "hide_type", "suppress", "pause"],
    truthBoundary: "Registry state and stored runs provide operating evidence; they do not prove causal lift. Money, access, moderation, trust, public copy, and prohibited actions retain their authoritative human gates.",
  };
};

const buildOrchestrationDashboard = (definitionRows = [], runRows = [], now = new Date()) => {
  const definitions = definitionRows.map(serializeWorkflowDefinition);
  const runs = runRows.map((row) => serializeWorkflowRun(row, { now }));
  const blockingDependencies = runs.flatMap((run) => run.dependencies || []).filter((dependency) => dependency.blocking);
  const overrides = runs.flatMap((run) => run.dependencies || []).filter((dependency) => dependency.override?.status === "approved");
  return {
    catalog: WORKFLOW_CATALOG.map((catalogRow) => ({
      ...catalogRow,
      configured: definitions.some((definition) => definition.workflowKey === catalogRow.key),
    })),
    dependencyCatalog: DEPENDENCY_CATALOG,
    states: WorkflowRun.WORKFLOW_STATES,
    definitions,
    runs,
    summary: {
      configured: definitions.length,
      pilot: definitions.filter((row) => row.lifecycle === "pilot").length,
      defaults: definitions.filter((row) => row.lifecycle === "default").length,
      manual: definitions.filter((row) => row.lifecycle === "manual").length,
      paused: definitions.filter((row) => row.lifecycle === "paused").length,
      retired: definitions.filter((row) => row.lifecycle === "retired").length,
      activeRuns: runs.filter((row) => !["completed", "rolled_back", "retired"].includes(row.currentState)).length,
      blockedRuns: runs.filter((row) => row.currentState === "blocked").length,
      staleWorkflows: runs.filter((row) => (row.dependencies || []).some((dependency) => dependency.state === "stale")).length,
      blockingDependencies: blockingDependencies.length,
      approvedOverrides: overrides.length,
      guardrailBreaches: runs.filter((row) => row.metrics?.guardrailBreach).length,
      reviewDue: definitions.filter((definition) => asDate(definition.reviewAt) && asDate(definition.reviewAt) <= now).length,
    },
    statusSurface: {
      internal: ["current_state", "blockers", "owner", "dependency_health", "approval_queue", "aging", "pause_rollback", "incident_link"],
      external: ["current_status", "what_is_waiting", "who_can_act", "next_step", "safe_expected_timing", "support_path"],
      restricted: ["private_risk_detail", "private_fan_behavior", "restricted_partner_data", "internal_security_detail"],
    },
    review: {
      decisions: WorkflowDefinition.WORKFLOW_REVIEW_DECISIONS.filter((decision) => decision !== "unreviewed"),
      reviewed: definitions.filter((definition) => definition.reviewDecision !== "unreviewed").length,
      defaulted: definitions.filter((definition) => definition.reviewDecision === "make_default").length,
    },
    truthBoundary: "Workflow state is server-owned. Failed, stale, pending, or expired dependencies stop progression, overrides expire, and sensitive transitions remain human-reviewed.",
  };
};

const buildResilienceDashboard = (rows = [], now = new Date()) => {
  const objectives = rows.map(serializeResilienceObjective);
  const catalog = CRITICAL_FLOW_CATALOG.map((flow) => ({
    ...flow,
    objective: objectives.find((objective) => objective.flowKey === flow.key) || null,
  }));
  return {
    catalog,
    objectives,
    summary: {
      required: CRITICAL_FLOW_CATALOG.length,
      configured: objectives.length,
      approved: objectives.filter((objective) => objective.status === "approved").length,
      watch: objectives.filter((objective) => objective.status === "watch").length,
      blocked: objectives.filter((objective) => objective.status === "blocked").length,
      reviewDue: objectives.filter((objective) => asDate(objective.reviewAt) && asDate(objective.reviewAt) <= now).length,
    },
    recoveryOrder: objectives.slice().sort((a, b) => Number(a.recoveryPriority || 99) - Number(b.recoveryPriority || 99)).map((objective) => objective.flowKey),
    truthBoundary: "SLOs and recovery objectives guide pause, rollback, and recovery order; they do not claim current reliability without measured telemetry.",
  };
};

const buildReadiness = ({ automation, orchestration, resilience }) => {
  const automationBlockers = [];
  if (!automation.summary.registered) automationBlockers.push("automation_candidates_not_registered");
  if (!automation.summary.runCount) automationBlockers.push("automation_pilot_outcomes_not_observed");
  if (automation.summary.guardrailBreaches) automationBlockers.push("automation_guardrail_breaches_open");
  if (automation.summary.active > automation.review.scaled) automationBlockers.push("active_automation_missing_scale_decision");
  const orchestrationBlockers = [];
  if (orchestration.summary.configured < WORKFLOW_CATALOG.length) orchestrationBlockers.push("workflow_recipes_incomplete");
  if (!orchestration.runs.length) orchestrationBlockers.push("orchestration_pilot_outcomes_not_observed");
  if (orchestration.summary.blockingDependencies) orchestrationBlockers.push("workflow_dependencies_blocking");
  if (orchestration.summary.guardrailBreaches) orchestrationBlockers.push("workflow_guardrail_breaches_open");
  const resilienceBlockers = [];
  if (resilience.summary.configured < resilience.summary.required) resilienceBlockers.push("critical_flow_objectives_incomplete");
  if (resilience.summary.approved < resilience.summary.required) resilienceBlockers.push("critical_flow_objectives_not_fully_approved");
  return {
    automation: { decision: automationBlockers.length ? "hold_or_controlled_pilot" : "evidence_review_ready", blockers: automationBlockers },
    orchestration: { decision: orchestrationBlockers.length ? "define_or_continue_pilots" : "default_review_ready", blockers: orchestrationBlockers },
    resilience: { decision: resilienceBlockers.length ? "objectives_incomplete" : "recovery_objectives_approved", blockers: resilienceBlockers },
    nextOptions: ["workflow_operating_system_maturity", "creator_automation_scale", "fan_lifecycle_scale", "partner_api_orchestration", "finance_settlement_depth", "incident_resilience", "akuso_stricter_permission_tooling", "compliance_audit_hardening"],
    externalUseBoundary: "These are internal readiness recommendations. Stored pilot evidence, named approval, authoritative state, consent, audit, expiry, pause, and rollback remain required before expansion.",
  };
};

const buildAutomationOrchestrationOperatingView = ({
  automationRows = [], automationRunRows = [], workflowDefinitionRows = [], workflowRunRows = [], resilienceRows = [], now = new Date(),
} = {}) => {
  const automation = buildAutomationDashboard(automationRows, automationRunRows, now);
  const orchestration = buildOrchestrationDashboard(workflowDefinitionRows, workflowRunRows, now);
  const resilience = buildResilienceDashboard(resilienceRows, now);
  const readiness = buildReadiness({ automation, orchestration, resilience });
  return {
    generatedAt: now,
    roadmapPackages: ROADMAP_PACKAGES,
    summary: {
      roadmapPackagesComplete: ROADMAP_PACKAGES.length,
      automationPilots: automation.summary.pilot,
      activeAutomations: automation.summary.active,
      workflowDefinitions: orchestration.summary.configured,
      activeWorkflowRuns: orchestration.summary.activeRuns,
      blockingDependencies: orchestration.summary.blockingDependencies,
      approvedResilienceObjectives: resilience.summary.approved,
      automationDecision: readiness.automation.decision,
      orchestrationDecision: readiness.orchestration.decision,
      resilienceDecision: readiness.resilience.decision,
    },
    automation,
    orchestration,
    resilience,
    akuso: AKUSO_ORCHESTRATION_BEHAVIOR,
    readiness,
    dataLimits: {
      automationIsCausalProof: false,
      highRiskActionAutonomous: false,
      workflowStateOwnedByAkuso: false,
      failedDependencyCanProgressSilently: false,
      privateFanRowsExposed: false,
      sloImpliesObservedReliability: false,
    },
  };
};

const buildAutomationOrchestrationOperatingSystem = async (filters = {}) => {
  const dates = buildDateRange(filters);
  const historyStart = new Date(dates.start.getTime() - 180 * DAY_MS);
  const [automationRows, automationRunRows, workflowDefinitionRows, workflowRunRows, resilienceRows] = await Promise.all([
    AutomationRegistryEntry.find({ createdAt: { $lte: dates.end } }).sort({ reviewAt: 1 }).limit(2000).lean(),
    AutomationRun.find({ triggeredAt: { $gte: historyStart, $lte: dates.end } }).sort({ triggeredAt: -1 }).limit(5000).lean(),
    WorkflowDefinition.find({ createdAt: { $lte: dates.end } }).sort({ reviewAt: 1 }).limit(2000).lean(),
    WorkflowRun.find({ startedAt: { $gte: historyStart, $lte: dates.end } }).sort({ startedAt: -1 }).limit(5000).lean(),
    ResilienceObjective.find({ createdAt: { $lte: dates.end } }).sort({ recoveryPriority: 1 }).limit(100).lean(),
  ]);
  return buildAutomationOrchestrationOperatingView({ automationRows, automationRunRows, workflowDefinitionRows, workflowRunRows, resilienceRows, now: new Date() });
};

const transitionAutomationControl = async ({ automationId, updates = {}, adminUserId } = {}) => {
  assertObjectId(automationId, "Automation registry id");
  assertObjectId(adminUserId, "Admin user id");
  const row = await AutomationRegistryEntry.findById(automationId);
  if (!row) throw errorWithStatus("Automation registry entry not found", 404);
  const reason = requireReason(updates.reason);
  const nextState = normalizeKey(updates.state === undefined ? row.state : updates.state);
  const allowedTransitions = {
    proposed: ["designed", "review_required", "retired"],
    designed: ["review_required", "pilot", "paused", "retired"],
    review_required: ["pilot", "paused", "retired"],
    pilot: ["active", "paused", "rolled_back", "retired"],
    active: ["paused", "rolled_back", "retired"],
    paused: ["pilot", "active", "rolled_back", "retired"],
    rolled_back: ["designed", "retired"],
    retired: [],
  };
  if (nextState !== row.state && !(allowedTransitions[row.state] || []).includes(nextState)) throw errorWithStatus(`Automation cannot transition from ${row.state} to ${nextState}`, 409);
  for (const key of ["riskClass", "workflowDomain", "runbookPath", "userControls", "rolloutPercent", "rollbackTestedAt", "guardrailBreach", "scaleDecision", "scaleDecisionReason", "outcomeEvidence", "reviewAt"]) {
    if (updates[key] !== undefined) row[key] = ["riskClass", "workflowDomain", "scaleDecision"].includes(key) ? normalizeKey(updates[key]) : updates[key];
  }
  if (updates.approvePilot === true) {
    row.pilotApprovedBy = adminUserId;
    row.pilotApprovedAt = new Date();
    if (!(row.approvedBy || []).some((value) => idOf(value) === idOf(adminUserId))) row.approvedBy.push(adminUserId);
  }
  if (updates.scaleDecision !== undefined) {
    row.scaleDecisionBy = adminUserId;
    row.scaleDecisionAt = new Date();
  }
  row.state = row.guardrailBreach ? "paused" : nextState;
  row.lastChangedBy = adminUserId;
  row.history.push({ state: row.state, actorId: adminUserId, reason });
  try {
    await row.save();
  } catch (error) {
    if (error?.name === "ValidationError") throw errorWithStatus(error.message, 409);
    throw error;
  }
  return serializeAutomationControl(row.toObject());
};

const createAutomationRun = async ({ payload = {}, adminUserId } = {}) => {
  assertObjectId(adminUserId, "Admin user id");
  assertObjectId(payload.automationId, "Automation registry id");
  const automation = await AutomationRegistryEntry.findById(payload.automationId).lean();
  if (!automation) throw errorWithStatus("Automation registry entry not found", 404);
  const riskClass = normalizeKey(payload.riskClass || automation.riskClass || "suggestion");
  const status = normalizeKey(payload.status || (riskClass === "prohibited_action" ? "blocked_prohibited" : "triggered"));
  if (riskClass !== "prohibited_action" && !["pilot", "active"].includes(automation.state)) throw errorWithStatus("Automation runs require a governed pilot or active registry state", 409);
  if (payload.affectedUser) assertObjectId(payload.affectedUser, "Affected user id");
  if (payload.creatorProfile) assertObjectId(payload.creatorProfile, "Creator profile id");
  const row = await AutomationRun.create({
    runKey: String(payload.runKey || `${automation.automationKey}_${crypto.randomBytes(6).toString("hex")}`).trim().toLowerCase(),
    automationRegistry: automation._id, automationKey: automation.automationKey,
    workflowDomain: normalizeKey(payload.workflowDomain || automation.workflowDomain || "operations"),
    affectedActor: normalizeKey(payload.affectedActor || automation.actorAffected || "system"),
    affectedUser: payload.affectedUser || null, creatorProfile: payload.creatorProfile || null,
    riskClass, status, triggerSummary: String(payload.triggerSummary || automation.trigger || "").trim(),
    sourceSignals: valuesFrom(payload.sourceSignals, (signal) => ({
      key: normalizeKey(signal.key), sourceAuthority: String(signal.sourceAuthority || "").trim(),
      observedAt: signal.observedAt || new Date(), confidence: signal.confidence ?? null,
    })),
    actionSummary: String(payload.actionSummary || "").trim(),
    userVisibleMessage: String(payload.userVisibleMessage || "").trim(),
    ownerName: String(payload.ownerName || automation.ownerName || "").trim(),
    ownerRole: String(payload.ownerRole || automation.ownerRole || "").trim(),
    runbookPath: String(payload.runbookPath || automation.runbookPath || "").trim(),
    humanReviewRequired: riskClass === "review_gated_action" || Boolean(payload.humanReviewRequired),
    review: riskClass === "review_gated_action" ? { decision: "pending" } : { decision: "not_required" },
    outcome: payload.outcome || {}, incidentRefs: valuesFrom(payload.incidentRefs, String),
    triggeredAt: payload.triggeredAt || new Date(), createdBy: adminUserId,
    history: [{ status, actorId: adminUserId, reason: "Governed automation run recorded from authoritative signals" }],
  });
  return serializeAutomationRun(row.toObject());
};

const updateAutomationRun = async ({ runId, updates = {}, adminUserId } = {}) => {
  assertObjectId(runId, "Automation run id");
  assertObjectId(adminUserId, "Admin user id");
  const row = await AutomationRun.findById(runId);
  if (!row) throw errorWithStatus("Automation run not found", 404);
  const reason = requireReason(updates.reason);
  for (const key of ["status", "outcome", "pauseReason", "rollbackReason", "incidentRefs", "feedback", "feedbackNote", "completedAt"]) {
    if (updates[key] !== undefined) row[key] = key === "status" ? normalizeKey(updates[key]) : updates[key];
  }
  if (updates.reviewDecision !== undefined) {
    row.review = {
      decision: normalizeKey(updates.reviewDecision), reviewedBy: adminUserId, reviewedAt: new Date(), reason,
    };
  }
  row.lastChangedBy = adminUserId;
  row.history.push({ status: row.status, actorId: adminUserId, reason });
  await row.save();
  return serializeAutomationRun(row.toObject());
};

const updateAutomationRunUserControl = async ({ runId, userId, updates = {} } = {}) => {
  assertObjectId(runId, "Automation run id");
  assertObjectId(userId, "User id");
  const row = await AutomationRun.findOne({ _id: runId, affectedUser: userId });
  if (!row) throw errorWithStatus("Automation run not found", 404);
  const state = normalizeKey(updates.state);
  if (!AutomationRun.USER_CONTROL_STATES.includes(state)) throw errorWithStatus("User control state is invalid", 400);
  row.userControlState = state;
  row.feedback = updates.feedback === undefined ? row.feedback : normalizeKey(updates.feedback);
  row.feedbackNote = updates.feedbackNote === undefined ? row.feedbackNote : String(updates.feedbackNote || "").trim();
  if (state === "snoozed") {
    const snoozedUntil = asDate(updates.snoozedUntil);
    if (!snoozedUntil || snoozedUntil <= new Date() || snoozedUntil > new Date(Date.now() + (30 * DAY_MS))) throw errorWithStatus("Snooze must end within the next 30 days", 400);
    row.snoozedUntil = snoozedUntil;
  } else row.snoozedUntil = null;
  row.lastChangedBy = userId;
  await row.save();
  return serializeAutomationRun(row.toObject(), { external: true });
};

const createWorkflowDefinition = async ({ payload = {}, adminUserId } = {}) => {
  assertObjectId(adminUserId, "Admin user id");
  const workflowKey = normalizeKey(payload.workflowKey);
  const catalog = WORKFLOW_CATALOG.find((row) => row.key === workflowKey);
  if (!catalog) throw errorWithStatus("Workflow key is not in the governed orchestration catalog", 400);
  const lifecycle = normalizeKey(payload.lifecycle || "draft");
  const row = await WorkflowDefinition.create({
    workflowKey, title: String(payload.title || workflowKey.replace(/_/g, " ")).trim(),
    workflowDomain: catalog.domain, ownerName: String(payload.ownerName || "").trim(),
    ownerRole: String(payload.ownerRole || "Workflow owner").trim(),
    participantTeams: valuesFrom(payload.participantTeams, normalizeKey), affectedUserType: catalog.affectedUserType,
    startTrigger: String(payload.startTrigger || "").trim(),
    dependencies: valuesFrom(payload.dependencies, (dependency) => ({
      type: normalizeKey(dependency.type), sourceSystem: String(dependency.sourceSystem || "").trim(),
      ownerName: String(dependency.ownerName || "").trim(), passCondition: String(dependency.passCondition || "").trim(),
      staleCondition: String(dependency.staleCondition || "").trim(), overridePolicy: String(dependency.overridePolicy || "").trim(),
      escalationPath: String(dependency.escalationPath || "").trim(), userVisibleCopy: String(dependency.userVisibleCopy || "").trim(),
    })),
    approvalGates: valuesFrom(payload.approvalGates, String), automationChecks: valuesFrom(payload.automationChecks, normalizeKey),
    humanReviewGates: valuesFrom(payload.humanReviewGates, String), escalationRules: valuesFrom(payload.escalationRules, String),
    userVisibleStatuses: valuesFrom(payload.userVisibleStatuses, String), auditEvents: valuesFrom(payload.auditEvents, normalizeKey),
    pauseCondition: String(payload.pauseCondition || "").trim(), rollbackCondition: String(payload.rollbackCondition || "").trim(),
    supportPath: String(payload.supportPath || "").trim(), externalCommunicationRule: String(payload.externalCommunicationRule || "").trim(),
    successMetric: normalizeKey(payload.successMetric), guardrailMetrics: valuesFrom(payload.guardrailMetrics, normalizeKey),
    reviewCadence: normalizeKey(payload.reviewCadence || "weekly"), lifecycle,
    approvedBy: payload.approve === true ? adminUserId : null, approvedAt: payload.approve === true ? new Date() : null,
    rollbackTestedAt: payload.rollbackTestedAt || null, reviewAt: payload.reviewAt,
    createdBy: adminUserId, history: [{ lifecycle, reviewDecision: "unreviewed", actorId: adminUserId, reason: "Governed workflow definition created" }],
  });
  return serializeWorkflowDefinition(row.toObject());
};

const updateWorkflowDefinition = async ({ definitionId, updates = {}, adminUserId } = {}) => {
  assertObjectId(definitionId, "Workflow definition id");
  assertObjectId(adminUserId, "Admin user id");
  const row = await WorkflowDefinition.findById(definitionId);
  if (!row) throw errorWithStatus("Workflow definition not found", 404);
  const reason = requireReason(updates.reason);
  for (const key of ["title", "ownerName", "ownerRole", "participantTeams", "startTrigger", "dependencies", "approvalGates", "automationChecks", "humanReviewGates", "escalationRules", "userVisibleStatuses", "auditEvents", "pauseCondition", "rollbackCondition", "supportPath", "externalCommunicationRule", "successMetric", "guardrailMetrics", "reviewCadence", "lifecycle", "reviewDecision", "reviewEvidence", "rollbackTestedAt", "reviewAt"]) {
    if (updates[key] !== undefined) row[key] = ["lifecycle", "reviewDecision", "successMetric", "reviewCadence"].includes(key) ? normalizeKey(updates[key]) : updates[key];
  }
  if (updates.approve === true) { row.approvedBy = adminUserId; row.approvedAt = new Date(); }
  row.lastChangedBy = adminUserId;
  row.history.push({ lifecycle: row.lifecycle, reviewDecision: row.reviewDecision, actorId: adminUserId, reason });
  await row.save();
  return serializeWorkflowDefinition(row.toObject());
};

const createWorkflowRun = async ({ payload = {}, adminUserId } = {}) => {
  assertObjectId(adminUserId, "Admin user id");
  assertObjectId(payload.definitionId, "Workflow definition id");
  const definition = await WorkflowDefinition.findById(payload.definitionId).lean();
  if (!definition) throw errorWithStatus("Workflow definition not found", 404);
  if (!["pilot", "default"].includes(definition.lifecycle)) throw errorWithStatus("Workflow runs require an approved pilot or default definition", 409);
  if (payload.affectedUser) assertObjectId(payload.affectedUser, "Affected user id");
  if (payload.creatorProfile) assertObjectId(payload.creatorProfile, "Creator profile id");
  const humanReviewRequired = ["partner_api", "finance", "support_trust"].includes(definition.workflowDomain) || (definition.humanReviewGates || []).length > 0;
  const currentState = normalizeKey(payload.currentState || "preflight");
  const row = await WorkflowRun.create({
    runKey: String(payload.runKey || `${definition.workflowKey}_${crypto.randomBytes(6).toString("hex")}`).trim().toLowerCase(),
    workflowDefinition: definition._id, workflowKey: definition.workflowKey, workflowDomain: definition.workflowDomain,
    affectedUserType: definition.affectedUserType, affectedUser: payload.affectedUser || null,
    creatorProfile: payload.creatorProfile || null, ownerName: definition.ownerName, ownerRole: definition.ownerRole,
    currentState, dependencies: (definition.dependencies || []).map((dependency) => ({
      type: dependency.type, ownerName: dependency.ownerName, state: "pending", evidenceRef: "",
      userVisibleCopy: dependency.userVisibleCopy, override: { status: "none" },
    })),
    humanReviewRequired, approval: { status: humanReviewRequired ? "pending" : "not_required" },
    userVisibleStatus: String(payload.userVisibleStatus || "Preflight checks are in progress.").trim(),
    waitingOn: String(payload.waitingOn || "Tengacion review").trim(), nextStep: String(payload.nextStep || "Wait for the next status update.").trim(),
    supportPath: definition.supportPath, expectedAt: payload.expectedAt || null, startedAt: payload.startedAt || new Date(),
    createdBy: adminUserId, history: [{ state: currentState, actorId: adminUserId, reason: "Orchestrated workflow run created" }],
  });
  return serializeWorkflowRun(row.toObject());
};

const updateWorkflowRun = async ({ runId, updates = {}, adminUserId } = {}) => {
  assertObjectId(runId, "Workflow run id");
  assertObjectId(adminUserId, "Admin user id");
  const row = await WorkflowRun.findById(runId);
  if (!row) throw errorWithStatus("Workflow run not found", 404);
  const reason = requireReason(updates.reason);
  for (const dependencyUpdate of valuesFrom(updates.dependencyUpdates)) {
    const dependency = row.dependencies.find((entry) => entry.type === normalizeKey(dependencyUpdate.type));
    if (!dependency) throw errorWithStatus(`Dependency ${dependencyUpdate.type} is not part of this workflow`, 400);
    if (dependencyUpdate.state !== undefined) dependency.state = normalizeKey(dependencyUpdate.state);
    if (dependencyUpdate.evidenceRef !== undefined) dependency.evidenceRef = String(dependencyUpdate.evidenceRef || "").trim();
    if (dependencyUpdate.observedAt !== undefined) dependency.observedAt = dependencyUpdate.observedAt;
    if (dependencyUpdate.expiresAt !== undefined) dependency.expiresAt = dependencyUpdate.expiresAt;
    if (dependencyUpdate.overrideStatus !== undefined) {
      const overrideStatus = normalizeKey(dependencyUpdate.overrideStatus);
      dependency.override.status = overrideStatus;
      dependency.override.reason = reason;
      if (overrideStatus === "requested") {
        dependency.override.requestedBy = adminUserId;
        dependency.override.requestedAt = new Date();
      }
      if (["approved", "rejected"].includes(overrideStatus)) {
        dependency.override.approvedBy = adminUserId;
        dependency.override.decidedAt = new Date();
        dependency.override.expiresAt = dependencyUpdate.overrideExpiresAt || null;
        if (overrideStatus === "approved") dependency.state = "overridden";
      }
    }
  }
  for (const key of ["currentState", "userVisibleStatus", "waitingOn", "nextStep", "expectedAt", "pauseReason", "rollbackReason", "incidentRef", "metrics", "completedAt"]) {
    if (updates[key] !== undefined) row[key] = key === "currentState" ? normalizeKey(updates[key]) : updates[key];
  }
  if (updates.approvalStatus !== undefined) {
    row.approval = { status: normalizeKey(updates.approvalStatus), gate: String(updates.approvalGate || row.approval?.gate || "").trim(), reviewedBy: adminUserId, reviewedAt: new Date(), reason };
  }
  if (row.metrics?.guardrailBreach) { row.currentState = "paused"; row.pauseReason = row.pauseReason || "Guardrail breach recorded"; }
  row.lastChangedBy = adminUserId;
  row.history.push({ state: row.currentState, actorId: adminUserId, reason });
  await row.save();
  return serializeWorkflowRun(row.toObject());
};

const updateWorkflowRunUserControl = async ({ runId, userId, updates = {} } = {}) => {
  assertObjectId(runId, "Workflow run id");
  assertObjectId(userId, "User id");
  const row = await WorkflowRun.findOne({ _id: runId, affectedUser: userId });
  if (!row) throw errorWithStatus("Workflow run not found", 404);
  const state = normalizeKey(updates.state);
  if (!WorkflowRun.WORKFLOW_USER_CONTROL_STATES.includes(state)) throw errorWithStatus("Workflow user control state is invalid", 400);
  row.userControlState = state;
  if (state === "snoozed") {
    const snoozedUntil = asDate(updates.snoozedUntil);
    if (!snoozedUntil || snoozedUntil <= new Date() || snoozedUntil > new Date(Date.now() + (30 * DAY_MS))) throw errorWithStatus("Snooze must end within the next 30 days", 400);
    row.snoozedUntil = snoozedUntil;
  } else row.snoozedUntil = null;
  row.lastChangedBy = userId;
  await row.save();
  return serializeWorkflowRun(row.toObject(), { external: true });
};

const upsertResilienceObjective = async ({ flowKey, payload = {}, adminUserId } = {}) => {
  assertObjectId(adminUserId, "Admin user id");
  const normalizedFlowKey = normalizeKey(flowKey || payload.flowKey);
  if (!ResilienceObjective.CRITICAL_FLOW_KEYS.includes(normalizedFlowKey)) throw errorWithStatus("Critical flow key is invalid", 400);
  const reason = requireReason(payload.reason);
  let row = await ResilienceObjective.findOne({ flowKey: normalizedFlowKey });
  if (!row) row = new ResilienceObjective({ flowKey: normalizedFlowKey, createdBy: adminUserId, history: [] });
  for (const key of ["ownerName", "ownerRole", "measurementSource", "availabilityTarget", "latencyTargetMs", "errorBudgetMinutes", "maximumDowntimeMinutes", "maximumDataDelayMinutes", "maximumEntitlementDelayMinutes", "maximumPayoutQueueAgeMinutes", "maximumPartnerReportDelayMinutes", "recoveryPriority", "pauseTrigger", "rollbackTrigger", "status", "reviewAt"]) {
    if (payload[key] !== undefined) row[key] = key === "status" ? normalizeKey(payload[key]) : payload[key];
  }
  if (payload.approve === true || row.status === "approved") { row.reviewedBy = adminUserId; row.reviewedAt = new Date(); }
  row.lastChangedBy = adminUserId;
  row.history.push({ status: row.status || "draft", actorId: adminUserId, reason });
  await row.save();
  return serializeResilienceObjective(row.toObject());
};

const buildCreatorAutomationOrchestrationForProfile = async ({ profileId, userId, now = new Date() } = {}) => {
  assertObjectId(profileId, "Creator profile id");
  assertObjectId(userId, "User id");
  const [automationRows, workflowRows] = await Promise.all([
    AutomationRun.find({ affectedUser: userId, creatorProfile: profileId, userControlState: { $ne: "hidden" }, triggeredAt: { $lte: now } }).sort({ triggeredAt: -1 }).limit(30).lean(),
    WorkflowRun.find({ affectedUser: userId, creatorProfile: profileId, userControlState: { $ne: "hidden" }, startedAt: { $lte: now }, currentState: { $nin: ["retired"] } }).sort({ startedAt: -1 }).limit(30).lean(),
  ]);
  const automations = automationRows.filter((row) => row.userControlState !== "snoozed" || !asDate(row.snoozedUntil) || asDate(row.snoozedUntil) <= now).map((row) => serializeAutomationRun(row, { external: true }));
  const workflows = workflowRows.filter((row) => row.userControlState !== "snoozed" || !asDate(row.snoozedUntil) || asDate(row.snoozedUntil) <= now).map((row) => serializeWorkflowRun(row, { external: true, now }));
  return {
    automations, workflows,
    summary: {
      visibleAutomations: automations.length, activeWorkflows: workflows.filter((row) => !["completed", "rolled_back"].includes(row.currentState)).length,
      blockedWorkflows: workflows.filter((row) => row.currentState === "blocked").length,
    },
    controls: { automation: ["dismissed", "snoozed", "hidden", "help_requested"], workflow: WorkflowRun.WORKFLOW_USER_CONTROL_STATES },
    privacyBoundary: "Creators receive calm status, source labels, blockers, and next steps for their own records only. Internal risk details, other users, private fan behavior, and restricted partner evidence are excluded.",
    authorityBoundary: "Creator controls change visibility or request help; they do not approve workflow transitions, bypass dependencies, move money, or grant access.",
  };
};

module.exports = {
  AKUSO_ORCHESTRATION_BEHAVIOR,
  AUTOMATION_CANDIDATES,
  AUTOMATION_INCIDENT_PLAYBOOKS,
  AUTOMATION_RISK_POLICY,
  CRITICAL_FLOW_CATALOG,
  DEPENDENCY_CATALOG,
  ROADMAP_PACKAGES,
  WORKFLOW_CATALOG,
  buildAutomationDashboard,
  buildAutomationOrchestrationOperatingSystem,
  buildAutomationOrchestrationOperatingView,
  buildCreatorAutomationOrchestrationForProfile,
  buildOrchestrationDashboard,
  buildResilienceDashboard,
  createAutomationRun,
  createWorkflowDefinition,
  createWorkflowRun,
  serializeAutomationControl,
  serializeAutomationRun,
  serializeResilienceObjective,
  serializeWorkflowDefinition,
  serializeWorkflowRun,
  transitionAutomationControl,
  updateAutomationRun,
  updateAutomationRunUserControl,
  updateWorkflowDefinition,
  updateWorkflowRun,
  updateWorkflowRunUserControl,
  upsertResilienceObjective,
};
