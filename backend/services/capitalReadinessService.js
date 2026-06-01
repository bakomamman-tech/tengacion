const { buildAssuranceDashboard } = require("./assuranceDashboardService");
const { buildFinanceAssuranceClose } = require("./financeAssuranceCloseService");

const CAPITAL_STATE_RANK = {
  ready: 0,
  near_ready: 1,
  evidence_needed: 2,
  remediation_needed: 3,
  not_ready: 4,
};

const GATE_STATE_RANK = {
  ready: 0,
  conditional: 1,
  evidence_needed: 2,
  blocked: 3,
};

const STATE_SCORE = {
  ready: 100,
  near_ready: 80,
  evidence_needed: 55,
  remediation_needed: 30,
  not_ready: 0,
};

const FINANCING_PATH_DEFINITIONS = [
  {
    key: "bootstrap_discipline",
    title: "Continue Bootstrap Discipline",
    fit: "Default operating path while scorecard gaps are being closed.",
    diligenceBurden: "low",
    controlImplication: "Protect runway and narrow claims to internal operating evidence.",
    requiredScorecardKeys: [],
  },
  {
    key: "revenue_backed_growth",
    title: "Revenue-backed Growth",
    fit: "Works when revenue quality, creator earnings, and payout confidence are current enough to underwrite cash-flow growth.",
    diligenceBurden: "medium",
    controlImplication: "Requires trusted revenue, payout, refund, dispute, and cash collection evidence.",
    requiredScorecardKeys: ["trusted_gmv", "revenue_quality", "creator_earnings_confidence", "payout_confidence"],
  },
  {
    key: "strategic_partner_funding",
    title: "Strategic Partner Funding",
    fit: "Works when partner scope creates market leverage without unsafe data, exclusivity, control, or AI commitments.",
    diligenceBurden: "high",
    controlImplication: "Partner, privacy, security, API, market, and Akuso evidence must stay current.",
    requiredScorecardKeys: ["partner_pipeline", "market_readiness", "security_privacy_posture", "akuso_governance"],
  },
  {
    key: "enterprise_prepayments",
    title: "Enterprise Prepayments",
    fit: "Works when enterprise or institutional commitments can fund delivery without overstating product readiness.",
    diligenceBurden: "medium",
    controlImplication: "Requires controlled commitments, support capacity, and clear refund or service-level exposure.",
    requiredScorecardKeys: ["partner_pipeline", "team_capacity", "market_readiness"],
  },
  {
    key: "creator_institution_partnerships",
    title: "Creator Institution Partnerships",
    fit: "Works when creator economics, trust operations, and market readiness can support institution-led cohorts.",
    diligenceBurden: "medium",
    controlImplication: "Creator earnings confidence and rights, trust, privacy, and support evidence must be current.",
    requiredScorecardKeys: ["creator_earnings_confidence", "creator_retention", "security_privacy_posture"],
  },
  {
    key: "grants_or_ecosystem_programs",
    title: "Grants Or Ecosystem Programs",
    fit: "Useful for non-dilutive support when claims are narrow and reporting obligations are manageable.",
    diligenceBurden: "medium",
    controlImplication: "Grant claims still need approved metrics, risk disclosure, and data-room freshness.",
    requiredScorecardKeys: ["data_room_freshness", "compliance_audit_posture", "akuso_governance"],
  },
  {
    key: "angel_or_seed_round",
    title: "Angel Or Seed Round",
    fit: "Appropriate only when core traction, economics, trust, and governance evidence can survive basic diligence.",
    diligenceBurden: "high",
    controlImplication: "Investor claims, projections, and data-room materials need approval states and owner review.",
    requiredScorecardKeys: [
      "trusted_gmv",
      "revenue_quality",
      "creator_earnings_confidence",
      "payout_confidence",
      "market_readiness",
      "data_room_freshness",
      "akuso_governance",
    ],
  },
  {
    key: "venture_round",
    title: "Venture Round",
    fit: "Premature unless traction, retention, unit economics, governance, and growth repeatability are strongly evidenced.",
    diligenceBurden: "very_high",
    controlImplication: "Do not open broad venture conversations while key scorecard areas are missing or remediating.",
    requiredScorecardKeys: [
      "trusted_gmv",
      "revenue_quality",
      "creator_retention",
      "fan_retention",
      "subscription_retention",
      "acquisition_efficiency",
      "market_readiness",
      "security_privacy_posture",
      "akuso_governance",
    ],
  },
  {
    key: "delay_capital_and_prove_milestones",
    title: "Delay Capital And Prove Milestones",
    fit: "Best path when capital would amplify weak controls, stale evidence, unsupported projections, or unresolved risk.",
    diligenceBurden: "low",
    controlImplication: "Convert capital blockers into product, finance, trust, data, partner, and Akuso milestones.",
    requiredScorecardKeys: [],
  },
];

const USE_OF_FUNDS_DEFINITIONS = [
  {
    key: "creator_acquisition_success",
    title: "Creator Acquisition And Success",
    owner: "Creator success",
    budgetRange: "10-20% of approved growth budget",
    milestoneTrigger: "Launch only after creator earnings confidence and cohort activation evidence are current.",
    successMetric: "creator cohort activation, first sale, repeat creator publishing, payback",
    riskMetric: "creator earnings disputes, onboarding drop-off, support burden",
    stopLossRule: "Pause spend when creator earnings confidence is degraded or cohort payback evidence is missing.",
    reviewCadence: "weekly",
    dependencies: ["creator_earnings_confidence", "creator_retention"],
  },
  {
    key: "fan_growth_retention",
    title: "Fan Growth And Retention",
    owner: "Growth and analytics",
    budgetRange: "10-18% of approved growth budget",
    milestoneTrigger: "Start paid tests only when conversion and retention metrics have approved definitions.",
    successMetric: "repeat buyer rate, subscription retention, cost per retained fan",
    riskMetric: "unsupported acquisition efficiency, refund rate, complaint rate",
    stopLossRule: "Pause tests when fan retention or acquisition efficiency evidence is missing for two reviews.",
    reviewCadence: "weekly",
    dependencies: ["fan_retention", "subscription_retention", "acquisition_efficiency"],
  },
  {
    key: "market_expansion",
    title: "Market Expansion",
    owner: "Product leadership",
    budgetRange: "8-15% of approved growth budget",
    milestoneTrigger: "Open a market only after money movement, trust, privacy, and partner evidence are current.",
    successMetric: "market-ready creator cohorts, partner readiness, revenue quality",
    riskMetric: "market evidence delay, rights or moderation blockers, partner concentration",
    stopLossRule: "Pause launch spend when market readiness pack is delayed, blocked, disputed, or withdrawn.",
    reviewCadence: "weekly",
    dependencies: ["market_readiness", "security_privacy_posture", "partner_pipeline"],
  },
  {
    key: "trust_rights_operations",
    title: "Content Rights And Trust Operations",
    owner: "Trust, policy, and legal",
    budgetRange: "6-12% of approved operating budget",
    milestoneTrigger: "Increase capacity when moderation, rights, privacy, and complaint queues show sustained pressure.",
    successMetric: "appeal aging, rights response time, support resolution quality",
    riskMetric: "unresolved complaints, stale privacy evidence, rights takedown backlog",
    stopLossRule: "Do not expand external claims while trust, rights, or privacy controls need review.",
    reviewCadence: "weekly",
    dependencies: ["security_privacy_posture", "compliance_audit_posture"],
  },
  {
    key: "payment_payout_finance",
    title: "Payment, Payout, And Finance Operations",
    owner: "Finance and operations",
    budgetRange: "5-10% of approved operating budget",
    milestoneTrigger: "Invest when payout exposure, refund reserve, dispute reserve, or close exceptions grow.",
    successMetric: "finance close readiness, payout aging, reserve coverage",
    riskMetric: "wallet variance, missing entitlements, failed payouts, dispute source gap",
    stopLossRule: "Pause money-movement expansion when the finance close is blocked or needs review.",
    reviewCadence: "weekly",
    dependencies: ["trusted_gmv", "revenue_quality", "payout_confidence", "refund_dispute_handling"],
  },
  {
    key: "security_privacy",
    title: "Security And Privacy",
    owner: "Security and compliance",
    budgetRange: "5-12% of approved operating budget",
    milestoneTrigger: "Fund when partner, API, data-room, or market sharing increases sensitive-data exposure.",
    successMetric: "access review completion, privacy request handling, vendor review coverage",
    riskMetric: "stale access evidence, privacy incident risk, sensitive data exposure",
    stopLossRule: "Block new partner or data-room sharing while security or privacy evidence is stale.",
    reviewCadence: "weekly",
    dependencies: ["security_privacy_posture", "data_room_freshness"],
  },
  {
    key: "infrastructure_reliability",
    title: "Infrastructure And Reliability",
    owner: "Backend and infrastructure",
    budgetRange: "7-14% of approved operating budget",
    milestoneTrigger: "Scale capacity after reliability health and cost variance are reviewed.",
    successMetric: "uptime, latency, incident reduction, cost variance",
    riskMetric: "unreviewed infra cost, incident recurrence, unbounded media storage",
    stopLossRule: "Hold scale spend when reliability or cost telemetry cannot explain variance.",
    reviewCadence: "weekly",
    dependencies: ["team_capacity", "data_room_freshness"],
  },
  {
    key: "data_analytics",
    title: "Data And Analytics",
    owner: "Data and analytics",
    budgetRange: "5-10% of approved operating budget",
    milestoneTrigger: "Fund metric contracts, cohort reporting, assumption registers, and sensitivity analysis before external projections.",
    successMetric: "trusted metric coverage, assumption owner coverage, projection review completion",
    riskMetric: "disputed metrics, stale contracts, unsupported projections",
    stopLossRule: "Do not publish projections when input owners, confidence states, or approval states are missing.",
    reviewCadence: "weekly",
    dependencies: ["data_room_freshness", "acquisition_efficiency", "subscription_retention"],
  },
  {
    key: "akuso_ai",
    title: "Akuso And AI",
    owner: "AI and assistant",
    budgetRange: "4-10% of approved operating budget",
    milestoneTrigger: "Expand only when eval, source, refusal, privacy, incident, and cost evidence are current.",
    successMetric: "cost per useful workflow, eval pass rate, support deflection, creator workflow value",
    riskMetric: "unsupported AI claims, stale evals, high-risk boundary misses, cost variance",
    stopLossRule: "Pause AI expansion when evals are stale, source coverage is weak, or costs exceed value evidence.",
    reviewCadence: "weekly",
    dependencies: ["akuso_governance"],
  },
  {
    key: "enterprise_partner_operations",
    title: "Enterprise And Partner Operations",
    owner: "Partnerships",
    budgetRange: "5-12% of approved growth budget",
    milestoneTrigger: "Invest when partner diligence, API scope, revocation, and support commitments are current.",
    successMetric: "qualified partner pipeline, signed pilots, margin confidence",
    riskMetric: "unsafe exclusivity, data-sharing risk, unapproved AI claims",
    stopLossRule: "Reject or renegotiate partner capital that bypasses privacy, finance, trust, or AI controls.",
    reviewCadence: "weekly",
    dependencies: ["partner_pipeline", "market_readiness", "security_privacy_posture", "akuso_governance"],
  },
];

const CLAIM_DEFINITIONS = [
  {
    key: "gmv_revenue_claim",
    title: "GMV And Revenue Traction",
    scorecardKey: "trusted_gmv",
    metricKey: "gmv",
    audience: "advisor_or_investor_review",
    approvalRule: "Use exact close-window GMV only when the GMV metric contract is trusted and the finance close is current.",
  },
  {
    key: "revenue_quality_claim",
    title: "Revenue Quality",
    scorecardKey: "revenue_quality",
    metricKey: "gmv",
    audience: "advisor_or_investor_review",
    approvalRule: "Do not claim revenue quality while wallet, refund, entitlement, webhook, or platform fee evidence is disputed.",
  },
  {
    key: "creator_economics_claim",
    title: "Creator Economics",
    scorecardKey: "creator_earnings_confidence",
    metricKey: "creator_earnings",
    audience: "creator_institution_or_investor_review",
    approvalRule: "Creator earnings claims require current creator balance confidence and payout evidence.",
  },
  {
    key: "payout_refund_claim",
    title: "Payout, Refund, And Dispute Exposure",
    scorecardKey: "refund_dispute_handling",
    metricKey: "payout_aging",
    audience: "advisor_or_partner_review",
    approvalRule: "Do not claim complete exposure coverage until refund and provider dispute sources are configured and current.",
  },
  {
    key: "market_partner_claim",
    title: "Market And Partner Readiness",
    scorecardKey: "market_readiness",
    metricKey: "partner_pipeline",
    audience: "strategic_partner_review",
    approvalRule: "Partner or market claims require current market, API, partner, privacy, finance, and support evidence.",
  },
  {
    key: "akuso_ai_claim",
    title: "Akuso AI Advantage",
    scorecardKey: "akuso_governance",
    metricKey: "akuso_helpfulness_fallbacks",
    audience: "advisor_or_partner_review",
    approvalRule: "Akuso claims must stay narrow and tied to current eval, source, refusal, incident, privacy, and cost evidence.",
  },
];

const PACKET_DEFINITIONS = [
  {
    key: "capital_strategy_brief",
    title: "Capital Strategy Brief",
    owner: "Product leadership",
    requiredScorecardKeys: ["trusted_gmv", "revenue_quality", "market_readiness"],
  },
  {
    key: "financial_model",
    title: "Financial Model And Scenario Inputs",
    owner: "Finance and operations",
    requiredScorecardKeys: ["trusted_gmv", "revenue_quality", "payout_confidence", "refund_dispute_handling"],
  },
  {
    key: "unit_economics_packet",
    title: "Unit Economics Packet",
    owner: "Data and analytics",
    requiredScorecardKeys: ["acquisition_efficiency", "subscription_retention", "creator_retention", "fan_retention"],
  },
  {
    key: "partner_diligence_packet",
    title: "Strategic Partner Diligence Packet",
    owner: "Partnerships",
    requiredScorecardKeys: ["partner_pipeline", "market_readiness", "security_privacy_posture"],
  },
  {
    key: "risk_register_packet",
    title: "Capital Risk Register",
    owner: "Product leadership",
    requiredScorecardKeys: ["compliance_audit_posture", "security_privacy_posture", "akuso_governance"],
  },
  {
    key: "akuso_governance_packet",
    title: "Akuso AI Governance Packet",
    owner: "AI and assistant",
    requiredScorecardKeys: ["akuso_governance"],
  },
];

const DILIGENCE_PIPELINE_DEFINITIONS = [
  {
    key: "targeted_advisor_review",
    title: "Targeted Advisor Review",
    audience: "advisor",
    owner: "Product leadership",
    fit: "Use qualified advisors to pressure-test the capital thesis before investor or partner outreach.",
    cadence: "weekly",
    requiredScorecardKeys: ["data_room_freshness", "compliance_audit_posture"],
    requiredPacketKeys: ["capital_strategy_brief", "risk_register_packet"],
    requiredClaimKeys: [],
    riskKeywords: ["data-room", "scenario", "compliance", "audit"],
  },
  {
    key: "angel_seed_outreach",
    title: "Angel Or Seed Investor Outreach",
    audience: "investor",
    owner: "Product leadership",
    fit: "Open only when traction, creator economics, runway, claims, and risk evidence can survive basic diligence.",
    cadence: "weekly",
    requiredScorecardKeys: [
      "trusted_gmv",
      "revenue_quality",
      "creator_earnings_confidence",
      "payout_confidence",
      "data_room_freshness",
      "akuso_governance",
    ],
    requiredPacketKeys: ["capital_strategy_brief", "financial_model", "risk_register_packet", "akuso_governance_packet"],
    requiredClaimKeys: ["gmv_revenue_claim", "revenue_quality_claim", "creator_economics_claim", "akuso_ai_claim"],
    riskKeywords: ["gmv", "revenue", "creator", "payout", "scenario", "akuso"],
  },
  {
    key: "strategic_partner_capital",
    title: "Strategic Partner Capital",
    audience: "strategic_partner",
    owner: "Partnerships",
    fit: "Pursue only when partner value is clear and data, exclusivity, privacy, support, and AI commitments stay inside approved controls.",
    cadence: "weekly",
    requiredScorecardKeys: ["partner_pipeline", "market_readiness", "security_privacy_posture", "akuso_governance"],
    requiredPacketKeys: ["partner_diligence_packet", "risk_register_packet", "akuso_governance_packet"],
    requiredClaimKeys: ["market_partner_claim", "akuso_ai_claim"],
    riskKeywords: ["partner", "market", "privacy", "akuso", "security"],
  },
  {
    key: "enterprise_prepayment",
    title: "Enterprise Prepayment Path",
    audience: "enterprise",
    owner: "Partnerships",
    fit: "Use prepayments only when scope, support capacity, delivery obligations, and refund exposure are controlled.",
    cadence: "weekly",
    requiredScorecardKeys: ["partner_pipeline", "team_capacity", "market_readiness", "refund_dispute_handling"],
    requiredPacketKeys: ["partner_diligence_packet", "financial_model", "risk_register_packet"],
    requiredClaimKeys: ["market_partner_claim", "payout_refund_claim"],
    riskKeywords: ["partner", "market", "refund", "team", "support"],
  },
  {
    key: "creator_institution_partnership",
    title: "Creator Institution Partnership",
    audience: "creator_institution",
    owner: "Creator success",
    fit: "Run institution-led creator cohorts only when creator earnings, retention, rights, privacy, and support evidence are current.",
    cadence: "weekly",
    requiredScorecardKeys: [
      "creator_earnings_confidence",
      "creator_retention",
      "security_privacy_posture",
      "team_capacity",
    ],
    requiredPacketKeys: ["unit_economics_packet", "risk_register_packet"],
    requiredClaimKeys: ["creator_economics_claim"],
    riskKeywords: ["creator", "privacy", "retention", "team"],
  },
  {
    key: "payment_provider_diligence",
    title: "Payment Provider Diligence",
    audience: "payment_provider",
    owner: "Finance and operations",
    fit: "Use provider conversations to harden money movement, reserve, dispute, and payout evidence before scaling commerce.",
    cadence: "weekly",
    requiredScorecardKeys: ["trusted_gmv", "revenue_quality", "payout_confidence", "refund_dispute_handling"],
    requiredPacketKeys: ["financial_model", "risk_register_packet"],
    requiredClaimKeys: ["payout_refund_claim", "revenue_quality_claim"],
    riskKeywords: ["payout", "refund", "dispute", "revenue", "gmv"],
  },
  {
    key: "grant_ecosystem_program",
    title: "Grant Or Ecosystem Program",
    audience: "grant_or_ecosystem_program",
    owner: "Compliance, legal, and advisors",
    fit: "Pursue non-dilutive capital when reporting obligations, public claims, AI claims, and data sharing remain narrow.",
    cadence: "biweekly",
    requiredScorecardKeys: ["data_room_freshness", "compliance_audit_posture", "akuso_governance"],
    requiredPacketKeys: ["capital_strategy_brief", "risk_register_packet", "akuso_governance_packet"],
    requiredClaimKeys: ["akuso_ai_claim"],
    riskKeywords: ["data-room", "compliance", "akuso", "scenario"],
  },
];

const DILIGENCE_QA_DEFINITIONS = [
  {
    key: "marketplace_thesis",
    question: "What is the core marketplace thesis and wedge?",
    audience: "investor",
    owner: "Product leadership",
    reviewer: "Data and analytics",
    requiredScorecardKeys: ["market_readiness", "creator_retention", "fan_retention"],
    requiredPacketKeys: ["capital_strategy_brief", "unit_economics_packet"],
    requiredClaimKeys: ["market_partner_claim"],
    answerRule: "Use only current market, creator cohort, fan retention, and product evidence; label missing retention as pending.",
    escalationTrigger: "Escalate if the answer needs unsupported market size, retention, or growth claims.",
  },
  {
    key: "revenue_quality",
    question: "What is revenue quality and how reliable is GMV?",
    audience: "investor",
    owner: "Finance and operations",
    reviewer: "Data and analytics",
    requiredScorecardKeys: ["trusted_gmv", "revenue_quality"],
    requiredPacketKeys: ["financial_model"],
    requiredClaimKeys: ["gmv_revenue_claim", "revenue_quality_claim"],
    answerRule: "Use close-window numbers only when metric contracts allow external use; keep disputed values internal.",
    escalationTrigger: "Escalate if wallet, entitlement, refund, webhook, or metric-contract evidence is blocked.",
  },
  {
    key: "creator_economics",
    question: "How reliable are creator earnings, payouts, and cohort economics?",
    audience: "investor_or_creator_institution",
    owner: "Finance and operations",
    reviewer: "Creator success",
    requiredScorecardKeys: ["creator_earnings_confidence", "payout_confidence", "creator_retention"],
    requiredPacketKeys: ["financial_model", "unit_economics_packet"],
    requiredClaimKeys: ["creator_economics_claim", "payout_refund_claim"],
    answerRule: "Separate verified wallet and payout evidence from cohort assumptions and keep weak creator claims narrowed.",
    escalationTrigger: "Escalate if creator balances, payouts, cohort retention, or refunds are disputed.",
  },
  {
    key: "runway_and_use_of_funds",
    question: "What runway and use-of-funds plan governs the capital request?",
    audience: "advisor_or_investor",
    owner: "Finance and operations",
    reviewer: "Product leadership",
    requiredScorecardKeys: ["data_room_freshness", "team_capacity", "revenue_quality"],
    requiredPacketKeys: ["financial_model", "capital_strategy_brief"],
    requiredClaimKeys: ["revenue_quality_claim"],
    answerRule: "Share runway scenarios only with cash inputs, assumption labels, owners, and review states attached.",
    escalationTrigger: "Escalate if projections depend on unreviewed assumptions or missing cash balance inputs.",
  },
  {
    key: "strategic_partner_terms",
    question: "What partner terms, data sharing, exclusivity, and support commitments are acceptable?",
    audience: "strategic_partner",
    owner: "Partnerships",
    reviewer: "Security and compliance",
    requiredScorecardKeys: ["partner_pipeline", "security_privacy_posture", "market_readiness"],
    requiredPacketKeys: ["partner_diligence_packet", "risk_register_packet"],
    requiredClaimKeys: ["market_partner_claim"],
    answerRule: "Reject or narrow asks that bypass privacy, revocation, data minimization, support capacity, or market readiness controls.",
    escalationTrigger: "Escalate any exclusivity, sensitive-data, API access, reporting, or support commitment outside approved controls.",
  },
  {
    key: "refund_dispute_exposure",
    question: "What are refund, dispute, reserve, and payout exposure controls?",
    audience: "payment_provider_or_investor",
    owner: "Finance and operations",
    reviewer: "Compliance, legal, and advisors",
    requiredScorecardKeys: ["refund_dispute_handling", "payout_confidence", "revenue_quality"],
    requiredPacketKeys: ["financial_model", "risk_register_packet"],
    requiredClaimKeys: ["payout_refund_claim", "revenue_quality_claim"],
    answerRule: "Show exposure and reserves only with source status; keep provider dispute gaps explicit.",
    escalationTrigger: "Escalate if provider dispute feeds, refund ledger entries, or payout reconciliation are missing.",
  },
  {
    key: "akuso_governance",
    question: "What does Akuso do, how is it governed, and what AI claims are approved?",
    audience: "investor_or_partner",
    owner: "AI and assistant",
    reviewer: "Trust, policy, and legal",
    requiredScorecardKeys: ["akuso_governance", "security_privacy_posture"],
    requiredPacketKeys: ["akuso_governance_packet", "risk_register_packet"],
    requiredClaimKeys: ["akuso_ai_claim"],
    answerRule: "Keep Akuso claims tied to current eval, source coverage, refusal quality, privacy, incident, and cost evidence.",
    escalationTrigger: "Escalate if the question asks for autonomous authority, unsupported AI advantage, private memory, or unapproved workflow claims.",
  },
  {
    key: "capital_risks",
    question: "What risks would delay or narrow the capital path?",
    audience: "advisor_or_leadership",
    owner: "Product leadership",
    reviewer: "Compliance, legal, and advisors",
    requiredScorecardKeys: ["compliance_audit_posture", "data_room_freshness", "security_privacy_posture"],
    requiredPacketKeys: ["risk_register_packet"],
    requiredClaimKeys: [],
    answerRule: "Lead with unresolved blockers, accepted risks, mitigation owners, and next review dates.",
    escalationTrigger: "Escalate if any blocked risk is being hidden, softened, or reframed as investor-ready.",
  },
];

const SCENARIOS = [
  {
    key: "downside",
    title: "Downside",
    revenueMultiplier: 0.6,
    costMultiplier: 0.9,
    assumption: "Growth slows, revenue contracts, and only essential operating spend continues.",
  },
  {
    key: "conservative",
    title: "Conservative",
    revenueMultiplier: 0.85,
    costMultiplier: 0.95,
    assumption: "Current revenue softens while operating discipline holds.",
  },
  {
    key: "base",
    title: "Base",
    revenueMultiplier: 1,
    costMultiplier: 1,
    assumption: "Current close-window economics continue for the next planning month.",
  },
  {
    key: "upside",
    title: "Upside",
    revenueMultiplier: 1.35,
    costMultiplier: 1.2,
    assumption: "Revenue grows with controlled support, moderation, infrastructure, partner, and Akuso spend.",
  },
];

const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const clampMoney = (value) => Math.max(0, roundMoney(value));

const asNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const parseOptionalMoney = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? roundMoney(numeric) : null;
};

const titleize = (value = "") =>
  String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

const money = (value, currency = "NGN") => ({
  amount: clampMoney(value),
  currency,
});

const getRankedWorst = (values = [], ranks = CAPITAL_STATE_RANK, fallback = "ready") =>
  values.reduce((worst, value) => {
    const normalized = String(value || fallback);
    return asNumber(ranks[normalized], -1) > asNumber(ranks[worst], -1) ? normalized : worst;
  }, fallback);

const worstCapitalState = (states = []) => getRankedWorst(states, CAPITAL_STATE_RANK, "ready");

const worstGateState = (states = []) => getRankedWorst(states, GATE_STATE_RANK, "ready");

const capitalStateFromEvidence = ({
  readinessState = "ready",
  evidenceFreshness = "current",
  exceptionSeverity = "none",
  trustState = "",
  externalUseAllowed = true,
} = {}) => {
  const readiness = String(readinessState || "ready");
  const freshness = String(evidenceFreshness || "current");
  const severity = String(exceptionSeverity || "none");
  const trust = String(trustState || "");

  if (["withdrawn", "blocked"].includes(trust) || freshness === "withdrawn" || readiness === "blocked") {
    return "not_ready";
  }
  if (
    ["critical", "high"].includes(severity) ||
    readiness === "needs_review" ||
    freshness === "blocked"
  ) {
    return "remediation_needed";
  }
  if (
    !externalUseAllowed ||
    ["needs_contract", "disputed"].includes(trust) ||
    ["delayed", "stale", "disputed"].includes(freshness)
  ) {
    return "evidence_needed";
  }
  if (readiness === "watch" || trust === "watch") {
    return "near_ready";
  }
  return "ready";
};

const approvalStateFromCapitalState = (state) => {
  if (state === "ready") {
    return "approved_for_advisor_review";
  }
  if (state === "near_ready") {
    return "internal_with_conditions";
  }
  if (state === "evidence_needed") {
    return "internal_draft";
  }
  if (state === "remediation_needed") {
    return "restricted";
  }
  return "withdrawn";
};

const gateStateFromCapitalState = (state) => {
  if (state === "ready") {
    return "ready";
  }
  if (state === "near_ready") {
    return "conditional";
  }
  if (state === "evidence_needed") {
    return "evidence_needed";
  }
  return "blocked";
};

const countBy = (rows = [], selector = () => "") =>
  rows.reduce((acc, row) => {
    const key = String(selector(row) || "unknown");
    acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, {});

const buildMaps = (assuranceDashboard = {}) => ({
  controls: new Map((assuranceDashboard.controls || []).map((row) => [row.controlKey, row])),
  metrics: new Map((assuranceDashboard.metricContracts || []).map((row) => [row.key, row])),
  packs: new Map((assuranceDashboard.evidencePacks || []).map((row) => [row.key, row])),
  gates: new Map((assuranceDashboard.readinessGates || []).map((row) => [row.key, row])),
});

const metricEvidenceState = (metric) =>
  capitalStateFromEvidence({
    readinessState: metric?.readinessState,
    evidenceFreshness: metric?.evidenceFreshness,
    exceptionSeverity: metric?.exceptionSeverity,
    trustState: metric?.trustState,
    externalUseAllowed: Boolean(metric?.externalUseAllowed),
  });

const controlEvidenceState = (control) =>
  capitalStateFromEvidence({
    readinessState: control?.readinessState,
    evidenceFreshness: control?.evidenceFreshness,
    exceptionSeverity: control?.exceptionSeverity,
    externalUseAllowed: control?.evidenceFreshness === "current" && control?.readinessState !== "blocked",
  });

const packEvidenceState = (pack) =>
  capitalStateFromEvidence({
    readinessState: pack?.readinessState,
    evidenceFreshness: pack?.evidenceFreshness,
    exceptionSeverity: pack?.exceptionSeverity,
    externalUseAllowed: pack?.evidenceFreshness === "current" && pack?.readinessState === "ready",
  });

const makeScorecardItem = ({
  key,
  title,
  workstream,
  owner,
  reviewer,
  state,
  sourceSystem,
  latestMetric,
  externalUseAllowed = false,
  gaps = [],
  decisionRule,
  actionPath = "/admin/assurance",
} = {}) => ({
  key,
  title,
  workstream,
  owner,
  reviewer,
  state,
  score: STATE_SCORE[state] || 0,
  sourceSystem,
  latestMetric,
  externalUseAllowed: Boolean(externalUseAllowed && state === "ready"),
  approvalState: approvalStateFromCapitalState(state),
  gaps: gaps.filter(Boolean).slice(0, 6),
  decisionRule,
  actionPath,
});

const financeCurrency = (financeClose = {}) => String(financeClose?.summary?.currency || "NGN");

const formatMoneyMetric = (amount, currency) => `${currency} ${clampMoney(amount).toLocaleString()}`;

const buildReadinessScorecard = ({ assuranceDashboard, financeClose }) => {
  const maps = buildMaps(assuranceDashboard);
  const currency = financeCurrency(financeClose);
  const summary = financeClose.summary || {};
  const grossPaid = asNumber(summary.grossPaidAmount);
  const creatorConfidenceRate = asNumber(summary.creatorBalanceConfidenceRate, 1);
  const disputeGap = (financeClose.evidenceGaps || []).find((gap) => gap.key === "provider_dispute_feed");

  const gmvMetric = maps.metrics.get("gmv");
  const creatorEarningsMetric = maps.metrics.get("creator_earnings");
  const payoutMetric = maps.metrics.get("payout_aging");
  const subscriptionMetric = maps.metrics.get("subscription_retention");
  const financeControl = maps.controls.get("finance_revenue_close");
  const walletControl = maps.controls.get("wallet_settlement_accuracy");
  const payoutControl = maps.controls.get("payout_outcome_control");
  const partnerPack = maps.packs.get("partner_assurance_pack");
  const marketPack = maps.packs.get("market_assurance_pack");
  const dataPack = maps.packs.get("metric_contract_registry");
  const akusoGate = maps.gates.get("akuso_readiness");
  const trustGate = maps.gates.get("trust_rights_privacy_readiness");
  const partnerGate = maps.gates.get("partner_api_market_readiness");

  const gmvState =
    grossPaid > 0
      ? metricEvidenceState(gmvMetric)
      : worstCapitalState([metricEvidenceState(gmvMetric), "evidence_needed"]);
  const revenueQualityState = worstCapitalState([
    grossPaid > 0 ? controlEvidenceState(financeControl) : "evidence_needed",
    metricEvidenceState(gmvMetric),
  ]);
  const creatorEarningsState = worstCapitalState([
    metricEvidenceState(creatorEarningsMetric),
    controlEvidenceState(walletControl),
    summary.creatorBalanceConfidenceState === "degraded" ? "remediation_needed" : "ready",
  ]);
  const payoutState = worstCapitalState([
    metricEvidenceState(payoutMetric),
    controlEvidenceState(payoutControl),
    asNumber(summary.payoutFailedCount) > 0 ? "near_ready" : "ready",
  ]);
  const refundDisputeState = worstCapitalState([
    asNumber(summary.refundWalletMissingEntries) > 0 ? "remediation_needed" : "ready",
    disputeGap ? "evidence_needed" : "ready",
  ]);
  const dataRoomState = packEvidenceState(dataPack);
  const partnerState = worstCapitalState([
    packEvidenceState(partnerPack),
    capitalStateFromEvidence({ readinessState: partnerGate?.readinessState, externalUseAllowed: false }),
  ]);
  const marketState = worstCapitalState([
    packEvidenceState(marketPack),
    capitalStateFromEvidence({ readinessState: partnerGate?.readinessState, externalUseAllowed: false }),
  ]);
  const trustState = capitalStateFromEvidence({
    readinessState: trustGate?.readinessState,
    externalUseAllowed: trustGate?.readinessState === "ready",
  });
  const akusoState = capitalStateFromEvidence({
    readinessState: akusoGate?.readinessState,
    externalUseAllowed: akusoGate?.readinessState === "ready",
  });

  return [
    makeScorecardItem({
      key: "trusted_gmv",
      title: "Trusted GMV",
      workstream: "Financial controls and unit economics",
      owner: "Finance and operations",
      reviewer: "Data and analytics",
      state: gmvState,
      sourceSystem: "finance_assurance_close.metric_contracts.gmv",
      latestMetric: formatMoneyMetric(grossPaid, currency),
      externalUseAllowed: Boolean(gmvMetric?.externalUseAllowed && grossPaid > 0),
      gaps: [
        grossPaid <= 0 ? "No paid GMV in the current close window." : "",
        ...(gmvMetric?.blockingControls || []).map((key) => `${titleize(key)} blocks GMV trust.`),
      ],
      decisionRule: "Investor materials may use GMV only when the metric contract is trusted and the close has paid volume.",
      actionPath: "/admin/creator-earnings",
    }),
    makeScorecardItem({
      key: "revenue_quality",
      title: "Revenue Quality",
      workstream: "Financial controls and unit economics",
      owner: "Finance and operations",
      reviewer: "Product leadership",
      state: revenueQualityState,
      sourceSystem: "finance_assurance_close",
      latestMetric: `${summary.successfulPayments || 0} paid, ${summary.refundedPayments || 0} refunded`,
      externalUseAllowed: revenueQualityState === "ready",
      gaps: [
        grossPaid <= 0 ? "Revenue quality needs paid transaction evidence." : "",
        ...(financeClose.exceptions || []).slice(0, 3).map((entry) => entry.label || entry.key),
      ],
      decisionRule: "Do not claim revenue quality while payment, wallet, entitlement, refund, payout, or webhook exceptions remain open.",
      actionPath: "/admin/creator-earnings",
    }),
    makeScorecardItem({
      key: "creator_earnings_confidence",
      title: "Creator Earnings Confidence",
      workstream: "Financial controls and unit economics",
      owner: "Finance and operations",
      reviewer: "Creator success",
      state: creatorEarningsState,
      sourceSystem: "wallet_entries.creator_balances",
      latestMetric: `${Math.round(creatorConfidenceRate * 100)}% creator balance confidence`,
      externalUseAllowed: creatorEarningsState === "ready",
      gaps: [
        summary.creatorBalanceConfidenceState === "degraded" ? "Creator balance confidence is degraded." : "",
        ...(creatorEarningsMetric?.blockingControls || []).map((key) => `${titleize(key)} blocks creator earnings confidence.`),
      ],
      decisionRule: "Creator economics claims require current wallet, refund, payout, and creator balance confidence evidence.",
      actionPath: "/admin/creator-earnings",
    }),
    makeScorecardItem({
      key: "payout_confidence",
      title: "Payout Confidence",
      workstream: "Financial controls and unit economics",
      owner: "Finance and operations",
      reviewer: "Creator success",
      state: payoutState,
      sourceSystem: "creator_payout_requests",
      latestMetric: `${formatMoneyMetric(summary.payoutOpenAmount, currency)} open payout exposure`,
      externalUseAllowed: payoutState === "ready",
      gaps: [
        asNumber(summary.payoutFailedCount) > 0 ? `${summary.payoutFailedCount} failed payouts need owner follow-up.` : "",
        ...(payoutMetric?.blockingControls || []).map((key) => `${titleize(key)} blocks payout confidence.`),
      ],
      decisionRule: "Payout readiness claims require reconciled paid payouts, current payout aging, and no unresolved payout failures.",
      actionPath: "/admin/creator-earnings",
    }),
    makeScorecardItem({
      key: "refund_dispute_handling",
      title: "Refund And Dispute Handling",
      workstream: "Financial controls and unit economics",
      owner: "Finance and operations",
      reviewer: "Product leadership",
      state: refundDisputeState,
      sourceSystem: "refunds_and_provider_disputes",
      latestMetric: `${formatMoneyMetric(summary.refundedAmount, currency)} refunded; provider dispute source ${disputeGap ? "blocked" : "current"}`,
      externalUseAllowed: refundDisputeState === "ready",
      gaps: [
        disputeGap?.note || "",
        asNumber(summary.refundWalletMissingEntries) > 0 ? "Refund wallet entries are missing." : "",
      ],
      decisionRule: "Refund and dispute exposure claims remain internal until provider dispute evidence is configured and current.",
      actionPath: "/admin/creator-earnings",
    }),
    makeScorecardItem({
      key: "creator_retention",
      title: "Creator Retention",
      workstream: "Growth investment and capital allocation",
      owner: "Data and analytics",
      reviewer: "Creator success",
      state: dataRoomState,
      sourceSystem: "metric_contract_registry.creator_cohorts",
      latestMetric: "Creator cohort retention contract pending",
      externalUseAllowed: false,
      gaps: ["Attach creator cohort retention definitions, owners, source, and confidence state."],
      decisionRule: "Do not underwrite creator acquisition spend without cohort retention and payback evidence.",
      actionPath: "/admin/analytics",
    }),
    makeScorecardItem({
      key: "fan_retention",
      title: "Fan Retention",
      workstream: "Growth investment and capital allocation",
      owner: "Data and analytics",
      reviewer: "Product leadership",
      state: dataRoomState,
      sourceSystem: "metric_contract_registry.fan_cohorts",
      latestMetric: "Repeat buyer and fan retention contracts pending",
      externalUseAllowed: false,
      gaps: ["Attach repeat buyer, fan retention, and notification complaint confidence evidence."],
      decisionRule: "Fan growth spend needs retention evidence before capital allocation expands.",
      actionPath: "/admin/analytics",
    }),
    makeScorecardItem({
      key: "subscription_retention",
      title: "Subscription Retention",
      workstream: "Financial controls and unit economics",
      owner: "Data and analytics",
      reviewer: "Product leadership",
      state: metricEvidenceState(subscriptionMetric),
      sourceSystem: "metric_contract_registry.subscription_retention",
      latestMetric: "Subscription retention contract pending",
      externalUseAllowed: Boolean(subscriptionMetric?.externalUseAllowed),
      gaps: (subscriptionMetric?.blockingControls || []).map((key) => `${titleize(key)} blocks subscription retention trust.`),
      decisionRule: "Subscription projections need approved retention definitions before external use.",
      actionPath: "/admin/analytics",
    }),
    makeScorecardItem({
      key: "acquisition_efficiency",
      title: "Acquisition Efficiency",
      workstream: "Growth investment and capital allocation",
      owner: "Growth and analytics",
      reviewer: "Finance and operations",
      state: dataRoomState,
      sourceSystem: "assumption_register.creator_and_fan_cac",
      latestMetric: "CAC, payback, and conversion assumptions pending",
      externalUseAllowed: false,
      gaps: ["Attach creator CAC, fan CAC, conversion, payback, and sensitivity assumptions with owner review."],
      decisionRule: "Do not scale acquisition budget from unsupported CAC or payback assumptions.",
      actionPath: "/admin/analytics",
    }),
    makeScorecardItem({
      key: "partner_pipeline",
      title: "Partner Pipeline",
      workstream: "Investor, strategic partner, and diligence operations",
      owner: "Partnerships",
      reviewer: "Security and compliance",
      state: partnerState,
      sourceSystem: "partner_assurance_pack",
      latestMetric: partnerPack?.latestEvidenceSummary || "Partner assurance pack pending",
      externalUseAllowed: false,
      gaps: partnerPack?.openRisks?.map((risk) => risk.note || risk.controlKey) || ["Partner assurance evidence pending."],
      decisionRule: "Strategic capital cannot bypass scoped access, minimization, privacy review, and revocation evidence.",
      actionPath: "/admin/assurance",
    }),
    makeScorecardItem({
      key: "market_readiness",
      title: "Market Readiness",
      workstream: "Growth investment and capital allocation",
      owner: "Product leadership",
      reviewer: "Trust, policy, and legal",
      state: marketState,
      sourceSystem: "market_assurance_pack",
      latestMetric: marketPack?.latestEvidenceSummary || "Market assurance pack pending",
      externalUseAllowed: false,
      gaps: marketPack?.openRisks?.map((risk) => risk.note || risk.controlKey) || ["Market launch evidence pending."],
      decisionRule: "Market expansion spend remains gated by money movement, trust, privacy, rights, partner, support, and Akuso evidence.",
      actionPath: "/admin/assurance",
    }),
    makeScorecardItem({
      key: "security_privacy_posture",
      title: "Security And Privacy Posture",
      workstream: "Capital risk, governance, and external claims",
      owner: "Security and compliance",
      reviewer: "Trust, policy, and legal",
      state: trustState,
      sourceSystem: "trust_rights_privacy_readiness",
      latestMetric: `${titleize(trustGate?.readinessState || "needs_review")} trust, rights, and privacy gate`,
      externalUseAllowed: trustState === "ready",
      gaps: [trustGate?.blockerCondition || "Attach privacy, rights, access, and sensitive-data sharing evidence."],
      decisionRule: "Data-room, partner, and market sharing pause when security or privacy evidence is stale or blocked.",
      actionPath: "/admin/assurance",
    }),
    makeScorecardItem({
      key: "compliance_audit_posture",
      title: "Compliance And Audit Posture",
      workstream: "Capital risk, governance, and external claims",
      owner: "Compliance, legal, and advisors",
      reviewer: "Product leadership",
      state: worstCapitalState([trustState, dataRoomState]),
      sourceSystem: "assurance_dashboard.evidence_pack_standard",
      latestMetric: "Evidence pack standard active; legal and tax review triggers pending",
      externalUseAllowed: false,
      gaps: ["Add legal, tax, fundraising, and advisor review triggers before investor-ready sharing."],
      decisionRule: "Capital materials stay internal until advisor review needs and external sharing restrictions are explicit.",
      actionPath: "/admin/assurance",
    }),
    makeScorecardItem({
      key: "data_room_freshness",
      title: "Data-room Freshness",
      workstream: "Investor, strategic partner, and diligence operations",
      owner: "Product leadership",
      reviewer: "Compliance, legal, and advisors",
      state: dataRoomState,
      sourceSystem: "metric_contract_registry_and_evidence_packs",
      latestMetric: dataPack?.latestEvidenceSummary || "Metric contract registry pending",
      externalUseAllowed: false,
      gaps: dataPack?.openRisks?.map((risk) => risk.note || risk.controlKey) || ["Data-room packet states and access review are pending."],
      decisionRule: "Pause data-room sharing when documents, metrics, assumptions, or claim approvals are stale.",
      actionPath: "/admin/assurance",
    }),
    makeScorecardItem({
      key: "akuso_governance",
      title: "Akuso Governance",
      workstream: "Akuso AI investment governance",
      owner: "AI and assistant",
      reviewer: "Trust, policy, and legal",
      state: akusoState,
      sourceSystem: "akuso_readiness_gate",
      latestMetric: `${titleize(akusoGate?.readinessState || "needs_review")} Akuso gate`,
      externalUseAllowed: akusoState === "ready",
      gaps: [akusoGate?.blockerCondition || "Attach eval, source, refusal, incident, privacy, and AI cost evidence."],
      decisionRule: "Akuso spend and external AI claims require current eval, source, refusal, privacy, incident, and cost evidence.",
      actionPath: "/admin/assistant/metrics",
    }),
    makeScorecardItem({
      key: "team_capacity",
      title: "Team Capacity",
      workstream: "Capital strategy and runway",
      owner: "Product leadership",
      reviewer: "Finance and operations",
      state: worstCapitalState([dataRoomState, akusoState, partnerState]),
      sourceSystem: "capital_operating_cadence",
      latestMetric: "Owner coverage inferred from open evidence and capital gates",
      externalUseAllowed: false,
      gaps: ["Add owner capacity, hiring assumptions, and milestone burn review before expanding capital commitments."],
      decisionRule: "If the team cannot maintain finance, trust, data-room, support, and Akuso controls, delay outreach.",
      actionPath: "/admin/assurance",
    }),
  ];
};

const buildScenarioInputs = ({ financeClose, scorecard = [], startingCashBalance = null }) => {
  const currency = financeCurrency(financeClose);
  const summary = financeClose.summary || {};
  const reconciliation = financeClose.reconciliation || {};
  const filters = financeClose.filters || {};
  const start = new Date(filters.startDate || Date.now());
  const end = new Date(filters.endDate || Date.now());
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) || 30);
  const monthlyFactor = 30 / days;
  const scorecardMap = new Map(scorecard.map((entry) => [entry.key, entry]));
  const gmvReady = scorecardMap.get("trusted_gmv")?.state === "ready";
  const financeReady = scorecardMap.get("revenue_quality")?.state === "ready";
  const creatorReady = scorecardMap.get("creator_earnings_confidence")?.state === "ready";
  const disputeReady = scorecardMap.get("refund_dispute_handling")?.state === "ready";

  const baseGrossPaid = clampMoney(asNumber(summary.grossPaidAmount) * monthlyFactor);
  const basePlatformRevenue = clampMoney(
    asNumber(reconciliation.wallet?.expectedPlatformFees, asNumber(summary.grossPaidAmount) * 0.6) * monthlyFactor
  );
  const baseCreatorEarnings = clampMoney(
    asNumber(reconciliation.wallet?.expectedCreatorCredits, asNumber(summary.grossPaidAmount) * 0.4) * monthlyFactor
  );
  const baseRefunds = clampMoney(asNumber(summary.refundedAmount) * monthlyFactor);
  const basePayoutExposure = clampMoney(asNumber(summary.payoutOpenAmount));

  return SCENARIOS.map((scenario) => {
    const grossPaidAmount = clampMoney(baseGrossPaid * scenario.revenueMultiplier);
    const platformRevenue = clampMoney(basePlatformRevenue * scenario.revenueMultiplier);
    const creatorEarnings = clampMoney(baseCreatorEarnings * scenario.revenueMultiplier);
    const payoutExposure = clampMoney(basePayoutExposure * scenario.revenueMultiplier);
    const refundReserve = clampMoney(Math.max(baseRefunds * scenario.revenueMultiplier, grossPaidAmount * 0.02));
    const disputeReserve = clampMoney(grossPaidAmount * 0.01);
    const paymentFees = clampMoney(grossPaidAmount * 0.015);
    const infrastructureCost = clampMoney(Math.max(30000, grossPaidAmount * 0.04) * scenario.costMultiplier);
    const storageMediaCost = clampMoney(Math.max(10000, grossPaidAmount * 0.015) * scenario.costMultiplier);
    const supportCost = clampMoney(Math.max(15000, grossPaidAmount * 0.03) * scenario.costMultiplier);
    const moderationCost = clampMoney(Math.max(10000, grossPaidAmount * 0.02) * scenario.costMultiplier);
    const akusoModelCost = clampMoney(Math.max(20000, grossPaidAmount * 0.025) * scenario.costMultiplier);
    const vendorCost = clampMoney(Math.max(10000, grossPaidAmount * 0.015) * scenario.costMultiplier);
    const hiringCost = clampMoney(0);
    const partnerCost = clampMoney(Math.max(5000, grossPaidAmount * 0.01) * scenario.costMultiplier);
    const operatingCost = clampMoney(
      paymentFees +
        infrastructureCost +
        storageMediaCost +
        supportCost +
        moderationCost +
        akusoModelCost +
        vendorCost +
        hiringCost +
        partnerCost
    );
    const netBurn = clampMoney(Math.max(0, operatingCost + refundReserve + disputeReserve - platformRevenue));
    const runwayMonths =
      startingCashBalance !== null && netBurn > 0
        ? Number((startingCashBalance / netBurn).toFixed(2))
        : null;

    return {
      key: scenario.key,
      title: scenario.title,
      assumption: scenario.assumption,
      currency,
      planningWindow: "monthly_normalized_from_close_window",
      startingCashBalance: startingCashBalance === null ? null : money(startingCashBalance, currency),
      grossPaidAmount: money(grossPaidAmount, currency),
      platformRevenue: money(platformRevenue, currency),
      creatorEarnings: money(creatorEarnings, currency),
      payoutExposure: money(payoutExposure, currency),
      refundReserve: money(refundReserve, currency),
      disputeReserve: money(disputeReserve, currency),
      paymentFees: money(paymentFees, currency),
      infrastructureCost: money(infrastructureCost, currency),
      storageMediaCost: money(storageMediaCost, currency),
      supportCost: money(supportCost, currency),
      moderationCost: money(moderationCost, currency),
      akusoModelCost: money(akusoModelCost, currency),
      vendorCost: money(vendorCost, currency),
      hiringCost: money(hiringCost, currency),
      partnerCost: money(partnerCost, currency),
      operatingCost: money(operatingCost, currency),
      netBurn: money(netBurn, currency),
      runwayMonths,
      runwayStatus:
        startingCashBalance === null
          ? "cash_balance_required"
          : netBurn === 0
            ? "cash_flow_positive_or_break_even"
            : "modeled_from_inputs",
      inputLabels: [
        {
          key: "gross_paid_amount",
          label: "GMV",
          classification: gmvReady ? "actual" : "not_approved_for_external_use",
          confidenceState: scorecardMap.get("trusted_gmv")?.state || "evidence_needed",
        },
        {
          key: "platform_revenue",
          label: "Platform revenue",
          classification: financeReady ? "actual" : "not_approved_for_external_use",
          confidenceState: scorecardMap.get("revenue_quality")?.state || "evidence_needed",
        },
        {
          key: "creator_earnings",
          label: "Creator earnings",
          classification: creatorReady ? "actual" : "not_approved_for_external_use",
          confidenceState: scorecardMap.get("creator_earnings_confidence")?.state || "evidence_needed",
        },
        {
          key: "refund_reserve",
          label: "Refund reserve",
          classification: baseRefunds > 0 ? "estimated_from_actuals" : "assumption",
          confidenceState: scorecardMap.get("refund_dispute_handling")?.state || "evidence_needed",
        },
        {
          key: "dispute_reserve",
          label: "Dispute reserve",
          classification: disputeReady ? "estimated" : "coverage_gap",
          confidenceState: scorecardMap.get("refund_dispute_handling")?.state || "evidence_needed",
        },
        {
          key: "operating_costs",
          label: "Support, moderation, infrastructure, vendor, partner, and Akuso cost",
          classification: "assumption",
          confidenceState: "not_approved_for_external_use",
        },
        {
          key: "starting_cash_balance",
          label: "Starting cash balance",
          classification: startingCashBalance === null ? "not_configured" : "actual_input",
          confidenceState: startingCashBalance === null ? "not_approved_for_external_use" : "internal_input",
        },
      ],
    };
  });
};

const buildUseOfFundsGates = (scorecard = []) => {
  const scorecardMap = new Map(scorecard.map((entry) => [entry.key, entry]));
  return USE_OF_FUNDS_DEFINITIONS.map((definition) => {
    const dependencyStates = definition.dependencies.map((key) => scorecardMap.get(key)?.state || "evidence_needed");
    const capitalState = worstCapitalState(dependencyStates);
    const gateState = gateStateFromCapitalState(capitalState);
    return {
      ...definition,
      gateState,
      capitalReadinessState: capitalState,
      blockingDependencies: definition.dependencies
        .map((key) => scorecardMap.get(key))
        .filter((entry) => entry && !["ready", "near_ready"].includes(entry.state))
        .map((entry) => ({
          key: entry.key,
          title: entry.title,
          state: entry.state,
          owner: entry.owner,
        })),
      decision:
        gateState === "ready"
          ? "Eligible for budget review."
          : gateState === "conditional"
            ? "Eligible only with owner-reviewed limits and a stop-loss date."
            : gateState === "evidence_needed"
              ? "Hold spend until evidence and assumptions are attached."
              : "Blocked until remediation closes.",
    };
  });
};

const buildCapitalPathOptions = (scorecard = []) => {
  const scorecardMap = new Map(scorecard.map((entry) => [entry.key, entry]));
  return FINANCING_PATH_DEFINITIONS.map((definition) => {
    const dependencyStates = definition.requiredScorecardKeys.map(
      (key) => scorecardMap.get(key)?.state || "evidence_needed"
    );
    const readinessState =
      definition.key === "delay_capital_and_prove_milestones"
        ? "ready"
        : worstCapitalState(dependencyStates);
    return {
      ...definition,
      readinessState,
      status:
        readinessState === "ready"
          ? "plausible"
          : readinessState === "near_ready"
            ? "conditional"
            : readinessState === "evidence_needed"
              ? "premature_until_evidence_attached"
              : "not_recommended",
      missingEvidence: definition.requiredScorecardKeys
        .map((key) => scorecardMap.get(key))
        .filter((entry) => entry && !["ready", "near_ready"].includes(entry.state))
        .map((entry) => ({
          key: entry.key,
          title: entry.title,
          state: entry.state,
          owner: entry.owner,
        })),
    };
  });
};

const buildClaimRegister = ({ scorecard = [], assuranceDashboard = {}, financeClose = {} }) => {
  const scorecardMap = new Map(scorecard.map((entry) => [entry.key, entry]));
  const metricMap = new Map((assuranceDashboard.metricContracts || []).map((entry) => [entry.key, entry]));
  const currency = financeCurrency(financeClose);
  const summary = financeClose.summary || {};
  const claimValues = {
    gmv_revenue_claim: formatMoneyMetric(summary.grossPaidAmount, currency),
    revenue_quality_claim: `${summary.successfulPayments || 0} paid payments; ${summary.exceptionCount || 0} finance exceptions`,
    creator_economics_claim: `${Math.round(asNumber(summary.creatorBalanceConfidenceRate, 1) * 100)}% creator balance confidence`,
    payout_refund_claim: `${formatMoneyMetric(summary.payoutOpenAmount, currency)} open payout exposure; ${formatMoneyMetric(summary.refundedAmount, currency)} refunded`,
    market_partner_claim: "Partner and market evidence pack status",
    akuso_ai_claim: "Akuso readiness gate status",
  };

  return CLAIM_DEFINITIONS.map((definition) => {
    const scorecardItem = scorecardMap.get(definition.scorecardKey);
    const metric = metricMap.get(definition.metricKey);
    const state = scorecardItem?.state || "evidence_needed";
    const approvalState =
      state === "ready" && (metric?.externalUseAllowed || !metric)
        ? "approved_for_advisor_review"
        : state === "not_ready" || state === "remediation_needed"
          ? "withdrawn"
          : "internal_only";

    return {
      ...definition,
      value: claimValues[definition.key] || scorecardItem?.latestMetric || "",
      capitalReadinessState: state,
      approvalState,
      owner: scorecardItem?.owner || "Product leadership",
      reviewer: scorecardItem?.reviewer || "Compliance, legal, and advisors",
      sourceSystem: scorecardItem?.sourceSystem || metric?.sourceSystem || "capital_readiness_scorecard",
      externalUseAllowed: approvalState === "approved_for_advisor_review",
      blockingEvidence: scorecardItem?.gaps || [],
    };
  });
};

const buildDataRoomPackets = (scorecard = [], claimRegister = []) => {
  const scorecardMap = new Map(scorecard.map((entry) => [entry.key, entry]));
  const claimMap = new Map(claimRegister.map((entry) => [entry.key, entry]));

  return PACKET_DEFINITIONS.map((definition) => {
    const dependencyStates = definition.requiredScorecardKeys.map(
      (key) => scorecardMap.get(key)?.state || "evidence_needed"
    );
    const readinessState = worstCapitalState(dependencyStates);
    const relatedClaims = claimRegister.filter((claim) =>
      definition.requiredScorecardKeys.includes(claim.scorecardKey)
    );
    const shareState =
      readinessState === "ready" && relatedClaims.every((claim) => claim.externalUseAllowed)
        ? "approved_for_advisor_review"
        : readinessState === "not_ready" || readinessState === "remediation_needed"
          ? "restricted"
          : "internal_draft";

    return {
      ...definition,
      readinessState,
      shareState,
      requiredSections: [
        "owner_and_reviewer",
        "source_evidence",
        "current_metrics",
        "assumptions",
        "open_risks",
        "approval_state",
        "next_review_date",
      ],
      relatedClaims: relatedClaims.map((claim) => ({
        key: claim.key,
        title: claim.title,
        approvalState: claim.approvalState,
      })),
      missingEvidence: definition.requiredScorecardKeys
        .map((key) => scorecardMap.get(key))
        .filter((entry) => entry && !["ready", "near_ready"].includes(entry.state))
        .map((entry) => ({
          key: entry.key,
          title: entry.title,
          state: entry.state,
          owner: entry.owner,
        })),
      accessRule:
        shareState === "approved_for_advisor_review"
          ? "Advisor review only; investor or strategic partner sharing still requires explicit approval."
          : "Do not share externally until missing evidence, claim approvals, and access review are complete.",
      primaryClaim: claimMap.get("gmv_revenue_claim")?.approvalState || "internal_only",
    };
  });
};

const capitalStateFromPacketShareState = (shareState = "") => {
  const normalized = String(shareState || "").trim().toLowerCase();
  if (
    [
      "approved_for_advisor_review",
      "approved_for_investor_review",
      "approved_for_strategic_partner_review",
    ].includes(normalized)
  ) {
    return "ready";
  }
  if (["internal_with_conditions", "advisor_review_only"].includes(normalized)) {
    return "near_ready";
  }
  if (["restricted", "blocked"].includes(normalized)) {
    return "remediation_needed";
  }
  if (["withdrawn", "revoked"].includes(normalized)) {
    return "not_ready";
  }
  return "evidence_needed";
};

const capitalStateFromClaimApprovalState = (approvalState = "") => {
  const normalized = String(approvalState || "").trim().toLowerCase();
  if (
    [
      "approved_for_advisor_review",
      "approved_for_investor_review",
      "approved_for_strategic_partner_review",
    ].includes(normalized)
  ) {
    return "ready";
  }
  if (["internal_with_conditions", "conditional"].includes(normalized)) {
    return "near_ready";
  }
  if (["restricted", "blocked"].includes(normalized)) {
    return "remediation_needed";
  }
  if (["withdrawn", "revoked"].includes(normalized)) {
    return "not_ready";
  }
  return "evidence_needed";
};

const conversationStateFromCapitalState = (state = "", audience = "") => {
  if (state === "ready") {
    return audience === "advisor" ? "ready_for_advisor_review" : "ready_for_controlled_outreach";
  }
  if (state === "near_ready") {
    return "advisor_review_only";
  }
  if (state === "evidence_needed") {
    return "hold_for_evidence";
  }
  if (state === "remediation_needed") {
    return "blocked_for_remediation";
  }
  return "do_not_contact";
};

const qaResponseStateFromCapitalState = (state = "") => {
  if (state === "ready") {
    return "approved_response";
  }
  if (state === "near_ready") {
    return "conditional_response";
  }
  if (state === "evidence_needed") {
    return "draft_needs_evidence";
  }
  if (state === "remediation_needed") {
    return "restricted_response";
  }
  return "withdrawn_response";
};

const diligenceNextStep = (state = "", audience = "") => {
  if (state === "ready") {
    return audience === "advisor"
      ? "Schedule targeted advisor review with the approved packet and claim boundaries."
      : "Open controlled outreach only with approved packet, claim, Q&A, and escalation routing.";
  }
  if (state === "near_ready") {
    return "Run advisor review, narrow weak claims, and attach conditions before external outreach.";
  }
  if (state === "evidence_needed") {
    return "Hold outreach until owners attach evidence, packet states, and approved response boundaries.";
  }
  if (state === "remediation_needed") {
    return "Block outreach until remediation closes and the affected claims or packets are re-approved.";
  }
  return "Do not contact or share materials until withdrawn evidence is replaced and reviewed.";
};

const makeMissingDependency = (dependency = {}) => ({
  kind: dependency.kind,
  key: dependency.key,
  title: dependency.title,
  state: dependency.state,
  status: dependency.status,
  owner: dependency.owner,
});

const buildDiligenceDependencies = ({ definition = {}, scorecardMap, claimMap, packetMap }) => {
  const scorecardDependencies = (definition.requiredScorecardKeys || []).map((key) => {
    const entry = scorecardMap.get(key);
    return {
      kind: "scorecard",
      key,
      title: entry?.title || titleize(key),
      state: entry?.state || "evidence_needed",
      status: entry?.approvalState || entry?.state || "missing",
      owner: entry?.owner || "Unassigned",
    };
  });

  const packetDependencies = (definition.requiredPacketKeys || []).map((key) => {
    const entry = packetMap.get(key);
    const shareState = entry?.shareState || "missing";
    return {
      kind: "packet",
      key,
      title: entry?.title || titleize(key),
      state: capitalStateFromPacketShareState(shareState),
      status: shareState,
      owner: entry?.owner || "Unassigned",
    };
  });

  const claimDependencies = (definition.requiredClaimKeys || []).map((key) => {
    const entry = claimMap.get(key);
    const approvalState = entry?.approvalState || "missing";
    return {
      kind: "claim",
      key,
      title: entry?.title || titleize(key),
      state: capitalStateFromClaimApprovalState(approvalState),
      status: approvalState,
      owner: entry?.owner || "Unassigned",
    };
  });

  return [...scorecardDependencies, ...packetDependencies, ...claimDependencies];
};

const findDiligenceRiskMatches = (definition = {}, riskRegister = []) => {
  const keywords = (definition.riskKeywords || []).map((keyword) => String(keyword || "").toLowerCase());
  if (!keywords.length) {
    return [];
  }
  return riskRegister
    .filter((risk) => {
      const haystack = [
        risk.key,
        risk.title,
        risk.owner,
        risk.severity,
        risk.sourceSystem,
        risk.mitigation,
        risk.nextAction,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return keywords.some((keyword) => haystack.includes(keyword));
    })
    .slice(0, 5);
};

const riskStateFromMatches = (riskMatches = []) => {
  if (riskMatches.some((risk) => ["critical", "high"].includes(String(risk.severity || "").toLowerCase()))) {
    return "remediation_needed";
  }
  return riskMatches.length ? "evidence_needed" : "ready";
};

const buildDiligencePipeline = ({ scorecard = [], claimRegister = [], dataRoomPackets = [], riskRegister = [] }) => {
  const scorecardMap = new Map(scorecard.map((entry) => [entry.key, entry]));
  const claimMap = new Map(claimRegister.map((entry) => [entry.key, entry]));
  const packetMap = new Map(dataRoomPackets.map((entry) => [entry.key, entry]));

  return DILIGENCE_PIPELINE_DEFINITIONS.map((definition) => {
    const dependencies = buildDiligenceDependencies({ definition, scorecardMap, claimMap, packetMap });
    const riskMatches = findDiligenceRiskMatches(definition, riskRegister);
    const readinessState = worstCapitalState([
      ...dependencies.map((dependency) => dependency.state),
      riskStateFromMatches(riskMatches),
    ]);
    const conversationState = conversationStateFromCapitalState(readinessState, definition.audience);
    const missingEvidence = dependencies
      .filter((dependency) => !["ready", "near_ready"].includes(dependency.state))
      .map(makeMissingDependency);
    const riskEvidence = riskMatches.map((risk) => ({
      kind: "risk",
      key: risk.key,
      title: risk.title,
      state: risk.capitalReadinessState || "evidence_needed",
      status: risk.severity || "medium",
      owner: risk.owner,
    }));

    return {
      ...definition,
      readinessState,
      conversationState,
      approvedPacketCount: dependencies.filter((dependency) => dependency.kind === "packet" && dependency.state === "ready").length,
      requiredPacketCount: (definition.requiredPacketKeys || []).length,
      approvedClaimCount: dependencies.filter((dependency) => dependency.kind === "claim" && dependency.state === "ready").length,
      requiredClaimCount: (definition.requiredClaimKeys || []).length,
      missingEvidence: [...missingEvidence, ...riskEvidence].slice(0, 8),
      riskFlags: riskMatches.map((risk) => ({
        key: risk.key,
        title: risk.title,
        severity: risk.severity,
        owner: risk.owner,
        nextAction: risk.nextAction,
      })),
      controls: [
        "approved_packet_required",
        "approved_claims_only",
        "q_and_a_owner_review",
        "sensitive_topic_escalation",
        "stale_document_hold",
      ],
      nextStep: diligenceNextStep(readinessState, definition.audience),
    };
  });
};

const buildDiligenceQaWorkflow = ({ scorecard = [], claimRegister = [], dataRoomPackets = [] }) => {
  const scorecardMap = new Map(scorecard.map((entry) => [entry.key, entry]));
  const claimMap = new Map(claimRegister.map((entry) => [entry.key, entry]));
  const packetMap = new Map(dataRoomPackets.map((entry) => [entry.key, entry]));

  return DILIGENCE_QA_DEFINITIONS.map((definition) => {
    const dependencies = buildDiligenceDependencies({ definition, scorecardMap, claimMap, packetMap });
    const readinessState = worstCapitalState(dependencies.map((dependency) => dependency.state));
    const responseState = qaResponseStateFromCapitalState(readinessState);
    const blockingEvidence = dependencies
      .filter((dependency) => !["ready", "near_ready"].includes(dependency.state))
      .map(makeMissingDependency);

    return {
      ...definition,
      readinessState,
      responseState,
      blockingEvidence: blockingEvidence.slice(0, 8),
      requiredEvidence: dependencies.map(makeMissingDependency),
      responseControls: [
        "cite_source_evidence",
        "separate_actuals_from_assumptions",
        "respect_approval_state",
        "route_sensitive_terms",
        "log_follow_up_owner",
      ],
      nextStep:
        responseState === "approved_response"
          ? "Answer from approved packet and claim register."
          : responseState === "conditional_response"
            ? "Answer only with conditions and route follow-up to the reviewer."
            : responseState === "draft_needs_evidence"
              ? "Keep response in draft until missing evidence is attached."
              : "Do not answer externally until remediation or withdrawal review closes.",
    };
  });
};

const dedupeRisks = (risks = []) => {
  const seen = new Set();
  return risks.filter((risk) => {
    const key = risk.key || risk.title;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const buildCapitalRiskRegister = ({ scorecard = [], assuranceDashboard = {}, financeClose = {}, scenarios = [] }) => {
  const scorecardRisks = scorecard
    .filter((entry) => !["ready", "near_ready"].includes(entry.state))
    .map((entry) => ({
      key: `scorecard_${entry.key}`,
      title: entry.title,
      owner: entry.owner,
      severity: entry.state === "not_ready" ? "critical" : entry.state === "remediation_needed" ? "high" : "medium",
      capitalReadinessState: entry.state,
      sourceSystem: entry.sourceSystem,
      mitigation: entry.decisionRule,
      nextAction: entry.gaps[0] || "Attach owner-reviewed evidence.",
    }));

  const alertRisks = (assuranceDashboard.alerts || []).slice(0, 8).map((alert) => ({
    key: `assurance_${alert.controlKey || alert.key}`,
    title: alert.surface || alert.controlKey,
    owner: alert.owner,
    severity: alert.severity || "medium",
    capitalReadinessState: capitalStateFromEvidence({
      readinessState: alert.readinessState,
      evidenceFreshness: alert.evidenceFreshness,
      exceptionSeverity: alert.severity,
      externalUseAllowed: false,
    }),
    sourceSystem: "assurance_dashboard",
    mitigation: alert.message,
    nextAction: `Review ${alert.actionPath || "/admin/assurance"}.`,
  }));

  const financeGapRisks = (financeClose.evidenceGaps || []).map((gap) => ({
    key: `finance_gap_${gap.key}`,
    title: titleize(gap.key),
    owner: gap.owner || "Finance and operations",
    severity: gap.severity || "medium",
    capitalReadinessState: gap.status === "blocked" ? "evidence_needed" : "near_ready",
    sourceSystem: "finance_assurance_close",
    mitigation: gap.note,
    nextAction: "Configure source evidence or keep related claims internal.",
  }));

  const scenarioRisk = scenarios.some((scenario) =>
    (scenario.inputLabels || []).some((input) =>
      ["assumption", "coverage_gap", "not_configured", "not_approved_for_external_use"].includes(input.classification)
    )
  )
    ? [
        {
          key: "scenario_inputs_not_external",
          title: "Scenario Inputs Not Approved For External Use",
          owner: "Finance and operations",
          severity: "medium",
          capitalReadinessState: "evidence_needed",
          sourceSystem: "capital_runway_scenarios",
          mitigation: "Label assumptions, attach owners, and run advisor review before publishing projections.",
          nextAction: "Add starting cash, operating cost evidence, and projection approval states.",
        },
      ]
    : [];

  return dedupeRisks([...scorecardRisks, ...alertRisks, ...financeGapRisks, ...scenarioRisk]);
};

const buildSummary = ({
  scorecard = [],
  useOfFundsGates = [],
  claimRegister = [],
  riskRegister = [],
  diligencePipeline = [],
  diligenceQaWorkflow = [],
}) => {
  const countsByState = countBy(scorecard, (entry) => entry.state);
  const gateCounts = countBy(useOfFundsGates, (entry) => entry.gateState);
  const claimCounts = countBy(claimRegister, (entry) => entry.approvalState);
  const diligenceCounts = countBy(diligencePipeline, (entry) => entry.conversationState);
  const diligenceQaCounts = countBy(diligenceQaWorkflow, (entry) => entry.responseState);
  const readinessScore = scorecard.length
    ? Math.round(scorecard.reduce((sum, entry) => sum + Number(entry.score || 0), 0) / scorecard.length)
    : 0;
  const readinessState = worstCapitalState(scorecard.map((entry) => entry.state));
  const blockerCount = Number(countsByState.not_ready || 0) + Number(countsByState.remediation_needed || 0);
  const evidenceNeededCount = Number(countsByState.evidence_needed || 0);
  const highRiskCount = riskRegister.filter((risk) => ["critical", "high"].includes(risk.severity)).length;
  const recommendedPathKey =
    blockerCount > 0 || evidenceNeededCount > 3
      ? "delay_capital_and_prove_milestones"
      : readinessScore >= 85
        ? "angel_or_seed_round"
        : "targeted_advisor_review";
  const recommendedPath =
    recommendedPathKey === "targeted_advisor_review"
      ? {
          key: "targeted_advisor_review",
          title: "Targeted Advisor Review",
          rationale: "Evidence is close enough for controlled advisor review, but not broad investor or partner sharing.",
        }
      : {
          key: recommendedPathKey,
          title:
            FINANCING_PATH_DEFINITIONS.find((path) => path.key === recommendedPathKey)?.title ||
            "Targeted Advisor Review",
          rationale:
            recommendedPathKey === "delay_capital_and_prove_milestones"
              ? "Capital outreach should wait until blockers, missing evidence, and unsupported projections are narrowed."
              : "Core evidence is strong enough to prepare controlled outreach after advisor review.",
        };

  return {
    readinessScore,
    readinessState,
    totalScorecardAreas: scorecard.length,
    readyCount: Number(countsByState.ready || 0),
    nearReadyCount: Number(countsByState.near_ready || 0),
    evidenceNeededCount,
    remediationNeededCount: Number(countsByState.remediation_needed || 0),
    notReadyCount: Number(countsByState.not_ready || 0),
    blockerCount,
    useOfFundsGateCount: useOfFundsGates.length,
    readyUseOfFundsGateCount: Number(gateCounts.ready || 0),
    blockedUseOfFundsGateCount: Number(gateCounts.blocked || 0),
    claimCount: claimRegister.length,
    advisorApprovedClaimCount: Number(claimCounts.approved_for_advisor_review || 0),
    withdrawnClaimCount: Number(claimCounts.withdrawn || 0),
    diligenceTargetCount: diligencePipeline.length,
    controlledOutreachTargetCount: Number(diligenceCounts.ready_for_controlled_outreach || 0),
    advisorReviewTargetCount:
      Number(diligenceCounts.ready_for_advisor_review || 0) + Number(diligenceCounts.advisor_review_only || 0),
    blockedDiligenceTargetCount:
      Number(diligenceCounts.blocked_for_remediation || 0) + Number(diligenceCounts.do_not_contact || 0),
    diligenceQaCount: diligenceQaWorkflow.length,
    approvedDiligenceResponseCount: Number(diligenceQaCounts.approved_response || 0),
    restrictedDiligenceResponseCount:
      Number(diligenceQaCounts.restricted_response || 0) + Number(diligenceQaCounts.withdrawn_response || 0),
    riskCount: riskRegister.length,
    highRiskCount,
    countsByState,
    gateCounts,
    claimCounts,
    diligenceCounts,
    diligenceQaCounts,
    recommendedPath,
  };
};

const buildCapitalReadiness = async ({
  range = "30d",
  startDate = "",
  endDate = "",
  startingCashBalance = "",
} = {}) => {
  const [assuranceDashboard, financeClose] = await Promise.all([
    buildAssuranceDashboard({ range, startDate, endDate }),
    buildFinanceAssuranceClose({ range, startDate, endDate }),
  ]);
  const cashBalance = parseOptionalMoney(startingCashBalance);
  const scorecard = buildReadinessScorecard({ assuranceDashboard, financeClose });
  const scenarios = buildScenarioInputs({ financeClose, scorecard, startingCashBalance: cashBalance });
  const useOfFundsGates = buildUseOfFundsGates(scorecard);
  const capitalPathOptions = buildCapitalPathOptions(scorecard);
  const claimRegister = buildClaimRegister({ scorecard, assuranceDashboard, financeClose });
  const dataRoomPackets = buildDataRoomPackets(scorecard, claimRegister);
  const riskRegister = buildCapitalRiskRegister({
    scorecard,
    assuranceDashboard,
    financeClose,
    scenarios,
  });
  const diligencePipeline = buildDiligencePipeline({
    scorecard,
    claimRegister,
    dataRoomPackets,
    riskRegister,
  });
  const diligenceQaWorkflow = buildDiligenceQaWorkflow({
    scorecard,
    claimRegister,
    dataRoomPackets,
  });
  const summary = buildSummary({
    scorecard,
    useOfFundsGates,
    claimRegister,
    riskRegister,
    diligencePipeline,
    diligenceQaWorkflow,
  });

  return {
    filters: financeClose.filters,
    generatedAt: new Date().toISOString(),
    capitalPlan: {
      key: "capital_readiness",
      title: "Tengacion Capital Readiness",
      owner: "Product leadership",
      reviewer: "Finance, assurance, compliance, and advisor review",
      readinessState: summary.readinessState,
      recommendedPath: summary.recommendedPath,
    },
    summary,
    scorecard,
    runwayScenarios: scenarios,
    useOfFundsGates,
    capitalPathOptions,
    claimRegister,
    dataRoomPackets,
    diligencePipeline,
    diligenceQaWorkflow,
    riskRegister,
    decisionRules: [
      "Do not use delayed, disputed, blocked, withdrawn, or not-approved metrics in investor or partner materials.",
      "Do not publish projections until assumptions, owners, source evidence, cash inputs, and approval states are attached.",
      "Delay capital outreach when money movement, creator earnings, privacy, data-room, partner, or Akuso governance evidence is weak.",
      "Do not answer diligence questions externally until the packet, claims, owner, reviewer, and escalation route are approved.",
      "Treat no-go, advisor review, revenue-backed growth, strategic capital, and delayed fundraising as valid capital decisions.",
    ],
    sourceSystems: [
      "finance_assurance_close",
      "assurance_dashboard",
      "metric_contract_registry",
      "capital_runway_scenario_inputs",
      "capital_claim_register",
      "capital_risk_register",
      "capital_diligence_pipeline",
      "capital_diligence_qa_workflow",
    ],
  };
};

module.exports = {
  CLAIM_DEFINITIONS,
  DILIGENCE_PIPELINE_DEFINITIONS,
  DILIGENCE_QA_DEFINITIONS,
  FINANCING_PATH_DEFINITIONS,
  USE_OF_FUNDS_DEFINITIONS,
  buildCapitalReadiness,
};
