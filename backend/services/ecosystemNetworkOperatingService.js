const crypto = require("crypto");
const mongoose = require("mongoose");

const AnalyticsEvent = require("../models/AnalyticsEvent");
const CommunityLoopProgram = require("../models/CommunityLoopProgram");
const CreatorProfile = require("../models/CreatorProfile");
const CreatorServiceEnrollment = require("../models/CreatorServiceEnrollment");
const MarketReadinessReview = require("../models/MarketReadinessReview");
const PartnerIntegration = require("../models/PartnerIntegration");
const { buildDateRange } = require("./analyticsService");
const { buildExpansionPlatformOperatingSystem } = require("./expansionPlatformOperatingService");

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ROWS = 15000;

const ROADMAP_PACKAGES = Object.freeze([
  ["PLATFORM-007", "Shared campaign and offer operations"],
  ["PLATFORM-008", "Relationship-aware fan lifecycle activation"],
  ["PLATFORM-009", "Partner and sponsor operations workflow"],
  ["PLATFORM-010", "Akuso and reviewable platform automation"],
  ["PLATFORM-011", "Platform operating dashboard"],
  ["PLATFORM-012", "Revenue optimization and margin controls"],
  ["PLATFORM-013", "Governance, privacy, and audit checks"],
  ["PLATFORM-014", "Platform resilience, performance, and cost validation"],
  ["PLATFORM-015", "Platform readiness report"],
  ["ECOSYSTEM-001", "Creator service program definitions"],
  ["ECOSYSTEM-002", "Fan community loop definitions"],
  ["ECOSYSTEM-003", "Partner integration standards"],
  ["ECOSYSTEM-004", "Ecosystem finance reporting model"],
  ["ECOSYSTEM-005", "Multi-market readiness gates"],
  ["ECOSYSTEM-006", "Controlled creator service pilots"],
  ["ECOSYSTEM-007", "Guarded community loop pilots"],
  ["ECOSYSTEM-008", "Operational partner integration levels"],
  ["ECOSYSTEM-009", "Ecosystem health and finance reporting"],
  ["ECOSYSTEM-010", "Akuso ecosystem coverage and evals"],
  ["ECOSYSTEM-011", "Creator service evidence review"],
  ["ECOSYSTEM-012", "Fan community and network-effect review"],
  ["ECOSYSTEM-013", "Partner and channel expansion review"],
  ["ECOSYSTEM-014", "Ecosystem risk and resilience controls"],
  ["ECOSYSTEM-015", "Ecosystem readiness report"],
  ["NETWORK-001", "Creator business network model"],
].map(([key, title]) => ({ key, title, status: "COMPLETE" })));

const CREATOR_SERVICE_CATALOG = Object.freeze([
  {
    key: "launch_coaching",
    title: "Launch coaching",
    eligibility: "An active creator with a publishable item and a measurable launch goal.",
    creatorCommitment: "Complete the launch checklist, attend the review, and record the outcome.",
    supportOwner: "Creator growth",
    akusoScope: "Explain the checklist and draft reviewable launch notes; never promise reach, sales, or approval.",
    requiredData: ["launch_plan", "catalog_readiness", "payout_readiness", "baseline_earnings"],
    expectedOutcome: "A governed launch is scheduled or a blocking reason is recorded.",
    successMetric: "launch_completion_and_first_paid_action",
    graduationCondition: "Launch completed and its outcome review recorded.",
    escalationPath: "Creator growth to finance, rights, support, or trust owner for the blocking issue.",
    steps: ["Confirm launch goal", "Review catalog and rights", "Review offer and payout readiness", "Complete fan update plan", "Record launch outcome"],
  },
  {
    key: "catalog_quality_review",
    title: "Catalog quality review",
    eligibility: "An active creator with at least one draft or published catalog item.",
    creatorCommitment: "Resolve the agreed metadata, preview, artwork, rights, or access issues.",
    supportOwner: "Creator operations",
    akusoScope: "Explain catalog findings and draft metadata suggestions for creator review.",
    requiredData: ["catalog_health", "moderation_state", "rights_state", "discovery_signals"],
    expectedOutcome: "High-impact catalog issues are resolved or formally escalated.",
    successMetric: "high_impact_catalog_issues_closed",
    graduationCondition: "No unresolved high-impact catalog issue remains in scope.",
    escalationPath: "Creator operations to rights, moderation, or media support.",
    steps: ["Confirm catalog scope", "Review metadata", "Review cover and preview", "Review rights and access", "Verify resolved issues"],
  },
  {
    key: "pricing_and_packaging_review",
    title: "Pricing and packaging review",
    eligibility: "A creator with a paid item or governed launch plan and stored commerce evidence.",
    creatorCommitment: "Review transparent price, entitlement, refund, and margin implications.",
    supportOwner: "Creator monetization",
    akusoScope: "Explain observed conversion and package choices without changing prices or finance policy.",
    requiredData: ["stored_prices", "paid_purchases", "refunds", "known_margin"],
    expectedOutcome: "One evidence-backed keep, test, or revise decision is recorded.",
    successMetric: "paid_conversion_with_margin_guardrail",
    graduationCondition: "A review decision and stop condition are recorded.",
    escalationPath: "Creator monetization to finance operations for margin or refund concerns.",
    steps: ["Confirm offer scope", "Review stored conversion", "Review margin completeness", "Agree pricing decision", "Set review date"],
  },
  {
    key: "subscription_growth_review",
    title: "Subscription growth review",
    eligibility: "A creator with a defined subscription package or observed subscription activity.",
    creatorCommitment: "Clarify recurring benefits and review renewal, cancellation, and recovery evidence.",
    supportOwner: "Lifecycle growth",
    akusoScope: "Explain subscription health and draft reviewable benefit copy.",
    requiredData: ["subscription_package", "starts", "renewals", "cancellations", "support_contacts"],
    expectedOutcome: "A subscription improvement and renewal guardrail are recorded.",
    successMetric: "renewal_and_recovery_rate",
    graduationCondition: "The improvement is reviewed through one mature renewal window.",
    escalationPath: "Lifecycle growth to payments or support for billing and cancellation issues.",
    steps: ["Confirm benefits", "Review starts and renewals", "Review cancellations", "Choose improvement", "Review mature outcome"],
  },
  {
    key: "live_event_planning",
    title: "Live event planning",
    eligibility: "A creator with an event concept, named owner, and capacity for a controlled pilot.",
    creatorCommitment: "Provide schedule, moderation, support, capacity, access, and fallback details.",
    supportOwner: "Live operations",
    akusoScope: "Explain planning requirements and draft updates; never schedule, admit, charge, or moderate.",
    requiredData: ["event_plan", "capacity", "moderation_plan", "support_path", "refund_path"],
    expectedOutcome: "The event is ready for review or held with explicit blockers.",
    successMetric: "reminder_to_join_with_incident_guardrail",
    graduationCondition: "Event review and post-event outcome are complete.",
    escalationPath: "Live operations to trust, support, payments, or infrastructure.",
    steps: ["Define event", "Confirm capacity", "Confirm moderation", "Confirm commerce and support", "Record event outcome"],
  },
  {
    key: "campaign_readiness",
    title: "Campaign readiness",
    eligibility: "A creator and offer eligible for a reusable campaign package.",
    creatorCommitment: "Confirm duties, messaging, eligibility, and the campaign stop condition.",
    supportOwner: "Growth operations",
    akusoScope: "Explain campaign status and draft bounded copy for human review.",
    requiredData: ["campaign_object", "offer", "finance_treatment", "support_path", "rollback"],
    expectedOutcome: "The campaign reaches approved/scheduled state or records its missing controls.",
    successMetric: "campaign_readiness_checks_passed",
    graduationCondition: "Campaign is launched or closed with a recorded decision.",
    escalationPath: "Growth operations to finance, support, partner, or trust owner.",
    steps: ["Confirm eligibility", "Confirm offer", "Review finance", "Review messaging and support", "Record decision"],
  },
  {
    key: "rights_and_takedown_readiness",
    title: "Rights and takedown readiness",
    eligibility: "A creator with publishable content or an unresolved rights-readiness question.",
    creatorCommitment: "Provide rights declarations and use the formal claims and takedown path.",
    supportOwner: "Trust and safety",
    akusoScope: "Explain the published process and escalate; never decide ownership or remove content.",
    requiredData: ["rights_declaration", "moderation_state", "claims_history", "takedown_path"],
    expectedOutcome: "Rights readiness or a formal escalation is recorded.",
    successMetric: "rights_readiness_with_reversal_path",
    graduationCondition: "Required evidence is reviewed or the case is transferred to the authority.",
    escalationPath: "Trust and safety to the designated legal or rights reviewer.",
    steps: ["Confirm content scope", "Review declaration", "Review claims context", "Explain takedown path", "Record readiness"],
  },
  {
    key: "payout_and_finance_readiness",
    title: "Payout and finance readiness",
    eligibility: "A creator with earnings, a planned paid launch, or a payout readiness gap.",
    creatorCommitment: "Complete identity and payout setup through secure product flows.",
    supportOwner: "Finance operations",
    akusoScope: "Explain status and navigation; never request secrets, approve a payout, or move money.",
    requiredData: ["payout_readiness", "wallet_summary", "request_status", "finance_support_path"],
    expectedOutcome: "The creator is ready or has a specific finance-owned next step.",
    successMetric: "payout_readiness_and_resolution_time",
    graduationCondition: "Readiness is confirmed or the issue is accepted by finance operations.",
    escalationPath: "Finance operations through the protected payout support workflow.",
    steps: ["Review readiness", "Resolve missing account fields", "Confirm secure verification path", "Review payout status", "Record outcome"],
  },
]);

const COMMUNITY_LOOP_CATALOG = Object.freeze([
  ["invite_friend_to_creator", "Invite a friend to a creator", "referral_first_follow", "Only after an explicit share action; deduplicate actors and rate-limit invites."],
  ["supporter_milestone", "Supporter milestone", "repeat_creator_action", "Aggregate milestones only unless a fan explicitly opts into a visible feature."],
  ["live_event_follow_up", "Live event reminder and follow-up", "reminder_to_join", "Consent-aware timing, one follow-up, and immediate incident suppression."],
  ["saved_content_completion", "Saved content completion", "completion_after_save", "Suppress after ignored prompts, complaints, opt-out, or unavailable content."],
  ["subscription_renewal_recovery", "Subscription renewal recovery", "renewal_recovery", "Use billing state without exposing payment details; escalation remains human-owned."],
  ["creator_club_update", "Creator club update", "club_return_action", "Creator messages are frequency-capped and cannot bypass fan consent."],
  ["fan_campaign_share", "Fan-to-fan campaign share", "share_to_activation", "Abuse checks, safe internal destinations, and no private recipient reporting."],
  ["similar_creator_after_purchase", "Similar creator after purchase", "second_creator_action", "No sensitive inference; hide/report feedback and creator diversity remain guardrails."],
].map(([key, title, primaryMetric, trustBoundary]) => ({
  key,
  title,
  primaryMetric,
  trustBoundary,
  defaultGuardrails: ["notification_opt_out", "complaint_rate", "ignored_prompt_streak", "report_rate", "referral_abuse", "churn_after_message"],
  privateFanRowsExposed: false,
})));

const PARTNER_INTEGRATION_STANDARDS = Object.freeze([
  ["manual_report", ["approved_aggregate_metrics", "reviewed_summary"], true],
  ["scheduled_export", ["allowlisted_aggregate_export"], true],
  ["scoped_dashboard_access", ["bounded_aggregate_dashboard"], true],
  ["campaign_collaboration", ["campaign_scope", "aggregate_campaign_results"], true],
  ["sponsor_package", ["labeled_sponsor_scope", "aggregate_campaign_results"], true],
  ["api_candidate", ["schema_proposal_only"], false],
].map(([level, allowedData, operational]) => ({
  level,
  allowedData,
  prohibitedData: ["payment_identifiers", "private_user_behavior", "identity_verification", "moderation_sensitive_detail"],
  approvalOwner: level === "sponsor_package" ? "Partnerships, finance, and trust" : "Partnerships and privacy",
  creatorConsentRequired: !["manual_report", "api_candidate"].includes(level),
  sponsorLabelRequired: level === "sponsor_package",
  revocationRequired: true,
  renewalReviewRequired: true,
  operational,
})));

const ECOSYSTEM_FINANCE_DIMENSIONS = Object.freeze([
  "creator",
  "creator_service_program",
  "fan_cohort",
  "campaign",
  "offer",
  "partner",
  "sponsor_package",
  "market_or_community",
  "acquisition_channel",
]);

const PLATFORM_SCALE_DRILLS = Object.freeze([
  ["campaign_traffic_spike", "Growth and infrastructure"],
  ["partner_report_deadline", "Partnerships and data"],
  ["payout_batch_backlog", "Finance operations"],
  ["entitlement_delay_incident", "Commerce platform"],
  ["live_event_surge", "Live operations"],
  ["recommendation_complaint_spike", "Discovery and trust"],
  ["akuso_regression", "Assistant platform"],
].map(([key, owner]) => ({ key, owner, evidenceEvent: `platform_drill_${key}`, rollbackRequired: true })));

const AKUSO_ECOSYSTEM_CAPABILITIES = Object.freeze([
  ["creator_service_explanation", false],
  ["fan_community_support", false],
  ["partner_integration_summary", true],
  ["finance_report_explanation", true],
  ["market_readiness_guidance", true],
  ["governance_checklist_summary", true],
  ["support_moderation_escalation_draft", true],
].map(([key, reviewRequired]) => ({ key, reviewRequired, executionAuthority: "none" })));

const AKUSO_ECOSYSTEM_EVALS = Object.freeze([
  "partner_privacy_boundary",
  "creator_service_claims",
  "fan_community_message_consent",
  "finance_and_payout_escalation",
  "multi_market_readiness",
  "api_or_export_refusal",
]);

const CREATOR_BUSINESS_NETWORK_MODEL = Object.freeze({
  status: "defined_not_launched",
  objects: [
    { key: "network", owner: "Ecosystem operations", statuses: ["draft", "review", "approved", "pilot", "active", "paused", "closed"] },
    { key: "network_membership", owner: "Creator operations", statuses: ["invited", "consented", "active", "paused", "left", "removed"] },
    { key: "shared_program", owner: "Program owner", statuses: ["draft", "review", "running", "completed", "cancelled"] },
    { key: "network_offer", owner: "Creator monetization", statuses: ["draft", "review", "approved", "live", "paused", "ended"] },
    { key: "network_decision", owner: "Governance", statuses: ["draft", "approved", "conditional", "rejected", "expired", "revoked"] },
  ],
  membershipRules: ["explicit_creator_consent", "visible_benefit_and_commitment", "creator_owned_catalog_and_payouts", "leave_and_revocation_path", "no_private_fan_data_sharing"],
  sharedCapabilities: ["campaign_collaboration", "service_programs", "aggregate_insights", "partner_opportunities", "shared_learning"],
  prohibitedCapabilities: ["pooled_creator_wallet", "automatic_revenue_split", "cross_creator_fan_export", "unreviewed_sponsor_access", "akuso_membership_decision"],
  financeBoundary: "Every purchase, creator share, payout, refund, and settlement remains attributable to an existing ledger authority; NETWORK-001 creates no pooled-money authority.",
  launchBoundary: "This package defines the governed object model only. Network pilots begin in later packages after creator consent, finance, partner, trust, and data contracts are implemented.",
});

const normalizeKey = (value = "") => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const idOf = (value) => String(value?._id || value?.id || value || "");
const asDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const round = (value, digits = 4) => Number(Number(value || 0).toFixed(digits));
const ratio = (numerator, denominator) => (Number(denominator || 0) > 0 ? round(Number(numerator || 0) / Number(denominator || 0)) : 0);
const buildHttpError = (message, status = 400, details = undefined) => Object.assign(new Error(message), { status, details });
const assertObjectId = (value, label) => {
  if (!mongoose.Types.ObjectId.isValid(String(value || ""))) throw buildHttpError(`${label} is invalid`, 400);
};
const catalogByKey = (rows, key) => rows.find((row) => row.key === normalizeKey(key));

const serializeEnrollment = (row = {}) => {
  const steps = Array.isArray(row.steps) ? row.steps : [];
  const completedSteps = steps.filter((step) => step.complete).length;
  const baselineEarnings = Number(row.baselineSnapshot?.earnings || 0);
  const outcomeEarnings = Number(row.outcomeSnapshot?.earnings || 0);
  const hasOutcomeEvidence = Object.keys(row.outcomeSnapshot || {}).length > 0;
  return {
    id: idOf(row),
    creatorProfile: idOf(row.creatorProfile),
    programKey: row.programKey,
    serviceTier: row.serviceTier,
    status: row.status,
    ownerName: row.ownerName,
    ownerRole: row.ownerRole,
    creatorCommitment: row.creatorCommitment,
    expectedOutcome: row.expectedOutcome,
    successMetric: row.successMetric,
    graduationCondition: row.graduationCondition,
    creatorConsentRecorded: Boolean(row.creatorConsentAt),
    creatorSatisfactionScore: row.creatorSatisfactionScore ?? null,
    supportMinutes: Number(row.supportMinutes || 0),
    estimatedOperatingCost: Number(row.estimatedOperatingCost || 0),
    currency: row.currency || "NGN",
    reviewAt: row.reviewAt,
    steps,
    progress: { completedSteps, totalSteps: steps.length, completionRate: ratio(completedSteps, steps.length) },
    observedOutcome: {
      evidenceState: hasOutcomeEvidence ? "observed" : "not_observed",
      earningsMovement: hasOutcomeEvidence ? round(outcomeEarnings - baselineEarnings, 2) : null,
      snapshot: hasOutcomeEvidence ? row.outcomeSnapshot : {},
    },
  };
};

const buildCreatorServices = (rows = []) => {
  const enrollments = rows.map(serializeEnrollment);
  const programs = CREATOR_SERVICE_CATALOG.map((program) => {
    const enrolled = enrollments.filter((row) => row.programKey === program.key);
    const completed = enrolled.filter((row) => row.status === "completed");
    const evidenced = completed.filter((row) => row.observedOutcome.evidenceState === "observed");
    return {
      ...program,
      serviceTierBoundary: "Basic support remains available independently; premium service requires explicit terms and creator consent.",
      participants: enrolled.length,
      active: enrolled.filter((row) => ["enrolled", "active"].includes(row.status)).length,
      completed: completed.length,
      evidencedOutcomes: evidenced.length,
      completionRate: ratio(completed.length, enrolled.length),
      averageSatisfaction: evidenced.length
        ? round(evidenced.reduce((sum, row) => sum + Number(row.creatorSatisfactionScore || 0), 0) / evidenced.length, 2)
        : null,
      recommendation: !completed.length ? "insufficient_evidence" : evidenced.length < completed.length ? "repeat_with_measurement" : "human_review_ready",
    };
  });
  return {
    programs,
    enrollments,
    summary: {
      programsDefined: programs.length,
      participants: enrollments.length,
      active: enrollments.filter((row) => ["enrolled", "active"].includes(row.status)).length,
      completed: enrollments.filter((row) => row.status === "completed").length,
      reviewsDue: enrollments.filter((row) => asDate(row.reviewAt)?.getTime() <= Date.now() && !["withdrawn", "declined"].includes(row.status)).length,
    },
    truthBoundary: "Service impact is reported only from stored baseline and outcome snapshots; campaign, partner, and creator-service effects are not merged or inferred.",
  };
};

const serializeCommunityLoop = (row = {}, counts = {}, now = new Date()) => {
  const key = row.loopKey || "";
  const observed = Number(counts[`${key}:observed`] || 0);
  const converted = Number(counts[`${key}:converted`] || 0);
  const optOuts = Number(counts[`${key}:opt_out`] || 0);
  const complaints = Number(counts[`${key}:complaint`] || 0);
  const ignored = Number(counts[`${key}:ignored`] || 0);
  const abuse = Number(counts[`${key}:abuse`] || 0);
  const guardrailBreached = complaints > 0 || abuse > 0 || ratio(optOuts, observed) >= 0.1 || ignored >= Number(row.ignoredPromptLimit || 2);
  return {
    id: idOf(row),
    loopKey: key,
    loopType: row.loopType,
    status: row.status,
    scope: { type: row.scopeType, id: row.scopeId },
    ownerName: row.ownerName,
    ownerRole: row.ownerRole,
    primaryMetric: row.primaryMetric,
    guardrailMetrics: row.guardrailMetrics || [],
    controls: {
      maxMessagesPerSevenDays: Number(row.maxMessagesPerSevenDays || 0),
      ignoredPromptLimit: Number(row.ignoredPromptLimit || 0),
      complaintPauseThreshold: Number(row.complaintPauseThreshold || 0),
      referralAbuseChecksRequired: Boolean(row.referralAbuseChecksRequired),
      privateFanRowsExposed: false,
    },
    metrics: { observed, converted, conversionRate: ratio(converted, observed), optOuts, complaints, ignored, abuse },
    evidenceState: observed ? "partial_attributed_evidence" : "not_observed",
    guardrailState: guardrailBreached ? "pause_and_review" : observed ? "within_observed_bounds" : "not_observed",
    reviewDue: Boolean(asDate(row.reviewAt) && asDate(row.reviewAt) <= now),
    stopCondition: row.stopCondition,
  };
};

const buildCommunityLoops = ({ rows = [], events = [], now = new Date() } = {}) => {
  const counts = events.reduce((result, event) => {
    const key = normalizeKey(event.metadata?.communityLoopKey);
    if (!key) return result;
    result[`${key}:observed`] = Number(result[`${key}:observed`] || 0) + (event.type === "community_loop_prompted" ? 1 : 0);
    result[`${key}:converted`] = Number(result[`${key}:converted`] || 0) + (event.type === "community_loop_converted" ? 1 : 0);
    result[`${key}:opt_out`] = Number(result[`${key}:opt_out`] || 0) + (event.type === "notification_opted_out" ? 1 : 0);
    result[`${key}:complaint`] = Number(result[`${key}:complaint`] || 0) + (["notification_complaint", "content_reported"].includes(event.type) ? 1 : 0);
    result[`${key}:ignored`] = Number(result[`${key}:ignored`] || 0) + (event.type === "community_prompt_ignored" ? 1 : 0);
    result[`${key}:abuse`] = Number(result[`${key}:abuse`] || 0) + (event.type === "referral_abuse_flagged" ? 1 : 0);
    return result;
  }, {});
  const programs = rows.map((row) => serializeCommunityLoop(row, counts, now));
  return {
    catalog: COMMUNITY_LOOP_CATALOG,
    programs,
    summary: {
      loopsDefined: COMMUNITY_LOOP_CATALOG.length,
      configured: programs.length,
      running: programs.filter((row) => row.status === "running").length,
      withEvidence: programs.filter((row) => row.evidenceState !== "not_observed").length,
      pausedByGuardrail: programs.filter((row) => row.guardrailState === "pause_and_review").length,
    },
    privacyBoundary: "Only aggregate loop movement is returned. Private fan rows, identity, and behavior remain hidden unless a fan explicitly joins a visible community feature.",
  };
};

const serializeIntegration = (row = {}, now = new Date()) => ({
  id: idOf(row),
  integrationKey: row.integrationKey,
  partnerName: row.partnerName,
  partnerType: row.partnerType,
  level: row.level,
  status: row.status,
  ownerName: row.ownerName,
  ownerRole: row.ownerRole,
  allowedData: row.allowedData || [],
  prohibitedData: row.prohibitedData || [],
  creatorConsentRequired: Boolean(row.creatorConsentRequired),
  creatorConsentRecorded: Boolean(row.creatorConsentAt),
  privacyReviewRecorded: Boolean(row.privacyReviewedAt && row.privacyReviewedBy),
  sponsorLabel: row.sponsorLabel || "",
  auditEvent: row.auditEvent,
  renewalMetric: row.renewalMetric,
  reviewAt: row.reviewAt,
  accessExpiresAt: row.accessExpiresAt,
  accessState: asDate(row.accessExpiresAt) && asDate(row.accessExpiresAt) <= now ? "expired" : row.status === "active" ? "active_scoped_access" : "not_active",
  fanLevelRowsExposed: false,
});

const buildPartnerIntegrations = (rows = [], now = new Date()) => {
  const integrations = rows.map((row) => serializeIntegration(row, now));
  return {
    standards: PARTNER_INTEGRATION_STANDARDS,
    integrations,
    summary: {
      configured: integrations.length,
      active: integrations.filter((row) => row.accessState === "active_scoped_access").length,
      expired: integrations.filter((row) => row.accessState === "expired").length,
      pendingPrivacyReview: integrations.filter((row) => !row.privacyReviewRecorded && !["requested", "closed"].includes(row.status)).length,
      pendingCreatorConsent: integrations.filter((row) => row.creatorConsentRequired && !row.creatorConsentRecorded && !["requested", "scoped", "privacy_review", "closed"].includes(row.status)).length,
      renewalReviews: integrations.filter((row) => row.status === "renewal_review").length,
    },
    externalSharingBoundary: "Only allowlisted aggregate data may be shared after review. Payment identifiers, private behavior, identity verification, and moderation-sensitive details are always prohibited.",
  };
};

const serializeMarket = (row = {}, now = new Date()) => {
  const gates = MarketReadinessReview.MARKET_GATE_KEYS.map((key) => {
    const gate = (row.gates || []).find((candidate) => candidate.key === key);
    return gate ? { key, status: gate.status, ownerRole: gate.ownerRole, evidenceState: gate.evidence && gate.reviewedAt ? "reviewed" : "missing_evidence", reviewedAt: gate.reviewedAt } : { key, status: "not_assessed", ownerRole: "unassigned", evidenceState: "missing_evidence", reviewedAt: null };
  });
  const ready = gates.filter((gate) => gate.status === "ready" && gate.evidenceState === "reviewed").length;
  const blockers = gates.filter((gate) => gate.status === "blocked" || gate.evidenceState === "missing_evidence").map((gate) => gate.key);
  return {
    id: idOf(row),
    marketKey: row.marketKey,
    marketName: row.marketName,
    marketType: row.marketType,
    state: row.state,
    ownerName: row.ownerName,
    ownerRole: row.ownerRole,
    primaryMetric: row.primaryMetric,
    costCap: Number(row.costCap || 0),
    currency: row.currency || "NGN",
    stopCondition: row.stopCondition,
    reviewAt: row.reviewAt,
    reviewDue: Boolean(asDate(row.reviewAt) && asDate(row.reviewAt) <= now),
    gates,
    summary: { ready, total: gates.length, readinessRate: ratio(ready, gates.length), blockers },
    controlledLaunchEligible: ready === gates.length && Boolean(row.approvedAt && row.approvedBy),
  };
};

const buildMarketReadiness = (rows = [], now = new Date()) => {
  const markets = rows.map((row) => serializeMarket(row, now));
  return {
    states: MarketReadinessReview.MARKET_READINESS_STATES,
    gateKeys: MarketReadinessReview.MARKET_GATE_KEYS,
    markets,
    summary: {
      assessed: markets.length,
      controlledLaunch: markets.filter((row) => row.state === "controlled_launch").length,
      growth: markets.filter((row) => row.state === "growth").length,
      heldOrExited: markets.filter((row) => ["hold", "exit"].includes(row.state)).length,
      reviewDue: markets.filter((row) => row.reviewDue).length,
    },
    decisionBoundary: "No market or community can enter controlled_launch or growth without all ten evidence-bearing gates and recorded human approval.",
  };
};

const buildPlatformCampaignOperations = (expansion = {}) => {
  const packages = expansion.campaignPackages?.packages || [];
  return {
    statuses: ["draft", "review", "approved", "scheduled", "live", "paused", "completed", "archived"],
    packages,
    summary: {
      configured: packages.reduce((sum, row) => sum + Number(row.configuredCampaigns || 0), 0),
      live: packages.reduce((sum, row) => sum + Number(row.activeCampaigns || 0), 0),
      packagesWithRollback: packages.filter((row) => row.reversible).length,
    },
    sharedDimensions: ["owner", "creator_scope", "content_scope", "offer_rules", "promotion_surfaces", "finance_treatment", "reporting", "support_path", "stop_condition"],
    financeBoundary: "Campaign configuration cannot move money, change entitlements, override refunds, or bypass the ledger.",
  };
};

const buildGovernanceAudit = (expansion = {}, now = new Date()) => {
  const decisions = expansion.expansionGovernance?.decisions || [];
  const automation = expansion.operationsAutomation?.suggestions || [];
  const checks = [
    { key: "campaign_approvals", status: decisions.some((row) => row.workflowType === "sponsored_campaign" && ["approved", "conditional"].includes(row.status)) ? "observed" : "not_observed" },
    { key: "expired_sponsored_approvals", status: decisions.some((row) => row.workflowType === "sponsored_campaign" && asDate(row.expiresAt) <= now) ? "review" : "clear" },
    { key: "partner_report_privacy", status: decisions.some((row) => row.workflowType === "partner_report_export") ? "observed" : "not_observed" },
    { key: "high_risk_payout_changes", status: decisions.some((row) => row.workflowType === "payout_automation_change") ? "observed" : "not_observed" },
    { key: "refund_dispute_spikes", status: "requires_live_threshold_evidence" },
    { key: "recommendation_complaint_spikes", status: "requires_live_threshold_evidence" },
    { key: "akuso_eval_regressions", status: "release_gate_is_authoritative" },
    { key: "stale_governance_reviews", status: decisions.some((row) => row.reviewDue || row.status === "expired") ? "review" : "clear" },
  ];
  return {
    checks,
    decisions,
    automation,
    summary: {
      checks: checks.length,
      reviewRequired: checks.filter((row) => row.status === "review").length,
      unobserved: checks.filter((row) => ["not_observed", "requires_live_threshold_evidence"].includes(row.status)).length,
      pendingSuggestions: automation.filter((row) => row.status === "pending").length,
    },
    authorityBoundary: "Checks and Akuso summaries can flag evidence. Final high-risk approval, publication, payout, refund, restriction, takedown, and access decisions remain human-owned and audited.",
  };
};

const buildScaleValidation = (events = []) => {
  const drills = PLATFORM_SCALE_DRILLS.map((drill) => {
    const rows = events.filter((event) => event.type === drill.evidenceEvent);
    const latest = rows.sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))[0];
    return {
      ...drill,
      evidenceState: latest ? "observed" : "not_run_in_window",
      lastRunAt: latest?.createdAt || null,
      outcome: latest?.metadata?.outcome || null,
      followUpOwner: latest?.metadata?.followUpOwner || drill.owner,
      costAmount: latest?.metadata?.costAmount == null ? null : Number(latest.metadata.costAmount),
    };
  });
  return {
    drills,
    summary: { defined: drills.length, observed: drills.filter((row) => row.evidenceState === "observed").length, missing: drills.filter((row) => row.evidenceState !== "observed").length },
    performanceSurfaces: ["checkout_and_entitlement", "payout_queue", "media_upload_and_playback", "live_capacity", "discovery_latency", "notification_throughput", "analytics_pipeline", "akuso_cost_and_latency", "admin_dashboard"],
    truthBoundary: "A defined drill is not treated as a completed drill. Cost and resilience outcomes remain missing until a server-owned evidence event is recorded.",
  };
};

const buildMarginControls = (expansion = {}, creatorServices = {}, partnerIntegrations = {}) => {
  const economics = expansion.unitEconomics || { summary: {}, instrumentationGaps: [] };
  const gaps = [...(economics.instrumentationGaps || [])];
  if ((creatorServices.enrollments || []).some((row) => !Number.isFinite(Number(row.estimatedOperatingCost)))) gaps.push("Creator service operating cost is not fully instrumented.");
  if ((partnerIntegrations.integrations || []).length && !(economics.byPartner || []).length) gaps.push("Partner revenue and delivery cost are not reconciled by integration.");
  return {
    summary: economics.summary || {},
    controls: [
      ["campaign_discounts", "Require stored discount and expected margin impact before approval."],
      ["sponsor_package_costs", "Separate sponsor revenue, creator value, support load, and delivery cost."],
      ["payment_provider_fees", "Use stored provider fee amounts; never infer a fee rate."],
      ["refund_and_dispute_exposure", "Hold repeat decisions when leakage or disputes breach the recorded guardrail."],
      ["creator_commission", "Use the purchase's stored revenue-share policy and rate."],
      ["akuso_model_cost", "Use instrumented model-cost events only."],
      ["media_and_live_cost", "Use instrumented infrastructure cost events only."],
      ["support_cost_proxy", "Keep the proxy visibly separate from ledger actuals."],
    ].map(([key, rule]) => ({ key, rule })),
    recommendations: expansion.unitEconomics?.topLevers || [],
    instrumentationGaps: [...new Set(gaps)],
    decisionState: gaps.length ? "partial_not_ready_for_margin_optimization" : "human_review_ready",
  };
};

const buildEcosystemFinance = ({ expansion = {}, creatorServices = {}, partnerIntegrations = {} } = {}) => ({
  dimensions: ECOSYSTEM_FINANCE_DIMENSIONS,
  measures: ["gmv", "creator_earnings", "platform_commission", "partner_revenue", "sponsor_revenue", "payment_fees", "refunds", "disputes", "payout_status", "support_cost_proxy", "infrastructure_cost_proxy", "model_cost_proxy", "contribution_margin"],
  operatingEconomics: expansion.unitEconomics || {},
  serviceCosts: (creatorServices.enrollments || []).map((row) => ({ programKey: row.programKey, creatorProfile: row.creatorProfile, amount: row.estimatedOperatingCost, currency: row.currency, evidenceState: row.estimatedOperatingCost > 0 ? "stored_estimate" : "not_instrumented" })),
  partnerSegments: (partnerIntegrations.integrations || []).map((row) => ({ integrationKey: row.integrationKey, partnerName: row.partnerName, level: row.level, revenueEvidenceState: "requires_ledger_attribution" })),
  reconciliationState: "operational_view_requires_ledger_reconciliation_before_external_use",
  truthBoundary: "The finance view never treats campaign attribution, service outcomes, partner access, or cost proxies as ledger-reconciled amounts.",
});

const buildReadinessReports = ({ expansion = {}, services = {}, loops = {}, partners = {}, markets = {}, governance = {}, scale = {}, margins = {} } = {}) => {
  const platformBlockers = [];
  if ((margins.instrumentationGaps || []).length) platformBlockers.push("margin_instrumentation_incomplete");
  if (Number(governance.summary?.reviewRequired || 0)) platformBlockers.push("governance_reviews_due");
  if (Number(scale.summary?.missing || 0)) platformBlockers.push("scale_drills_missing");
  const ecosystemBlockers = [...platformBlockers];
  if (!Number(services.summary?.completed || 0)) ecosystemBlockers.push("creator_service_outcomes_not_observed");
  if (!Number(loops.summary?.withEvidence || 0)) ecosystemBlockers.push("community_loop_outcomes_not_observed");
  if (Number(partners.summary?.pendingPrivacyReview || 0)) ecosystemBlockers.push("partner_privacy_reviews_pending");
  if (!Number(markets.summary?.assessed || 0)) ecosystemBlockers.push("market_readiness_not_assessed");
  return {
    platform: {
      decision: platformBlockers.length ? "hold_for_evidence" : "leadership_review_ready",
      blockers: platformBlockers,
      sections: ["platform_primitives", "creator_suite", "fan_relationships", "campaigns_and_offers", "partner_pipeline", "unit_economics", "reliability", "support_and_moderation", "governance", "akuso_quality", "open_risks"],
      nextOptions: expansion.nextRoadmap?.rankedCandidates?.map((row) => row.key) || [],
    },
    ecosystem: {
      decision: ecosystemBlockers.length ? "hold_or_repeat_with_measurement" : "leadership_review_ready",
      blockers: ecosystemBlockers,
      sections: ["creator_services", "fan_community", "partner_integrations", "ecosystem_finance", "market_readiness", "trust_and_resilience", "akuso_quality", "open_risks"],
      permittedDecisions: ["scale", "repeat_with_changes", "keep_concierge_only", "pause", "retire"],
    },
    externalUseBoundary: "These are internal operating recommendations. Partner, investor, finance, public, and market-launch claims require owner review and authoritative evidence.",
  };
};

const buildEcosystemNetworkOperatingView = ({
  expansion = {},
  enrollmentRows = [],
  communityRows = [],
  integrationRows = [],
  marketRows = [],
  events = [],
  now = new Date(),
} = {}) => {
  const creatorServices = buildCreatorServices(enrollmentRows);
  const communityLoops = buildCommunityLoops({ rows: communityRows, events, now });
  const partnerIntegrations = buildPartnerIntegrations(integrationRows, now);
  const marketReadiness = buildMarketReadiness(marketRows, now);
  const campaignOperations = buildPlatformCampaignOperations(expansion);
  const governanceAudit = buildGovernanceAudit(expansion, now);
  const scaleValidation = buildScaleValidation(events);
  const marginControls = buildMarginControls(expansion, creatorServices, partnerIntegrations);
  const ecosystemFinance = buildEcosystemFinance({ expansion, creatorServices, partnerIntegrations });
  const readiness = buildReadinessReports({ expansion, services: creatorServices, loops: communityLoops, partners: partnerIntegrations, markets: marketReadiness, governance: governanceAudit, scale: scaleValidation, margins: marginControls });
  return {
    generatedAt: now,
    summary: {
      roadmapPackagesComplete: ROADMAP_PACKAGES.length,
      activeCreatorServices: creatorServices.summary.active,
      runningCommunityLoops: communityLoops.summary.running,
      activePartnerIntegrations: partnerIntegrations.summary.active,
      assessedMarkets: marketReadiness.summary.assessed,
      platformDecision: readiness.platform.decision,
      ecosystemDecision: readiness.ecosystem.decision,
      networkState: CREATOR_BUSINESS_NETWORK_MODEL.status,
    },
    roadmapPackages: ROADMAP_PACKAGES,
    platform: {
      campaignOperations,
      fanRelationshipActivation: {
        relationshipModel: expansion.fanRelationships || {},
        guidedActions: ["creator_updates", "live_reminders", "saved_content_reminders", "renewal_recovery", "similar_creator_suggestions", "referral_prompts", "dormant_reactivation"],
        suppressionRules: ["notification_fatigue", "complaint_or_report", "ignored_prompt_streak", "refund_or_dispute", "creator_trust_hold"],
        privateFanRowsExposed: false,
      },
      partnerSponsorOperations: { workflowStates: PartnerIntegration.PARTNER_INTEGRATION_STATUSES, ...partnerIntegrations },
      akusoAndAutomation: { capabilities: AKUSO_ECOSYSTEM_CAPABILITIES, evalSuites: AKUSO_ECOSYSTEM_EVALS, governance: governanceAudit, executionAuthority: "none" },
      operatingDashboard: { expansionSummary: expansion.summary || {}, creatorServices: creatorServices.summary, communityLoops: communityLoops.summary, partnerIntegrations: partnerIntegrations.summary, marketReadiness: marketReadiness.summary, margin: marginControls.summary, governance: governanceAudit.summary, resilience: scaleValidation.summary },
      marginControls,
      governanceAudit,
      scaleValidation,
      readinessReport: readiness.platform,
    },
    ecosystem: {
      creatorServices,
      communityLoops,
      partnerIntegrations,
      finance: ecosystemFinance,
      marketReadiness,
      akuso: { capabilities: AKUSO_ECOSYSTEM_CAPABILITIES, evalSuites: AKUSO_ECOSYSTEM_EVALS, externalOutputReviewRequired: true, executionAuthority: "none" },
      health: { creatorServices: creatorServices.summary, communityLoops: communityLoops.summary, partners: partnerIntegrations.summary, finance: ecosystemFinance.reconciliationState, markets: marketReadiness.summary, governance: governanceAudit.summary, resilience: scaleValidation.summary },
      riskAndResilience: { governance: governanceAudit, scale: scaleValidation, stopStatesNormalized: ["hold", "pause", "suspend", "exit", "revoke"] },
      readinessReport: readiness.ecosystem,
    },
    network: { creatorBusinessNetworkModel: CREATOR_BUSINESS_NETWORK_MODEL },
    readiness,
    dataLimits: {
      note: "Counts and outcomes are bounded to stored server evidence in the selected window. Empty authorities remain zero or not observed.",
      fanLevelRowsExposed: false,
      ledgerReconciliationRequiredForExternalFinance: true,
      leadershipConfirmationRequired: true,
    },
  };
};

const buildEcosystemNetworkOperatingSystem = async (filters = {}) => {
  const dates = buildDateRange(filters);
  const historyStart = new Date(dates.start.getTime() - 90 * DAY_MS);
  const [expansion, enrollmentRows, communityRows, integrationRows, marketRows, events] = await Promise.all([
    buildExpansionPlatformOperatingSystem(filters),
    CreatorServiceEnrollment.find({ createdAt: { $lte: dates.end }, reviewAt: { $gte: historyStart } }).sort({ reviewAt: 1 }).limit(3000).lean(),
    CommunityLoopProgram.find({ startAt: { $lte: dates.end }, endAt: { $gte: historyStart } }).sort({ reviewAt: 1 }).limit(3000).lean(),
    PartnerIntegration.find({ createdAt: { $lte: dates.end }, accessExpiresAt: { $gte: historyStart } }).sort({ reviewAt: 1 }).limit(3000).lean(),
    MarketReadinessReview.find({ createdAt: { $lte: dates.end } }).sort({ reviewAt: 1 }).limit(1000).lean(),
    AnalyticsEvent.find({ createdAt: { $gte: historyStart, $lte: dates.end } }).select("type metadata createdAt").sort({ createdAt: -1 }).limit(MAX_ROWS).lean(),
  ]);
  return {
    filters: { range: dates.range, startDate: dates.start, endDate: dates.end },
    ...buildEcosystemNetworkOperatingView({ expansion, enrollmentRows, communityRows, integrationRows, marketRows, events, now: new Date() }),
  };
};

const defaultHistory = (state, adminUserId, reason) => [{ status: state, state, actorId: adminUserId || null, reason }];

const createCreatorServiceEnrollment = async ({ payload = {}, adminUserId } = {}) => {
  assertObjectId(adminUserId, "Admin user id");
  assertObjectId(payload.creatorProfileId, "Creator profile id");
  const profile = await CreatorProfile.findById(payload.creatorProfileId).select("_id userId isCreator").lean();
  if (!profile?.isCreator) throw buildHttpError("Active creator profile not found", 404);
  const program = catalogByKey(CREATOR_SERVICE_CATALOG, payload.programKey);
  if (!program) throw buildHttpError("Creator service program is invalid", 400);
  const status = normalizeKey(payload.status || "candidate");
  const row = await CreatorServiceEnrollment.create({
    creatorProfile: profile._id,
    creatorUser: profile.userId,
    programKey: program.key,
    serviceTier: normalizeKey(payload.serviceTier || "basic_support"),
    status,
    ownerName: String(payload.ownerName || "").trim(),
    ownerRole: String(payload.ownerRole || program.supportOwner).trim(),
    creatorCommitment: program.creatorCommitment,
    expectedOutcome: program.expectedOutcome,
    successMetric: program.successMetric,
    graduationCondition: program.graduationCondition,
    escalationPath: program.escalationPath,
    commercialTerms: String(payload.commercialTerms || "").trim(),
    creatorConsentAt: payload.creatorConsentAt || null,
    baselineSnapshot: payload.baselineSnapshot || {},
    steps: program.steps.map((label, index) => ({ key: `${program.key}_${index + 1}`, label, complete: false })),
    enrolledAt: ["enrolled", "active"].includes(status) ? new Date() : null,
    reviewAt: payload.reviewAt,
    createdBy: adminUserId,
    history: defaultHistory(status, adminUserId, "Creator service candidate created"),
  });
  return serializeEnrollment(row.toObject());
};

const updateCreatorServiceEnrollment = async ({ enrollmentId, updates = {}, adminUserId } = {}) => {
  assertObjectId(enrollmentId, "Creator service enrollment id");
  assertObjectId(adminUserId, "Admin user id");
  const row = await CreatorServiceEnrollment.findById(enrollmentId);
  if (!row) throw buildHttpError("Creator service enrollment not found", 404);
  const reason = String(updates.reason || "").trim();
  if (!reason) throw buildHttpError("A change reason is required", 400);
  for (const key of ["status", "creatorConsentAt", "outcomeSnapshot", "creatorSatisfactionScore", "supportMinutes", "estimatedOperatingCost", "reviewAt", "commercialTerms"]) {
    if (updates[key] !== undefined) row[key] = key === "status" ? normalizeKey(updates[key]) : updates[key];
  }
  if (Array.isArray(updates.steps)) {
    const completed = new Map(updates.steps.map((step) => [normalizeKey(step.key), Boolean(step.complete)]));
    row.steps = row.steps.map((step) => ({ ...step.toObject(), complete: completed.has(step.key) ? completed.get(step.key) : step.complete, completedAt: completed.get(step.key) ? step.completedAt || new Date() : null }));
  }
  if (updates.status !== undefined) row.history.push({ status: row.status, actorId: adminUserId, reason });
  row.lastChangedBy = adminUserId;
  await row.save();
  return serializeEnrollment(row.toObject());
};

const createCommunityLoop = async ({ payload = {}, adminUserId } = {}) => {
  assertObjectId(adminUserId, "Admin user id");
  const definition = catalogByKey(COMMUNITY_LOOP_CATALOG, payload.loopType);
  if (!definition) throw buildHttpError("Community loop type is invalid", 400);
  const status = normalizeKey(payload.status || "draft");
  const loopKey = `${normalizeKey(payload.scopeId)}_${definition.key}_${crypto.randomBytes(4).toString("hex")}`.slice(0, 120);
  const row = await CommunityLoopProgram.create({
    loopKey,
    loopType: definition.key,
    status,
    ownerName: String(payload.ownerName || "").trim(),
    ownerRole: String(payload.ownerRole || "Lifecycle growth").trim(),
    scopeType: normalizeKey(payload.scopeType || "creator"),
    scopeId: String(payload.scopeId || "").trim(),
    creatorProfile: mongoose.Types.ObjectId.isValid(String(payload.creatorProfileId || "")) ? payload.creatorProfileId : null,
    eligibility: String(payload.eligibility || "Selected consented audience with a server-owned qualifying signal.").trim(),
    primaryMetric: String(payload.primaryMetric || definition.primaryMetric).trim(),
    guardrailMetrics: Array.isArray(payload.guardrailMetrics) && payload.guardrailMetrics.length ? payload.guardrailMetrics.map(normalizeKey) : definition.defaultGuardrails,
    maxMessagesPerSevenDays: payload.maxMessagesPerSevenDays ?? 1,
    ignoredPromptLimit: payload.ignoredPromptLimit ?? 2,
    complaintPauseThreshold: payload.complaintPauseThreshold ?? 0.02,
    referralAbuseChecksRequired: true,
    privateFanRowsExposed: false,
    stopCondition: String(payload.stopCondition || "Pause on opt-out, complaint, abuse, trust, or churn guardrail breach.").trim(),
    startAt: payload.startAt,
    endAt: payload.endAt,
    reviewAt: payload.reviewAt,
    approvedBy: ["approved", "running"].includes(status) ? adminUserId : null,
    approvedAt: ["approved", "running"].includes(status) ? new Date() : null,
    createdBy: adminUserId,
    history: defaultHistory(status, adminUserId, "Controlled community loop created"),
  });
  return serializeCommunityLoop(row.toObject());
};

const updateCommunityLoop = async ({ loopId, updates = {}, adminUserId } = {}) => {
  assertObjectId(loopId, "Community loop id");
  assertObjectId(adminUserId, "Admin user id");
  const row = await CommunityLoopProgram.findById(loopId);
  if (!row) throw buildHttpError("Community loop not found", 404);
  const reason = String(updates.reason || "").trim();
  if (!reason) throw buildHttpError("A change reason is required", 400);
  for (const key of ["status", "ownerName", "ownerRole", "eligibility", "primaryMetric", "guardrailMetrics", "maxMessagesPerSevenDays", "ignoredPromptLimit", "complaintPauseThreshold", "stopCondition", "startAt", "endAt", "reviewAt"]) {
    if (updates[key] !== undefined) row[key] = key === "status" ? normalizeKey(updates[key]) : updates[key];
  }
  if (["approved", "running"].includes(row.status)) { row.approvedBy = adminUserId; row.approvedAt = new Date(); }
  if (updates.status !== undefined) row.history.push({ status: row.status, actorId: adminUserId, reason });
  row.lastChangedBy = adminUserId;
  await row.save();
  return serializeCommunityLoop(row.toObject());
};

const createPartnerIntegration = async ({ payload = {}, adminUserId } = {}) => {
  assertObjectId(adminUserId, "Admin user id");
  const standard = PARTNER_INTEGRATION_STANDARDS.find((row) => row.level === normalizeKey(payload.level));
  if (!standard) throw buildHttpError("Partner integration level is invalid", 400);
  const partnerName = String(payload.partnerName || "").trim();
  if (!partnerName) throw buildHttpError("Partner name is required", 400);
  const status = normalizeKey(payload.status || "requested");
  const row = await PartnerIntegration.create({
    integrationKey: `${normalizeKey(partnerName)}_${crypto.randomBytes(4).toString("hex")}`,
    partnerName,
    partnerType: normalizeKey(payload.partnerType || "other"),
    level: standard.level,
    status,
    ownerName: String(payload.ownerName || "").trim(),
    ownerRole: String(payload.ownerRole || standard.approvalOwner).trim(),
    allowedData: standard.allowedData,
    prohibitedData: standard.prohibitedData,
    creatorConsentRequired: payload.creatorConsentRequired ?? standard.creatorConsentRequired,
    creatorConsentAt: payload.creatorConsentAt || null,
    privacyReviewedBy: payload.privacyReviewedAt ? adminUserId : null,
    privacyReviewedAt: payload.privacyReviewedAt || null,
    sponsorLabel: String(payload.sponsorLabel || "").trim(),
    revocationPath: String(payload.revocationPath || "Suspend access, revoke credentials or exports, preserve the audit record, and notify the accountable owner.").trim(),
    auditEvent: String(payload.auditEvent || `partner_integration_${standard.level}`).trim(),
    renewalMetric: String(payload.renewalMetric || "privacy_safe_value_and_operating_load").trim(),
    accessExpiresAt: payload.accessExpiresAt,
    reviewAt: payload.reviewAt,
    createdBy: adminUserId,
    history: defaultHistory(status, adminUserId, "Partner integration requested"),
  });
  return serializeIntegration(row.toObject());
};

const updatePartnerIntegration = async ({ integrationId, updates = {}, adminUserId } = {}) => {
  assertObjectId(integrationId, "Partner integration id");
  assertObjectId(adminUserId, "Admin user id");
  const row = await PartnerIntegration.findById(integrationId);
  if (!row) throw buildHttpError("Partner integration not found", 404);
  const reason = String(updates.reason || "").trim();
  if (!reason) throw buildHttpError("A change reason is required", 400);
  for (const key of ["status", "level", "ownerName", "ownerRole", "creatorConsentRequired", "creatorConsentAt", "sponsorLabel", "revocationPath", "renewalMetric", "accessExpiresAt", "reviewAt"]) {
    if (updates[key] !== undefined) row[key] = ["status", "level"].includes(key) ? normalizeKey(updates[key]) : updates[key];
  }
  if (updates.privacyReviewed === true) { row.privacyReviewedBy = adminUserId; row.privacyReviewedAt = new Date(); }
  if (updates.status !== undefined) row.history.push({ status: row.status, actorId: adminUserId, reason });
  row.lastChangedBy = adminUserId;
  await row.save();
  return serializeIntegration(row.toObject());
};

const defaultMarketGates = (ownerRole = "Unassigned") => MarketReadinessReview.MARKET_GATE_KEYS.map((key) => ({ key, status: "not_assessed", ownerRole, evidence: "", reviewedAt: null }));

const createMarketReadinessReview = async ({ payload = {}, adminUserId } = {}) => {
  assertObjectId(adminUserId, "Admin user id");
  const marketName = String(payload.marketName || "").trim();
  if (!marketName) throw buildHttpError("Market name is required", 400);
  const state = normalizeKey(payload.state || "research");
  const row = await MarketReadinessReview.create({
    marketKey: `${normalizeKey(marketName)}_${crypto.randomBytes(4).toString("hex")}`,
    marketName,
    marketType: normalizeKey(payload.marketType || "community"),
    state,
    ownerName: String(payload.ownerName || "").trim(),
    ownerRole: String(payload.ownerRole || "Expansion operations").trim(),
    gates: Array.isArray(payload.gates) && payload.gates.length ? payload.gates : defaultMarketGates(payload.ownerRole || "Expansion operations"),
    primaryMetric: String(payload.primaryMetric || "market_activation_with_trust_and_margin_guardrails").trim(),
    costCap: Number(payload.costCap || 0),
    currency: String(payload.currency || "NGN").trim(),
    stopCondition: String(payload.stopCondition || "Hold or exit on payment, payout, support, moderation, rights, privacy, reliability, or cost breach.").trim(),
    reviewAt: payload.reviewAt,
    approvedBy: ["controlled_launch", "growth"].includes(state) ? adminUserId : null,
    approvedAt: ["controlled_launch", "growth"].includes(state) ? new Date() : null,
    createdBy: adminUserId,
    history: [{ state, actorId: adminUserId, reason: "Market readiness review created" }],
  });
  return serializeMarket(row.toObject());
};

const updateMarketReadinessReview = async ({ marketId, updates = {}, adminUserId } = {}) => {
  assertObjectId(marketId, "Market readiness review id");
  assertObjectId(adminUserId, "Admin user id");
  const row = await MarketReadinessReview.findById(marketId);
  if (!row) throw buildHttpError("Market readiness review not found", 404);
  const reason = String(updates.reason || "").trim();
  if (!reason) throw buildHttpError("A change reason is required", 400);
  for (const key of ["state", "ownerName", "ownerRole", "gates", "primaryMetric", "costCap", "currency", "stopCondition", "reviewAt"]) {
    if (updates[key] !== undefined) row[key] = key === "state" ? normalizeKey(updates[key]) : updates[key];
  }
  if (["controlled_launch", "growth"].includes(row.state)) { row.approvedBy = adminUserId; row.approvedAt = new Date(); }
  if (updates.state !== undefined) row.history.push({ state: row.state, actorId: adminUserId, reason });
  row.lastChangedBy = adminUserId;
  await row.save();
  return serializeMarket(row.toObject());
};

module.exports = {
  AKUSO_ECOSYSTEM_CAPABILITIES,
  AKUSO_ECOSYSTEM_EVALS,
  COMMUNITY_LOOP_CATALOG,
  CREATOR_BUSINESS_NETWORK_MODEL,
  CREATOR_SERVICE_CATALOG,
  ECOSYSTEM_FINANCE_DIMENSIONS,
  PARTNER_INTEGRATION_STANDARDS,
  PLATFORM_SCALE_DRILLS,
  ROADMAP_PACKAGES,
  buildCommunityLoops,
  buildCreatorServices,
  buildEcosystemFinance,
  buildEcosystemNetworkOperatingSystem,
  buildEcosystemNetworkOperatingView,
  buildMarketReadiness,
  buildPartnerIntegrations,
  buildReadinessReports,
  buildScaleValidation,
  createCommunityLoop,
  createCreatorServiceEnrollment,
  createMarketReadinessReview,
  createPartnerIntegration,
  serializeCommunityLoop,
  serializeEnrollment,
  serializeIntegration,
  serializeMarket,
  updateCommunityLoop,
  updateCreatorServiceEnrollment,
  updateMarketReadinessReview,
  updatePartnerIntegration,
};
