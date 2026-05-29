const { buildReliabilityHealth } = require("./analyticsService");
const { buildFinanceAssuranceClose } = require("./financeAssuranceCloseService");

const EVIDENCE_FRESHNESS_LEVELS = [
  "current",
  "stale",
  "delayed",
  "disputed",
  "blocked",
  "withdrawn",
];

const READINESS_RANK = {
  ready: 0,
  watch: 1,
  needs_review: 2,
  blocked: 3,
};

const SEVERITY_RANK = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const FRESHNESS_RANK = {
  current: 0,
  stale: 1,
  delayed: 2,
  disputed: 3,
  blocked: 4,
  withdrawn: 5,
};

const RELIABILITY_TO_READINESS = {
  healthy: "ready",
  watch: "watch",
  degraded: "needs_review",
  incident: "blocked",
  blocked: "blocked",
};

const CONTROL_DEFINITIONS = [
  {
    key: "finance_revenue_close",
    workstream: "finance",
    workflow: "finance_close",
    surface: "Finance close",
    owner: "Finance and operations",
    reviewer: "Product leadership",
    objective: "Reconcile purchases, entitlements, wallet entries, refunds, payouts, and creator balance confidence before approving finance claims.",
    evidenceSource: "finance_assurance_close",
    freshnessExpectation: "per close window",
    automationStatus: "automated",
    actionPath: "/admin/creator-earnings",
  },
  {
    key: "purchase_entitlement_continuity",
    workstream: "finance",
    workflow: "purchase_to_access",
    surface: "Entitlements",
    owner: "Backend and infrastructure",
    reviewer: "Finance and operations",
    objective: "Every paid eligible purchase must have entitlement evidence or a known exception.",
    evidenceSource: "finance_assurance_close.entitlements",
    freshnessExpectation: "daily",
    automationStatus: "automated",
    actionPath: "/admin/transactions",
  },
  {
    key: "wallet_settlement_accuracy",
    workstream: "finance",
    workflow: "wallet_balances",
    surface: "Wallet settlement",
    owner: "Finance and operations",
    reviewer: "Product leadership",
    objective: "Creator sale credits, platform fees, refund debits, and payout debits must match source transactions.",
    evidenceSource: "wallet_entries",
    freshnessExpectation: "hourly",
    automationStatus: "automated",
    actionPath: "/admin/creator-earnings",
  },
  {
    key: "payment_webhook_processing",
    workstream: "finance",
    workflow: "payment_verification",
    surface: "Provider webhooks",
    owner: "Backend and infrastructure",
    reviewer: "Finance and operations",
    objective: "Webhook processing failures and duplicate delivery must be visible before payment completeness is trusted.",
    evidenceSource: "payment_webhook_events",
    freshnessExpectation: "daily",
    automationStatus: "automated",
    actionPath: "/admin/transactions",
  },
  {
    key: "payout_outcome_control",
    workstream: "finance",
    workflow: "payout_requests",
    surface: "Creator payouts",
    owner: "Finance and operations",
    reviewer: "Creator success",
    objective: "Payout requests, paid outcomes, failures, and wallet debits must reconcile before creator balance claims expand.",
    evidenceSource: "creator_payout_requests",
    freshnessExpectation: "daily",
    automationStatus: "automated",
    actionPath: "/admin/creator-earnings",
  },
  {
    key: "partner_export_access_review",
    workstream: "partner_api_market",
    workflow: "partner_exports",
    surface: "Partner exports",
    owner: "Partnerships",
    reviewer: "Security and compliance",
    objective: "Partner exports must have scope, minimization, reviewer, revocation, and shareability evidence.",
    evidenceSource: "partner_assurance_pack",
    freshnessExpectation: "monthly",
    automationStatus: "manual",
    actionPath: "/admin/assurance",
    defaultFreshness: "delayed",
    defaultSeverity: "medium",
  },
  {
    key: "api_access_review",
    workstream: "partner_api_market",
    workflow: "api_access",
    surface: "API access",
    owner: "Backend and infrastructure",
    reviewer: "Security and compliance",
    objective: "API keys, use cases, scopes, rate limits, abuse review, and revocation tests must be reviewed.",
    evidenceSource: "api_assurance_pack",
    freshnessExpectation: "monthly",
    automationStatus: "manual",
    actionPath: "/admin/assurance",
    defaultFreshness: "delayed",
    defaultSeverity: "medium",
  },
  {
    key: "market_readiness_packet",
    workstream: "partner_api_market",
    workflow: "market_launch",
    surface: "Market readiness",
    owner: "Product leadership",
    reviewer: "Trust, policy, and legal",
    objective: "Market expansion must attach money, support, moderation, rights, privacy, partner, and Akuso readiness evidence.",
    evidenceSource: "market_assurance_pack",
    freshnessExpectation: "per launch",
    automationStatus: "manual",
    actionPath: "/admin/assurance",
    defaultFreshness: "delayed",
    defaultSeverity: "medium",
  },
  {
    key: "data_contract_coverage",
    workstream: "data_product",
    workflow: "data_products",
    surface: "Data contracts",
    owner: "Data and analytics",
    reviewer: "Product leadership",
    objective: "Executive, creator, finance, recommendation, experimentation, and automation metrics must expose owners, definitions, source, and trust state.",
    evidenceSource: "metric_contract_registry",
    freshnessExpectation: "weekly",
    automationStatus: "manual",
    actionPath: "/admin/analytics",
    defaultFreshness: "delayed",
    defaultSeverity: "medium",
  },
  {
    key: "experiment_guardrails",
    workstream: "data_product",
    workflow: "experiments",
    surface: "Experiments",
    owner: "Product leadership",
    reviewer: "Data and analytics",
    objective: "Experiments must have hypothesis owner, success metric, guardrails, exposure scope, rollback rule, and decision date.",
    evidenceSource: "experiment_assurance_pack",
    freshnessExpectation: "per experiment",
    automationStatus: "manual",
    actionPath: "/admin/analytics",
    defaultFreshness: "delayed",
    defaultSeverity: "medium",
  },
  {
    key: "recommendation_measurement_trust",
    workstream: "data_product",
    workflow: "recommendations",
    surface: "Recommendations",
    owner: "Discovery and analytics",
    reviewer: "Trust, policy, and legal",
    objective: "Recommendation decisions must include eligibility, complaint, diversity, rollback, and metric trust evidence.",
    evidenceSource: "recommendation_logs",
    freshnessExpectation: "weekly",
    automationStatus: "partial",
    reliabilityKey: "discovery_fallback_rate",
    actionPath: "/admin/analytics",
  },
  {
    key: "privacy_consent_rights_control",
    workstream: "trust_rights_privacy",
    workflow: "privacy_rights",
    surface: "Privacy and rights",
    owner: "Trust, policy, and legal",
    reviewer: "Security and compliance",
    objective: "Privacy requests, consent states, rights takedowns, and shareability rules must be auditable.",
    evidenceSource: "trust_rights_pack",
    freshnessExpectation: "weekly",
    automationStatus: "manual",
    actionPath: "/admin/reports",
    defaultFreshness: "delayed",
    defaultSeverity: "medium",
  },
  {
    key: "moderation_appeal_assurance",
    workstream: "trust_rights_privacy",
    workflow: "moderation",
    surface: "Moderation",
    owner: "Trust, policy, and legal",
    reviewer: "Product leadership",
    objective: "Moderation decisions, appeals, reversals, aging, and support escalations must have review evidence.",
    evidenceSource: "moderation_cases",
    freshnessExpectation: "weekly",
    automationStatus: "partial",
    actionPath: "/admin/reports",
    defaultFreshness: "delayed",
    defaultSeverity: "medium",
  },
  {
    key: "notification_consent_control",
    workstream: "trust_rights_privacy",
    workflow: "notifications",
    surface: "Notifications",
    owner: "Fan growth",
    reviewer: "Trust, policy, and legal",
    objective: "Notification and consent choices must be respected before campaigns or partner commitments expand.",
    evidenceSource: "notification_preferences",
    freshnessExpectation: "weekly",
    automationStatus: "manual",
    actionPath: "/admin/campaigns",
    defaultFreshness: "delayed",
    defaultSeverity: "low",
  },
  {
    key: "akuso_source_eval_governance",
    workstream: "akuso_ai",
    workflow: "akuso",
    surface: "Akuso",
    owner: "AI and assistant",
    reviewer: "Trust, policy, and legal",
    objective: "Akuso source coverage, eval pass rate, fallback behavior, refusal quality, and cost controls must gate assistant expansion.",
    evidenceSource: "akuso_metrics_and_evals",
    freshnessExpectation: "weekly",
    automationStatus: "partial",
    reliabilityKey: "akuso_latency_fallback",
    actionPath: "/admin/assistant/metrics",
  },
  {
    key: "akuso_high_risk_boundaries",
    workstream: "akuso_ai",
    workflow: "assistant_boundaries",
    surface: "Akuso boundaries",
    owner: "AI and assistant",
    reviewer: "Security and compliance",
    objective: "Akuso must not execute payments, approve payouts, change account security, approve partner access, or make legal, rights, moderation, finance, recovery, or incident decisions.",
    evidenceSource: "assistant_policy_review",
    freshnessExpectation: "weekly",
    automationStatus: "manual",
    actionPath: "/admin/assistant/reviews",
    defaultFreshness: "delayed",
    defaultSeverity: "medium",
  },
];

const EVIDENCE_PACK_STANDARD = {
  sections: [
    "workflow_summary",
    "owner_and_reviewer",
    "current_readiness_state",
    "source_systems",
    "latest_metrics",
    "latest_exceptions",
    "reconciliation_status",
    "incident_history",
    "user_or_partner_impact",
    "approval_history",
    "open_risks",
    "next_review_date",
  ],
  freshnessLevels: EVIDENCE_FRESHNESS_LEVELS,
  audienceViews: [
    "internal_operations",
    "finance",
    "creator_support",
    "partner_success",
    "executive_review",
    "audit_or_due_diligence",
  ],
  shareabilityRules: [
    "Do not use delayed, blocked, disputed, stale, or withdrawn evidence in external claims.",
    "Partner, sponsor, investor, regulator, and audit views must hide internal incident, security, private user, and policy-sensitive details.",
    "Every open exception must name an owner, severity, readiness implication, and remediation path.",
  ],
};

const PARTNER_API_MARKET_EVIDENCE_PACKS = [
  {
    key: "partner_assurance_pack",
    title: "Partner Assurance Pack",
    workstream: "partner_api_market",
    owner: "Partnerships",
    reviewer: "Security and compliance",
    controlKeys: ["partner_export_access_review"],
    sourceSystem: "manual_partner_api_market_trust_packs",
    actionPath: "/admin/assurance",
    sharingLevel: "partner_shareable_after_review",
    audienceViews: ["internal_operations", "partner_success", "executive_review", "audit_or_due_diligence"],
    summary: "Evidence for scoped partner access, minimized data sharing, reporting cadence, privacy review, incident history, and revocation readiness.",
    revocationOrPauseRule: "Pause broader partner scope when export, dashboard, privacy, or revocation evidence is delayed, blocked, disputed, or withdrawn.",
    requiredEvidence: [
      { key: "access_scope", label: "Access scope" },
      { key: "data_shared", label: "Data shared" },
      { key: "reporting_cadence", label: "Reporting cadence" },
      { key: "export_evidence", label: "Export evidence" },
      { key: "dashboard_evidence", label: "Dashboard evidence" },
      { key: "incident_history", label: "Incident history", shareability: "internal_only" },
      { key: "privacy_review", label: "Privacy review" },
      { key: "revocation_path", label: "Revocation path" },
      { key: "unresolved_risks", label: "Unresolved risks" },
    ],
  },
  {
    key: "api_assurance_pack",
    title: "API Assurance Pack",
    workstream: "partner_api_market",
    owner: "Backend and infrastructure",
    reviewer: "Security and compliance",
    controlKeys: ["api_access_review"],
    sourceSystem: "manual_partner_api_market_trust_packs",
    actionPath: "/admin/assurance",
    sharingLevel: "partner_shareable_after_review",
    audienceViews: ["internal_operations", "partner_success", "executive_review", "audit_or_due_diligence"],
    summary: "Evidence for approved API use cases, key ownership, permission scope, rate limits, abuse review, audit events, and revocation testing.",
    revocationOrPauseRule: "Do not approve broader API scope when key ownership, abuse review, rate limit, audit, or revocation evidence is not current.",
    requiredEvidence: [
      { key: "approved_use_case", label: "Approved use case" },
      { key: "key_owner", label: "Key owner" },
      { key: "rate_limit", label: "Rate limit" },
      { key: "permission_scope", label: "Permission scope" },
      { key: "abuse_review", label: "Abuse review" },
      { key: "audit_events", label: "Audit events", shareability: "internal_only" },
      { key: "revocation_test", label: "Revocation test" },
      { key: "support_owner", label: "Support owner" },
    ],
  },
  {
    key: "market_assurance_pack",
    title: "Market Assurance Pack",
    workstream: "partner_api_market",
    owner: "Product leadership",
    reviewer: "Trust, policy, and legal",
    controlKeys: [
      "market_readiness_packet",
      "finance_revenue_close",
      "purchase_entitlement_continuity",
      "wallet_settlement_accuracy",
      "payout_outcome_control",
      "privacy_consent_rights_control",
      "moderation_appeal_assurance",
      "akuso_source_eval_governance",
    ],
    sourceSystem: "manual_partner_api_market_trust_packs",
    actionPath: "/admin/assurance",
    sharingLevel: "executive_review_only",
    audienceViews: ["internal_operations", "finance", "creator_support", "executive_review", "audit_or_due_diligence"],
    summary: "Evidence for launch scope, money movement, creator support, moderation, rights, privacy, consent, partner, sponsor, and Akuso readiness.",
    revocationOrPauseRule: "Market launch remains blocked when money movement, trust, privacy, rights, partner, support, or Akuso evidence is stale or unresolved.",
    requiredEvidence: [
      { key: "launch_scope", label: "Launch scope" },
      { key: "money_movement_readiness", label: "Money movement readiness" },
      { key: "creator_support_readiness", label: "Creator support readiness" },
      { key: "moderation_rights_readiness", label: "Moderation and rights readiness" },
      { key: "privacy_consent_readiness", label: "Privacy and consent readiness" },
      { key: "partner_sponsor_readiness", label: "Partner and sponsor readiness" },
      { key: "akuso_policy_readiness", label: "Akuso language and policy readiness" },
    ],
  },
];

const DATA_PRODUCT_EVIDENCE_PACKS = [
  {
    key: "metric_contract_registry",
    title: "Metric Contract Registry",
    workstream: "data_product",
    owner: "Data and analytics",
    reviewer: "Product leadership",
    controlKeys: ["data_contract_coverage"],
    sourceSystem: "metric_contract_registry",
    actionPath: "/admin/analytics",
    sharingLevel: "executive_review_only",
    audienceViews: ["internal_operations", "finance", "creator_support", "executive_review", "audit_or_due_diligence"],
    summary: "Definitions, owners, sources, freshness expectations, and trust states for executive, creator, finance, recommendation, experimentation, automation, and Akuso metrics.",
    revocationOrPauseRule: "Withdraw external reports, automation inputs, experiment decisions, and partner claims when metric contracts are stale, disputed, blocked, or withdrawn.",
    requiredEvidence: [
      { key: "gmv", label: "GMV" },
      { key: "purchase_conversion", label: "Purchase conversion" },
      { key: "creator_earnings", label: "Creator earnings" },
      { key: "payout_aging", label: "Payout aging" },
      { key: "subscription_retention", label: "Subscription retention" },
      { key: "discovery_impressions", label: "Discovery impressions" },
      { key: "recommendation_clicks", label: "Recommendation clicks" },
      { key: "recommendation_conversions", label: "Recommendation conversions" },
      { key: "notification_delivery_complaints", label: "Notification delivery and complaints" },
      { key: "support_moderation_queues", label: "Support and moderation queues" },
      { key: "akuso_helpfulness_fallbacks", label: "Akuso helpfulness and fallbacks" },
    ],
  },
  {
    key: "experiment_assurance_pack",
    title: "Experiment Assurance Pack",
    workstream: "data_product",
    owner: "Product leadership",
    reviewer: "Data and analytics",
    controlKeys: ["experiment_guardrails", "data_contract_coverage"],
    sourceSystem: "experiment_assurance_pack",
    actionPath: "/admin/analytics",
    sharingLevel: "internal_only",
    audienceViews: ["internal_operations", "executive_review"],
    summary: "Evidence that experiments have a hypothesis owner, success metric, guardrail metric, exposure scope, rollback rule, data freshness requirement, and decision date.",
    revocationOrPauseRule: "Do not launch or continue experiments when guardrails, rollback rules, or metric freshness evidence is missing.",
    requiredEvidence: [
      { key: "hypothesis_owner", label: "Hypothesis owner" },
      { key: "success_metric", label: "Success metric" },
      { key: "guardrail_metric", label: "Guardrail metric" },
      { key: "exposure_scope", label: "Exposure scope" },
      { key: "rollback_rule", label: "Rollback rule" },
      { key: "data_freshness_requirement", label: "Data freshness requirement" },
      { key: "decision_date", label: "Decision date" },
    ],
  },
  {
    key: "recommendation_assurance_pack",
    title: "Recommendation Assurance Pack",
    workstream: "data_product",
    owner: "Discovery and analytics",
    reviewer: "Trust, policy, and legal",
    controlKeys: ["recommendation_measurement_trust", "data_contract_coverage"],
    sourceSystem: "recommendation_logs",
    actionPath: "/admin/analytics",
    sharingLevel: "internal_only",
    audienceViews: ["internal_operations", "executive_review", "audit_or_due_diligence"],
    summary: "Evidence for recommendation eligibility, diversity guardrails, complaint review, creator exposure review, rollback evidence, and metric trust.",
    revocationOrPauseRule: "Pause recommendation changes when eligibility, complaint, diversity, rollback, or metric trust evidence is stale or disputed.",
    requiredEvidence: [
      { key: "eligibility_evidence", label: "Eligibility evidence" },
      { key: "diversity_guardrail_status", label: "Diversity guardrail status" },
      { key: "complaint_review", label: "Complaint review" },
      { key: "creator_exposure_review", label: "Creator exposure review" },
      { key: "rollback_evidence", label: "Rollback evidence" },
      { key: "metric_trust_evidence", label: "Metric trust evidence" },
    ],
  },
];

const ASSURANCE_EVIDENCE_PACKS = [
  ...PARTNER_API_MARKET_EVIDENCE_PACKS,
  ...DATA_PRODUCT_EVIDENCE_PACKS,
];

const METRIC_CONTRACT_DEFINITIONS = [
  {
    key: "gmv",
    title: "GMV",
    owner: "Finance and operations",
    reviewer: "Data and analytics",
    sourceSystem: "finance_assurance_close",
    freshnessExpectation: "per close window",
    controlKeys: ["finance_revenue_close", "wallet_settlement_accuracy"],
    externalUse: "finance_and_executive",
    definition: "Gross paid creator commerce volume before refunds, disputes, platform fees, and payout debits.",
  },
  {
    key: "purchase_conversion",
    title: "Purchase Conversion",
    owner: "Data and analytics",
    reviewer: "Product leadership",
    sourceSystem: "purchase_and_payment_events",
    freshnessExpectation: "daily",
    controlKeys: ["payment_webhook_processing", "purchase_entitlement_continuity"],
    externalUse: "executive_review",
    definition: "Completed paid purchases divided by eligible purchase starts for the selected window.",
  },
  {
    key: "creator_earnings",
    title: "Creator Earnings",
    owner: "Finance and operations",
    reviewer: "Creator success",
    sourceSystem: "wallet_entries",
    freshnessExpectation: "daily",
    controlKeys: ["finance_revenue_close", "wallet_settlement_accuracy"],
    externalUse: "creator_support",
    definition: "Creator-facing earned balances after platform fees, refunds, payout debits, and settlement adjustments.",
  },
  {
    key: "payout_aging",
    title: "Payout Aging",
    owner: "Finance and operations",
    reviewer: "Creator success",
    sourceSystem: "creator_payout_requests",
    freshnessExpectation: "daily",
    controlKeys: ["payout_outcome_control"],
    externalUse: "creator_support",
    definition: "Open payout requests grouped by age, status, failure state, and owner follow-up.",
  },
  {
    key: "subscription_retention",
    title: "Subscription Retention",
    owner: "Data and analytics",
    reviewer: "Product leadership",
    sourceSystem: "subscription_and_purchase_events",
    freshnessExpectation: "weekly",
    controlKeys: ["data_contract_coverage"],
    externalUse: "executive_review",
    definition: "Subscribers retained over a cohort window after churn, renewal, and entitlement continuity checks.",
  },
  {
    key: "discovery_impressions",
    title: "Discovery Impressions",
    owner: "Discovery and analytics",
    reviewer: "Product leadership",
    sourceSystem: "recommendation_logs",
    freshnessExpectation: "daily",
    controlKeys: ["recommendation_measurement_trust"],
    externalUse: "internal_operations",
    definition: "Eligible discovery impressions emitted to users after fallback and dedupe rules.",
  },
  {
    key: "recommendation_clicks",
    title: "Recommendation Clicks",
    owner: "Discovery and analytics",
    reviewer: "Trust, policy, and legal",
    sourceSystem: "recommendation_logs",
    freshnessExpectation: "daily",
    controlKeys: ["recommendation_measurement_trust"],
    externalUse: "internal_operations",
    definition: "User clicks attributed to recommendation surfaces with metric freshness and fallback context.",
  },
  {
    key: "recommendation_conversions",
    title: "Recommendation Conversions",
    owner: "Discovery and analytics",
    reviewer: "Finance and operations",
    sourceSystem: "recommendation_logs_and_purchases",
    freshnessExpectation: "weekly",
    controlKeys: ["recommendation_measurement_trust", "purchase_entitlement_continuity"],
    externalUse: "executive_review",
    definition: "Paid or entitled outcomes attributed to recommendation exposure within approved windows.",
  },
  {
    key: "notification_delivery_complaints",
    title: "Notification Delivery And Complaints",
    owner: "Fan growth",
    reviewer: "Trust, policy, and legal",
    sourceSystem: "notification_preferences",
    freshnessExpectation: "weekly",
    controlKeys: ["notification_consent_control"],
    externalUse: "internal_operations",
    definition: "Notification delivery, opt-out, consent exception, and complaint evidence by campaign or workflow.",
  },
  {
    key: "support_moderation_queues",
    title: "Support And Moderation Queues",
    owner: "Trust, policy, and legal",
    reviewer: "Product leadership",
    sourceSystem: "moderation_cases",
    freshnessExpectation: "weekly",
    controlKeys: ["moderation_appeal_assurance"],
    externalUse: "internal_operations",
    definition: "Moderation queue, appeal, reversal, rights, and support escalation aging by severity.",
  },
  {
    key: "akuso_helpfulness_fallbacks",
    title: "Akuso Helpfulness And Fallbacks",
    owner: "AI and assistant",
    reviewer: "Trust, policy, and legal",
    sourceSystem: "akuso_metrics_and_evals",
    freshnessExpectation: "weekly",
    controlKeys: ["akuso_source_eval_governance"],
    externalUse: "internal_operations",
    definition: "Akuso helpfulness, fallback rate, refusal quality, source coverage, unsupported claims, and cost evidence.",
  },
  {
    key: "experiment_guardrail_pass_rate",
    title: "Experiment Guardrail Pass Rate",
    owner: "Product leadership",
    reviewer: "Data and analytics",
    sourceSystem: "experiment_assurance_pack",
    freshnessExpectation: "per experiment",
    controlKeys: ["experiment_guardrails", "data_contract_coverage"],
    externalUse: "internal_operations",
    definition: "Experiment guardrail pass status with rollback rules, exposure scope, and decision date.",
  },
];

const toSeverity = (readinessState = "ready", fallback = "none") => {
  if (readinessState === "blocked") {
    return "critical";
  }
  if (readinessState === "needs_review") {
    return "high";
  }
  if (readinessState === "watch") {
    return fallback === "none" ? "low" : fallback;
  }
  return "none";
};

const worstSeverity = (severities = []) =>
  severities.reduce((worst, severity) => {
    const currentRank = SEVERITY_RANK[severity] ?? 0;
    const worstRank = SEVERITY_RANK[worst] ?? 0;
    return currentRank > worstRank ? severity : worst;
  }, "none");

const worstReadiness = (states = []) =>
  states.reduce((worst, state) => {
    const currentRank = READINESS_RANK[state] ?? 0;
    const worstRank = READINESS_RANK[worst] ?? 0;
    return currentRank > worstRank ? state : worst;
  }, "ready");

const worstFreshness = (states = []) =>
  states.reduce((worst, state) => {
    const currentRank = FRESHNESS_RANK[state] ?? 0;
    const worstRank = FRESHNESS_RANK[worst] ?? 0;
    return currentRank > worstRank ? state : worst;
  }, "current");

const buildReliabilityMap = (reliabilityHealth = {}) =>
  new Map((reliabilityHealth.snapshots || []).map((snapshot) => [snapshot.key, snapshot]));

const findFinanceException = (financeClose = {}, keys = []) =>
  (financeClose.exceptions || []).find((entry) => keys.includes(entry.key)) || null;

const buildDynamicEvidence = ({ control, financeClose, reliabilityMap } = {}) => {
  if (control.key === "finance_revenue_close") {
    const readinessState = financeClose?.close?.readinessState || "blocked";
    const severity = worstSeverity((financeClose.exceptions || []).map((entry) => entry.severity));
    return {
      readinessState,
      evidenceFreshness: financeClose?.close?.evidenceFreshness || "blocked",
      exceptionSeverity: severity,
      latestMetric: `${Number(financeClose?.summary?.exceptionCount || 0)} exceptions`,
      lastReview: financeClose?.generatedAt || null,
      nextReview: financeClose?.close?.nextReviewDate || null,
      auditNotes: financeClose?.close?.approvalStatus || "blocked_pending_reconciliation",
    };
  }

  if (control.key === "purchase_entitlement_continuity") {
    const exception = findFinanceException(financeClose, ["entitlement_gap"]);
    const missing = Number(financeClose?.summary?.entitlementMissing || 0);
    return {
      readinessState: missing > 0 ? "blocked" : "ready",
      evidenceFreshness: "current",
      exceptionSeverity: exception?.severity || "none",
      latestMetric: `${missing} missing entitlements`,
      lastReview: financeClose?.generatedAt || null,
      nextReview: financeClose?.close?.nextReviewDate || null,
      auditNotes: missing > 0 ? "Entitlement gaps block purchase-to-access assurance." : "Paid purchase entitlement evidence reconciles.",
    };
  }

  if (control.key === "wallet_settlement_accuracy") {
    const exceptions = [
      findFinanceException(financeClose, ["wallet_settlement_gap"]),
      findFinanceException(financeClose, ["creator_credit_variance"]),
      findFinanceException(financeClose, ["platform_fee_variance"]),
      findFinanceException(financeClose, ["refund_wallet_gap"]),
      findFinanceException(financeClose, ["refund_amount_variance"]),
      findFinanceException(financeClose, ["payout_debit_variance"]),
    ].filter(Boolean);
    const walletGaps =
      Number(financeClose?.summary?.walletMissingEntries || 0) +
      Number(financeClose?.summary?.refundWalletMissingEntries || 0);
    const readinessState = exceptions.some((entry) => entry.severity === "critical")
      ? "blocked"
      : exceptions.length
        ? "needs_review"
        : "ready";
    return {
      readinessState,
      evidenceFreshness: "current",
      exceptionSeverity: worstSeverity(exceptions.map((entry) => entry.severity)),
      latestMetric: `${walletGaps} missing wallet entries`,
      lastReview: financeClose?.generatedAt || null,
      nextReview: financeClose?.close?.nextReviewDate || null,
      auditNotes: exceptions.length ? "Wallet settlement has open variance evidence." : "Wallet settlement evidence reconciles.",
    };
  }

  if (control.key === "payment_webhook_processing") {
    const exception = findFinanceException(financeClose, ["webhook_failures"]);
    const failed = Number(financeClose?.reconciliation?.webhooks?.failed || 0);
    return {
      readinessState: failed > 0 ? "needs_review" : "ready",
      evidenceFreshness: "current",
      exceptionSeverity: exception?.severity || "none",
      latestMetric: `${failed} failed webhooks`,
      lastReview: financeClose?.generatedAt || null,
      nextReview: financeClose?.close?.nextReviewDate || null,
      auditNotes: failed > 0 ? "Provider webhook failures require review." : "No failed webhook evidence in the close window.",
    };
  }

  if (control.key === "payout_outcome_control") {
    const exceptions = [
      findFinanceException(financeClose, ["payout_debit_variance"]),
      findFinanceException(financeClose, ["payout_failures"]),
    ].filter(Boolean);
    const failed = Number(financeClose?.summary?.payoutFailedCount || 0);
    const readinessState = exceptions.some((entry) => ["critical", "high"].includes(entry.severity))
      ? "needs_review"
      : failed > 0
        ? "watch"
        : "ready";
    return {
      readinessState,
      evidenceFreshness: "current",
      exceptionSeverity: worstSeverity(exceptions.map((entry) => entry.severity)),
      latestMetric: `${failed} failed payouts`,
      lastReview: financeClose?.generatedAt || null,
      nextReview: financeClose?.close?.nextReviewDate || null,
      auditNotes: failed > 0 ? "Failed payout evidence needs owner follow-up." : "Payout outcome evidence reconciles.",
    };
  }

  if (control.reliabilityKey) {
    const snapshot = reliabilityMap.get(control.reliabilityKey);
    const readinessState = RELIABILITY_TO_READINESS[snapshot?.status] || "watch";
    return {
      readinessState,
      evidenceFreshness: snapshot ? "current" : "delayed",
      exceptionSeverity: toSeverity(readinessState, "medium"),
      latestMetric: snapshot?.metric
        ? `${snapshot.metric.value}${snapshot.metric.total == null ? "" : `/${snapshot.metric.total}`}`
        : "No current metric",
      lastReview: snapshot ? new Date().toISOString() : null,
      nextReview: null,
      auditNotes: snapshot?.nextAction || "Attach current reliability evidence before expansion.",
    };
  }

  const exceptionSeverity = control.defaultSeverity || "low";
  return {
    readinessState: exceptionSeverity === "low" ? "watch" : "needs_review",
    evidenceFreshness: control.defaultFreshness || "delayed",
    exceptionSeverity,
    latestMetric: "Evidence pack pending",
    lastReview: null,
    nextReview: null,
    auditNotes: "Manual evidence pack is not connected yet.",
  };
};

const serializeControl = ({ control, dynamicEvidence }) => {
  const readinessImplication =
    dynamicEvidence.readinessState === "ready"
      ? "Evidence is current enough for normal review."
      : control.readinessImplication ||
        "Dependent launch, partner, market, API, data, campaign, or assistant expansion requires owner review.";

  return {
    controlKey: control.key,
    workstream: control.workstream,
    workflow: control.workflow,
    surface: control.surface,
    owner: control.owner,
    reviewer: control.reviewer,
    controlObjective: control.objective,
    evidenceSource: control.evidenceSource,
    evidenceFreshnessExpectation: control.freshnessExpectation,
    automationStatus: control.automationStatus,
    exceptionSeverity: dynamicEvidence.exceptionSeverity,
    readinessState: dynamicEvidence.readinessState,
    readinessImplication,
    evidenceFreshness: dynamicEvidence.evidenceFreshness,
    latestMetric: dynamicEvidence.latestMetric,
    lastReview: dynamicEvidence.lastReview,
    nextReview: dynamicEvidence.nextReview,
    auditNotes: dynamicEvidence.auditNotes,
    actionPath: control.actionPath,
  };
};

const buildEvidencePacks = (controls = []) => {
  const controlMap = new Map(controls.map((control) => [control.controlKey, control]));

  return ASSURANCE_EVIDENCE_PACKS.map((pack) => {
    const relatedControls = pack.controlKeys.map((key) => controlMap.get(key)).filter(Boolean);
    const readinessState = worstReadiness(relatedControls.map((control) => control.readinessState));
    const evidenceFreshness = worstFreshness(relatedControls.map((control) => control.evidenceFreshness));
    const exceptionSeverity = worstSeverity(relatedControls.map((control) => control.exceptionSeverity));
    const isCurrentAndReady = readinessState === "ready" && evidenceFreshness === "current";
    const blockingControls = relatedControls.filter(
      (control) => control.readinessState !== "ready" || control.evidenceFreshness !== "current"
    );
    const requiredEvidence = pack.requiredEvidence.map((section) => ({
      ...section,
      status: isCurrentAndReady ? "current" : "pending",
      evidenceFreshness: isCurrentAndReady ? "current" : evidenceFreshness,
      sourceSystem: pack.sourceSystem,
      shareability: section.shareability || pack.sharingLevel,
    }));
    const openRisks = blockingControls.map((control) => ({
      controlKey: control.controlKey,
      surface: control.surface,
      owner: control.owner,
      severity: control.exceptionSeverity,
      readinessState: control.readinessState,
      evidenceFreshness: control.evidenceFreshness,
      note: control.auditNotes,
    }));

    return {
      key: pack.key,
      title: pack.title,
      workstream: pack.workstream,
      owner: pack.owner,
      reviewer: pack.reviewer,
      readinessState,
      evidenceFreshness,
      exceptionSeverity,
      sharingLevel: pack.sharingLevel,
      audienceViews: pack.audienceViews,
      summary: pack.summary,
      revocationOrPauseRule: pack.revocationOrPauseRule,
      latestEvidenceSummary: isCurrentAndReady
        ? "Required evidence is current enough for review."
        : `${requiredEvidence.length} required sections need current evidence before external reliance.`,
      requiredEvidence,
      controlKeys: pack.controlKeys,
      blockingControls: blockingControls.map((control) => control.controlKey),
      openRisks,
      actionPath: pack.actionPath,
    };
  });
};

const trustStateFromEvidence = ({ readinessState = "ready", evidenceFreshness = "current" } = {}) => {
  if (evidenceFreshness === "withdrawn") {
    return "withdrawn";
  }
  if (evidenceFreshness === "blocked" || readinessState === "blocked") {
    return "blocked";
  }
  if (evidenceFreshness === "delayed") {
    return "needs_contract";
  }
  if (["disputed", "stale"].includes(evidenceFreshness) || readinessState === "needs_review") {
    return "disputed";
  }
  if (readinessState === "watch") {
    return "watch";
  }
  return "trusted";
};

const buildMetricContracts = (controls = []) => {
  const controlMap = new Map(controls.map((control) => [control.controlKey, control]));

  return METRIC_CONTRACT_DEFINITIONS.map((contract) => {
    const relatedControls = contract.controlKeys.map((key) => controlMap.get(key)).filter(Boolean);
    const readinessState = worstReadiness(relatedControls.map((control) => control.readinessState));
    const evidenceFreshness = worstFreshness(relatedControls.map((control) => control.evidenceFreshness));
    const exceptionSeverity = worstSeverity(relatedControls.map((control) => control.exceptionSeverity));
    const trustState = trustStateFromEvidence({ readinessState, evidenceFreshness });
    const blockingControls = relatedControls.filter(
      (control) => control.readinessState !== "ready" || control.evidenceFreshness !== "current"
    );
    const externalUseAllowed = trustState === "trusted";

    return {
      key: contract.key,
      title: contract.title,
      owner: contract.owner,
      reviewer: contract.reviewer,
      definition: contract.definition,
      sourceSystem: contract.sourceSystem,
      freshnessExpectation: contract.freshnessExpectation,
      externalUse: contract.externalUse,
      trustState,
      readinessState,
      evidenceFreshness,
      exceptionSeverity,
      externalUseAllowed,
      controlKeys: contract.controlKeys,
      blockingControls: blockingControls.map((control) => control.controlKey),
      latestEvidence: relatedControls.map((control) => ({
        controlKey: control.controlKey,
        surface: control.surface,
        latestMetric: control.latestMetric,
        readinessState: control.readinessState,
        evidenceFreshness: control.evidenceFreshness,
      })),
      withdrawalRule: externalUseAllowed
        ? "Metric can support its approved audience while evidence remains current."
        : "Do not use this metric for external reports, automation, partner claims, experiments, or market approvals until trust evidence is current.",
    };
  });
};

const buildSummary = (controls = [], evidencePacks = [], metricContracts = []) => {
  const countsByFreshness = {};
  const countsByReadiness = {};
  const countsBySeverity = {};
  const countsByWorkstream = {};

  controls.forEach((control) => {
    countsByFreshness[control.evidenceFreshness] = Number(countsByFreshness[control.evidenceFreshness] || 0) + 1;
    countsByReadiness[control.readinessState] = Number(countsByReadiness[control.readinessState] || 0) + 1;
    countsBySeverity[control.exceptionSeverity] = Number(countsBySeverity[control.exceptionSeverity] || 0) + 1;
    countsByWorkstream[control.workstream] = Number(countsByWorkstream[control.workstream] || 0) + 1;
  });

  const currentControls = Number(countsByFreshness.current || 0);
  const currentEvidencePacks = evidencePacks.filter(
    (pack) => pack.evidenceFreshness === "current" && pack.readinessState === "ready"
  ).length;
  const trustedMetricContracts = metricContracts.filter(
    (contract) => contract.trustState === "trusted"
  ).length;
  return {
    totalControls: controls.length,
    currentEvidenceControls: currentControls,
    controlCoverageRate: controls.length ? Number((currentControls / controls.length).toFixed(4)) : 0,
    evidencePackCount: evidencePacks.length,
    currentEvidencePackCount: currentEvidencePacks,
    evidencePackCoverageRate: evidencePacks.length
      ? Number((currentEvidencePacks / evidencePacks.length).toFixed(4))
      : 0,
    metricContractCount: metricContracts.length,
    trustedMetricContractCount: trustedMetricContracts,
    metricTrustRate: metricContracts.length
      ? Number((trustedMetricContracts / metricContracts.length).toFixed(4))
      : 0,
    readinessState: worstReadiness(controls.map((control) => control.readinessState)),
    blockerCount: Number(countsByReadiness.blocked || 0),
    needsReviewCount: Number(countsByReadiness.needs_review || 0),
    watchCount: Number(countsByReadiness.watch || 0),
    readyCount: Number(countsByReadiness.ready || 0),
    highSeverityCount:
      Number(countsBySeverity.high || 0) + Number(countsBySeverity.critical || 0),
    countsByFreshness,
    countsByReadiness,
    countsBySeverity,
    countsByWorkstream,
  };
};

const buildWorkstreams = (controls = []) => {
  const workstreamMap = new Map();
  controls.forEach((control) => {
    const row = workstreamMap.get(control.workstream) || {
      key: control.workstream,
      controls: 0,
      currentEvidence: 0,
      readinessState: "ready",
      blockers: 0,
      highSeverity: 0,
    };
    row.controls += 1;
    if (control.evidenceFreshness === "current") {
      row.currentEvidence += 1;
    }
    if (control.readinessState === "blocked") {
      row.blockers += 1;
    }
    if (["critical", "high"].includes(control.exceptionSeverity)) {
      row.highSeverity += 1;
    }
    row.readinessState = worstReadiness([row.readinessState, control.readinessState]);
    workstreamMap.set(control.workstream, row);
  });

  return Array.from(workstreamMap.values()).map((row) => ({
    ...row,
    evidenceFreshnessRate: row.controls ? Number((row.currentEvidence / row.controls).toFixed(4)) : 0,
  }));
};

const buildMonitoringAlerts = (controls = []) =>
  controls
    .filter(
      (control) =>
        control.evidenceFreshness !== "current" ||
        ["critical", "high"].includes(control.exceptionSeverity) ||
        control.readinessState === "blocked"
    )
    .map((control) => ({
      key: `assurance_${control.controlKey}`,
      controlKey: control.controlKey,
      surface: control.surface,
      owner: control.owner,
      severity:
        control.exceptionSeverity === "critical"
          ? "critical"
          : control.exceptionSeverity === "high" || control.readinessState === "blocked"
            ? "high"
            : "medium",
      readinessState: control.readinessState,
      evidenceFreshness: control.evidenceFreshness,
      actionPath: control.actionPath,
      message:
        control.evidenceFreshness === "current"
          ? control.auditNotes
          : `${control.surface} evidence is ${control.evidenceFreshness}; attach a current evidence pack before dependent decisions.`,
    }));

const buildReadinessGates = (controls = []) => [
  {
    key: "finance_close_readiness",
    title: "Finance Close Readiness",
    controlKeys: ["finance_revenue_close", "wallet_settlement_accuracy", "purchase_entitlement_continuity"],
    readinessState: worstReadiness(
      controls
        .filter((control) =>
          ["finance_revenue_close", "wallet_settlement_accuracy", "purchase_entitlement_continuity"].includes(control.controlKey)
        )
        .map((control) => control.readinessState)
    ),
    blockerCondition: "Any critical finance, wallet, refund, payout, or entitlement variance blocks expansion of money movement and creator balance claims.",
  },
  {
    key: "partner_api_market_readiness",
    title: "Partner, API, and Market Readiness",
    controlKeys: ["partner_export_access_review", "api_access_review", "market_readiness_packet"],
    readinessState: worstReadiness(
      controls
        .filter((control) =>
          ["partner_export_access_review", "api_access_review", "market_readiness_packet"].includes(control.controlKey)
        )
        .map((control) => control.readinessState)
    ),
    blockerCondition: "Delayed or blocked access evidence prevents broader partner, API, export, or market scope.",
  },
  {
    key: "data_product_readiness",
    title: "Data, Experiment, and Recommendation Readiness",
    controlKeys: ["data_contract_coverage", "experiment_guardrails", "recommendation_measurement_trust"],
    readinessState: worstReadiness(
      controls
        .filter((control) =>
          ["data_contract_coverage", "experiment_guardrails", "recommendation_measurement_trust"].includes(control.controlKey)
        )
        .map((control) => control.readinessState)
    ),
    blockerCondition: "Untrusted metrics cannot support external reports, automation, experiments, recommendations, or market approval.",
  },
  {
    key: "trust_rights_privacy_readiness",
    title: "Trust, Rights, and Privacy Readiness",
    controlKeys: ["privacy_consent_rights_control", "moderation_appeal_assurance", "notification_consent_control"],
    readinessState: worstReadiness(
      controls
        .filter((control) =>
          ["privacy_consent_rights_control", "moderation_appeal_assurance", "notification_consent_control"].includes(control.controlKey)
        )
        .map((control) => control.readinessState)
    ),
    blockerCondition: "Trust, privacy, consent, rights, moderation, or notification misses can block campaigns, recommendations, launches, and partner commitments.",
  },
  {
    key: "akuso_readiness",
    title: "Akuso Readiness",
    controlKeys: ["akuso_source_eval_governance", "akuso_high_risk_boundaries"],
    readinessState: worstReadiness(
      controls
        .filter((control) =>
          ["akuso_source_eval_governance", "akuso_high_risk_boundaries"].includes(control.controlKey)
        )
        .map((control) => control.readinessState)
    ),
    blockerCondition: "Akuso expansion pauses when source, eval, refusal, high-risk boundary, incident-mode, or cost evidence is stale or failed.",
  },
];

const buildAssuranceDashboard = async ({
  range = "30d",
  startDate = "",
  endDate = "",
} = {}) => {
  const [financeClose, reliabilityHealth] = await Promise.all([
    buildFinanceAssuranceClose({ range, startDate, endDate }),
    buildReliabilityHealth({ range, startDate, endDate }),
  ]);
  const reliabilityMap = buildReliabilityMap(reliabilityHealth);
  const controls = CONTROL_DEFINITIONS.map((control) =>
    serializeControl({
      control,
      dynamicEvidence: buildDynamicEvidence({ control, financeClose, reliabilityMap }),
    })
  );
  const evidencePacks = buildEvidencePacks(controls);
  const metricContracts = buildMetricContracts(controls);
  const summary = buildSummary(controls, evidencePacks, metricContracts);

  return {
    filters: financeClose.filters,
    generatedAt: new Date().toISOString(),
    dashboard: {
      key: "assurance_dashboard",
      title: "Tengacion Assurance Dashboard",
      owner: "Product leadership",
      reviewer: "Assurance review board",
      readinessState: summary.readinessState,
      evidenceFreshnessRate: summary.controlCoverageRate,
    },
    summary,
    workstreams: buildWorkstreams(controls),
    controls,
    evidencePacks,
    metricContracts,
    alerts: buildMonitoringAlerts(controls),
    readinessGates: buildReadinessGates(controls),
    evidencePackStandard: EVIDENCE_PACK_STANDARD,
    sourceSystems: [
      "finance_assurance_close",
      "payment_webhook_events",
      "entitlements",
      "wallet_entries",
      "creator_payout_requests",
      "reliability_health",
      "moderation_cases",
      "recommendation_logs",
      "akuso_metrics_and_evals",
      "manual_partner_api_market_trust_packs",
      "metric_contract_registry",
      "experiment_assurance_pack",
    ],
  };
};

module.exports = {
  ASSURANCE_EVIDENCE_PACKS,
  CONTROL_DEFINITIONS,
  DATA_PRODUCT_EVIDENCE_PACKS,
  EVIDENCE_PACK_STANDARD,
  METRIC_CONTRACT_DEFINITIONS,
  PARTNER_API_MARKET_EVIDENCE_PACKS,
  buildAssuranceDashboard,
};
