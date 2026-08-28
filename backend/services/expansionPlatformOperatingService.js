const crypto = require("crypto");
const mongoose = require("mongoose");

const AnalyticsEvent = require("../models/AnalyticsEvent");
const AutomationSuggestion = require("../models/AutomationSuggestion");
const CreatorLaunchPlan = require("../models/CreatorLaunchPlan");
const CreatorProfile = require("../models/CreatorProfile");
const ExpansionExperiment = require("../models/ExpansionExperiment");
const GovernanceDecision = require("../models/GovernanceDecision");
const PartnerPilot = require("../models/PartnerPilot");
const Purchase = require("../models/Purchase");
const ReferralAttribution = require("../models/ReferralAttribution");
const ReferralAttributionEvent = require("../models/ReferralAttributionEvent");
const RevenueCampaign = require("../models/RevenueCampaign");
const User = require("../models/User");
const { buildDateRange } = require("./analyticsService");
const { buildPayoutReadiness } = require("./payoutReadinessService");
const { buildScaleEvidenceOperatingSystem } = require("./scaleEvidenceOperatingService");

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ROWS = 15000;

const ROADMAP_PACKAGES = Object.freeze([
  ["EXPANSION-002", "Self-serve creator launch playbooks"],
  ["EXPANSION-003", "Referral and creator-share attribution"],
  ["EXPANSION-004", "Repeatable campaign offer packages"],
  ["EXPANSION-005", "Experiment and event taxonomy hygiene"],
  ["EXPANSION-006", "First scored expansion cohort"],
  ["EXPANSION-007", "Creator monetization depth"],
  ["EXPANSION-008", "Fan referral and community loops"],
  ["EXPANSION-009", "Low-risk operations automation"],
  ["EXPANSION-010", "Akuso expansion workflow coverage"],
  ["EXPANSION-011", "Expansion cohort review"],
  ["EXPANSION-012", "Unit economics and operating leverage"],
  ["EXPANSION-013", "Partner renewal and sponsor packaging"],
  ["EXPANSION-014", "Repeated-expansion governance"],
  ["EXPANSION-015", "Next expansion roadmap decision"],
  ["PLATFORM-001", "Canonical platform object model"],
  ["PLATFORM-002", "Creator business suite design"],
  ["PLATFORM-003", "Fan relationship model"],
  ["PLATFORM-004", "Metric contracts and experiment governance"],
  ["PLATFORM-005", "Governance-to-workflow control map"],
  ["PLATFORM-006", "Creator launch planner and offer builder"],
].map(([key, title]) => ({ key, title, status: "COMPLETE" })));

const PLAYBOOK_CATALOG = Object.freeze([
  {
    key: "first_paid_music_drop",
    title: "First paid music drop",
    contentTypes: ["track", "album"],
    offerTypes: ["paid_drop", "bundle"],
    requiredProfileFields: ["displayName", "bio", "country"],
    pricingGuidance: "Start with the existing catalog price range; review preview conversion before changing price.",
    recommendedFanActions: ["preview", "save", "purchase", "follow"],
    campaignEligibility: "Published rights-cleared music, a working preview, payout readiness, and no open trust hold.",
    postLaunchReviewMetric: "paid_unlocks_and_second_sale_within_30_days",
    checklist: ["Confirm profile and rights", "Select a paid track or album", "Add cover and preview", "Review price and entitlement", "Confirm payout readiness", "Draft a fan announcement", "Set launch metric and stop condition"],
  },
  {
    key: "first_ebook_or_chapter_launch",
    title: "First ebook or chapter launch",
    contentTypes: ["book"],
    offerTypes: ["paid_drop", "bundle"],
    requiredProfileFields: ["displayName", "bio", "country"],
    pricingGuidance: "Price from the complete reading value and preview depth; keep chapter access and refund terms clear.",
    recommendedFanActions: ["preview", "save", "purchase", "follow"],
    campaignEligibility: "Rights-cleared book file, readable cover, bounded preview, payout readiness, and support path.",
    postLaunchReviewMetric: "preview_to_purchase_and_completion_signal",
    checklist: ["Confirm author profile and rights", "Select the book or chapter", "Add cover and preview", "Review price and access", "Confirm payout readiness", "Draft a reader announcement", "Set launch metric and stop condition"],
  },
  {
    key: "podcast_subscription_launch",
    title: "Podcast subscription launch",
    contentTypes: ["podcast", "subscription"],
    offerTypes: ["subscription_package"],
    requiredProfileFields: ["displayName", "bio", "subscriptionDescription"],
    pricingGuidance: "Tie the monthly price to specific recurring benefits and review renewal health, not only starts.",
    recommendedFanActions: ["preview", "follow", "subscribe", "renew"],
    campaignEligibility: "Published podcast catalog, named recurring benefits, renewal controls, payout readiness, and support path.",
    postLaunchReviewMetric: "subscription_start_renewal_and_cancellation_rate",
    checklist: ["Confirm podcast identity and rights", "Define recurring fan benefits", "Review subscription price", "Confirm renewal and cancellation clarity", "Confirm payout readiness", "Draft a listener announcement", "Set renewal guardrail"],
  },
  {
    key: "live_event_launch",
    title: "Live event launch",
    contentTypes: ["live"],
    offerTypes: ["live_event_pass"],
    requiredProfileFields: ["displayName", "bio", "country"],
    pricingGuidance: "Price against event duration and access value; preserve a visible incident and refund path.",
    recommendedFanActions: ["set_reminder", "share", "join", "purchase_pass"],
    campaignEligibility: "Named event owner, capacity check, moderation plan, support fallback, payout readiness, and refund path.",
    postLaunchReviewMetric: "reminder_to_join_and_paid_pass_refund_rate",
    checklist: ["Define event and owner", "Confirm capacity and fallback", "Set pass price and access", "Confirm moderation and support", "Confirm payout readiness", "Draft reminder and update plan", "Request elevated-risk review"],
  },
  {
    key: "marketplace_product_spotlight",
    title: "Marketplace product spotlight",
    contentTypes: ["marketplace_product"],
    offerTypes: ["marketplace_spotlight"],
    requiredProfileFields: ["displayName", "bio", "country"],
    pricingGuidance: "Keep the product price, fees, fulfillment expectations, and promoted placement clearly separated.",
    recommendedFanActions: ["view_product", "save", "purchase", "report_issue"],
    campaignEligibility: "Eligible product, seller verification, labeled promotion, fulfillment path, complaint path, and payout readiness.",
    postLaunchReviewMetric: "product_conversion_refund_complaint_and_support_load",
    checklist: ["Confirm seller and product eligibility", "Review product media and description", "Confirm price and fulfillment", "Add visible promotion label", "Confirm complaint and payout paths", "Draft spotlight copy", "Request elevated-risk review"],
  },
  {
    key: "dormant_creator_comeback",
    title: "Dormant creator comeback",
    contentTypes: ["track", "album", "book", "podcast", "video"],
    offerTypes: ["paid_drop", "bundle", "subscription_package"],
    requiredProfileFields: ["displayName", "bio"],
    pricingGuidance: "Restart with one clear offer and a low-frequency fan update before adding discounts or more packages.",
    recommendedFanActions: ["follow", "preview", "save", "return"],
    campaignEligibility: "Current profile, publishable catalog, no unresolved trust hold, and a bounded reactivation message.",
    postLaunchReviewMetric: "creator_return_second_publish_and_fan_return_rate",
    checklist: ["Refresh creator profile", "Select one comeback item", "Fix top catalog issue", "Review price and preview", "Confirm payout readiness", "Draft a low-frequency return update", "Set a 30-day repeat action"],
  },
]);

const CAMPAIGN_PACKAGE_CATALOG = Object.freeze([
  { key: "creator_drop_week", campaignType: "creator_drop", durationDays: 7, promotionSurfaces: ["creator_profile", "discovery", "notifications"], eligibility: "Launch-ready creator and paid item with preview", offerRule: "No hidden price or entitlement changes", obligations: ["rights confirmation", "fan update", "post-campaign review"], fanMessaging: "Labeled creator update with consent-aware reminders", marginGuardrail: "Ledger key and expected margin impact required", reporting: ["impressions", "actions", "revenue", "refunds", "support"], supportPath: "creator_campaign_support", reversible: true },
  { key: "subscription_starter_campaign", campaignType: "subscription_launch", durationDays: 14, promotionSurfaces: ["creator_profile", "subscriptions", "notifications"], eligibility: "Defined benefits, price, renewal and cancellation controls", offerRule: "Benefits and billing cadence remain visible", obligations: ["benefit delivery", "renewal review"], fanMessaging: "Consent-aware membership explanation", marginGuardrail: "Renewal, churn and support cost reviewed", reporting: ["starts", "renewals", "cancellations", "revenue", "support"], supportPath: "subscription_support", reversible: true },
  { key: "live_event_week", campaignType: "live_event_pass", durationDays: 7, promotionSurfaces: ["live", "creator_profile", "notifications"], eligibility: "Capacity, moderation, refund and incident paths ready", offerRule: "Pass access and fallback remain explicit", obligations: ["moderation coverage", "event updates", "incident review"], fanMessaging: "Bounded reminders with opt-out", marginGuardrail: "Capacity and refund exposure reviewed", reporting: ["reminders", "joins", "pass_sales", "refunds", "incidents"], supportPath: "live_event_support", reversible: true },
  { key: "marketplace_creator_spotlight", campaignType: "marketplace_creator_spotlight", durationDays: 7, promotionSurfaces: ["marketplace", "creator_profile"], eligibility: "Eligible seller and product with fulfillment and complaint paths", offerRule: "Placement is labeled and product pricing is unchanged unless audited", obligations: ["fulfillment", "complaint response"], fanMessaging: "Clearly labeled creator spotlight", marginGuardrail: "Fees, refunds and support load reviewed", reporting: ["views", "actions", "revenue", "refunds", "complaints"], supportPath: "marketplace_support", reversible: true },
  { key: "partner_sponsored_collection", campaignType: "partner_sponsored_feature", durationDays: 14, promotionSurfaces: ["editorial_collection", "creator_profile"], eligibility: "Creator consent, disclosure, brand safety and partner report privacy ready", offerRule: "Sponsor cannot alter entitlement or suppress trust signals", obligations: ["creator consent", "sponsor disclosure", "brand safety review"], fanMessaging: "Visible Sponsored label on every eligible surface", marginGuardrail: "Partner cost, creator economics and complaint guardrail reviewed", reporting: ["aggregate_impressions", "aggregate_actions", "revenue", "complaints", "incidents"], supportPath: "partner_campaign_support", reversible: true },
]);

const EVENT_TAXONOMY = Object.freeze([
  ["activation", ["account_created", "creator_followed", "content_saved", "preview_started", "purchase_completed", "subscription_started", "session_returned"]],
  ["referral", ["referral_invite_sent", "referral_link_opened", "referral_signup", "referral_first_follow", "referral_first_preview", "referral_first_purchase", "referral_first_subscription", "referral_d7_return"]],
  ["campaign_exposure", ["campaign_impression", "campaign_clicked", "campaign_hidden", "campaign_reported"]],
  ["recommendation_exposure", ["recommendation_impression", "recommendation_clicked", "recommendation_hidden", "recommendation_reported"]],
  ["notification_delivery", ["notification_queued", "notification_delivered", "notification_failed", "notification_opened", "notification_opted_out"]],
  ["creator_playbook", ["creator_playbook_started", "creator_playbook_step_completed", "creator_launch_scheduled", "creator_launch_completed"]],
  ["support_escalation", ["support_contact_created", "support_escalated", "support_resolved"]],
  ["moderation_outcome", ["moderation_queued", "moderation_approved", "moderation_restricted", "moderation_reversed"]],
  ["payout_status", ["payout_requested", "payout_reviewed", "payout_processing", "payout_paid", "payout_failed"]],
  ["akuso_expansion_guidance", ["akuso_expansion_guidance_requested", "akuso_expansion_guidance_helpful", "akuso_expansion_guidance_escalated", "akuso_expansion_guidance_fallback"]],
].map(([domain, eventTypes]) => ({ domain, eventTypes, contractVersion: 1, owner: domain.includes("payout") ? "Finance operations" : domain.includes("akuso") ? "Assistant platform" : "Product data" })));

const METRIC_CONTRACTS = Object.freeze([
  ["activation", "Unique accounts completing an allowlisted first meaningful action in the selected cohort and window.", "AnalyticsEvent", "Product growth"],
  ["creator_earnings", "Creator share from paid purchases with a stored revenue-share rate; missing rates are not inferred.", "Purchase", "Finance operations"],
  ["fan_retention", "Mature D7 or D30 return from server-owned session and commerce events.", "AnalyticsEvent", "Lifecycle growth"],
  ["campaign_conversion", "Attributed paid actions divided by campaign exposures for the same reporting key and window.", "AnalyticsEvent + Purchase", "Growth analytics"],
  ["subscription_renewal", "Paid renewals divided by mature eligible subscription terms.", "Purchase", "Subscriptions"],
  ["referral_attribution", "Deduplicated milestone counts for one privacy-safe referral token, aggregated by source.", "ReferralAttributionEvent", "Growth analytics"],
  ["contribution_margin", "Gross paid revenue less known creator share, provider fee, refund/dispute leakage, and instrumented cost proxies.", "Purchase + AnalyticsEvent", "Finance operations"],
  ["support_load", "Created support and complaint records in the selected window, reported as aggregate counts.", "AdminComplaint + AnalyticsEvent", "Support operations"],
  ["recommendation_trust", "Hide and report events beside eligible recommendation exposure.", "AnalyticsEvent", "Discovery and trust"],
  ["akuso_quality", "Reviewed eval pass, fallback, helpfulness, and escalation signals by governed mode.", "Akuso eval + AnalyticsEvent", "Assistant platform"],
].map(([key, definition, authority, owner]) => ({ key, definition, authority, owner, contractVersion: 1, dataQualityGate: "required_before_executive_or_partner_use" })));

const FAN_RELATIONSHIP_STAGES = Object.freeze([
  { key: "discovered", signals: ["creator_profile_viewed", "recommendation_impression"], allowedPrompt: "One relevant discovery continuation" },
  { key: "interested", signals: ["creator_followed", "content_saved", "preview_started"], allowedPrompt: "Fresh creator update or saved-content return" },
  { key: "engaged", signals: ["content_completed", "live_session_joined", "session_returned"], allowedPrompt: "Low-frequency next content or live reminder" },
  { key: "paying", signals: ["purchase_completed"], allowedPrompt: "Entitlement-aware related content or support" },
  { key: "subscribed", signals: ["subscription_started", "subscription_renewed"], allowedPrompt: "Benefit and renewal clarity" },
  { key: "advocate", signals: ["creator_shared", "content_shared", "referral_first_follow", "referral_first_purchase"], allowedPrompt: "Bounded referral or creator-share prompt" },
  { key: "dormant", signals: ["no_meaningful_action_30d"], allowedPrompt: "One freshness-grounded reactivation" },
  { key: "at_risk", signals: ["subscription_failed", "refund_completed", "notification_complaint"], allowedPrompt: "Recovery or support only; suppress promotional prompts" },
]);

const CREATOR_BUSINESS_SUITE_MODULES = Object.freeze([
  ["launch_planner", "Plan launch metadata, readiness, dates, copy, fan updates, and review."],
  ["catalog_health", "Resolve catalog and preview blockers before promotion."],
  ["offer_builder", "Use governed paid drop, bundle, subscription, live pass, or marketplace offers."],
  ["campaign_eligibility", "Explain campaign rules and elevated-risk review gates."],
  ["audience_relationships", "Show only aggregate relationship and referral movement."],
  ["earnings_and_payout", "Keep stored revenue share, balance, and payout readiness visible."],
  ["subscription_health", "Review starts, renewals, scheduled cancellations, and recovery."],
  ["akuso_playbook", "Draft and explain from real playbooks; never publish or approve sensitive work."],
].map(([key, description]) => ({ key, description })));

const PLATFORM_OBJECT_CATALOG = Object.freeze([
  ["cohort", "ExpansionBet", ["research", "seed", "controlled_launch", "expand", "hold", "exit"]],
  ["lifecycle_stage", "CreatorLifecycleEnrollment + relationship derivation", ["candidate", "enrolled", "active", "paused", "graduated"]],
  ["campaign", "RevenueCampaign", ["draft", "ready", "active", "paused", "completed", "cancelled"]],
  ["offer", "CreatorLaunchPlan", CreatorLaunchPlan.CREATOR_LAUNCH_PLAN_STATUSES],
  ["bundle", "CreatorLaunchPlan.offerType=bundle", CreatorLaunchPlan.CREATOR_LAUNCH_PLAN_STATUSES],
  ["subscription_package", "CreatorLaunchPlan.offerType=subscription_package", CreatorLaunchPlan.CREATOR_LAUNCH_PLAN_STATUSES],
  ["live_event_pass", "CreatorLaunchPlan.offerType=live_event_pass", CreatorLaunchPlan.CREATOR_LAUNCH_PLAN_STATUSES],
  ["partner", "PartnerPilot", PartnerPilot.PARTNER_PILOT_STATUSES],
  ["sponsor_package", "PartnerPilot.sponsored", PartnerPilot.PARTNER_PILOT_STATUSES],
  ["experiment", "ExpansionExperiment", ExpansionExperiment.EXPANSION_EXPERIMENT_STATUSES],
  ["decision_record", "GovernanceDecision", GovernanceDecision.GOVERNANCE_DECISION_STATUSES],
  ["governance_review", "GovernanceDecision.approvals", GovernanceDecision.GOVERNANCE_DECISION_STATUSES],
].map(([key, authority, statuses]) => ({ key, authority, statuses, requiredDimensions: ["owner", "status", "eligibility", "start_end", "creators", "fan_cohort", "finance", "analytics", "support_moderation", "audit"] })));

const GOVERNANCE_CONTROL_MAP = Object.freeze([
  ["payout_automation_change", "critical", ["finance", "risk"], "payout_preflight_and_reconciliation", "admin.payout_automation", "Disable automated batching and return to reviewed manual processing."],
  ["refund_or_dispute_override", "critical", ["finance", "support"], "purchase_and_provider_evidence", "admin.refund_override", "Stop overrides and reconcile the provider and ledger."],
  ["sponsored_campaign", "high", ["product", "trust", "finance"], "creator_consent_disclosure_and_margin", "admin.sponsored_campaign", "Pause sponsored surfaces and withdraw the active disclosure package."],
  ["partner_report_export", "high", ["partnerships", "privacy"], "aggregate_allowlist_and_freshness", "admin.partner_export", "Revoke the export and notify the report owner."],
  ["content_takedown", "high", ["trust", "rights"], "case_evidence_and_appeal_path", "admin.content_takedown", "Restore only through the reviewed appeal path."],
  ["recommendation_ranking_change", "high", ["discovery", "trust"], "offline_diagnostics_and_complaint_guardrail", "admin.recommendation_policy", "Restore the last reviewed ranking policy."],
  ["akuso_prompt_memory_or_tool_change", "high", ["assistant", "safety"], "eval_gate_and_privacy_review", "admin.akuso_change", "Disable the affected capability and use deterministic guidance."],
  ["user_data_export_change", "high", ["privacy", "engineering"], "field_allowlist_retention_and_deletion", "admin.data_export_change", "Restore the last approved export manifest."],
].map(([workflowType, riskLevel, approvers, evidence, auditEvent, rollbackPath]) => ({ workflowType, riskLevel, approvers, evidence, auditEvent, reviewDays: riskLevel === "critical" ? 30 : 90, rollbackPath, selfServe: false })));

const AKUSO_EXPANSION_CAPABILITIES = Object.freeze([
  ["creator_playbook_guidance", "creator_checklist", false],
  ["campaign_package_explanation", "campaign_copy", true],
  ["referral_and_sharing_help", "referral_guidance", false],
  ["fan_lifecycle_support", "fan_lifecycle_guidance", false],
  ["support_macro_draft", "support_macro_draft", true],
  ["admin_cohort_summary", "cohort_summary", true],
  ["partner_safe_report_summary", "partner_report_summary", true],
  ["offer_setup_explanation", "offer_setup_guidance", false],
].map(([key, contentType, reviewRequired]) => ({ key, contentType, reviewRequired, executionAuthority: "none" })));

const AKUSO_EXPANSION_EVAL_SUITES = Object.freeze([
  "expansion_scorecard_guidance",
  "creator_campaign_setup",
  "referral_privacy_boundary",
  "payout_refund_escalation",
  "partner_report_safety",
  "unsupported_automation_refusal",
  "platform_object_grounding",
  "creator_offer_builder",
]);

const round = (value, digits = 2) => Number(Number(value || 0).toFixed(digits));
const toId = (value) => String(value?._id || value || "");
const toDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const normalizeKey = (value = "") => String(value || "")
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "")
  .slice(0, 120);
const buildHttpError = (message, status = 400, details = undefined) => Object.assign(new Error(message), { status, details });
const assertObjectId = (value, label = "Id") => {
  if (!mongoose.Types.ObjectId.isValid(String(value || ""))) throw buildHttpError(`${label} is invalid`, 400);
};
const unique = (values = []) => [...new Set(values.filter(Boolean))];
const inWindow = (value, start, end) => {
  const date = toDate(value);
  return Boolean(date && date >= start && date <= end);
};

const getPlaybook = (key) => PLAYBOOK_CATALOG.find((row) => row.key === key);

const planReadinessChecks = (plan = {}) => {
  const paidOffer = ["paid_drop", "bundle", "subscription_package", "live_event_pass", "marketplace_spotlight"].includes(plan.offerType);
  return [
    { key: "title", complete: Boolean(plan.title) },
    { key: "launch_date", complete: Boolean(toDate(plan.launchAt)) },
    { key: "cover", complete: Boolean(plan.coverReady || plan.offerType === "subscription_package") },
    { key: "preview", complete: Boolean(plan.previewReady || ["subscription_package", "live_event_pass", "marketplace_spotlight"].includes(plan.offerType)) },
    { key: "price", complete: !paidOffer || Number(plan.price || 0) > 0 },
    { key: "payout", complete: Boolean(plan.payoutReadySnapshot) },
    { key: "announcement", complete: Boolean(plan.announcementDraft) },
    { key: "fan_update_plan", complete: Boolean(plan.fanUpdatePlan) },
    { key: "success_metric", complete: Boolean(plan.successMetric || plan.postLaunchReviewMetric) },
    { key: "stop_condition", complete: Boolean(plan.stopCondition) },
    { key: "checklist", complete: Boolean((plan.checklist || []).length && (plan.checklist || []).every((item) => item.complete)) },
  ];
};

const serializeLaunchPlan = (row = {}) => {
  const checks = planReadinessChecks(row);
  return {
    id: toId(row),
    planKey: row.planKey || "",
    title: row.title || "",
    playbookType: row.playbookType || "",
    offerType: row.offerType || "",
    status: row.status || "draft",
    contentType: row.contentType || "",
    contentId: toId(row.contentId),
    launchAt: row.launchAt || null,
    price: Number(row.price || 0),
    currency: row.currency || "NGN",
    coverReady: Boolean(row.coverReady),
    previewReady: Boolean(row.previewReady),
    payoutReadySnapshot: Boolean(row.payoutReadySnapshot),
    announcementDraft: row.announcementDraft || "",
    fanUpdatePlan: row.fanUpdatePlan || "",
    eligibilityNotes: row.eligibilityNotes || "",
    successMetric: row.successMetric || "",
    postLaunchReviewMetric: row.postLaunchReviewMetric || "",
    stopCondition: row.stopCondition || "",
    checklist: (row.checklist || []).map((item) => ({ key: item.key, label: item.label, complete: Boolean(item.complete), completedAt: item.completedAt || null })),
    riskLevel: row.riskLevel || "standard",
    reviewReason: row.reviewReason || "",
    reviewNote: row.reviewNote || "",
    reviewedAt: row.reviewedAt || null,
    readinessState: checks.every((check) => check.complete) ? "ready" : "blocked",
    blockers: checks.filter((check) => !check.complete).map((check) => check.key),
    updatedAt: row.updatedAt || null,
  };
};

const buildCreatorBusinessSuite = ({
  profile = {},
  payoutReadiness = {},
  operatingConsole = {},
  planRows = [],
  referralRows = [],
} = {}) => {
  const plans = planRows.map(serializeLaunchPlan);
  const catalogHealth = operatingConsole.catalogHealth || {};
  const profileFields = {
    displayName: profile.displayName,
    bio: profile.bio,
    country: profile.country || profile.countryOfResidence,
    subscriptionDescription: profile.subscriptionDescription,
  };
  const playbooks = PLAYBOOK_CATALOG.map((playbook) => {
    const profileBlockers = playbook.requiredProfileFields.filter((field) => !profileFields[field]);
    const checks = [
      { key: "profile", complete: profileBlockers.length === 0 },
      { key: "catalog", complete: Number(catalogHealth.itemCount || 0) > 0 },
      { key: "catalog_quality", complete: Number(catalogHealth.highImpactIssueCount || 0) === 0 },
      { key: "payout", complete: Boolean(payoutReadiness.ready) },
    ];
    return {
      ...playbook,
      readinessState: checks.every((check) => check.complete) ? "ready" : "needs_work",
      blockers: [
        ...profileBlockers.map((field) => `profile_${field}`),
        ...checks.filter((check) => !check.complete && check.key !== "profile").map((check) => check.key),
      ],
      activePlanCount: plans.filter((plan) => plan.playbookType === playbook.key && !["completed", "cancelled"].includes(plan.status)).length,
      akusoPrompt: `Explain the ${playbook.title} checklist using only the current Tengacion creator workspace. Keep publication, finance, moderation, and public copy subject to human review.`,
    };
  });
  const referralCounters = referralRows.reduce((totals, row) => {
    Object.entries(row.counters || {}).forEach(([key, value]) => { totals[key] = Number(totals[key] || 0) + Number(value || 0); });
    return totals;
  }, {});
  return {
    modules: CREATOR_BUSINESS_SUITE_MODULES,
    playbooks,
    offerTypes: CreatorLaunchPlan.CREATOR_OFFER_TYPES,
    plans,
    summary: {
      activePlans: plans.filter((plan) => !["completed", "cancelled"].includes(plan.status)).length,
      readyPlans: plans.filter((plan) => plan.readinessState === "ready").length,
      reviewRequired: plans.filter((plan) => plan.status === "review_required").length,
      completedPlans: plans.filter((plan) => plan.status === "completed").length,
    },
    audienceRelationships: {
      privacyMode: "aggregate_only",
      referralLinks: referralRows.length,
      inviteSent: Number(referralCounters.inviteSent || 0),
      linkOpened: Number(referralCounters.linkOpened || 0),
      activated: Number(referralCounters.firstFollow || 0) + Number(referralCounters.firstPurchase || 0) + Number(referralCounters.firstSubscription || 0),
      fanLevelRowsExposed: false,
    },
    reviewBoundary: "Akuso may explain or draft. Creators submit plans. Elevated campaign, finance, live, marketplace, sponsored, or trust risk remains admin-reviewed.",
  };
};

const serializeReferral = (row = {}) => ({
  id: toId(row),
  token: row.token || "",
  sourceType: row.sourceType || "",
  sourceKey: row.sourceKey || "",
  creatorProfileId: toId(row.creatorProfile),
  destinationPath: row.destinationPath || "/home",
  label: row.label || "",
  status: row.status || "active",
  expiresAt: row.expiresAt || null,
  counters: row.counters || {},
  sharePath: `/r/${encodeURIComponent(row.token || "")}`,
});

const buildReferralReporting = (rows = []) => {
  const bySourceMap = new Map();
  rows.forEach((row) => {
    const key = row.sourceType || "unknown";
    const bucket = bySourceMap.get(key) || { sourceType: key, links: 0, inviteSent: 0, linkOpened: 0, signup: 0, firstFollow: 0, firstPreview: 0, firstPurchase: 0, firstSubscription: 0, d7Return: 0 };
    bucket.links += 1;
    Object.entries(row.counters || {}).forEach(([counter, value]) => { bucket[counter] = Number(bucket[counter] || 0) + Number(value || 0); });
    bySourceMap.set(key, bucket);
  });
  const bySource = [...bySourceMap.values()].map((row) => ({
    ...row,
    openRate: row.inviteSent ? round(row.linkOpened / row.inviteSent, 4) : null,
    signupRate: row.linkOpened ? round(row.signup / row.linkOpened, 4) : null,
    activationRate: row.linkOpened ? round((row.firstFollow + row.firstPreview + row.firstPurchase + row.firstSubscription) / row.linkOpened, 4) : null,
  }));
  const summary = bySource.reduce((total, row) => {
    ["links", "inviteSent", "linkOpened", "signup", "firstFollow", "firstPreview", "firstPurchase", "firstSubscription", "d7Return"].forEach((key) => { total[key] = Number(total[key] || 0) + Number(row[key] || 0); });
    return total;
  }, {});
  return {
    summary,
    bySource,
    privacyBoundary: {
      creatorAndPartnerViews: "aggregate_only",
      actorStorage: "one_way_hash_for_deduplication",
      userIdsExposed: false,
      privateFanBehaviorExposed: false,
      rawDestinationsLimitedToInternalPaths: true,
    },
  };
};

const buildFanRelationshipReport = ({ users = [], events = [], purchases = [], now = new Date() } = {}) => {
  const eventMap = new Map();
  const purchaseMap = new Map();
  events.forEach((event) => {
    const id = toId(event.userId);
    if (!id) return;
    if (!eventMap.has(id)) eventMap.set(id, []);
    eventMap.get(id).push(event);
  });
  purchases.forEach((purchase) => {
    const id = toId(purchase.userId);
    if (!id) return;
    if (!purchaseMap.has(id)) purchaseMap.set(id, []);
    purchaseMap.get(id).push(purchase);
  });
  const counts = FAN_RELATIONSHIP_STAGES.reduce((result, stage) => ({ ...result, [stage.key]: 0 }), {});
  let suppressed = 0;
  let eligibleForPrompt = 0;
  users.forEach((user) => {
    const userEvents = eventMap.get(toId(user)) || [];
    const userPurchases = purchaseMap.get(toId(user)) || [];
    const types = new Set(userEvents.map((event) => String(event.type || "")));
    const paid = userPurchases.filter((purchase) => purchase.status === "paid");
    const hasRisk = types.has("notification_complaint") || types.has("subscription_failed") || userPurchases.some((purchase) => purchase.status === "refunded");
    const lastMeaningful = userEvents.reduce((latest, event) => Math.max(latest, toDate(event.createdAt)?.getTime() || 0), 0);
    let stage = "discovered";
    if (hasRisk) stage = "at_risk";
    else if (lastMeaningful && lastMeaningful < now.getTime() - 30 * DAY_MS) stage = "dormant";
    else if (["creator_shared", "content_shared", "referral_first_follow", "referral_first_purchase"].some((type) => types.has(type))) stage = "advocate";
    else if (paid.some((purchase) => purchase.itemType === "subscription")) stage = "subscribed";
    else if (paid.length) stage = "paying";
    else if (["content_completed", "live_session_joined", "session_returned"].some((type) => types.has(type))) stage = "engaged";
    else if (["creator_followed", "content_saved", "preview_started", "stream_started"].some((type) => types.has(type))) stage = "interested";
    counts[stage] += 1;
    const recentPrompts = userEvents.filter((event) => ["notification_delivered", "lifecycle_prompt_shown"].includes(event.type) && toDate(event.createdAt) >= new Date(now.getTime() - DAY_MS)).length;
    const isSuppressed = user.notificationPrefs?.system === false || hasRisk || recentPrompts >= 2;
    if (isSuppressed) suppressed += 1;
    else eligibleForPrompt += 1;
  });
  return {
    stages: FAN_RELATIONSHIP_STAGES.map((stage) => ({ ...stage, count: counts[stage.key] || 0 })),
    summary: { usersClassified: users.length, suppressed, eligibleForPrompt },
    guardrails: ["notification_consent", "maximum_two_lifecycle_prompts_per_day", "recent_complaint_or_report", "refund_or_dispute_context", "creator_trust_hold", "repeated_ignored_prompts"],
    privacyBoundary: "Only aggregate stage movement is returned; no fan row or private action is exposed to creators, partners, or sponsors.",
  };
};

const buildUnitEconomics = ({ purchases = [], events = [], profileRows = [] } = {}) => {
  const paid = purchases.filter((purchase) => purchase.status === "paid");
  const refunded = purchases.filter((purchase) => purchase.status === "refunded");
  const hasStoredShareRate = (row) => row.creatorShareRate !== null
    && row.creatorShareRate !== undefined
    && row.creatorShareRate !== ""
    && Number.isFinite(Number(row.creatorShareRate));
  const grossRevenue = round(paid.reduce((sum, row) => sum + Number(row.amount || 0), 0));
  const knownCreatorEarnings = round(paid.reduce((sum, row) => sum + (hasStoredShareRate(row) ? Number(row.amount || 0) * Number(row.creatorShareRate) : 0), 0));
  const paymentFees = round(paid.reduce((sum, row) => sum + Number(row.processingFeeAmount || 0), 0));
  const refundAndDisputeLeakage = round(refunded.reduce((sum, row) => sum + Number(row.amount || 0), 0));
  const costEvents = events.filter((event) => Number.isFinite(Number(event.metadata?.costAmount)) && Number(event.metadata.costAmount) >= 0);
  const costByType = costEvents.reduce((result, event) => {
    const key = normalizeKey(event.metadata?.costType || event.type || "other");
    result[key] = round(Number(result[key] || 0) + Number(event.metadata.costAmount || 0));
    return result;
  }, {});
  const instrumentedCosts = round(Object.values(costByType).reduce((sum, value) => sum + Number(value || 0), 0));
  const knownContribution = round(grossRevenue - knownCreatorEarnings - paymentFees - refundAndDisputeLeakage - instrumentedCosts);
  const profileTypes = new Map(profileRows.map((profile) => [toId(profile), (profile.creatorTypes || ["unknown"])[0] || "unknown"]));
  const buildBreakdown = (keyBuilder) => Object.values(paid.reduce((result, row) => {
    const key = normalizeKey(keyBuilder(row) || "unknown") || "unknown";
    if (!result[key]) result[key] = { key, purchases: 0, grossRevenue: 0, knownCreatorEarnings: 0, paymentFees: 0 };
    result[key].purchases += 1;
    result[key].grossRevenue = round(result[key].grossRevenue + Number(row.amount || 0));
    if (hasStoredShareRate(row)) result[key].knownCreatorEarnings = round(result[key].knownCreatorEarnings + Number(row.amount || 0) * Number(row.creatorShareRate));
    result[key].paymentFees = round(result[key].paymentFees + Number(row.processingFeeAmount || 0));
    return result;
  }, {}));
  const missingShareRows = paid.filter((row) => !hasStoredShareRate(row)).length;
  const instrumentationGaps = [];
  if (missingShareRows) instrumentationGaps.push(`${missingShareRows} paid purchase rows have no stored creator-share rate.`);
  if (!costByType.support_cost_proxy) instrumentationGaps.push("Support cost proxy is not instrumented for this window.");
  if (!costByType.infrastructure_cost_proxy) instrumentationGaps.push("Infrastructure cost proxy is not instrumented for this window.");
  if (!costByType.akuso_model_cost) instrumentationGaps.push("Akuso model cost is not instrumented for this window.");
  if (!costByType.partner_campaign_cost) instrumentationGaps.push("Partner or campaign cost is not instrumented for this window.");
  const levers = [
    paymentFees > 0 ? { key: "payment_fee_routing", evidenceAmount: paymentFees, action: "Review provider and payment-method mix without changing checkout truth." } : null,
    refundAndDisputeLeakage > 0 ? { key: "refund_dispute_reduction", evidenceAmount: refundAndDisputeLeakage, action: "Review offer clarity, entitlement, support, and dispute root causes." } : null,
    missingShareRows > 0 ? { key: "revenue_share_completeness", evidenceAmount: missingShareRows, action: "Backfill only from authoritative finance policy; do not infer missing creator share." } : null,
    instrumentationGaps.length ? { key: "cost_instrumentation", evidenceAmount: instrumentationGaps.length, action: "Instrument cost proxies before using contribution margin for expansion." } : null,
  ].filter(Boolean).slice(0, 3);
  return {
    summary: { grossRevenue, knownCreatorEarnings, paymentFees, refundAndDisputeLeakage, instrumentedCosts, knownContribution, contributionMarginPercent: grossRevenue ? round((knownContribution / grossRevenue) * 100) : null, completenessState: instrumentationGaps.length ? "partial" : "complete" },
    byCreatorCategory: buildBreakdown((row) => profileTypes.get(toId(row.creatorId))),
    byAcquisitionSource: buildBreakdown((row) => row.acquisitionSource || "not_stored_on_purchase"),
    byPaymentMethod: buildBreakdown((row) => row.provider || "unknown"),
    costByType,
    instrumentationGaps,
    topLevers: levers,
    truthBoundary: "Known contribution never infers missing creator shares or uninstrumented support, infrastructure, model, partner, or campaign costs.",
  };
};

const buildCampaignPackages = ({ campaignRows = [], events = [], purchases = [] } = {}) => ({
  packages: CAMPAIGN_PACKAGE_CATALOG.map((definition) => {
    const campaigns = campaignRows.filter((row) => row.type === definition.campaignType);
    const keys = new Set(campaigns.map((row) => row.campaignKey));
    const packageEvents = events.filter((event) => keys.has(event.metadata?.campaignKey));
    const impressions = packageEvents.filter((event) => ["campaign_impression", "content_impression"].includes(event.type)).length;
    const actions = packageEvents.filter((event) => ["campaign_clicked", "preview_started", "purchase_completed"].includes(event.type)).length;
    const paid = purchases.filter((purchase) => keys.has(purchase.campaignKey) && purchase.status === "paid");
    return {
      ...definition,
      configuredCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter((row) => row.status === "active").length,
      metrics: {
        impressions,
        actions,
        attributedRevenue: round(paid.reduce((sum, row) => sum + Number(row.amount || 0), 0)),
        refunds: purchases.filter((row) => keys.has(row.campaignKey) && row.status === "refunded").length,
        supportLoad: packageEvents.filter((event) => ["support_contact_created", "support_escalated"].includes(event.type)).length,
      },
      attributionState: keys.size && packageEvents.length ? "observed" : "no_attributed_data",
    };
  }),
  financeBoundary: "Every active package must retain the RevenueCampaign ledger tracking key, refund handling, margin statement, and rollback plan.",
});

const serializeExperiment = (row = {}, eventCounts = {}) => ({
  id: toId(row),
  experimentKey: row.experimentKey || "",
  name: row.name || "",
  hypothesis: row.hypothesis || "",
  ownerName: row.ownerName || "",
  ownerRole: row.ownerRole || "",
  cohort: row.cohort || "",
  surface: row.surface || "",
  variants: row.variants || [],
  primaryMetric: row.primaryMetric || "",
  guardrailMetrics: row.guardrailMetrics || [],
  stopCondition: row.stopCondition || "",
  startAt: row.startAt || null,
  endAt: row.endAt || null,
  decisionAt: row.decisionAt || null,
  status: row.status || "draft",
  dataQualityState: row.dataQualityState || "not_checked",
  resultSummary: row.resultSummary || "",
  decision: row.decision || "",
  observedAssignments: Number(eventCounts[row.experimentKey] || 0),
});

const serializeAutomation = (row = {}, now = new Date()) => ({
  id: toId(row),
  suggestionType: row.suggestionType || "",
  targetType: row.targetType || "",
  targetId: row.targetId || "",
  title: row.title || "",
  suggestedAction: row.suggestedAction || "",
  confidence: Number(row.confidence || 0),
  sourceSignals: row.sourceSignals || {},
  status: row.expiresAt && toDate(row.expiresAt) < now && row.status === "pending" ? "expired" : row.status || "pending",
  humanDecision: row.humanDecision || "",
  reviewedAt: row.reviewedAt || null,
  expiresAt: row.expiresAt || null,
  authorizesSensitiveAction: false,
});

const serializeGovernanceDecision = (row = {}, now = new Date()) => {
  const effectiveStatus = row.expiresAt && toDate(row.expiresAt) < now && ["approved", "conditional"].includes(row.status) ? "expired" : row.status || "draft";
  const approvedRoles = unique((row.approvals || []).filter((approval) => approval.decision === "approved").map((approval) => approval.role));
  return {
    id: toId(row),
    decisionKey: row.decisionKey || "",
    workflowType: row.workflowType || "",
    subjectType: row.subjectType || "",
    subjectId: row.subjectId || "",
    title: row.title || "",
    ownerName: row.ownerName || "",
    ownerRole: row.ownerRole || "",
    riskLevel: row.riskLevel || "medium",
    status: effectiveStatus,
    requiredReviewRoles: row.requiredReviewRoles || [],
    approvedRoles,
    missingReviewRoles: (row.requiredReviewRoles || []).filter((role) => !approvedRoles.includes(role)),
    evidenceCount: (row.evidence || []).length,
    conditions: row.conditions || "",
    rollbackPlan: row.rollbackPlan || "",
    effectiveAt: row.effectiveAt || null,
    expiresAt: row.expiresAt || null,
    followUpAt: row.followUpAt || null,
  };
};

const buildCohortReviews = ({ scale = {}, events = [] } = {}) => {
  const expansionPaused = Boolean(scale.sloBudgets?.summary?.expansionPaused);
  const bets = scale.expansionScorecard?.bets || [];
  return bets.filter((bet) => ["controlled_launch", "expand", "hold", "exit"].includes(bet.state)).map((bet) => {
    const attributed = events.filter((event) => normalizeKey(event.metadata?.expansionBetKey) === normalizeKey(bet.betKey));
    const metrics = {
      creatorActivation: attributed.filter((event) => event.type === "creator_activation_completed").length,
      fanActivation: attributed.filter((event) => ["creator_followed", "preview_started", "purchase_completed"].includes(event.type)).length,
      subscriptions: attributed.filter((event) => ["subscription_started", "subscription_renewed"].includes(event.type)).length,
      refunds: attributed.filter((event) => event.type === "purchase_refunded").length,
      supportContacts: attributed.filter((event) => ["support_contact_created", "support_escalated"].includes(event.type)).length,
      moderationReports: attributed.filter((event) => ["content_reported", "moderation_queued"].includes(event.type)).length,
    };
    let decision = "repeat_with_changes";
    let rationale = "No complete attributed cohort evidence is available; repeat only after instrumentation and gate review.";
    if (expansionPaused) [decision, rationale] = ["hold", "A critical or uninstrumented SLO pauses cohort expansion."];
    else if (bet.state === "exit") [decision, rationale] = ["exit", "The durable expansion bet is in exit state."];
    else if (bet.state === "hold") [decision, rationale] = ["hold", "The durable expansion bet is held pending its recorded review."];
    else if (attributed.length && bet.averageScore >= 4 && metrics.refunds === 0) [decision, rationale] = ["expand", "The scorecard is strong and attributed signals show no refund guardrail breach in this window."];
    return {
      betKey: bet.betKey,
      cohortThesis: bet.cohortDefinition,
      launchGate: bet.gate,
      ownerName: bet.ownerName,
      stopCondition: bet.stopCondition,
      reviewAt: bet.reviewAt,
      metrics,
      evidenceState: attributed.length ? "partial_attributed_evidence" : "no_attributed_data",
      decision,
      rationale,
      choices: ["expand", "repeat_with_changes", "hold", "exit"],
    };
  });
};

const buildPartnerPackages = (pilotRows = []) => ({
  renewals: pilotRows.map((pilot) => ({
    pilotKey: pilot.pilotKey,
    name: pilot.name,
    status: pilot.status,
    sponsored: Boolean(pilot.sponsored),
    disclosureLabel: pilot.disclosureLabel || "",
    reviewAt: pilot.reviewAt,
    renewalReadiness: ["active", "completed"].includes(pilot.status) ? "review_ready" : "not_yet_eligible",
    sections: ["goals", "campaign_summary", "aggregate_audience_and_creator_fit", "content_and_moderation_outcomes", "gmv_and_engagement", "support_and_incidents", "next_offer", "risk_notes"],
    privacyBoundary: "Aggregate-only reporting; no user identifiers, private content, payment details, safety-case details, or Akuso memory.",
  })),
  sponsorPackage: {
    eligibleSurfaces: ["editorial_collection", "marketplace_spotlight", "creator_profile_feature"],
    requiredLabel: "Sponsored",
    controls: ["creator_consent", "brand_safety", "aggregate_measurement", "campaign_limits", "complaint_review", "finance_reconciliation", "revocation"],
    reportingCadence: "weekly_during_campaign_and_final_renewal_review",
    fanLevelRowsExposed: false,
  },
});

const buildNextRoadmapDecision = ({ unitEconomics = {}, referrals = {}, experiments = [], relationships = {}, partnerRows = [] } = {}) => {
  const candidates = [
    { key: "data_platform_and_experimentation", revenuePotential: 3, creatorImpact: 4, fanRetentionImpact: 4, supportLoad: 4, trustRisk: 4, engineeringCost: 3, timeToLearn: 5, reversibility: 5 },
    { key: "creator_category_expansion", revenuePotential: 4, creatorImpact: 5, fanRetentionImpact: 3, supportLoad: 3, trustRisk: 3, engineeringCost: 3, timeToLearn: 4, reversibility: 4 },
    { key: "partner_and_sponsor_revenue", revenuePotential: 5, creatorImpact: 3, fanRetentionImpact: 2, supportLoad: 2, trustRisk: 2, engineeringCost: 4, timeToLearn: 3, reversibility: 3 },
    { key: "fan_community_depth", revenuePotential: 3, creatorImpact: 4, fanRetentionImpact: 5, supportLoad: 3, trustRisk: 3, engineeringCost: 3, timeToLearn: 4, reversibility: 4 },
    { key: "automation_and_operating_leverage", revenuePotential: 3, creatorImpact: 3, fanRetentionImpact: 2, supportLoad: 5, trustRisk: 2, engineeringCost: 3, timeToLearn: 4, reversibility: 5 },
    { key: "mobile_and_low_bandwidth_growth", revenuePotential: 4, creatorImpact: 4, fanRetentionImpact: 4, supportLoad: 4, trustRisk: 4, engineeringCost: 2, timeToLearn: 3, reversibility: 4 },
  ].map((row) => ({ ...row, score: round((row.revenuePotential + row.creatorImpact + row.fanRetentionImpact + row.supportLoad + row.trustRisk + row.engineeringCost + row.timeToLearn + row.reversibility) / 8) }));
  if (unitEconomics.instrumentationGaps?.length) candidates.find((row) => row.key === "data_platform_and_experimentation").score += 1;
  if (!Number(referrals.summary?.firstFollow || 0)) candidates.find((row) => row.key === "fan_community_depth").score += 0.5;
  if (!partnerRows.some((row) => ["active", "completed"].includes(row.status))) candidates.find((row) => row.key === "partner_and_sponsor_revenue").score -= 0.75;
  if (!experiments.some((row) => row.status === "completed")) candidates.find((row) => row.key === "data_platform_and_experimentation").score += 0.5;
  if (Number(relationships.summary?.suppressed || 0) > Number(relationships.summary?.eligibleForPrompt || 0)) candidates.find((row) => row.key === "fan_community_depth").score -= 0.5;
  const ranked = candidates.sort((left, right) => right.score - left.score);
  return {
    primaryFocus: ranked[0]?.key || "data_platform_and_experimentation",
    secondaryBets: ranked.slice(1, 3).map((row) => row.key),
    rankedCandidates: ranked,
    decisionState: "evidence_recommendation_requires_leadership_confirmation",
    notNow: ranked.slice(3).map((row) => row.key),
  };
};

const buildExpansionPlatformOperatingView = ({
  scale = {},
  planRows = [],
  referralRows = [],
  experimentRows = [],
  automationRows = [],
  decisionRows = [],
  campaignRows = [],
  partnerRows = [],
  users = [],
  events = [],
  purchases = [],
  profileRows = [],
  now = new Date(),
} = {}) => {
  const referralAttribution = buildReferralReporting(referralRows);
  const fanRelationships = buildFanRelationshipReport({ users, events, purchases, now });
  const unitEconomics = buildUnitEconomics({ purchases, events, profileRows });
  const campaignPackages = buildCampaignPackages({ campaignRows, events, purchases });
  const eventCounts = events.reduce((result, event) => {
    const key = normalizeKey(event.metadata?.experimentKey);
    if (key) result[key] = Number(result[key] || 0) + 1;
    return result;
  }, {});
  const experiments = experimentRows.map((row) => serializeExperiment(row, eventCounts));
  const automationSuggestions = automationRows.map((row) => serializeAutomation(row, now));
  const governanceDecisions = decisionRows.map((row) => serializeGovernanceDecision(row, now));
  const cohortReviews = buildCohortReviews({ scale, events });
  const partnerPackages = buildPartnerPackages(partnerRows);
  const taxonomyObserved = EVENT_TAXONOMY.map((contract) => ({ ...contract, observed: events.filter((event) => contract.eventTypes.includes(event.type)).length }));
  const plans = planRows.map(serializeLaunchPlan);
  const nextRoadmap = buildNextRoadmapDecision({ unitEconomics, referrals: referralAttribution, experiments, relationships: fanRelationships, partnerRows });
  const activeCohortCount = (scale.expansionScorecard?.bets || []).filter((bet) => ["controlled_launch", "expand"].includes(bet.state)).length;
  return {
    generatedAt: now,
    summary: {
      roadmapPackagesComplete: ROADMAP_PACKAGES.length,
      activeCreatorPlans: plans.filter((plan) => !["completed", "cancelled"].includes(plan.status)).length,
      referralLinks: referralRows.length,
      activeExpansionCohorts: activeCohortCount,
      runningExperiments: experiments.filter((experiment) => experiment.status === "running").length,
      pendingAutomationReviews: automationSuggestions.filter((suggestion) => suggestion.status === "pending").length,
      governanceReviewsDue: governanceDecisions.filter((decision) => ["draft", "expired"].includes(decision.status)).length,
      unitEconomicsCompleteness: unitEconomics.summary.completenessState,
      nextPrimaryFocus: nextRoadmap.primaryFocus,
    },
    roadmapPackages: ROADMAP_PACKAGES,
    creatorPlaybooks: { catalog: PLAYBOOK_CATALOG, plans, summary: { total: plans.length, ready: plans.filter((plan) => plan.readinessState === "ready").length, reviewRequired: plans.filter((plan) => plan.status === "review_required").length } },
    referralAttribution,
    campaignPackages,
    dataAndExperiments: { eventTaxonomy: taxonomyObserved, metricContracts: METRIC_CONTRACTS, experiments, guardrailRule: "No experiment may run without hypothesis, owner, cohort, variants, primary metric, at least one guardrail, stop condition, decision date, and ready data-quality state." },
    expansionCohorts: { activeCount: activeCohortCount, scorecard: scale.expansionScorecard || {}, reviews: cohortReviews, weeklyReviewRequired: true },
    creatorMonetization: { offerTypes: CreatorLaunchPlan.CREATOR_OFFER_TYPES, configuredByType: CreatorLaunchPlan.CREATOR_OFFER_TYPES.map((type) => ({ type, plans: plans.filter((plan) => plan.offerType === type).length, launched: plans.filter((plan) => plan.offerType === type && ["launched", "completed"].includes(plan.status)).length })), financeBoundary: "Checkout, entitlement, refund, and ledger authorities are unchanged by launch planning." },
    fanRelationships,
    operationsAutomation: { allowedTypes: AutomationSuggestion.AUTOMATION_SUGGESTION_TYPES, suggestions: automationSuggestions, sensitiveActionsAlwaysHuman: ["payout_release", "refund_override", "account_restriction", "partner_report_publication", "content_takedown", "akuso_public_copy_publication"], executionAuthority: "none" },
    akusoExpansion: { capabilities: AKUSO_EXPANSION_CAPABILITIES, evalSuites: AKUSO_EXPANSION_EVAL_SUITES, reviewBoundary: "Public, partner-facing, financial, moderation-impacting, and governance copy remains a draft until an authorized human reviews it." },
    unitEconomics,
    partnerPackages,
    expansionGovernance: { controlMap: GOVERNANCE_CONTROL_MAP, decisions: governanceDecisions, independenceRule: "High-risk reviews require at least two distinct accountable roles; one person cannot satisfy multiple required roles on the same decision." },
    nextRoadmap,
    platform: {
      objectModel: PLATFORM_OBJECT_CATALOG,
      creatorBusinessSuite: CREATOR_BUSINESS_SUITE_MODULES,
      fanRelationshipModel: FAN_RELATIONSHIP_STAGES,
      metricContracts: METRIC_CONTRACTS,
      governanceControlMap: GOVERNANCE_CONTROL_MAP,
      launchPlanner: { active: true, offerTypes: CreatorLaunchPlan.CREATOR_OFFER_TYPES, elevatedRiskReviewRequired: true },
    },
  };
};

const buildExpansionPlatformOperatingSystem = async (filters = {}) => {
  const dates = buildDateRange(filters);
  const historyStart = new Date(dates.start.getTime() - 30 * DAY_MS);
  const [scale, planRows, referralRows, experimentRows, automationRows, decisionRows, campaignRows, partnerRows, users, events, purchases, profileRows] = await Promise.all([
    buildScaleEvidenceOperatingSystem(filters),
    CreatorLaunchPlan.find({ updatedAt: { $gte: historyStart, $lte: dates.end } }).sort({ updatedAt: -1 }).limit(1000).lean(),
    ReferralAttribution.find({ createdAt: { $lte: dates.end }, expiresAt: { $gte: historyStart } }).sort({ createdAt: -1 }).limit(5000).lean(),
    ExpansionExperiment.find({ startAt: { $lte: dates.end }, decisionAt: { $gte: historyStart } }).sort({ decisionAt: 1 }).limit(1000).lean(),
    AutomationSuggestion.find({ createdAt: { $lte: dates.end }, expiresAt: { $gte: historyStart } }).sort({ createdAt: -1 }).limit(2000).lean(),
    GovernanceDecision.find({ createdAt: { $lte: dates.end }, expiresAt: { $gte: historyStart } }).sort({ followUpAt: 1 }).limit(2000).lean(),
    RevenueCampaign.find({ createdAt: { $lte: dates.end }, $or: [{ endAt: { $gte: historyStart } }, { endAt: null }] }).sort({ updatedAt: -1 }).limit(1000).lean(),
    PartnerPilot.find({ createdAt: { $lte: dates.end } }).sort({ reviewAt: 1 }).limit(1000).lean(),
    User.find({ createdAt: { $lte: dates.end }, isDeleted: { $ne: true } }).select("_id notificationPrefs createdAt lastLogin").limit(MAX_ROWS).lean(),
    AnalyticsEvent.find({ createdAt: { $gte: historyStart, $lte: dates.end } }).select("type userId targetId targetType contentType metadata createdAt").sort({ createdAt: -1 }).limit(MAX_ROWS).lean(),
    Purchase.find({ createdAt: { $gte: historyStart, $lte: dates.end } }).select("userId creatorId itemType amount currency status provider creatorShareRate platformShareRate processingFeeAmount paidAt refundedAt createdAt").limit(MAX_ROWS).lean(),
    CreatorProfile.find({ isCreator: true }).select("_id creatorTypes country countryOfResidence").limit(5000).lean(),
  ]);
  return {
    filters: { range: dates.range, startDate: dates.start, endDate: dates.end },
    ...buildExpansionPlatformOperatingView({ scale, planRows, referralRows, experimentRows, automationRows, decisionRows, campaignRows, partnerRows, users, events, purchases, profileRows }),
  };
};

const determinePlanRisk = ({ offerType, price }) => {
  if (["live_event_pass", "marketplace_spotlight"].includes(offerType) || Number(price || 0) >= 500000) return "elevated";
  if (offerType === "paid_drop" && Number(price || 0) <= 50000) return "low";
  return "standard";
};

const createCreatorLaunchPlan = async ({ userId, payload = {} } = {}) => {
  assertObjectId(userId, "User id");
  const profile = await CreatorProfile.findOne({ userId });
  if (!profile) throw buildHttpError("Creator profile not found", 404);
  const playbookType = normalizeKey(payload.playbookType);
  const offerType = normalizeKey(payload.offerType);
  const playbook = getPlaybook(playbookType);
  if (!playbook) throw buildHttpError("Creator playbook type is invalid", 400);
  if (!playbook.offerTypes.includes(offerType)) throw buildHttpError("Offer type is not supported by this playbook", 400);
  const title = String(payload.title || "").trim();
  if (!title) throw buildHttpError("Launch plan title is required", 400);
  const payoutReadiness = buildPayoutReadiness(profile);
  const suffix = crypto.randomBytes(5).toString("hex");
  const riskLevel = determinePlanRisk({ offerType, price: payload.price });
  const row = new CreatorLaunchPlan({
    creatorProfile: profile._id,
    creatorUser: userId,
    planKey: `${normalizeKey(title).slice(0, 100)}_${suffix}`,
    title,
    playbookType,
    offerType,
    status: "planning",
    contentType: normalizeKey(payload.contentType),
    contentId: mongoose.Types.ObjectId.isValid(String(payload.contentId || "")) ? payload.contentId : null,
    launchAt: payload.launchAt || null,
    price: Number(payload.price || 0),
    currency: String(payload.currency || "NGN").trim().toUpperCase(),
    requiredMetadata: payload.requiredMetadata && typeof payload.requiredMetadata === "object" ? payload.requiredMetadata : {},
    coverReady: Boolean(payload.coverReady),
    previewReady: Boolean(payload.previewReady),
    payoutReadySnapshot: Boolean(payoutReadiness.ready),
    announcementDraft: String(payload.announcementDraft || "").trim(),
    fanUpdatePlan: String(payload.fanUpdatePlan || "").trim(),
    eligibilityNotes: playbook.campaignEligibility,
    successMetric: String(payload.successMetric || playbook.postLaunchReviewMetric).trim(),
    postLaunchReviewMetric: playbook.postLaunchReviewMetric,
    stopCondition: String(payload.stopCondition || "Pause promotion if refund, complaint, entitlement, support, or trust guardrails breach.").trim(),
    checklist: playbook.checklist.map((label, index) => ({ key: `${playbookType}_${index + 1}`, label, complete: false })),
    riskLevel,
    reviewReason: riskLevel === "elevated" ? "Live, marketplace, or high-value launch requires campaign, finance, or trust review before scheduling." : "",
    statusHistory: [{ status: "planning", actorId: userId, actorRole: "creator", reason: "Creator launch plan created" }],
  });
  await row.save();
  await AnalyticsEvent.create({ type: "creator_playbook_started", userId, actorRole: "creator", targetId: row._id, targetType: "creator_launch_plan", contentType: playbookType, metadata: { planKey: row.planKey, offerType, riskLevel } });
  return serializeLaunchPlan(row.toObject());
};

const updateCreatorLaunchPlan = async ({ userId, planId, updates = {} } = {}) => {
  assertObjectId(userId, "User id");
  assertObjectId(planId, "Launch plan id");
  const row = await CreatorLaunchPlan.findOne({ _id: planId, creatorUser: userId });
  if (!row) throw buildHttpError("Creator launch plan not found", 404);
  if (["completed", "cancelled"].includes(row.status)) throw buildHttpError("Final launch plans cannot be changed", 409);
  const editable = ["title", "contentType", "contentId", "launchAt", "price", "currency", "requiredMetadata", "coverReady", "previewReady", "announcementDraft", "fanUpdatePlan", "successMetric", "stopCondition"];
  const approvalSensitiveChange = row.status === "approved"
    && editable.some((field) => updates[field] !== undefined);
  if (row.status === "scheduled" && editable.some((field) => updates[field] !== undefined)) {
    throw buildHttpError("Pause the scheduled launch before changing approved launch details", 409);
  }
  editable.forEach((field) => { if (updates[field] !== undefined) row[field] = updates[field]; });
  if (Array.isArray(updates.checklist)) {
    const completion = new Map(updates.checklist.map((item) => [String(item.key || ""), Boolean(item.complete)]));
    row.checklist.forEach((item) => {
      if (!completion.has(item.key)) return;
      item.complete = completion.get(item.key);
      item.completedAt = item.complete ? item.completedAt || new Date() : null;
    });
  }
  const profile = await CreatorProfile.findById(row.creatorProfile);
  row.payoutReadySnapshot = Boolean(buildPayoutReadiness(profile || {}).ready);
  row.riskLevel = determinePlanRisk({ offerType: row.offerType, price: row.price });
  if (approvalSensitiveChange) {
    row.status = "review_required";
    row.reviewedBy = null;
    row.reviewedAt = null;
    row.reviewNote = "";
    row.statusHistory.push({
      status: "review_required",
      actorId: userId,
      actorRole: "creator",
      reason: "Material launch details changed after approval; independent review is required again.",
    });
  }
  const nextStatus = normalizeKey(updates.status || row.status);
  const transitions = {
    draft: ["draft", "planning", "cancelled"],
    planning: ["planning", "review_required", "scheduled", "cancelled"],
    review_required: ["review_required", "planning", "cancelled"],
    approved: ["approved", "scheduled", "planning", "cancelled"],
    scheduled: ["scheduled", "launched", "paused", "cancelled"],
    launched: ["launched", "completed", "paused"],
    paused: ["paused", "planning", "scheduled", "cancelled"],
  };
  if (!CreatorLaunchPlan.CREATOR_LAUNCH_PLAN_STATUSES.includes(nextStatus) || !(transitions[row.status] || [row.status]).includes(nextStatus)) {
    throw buildHttpError(`Launch plan cannot move from ${row.status} to ${nextStatus}`, 409);
  }
  if (nextStatus === "scheduled") {
    const blockers = planReadinessChecks(row).filter((check) => !check.complete).map((check) => check.key);
    if (blockers.length) throw buildHttpError("Launch plan is not ready to schedule", 409, { blockers });
    if (row.riskLevel === "elevated" && row.status !== "approved") throw buildHttpError("Elevated-risk launch requires admin approval before scheduling", 409);
  }
  if (nextStatus !== row.status) {
    const reason = String(updates.reason || "").trim();
    if (!reason) throw buildHttpError("A reason is required for launch status changes", 400);
    row.status = nextStatus;
    row.statusHistory.push({ status: nextStatus, actorId: userId, actorRole: "creator", reason });
  }
  await row.save();
  await AnalyticsEvent.create({ type: nextStatus === "scheduled" ? "creator_launch_scheduled" : nextStatus === "completed" ? "creator_launch_completed" : "creator_playbook_step_completed", userId, actorRole: "creator", targetId: row._id, targetType: "creator_launch_plan", contentType: row.playbookType, metadata: { planKey: row.planKey, status: row.status, completedSteps: row.checklist.filter((item) => item.complete).length } });
  return serializeLaunchPlan(row.toObject());
};

const reviewCreatorLaunchPlan = async ({ planId, adminUserId, decision, note = "" } = {}) => {
  assertObjectId(planId, "Launch plan id");
  const row = await CreatorLaunchPlan.findById(planId);
  if (!row) throw buildHttpError("Creator launch plan not found", 404);
  const normalizedDecision = normalizeKey(decision);
  if (!['approved', 'changes_required'].includes(normalizedDecision)) throw buildHttpError("Review decision is invalid", 400);
  if (row.status !== "review_required") throw buildHttpError("Only review-required launch plans can be reviewed", 409);
  const reviewNote = String(note || "").trim();
  if (!reviewNote) throw buildHttpError("A review note is required", 400);
  row.status = normalizedDecision === "approved" ? "approved" : "planning";
  row.reviewedBy = adminUserId || null;
  row.reviewedAt = new Date();
  row.reviewNote = reviewNote;
  row.statusHistory.push({ status: row.status, actorId: adminUserId || null, actorRole: "admin", reason: reviewNote });
  await row.save();
  return serializeLaunchPlan(row.toObject());
};

const createCreatorReferral = async ({ userId, payload = {} } = {}) => {
  assertObjectId(userId, "User id");
  const profile = await CreatorProfile.findOne({ userId }).select("_id").lean();
  if (!profile) throw buildHttpError("Creator profile not found", 404);
  const sourceType = normalizeKey(payload.sourceType || "creator_profile_share");
  if (!ReferralAttribution.REFERRAL_SOURCE_TYPES.includes(sourceType)) throw buildHttpError("Referral source type is invalid", 400);
  const token = crypto.randomBytes(20).toString("hex");
  const destinationPath = String(payload.destinationPath || "/creator/dashboard").trim();
  if (!destinationPath.startsWith("/") || destinationPath.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(destinationPath)) {
    throw buildHttpError("Referral destination must be a safe internal path", 400);
  }
  const expiresAt = toDate(payload.expiresAt) || new Date(Date.now() + 30 * DAY_MS);
  if (expiresAt <= new Date() || expiresAt > new Date(Date.now() + 90 * DAY_MS)) throw buildHttpError("Referral expiry must be within the next 90 days", 400);
  const row = await ReferralAttribution.create({
    token,
    sourceType,
    sourceKey: normalizeKey(payload.sourceKey || sourceType),
    creatorProfile: profile._id,
    campaign: mongoose.Types.ObjectId.isValid(String(payload.campaignId || "")) ? payload.campaignId : null,
    partnerPilot: null,
    destinationPath,
    label: String(payload.label || "Creator share").trim(),
    expiresAt,
    createdBy: userId,
  });
  await AnalyticsEvent.create({ type: "referral_invite_sent", userId, actorRole: "creator", targetId: row._id, targetType: "referral_attribution", contentType: sourceType, metadata: { sourceType, sourceKey: row.sourceKey } });
  return serializeReferral(row.toObject());
};

const findActiveReferral = async (token) => {
  const normalizedToken = String(token || "").trim().toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(normalizedToken)) throw buildHttpError("Referral link is invalid", 404);
  const row = await ReferralAttribution.findOne({ token: normalizedToken, status: "active", expiresAt: { $gt: new Date() } });
  if (!row) throw buildHttpError("Referral link is unavailable", 404);
  return row;
};

const recordReferralOpen = async ({ token } = {}) => {
  const row = await findActiveReferral(token);
  const actorHash = crypto.createHash("sha256").update(`${row.token}:${crypto.randomUUID()}`).digest("hex");
  await Promise.all([
    ReferralAttributionEvent.create({ attribution: row._id, milestone: "link_opened", actorHash }),
    ReferralAttribution.updateOne({ _id: row._id }, { $inc: { "counters.linkOpened": 1 } }),
    AnalyticsEvent.create({ type: "referral_link_opened", actorRole: "anonymous", targetId: row._id, targetType: "referral_attribution", contentType: row.sourceType, metadata: { sourceType: row.sourceType, sourceKey: row.sourceKey } }),
  ]);
  return { destinationPath: row.destinationPath, token: row.token, expiresAt: row.expiresAt };
};

const hasReferralMilestoneEvidence = async ({ row, userId, milestone }) => {
  const referralStartedAt = row.createdAt || new Date(0);
  const creatorId = toId(row.creatorProfile);
  if (milestone === "signup") {
    const user = await User.findById(userId).select("createdAt").lean();
    return Boolean(user?.createdAt && toDate(user.createdAt) >= toDate(referralStartedAt));
  }
  if (milestone === "first_follow") {
    const [creator, viewer, followEvent] = await Promise.all([
      CreatorProfile.findById(row.creatorProfile).select("userId").lean(),
      User.findById(userId).select("following").lean(),
      AnalyticsEvent.exists({
        userId,
        type: "creator_followed",
        createdAt: { $gte: referralStartedAt },
        $or: [
          { targetId: row.creatorProfile },
          { "metadata.creatorId": creatorId },
        ],
      }),
    ]);
    return Boolean(
      creator?.userId
      && viewer?.following?.some((followedId) => toId(followedId) === toId(creator.userId))
      && followEvent
    );
  }
  if (milestone === "first_preview") {
    return Boolean(await AnalyticsEvent.exists({
      userId,
      type: { $in: ["preview_started", "track_preview_started", "track_stream_started", "book_preview_opened", "paywall_viewed"] },
      createdAt: { $gte: referralStartedAt },
      "metadata.creatorId": creatorId,
    }));
  }
  if (["first_purchase", "first_subscription"].includes(milestone)) {
    return Boolean(await Purchase.exists({
      userId,
      creatorId: row.creatorProfile,
      status: "paid",
      createdAt: { $gte: referralStartedAt },
      ...(milestone === "first_subscription" ? { itemType: "subscription" } : {}),
    }));
  }
  if (milestone === "d7_return") {
    return Boolean(await AnalyticsEvent.exists({
      userId,
      type: "session_returned",
      createdAt: { $gte: new Date(toDate(referralStartedAt).getTime() + 7 * DAY_MS) },
    }));
  }
  return false;
};

const recordReferralMilestone = async ({ token, userId, milestone } = {}) => {
  assertObjectId(userId, "User id");
  const normalizedMilestone = normalizeKey(milestone);
  if (!ReferralAttributionEvent.REFERRAL_MILESTONES.includes(normalizedMilestone) || normalizedMilestone === "link_opened") throw buildHttpError("Referral milestone is invalid", 400);
  const row = await findActiveReferral(token);
  if (!(await hasReferralMilestoneEvidence({ row, userId, milestone: normalizedMilestone }))) {
    throw buildHttpError("Referral milestone requires server-confirmed activity", 409);
  }
  const actorHash = crypto.createHash("sha256").update(`${row.token}:${userId}:${normalizedMilestone}`).digest("hex");
  const counterMap = { signup: "signup", first_follow: "firstFollow", first_preview: "firstPreview", first_purchase: "firstPurchase", first_subscription: "firstSubscription", d7_return: "d7Return" };
  let created = false;
  try {
    const writeResult = await ReferralAttributionEvent.updateOne(
      { attribution: row._id, milestone: normalizedMilestone, actorHash },
      { $setOnInsert: { attribution: row._id, milestone: normalizedMilestone, actorHash } },
      { upsert: true }
    );
    created = Number(writeResult.upsertedCount || 0) === 1;
  } catch (error) {
    if (Number(error?.code || 0) !== 11000) throw error;
  }
  if (created) {
    await Promise.all([
      ReferralAttribution.updateOne({ _id: row._id }, { $inc: { [`counters.${counterMap[normalizedMilestone]}`]: 1 } }),
      AnalyticsEvent.create({ type: `referral_${normalizedMilestone}`, actorRole: "authenticated", targetId: row._id, targetType: "referral_attribution", contentType: row.sourceType, metadata: { sourceType: row.sourceType, sourceKey: row.sourceKey } }),
    ]);
  }
  return { recorded: created, milestone: normalizedMilestone };
};

const createExpansionExperiment = async ({ payload = {}, adminUserId } = {}) => {
  const experimentKey = normalizeKey(payload.experimentKey || payload.name);
  const variants = Array.isArray(payload.variants) ? payload.variants.map((variant) => ({ key: normalizeKey(variant.key), description: String(variant.description || "").trim(), allocationPercent: Number(variant.allocationPercent || 0) })) : [];
  if (!experimentKey || !String(payload.name || "").trim()) throw buildHttpError("Experiment name and key are required", 400);
  if (variants.length < 2) throw buildHttpError("At least two experiment variants are required", 400);
  if (!Array.isArray(payload.guardrailMetrics) || !payload.guardrailMetrics.length) throw buildHttpError("At least one guardrail metric is required", 400);
  const row = new ExpansionExperiment({
    experimentKey,
    name: String(payload.name).trim(),
    hypothesis: String(payload.hypothesis || "").trim(),
    ownerName: String(payload.ownerName || "").trim(),
    ownerRole: String(payload.ownerRole || "Product and data").trim(),
    cohort: String(payload.cohort || "").trim(),
    surface: normalizeKey(payload.surface),
    variants,
    primaryMetric: normalizeKey(payload.primaryMetric),
    guardrailMetrics: unique(payload.guardrailMetrics.map(normalizeKey)),
    stopCondition: String(payload.stopCondition || "").trim(),
    startAt: payload.startAt,
    endAt: payload.endAt,
    decisionAt: payload.decisionAt,
    status: "draft",
    metadata: payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {},
    createdBy: adminUserId,
    lastChangedBy: adminUserId,
    statusHistory: [{ status: "draft", actorId: adminUserId, reason: "Experiment draft created" }],
  });
  await row.save();
  return serializeExperiment(row.toObject());
};

const updateExpansionExperiment = async ({ experimentId, updates = {}, adminUserId } = {}) => {
  assertObjectId(experimentId, "Experiment id");
  const row = await ExpansionExperiment.findById(experimentId);
  if (!row) throw buildHttpError("Experiment not found", 404);
  const nextStatus = normalizeKey(updates.status || row.status);
  const transitions = { draft: ["draft", "review", "cancelled"], review: ["review", "draft", "approved", "cancelled"], approved: ["approved", "running", "paused", "cancelled"], running: ["running", "paused", "completed", "cancelled"], paused: ["paused", "approved", "running", "completed", "cancelled"], completed: ["completed"], cancelled: ["cancelled"] };
  if (!ExpansionExperiment.EXPANSION_EXPERIMENT_STATUSES.includes(nextStatus) || !transitions[row.status].includes(nextStatus)) throw buildHttpError(`Experiment cannot move from ${row.status} to ${nextStatus}`, 409);
  ["name", "hypothesis", "ownerName", "ownerRole", "cohort", "surface", "variants", "primaryMetric", "guardrailMetrics", "stopCondition", "startAt", "endAt", "decisionAt", "dataQualityState", "resultSummary", "decision", "metadata"].forEach((field) => { if (updates[field] !== undefined) row[field] = updates[field]; });
  if (nextStatus === "running" && row.dataQualityState !== "ready") throw buildHttpError("Experiment data quality must be ready before running", 409);
  if (["approved", "running"].includes(nextStatus) && (!(row.variants || []).length || !(row.guardrailMetrics || []).length || !row.stopCondition)) throw buildHttpError("Experiment governance fields are incomplete", 409);
  if (nextStatus !== row.status) {
    const reason = String(updates.reason || "").trim();
    if (!reason) throw buildHttpError("A reason is required for experiment status changes", 400);
    row.status = nextStatus;
    row.statusHistory.push({ status: nextStatus, actorId: adminUserId || null, reason });
  }
  row.lastChangedBy = adminUserId || null;
  await row.save();
  return serializeExperiment(row.toObject());
};

const createAutomationSuggestion = async ({ payload = {}, adminUserId } = {}) => {
  const suggestionType = normalizeKey(payload.suggestionType);
  if (!AutomationSuggestion.AUTOMATION_SUGGESTION_TYPES.includes(suggestionType)) throw buildHttpError("Automation suggestion type is invalid", 400);
  const expiresAt = toDate(payload.expiresAt) || new Date(Date.now() + 7 * DAY_MS);
  if (expiresAt <= new Date()) throw buildHttpError("Automation suggestion expiry must be in the future", 400);
  const row = await AutomationSuggestion.create({
    suggestionType,
    targetType: normalizeKey(payload.targetType),
    targetId: String(payload.targetId || "").trim(),
    title: String(payload.title || "").trim(),
    suggestedAction: String(payload.suggestedAction || "").trim(),
    confidence: Number(payload.confidence),
    sourceSignals: payload.sourceSignals && typeof payload.sourceSignals === "object" ? payload.sourceSignals : {},
    expiresAt,
    authorizesSensitiveAction: false,
    createdBy: adminUserId,
  });
  return serializeAutomation(row.toObject());
};

const reviewAutomationSuggestion = async ({ suggestionId, decision, reason, adminUserId } = {}) => {
  assertObjectId(suggestionId, "Automation suggestion id");
  const row = await AutomationSuggestion.findById(suggestionId);
  if (!row) throw buildHttpError("Automation suggestion not found", 404);
  if (row.status !== "pending") throw buildHttpError("Automation suggestion is no longer pending", 409);
  const nextStatus = normalizeKey(decision);
  if (!["accepted", "rejected"].includes(nextStatus)) throw buildHttpError("Automation review decision is invalid", 400);
  const humanDecision = String(reason || "").trim();
  if (!humanDecision) throw buildHttpError("A human decision reason is required", 400);
  row.status = nextStatus;
  row.humanDecision = humanDecision;
  row.reviewedBy = adminUserId || null;
  row.reviewedAt = new Date();
  await row.save();
  return serializeAutomation(row.toObject());
};

const createGovernanceDecision = async ({ payload = {}, adminUserId } = {}) => {
  const workflowType = normalizeKey(payload.workflowType);
  if (!GovernanceDecision.GOVERNANCE_WORKFLOW_TYPES.includes(workflowType)) throw buildHttpError("Governance workflow type is invalid", 400);
  const riskLevel = normalizeKey(payload.riskLevel || "high");
  const decisionKey = normalizeKey(payload.decisionKey || `${workflowType}_${payload.subjectId}`);
  const requiredReviewRoles = unique((Array.isArray(payload.requiredReviewRoles) ? payload.requiredReviewRoles : []).map(normalizeKey));
  const row = new GovernanceDecision({
    decisionKey,
    workflowType,
    subjectType: normalizeKey(payload.subjectType),
    subjectId: String(payload.subjectId || "").trim(),
    title: String(payload.title || "").trim(),
    ownerName: String(payload.ownerName || "").trim(),
    ownerRole: String(payload.ownerRole || "").trim(),
    riskLevel,
    requiredReviewRoles,
    evidence: Array.isArray(payload.evidence) ? payload.evidence : [],
    conditions: String(payload.conditions || "").trim(),
    rollbackPlan: String(payload.rollbackPlan || "").trim(),
    expiresAt: payload.expiresAt,
    followUpAt: payload.followUpAt,
    createdBy: adminUserId,
    lastChangedBy: adminUserId,
    history: [{ status: "draft", actorId: adminUserId, reason: "Governance decision opened" }],
  });
  await row.save();
  return serializeGovernanceDecision(row.toObject());
};

const updateGovernanceDecision = async ({ decisionId, updates = {}, adminUserId } = {}) => {
  assertObjectId(decisionId, "Governance decision id");
  const row = await GovernanceDecision.findById(decisionId);
  if (!row) throw buildHttpError("Governance decision not found", 404);
  if (["expired", "revoked", "rejected"].includes(row.status)) throw buildHttpError("Final governance decisions cannot be changed", 409);
  if (updates.approvalRole || updates.approvalDecision) {
    const role = normalizeKey(updates.approvalRole);
    const approvalDecision = normalizeKey(updates.approvalDecision);
    if (!(row.requiredReviewRoles || []).includes(role)) throw buildHttpError("Approval role is not required for this decision", 400);
    if (!["approved", "rejected", "conditional"].includes(approvalDecision)) throw buildHttpError("Approval decision is invalid", 400);
    if (row.approvals.some((approval) => toId(approval.reviewerId) === toId(adminUserId) && approval.role !== role)) throw buildHttpError("One reviewer cannot satisfy multiple required roles", 409);
    const existing = row.approvals.find((approval) => approval.role === role);
    if (existing) {
      existing.reviewerId = adminUserId;
      existing.decision = approvalDecision;
      existing.note = String(updates.reason || "").trim();
      existing.at = new Date();
    } else {
      row.approvals.push({ role, reviewerId: adminUserId, decision: approvalDecision, note: String(updates.reason || "").trim() });
    }
  }
  ["ownerName", "ownerRole", "conditions", "rollbackPlan", "expiresAt", "followUpAt", "evidence"].forEach((field) => { if (updates[field] !== undefined) row[field] = updates[field]; });
  const nextStatus = normalizeKey(updates.status || row.status);
  if (!GovernanceDecision.GOVERNANCE_DECISION_STATUSES.includes(nextStatus)) throw buildHttpError("Governance status is invalid", 400);
  if (["approved", "conditional"].includes(nextStatus)) {
    const approvedRoles = unique(row.approvals.filter((approval) => approval.decision === "approved" || (nextStatus === "conditional" && approval.decision === "conditional")).map((approval) => approval.role));
    const missing = row.requiredReviewRoles.filter((role) => !approvedRoles.includes(role));
    if (missing.length) throw buildHttpError("Required independent approvals are incomplete", 409, { missingRoles: missing });
    if (!(row.evidence || []).length) throw buildHttpError("Governance evidence is required before approval", 409);
  }
  if (nextStatus !== row.status) {
    const reason = String(updates.reason || "").trim();
    if (!reason) throw buildHttpError("A reason is required for governance status changes", 400);
    row.status = nextStatus;
    row.history.push({ status: nextStatus, actorId: adminUserId || null, reason });
    if (["approved", "conditional"].includes(nextStatus)) row.effectiveAt = new Date();
  }
  row.lastChangedBy = adminUserId || null;
  await row.save();
  return serializeGovernanceDecision(row.toObject());
};

module.exports = {
  AKUSO_EXPANSION_CAPABILITIES,
  AKUSO_EXPANSION_EVAL_SUITES,
  CAMPAIGN_PACKAGE_CATALOG,
  CREATOR_BUSINESS_SUITE_MODULES,
  EVENT_TAXONOMY,
  FAN_RELATIONSHIP_STAGES,
  GOVERNANCE_CONTROL_MAP,
  METRIC_CONTRACTS,
  PLATFORM_OBJECT_CATALOG,
  PLAYBOOK_CATALOG,
  ROADMAP_PACKAGES,
  buildCampaignPackages,
  buildCreatorBusinessSuite,
  buildExpansionPlatformOperatingSystem,
  buildExpansionPlatformOperatingView,
  buildFanRelationshipReport,
  buildNextRoadmapDecision,
  buildReferralReporting,
  buildUnitEconomics,
  createAutomationSuggestion,
  createCreatorLaunchPlan,
  createCreatorReferral,
  createExpansionExperiment,
  createGovernanceDecision,
  planReadinessChecks,
  recordReferralMilestone,
  recordReferralOpen,
  reviewAutomationSuggestion,
  reviewCreatorLaunchPlan,
  serializeAutomation,
  serializeExperiment,
  serializeGovernanceDecision,
  serializeLaunchPlan,
  serializeReferral,
  updateCreatorLaunchPlan,
  updateExpansionExperiment,
  updateGovernanceDecision,
};
