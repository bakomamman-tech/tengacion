const crypto = require("crypto");
const mongoose = require("mongoose");

const AutomationRegistryEntry = require("../models/AutomationRegistryEntry");
const CreatorIntelligencePrompt = require("../models/CreatorIntelligencePrompt");
const CreatorProfile = require("../models/CreatorProfile");
const IntelligenceProduct = require("../models/IntelligenceProduct");
const MetricContract = require("../models/MetricContract");
const NetworkProgramEnrollment = require("../models/NetworkProgramEnrollment");
const PartnerAccessGraduation = require("../models/PartnerAccessGraduation");
const PartnerIntegration = require("../models/PartnerIntegration");
const PredictiveWarning = require("../models/PredictiveWarning");
const { buildDateRange } = require("./analyticsService");
const { buildEcosystemNetworkOperatingSystem } = require("./ecosystemNetworkOperatingService");

const DAY_MS = 24 * 60 * 60 * 1000;
const PROTECTED_PARTNER_FIELDS = Object.freeze([
  "payment_identifiers",
  "private_user_behavior",
  "identity_verification",
  "moderation_sensitive_detail",
]);

const ROADMAP_PACKAGES = Object.freeze([
  ["NETWORK-002", "Fan community and advocacy loops"],
  ["NETWORK-003", "Partner and channel integration graduation"],
  ["NETWORK-004", "Network finance and settlement blueprint"],
  ["NETWORK-005", "Network data products and Akuso grounding"],
  ["NETWORK-006", "Creator business network program pilots"],
  ["NETWORK-007", "Controlled fan community loops"],
  ["NETWORK-008", "First scoped partner or channel integration"],
  ["NETWORK-009", "Network finance and settlement reporting"],
  ["NETWORK-010", "Akuso network workflows"],
  ["NETWORK-011", "Creator business network pilot review"],
  ["NETWORK-012", "Fan community and advocacy health"],
  ["NETWORK-013", "Partner and API governance"],
  ["NETWORK-014", "Network intelligence dashboard"],
  ["NETWORK-015", "Network readiness report"],
  ["INTELLIGENCE-001", "Metric contracts and trust states"],
  ["INTELLIGENCE-002", "Governed intelligence products"],
  ["INTELLIGENCE-003", "Creator intelligence surfaces"],
  ["INTELLIGENCE-004", "Partner, API, and export intelligence"],
  ["INTELLIGENCE-005", "Akuso intelligence behavior"],
  ["INTELLIGENCE-006", "Trusted intelligence dashboard"],
  ["INTELLIGENCE-007", "Creator intelligence pilot"],
  ["INTELLIGENCE-008", "Fan and community intelligence tuning"],
  ["INTELLIGENCE-009", "Partner and API readiness scoring"],
  ["INTELLIGENCE-010", "Akuso intelligence summaries with gates"],
  ["INTELLIGENCE-011", "Intelligence product review"],
  ["INTELLIGENCE-012", "Broadened creator intelligence controls"],
  ["INTELLIGENCE-013", "Partner, export, dashboard, and API graduation"],
  ["INTELLIGENCE-014", "Predictive operations hardening"],
  ["INTELLIGENCE-015", "Intelligence readiness report"],
  ["AUTOMATION-001", "Automation registry"],
].map(([key, title]) => ({ key, title, status: "COMPLETE" })));

const NETWORK_PROGRAM_CATALOG = Object.freeze([
  ["catalog_collaboration", "Catalog collaboration", "catalog_quality_and_incremental_earnings"],
  ["launch_collaboration", "Launch collaboration", "launch_completion_and_incremental_paid_actions"],
  ["shared_campaign", "Shared campaign", "campaign_conversion_with_margin_guardrails"],
  ["service_provider_program", "Service provider program", "creator_outcome_net_of_provider_and_support_cost"],
  ["community_activation", "Community activation", "aggregate_fan_movement_with_complaint_guardrails"],
  ["partner_opportunity", "Partner opportunity", "creator_value_with_consent_and_reconciled_finance"],
].map(([key, title, successMetric]) => ({
  key,
  title,
  successMetric,
  consentRequired: true,
  separateEffects: ["creator_actions", "collaborator_actions", "provider_actions", "partner_actions"],
  financeBoundary: "Each purchase, earning, fee, refund, payout, and settlement remains attributable to its existing ledger authority.",
})));

const METRIC_CONTRACT_CATALOG = Object.freeze([
  ["gmv", "Gross merchandise value", "Revenue ledger"],
  ["creator_earnings", "Creator earnings", "Revenue ledger"],
  ["platform_commission", "Platform commission", "Revenue ledger"],
  ["service_revenue", "Creator service revenue", "Revenue ledger and service terms"],
  ["partner_revenue", "Partner revenue", "Revenue ledger and partner contract"],
  ["sponsor_revenue", "Sponsor revenue", "Revenue ledger and sponsor contract"],
  ["contribution_margin", "Contribution margin", "Reconciled revenue and instrumented costs"],
  ["payout_status", "Payout status", "Payout request and provider authorities"],
  ["refund_dispute_rate", "Refund and dispute rate", "Purchase and dispute authorities"],
  ["creator_program_outcomes", "Creator program outcomes", "Network and service program records"],
  ["fan_lifecycle", "Fan lifecycle movement", "Aggregate analytics events"],
  ["community_participation", "Community participation", "Aggregate community loop events"],
  ["recommendation_trust", "Recommendation trust", "Recommendation diagnostics"],
  ["support_moderation_load", "Support and moderation load", "Support and moderation queues"],
  ["akuso_quality", "Akuso quality", "Assistant eval release gate"],
].map(([key, title, defaultSource]) => ({
  key,
  title,
  defaultSource,
  requiredFields: ["owner", "source_authorities", "calculation", "freshness", "limitations", "privacy", "decision", "export_policy"],
})));

const INTELLIGENCE_PRODUCT_CATALOG = Object.freeze([
  ["creator_opportunity", "Creator opportunity", "creator"],
  ["creator_benchmark", "Creator benchmark", "creator"],
  ["catalog_health", "Catalog health", "creator"],
  ["fan_community_health", "Fan community health", "internal"],
  ["lifecycle_movement", "Lifecycle movement", "internal"],
  ["partner_readiness", "Partner readiness", "partner"],
  ["api_candidate_readiness", "API candidate readiness", "api_candidate"],
  ["margin_confidence", "Margin confidence", "internal"],
  ["support_moderation_risk_forecast", "Support and moderation risk forecast", "internal"],
  ["akuso_intelligence_quality", "Akuso intelligence quality", "akuso"],
].map(([key, title, defaultAudience]) => ({ key, title, defaultAudience })));

const FAN_ADVOCACY_LOOPS = Object.freeze([
  "supporter_club",
  "milestone_celebration",
  "high_satisfaction_referral",
  "live_follow_up",
  "saved_completion",
  "renewal_recovery",
  "fan_campaign_share",
  "similar_creator_discovery",
].map((key) => ({
  key,
  creatorVisibleSignals: ["aggregate_movement", "opt_in_totals", "campaign_performance", "privacy_safe_referral_totals"],
  suppressionSignals: ["frequency_cap", "ignored_streak", "abuse", "creator_message_volume", "complaint", "sensitive_category", "refund_or_dispute", "dormant_or_at_risk"],
  privateFanRowsExposed: false,
})));

const PREDICTIVE_WARNING_CATALOG = Object.freeze([
  "support_backlog",
  "moderation_sla",
  "payout_queue",
  "entitlement_failure",
  "export_failure",
  "api_error_or_abuse",
  "takedown_surge",
  "recommendation_complaint",
  "akuso_eval_regression",
  "data_freshness",
].map((key) => ({ key, decisionAuthority: "warning_only", humanReviewRequired: true })));

const AKUSO_INTELLIGENCE_BEHAVIOR = Object.freeze({
  requiredContext: ["source", "timeframe", "confidence", "limitations"],
  visibleTrustStates: ["trusted", "watch", "stale", "disputed", "blocked"],
  prohibited: ["invent_private_data", "approve_sensitive_action", "grant_partner_access", "approve_api", "move_money", "activate_automation"],
  summaries: ["creator_opportunity", "catalog_health", "community_health", "partner_readiness", "finance_caveat", "support_moderation_risk", "data_quality"],
  evalSuites: ["source_quality", "low_confidence", "private_fan_refusal", "finance_refusal", "api_refusal", "unsupported_automation", "stale_warning"],
  executionAuthority: "none",
});

const NETWORK_FINANCE_BLUEPRINT = Object.freeze({
  dimensions: ["creator", "service_program", "external_provider", "fan_cohort", "partner", "sponsor", "campaign", "offer", "market_or_community", "acquisition_channel"],
  measures: ["gmv", "creator_earnings", "platform_commission", "service_fees", "partner_revenue", "sponsor_revenue", "payment_fees", "refunds", "disputes", "payouts", "provider_settlement", "support_cost", "infrastructure_cost", "model_cost", "contribution_margin"],
  settlementTruth: "The existing ledger and provider settlement authorities remain the source of truth.",
  externalClaimRule: "Block external finance claims whenever reconciliation, provider, payout, partner, campaign, or cost evidence is incomplete.",
});

const normalizeKey = (value = "") => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const idOf = (value) => String(value?._id || value?.id || value || "");
const asDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const round = (value, digits = 4) => Number(Number(value || 0).toFixed(digits));
const ratio = (numerator, denominator) => Number(denominator || 0) > 0 ? round(Number(numerator || 0) / Number(denominator || 0)) : 0;
const buildHttpError = (message, status = 400, details = undefined) => Object.assign(new Error(message), { status, details });
const assertObjectId = (value, label) => {
  if (!mongoose.Types.ObjectId.isValid(String(value || ""))) throw buildHttpError(`${label} is invalid`, 400);
};
const requireReason = (value) => {
  const reason = String(value || "").trim();
  if (!reason) throw buildHttpError("A change reason is required", 400);
  return reason;
};
const findCatalog = (rows, key, label) => {
  const row = rows.find((candidate) => candidate.key === normalizeKey(key));
  if (!row) throw buildHttpError(`${label} is invalid`, 400);
  return row;
};

const serializeNetworkProgram = (row = {}) => {
  const baseline = row.baselineSnapshot || {};
  const outcome = row.outcomeSnapshot || {};
  const hasOutcome = Object.keys(outcome).length > 0;
  return {
    id: idOf(row),
    programKey: row.programKey,
    programType: row.programType,
    creatorProfile: idOf(row.creatorProfile),
    status: row.status,
    ownerName: row.ownerName,
    ownerRole: row.ownerRole,
    creatorBenefit: row.creatorBenefit,
    creatorCommitment: row.creatorCommitment,
    creatorConsentRecorded: Boolean(row.creatorConsentAt),
    collaborators: (row.collaboratorProfileIds || []).map(idOf),
    providerName: row.providerName || "",
    partnerIntegration: idOf(row.partnerIntegration),
    successMetric: row.successMetric,
    stopCondition: row.stopCondition,
    reviewAt: row.reviewAt,
    finance: {
      grossValue: Number(row.grossValue || 0),
      creatorEarnings: Number(row.creatorEarnings || 0),
      providerCost: Number(row.providerCost || 0),
      currency: row.currency || "NGN",
      evidenceState: Number(row.grossValue || 0) > 0 ? "stored_not_necessarily_reconciled" : "not_observed",
    },
    operatingLoad: { supportMinutes: Number(row.supportMinutes || 0) },
    satisfactionScore: row.creatorSatisfactionScore ?? null,
    outcome: {
      evidenceState: hasOutcome ? "observed" : "not_observed",
      baseline,
      snapshot: hasOutcome ? outcome : {},
    },
  };
};

const buildNetworkPrograms = (rows = []) => {
  const programs = rows.map(serializeNetworkProgram);
  const completed = programs.filter((row) => row.status === "completed");
  const reviewed = completed.filter((row) => row.outcome.evidenceState === "observed");
  return {
    catalog: NETWORK_PROGRAM_CATALOG,
    programs,
    summary: {
      configured: programs.length,
      active: programs.filter((row) => row.status === "active").length,
      completed: completed.length,
      outcomeReviewed: reviewed.length,
      creatorConsentMissing: programs.filter((row) => ["consented", "active", "completed"].includes(row.status) && !row.creatorConsentRecorded).length,
      averageSatisfaction: reviewed.length ? round(reviewed.reduce((sum, row) => sum + Number(row.satisfactionScore || 0), 0) / reviewed.length, 2) : null,
    },
    reviewDecisions: ["scale", "repeat_with_changes", "keep_concierge_only", "pause", "retire"],
    attributionBoundary: "Creator, collaborator, provider, partner, campaign, and community effects remain separate; the program record does not claim causality.",
  };
};

const serializeGraduation = (row = {}, now = new Date()) => {
  const gates = PartnerAccessGraduation.PARTNER_GRADUATION_GATES.map((key) => {
    const gate = (row.gates || []).find((candidate) => candidate.key === key);
    return gate ? { key, status: gate.status, evidenceState: gate.evidence && gate.reviewedAt ? "reviewed" : "missing", reviewedAt: gate.reviewedAt } : { key, status: "not_assessed", evidenceState: "missing", reviewedAt: null };
  });
  const ready = gates.filter((gate) => gate.status === "ready" && gate.evidenceState === "reviewed").length;
  const expired = Boolean(asDate(row.expiresAt) && asDate(row.expiresAt) <= now);
  return {
    id: idOf(row),
    integration: idOf(row.integration),
    currentLevel: row.currentLevel,
    proposedLevel: row.proposedLevel,
    status: expired && row.status === "active" ? "expired" : row.status,
    ownerName: row.ownerName,
    ownerRole: row.ownerRole,
    gates,
    summary: { ready, total: gates.length, readinessRate: ratio(ready, gates.length), blockers: gates.filter((gate) => gate.status !== "ready" || gate.evidenceState !== "reviewed").map((gate) => gate.key) },
    allowedData: row.allowedData || [],
    prohibitedData: row.prohibitedData || [],
    humanApprovalRecorded: Boolean(row.approvedBy && row.approvedAt),
    reviewAt: row.reviewAt,
    expiresAt: row.expiresAt,
  };
};

const buildPartnerGraduation = (rows = [], now = new Date()) => {
  const assessments = rows.map((row) => serializeGraduation(row, now));
  return {
    levels: PartnerAccessGraduation.PARTNER_ACCESS_LEVELS,
    requiredGates: PartnerAccessGraduation.PARTNER_GRADUATION_GATES,
    assessments,
    summary: {
      assessed: assessments.length,
      active: assessments.filter((row) => row.status === "active").length,
      approvedApi: assessments.filter((row) => row.proposedLevel === "approved_api_integration" && ["approved", "active"].includes(row.status)).length,
      blocked: assessments.filter((row) => ["blocked", "expired", "revoked"].includes(row.status)).length,
      reviewRequired: assessments.filter((row) => row.status === "review_required").length,
    },
    enthusiasmBoundary: "Commercial interest never substitutes for data-contract, consent, privacy, security, audit, revocation, finance, reliability, rate-limit, rollback, or renewal evidence.",
  };
};

const serializeMetric = (row = {}, now = new Date()) => {
  const observedAt = asDate(row.observedAt);
  const staleAt = observedAt ? new Date(observedAt.getTime() + Number(row.freshnessMinutes || 0) * 60000) : null;
  const derivedTrustState = row.trustState === "trusted" && staleAt && staleAt <= now ? "stale" : row.trustState;
  return {
    id: idOf(row),
    metricKey: row.metricKey,
    title: row.title,
    ownerName: row.ownerName,
    ownerRole: row.ownerRole,
    sourceAuthorities: row.sourceAuthorities || [],
    calculation: row.calculation,
    freshnessMinutes: Number(row.freshnessMinutes || 0),
    limitations: row.limitations,
    privacyClass: row.privacyClass,
    decisionsAllowed: row.decisionsAllowed || [],
    exportPolicy: row.exportPolicy,
    trustState: derivedTrustState,
    storedTrustState: row.trustState,
    trustReason: row.trustReason,
    observedAt: row.observedAt,
    reviewedAt: row.reviewedAt,
    reviewAt: row.reviewAt,
    staleAt,
    withdrawn: Boolean(row.withdrawnAt),
    canDriveDecision: derivedTrustState === "trusted" && !row.withdrawnAt,
  };
};

const buildMetricContracts = (rows = [], now = new Date()) => {
  const records = rows.map((row) => serializeMetric(row, now));
  const byKey = new Map(records.map((row) => [row.metricKey, row]));
  const contracts = METRIC_CONTRACT_CATALOG.map((definition) => ({
    ...definition,
    ...(byKey.get(definition.key) || { metricKey: definition.key, trustState: "blocked", trustReason: "Metric contract is not configured", canDriveDecision: false }),
    configured: byKey.has(definition.key),
  }));
  return {
    catalog: METRIC_CONTRACT_CATALOG,
    contracts,
    summary: {
      required: METRIC_CONTRACT_CATALOG.length,
      configured: contracts.filter((row) => row.configured).length,
      trusted: contracts.filter((row) => row.trustState === "trusted").length,
      watch: contracts.filter((row) => row.trustState === "watch").length,
      stale: contracts.filter((row) => row.trustState === "stale").length,
      disputed: contracts.filter((row) => row.trustState === "disputed").length,
      blocked: contracts.filter((row) => row.trustState === "blocked").length,
    },
    decisionBoundary: "Only trusted, fresh, non-withdrawn contracts may drive a governed recommendation. Watch, stale, disputed, and blocked metrics remain visible but non-authoritative.",
  };
};

const serializeProduct = (row = {}, metricByKey = new Map()) => {
  const metricStates = (row.sourceMetricKeys || []).map((key) => metricByKey.get(key)?.trustState || "blocked");
  const sourceTrustEvaluated = metricByKey.size > 0;
  const sourceBlocked = sourceTrustEvaluated && metricStates.some((state) => ["stale", "disputed", "blocked"].includes(state));
  return {
    id: idOf(row),
    productKey: row.productKey,
    title: row.title,
    audience: row.audience,
    ownerName: row.ownerName,
    ownerRole: row.ownerRole,
    cadence: row.cadence,
    sourceMetricKeys: row.sourceMetricKeys || [],
    sourceTrustStates: metricStates,
    confidencePolicy: row.confidencePolicy,
    privacyPolicy: row.privacyPolicy,
    permittedActions: row.permittedActions || [],
    reviewerRole: row.reviewerRole,
    withdrawalPath: row.withdrawalPath,
    status: sourceBlocked && row.status === "active" ? "paused_by_source_trust" : row.status,
    storedStatus: row.status,
    confidence: row.confidence ?? null,
    qualityState: sourceBlocked ? "blocked" : row.qualityState,
    reviewAt: row.reviewAt,
    humanApprovalRecorded: Boolean(row.approvedBy && row.approvedAt),
    withdrawn: Boolean(row.withdrawnAt),
  };
};

const buildIntelligenceProducts = (rows = [], metricContracts = {}) => {
  const metricByKey = new Map((metricContracts.contracts || []).map((row) => [row.metricKey, row]));
  const records = rows.map((row) => serializeProduct(row, metricByKey));
  const byKey = new Map(records.map((row) => [row.productKey, row]));
  const products = INTELLIGENCE_PRODUCT_CATALOG.map((definition) => ({
    ...definition,
    ...(byKey.get(definition.key) || { productKey: definition.key, audience: definition.defaultAudience, status: "not_configured", qualityState: "blocked" }),
    configured: byKey.has(definition.key),
  }));
  return {
    catalog: INTELLIGENCE_PRODUCT_CATALOG,
    products,
    summary: {
      required: products.length,
      configured: products.filter((row) => row.configured).length,
      active: products.filter((row) => row.status === "active").length,
      pilots: products.filter((row) => row.status === "pilot").length,
      pausedOrWithdrawn: products.filter((row) => ["paused", "paused_by_source_trust", "withdrawn"].includes(row.status)).length,
      sourceBlocked: products.filter((row) => row.qualityState === "blocked").length,
    },
    reviewDecisions: ["internal_only", "creator_visible", "partner_visible", "api_candidate", "automation_candidate", "pause", "retire"],
  };
};

const serializePrompt = (row = {}) => ({
  id: idOf(row),
  promptKey: row.promptKey,
  creatorProfile: idOf(row.creatorProfile),
  intelligenceProduct: idOf(row.intelligenceProduct),
  title: row.title,
  explanation: row.explanation,
  sourceLabel: row.sourceLabel,
  sourceMetricKeys: row.sourceMetricKeys || [],
  timeframeLabel: row.timeframeLabel,
  confidence: Number(row.confidence || 0),
  limitations: row.limitations,
  suggestedAction: row.suggestedAction,
  status: row.status,
  creatorFeedback: row.creatorFeedback || "",
  feedbackNote: row.feedbackNote || "",
  expiresAt: row.expiresAt,
});

const buildCreatorPromptHealth = (rows = []) => {
  const prompts = rows.map(serializePrompt);
  return {
    prompts,
    summary: {
      available: prompts.filter((row) => ["available", "shown"].includes(row.status)).length,
      acted: prompts.filter((row) => ["acted", "completed"].includes(row.status)).length,
      dismissed: prompts.filter((row) => ["dismissed", "hidden"].includes(row.status)).length,
      helpRequested: prompts.filter((row) => row.status === "help_requested").length,
      feedbackRecorded: prompts.filter((row) => row.creatorFeedback).length,
    },
    creatorControls: ["dismiss", "hide", "request_help", "mark_not_relevant", "request_explanation", "review_source"],
  };
};

const serializeWarning = (row = {}) => ({
  id: idOf(row),
  warningKey: row.warningKey,
  warningType: row.warningType,
  ownerName: row.ownerName,
  ownerRole: row.ownerRole,
  sourceMetricKeys: row.sourceMetricKeys || [],
  confidence: Number(row.confidence || 0),
  impact: row.impact,
  runbookPath: row.runbookPath,
  reviewPath: row.reviewPath,
  rollbackPath: row.rollbackPath,
  status: row.status,
  observedAt: row.observedAt,
  reviewAt: row.reviewAt,
  resolvedAt: row.resolvedAt,
  resolutionNote: row.resolutionNote,
  decisionAuthority: "warning_only",
});

const buildPredictiveOperations = (rows = [], now = new Date()) => {
  const warnings = rows.map(serializeWarning);
  return {
    catalog: PREDICTIVE_WARNING_CATALOG,
    warnings,
    summary: {
      open: warnings.filter((row) => ["open", "acknowledged", "investigating"].includes(row.status)).length,
      mitigated: warnings.filter((row) => row.status === "mitigated").length,
      falsePositive: warnings.filter((row) => row.status === "false_positive").length,
      reviewDue: warnings.filter((row) => asDate(row.reviewAt) && asDate(row.reviewAt) <= now).length,
    },
    truthBoundary: "Predictive warnings are hypotheses with confidence and review paths; they never become incidents, restrictions, payouts, removals, or automated actions without authoritative evidence and human review.",
  };
};

const serializeAutomation = (row = {}) => ({
  id: idOf(row),
  automationKey: row.automationKey,
  title: row.title,
  ownerName: row.ownerName,
  ownerRole: row.ownerRole,
  surface: row.surface,
  actorAffected: row.actorAffected,
  trigger: row.trigger,
  inputSignals: row.inputSignals || [],
  actionType: row.actionType,
  riskLevel: row.riskLevel,
  approvalRequirement: row.approvalRequirement,
  auditEvent: row.auditEvent,
  userVisibleStatus: row.userVisibleStatus,
  pauseControl: row.pauseControl,
  rollbackPlan: row.rollbackPlan,
  successMetric: row.successMetric,
  guardrailMetrics: row.guardrailMetrics || [],
  reviewCadence: row.reviewCadence,
  state: row.state,
  reviewAt: row.reviewAt,
  approvalCount: (row.approvedBy || []).length,
  executionAuthority: "none_in_automation_001",
});

const buildAutomationRegistry = (rows = []) => {
  const entries = rows.map(serializeAutomation);
  return {
    states: AutomationRegistryEntry.AUTOMATION_STATES,
    entries,
    summary: {
      registered: entries.length,
      proposed: entries.filter((row) => row.state === "proposed").length,
      designed: entries.filter((row) => row.state === "designed").length,
      reviewRequired: entries.filter((row) => row.state === "review_required").length,
      executionEnabled: 0,
    },
    launchBoundary: "AUTOMATION-001 records and governs candidates only. It grants no execution authority and this service rejects pilot or active state transitions.",
  };
};

const buildNetworkReadiness = ({ ecosystem = {}, programs = {}, graduation = {}, metrics = {}, products = {}, warnings = {}, automation = {} } = {}) => {
  const networkBlockers = [];
  if (!Number(programs.summary?.outcomeReviewed || 0)) networkBlockers.push("network_program_outcomes_not_reviewed");
  if (!Number(graduation.summary?.assessed || 0)) networkBlockers.push("partner_graduation_not_assessed");
  if (ecosystem.ecosystem?.finance?.reconciliationState !== "reconciled") networkBlockers.push("network_finance_not_ledger_reconciled");
  if (!Number(ecosystem.ecosystem?.communityLoops?.summary?.withEvidence || 0)) networkBlockers.push("community_advocacy_evidence_missing");
  const intelligenceBlockers = [];
  if (Number(metrics.summary?.configured || 0) < Number(metrics.summary?.required || 0)) intelligenceBlockers.push("metric_contracts_incomplete");
  if (Number(metrics.summary?.stale || 0) + Number(metrics.summary?.disputed || 0) + Number(metrics.summary?.blocked || 0)) intelligenceBlockers.push("metric_trust_blocks_present");
  if (Number(products.summary?.configured || 0) < Number(products.summary?.required || 0)) intelligenceBlockers.push("intelligence_products_incomplete");
  if (Number(warnings.summary?.open || 0)) intelligenceBlockers.push("predictive_warnings_open");
  return {
    network: {
      decision: networkBlockers.length ? "hold_or_repeat_with_measurement" : "leadership_review_ready",
      blockers: networkBlockers,
      sections: ["creator_programs", "fan_advocacy", "partner_graduation", "finance_and_settlement", "data_products", "akuso_quality", "resilience", "open_risks"],
      nextOptions: ["scale", "repeat_with_changes", "keep_concierge_only", "pause", "retire"],
    },
    intelligence: {
      decision: intelligenceBlockers.length ? "hold_for_trusted_evidence" : "leadership_review_ready",
      blockers: intelligenceBlockers,
      sections: ["metric_trust", "intelligence_products", "creator_outcomes", "fan_and_community", "partner_and_api", "finance", "support_and_moderation", "predictive_operations", "akuso_quality", "open_risks"],
      nextOptions: ["broaden_creator_intelligence", "graduate_partner_exports", "limited_api", "automation_candidate", "pause", "retire"],
    },
    automation: {
      decision: Number(automation.summary?.registered || 0) ? "registry_established_no_execution" : "registry_ready_for_candidates",
      executionEnabled: false,
    },
    externalUseBoundary: "Readiness is an internal recommendation. Public, partner, API, finance, or automated use still requires the named authority, reviewed source contract, consent, and revocation path.",
  };
};

const buildNetworkIntelligenceOperatingView = ({
  ecosystem = {},
  networkProgramRows = [],
  graduationRows = [],
  metricRows = [],
  productRows = [],
  promptRows = [],
  warningRows = [],
  automationRows = [],
  now = new Date(),
} = {}) => {
  const networkPrograms = buildNetworkPrograms(networkProgramRows);
  const partnerGraduation = buildPartnerGraduation(graduationRows, now);
  const metricContracts = buildMetricContracts(metricRows, now);
  const intelligenceProducts = buildIntelligenceProducts(productRows, metricContracts);
  const creatorIntelligence = buildCreatorPromptHealth(promptRows);
  const predictiveOperations = buildPredictiveOperations(warningRows, now);
  const automationRegistry = buildAutomationRegistry(automationRows);
  const readiness = buildNetworkReadiness({ ecosystem, programs: networkPrograms, graduation: partnerGraduation, metrics: metricContracts, products: intelligenceProducts, warnings: predictiveOperations, automation: automationRegistry });
  return {
    generatedAt: now,
    summary: {
      roadmapPackagesComplete: ROADMAP_PACKAGES.length,
      activeNetworkPrograms: networkPrograms.summary.active,
      activePartnerGraduations: partnerGraduation.summary.active,
      trustedMetrics: metricContracts.summary.trusted,
      activeIntelligenceProducts: intelligenceProducts.summary.active,
      openPredictiveWarnings: predictiveOperations.summary.open,
      registeredAutomations: automationRegistry.summary.registered,
      networkDecision: readiness.network.decision,
      intelligenceDecision: readiness.intelligence.decision,
      automationDecision: readiness.automation.decision,
    },
    roadmapPackages: ROADMAP_PACKAGES,
    network: {
      programs: networkPrograms,
      fanAdvocacy: {
        loops: FAN_ADVOCACY_LOOPS,
        existingPrograms: ecosystem.ecosystem?.communityLoops || {},
        aggregateOnly: true,
        creatorPauseScopes: ["creator", "cohort", "surface", "loop_type"],
      },
      partnerGraduation,
      financeAndSettlement: {
        ...NETWORK_FINANCE_BLUEPRINT,
        existingFinance: ecosystem.ecosystem?.finance || {},
        reconciliationChecks: ["ledger_to_report", "ledger_to_provider", "ledger_to_payout", "ledger_to_partner", "ledger_to_campaign"],
      },
      dataProducts: INTELLIGENCE_PRODUCT_CATALOG,
      intelligenceDashboard: {
        creatorPrograms: networkPrograms.summary,
        fanAdvocacy: ecosystem.ecosystem?.communityLoops?.summary || {},
        partnerGraduation: partnerGraduation.summary,
        financeState: ecosystem.ecosystem?.finance?.reconciliationState || "not_observed",
        metricTrust: metricContracts.summary,
        openWarnings: predictiveOperations.summary.open,
      },
      akuso: { ...AKUSO_INTELLIGENCE_BEHAVIOR, networkTopics: ["collaboration", "fan_community", "partner_levels", "consent_and_privacy", "finance_caveats", "escalation", "governance"] },
      readinessReport: readiness.network,
    },
    intelligence: {
      metricContracts,
      products: intelligenceProducts,
      creatorSurfaces: {
        prompts: creatorIntelligence,
        creatorUseCases: ["catalog_next_item", "launch", "offer", "subscription", "community", "collaboration", "pricing_preview_metadata_art"],
        adminUseCases: ["creator_stage", "opportunity", "support", "payout", "service_fit", "watchlist"],
        explainable: true,
        reversible: true,
      },
      partnerAndApi: partnerGraduation,
      fanAndCommunity: { aggregateOnly: true, suppressionVisible: true, loops: FAN_ADVOCACY_LOOPS },
      predictiveOperations,
      akuso: AKUSO_INTELLIGENCE_BEHAVIOR,
      dashboard: {
        trustAndFreshness: metricContracts.summary,
        productQuality: intelligenceProducts.summary,
        creator: creatorIntelligence.summary,
        partnerAndApi: partnerGraduation.summary,
        finance: ecosystem.ecosystem?.finance?.reconciliationState || "not_observed",
        risk: predictiveOperations.summary,
      },
      readinessReport: readiness.intelligence,
    },
    automation: { registry: automationRegistry, readinessReport: readiness.automation },
    readiness,
    dataLimits: {
      privateFanRowsExposed: false,
      disputedMetricsCanDriveDecisions: false,
      partnerInterestGrantsAccess: false,
      predictiveWarningsAreTruth: false,
      automationExecutionEnabled: false,
    },
  };
};

const buildNetworkIntelligenceOperatingSystem = async (filters = {}) => {
  const dates = buildDateRange(filters);
  const historyStart = new Date(dates.start.getTime() - 180 * DAY_MS);
  const [ecosystem, networkProgramRows, graduationRows, metricRows, productRows, promptRows, warningRows, automationRows] = await Promise.all([
    buildEcosystemNetworkOperatingSystem(filters),
    NetworkProgramEnrollment.find({ createdAt: { $lte: dates.end }, reviewAt: { $gte: historyStart } }).sort({ reviewAt: 1 }).limit(3000).lean(),
    PartnerAccessGraduation.find({ createdAt: { $lte: dates.end }, expiresAt: { $gte: historyStart } }).sort({ reviewAt: 1 }).limit(1000).lean(),
    MetricContract.find({ createdAt: { $lte: dates.end } }).sort({ metricKey: 1 }).limit(1000).lean(),
    IntelligenceProduct.find({ createdAt: { $lte: dates.end } }).sort({ productKey: 1 }).limit(1000).lean(),
    CreatorIntelligencePrompt.find({ createdAt: { $lte: dates.end }, expiresAt: { $gte: historyStart } }).sort({ createdAt: -1 }).limit(5000).lean(),
    PredictiveWarning.find({ observedAt: { $lte: dates.end }, reviewAt: { $gte: historyStart } }).sort({ reviewAt: 1 }).limit(3000).lean(),
    AutomationRegistryEntry.find({ createdAt: { $lte: dates.end } }).sort({ reviewAt: 1 }).limit(1000).lean(),
  ]);
  return {
    filters: { range: dates.range, startDate: dates.start, endDate: dates.end },
    ...buildNetworkIntelligenceOperatingView({ ecosystem, networkProgramRows, graduationRows, metricRows, productRows, promptRows, warningRows, automationRows, now: new Date() }),
  };
};

const buildCreatorNetworkIntelligenceForProfile = async ({ profileId, userId, now = new Date() } = {}) => {
  assertObjectId(profileId, "Creator profile id");
  assertObjectId(userId, "Creator user id");
  const [programRows, promptRows] = await Promise.all([
    NetworkProgramEnrollment.find({ creatorProfile: profileId, creatorUser: userId }).sort({ reviewAt: 1 }).limit(100).lean(),
    CreatorIntelligencePrompt.find({ creatorProfile: profileId, creatorUser: userId, expiresAt: { $gt: now }, status: { $nin: ["hidden", "expired"] } }).sort({ createdAt: -1 }).limit(50).lean(),
  ]);
  return {
    networkPrograms: buildNetworkPrograms(programRows),
    intelligence: buildCreatorPromptHealth(promptRows),
    privacyBoundary: "Only this creator's program records and explainable prompts are returned. No private fan rows, partner-only data, moderation-sensitive detail, or payment identifiers are exposed.",
    decisionBoundary: "Recommendations are optional, reversible suggestions. They do not change catalog, price, payout, partner access, or account state.",
  };
};

const createNetworkProgram = async ({ payload = {}, adminUserId } = {}) => {
  assertObjectId(adminUserId, "Admin user id");
  assertObjectId(payload.creatorProfileId, "Creator profile id");
  const definition = findCatalog(NETWORK_PROGRAM_CATALOG, payload.programType, "Network program type");
  const profile = await CreatorProfile.findById(payload.creatorProfileId).select("_id userId isCreator").lean();
  if (!profile?.isCreator) throw buildHttpError("Active creator profile not found", 404);
  const status = normalizeKey(payload.status || "candidate");
  const programKey = String(payload.programKey || `${definition.key}_${idOf(profile._id)}_${crypto.randomBytes(3).toString("hex")}`).trim().toLowerCase();
  const row = await NetworkProgramEnrollment.create({
    programKey,
    programType: definition.key,
    creatorProfile: profile._id,
    creatorUser: profile.userId,
    status,
    ownerName: String(payload.ownerName || "").trim(),
    ownerRole: String(payload.ownerRole || "Ecosystem operations").trim(),
    creatorBenefit: String(payload.creatorBenefit || "A bounded creator business outcome with transparent support and finance treatment.").trim(),
    creatorCommitment: String(payload.creatorCommitment || "Review the scope, consent explicitly, complete agreed steps, and review the measured outcome.").trim(),
    collaboratorProfileIds: Array.isArray(payload.collaboratorProfileIds) ? payload.collaboratorProfileIds.filter((id) => mongoose.Types.ObjectId.isValid(String(id))) : [],
    providerName: String(payload.providerName || "").trim(),
    partnerIntegration: mongoose.Types.ObjectId.isValid(String(payload.partnerIntegrationId || "")) ? payload.partnerIntegrationId : null,
    creatorConsentAt: payload.creatorConsentAt || null,
    baselineSnapshot: payload.baselineSnapshot || {},
    grossValue: payload.grossValue || 0,
    creatorEarnings: payload.creatorEarnings || 0,
    providerCost: payload.providerCost || 0,
    supportMinutes: payload.supportMinutes || 0,
    currency: payload.currency || "NGN",
    successMetric: normalizeKey(payload.successMetric || definition.successMetric),
    stopCondition: String(payload.stopCondition || "Pause on creator withdrawal, finance mismatch, trust concern, support overload, or outcome guardrail breach.").trim(),
    reviewAt: payload.reviewAt,
    createdBy: adminUserId,
    history: [{ status, actorId: adminUserId, reason: "Network program record created" }],
  });
  return serializeNetworkProgram(row.toObject());
};

const updateNetworkProgram = async ({ programId, updates = {}, adminUserId } = {}) => {
  assertObjectId(programId, "Network program id");
  assertObjectId(adminUserId, "Admin user id");
  const row = await NetworkProgramEnrollment.findById(programId);
  if (!row) throw buildHttpError("Network program not found", 404);
  const reason = requireReason(updates.reason);
  for (const key of ["status", "ownerName", "ownerRole", "creatorConsentAt", "baselineSnapshot", "outcomeSnapshot", "grossValue", "creatorEarnings", "providerCost", "supportMinutes", "creatorSatisfactionScore", "stopCondition", "reviewAt"]) {
    if (updates[key] !== undefined) row[key] = key === "status" ? normalizeKey(updates[key]) : updates[key];
  }
  if (updates.status !== undefined) row.history.push({ status: row.status, actorId: adminUserId, reason });
  row.lastChangedBy = adminUserId;
  await row.save();
  return serializeNetworkProgram(row.toObject());
};

const defaultPartnerGates = () => PartnerAccessGraduation.PARTNER_GRADUATION_GATES.map((key) => ({ key, status: "not_assessed", evidence: "", reviewedAt: null }));

const createPartnerGraduation = async ({ payload = {}, adminUserId } = {}) => {
  assertObjectId(adminUserId, "Admin user id");
  assertObjectId(payload.integrationId, "Partner integration id");
  const integration = await PartnerIntegration.findById(payload.integrationId).lean();
  if (!integration) throw buildHttpError("Partner integration not found", 404);
  const proposedLevel = normalizeKey(payload.proposedLevel || "api_candidate");
  if (!PartnerAccessGraduation.PARTNER_ACCESS_LEVELS.includes(proposedLevel)) throw buildHttpError("Proposed partner level is invalid", 400);
  const status = normalizeKey(payload.status || "assessing");
  const row = await PartnerAccessGraduation.create({
    integration: integration._id,
    currentLevel: integration.level,
    proposedLevel,
    status,
    ownerName: String(payload.ownerName || integration.ownerName || "").trim(),
    ownerRole: String(payload.ownerRole || integration.ownerRole || "Partnerships and privacy").trim(),
    gates: Array.isArray(payload.gates) && payload.gates.length ? payload.gates : defaultPartnerGates(),
    allowedData: Array.isArray(payload.allowedData) ? payload.allowedData.map(normalizeKey) : integration.allowedData || [],
    prohibitedData: PROTECTED_PARTNER_FIELDS,
    approvalReason: String(payload.approvalReason || "").trim(),
    approvedBy: ["approved", "active"].includes(status) ? adminUserId : null,
    approvedAt: ["approved", "active"].includes(status) ? new Date() : null,
    reviewAt: payload.reviewAt,
    expiresAt: payload.expiresAt,
    createdBy: adminUserId,
    history: [{ status, actorId: adminUserId, reason: "Partner graduation assessment created" }],
  });
  return serializeGraduation(row.toObject());
};

const updatePartnerGraduation = async ({ graduationId, updates = {}, adminUserId } = {}) => {
  assertObjectId(graduationId, "Partner graduation id");
  assertObjectId(adminUserId, "Admin user id");
  const row = await PartnerAccessGraduation.findById(graduationId);
  if (!row) throw buildHttpError("Partner graduation assessment not found", 404);
  const reason = requireReason(updates.reason);
  for (const key of ["status", "proposedLevel", "ownerName", "ownerRole", "gates", "allowedData", "approvalReason", "reviewAt", "expiresAt"]) {
    if (updates[key] !== undefined) row[key] = ["status", "proposedLevel"].includes(key) ? normalizeKey(updates[key]) : updates[key];
  }
  row.prohibitedData = PROTECTED_PARTNER_FIELDS;
  if (["approved", "active"].includes(row.status)) { row.approvedBy = adminUserId; row.approvedAt = new Date(); }
  if (updates.status !== undefined) row.history.push({ status: row.status, actorId: adminUserId, reason });
  row.lastChangedBy = adminUserId;
  await row.save();
  return serializeGraduation(row.toObject());
};

const createMetricContract = async ({ payload = {}, adminUserId } = {}) => {
  assertObjectId(adminUserId, "Admin user id");
  const definition = findCatalog(METRIC_CONTRACT_CATALOG, payload.metricKey, "Metric key");
  const trustState = normalizeKey(payload.trustState || "watch");
  const reason = requireReason(payload.trustReason);
  const row = await MetricContract.create({
    metricKey: definition.key,
    title: String(payload.title || definition.title).trim(),
    ownerName: String(payload.ownerName || "").trim(),
    ownerRole: String(payload.ownerRole || "Data and finance governance").trim(),
    sourceAuthorities: Array.isArray(payload.sourceAuthorities) && payload.sourceAuthorities.length ? payload.sourceAuthorities.map(normalizeKey) : [normalizeKey(definition.defaultSource)],
    calculation: String(payload.calculation || "Document the authoritative numerator, denominator, inclusion rules, exclusions, and currency treatment before use.").trim(),
    freshnessMinutes: payload.freshnessMinutes || 1440,
    limitations: String(payload.limitations || "Not valid beyond the documented sources, observation window, and reconciliation state.").trim(),
    privacyClass: normalizeKey(payload.privacyClass || "operations_restricted"),
    decisionsAllowed: Array.isArray(payload.decisionsAllowed) ? payload.decisionsAllowed.map(normalizeKey) : [],
    exportPolicy: normalizeKey(payload.exportPolicy || "internal_only"),
    trustState,
    trustReason: reason,
    observedAt: payload.observedAt || null,
    reviewedAt: payload.reviewedAt || new Date(),
    reviewAt: payload.reviewAt,
    withdrawnAt: payload.withdrawnAt || null,
    createdBy: adminUserId,
    history: [{ trustState, actorId: adminUserId, reason }],
  });
  return serializeMetric(row.toObject());
};

const updateMetricContract = async ({ contractId, updates = {}, adminUserId } = {}) => {
  assertObjectId(contractId, "Metric contract id");
  assertObjectId(adminUserId, "Admin user id");
  const row = await MetricContract.findById(contractId);
  if (!row) throw buildHttpError("Metric contract not found", 404);
  const reason = requireReason(updates.reason);
  for (const key of ["title", "ownerName", "ownerRole", "sourceAuthorities", "calculation", "freshnessMinutes", "limitations", "privacyClass", "decisionsAllowed", "exportPolicy", "trustState", "observedAt", "reviewedAt", "reviewAt", "withdrawnAt"]) {
    if (updates[key] !== undefined) row[key] = ["privacyClass", "exportPolicy", "trustState"].includes(key) ? normalizeKey(updates[key]) : updates[key];
  }
  if (updates.trustState !== undefined) { row.trustReason = reason; row.history.push({ trustState: row.trustState, actorId: adminUserId, reason }); }
  row.lastChangedBy = adminUserId;
  await row.save();
  return serializeMetric(row.toObject());
};

const createIntelligenceProduct = async ({ payload = {}, adminUserId } = {}) => {
  assertObjectId(adminUserId, "Admin user id");
  const definition = findCatalog(INTELLIGENCE_PRODUCT_CATALOG, payload.productKey, "Intelligence product key");
  const status = normalizeKey(payload.status || "draft");
  const reason = requireReason(payload.reason || "Intelligence product created");
  const row = await IntelligenceProduct.create({
    productKey: definition.key,
    title: String(payload.title || definition.title).trim(),
    audience: normalizeKey(payload.audience || definition.defaultAudience),
    ownerName: String(payload.ownerName || "").trim(),
    ownerRole: String(payload.ownerRole || "Intelligence product owner").trim(),
    cadence: normalizeKey(payload.cadence || "weekly"),
    sourceMetricKeys: Array.isArray(payload.sourceMetricKeys) ? payload.sourceMetricKeys.map(normalizeKey) : [],
    confidencePolicy: String(payload.confidencePolicy || "Show observed confidence and withhold recommendations when any required source is stale, disputed, or blocked.").trim(),
    privacyPolicy: String(payload.privacyPolicy || "Use the minimum audience-appropriate aggregate or creator-self data and expose no private fan rows.").trim(),
    permittedActions: Array.isArray(payload.permittedActions) ? payload.permittedActions.map(normalizeKey) : ["explain", "dismiss", "request_help"],
    reviewerRole: String(payload.reviewerRole || "Data governance").trim(),
    withdrawalPath: String(payload.withdrawalPath || "Pause the product, remove it from affected surfaces, preserve audit history, and notify its reviewer.").trim(),
    status,
    confidence: payload.confidence ?? null,
    qualityState: normalizeKey(payload.qualityState || "watch"),
    approvedBy: ["pilot", "active"].includes(status) ? adminUserId : null,
    approvedAt: ["pilot", "active"].includes(status) ? new Date() : null,
    reviewAt: payload.reviewAt,
    withdrawnAt: status === "withdrawn" ? new Date() : null,
    createdBy: adminUserId,
    history: [{ status, actorId: adminUserId, reason }],
  });
  return serializeProduct(row.toObject());
};

const updateIntelligenceProduct = async ({ productId, updates = {}, adminUserId } = {}) => {
  assertObjectId(productId, "Intelligence product id");
  assertObjectId(adminUserId, "Admin user id");
  const row = await IntelligenceProduct.findById(productId);
  if (!row) throw buildHttpError("Intelligence product not found", 404);
  const reason = requireReason(updates.reason);
  for (const key of ["title", "audience", "ownerName", "ownerRole", "cadence", "sourceMetricKeys", "confidencePolicy", "privacyPolicy", "permittedActions", "reviewerRole", "withdrawalPath", "status", "confidence", "qualityState", "reviewAt"]) {
    if (updates[key] !== undefined) row[key] = ["audience", "cadence", "status", "qualityState"].includes(key) ? normalizeKey(updates[key]) : updates[key];
  }
  if (["pilot", "active"].includes(row.status)) { row.approvedBy = adminUserId; row.approvedAt = new Date(); }
  if (row.status === "withdrawn" && !row.withdrawnAt) row.withdrawnAt = new Date();
  if (updates.status !== undefined) row.history.push({ status: row.status, actorId: adminUserId, reason });
  row.lastChangedBy = adminUserId;
  await row.save();
  return serializeProduct(row.toObject());
};

const createCreatorIntelligencePrompt = async ({ payload = {}, adminUserId } = {}) => {
  assertObjectId(adminUserId, "Admin user id");
  assertObjectId(payload.creatorProfileId, "Creator profile id");
  assertObjectId(payload.productId, "Intelligence product id");
  const [profile, product] = await Promise.all([
    CreatorProfile.findById(payload.creatorProfileId).select("_id userId isCreator").lean(),
    IntelligenceProduct.findById(payload.productId).lean(),
  ]);
  if (!profile?.isCreator) throw buildHttpError("Active creator profile not found", 404);
  if (!product || product.audience !== "creator" || !["pilot", "active"].includes(product.status) || !["trusted", "watch"].includes(product.qualityState)) {
    throw buildHttpError("Creator prompts require a reviewed creator intelligence product with usable source quality", 409);
  }
  const status = normalizeKey(payload.status || "available");
  const promptKey = String(payload.promptKey || `${product.productKey}_${idOf(profile._id)}_${crypto.randomBytes(3).toString("hex")}`).trim().toLowerCase();
  const row = await CreatorIntelligencePrompt.create({
    promptKey,
    creatorProfile: profile._id,
    creatorUser: profile.userId,
    intelligenceProduct: product._id,
    title: String(payload.title || product.title).trim(),
    explanation: String(payload.explanation || "").trim(),
    sourceLabel: String(payload.sourceLabel || "Tengacion governed intelligence").trim(),
    sourceMetricKeys: product.sourceMetricKeys || [],
    timeframeLabel: String(payload.timeframeLabel || "Most recent reviewed period").trim(),
    confidence: payload.confidence ?? product.confidence ?? 0,
    limitations: String(payload.limitations || product.confidencePolicy).trim(),
    suggestedAction: String(payload.suggestedAction || "Review this optional suggestion and choose whether it fits your goals.").trim(),
    status,
    expiresAt: payload.expiresAt,
    createdBy: adminUserId,
    history: [{ status, actorId: adminUserId, reason: "Creator intelligence prompt created" }],
  });
  return serializePrompt(row.toObject());
};

const updateCreatorIntelligenceFeedback = async ({ promptId, userId, payload = {} } = {}) => {
  assertObjectId(promptId, "Creator intelligence prompt id");
  assertObjectId(userId, "Creator user id");
  const row = await CreatorIntelligencePrompt.findOne({ _id: promptId, creatorUser: userId });
  if (!row) throw buildHttpError("Creator intelligence prompt not found", 404);
  const allowedStatuses = ["shown", "acted", "completed", "dismissed", "hidden", "help_requested"];
  const status = normalizeKey(payload.status || row.status);
  if (!allowedStatuses.includes(status)) throw buildHttpError("Creator feedback status is invalid", 400);
  const feedback = String(payload.feedback || "").trim().toLowerCase();
  const allowedFeedback = ["", "helpful", "not_relevant", "incorrect", "needs_explanation"];
  if (!allowedFeedback.includes(feedback)) throw buildHttpError("Creator feedback value is invalid", 400);
  const reason = String(payload.note || `Creator marked prompt ${status}`).trim();
  row.status = status;
  row.creatorFeedback = feedback;
  row.feedbackNote = String(payload.note || "").trim();
  row.history.push({ status, actorId: userId, reason });
  await row.save();
  return serializePrompt(row.toObject());
};

const createPredictiveWarning = async ({ payload = {}, adminUserId } = {}) => {
  assertObjectId(adminUserId, "Admin user id");
  findCatalog(PREDICTIVE_WARNING_CATALOG, payload.warningType, "Predictive warning type");
  const status = normalizeKey(payload.status || "open");
  const row = await PredictiveWarning.create({
    warningKey: String(payload.warningKey || `${normalizeKey(payload.warningType)}_${crypto.randomBytes(5).toString("hex")}`).trim().toLowerCase(),
    warningType: normalizeKey(payload.warningType),
    ownerName: String(payload.ownerName || "").trim(),
    ownerRole: String(payload.ownerRole || "Operations owner").trim(),
    sourceMetricKeys: Array.isArray(payload.sourceMetricKeys) ? payload.sourceMetricKeys.map(normalizeKey) : [],
    confidence: payload.confidence,
    impact: String(payload.impact || "").trim(),
    runbookPath: String(payload.runbookPath || "").trim(),
    reviewPath: String(payload.reviewPath || "").trim(),
    rollbackPath: String(payload.rollbackPath || "").trim(),
    status,
    observedAt: payload.observedAt || new Date(),
    reviewAt: payload.reviewAt,
    resolvedAt: payload.resolvedAt || null,
    resolutionNote: String(payload.resolutionNote || "").trim(),
    createdBy: adminUserId,
    history: [{ status, actorId: adminUserId, reason: "Predictive warning recorded for human review" }],
  });
  return serializeWarning(row.toObject());
};

const updatePredictiveWarning = async ({ warningId, updates = {}, adminUserId } = {}) => {
  assertObjectId(warningId, "Predictive warning id");
  assertObjectId(adminUserId, "Admin user id");
  const row = await PredictiveWarning.findById(warningId);
  if (!row) throw buildHttpError("Predictive warning not found", 404);
  const reason = requireReason(updates.reason);
  for (const key of ["ownerName", "ownerRole", "sourceMetricKeys", "confidence", "impact", "runbookPath", "reviewPath", "rollbackPath", "status", "reviewAt", "resolvedAt", "resolutionNote"]) {
    if (updates[key] !== undefined) row[key] = key === "status" ? normalizeKey(updates[key]) : updates[key];
  }
  if (updates.status !== undefined) row.history.push({ status: row.status, actorId: adminUserId, reason });
  row.lastChangedBy = adminUserId;
  await row.save();
  return serializeWarning(row.toObject());
};

const createAutomationRegistryEntry = async ({ payload = {}, adminUserId } = {}) => {
  assertObjectId(adminUserId, "Admin user id");
  const state = normalizeKey(payload.state || "proposed");
  if (["pilot", "active"].includes(state)) throw buildHttpError("AUTOMATION-001 creates registry records but does not authorize pilots or active execution", 409);
  const row = await AutomationRegistryEntry.create({
    automationKey: normalizeKey(payload.automationKey),
    title: String(payload.title || "").trim(),
    ownerName: String(payload.ownerName || "").trim(),
    ownerRole: String(payload.ownerRole || "Operations owner").trim(),
    surface: normalizeKey(payload.surface),
    actorAffected: normalizeKey(payload.actorAffected),
    trigger: String(payload.trigger || "").trim(),
    inputSignals: Array.isArray(payload.inputSignals) ? payload.inputSignals.map(normalizeKey) : [],
    actionType: normalizeKey(payload.actionType || "suggestion"),
    riskLevel: normalizeKey(payload.riskLevel || "medium"),
    approvalRequirement: String(payload.approvalRequirement || "Named owner and risk reviewer approval before any later pilot proposal.").trim(),
    auditEvent: normalizeKey(payload.auditEvent || `automation_${payload.automationKey}`),
    userVisibleStatus: normalizeKey(payload.userVisibleStatus || "suggested"),
    pauseControl: String(payload.pauseControl || "Disable the candidate at registry and surface scope.").trim(),
    rollbackPlan: String(payload.rollbackPlan || "Remove the candidate output, restore the prior manual path, and preserve audit history.").trim(),
    successMetric: normalizeKey(payload.successMetric),
    guardrailMetrics: Array.isArray(payload.guardrailMetrics) ? payload.guardrailMetrics.map(normalizeKey) : [],
    reviewCadence: normalizeKey(payload.reviewCadence || "monthly"),
    state,
    reviewAt: payload.reviewAt,
    createdBy: adminUserId,
    history: [{ state, actorId: adminUserId, reason: "Automation candidate registered without execution authority" }],
  });
  return serializeAutomation(row.toObject());
};

const updateAutomationRegistryEntry = async ({ automationId, updates = {}, adminUserId } = {}) => {
  assertObjectId(automationId, "Automation registry id");
  assertObjectId(adminUserId, "Admin user id");
  const row = await AutomationRegistryEntry.findById(automationId);
  if (!row) throw buildHttpError("Automation registry entry not found", 404);
  const reason = requireReason(updates.reason);
  const state = updates.state === undefined ? row.state : normalizeKey(updates.state);
  if (["pilot", "active"].includes(state)) throw buildHttpError("AUTOMATION-001 does not authorize pilot or active execution", 409);
  for (const key of ["title", "ownerName", "ownerRole", "surface", "actorAffected", "trigger", "inputSignals", "actionType", "riskLevel", "approvalRequirement", "auditEvent", "userVisibleStatus", "pauseControl", "rollbackPlan", "successMetric", "guardrailMetrics", "reviewCadence", "state", "reviewAt"]) {
    if (updates[key] !== undefined) row[key] = ["surface", "actorAffected", "actionType", "riskLevel", "auditEvent", "userVisibleStatus", "reviewCadence", "state"].includes(key) ? normalizeKey(updates[key]) : updates[key];
  }
  if (updates.state !== undefined) row.history.push({ state: row.state, actorId: adminUserId, reason });
  row.lastChangedBy = adminUserId;
  await row.save();
  return serializeAutomation(row.toObject());
};

module.exports = {
  AKUSO_INTELLIGENCE_BEHAVIOR,
  FAN_ADVOCACY_LOOPS,
  INTELLIGENCE_PRODUCT_CATALOG,
  METRIC_CONTRACT_CATALOG,
  NETWORK_FINANCE_BLUEPRINT,
  NETWORK_PROGRAM_CATALOG,
  PREDICTIVE_WARNING_CATALOG,
  ROADMAP_PACKAGES,
  buildAutomationRegistry,
  buildCreatorNetworkIntelligenceForProfile,
  buildIntelligenceProducts,
  buildMetricContracts,
  buildNetworkIntelligenceOperatingSystem,
  buildNetworkIntelligenceOperatingView,
  buildNetworkPrograms,
  buildPartnerGraduation,
  buildPredictiveOperations,
  createAutomationRegistryEntry,
  createCreatorIntelligencePrompt,
  createIntelligenceProduct,
  createMetricContract,
  createNetworkProgram,
  createPartnerGraduation,
  createPredictiveWarning,
  serializeAutomation,
  serializeGraduation,
  serializeMetric,
  serializeNetworkProgram,
  serializeProduct,
  serializePrompt,
  serializeWarning,
  updateAutomationRegistryEntry,
  updateCreatorIntelligenceFeedback,
  updateIntelligenceProduct,
  updateMetricContract,
  updateNetworkProgram,
  updatePartnerGraduation,
  updatePredictiveWarning,
};
