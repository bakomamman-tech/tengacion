const mongoose = require("mongoose");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const User = require("../models/User");
const CreatorProfile = require("../models/CreatorProfile");
const CreatorPayoutRequest = require("../models/CreatorPayoutRequest");
const CreatorLifecycleEnrollment = require("../models/CreatorLifecycleEnrollment");
const RevenueCampaign = require("../models/RevenueCampaign");
const Purchase = require("../models/Purchase");
const Track = require("../models/Track");
const Album = require("../models/Album");
const Book = require("../models/Book");
const Video = require("../models/Video");
const Report = require("../models/Report");
const AdminComplaint = require("../models/AdminComplaint");
const { buildDateRange } = require("./analyticsService");
const { buildPayoutReadiness } = require("./payoutReadinessService");
const { buildAssuranceDashboard } = require("./assuranceDashboardService");

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_REPORT_ROWS = 10000;
const MAX_CREATOR_ROWS = 500;

const PAYOUT_AUTOMATION_POLICY = Object.freeze({
  enabled: String(process.env.PAYOUT_AUTOMATION_ENABLED || "true").toLowerCase() !== "false",
  highValueAmount: Math.max(0, Number(process.env.PAYOUT_AUTOMATION_HIGH_VALUE_NGN || 250000)),
  payoutMethodFreshnessDays: Math.max(1, Number(process.env.PAYOUT_AUTOMATION_METHOD_FRESHNESS_DAYS || 90)),
  recentMethodChangeDays: Math.max(1, Number(process.env.PAYOUT_AUTOMATION_RECENT_CHANGE_DAYS || 7)),
  unusualEarningSpikeMultiplier: Math.max(1, Number(process.env.PAYOUT_AUTOMATION_SPIKE_MULTIPLIER || 3)),
  maximumRefundRate: Math.min(1, Math.max(0, Number(process.env.PAYOUT_AUTOMATION_MAX_REFUND_RATE || 0.1))),
  maximumReportRate: Math.min(1, Math.max(0, Number(process.env.PAYOUT_AUTOMATION_MAX_REPORT_RATE || 0.05))),
});

const CREATOR_PROGRAM_CATALOG = Object.freeze([
  {
    key: "new_creator_activation",
    title: "New Creator Activation",
    entryTrigger: "Creator setup or first publish is incomplete.",
    prompt: "Complete the remaining profile, payout, and first-publish steps.",
    akusoTemplate: "creator_activation_checklist",
    targetMetric: "first publish rate",
    graduationCondition: "Profile is launch-ready and at least one item is published.",
    checklist: ["Complete profile", "Confirm creator category", "Complete payout setup", "Publish first item"],
  },
  {
    key: "first_paid_drop",
    title: "First Paid Drop",
    entryTrigger: "Creator has published content but has no paid sale.",
    prompt: "Package and announce a first paid offer with clear preview and pricing.",
    akusoTemplate: "launch_announcement",
    targetMetric: "first sale conversion",
    graduationCondition: "First paid purchase is confirmed and ledger-attributed.",
    checklist: ["Select paid item", "Review preview", "Review price", "Draft announcement"],
  },
  {
    key: "subscription_launch",
    title: "Subscription Launch",
    entryTrigger: "Creator is active but has no subscription conversion.",
    prompt: "Define reviewable subscriber benefits and announce the package.",
    akusoTemplate: "subscription_benefits",
    targetMetric: "subscription activation",
    graduationCondition: "First paid subscription is active.",
    checklist: ["Set subscription price", "Define benefits", "Draft fan update", "Review renewal support"],
  },
  {
    key: "live_event_launch",
    title: "Live Event Launch",
    entryTrigger: "Creator is publish-ready and has a scheduled live opportunity.",
    prompt: "Prepare a live session, fan reminder, access check, and fallback update.",
    akusoTemplate: "fan_update",
    targetMetric: "live reminder-to-join rate",
    graduationCondition: "A live session completes with measured joins.",
    checklist: ["Schedule live", "Verify access", "Set reminder", "Prepare fallback update"],
  },
  {
    key: "dormant_creator_reactivation",
    title: "Dormant Creator Reactivation",
    entryTrigger: "No catalog update or publish event for at least 60 days.",
    prompt: "Choose one small catalog refresh or fan update to restart momentum.",
    akusoTemplate: "fan_update",
    targetMetric: "creator reactivation rate",
    graduationCondition: "Creator publishes or updates catalog and returns within 30 days.",
    checklist: ["Review catalog health", "Choose next release", "Update metadata", "Notify followers"],
  },
  {
    key: "high_potential_creator_growth",
    title: "High-Potential Creator Growth",
    entryTrigger: "Creator has repeat sales or subscriptions and healthy trust evidence.",
    prompt: "Build a measured four-week content, campaign, and fan-return plan.",
    akusoTemplate: "creator_growth_plan",
    targetMetric: "earnings and retained fan growth",
    graduationCondition: "Four-week growth target is reviewed with no guardrail breach.",
    checklist: ["Set four-week target", "Build drop calendar", "Review fan cohorts", "Review payout capacity"],
  },
]);

const FAN_LIFECYCLE_CATALOG = Object.freeze([
  { key: "new_user_first_action", title: "First Meaningful Action", action: "Show creator discovery with a clear follow, save, or preview action." },
  { key: "first_creator_follow", title: "First Creator Follow", action: "Show followed-creator updates and a relevant continue rail." },
  { key: "first_paid_unlock", title: "First Paid Unlock", action: "Show the unlocked item, receipt, and a low-frequency creator return path." },
  { key: "first_subscription", title: "First Subscription", action: "Show benefits, renewal date, creator activity, and cancellation controls." },
  { key: "renewal_risk", title: "Renewal Risk", action: "Explain failure or cancellation state and offer a secure recovery path." },
  { key: "dormant_fan_reactivation", title: "Dormant Fan Reactivation", action: "Use one consented saved-content or followed-creator reminder." },
  { key: "active_relationship", title: "Active Creator Relationship", action: "Keep frequency bounded and prioritize continue, live, and relationship depth." },
]);

const CAMPAIGN_TYPE_CATALOG = Object.freeze([
  "creator_drop",
  "subscription_launch",
  "bundle_offer",
  "live_event_pass",
  "marketplace_creator_spotlight",
  "partner_sponsored_feature",
]);

const MODERATION_SLA_CATALOG = Object.freeze([
  { key: "assistant_output", title: "Assistant Output Reports", targetHours: 4, escalationOwner: "AI and safety" },
  { key: "content_report", title: "Content Reports", targetHours: 24, escalationOwner: "Trust and safety" },
  { key: "marketplace_dispute", title: "Marketplace Disputes", targetHours: 24, escalationOwner: "Finance and operations" },
  { key: "recommendation_report", title: "Recommendation Reports", targetHours: 24, escalationOwner: "Discovery and analytics" },
  { key: "creator_profile", title: "Creator Profile Reports", targetHours: 48, escalationOwner: "Creator support" },
]);

const toId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return String(value._id);
  return String(value);
};

const toDate = (value) => {
  const date = value instanceof Date ? value : new Date(value || 0);
  return Number.isNaN(date.getTime()) ? null : date;
};

const roundRate = (value) => Number(Math.max(0, Number(value || 0)).toFixed(4));
const hoursOld = (value, now = new Date()) => {
  const date = toDate(value);
  return date ? Math.max(0, (now.getTime() - date.getTime()) / (60 * 60 * 1000)) : 0;
};
const daysOld = (value, now = new Date()) => hoursOld(value, now) / 24;
const isWithinDays = (value, days, now = new Date()) => {
  const date = toDate(value);
  return Boolean(date && now.getTime() - date.getTime() <= days * DAY_MS);
};

const groupBy = (rows = [], keyBuilder) => rows.reduce((map, row) => {
  const key = keyBuilder(row);
  if (!key) return map;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(row);
  return map;
}, new Map());

const latestDate = (rows = []) => rows.reduce((latest, row) => {
  const date = toDate(row?.createdAt || row?.updatedAt || row?.paidAt);
  return date && (!latest || date > latest) ? date : latest;
}, null);

const serializeEnrollment = (row = {}) => ({
  id: toId(row._id),
  creatorProfileId: toId(row.creatorProfile?._id || row.creatorProfile),
  creatorUserId: toId(row.creatorUser?._id || row.creatorUser),
  creatorName: row.creatorProfile?.displayName || "",
  programKey: row.programKey || "",
  lifecycleStage: row.lifecycleStage || "",
  status: row.status || "candidate",
  ownerName: row.ownerName || "",
  ownerRole: row.ownerRole || "Creator growth",
  checklist: Array.isArray(row.checklist) ? row.checklist : [],
  metricSnapshot: row.metricSnapshot || {},
  entryReason: row.entryReason || "",
  adminNote: row.adminNote || "",
  enrolledAt: row.enrolledAt || null,
  launchedAt: row.launchedAt || null,
  graduatedAt: row.graduatedAt || null,
  lastEvaluatedAt: row.lastEvaluatedAt || null,
});

const campaignReadinessChecks = (campaign = {}) => [
  { key: "owner", label: "Named owner", complete: Boolean(campaign.ownerName && campaign.ownerRole) },
  { key: "window", label: "Start and end window", complete: Boolean(toDate(campaign.startAt) && toDate(campaign.endAt) && toDate(campaign.endAt) > toDate(campaign.startAt)) },
  { key: "eligibility", label: "Eligible creator or content scope", complete: Boolean((campaign.eligibleCreatorIds || []).length || (campaign.eligibleContentIds || []).length) },
  { key: "price_rule", label: "Price or discount rule", complete: Boolean(campaign.priceRule) },
  { key: "margin", label: "Expected margin impact", complete: Boolean(campaign.expectedMarginImpact) },
  { key: "refunds", label: "Refund and dispute handling", complete: Boolean(campaign.refundAndDisputeHandling) },
  { key: "metric", label: "Success metric", complete: Boolean(campaign.successMetric) },
  { key: "ledger", label: "Ledger tracking key", complete: Boolean(campaign.ledgerTrackingKey) },
  { key: "rollback", label: "Rollback plan", complete: Boolean(campaign.rollbackPlan) },
];

const serializeCampaign = (row = {}, now = new Date()) => {
  const checks = campaignReadinessChecks(row);
  const blockers = checks.filter((check) => !check.complete);
  return {
    id: toId(row._id),
    name: row.name || "",
    campaignKey: row.campaignKey || "",
    type: row.type || "",
    status: row.status || "draft",
    ownerName: row.ownerName || "",
    ownerRole: row.ownerRole || "",
    startAt: row.startAt || null,
    endAt: row.endAt || null,
    eligibleCreatorIds: (row.eligibleCreatorIds || []).map(toId),
    eligibleContentIds: (row.eligibleContentIds || []).map(toId),
    currency: row.currency || "NGN",
    priceRule: row.priceRule || "",
    discountPercent: Number(row.discountPercent || 0),
    expectedMarginImpact: row.expectedMarginImpact || "",
    refundAndDisputeHandling: row.refundAndDisputeHandling || "",
    successMetric: row.successMetric || "",
    ledgerTrackingKey: row.ledgerTrackingKey || "",
    rollbackPlan: row.rollbackPlan || "",
    guardrails: row.guardrails || {},
    readinessState: blockers.length ? "blocked" : row.status === "draft" ? "watch" : "ready",
    readinessChecks: checks,
    blockers: blockers.map((check) => check.key),
    canDisableCleanly: ["draft", "ready", "active", "paused"].includes(row.status || "draft"),
    inWindow: Boolean(toDate(row.startAt) && toDate(row.endAt) && toDate(row.startAt) <= now && toDate(row.endAt) >= now),
  };
};

const buildPayoutAutomationDecision = ({
  request = {},
  profile = {},
  creatorPurchases = [],
  creatorReports = [],
  priorRequests = [],
  now = new Date(),
  policy = PAYOUT_AUTOMATION_POLICY,
} = {}) => {
  const readiness = buildPayoutReadiness(profile || {});
  const completedSales = creatorPurchases.filter((purchase) => purchase.status === "paid");
  const refundedSales = creatorPurchases.filter((purchase) => purchase.status === "refunded");
  const paidPayouts = priorRequests.filter((entry) => entry.status === "paid");
  const openDuplicates = priorRequests.filter((entry) =>
    toId(entry._id) !== toId(request._id)
      && ["pending_review", "approved", "processing"].includes(entry.status)
      && Number(entry.amount || 0) === Number(request.amount || 0)
      && String(entry.currency || "NGN") === String(request.currency || "NGN")
  );
  const averageSale = completedSales.length
    ? completedSales.reduce((sum, purchase) => sum + Number(purchase.amount || 0), 0) / completedSales.length
    : 0;
  const refundRate = roundRate(refundedSales.length / Math.max(1, completedSales.length + refundedSales.length));
  const reportRate = roundRate(creatorReports.length / Math.max(1, completedSales.length));
  const availableSnapshot = Number(
    request.balanceSnapshot?.availableForRequest
      ?? request.balanceSnapshot?.availableBalance
      ?? request.balanceSnapshot?.available
      ?? 0
  );
  const validation = [
    { key: "approved", passed: request.status === "approved", detail: "Request has human finance approval." },
    { key: "payout_ready", passed: Boolean(readiness.ready && readiness.canRequestPayout), detail: readiness.nextStep || readiness.label || "Payout readiness checked." },
    { key: "no_duplicate", passed: openDuplicates.length === 0, detail: openDuplicates.length ? `${openDuplicates.length} similar open request(s).` : "No similar open request." },
    { key: "balance_snapshot", passed: availableSnapshot > 0 && Number(request.amount || 0) <= availableSnapshot, detail: availableSnapshot > 0 ? `Available snapshot ${availableSnapshot}.` : "A current available-balance snapshot is required." },
    { key: "not_batched", passed: !request.payoutBatch, detail: request.payoutBatch ? "Request is already assigned to a batch." : "Request is not batched." },
  ];
  const riskFlags = [];
  if (!paidPayouts.length) riskFlags.push({ key: "first_payout", severity: "high", requiresHumanApproval: true });
  if (Number(request.amount || 0) >= policy.highValueAmount) riskFlags.push({ key: "high_value_payout", severity: "high", requiresHumanApproval: true });
  if (averageSale > 0 && Number(request.amount || 0) > averageSale * policy.unusualEarningSpikeMultiplier) riskFlags.push({ key: "unusual_earning_spike", severity: "medium", requiresHumanApproval: true });
  if (refundRate > policy.maximumRefundRate) riskFlags.push({ key: "high_refund_rate", severity: "high", requiresHumanApproval: true, value: refundRate });
  if (reportRate > policy.maximumReportRate) riskFlags.push({ key: "high_report_rate", severity: "high", requiresHumanApproval: true, value: reportRate });
  if (isWithinDays(profile.updatedAt, policy.recentMethodChangeDays, now)) riskFlags.push({ key: "recent_payout_method_change", severity: "medium", requiresHumanApproval: true });
  if (!profile.payoutRecipientVerifiedAt || profile.status !== "active") riskFlags.push({ key: "identity_or_verification_mismatch", severity: "high", requiresHumanApproval: true });
  if (profile.updatedAt && daysOld(profile.updatedAt, now) > policy.payoutMethodFreshnessDays) riskFlags.push({ key: "stale_payout_method", severity: "medium", requiresHumanApproval: true });

  const validationPassed = validation.every((check) => check.passed);
  const humanApprovalRequired = riskFlags.some((flag) => flag.requiresHumanApproval);
  return {
    requestId: toId(request._id),
    requestReference: request.requestReference || "",
    creatorProfileId: toId(profile._id || request.creatorProfile),
    amount: Number(request.amount || 0),
    currency: request.currency || "NGN",
    validation,
    validationPassed,
    riskFlags,
    humanApprovalRequired,
    automationEnabled: Boolean(policy.enabled),
    batchPreflightEligible: Boolean(policy.enabled && validationPassed && !humanApprovalRequired),
    moneyMovementAuthorized: false,
    decision: !policy.enabled
      ? "automation_disabled"
      : !validationPassed
        ? "blocked"
        : humanApprovalRequired
          ? "human_review_required"
          : "eligible_for_batch_preparation",
  };
};

const contentOwnerId = (item = {}) => toId(item.creatorId || item.creatorProfileId);
const normalizeContentRows = (contentRows = []) => contentRows.map((item) => ({
  ...item,
  creatorProfileId: contentOwnerId(item),
})).filter((item) => item.creatorProfileId);

const buildCreatorLifecycle = ({
  profiles = [],
  contentRows = [],
  purchases = [],
  reports = [],
  enrollments = [],
  now = new Date(),
} = {}) => {
  const contentByCreator = groupBy(normalizeContentRows(contentRows), (item) => item.creatorProfileId);
  const purchasesByCreator = groupBy(purchases, (purchase) => toId(purchase.creatorId));
  const reportsByUser = groupBy(reports, (report) => toId(report.targetId));
  const enrollmentByCreator = groupBy(enrollments, (entry) => toId(entry.creatorProfile?._id || entry.creatorProfile));

  const creators = profiles.map((profile) => {
    const profileId = toId(profile._id);
    const userId = toId(profile.userId?._id || profile.userId);
    const items = contentByCreator.get(profileId) || [];
    const sales = (purchasesByCreator.get(profileId) || []).filter((purchase) => purchase.status === "paid");
    const subscriptions = sales.filter((purchase) => purchase.itemType === "subscription");
    const creatorReports = reportsByUser.get(userId) || [];
    const creatorEnrollments = enrollmentByCreator.get(profileId) || [];
    const latestContentAt = latestDate(items);
    const dormant = Boolean(latestContentAt && daysOld(latestContentAt, now) >= 60);
    const profileScore = Number(profile.profileCompletionScore || 0);
    const hasPublishedContent = items.length > 0;
    const hasPaidContent = items.some((item) => Number(item.price || 0) > 0);
    let programKey = "high_potential_creator_growth";
    let lifecycleStage = "high_potential_growth";

    if (profileScore < 80 || !hasPublishedContent) {
      programKey = "new_creator_activation";
      lifecycleStage = "activation";
    } else if (dormant) {
      programKey = "dormant_creator_reactivation";
      lifecycleStage = "dormant";
    } else if (!sales.length) {
      programKey = "first_paid_drop";
      lifecycleStage = "first_sale_recovery";
    } else if (!subscriptions.length) {
      programKey = "subscription_launch";
      lifecycleStage = "subscription_launch";
    }

    const program = CREATOR_PROGRAM_CATALOG.find((entry) => entry.key === programKey);
    const payoutReadiness = buildPayoutReadiness(profile);
    const criteria = [
      { key: "active_catalog", label: "Active or publish-ready catalog", complete: hasPublishedContent },
      { key: "creator_category", label: "Clear creator category", complete: Boolean((profile.creatorTypes || []).length) },
      { key: "profile_complete", label: "Completed profile", complete: profileScore >= 80 },
      { key: "payout_ready", label: "Payout readiness", complete: Boolean(payoutReadiness.ready) },
      { key: "trust_risk", label: "Acceptable support and moderation risk", complete: profile.status === "active" && creatorReports.length === 0 },
      { key: "external_promotion", label: "External promotion willingness confirmed", complete: creatorEnrollments.some((entry) => ["enrolled", "active", "graduated"].includes(entry.status)), manual: true },
    ];
    const blockingCriteria = criteria.filter((criterion) => !criterion.complete);
    return {
      creatorProfileId: profileId,
      creatorUserId: userId,
      displayName: profile.displayName || profile.userId?.name || "Creator",
      username: profile.userId?.username || "",
      lifecycleStage,
      recommendedProgramKey: programKey,
      program,
      metrics: {
        profileCompletionScore: profileScore,
        catalogItems: items.length,
        paidCatalogItems: items.filter((item) => Number(item.price || 0) > 0).length,
        paidSales: sales.length,
        subscriptions: subscriptions.length,
        reports: creatorReports.length,
        lastCatalogActivityAt: latestContentAt,
      },
      checklist: criteria,
      launchReadinessState: blockingCriteria.length ? "needs_review" : "ready",
      blockingCriteria: blockingCriteria.map((criterion) => criterion.key),
      payoutReadiness: {
        ready: Boolean(payoutReadiness.ready),
        status: payoutReadiness.status || "",
        nextStep: payoutReadiness.nextStep || "",
      },
      enrollment: creatorEnrollments.map(serializeEnrollment),
      hasPaidContent,
    };
  });

  const stageCounts = creators.reduce((counts, creator) => {
    counts[creator.lifecycleStage] = Number(counts[creator.lifecycleStage] || 0) + 1;
    return counts;
  }, {});
  return {
    summary: {
      totalCreators: creators.length,
      launchReady: creators.filter((creator) => creator.launchReadinessState === "ready").length,
      enrolled: creators.filter((creator) => creator.enrollment.length).length,
      stalled: creators.filter((creator) => ["activation", "first_sale_recovery", "dormant"].includes(creator.lifecycleStage)).length,
      stageCounts,
    },
    programs: CREATOR_PROGRAM_CATALOG,
    creators,
    launchCohortCandidates: creators
      .filter((creator) => creator.launchReadinessState === "ready" || creator.blockingCriteria.length <= 2)
      .sort((left, right) => left.blockingCriteria.length - right.blockingCriteria.length)
      .slice(0, 50),
  };
};

const meaningfulEventTypes = new Set([
  "creator_followed",
  "content_saved",
  "stream_started",
  "stream_completed",
  "track_stream_started",
  "track_stream_completed",
  "live_reminder_set",
  "live_joined",
  "notification_opened",
]);

const buildFirstWeekActivation = ({ users = [], events = [], purchases = [], now = new Date() } = {}) => {
  const eventsByUser = groupBy(events, (event) => toId(event.userId));
  const purchasesByUser = groupBy(purchases, (purchase) => toId(purchase.userId));
  const stateOrder = ["invited", "signed_up", "browsed", "followed", "saved", "previewed", "paid", "subscribed", "returned"];
  const stateCounts = Object.fromEntries(stateOrder.map((state) => [state, 0]));
  const bySource = new Map();

  const journeys = users.map((user) => {
    const userId = toId(user._id);
    const joinedAt = toDate(user.createdAt) || now;
    const weekEnd = new Date(joinedAt.getTime() + 7 * DAY_MS);
    const userEvents = (eventsByUser.get(userId) || []).filter((event) => {
      const date = toDate(event.createdAt);
      return date && date >= joinedAt && date <= weekEnd;
    });
    const userPurchases = (purchasesByUser.get(userId) || []).filter((purchase) => {
      const date = toDate(purchase.paidAt || purchase.createdAt);
      return date && date >= joinedAt && date <= weekEnd && purchase.status === "paid";
    });
    const source = String(
      userEvents.find((event) => event.metadata?.source)?.metadata?.source
        || userEvents.find((event) => event.metadata?.referrerSource)?.metadata?.referrerSource
        || "organic"
    ).toLowerCase();
    const types = new Set(userEvents.map((event) => event.type));
    const firstMeaningful = userEvents.find((event) => meaningfulEventTypes.has(event.type));
    const returnEvent = userEvents.find((event) => {
      const date = toDate(event.createdAt);
      return date && date.getTime() >= joinedAt.getTime() + DAY_MS;
    });
    const states = {
      invited: Boolean(types.has("launch_invite_opened") || types.has("invite_accepted")),
      signed_up: true,
      browsed: types.has("route_viewed"),
      followed: types.has("creator_followed"),
      saved: types.has("content_saved"),
      previewed: ["stream_started", "track_stream_started", "stream_completed", "track_stream_completed"].some((type) => types.has(type)),
      paid: userPurchases.length > 0,
      subscribed: userPurchases.some((purchase) => purchase.itemType === "subscription"),
      returned: Boolean(returnEvent),
    };
    Object.entries(states).forEach(([state, complete]) => {
      if (complete) stateCounts[state] += 1;
    });
    const sourceSummary = bySource.get(source) || { source, users: 0, meaningfulActions: 0, returned: 0, paid: 0 };
    sourceSummary.users += 1;
    if (firstMeaningful || userPurchases.length) sourceSummary.meaningfulActions += 1;
    if (states.returned) sourceSummary.returned += 1;
    if (states.paid) sourceSummary.paid += 1;
    bySource.set(source, sourceSummary);
    return {
      userId,
      source,
      joinedAt,
      weekMature: now >= weekEnd,
      states,
      firstMeaningfulAction: firstMeaningful?.type || (userPurchases.length ? "purchase_success" : ""),
      stalledAt: stateOrder.find((state) => !states[state]) || "completed",
    };
  });

  const sourceRows = [...bySource.values()].map((row) => ({
    ...row,
    activationRate: roundRate(row.meaningfulActions / Math.max(1, row.users)),
    returnRate: roundRate(row.returned / Math.max(1, row.users)),
    paidRate: roundRate(row.paid / Math.max(1, row.users)),
  }));
  return {
    summary: {
      entrants: users.length,
      meaningfulActionRate: roundRate(journeys.filter((journey) => journey.firstMeaningfulAction).length / Math.max(1, users.length)),
      firstWeekReturnRate: roundRate(stateCounts.returned / Math.max(1, users.length)),
      paidActivationRate: roundRate(stateCounts.paid / Math.max(1, users.length)),
    },
    states: stateOrder.map((key) => ({ key, count: stateCounts[key], rate: roundRate(stateCounts[key] / Math.max(1, users.length)) })),
    bySource: sourceRows.sort((left, right) => right.users - left.users),
    stalledJourneys: journeys.filter((journey) => journey.stalledAt !== "completed").slice(0, 100),
  };
};

const buildFanLifecycle = ({ users = [], events = [], purchases = [], now = new Date() } = {}) => {
  const eventsByUser = groupBy(events, (event) => toId(event.userId));
  const purchasesByUser = groupBy(purchases, (purchase) => toId(purchase.userId));
  const fans = users.map((user) => {
    const userId = toId(user._id);
    const userEvents = eventsByUser.get(userId) || [];
    const userPurchases = purchasesByUser.get(userId) || [];
    const types = new Set(userEvents.map((event) => event.type));
    const paid = userPurchases.filter((purchase) => purchase.status === "paid");
    const subscriptions = userPurchases.filter((purchase) => purchase.itemType === "subscription");
    const paidSubscriptions = subscriptions.filter((purchase) => purchase.status === "paid");
    const atRiskSubscription = subscriptions.find((purchase) =>
      purchase.cancelAtPeriodEnd
        || purchase.status === "failed"
        || (purchase.accessExpiresAt && toDate(purchase.accessExpiresAt) <= new Date(now.getTime() + 7 * DAY_MS))
    );
    const lastActivityAt = latestDate(userEvents) || toDate(user.lastLogin) || toDate(user.createdAt);
    let stage = "active_relationship";
    if (lastActivityAt && daysOld(lastActivityAt, now) >= 30) stage = "dormant_fan_reactivation";
    else if (atRiskSubscription) stage = "renewal_risk";
    else if (paidSubscriptions.length) stage = "first_subscription";
    else if (paid.length) stage = "first_paid_unlock";
    else if (types.has("creator_followed")) stage = "first_creator_follow";
    else if (![...types].some((type) => meaningfulEventTypes.has(type))) stage = "new_user_first_action";
    const catalogEntry = FAN_LIFECYCLE_CATALOG.find((entry) => entry.key === stage);
    const actions = [catalogEntry?.action].filter(Boolean);
    if (types.has("content_saved")) actions.push("Surface a saved-content reminder only when consent and frequency rules allow it.");
    if (types.has("stream_started") || types.has("track_stream_started")) actions.push("Show the continue-content rail from server-confirmed progress.");
    if (types.has("creator_followed")) actions.push("Prioritize followed-creator updates over generic notifications.");
    return {
      userId,
      stage,
      actions,
      lastActivityAt,
      metrics: {
        follows: userEvents.filter((event) => event.type === "creator_followed").length,
        saves: userEvents.filter((event) => event.type === "content_saved").length,
        paidUnlocks: paid.filter((purchase) => purchase.itemType !== "subscription").length,
        subscriptions: paidSubscriptions.length,
      },
      subscriptionRisk: atRiskSubscription
        ? {
            purchaseId: toId(atRiskSubscription._id),
            reason: atRiskSubscription.cancelAtPeriodEnd ? "cancellation_scheduled" : atRiskSubscription.status === "failed" ? "renewal_failed" : "renewal_due",
            accessExpiresAt: atRiskSubscription.accessExpiresAt || null,
          }
        : null,
    };
  });
  const stageCounts = fans.reduce((counts, fan) => {
    counts[fan.stage] = Number(counts[fan.stage] || 0) + 1;
    return counts;
  }, {});
  const failedRenewals = purchases.filter((purchase) => purchase.itemType === "subscription" && purchase.status === "failed");
  const cancellations = purchases.filter((purchase) => purchase.itemType === "subscription" && (purchase.cancelAtPeriodEnd || purchase.canceledAt));
  const recoveredUserIds = new Set(failedRenewals.filter((failed) => purchases.some((purchase) =>
    toId(purchase.userId) === toId(failed.userId)
      && purchase.itemType === "subscription"
      && purchase.status === "paid"
      && toDate(purchase.paidAt || purchase.createdAt) > toDate(failed.createdAt)
  )).map((purchase) => toId(purchase.userId)));
  return {
    summary: {
      totalFans: fans.length,
      stageCounts,
      renewalRisk: Number(stageCounts.renewal_risk || 0),
      dormant: Number(stageCounts.dormant_fan_reactivation || 0),
    },
    catalog: FAN_LIFECYCLE_CATALOG,
    fans: fans.filter((fan) => fan.stage !== "active_relationship").slice(0, 100),
    subscriptionDiagnostics: {
      failedRenewals: failedRenewals.length,
      cancellationScheduled: cancellations.length,
      gracePeriodRecoveries: recoveredUserIds.size,
      cancellationReasons: cancellations.reduce((counts, purchase) => {
        const reason = purchase.refundReason || (purchase.cancelAtPeriodEnd ? "cancel_at_period_end" : "unspecified");
        counts[reason] = Number(counts[reason] || 0) + 1;
        return counts;
      }, {}),
      renewalAfterCreatorActivity: purchases.filter((purchase) =>
        purchase.itemType === "subscription"
          && purchase.status === "paid"
          && events.some((event) =>
            toId(event.userId) === toId(purchase.userId)
              && ["creator_followed", "stream_completed", "track_stream_completed", "live_joined"].includes(event.type)
              && toDate(event.createdAt) < toDate(purchase.paidAt || purchase.createdAt)
          )
      ).length,
    },
  };
};

const classifySupportQueue = (row = {}) => {
  const text = `${row.category || ""} ${row.subject || ""} ${row.sourceLabel || ""} ${row.metadata?.flow || ""}`.toLowerCase();
  if (/akuso|assistant|unsafe answer/.test(text)) return "assistant_output";
  if (/marketplace|dispute|refund|payment/.test(text)) return "marketplace_dispute";
  if (/recommend/.test(text)) return "recommendation_report";
  if (/creator|profile|verification/.test(text)) return "creator_profile";
  return "content_report";
};

const buildSupportTrustOperations = ({ reports = [], complaints = [], supportMacros = [], now = new Date() } = {}) => {
  const openRows = [
    ...reports.filter((row) => ["open", "reviewing"].includes(row.status)).map((row) => ({ ...row, source: "report" })),
    ...complaints.filter((row) => ["open", "reviewing"].includes(row.status)).map((row) => ({ ...row, source: "complaint" })),
  ];
  const queues = MODERATION_SLA_CATALOG.map((sla) => {
    const rows = openRows.filter((row) => classifySupportQueue(row) === sla.key);
    const breached = rows.filter((row) => hoursOld(row.createdAt, now) > sla.targetHours);
    return {
      ...sla,
      open: rows.length,
      breached: breached.length,
      oldestHours: rows.reduce((oldest, row) => Math.max(oldest, hoursOld(row.createdAt, now)), 0),
      status: breached.length ? "blocked" : rows.length ? "watch" : "ready",
      actionPath: sla.key === "assistant_output" ? "/admin/assistant/reviews" : sla.key === "marketplace_dispute" ? "/admin/transactions" : "/admin/reports",
    };
  });
  return {
    summary: {
      open: openRows.length,
      breached: queues.reduce((sum, queue) => sum + queue.breached, 0),
      readyQueues: queues.filter((queue) => queue.status === "ready").length,
      blockedQueues: queues.filter((queue) => queue.status === "blocked").length,
    },
    macros: supportMacros,
    queues,
    escalationPaths: [
      { key: "account_or_identity", owner: "Trust and safety", secondLine: "Product leadership", actionPath: "/admin/users" },
      { key: "payment_or_payout", owner: "Finance and operations", secondLine: "Backend and infrastructure", actionPath: "/admin/creator-earnings" },
      { key: "high_risk_safety", owner: "Trust and safety", secondLine: "Legal and privacy", actionPath: "/admin/reports" },
    ],
  };
};

const buildLaunchGovernance = ({ launchCommandCenter = {}, creatorLifecycle = {}, campaigns = [], supportTrust = {}, payoutAutomation = {} } = {}) => {
  const gates = launchCommandCenter.gates || [];
  const blockedGates = gates.filter((gate) => ["blocked", "rollback_required"].includes(gate.gateState));
  const campaignBlockers = campaigns.filter((campaign) => campaign.readinessState === "blocked");
  const risks = [
    ...blockedGates.map((gate) => ({ key: `gate:${gate.key}`, owner: gate.owner, severity: gate.gateState, nextAction: gate.nextAction, actionPath: gate.actionPath })),
    ...campaignBlockers.map((campaign) => ({ key: `campaign:${campaign.campaignKey}`, owner: campaign.ownerRole, severity: "blocked", nextAction: `Resolve ${campaign.blockers.join(", ")}.`, actionPath: "/admin/campaigns" })),
  ];
  if (!payoutAutomation.policy?.enabled) {
    risks.push({ key: "payout_automation_disabled", owner: "Finance and operations", severity: "watch", nextAction: "Keep manual preflight active or enable only after finance approval.", actionPath: "/admin/creator-earnings" });
  }
  return {
    readinessState: blockedGates.length || supportTrust.summary?.blockedQueues ? "blocked" : gates.some((gate) => gate.gateState === "watch") ? "watch" : "ready",
    checklist: gates,
    launchReport: {
      live: ["Provider-backed checkout", "Entitlement reconciliation", "Creator payout review", "Recommendation governance", "Akuso release gate"],
      manual: ["High-risk payout approval", "Creator promotion willingness", "Legal and privacy launch review", "High-risk support escalation"],
      automated: ["Low-risk payout preflight", "Creator and fan lifecycle classification", "First-week activation attribution", "Campaign readiness validation", "SLA breach detection"],
      knownRisks: risks,
      blockedItems: risks.filter((risk) => ["blocked", "rollback_required"].includes(risk.severity)),
      nextInvestmentAreas: ["Provider payout execution after reconciliation stability", "Notification delivery receipts", "Subscription grace-period provider reasons", "Named accountable owners"],
    },
    decision: risks.some((risk) => ["blocked", "rollback_required"].includes(risk.severity)) ? "hold_expansion" : "controlled_expansion_allowed",
    creatorCohort: {
      candidates: creatorLifecycle.summary?.launchReady || 0,
      selected: creatorLifecycle.summary?.enrolled || 0,
    },
  };
};

const buildNextTenOperatingViewFromRows = ({
  users = [],
  profiles = [],
  contentRows = [],
  purchases = [],
  events = [],
  payoutRequests = [],
  reports = [],
  complaints = [],
  enrollments = [],
  campaignRows = [],
  assurance = {},
  now = new Date(),
  window = {},
} = {}) => {
  const creatorLifecycle = buildCreatorLifecycle({ profiles, contentRows, purchases, reports, enrollments, now });
  const fanLifecycle = buildFanLifecycle({ users, events, purchases, now });
  const firstWeekActivation = buildFirstWeekActivation({ users, events, purchases, now });
  const campaigns = campaignRows.map((row) => serializeCampaign(row, now));
  const launchCommandCenter = assurance.launchCommandCenter || {};
  const supportTrust = buildSupportTrustOperations({
    reports,
    complaints,
    supportMacros: launchCommandCenter.supportMacros || [],
    now,
  });
  const payoutDecisions = payoutRequests.map((request) => {
    const profile = request.creatorProfile && typeof request.creatorProfile === "object"
      ? request.creatorProfile
      : profiles.find((entry) => toId(entry._id) === toId(request.creatorProfile)) || {};
    return buildPayoutAutomationDecision({
      request,
      profile,
      creatorPurchases: purchases.filter((purchase) => toId(purchase.creatorId) === toId(profile._id)),
      creatorReports: reports.filter((report) => toId(report.targetId) === toId(profile.userId?._id || profile.userId)),
      priorRequests: payoutRequests.filter((entry) => toId(entry.creatorProfile?._id || entry.creatorProfile) === toId(profile._id)),
      now,
    });
  });
  const payoutAutomation = {
    policy: PAYOUT_AUTOMATION_POLICY,
    controls: {
      automated: ["eligibility checks", "balance validation", "duplicate detection", "batch preflight", "failed payout retry eligibility"],
      humanApproval: ["first payout", "high-value payout", "suspicious account changes", "risk-flagged creators", "provider mismatch or manual override"],
      moneyMovementAutomated: false,
      rollback: "Set PAYOUT_AUTOMATION_ENABLED=false; existing payout review and batch workflows remain authoritative.",
    },
    summary: {
      evaluated: payoutDecisions.length,
      eligible: payoutDecisions.filter((decision) => decision.batchPreflightEligible).length,
      humanReview: payoutDecisions.filter((decision) => decision.humanApprovalRequired).length,
      blocked: payoutDecisions.filter((decision) => decision.decision === "blocked").length,
    },
    decisions: payoutDecisions,
  };
  const launchGovernance = buildLaunchGovernance({
    launchCommandCenter,
    creatorLifecycle,
    campaigns,
    supportTrust,
    payoutAutomation,
  });
  const programSummary = CREATOR_PROGRAM_CATALOG.map((program) => {
    const programEnrollments = enrollments.filter((entry) => entry.programKey === program.key);
    return {
      ...program,
      enrolled: programEnrollments.length,
      active: programEnrollments.filter((entry) => ["enrolled", "active"].includes(entry.status)).length,
      graduated: programEnrollments.filter((entry) => entry.status === "graduated").length,
    };
  });
  const roadmapPackages = [
    ["NEXT-061-02", "Controlled payout automation", payoutAutomation.policy.enabled ? "COMPLETE" : "AVAILABLE_DISABLED"],
    ["NEXT-061-03", "Creator lifecycle programs", "COMPLETE"],
    ["NEXT-061-04", "Fan lifecycle and subscription retention", "COMPLETE"],
    ["NEXT-061-05", "Launch and governance review", "COMPLETE"],
    ["SCALE-001", "Launch readiness command center", launchCommandCenter.gates?.length ? "COMPLETE" : "NEEDS_EVIDENCE"],
    ["SCALE-002", "First creator launch cohort", "COMPLETE"],
    ["SCALE-003", "First-week fan activation", "COMPLETE"],
    ["SCALE-004", "Reversible revenue campaigns", "COMPLETE"],
    ["SCALE-005", "Public support and trust operations", "COMPLETE"],
    ["SCALE-006", "Creator cohort programs", "COMPLETE"],
  ].map(([id, title, status]) => ({ id, title, status }));
  return {
    generatedAt: now.toISOString(),
    window,
    dataLimits: {
      maximumRowsPerSource: MAX_REPORT_ROWS,
      maximumCreators: MAX_CREATOR_ROWS,
      note: "Counts and queues are bounded for operator safety; exports must preserve this completeness statement.",
    },
    summary: {
      packagesImplemented: roadmapPackages.filter((item) => item.status === "COMPLETE").length,
      packagesAvailable: roadmapPackages.length,
      launchDecision: launchGovernance.decision,
      payoutPreflightEligible: payoutAutomation.summary.eligible,
      creatorCohortCandidates: creatorLifecycle.launchCohortCandidates.length,
      fanRenewalRisk: fanLifecycle.summary.renewalRisk,
      campaignReady: campaigns.filter((campaign) => campaign.readinessState === "ready").length,
      supportSlaBreaches: supportTrust.summary.breached,
    },
    roadmapPackages,
    payoutAutomation,
    creatorLifecycle: {
      ...creatorLifecycle,
      programSummary,
    },
    fanLifecycle,
    launchGovernance,
    launchCommandCenter,
    firstCreatorCohort: {
      criteria: ["active catalog", "creator category", "profile completion", "payout readiness", "trust risk", "external promotion willingness"],
      candidates: creatorLifecycle.launchCohortCandidates,
    },
    firstWeekActivation,
    revenueCampaigns: {
      campaignTypes: CAMPAIGN_TYPE_CATALOG,
      summary: {
        total: campaigns.length,
        ready: campaigns.filter((campaign) => campaign.readinessState === "ready").length,
        active: campaigns.filter((campaign) => campaign.status === "active").length,
        blocked: campaigns.filter((campaign) => campaign.readinessState === "blocked").length,
      },
      campaigns,
    },
    supportTrust,
  };
};

const buildLaunchGrowthOperatingSystem = async (filters = {}) => {
  const { start, end } = buildDateRange(filters);
  const now = new Date();
  const lifecycleStart = new Date(Math.min(start.getTime(), now.getTime() - 365 * DAY_MS));
  const [
    users,
    profiles,
    purchases,
    events,
    payoutRequests,
    reports,
    complaints,
    enrollments,
    campaignRows,
    tracks,
    albums,
    books,
    videos,
    assurance,
  ] = await Promise.all([
    User.find({ createdAt: { $gte: start, $lte: end }, isDeleted: { $ne: true } })
      .select("_id createdAt lastLogin notificationPrefs")
      .sort({ createdAt: -1 })
      .limit(MAX_REPORT_ROWS)
      .lean(),
    CreatorProfile.find({ isCreator: true })
      .select("userId displayName creatorTypes profileCompletionScore status onboardingComplete onboardingCompleted acceptedTerms acceptedCopyrightDeclaration bankName bankCode accountName accountNumber payoutRecipientVerifiedAt country countryOfResidence subscriptionPrice subscriptionBenefits updatedAt")
      .populate("userId", "name username")
      .sort({ updatedAt: -1 })
      .limit(MAX_CREATOR_ROWS)
      .lean(),
    Purchase.find({ createdAt: { $gte: lifecycleStart, $lte: end } })
      .select("userId creatorId itemType itemId amount currency status paidAt accessExpiresAt cancelAtPeriodEnd canceledAt refundReason createdAt updatedAt")
      .sort({ createdAt: -1 })
      .limit(MAX_REPORT_ROWS)
      .lean(),
    AnalyticsEvent.find({ createdAt: { $gte: lifecycleStart, $lte: end } })
      .select("type userId targetId targetType contentType metadata createdAt")
      .sort({ createdAt: -1 })
      .limit(MAX_REPORT_ROWS)
      .lean(),
    CreatorPayoutRequest.find({ status: { $in: ["approved", "failed", "processing", "paid"] } })
      .populate("creatorProfile")
      .sort({ requestedAt: -1 })
      .limit(500)
      .lean(),
    Report.find({ createdAt: { $gte: start, $lte: end } })
      .sort({ createdAt: -1 })
      .limit(MAX_REPORT_ROWS)
      .lean(),
    AdminComplaint.find({ createdAt: { $gte: start, $lte: end } })
      .sort({ createdAt: -1 })
      .limit(MAX_REPORT_ROWS)
      .lean(),
    CreatorLifecycleEnrollment.find({})
      .populate("creatorProfile", "displayName")
      .sort({ updatedAt: -1 })
      .limit(MAX_CREATOR_ROWS * 2)
      .lean(),
    RevenueCampaign.find({ $or: [{ endAt: { $gte: lifecycleStart } }, { endAt: null }] })
      .sort({ startAt: -1 })
      .limit(500)
      .lean(),
    Track.find({}).select("creatorId title price previewUrl coverImageUrl createdAt updatedAt").limit(MAX_REPORT_ROWS).lean(),
    Album.find({}).select("creatorId title price previewUrl coverImageUrl status createdAt updatedAt").limit(MAX_REPORT_ROWS).lean(),
    Book.find({}).select("creatorId title price previewUrl coverImageUrl createdAt updatedAt").limit(MAX_REPORT_ROWS).lean(),
    Video.find({ creatorProfileId: { $ne: null } }).select("creatorProfileId title price previewClipUrl coverImageUrl createdAt updatedAt").limit(MAX_REPORT_ROWS).lean(),
    buildAssuranceDashboard(filters),
  ]);
  return buildNextTenOperatingViewFromRows({
    users,
    profiles,
    contentRows: [...tracks, ...albums, ...books, ...videos],
    purchases,
    events,
    payoutRequests,
    reports,
    complaints,
    enrollments,
    campaignRows,
    assurance,
    now,
    window: { start: start.toISOString(), end: end.toISOString(), lifecycleStart: lifecycleStart.toISOString() },
  });
};

const buildHttpError = (message, status = 400, details = {}) => {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
};

const assertObjectId = (value, label) => {
  if (!mongoose.Types.ObjectId.isValid(value)) throw buildHttpError(`${label} is invalid`, 400);
};

const preflightPayoutAutomation = async ({ requestIds = [], limit = 50 } = {}) => {
  const ids = [...new Set((Array.isArray(requestIds) ? requestIds : []).map(toId).filter(Boolean))];
  ids.forEach((id) => assertObjectId(id, "Payout request id"));
  const query = ids.length ? { _id: { $in: ids } } : { status: { $in: ["approved", "failed"] } };
  const requests = await CreatorPayoutRequest.find(query)
    .populate("creatorProfile")
    .sort({ requestedAt: 1 })
    .limit(Math.min(100, Math.max(1, Number(limit || 50))))
    .lean();
  const creatorIds = [...new Set(requests.map((request) => toId(request.creatorProfile?._id || request.creatorProfile)).filter(Boolean))];
  const userIds = [...new Set(requests.map((request) => toId(request.creatorProfile?.userId || request.creatorUser)).filter(Boolean))];
  const [purchases, reports, priorRequests] = await Promise.all([
    Purchase.find({ creatorId: { $in: creatorIds } }).select("creatorId status amount createdAt").limit(MAX_REPORT_ROWS).lean(),
    Report.find({ targetType: "user", targetId: { $in: userIds } }).select("targetId status createdAt").limit(MAX_REPORT_ROWS).lean(),
    CreatorPayoutRequest.find({ creatorProfile: { $in: creatorIds } }).select("creatorProfile amount currency status payoutBatch createdAt").limit(MAX_REPORT_ROWS).lean(),
  ]);
  const decisions = requests.map((request) => buildPayoutAutomationDecision({
    request,
    profile: request.creatorProfile || {},
    creatorPurchases: purchases.filter((purchase) => toId(purchase.creatorId) === toId(request.creatorProfile?._id)),
    creatorReports: reports.filter((report) => toId(report.targetId) === toId(request.creatorProfile?.userId)),
    priorRequests: priorRequests.filter((entry) => toId(entry.creatorProfile) === toId(request.creatorProfile?._id)),
  }));
  return {
    generatedAt: new Date().toISOString(),
    policy: PAYOUT_AUTOMATION_POLICY,
    moneyMovementAuthorized: false,
    candidateRequestIds: decisions.filter((decision) => decision.batchPreflightEligible).map((decision) => decision.requestId),
    decisions,
  };
};

const enrollCreatorLifecycleProgram = async ({
  creatorProfileId,
  programKey,
  ownerName = "",
  ownerRole = "Creator growth",
  adminNote = "",
  adminUserId,
} = {}) => {
  assertObjectId(creatorProfileId, "Creator profile id");
  if (!CreatorLifecycleEnrollment.CREATOR_LIFECYCLE_PROGRAMS.includes(programKey)) {
    throw buildHttpError("Creator lifecycle program is invalid", 400);
  }
  const profile = await CreatorProfile.findById(creatorProfileId).lean();
  if (!profile) throw buildHttpError("Creator profile not found", 404);
  const program = CREATOR_PROGRAM_CATALOG.find((entry) => entry.key === programKey);
  const existing = await CreatorLifecycleEnrollment.findOne({ creatorProfile: profile._id, programKey });
  if (existing && existing.status !== "paused") {
    throw buildHttpError("Creator is already enrolled in this lifecycle program", 409);
  }
  const checklist = (program.checklist || []).map((label, index) => ({
    key: `${programKey}_${index + 1}`,
    label,
    complete: false,
  }));
  const enrollment = existing || new CreatorLifecycleEnrollment({
    creatorProfile: profile._id,
    creatorUser: profile.userId,
    programKey,
  });
  enrollment.lifecycleStage = programKey;
  enrollment.status = "enrolled";
  enrollment.ownerName = String(ownerName || "").trim();
  enrollment.ownerRole = String(ownerRole || "Creator growth").trim();
  enrollment.adminNote = String(adminNote || "").trim();
  enrollment.entryReason = program.entryTrigger;
  enrollment.checklist = checklist;
  enrollment.enrolledBy = adminUserId || null;
  enrollment.enrolledAt = new Date();
  enrollment.lastEvaluatedAt = new Date();
  enrollment.statusHistory.push({ status: "enrolled", actorId: adminUserId || null, note: enrollment.adminNote || "Creator enrolled" });
  await enrollment.save();
  return serializeEnrollment({ ...enrollment.toObject(), creatorProfile: { _id: profile._id, displayName: profile.displayName } });
};

const updateCreatorLifecycleEnrollment = async ({ enrollmentId, updates = {}, adminUserId } = {}) => {
  assertObjectId(enrollmentId, "Enrollment id");
  const enrollment = await CreatorLifecycleEnrollment.findById(enrollmentId);
  if (!enrollment) throw buildHttpError("Creator lifecycle enrollment not found", 404);
  const nextStatus = String(updates.status || enrollment.status).trim().toLowerCase();
  if (!CreatorLifecycleEnrollment.CREATOR_LIFECYCLE_STATUSES.includes(nextStatus)) {
    throw buildHttpError("Creator lifecycle status is invalid", 400);
  }
  if (Array.isArray(updates.checklist)) {
    const completionByKey = new Map(updates.checklist.map((item) => [String(item.key || ""), Boolean(item.complete)]));
    enrollment.checklist.forEach((item) => {
      if (!completionByKey.has(item.key)) return;
      item.complete = completionByKey.get(item.key);
      item.completedAt = item.complete ? item.completedAt || new Date() : null;
    });
  }
  if (nextStatus !== enrollment.status) {
    enrollment.status = nextStatus;
    enrollment.statusHistory.push({ status: nextStatus, actorId: adminUserId || null, note: String(updates.adminNote || "Status updated").trim() });
    if (nextStatus === "active") enrollment.launchedAt = enrollment.launchedAt || new Date();
    if (nextStatus === "graduated") enrollment.graduatedAt = new Date();
  }
  if (updates.ownerName !== undefined) enrollment.ownerName = String(updates.ownerName || "").trim();
  if (updates.ownerRole !== undefined) enrollment.ownerRole = String(updates.ownerRole || "").trim();
  if (updates.adminNote !== undefined) enrollment.adminNote = String(updates.adminNote || "").trim();
  enrollment.lastEvaluatedAt = new Date();
  await enrollment.save();
  return serializeEnrollment(enrollment.toObject());
};

const normalizeCampaignKey = (value = "") => String(value || "")
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "")
  .slice(0, 100);

const createRevenueCampaign = async ({ payload = {}, adminUserId } = {}) => {
  const name = String(payload.name || "").trim();
  const type = String(payload.type || "").trim().toLowerCase();
  if (!name) throw buildHttpError("Campaign name is required", 400);
  if (!RevenueCampaign.REVENUE_CAMPAIGN_TYPES.includes(type)) throw buildHttpError("Campaign type is invalid", 400);
  const campaignKey = normalizeCampaignKey(payload.campaignKey || name);
  if (!campaignKey) throw buildHttpError("Campaign key is required", 400);
  const campaign = new RevenueCampaign({
    name,
    campaignKey,
    type,
    status: "draft",
    ownerName: String(payload.ownerName || "").trim(),
    ownerRole: String(payload.ownerRole || "Product and growth").trim(),
    startAt: payload.startAt,
    endAt: payload.endAt,
    eligibleCreatorIds: Array.isArray(payload.eligibleCreatorIds) ? payload.eligibleCreatorIds : [],
    eligibleContentIds: Array.isArray(payload.eligibleContentIds) ? payload.eligibleContentIds : [],
    currency: String(payload.currency || "NGN").trim().toUpperCase(),
    priceRule: String(payload.priceRule || "").trim(),
    discountPercent: Number(payload.discountPercent || 0),
    expectedMarginImpact: String(payload.expectedMarginImpact || "").trim(),
    refundAndDisputeHandling: String(payload.refundAndDisputeHandling || "").trim(),
    successMetric: String(payload.successMetric || "").trim(),
    ledgerTrackingKey: normalizeCampaignKey(payload.ledgerTrackingKey || `campaign_${campaignKey}`),
    rollbackPlan: String(payload.rollbackPlan || "").trim(),
    guardrails: payload.guardrails && typeof payload.guardrails === "object" ? payload.guardrails : {},
    createdBy: adminUserId,
    lastChangedBy: adminUserId,
    statusHistory: [{ status: "draft", actorId: adminUserId, reason: "Campaign draft created" }],
  });
  await campaign.save();
  return serializeCampaign(campaign.toObject());
};

const updateRevenueCampaign = async ({ campaignId, updates = {}, adminUserId } = {}) => {
  assertObjectId(campaignId, "Campaign id");
  const campaign = await RevenueCampaign.findById(campaignId);
  if (!campaign) throw buildHttpError("Revenue campaign not found", 404);
  const nextStatus = updates.status ? String(updates.status).trim().toLowerCase() : campaign.status;
  if (!RevenueCampaign.REVENUE_CAMPAIGN_STATUSES.includes(nextStatus)) throw buildHttpError("Campaign status is invalid", 400);
  const allowedTransitions = {
    draft: ["draft", "ready", "cancelled"],
    ready: ["ready", "draft", "active", "paused", "cancelled"],
    active: ["active", "paused", "completed", "cancelled"],
    paused: ["paused", "ready", "active", "cancelled"],
    completed: ["completed"],
    cancelled: ["cancelled"],
  };
  if (!allowedTransitions[campaign.status].includes(nextStatus)) throw buildHttpError(`Campaign cannot move from ${campaign.status} to ${nextStatus}`, 409);
  const editableFields = ["name", "ownerName", "ownerRole", "startAt", "endAt", "eligibleCreatorIds", "eligibleContentIds", "currency", "priceRule", "discountPercent", "expectedMarginImpact", "refundAndDisputeHandling", "successMetric", "rollbackPlan", "guardrails"];
  editableFields.forEach((field) => {
    if (updates[field] !== undefined) campaign[field] = updates[field];
  });
  if (["ready", "active"].includes(nextStatus)) {
    const blockers = campaignReadinessChecks(campaign).filter((check) => !check.complete);
    if (blockers.length) throw buildHttpError("Campaign is not ready", 409, { blockers: blockers.map((check) => check.key) });
  }
  if (nextStatus !== campaign.status) {
    const reason = String(updates.reason || "").trim();
    if (!reason) throw buildHttpError("A reason is required for campaign status changes", 400);
    campaign.status = nextStatus;
    campaign.statusHistory.push({ status: nextStatus, actorId: adminUserId || null, reason });
  }
  campaign.lastChangedBy = adminUserId || null;
  await campaign.save();
  return serializeCampaign(campaign.toObject());
};

module.exports = {
  CAMPAIGN_TYPE_CATALOG,
  CREATOR_PROGRAM_CATALOG,
  FAN_LIFECYCLE_CATALOG,
  MODERATION_SLA_CATALOG,
  PAYOUT_AUTOMATION_POLICY,
  buildCreatorLifecycle,
  buildFanLifecycle,
  buildFirstWeekActivation,
  buildLaunchGovernance,
  buildLaunchGrowthOperatingSystem,
  buildNextTenOperatingViewFromRows,
  buildPayoutAutomationDecision,
  buildSupportTrustOperations,
  campaignReadinessChecks,
  createRevenueCampaign,
  enrollCreatorLifecycleProgram,
  preflightPayoutAutomation,
  serializeCampaign,
  serializeEnrollment,
  updateCreatorLifecycleEnrollment,
  updateRevenueCampaign,
};
