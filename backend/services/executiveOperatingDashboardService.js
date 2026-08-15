const AdminComplaint = require("../models/AdminComplaint");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const CreatorPayoutRequest = require("../models/CreatorPayoutRequest");
const CreatorProfile = require("../models/CreatorProfile");
const Purchase = require("../models/Purchase");
const RevenueLedgerEntry = require("../models/RevenueLedgerEntry");
const { buildAkusoAdminMetrics } = require("./assistant/adminMetricsService");
const { buildReliabilityHealth } = require("./analyticsService");
const { buildDateRange, buildFanRetentionCohorts } = require("./fanRetentionCohortService");
const { buildRecommendationDiagnostics } = require("./recommendationGovernanceService");

const DAY_MS = 24 * 60 * 60 * 1000;

const toId = (value) => {
  if (!value) return "";
  if (value._id && value._id !== value) return toId(value._id);
  return String(value);
};

const within = (value, start, end) => {
  const timestamp = value ? new Date(value).getTime() : 0;
  return timestamp >= start.getTime() && timestamp < end.getTime();
};

const sum = (rows = [], reader = (row) => row) =>
  rows.reduce((total, row) => total + Number(reader(row) || 0), 0);

const rate = (numerator, denominator) =>
  denominator > 0 ? Number((Number(numerator || 0) / denominator).toFixed(4)) : 0;

const average = (values = []) => {
  const numeric = values.map(Number).filter(Number.isFinite);
  return numeric.length ? Number((sum(numeric) / numeric.length).toFixed(4)) : 0;
};

const getMetricStatus = ({ current, target, direction = "higher", hasData = true } = {}) => {
  if (!hasData) return "no_data";
  if (direction === "lower") {
    if (current <= target) return "on_target";
    return current <= target * 1.25 || (target === 0 && current <= 1) ? "watch" : "off_target";
  }
  if (current >= target) return "on_target";
  return current >= target * 0.8 ? "watch" : "off_target";
};

const buildCoreSnapshot = ({
  start,
  end,
  purchases = [],
  ledgerEntries = [],
  events = [],
  profiles = [],
  payoutRequests = [],
  complaints = [],
} = {}) => {
  const periodPurchases = purchases.filter((purchase) =>
    within(purchase.paidAt || purchase.createdAt, start, end)
  );
  const paidPurchases = periodPurchases.filter((purchase) => purchase.status === "paid");
  const periodLedger = ledgerEntries.filter((entry) => within(entry.occurredAt || entry.createdAt, start, end));
  const periodEvents = events.filter((event) => within(event.createdAt, start, end));
  const eventCount = (type) => periodEvents.filter((event) => event.type === type).length;
  const periodProfiles = profiles.filter((profile) => within(profile.createdAt, start, end));
  const activeCreatorUserIds = new Set(
    periodEvents
      .filter((event) =>
        [
          "creator_growth_prompt",
          "creator_onboarding_step_completed",
          "creator_upload_started",
          "creator_upload_completed",
        ].includes(event.type)
      )
      .map((event) => toId(event.userId))
      .filter(Boolean)
  );
  const eligibleCreators = profiles.filter((profile) => new Date(profile.createdAt) < end);
  const periodPayoutRequests = payoutRequests.filter((request) => within(request.requestedAt, start, end));
  const payoutRequested = periodPayoutRequests.length;
  const payoutResolved = periodPayoutRequests.filter((request) =>
    (request.statusHistory || []).some((entry) =>
      ["paid", "failed"].includes(entry.status) && new Date(entry.at).getTime() < end.getTime()
    )
  ).length;
  const recommendationImpressions = eventCount("feed_impression");
  const recommendationConversions = eventCount("purchase_success") + eventCount("creator_followed");
  const akusoHelpful = periodEvents.filter(
    (event) => event.type === "akuso_feedback" && event.metadata?.rating === "helpful"
  ).length;
  const akusoFeedback = eventCount("akuso_feedback");

  return {
    gmv: sum(paidPurchases, (purchase) => purchase.amount),
    creatorEarnings: sum(
      periodLedger.filter((entry) => entry.ledgerEventType === "creator_earning_credited"),
      (entry) => entry.amount
    ),
    platformCommission: sum(
      periodLedger.filter((entry) => entry.ledgerEventType === "platform_commission_reserved"),
      (entry) => entry.amount
    ),
    checkoutSuccessRate: rate(eventCount("purchase_success"), eventCount("purchase_checkout_initialized")),
    payoutResolutionRate: rate(payoutResolved, payoutRequested),
    creatorActivationRate: rate(
      periodProfiles.filter((profile) => profile.onboardingComplete || profile.onboardingCompleted).length,
      periodProfiles.length
    ),
    creatorRetentionRate: rate(
      eligibleCreators.filter((profile) => activeCreatorUserIds.has(toId(profile.userId))).length,
      eligibleCreators.length
    ),
    recommendationConversionRate: rate(recommendationConversions, recommendationImpressions),
    recommendationComplaintRate: rate(eventCount("recommendation_reported"), recommendationImpressions),
    akusoHelpfulRate: rate(akusoHelpful, akusoFeedback),
    supportBacklog: complaints.filter((complaint) => {
      const createdAt = new Date(complaint.createdAt).getTime();
      const resolvedAt = complaint.resolvedAt ? new Date(complaint.resolvedAt).getTime() : 0;
      return createdAt < end.getTime() && (!resolvedAt || resolvedAt >= end.getTime());
    }).length,
    samples: {
      purchases: paidPurchases.length,
      checkoutAttempts: eventCount("purchase_checkout_initialized"),
      payoutRequests: payoutRequested,
      newCreators: periodProfiles.length,
      eligibleCreators: eligibleCreators.length,
      recommendationImpressions,
      akusoFeedback,
    },
  };
};

const buildMetric = ({
  key,
  label,
  current,
  previous,
  fourWeekAverage,
  target,
  format,
  direction = "higher",
  drilldown,
  hasData = true,
} = {}) => ({
  key,
  label,
  current: Number(current || 0),
  previous: Number(previous || 0),
  fourWeekAverage: Number(fourWeekAverage || 0),
  change: Number((Number(current || 0) - Number(previous || 0)).toFixed(4)),
  target: Number(target || 0),
  format,
  direction,
  status: getMetricStatus({ current: Number(current || 0), target: Number(target || 0), direction, hasData }),
  drilldown,
});

const buildExecutiveOperatingDashboard = async ({ range, startDate, endDate } = {}) => {
  const selected = buildDateRange({ range, startDate, endDate });
  const currentEnd = selected.end;
  const currentStart = new Date(currentEnd.getTime() - 7 * DAY_MS);
  const priorStart = new Date(currentStart.getTime() - 7 * DAY_MS);
  const fourWeekStart = new Date(currentEnd.getTime() - 28 * DAY_MS);
  const currentFanStart = new Date(currentStart.getTime() - 7 * DAY_MS);
  const currentFanEnd = new Date(currentEnd.getTime() - 7 * DAY_MS);
  const priorFanStart = new Date(priorStart.getTime() - 7 * DAY_MS);
  const priorFanEnd = new Date(currentStart.getTime() - 7 * DAY_MS);
  const fourWeekFanStart = new Date(fourWeekStart.getTime() - 7 * DAY_MS);
  const custom = (start, end) => ({
    range: "custom",
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  });

  const [
    purchases,
    ledgerEntries,
    events,
    profiles,
    payoutRequests,
    complaints,
    fanRetention,
    priorFanRetention,
    fourWeekFanRetention,
    recommendationDiagnostics,
    priorRecommendationDiagnostics,
    fourWeekRecommendationDiagnostics,
    akusoMetrics,
    priorAkusoMetrics,
    reliability,
  ] = await Promise.all([
    Purchase.find({
      $or: [
        { createdAt: { $gte: fourWeekStart, $lte: currentEnd } },
        { paidAt: { $gte: fourWeekStart, $lte: currentEnd } },
      ],
    })
      .select("amount status paidAt createdAt")
      .lean(),
    RevenueLedgerEntry.find({ occurredAt: { $gte: fourWeekStart, $lte: currentEnd } })
      .select("ledgerEventType amount occurredAt createdAt")
      .lean(),
    AnalyticsEvent.find({ createdAt: { $gte: fourWeekStart, $lte: currentEnd } })
      .select("type userId createdAt metadata")
      .limit(100000)
      .lean(),
    CreatorProfile.find({ createdAt: { $lte: currentEnd } })
      .select("userId onboardingComplete onboardingCompleted createdAt")
      .lean(),
    CreatorPayoutRequest.find({ requestedAt: { $lte: currentEnd } })
      .select("requestedAt statusHistory")
      .lean(),
    AdminComplaint.find({ createdAt: { $lte: currentEnd } })
      .select("status createdAt resolvedAt")
      .lean(),
    buildFanRetentionCohorts({
      ...custom(currentFanStart, currentFanEnd),
      observedThrough: currentEnd,
    }),
    buildFanRetentionCohorts({
      ...custom(priorFanStart, priorFanEnd),
      observedThrough: currentStart,
    }),
    buildFanRetentionCohorts({
      ...custom(fourWeekFanStart, currentFanEnd),
      observedThrough: currentEnd,
    }),
    buildRecommendationDiagnostics(custom(currentStart, currentEnd)),
    buildRecommendationDiagnostics(custom(priorStart, currentStart)),
    buildRecommendationDiagnostics(custom(fourWeekStart, currentEnd)),
    buildAkusoAdminMetrics(custom(currentStart, currentEnd)),
    buildAkusoAdminMetrics(custom(priorStart, currentStart)),
    buildReliabilityHealth({ range: "7d" }),
  ]);

  const snapshotInput = { purchases, ledgerEntries, events, profiles, payoutRequests, complaints };
  const current = buildCoreSnapshot({ ...snapshotInput, start: currentStart, end: currentEnd });
  const previous = buildCoreSnapshot({ ...snapshotInput, start: priorStart, end: currentStart });
  const weeklySnapshots = [0, 1, 2, 3].map((index) => {
    const end = new Date(currentEnd.getTime() - index * 7 * DAY_MS);
    const start = new Date(end.getTime() - 7 * DAY_MS);
    return buildCoreSnapshot({ ...snapshotInput, start, end });
  });
  const avg = (key) => average(weeklySnapshots.map((snapshot) => snapshot[key]));

  current.fanD7RetentionRate = Number(fanRetention.summary?.d7RetentionRate || 0);
  previous.fanD7RetentionRate = Number(priorFanRetention.summary?.d7RetentionRate || 0);
  current.recommendationConversionRate = Number(recommendationDiagnostics.summary?.conversionRate || current.recommendationConversionRate);
  previous.recommendationConversionRate = Number(priorRecommendationDiagnostics.summary?.conversionRate || previous.recommendationConversionRate);
  current.recommendationComplaintRate = Number(recommendationDiagnostics.summary?.reportRate || current.recommendationComplaintRate);
  previous.recommendationComplaintRate = Number(priorRecommendationDiagnostics.summary?.reportRate || previous.recommendationComplaintRate);
  current.akusoHelpfulRate = Number(akusoMetrics.historical?.feedback?.quality?.helpfulRate || current.akusoHelpfulRate);
  previous.akusoHelpfulRate = Number(priorAkusoMetrics.historical?.feedback?.quality?.helpfulRate || previous.akusoHelpfulRate);
  current.incidents = Number(reliability.summary?.activeIncidentCount || 0);
  previous.incidents = 0;

  const metrics = [
    buildMetric({ key: "gmv", label: "GMV", current: current.gmv, previous: previous.gmv, fourWeekAverage: avg("gmv"), target: Math.max(1, previous.gmv * 1.05), format: "currency", drilldown: "/admin/transactions", hasData: current.samples.purchases > 0 }),
    buildMetric({ key: "creator_earnings", label: "Net creator earnings", current: current.creatorEarnings, previous: previous.creatorEarnings, fourWeekAverage: avg("creatorEarnings"), target: Math.max(1, previous.creatorEarnings), format: "currency", drilldown: "/admin/creator-earnings", hasData: current.creatorEarnings > 0 }),
    buildMetric({ key: "platform_commission", label: "Platform commission", current: current.platformCommission, previous: previous.platformCommission, fourWeekAverage: avg("platformCommission"), target: Math.max(1, previous.platformCommission), format: "currency", drilldown: "/admin/creator-earnings", hasData: current.platformCommission > 0 }),
    buildMetric({ key: "checkout_success", label: "Checkout success", current: current.checkoutSuccessRate, previous: previous.checkoutSuccessRate, fourWeekAverage: avg("checkoutSuccessRate"), target: 0.95, format: "percent", drilldown: "/admin/transactions", hasData: current.samples.checkoutAttempts > 0 }),
    buildMetric({ key: "payout_resolution", label: "Payout resolution", current: current.payoutResolutionRate, previous: previous.payoutResolutionRate, fourWeekAverage: avg("payoutResolutionRate"), target: 0.95, format: "percent", drilldown: "/admin/creator-earnings", hasData: current.samples.payoutRequests > 0 }),
    buildMetric({ key: "creator_activation", label: "Creator activation", current: current.creatorActivationRate, previous: previous.creatorActivationRate, fourWeekAverage: avg("creatorActivationRate"), target: 0.7, format: "percent", drilldown: "/admin/analytics", hasData: current.samples.newCreators > 0 }),
    buildMetric({ key: "creator_retention", label: "Creator weekly retention", current: current.creatorRetentionRate, previous: previous.creatorRetentionRate, fourWeekAverage: avg("creatorRetentionRate"), target: 0.3, format: "percent", drilldown: "/admin/analytics", hasData: current.samples.eligibleCreators > 0 }),
    buildMetric({ key: "fan_retention", label: "Fan D7 retention", current: current.fanD7RetentionRate, previous: previous.fanD7RetentionRate, fourWeekAverage: Number(fourWeekFanRetention.summary?.d7RetentionRate || 0), target: 0.25, format: "percent", drilldown: "/admin/analytics", hasData: fanRetention.dataQuality?.complete !== false && Number(fanRetention.summary?.d7Eligible || 0) > 0 }),
    buildMetric({ key: "recommendation_conversion", label: "Recommendation conversion", current: current.recommendationConversionRate, previous: previous.recommendationConversionRate, fourWeekAverage: Number(fourWeekRecommendationDiagnostics.summary?.conversionRate || 0), target: 0.03, format: "percent", drilldown: "/admin/analytics", hasData: recommendationDiagnostics.dataQuality?.complete !== false && Number(recommendationDiagnostics.summary?.servedItems || 0) > 0 }),
    buildMetric({ key: "recommendation_complaints", label: "Recommendation complaint rate", current: current.recommendationComplaintRate, previous: previous.recommendationComplaintRate, fourWeekAverage: Number(fourWeekRecommendationDiagnostics.summary?.reportRate || 0), target: 0.01, direction: "lower", format: "percent", drilldown: "/admin/reports", hasData: recommendationDiagnostics.dataQuality?.complete !== false && Number(recommendationDiagnostics.summary?.servedItems || 0) > 0 }),
    buildMetric({ key: "akuso_quality", label: "Akuso helpful rate", current: current.akusoHelpfulRate, previous: previous.akusoHelpfulRate, fourWeekAverage: current.akusoHelpfulRate, target: 0.8, format: "percent", drilldown: "/admin/assistant/metrics", hasData: Number(akusoMetrics.historical?.feedback?.total || 0) > 0 }),
    buildMetric({ key: "support_backlog", label: "Support backlog", current: current.supportBacklog, previous: previous.supportBacklog, fourWeekAverage: avg("supportBacklog"), target: 20, direction: "lower", format: "count", drilldown: "/admin/messages", hasData: true }),
    buildMetric({ key: "incidents", label: "Active incidents", current: current.incidents, previous: previous.incidents, fourWeekAverage: current.incidents, target: 0, direction: "lower", format: "count", drilldown: "/admin/analytics", hasData: true }),
  ];
  const actionable = metrics.filter((metric) => ["watch", "off_target"].includes(metric.status));

  return {
    generatedAt: new Date().toISOString(),
    window: {
      currentWeekStart: currentStart.toISOString(),
      currentWeekEnd: currentEnd.toISOString(),
      priorWeekStart: priorStart.toISOString(),
      priorWeekEnd: currentStart.toISOString(),
      fourWeekStart: fourWeekStart.toISOString(),
    },
    summary: {
      onTarget: metrics.filter((metric) => metric.status === "on_target").length,
      watch: metrics.filter((metric) => metric.status === "watch").length,
      offTarget: metrics.filter((metric) => metric.status === "off_target").length,
      noData: metrics.filter((metric) => metric.status === "no_data").length,
      activeIncidents: current.incidents,
      actionsRequired: actionable.length,
    },
    metrics,
    actions: actionable.map((metric) => ({
      key: metric.key,
      title: `${metric.label} is ${metric.status === "off_target" ? "off target" : "on watch"}`,
      status: metric.status,
      actionPath: metric.drilldown,
    })),
    sources: {
      fanRetention: fanRetention.summary,
      recommendation: recommendationDiagnostics.summary,
      akuso: akusoMetrics.historical?.feedback?.quality || {},
      reliability: reliability.summary,
    },
  };
};

module.exports = {
  buildCoreSnapshot,
  buildExecutiveOperatingDashboard,
  getMetricStatus,
};
