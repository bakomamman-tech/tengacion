const AnalyticsEvent = require("../models/AnalyticsEvent");
const RecommendationLog = require("../models/RecommendationLog");
const RecommendationPolicy = require("../models/RecommendationPolicy");

const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_RECOMMENDATION_POLICY = Object.freeze({
  key: "global",
  enabled: true,
  maxRepeatedCreatorCount: 2,
  maxContentTypeStreak: 2,
  minimumExplorationShare: 0.15,
  hideRatePenalty: 18,
  reportRatePenalty: 40,
  conversionRateBoost: 16,
});

const toId = (value) => {
  if (!value) return "";
  if (value._id && value._id !== value) return toId(value._id);
  return String(value);
};

const roundRate = (value) => Number(Math.max(0, Math.min(1, Number(value || 0))).toFixed(4));

const normalizePolicy = (value = {}) => ({
  key: "global",
  enabled: value.enabled !== false,
  maxRepeatedCreatorCount: Math.max(1, Math.min(5, Number(value.maxRepeatedCreatorCount ?? DEFAULT_RECOMMENDATION_POLICY.maxRepeatedCreatorCount))),
  maxContentTypeStreak: Math.max(1, Math.min(5, Number(value.maxContentTypeStreak ?? DEFAULT_RECOMMENDATION_POLICY.maxContentTypeStreak))),
  minimumExplorationShare: Math.max(0, Math.min(0.5, Number(value.minimumExplorationShare ?? DEFAULT_RECOMMENDATION_POLICY.minimumExplorationShare))),
  hideRatePenalty: Math.max(0, Math.min(60, Number(value.hideRatePenalty ?? DEFAULT_RECOMMENDATION_POLICY.hideRatePenalty))),
  reportRatePenalty: Math.max(0, Math.min(100, Number(value.reportRatePenalty ?? DEFAULT_RECOMMENDATION_POLICY.reportRatePenalty))),
  conversionRateBoost: Math.max(0, Math.min(60, Number(value.conversionRateBoost ?? DEFAULT_RECOMMENDATION_POLICY.conversionRateBoost))),
  updatedAt: value.updatedAt || null,
  updatedBy: toId(value.updatedBy),
  changeReason: String(value.changeReason || ""),
});

const getRecommendationPolicy = async () => {
  const policy = await RecommendationPolicy.findOne({ key: "global" }).lean();
  return normalizePolicy(policy || DEFAULT_RECOMMENDATION_POLICY);
};

const updateRecommendationPolicy = async ({ updates = {}, userId, reason = "" } = {}) => {
  const allowed = [
    "enabled",
    "maxRepeatedCreatorCount",
    "maxContentTypeStreak",
    "minimumExplorationShare",
    "hideRatePenalty",
    "reportRatePenalty",
    "conversionRateBoost",
  ];
  const unknown = Object.keys(updates || {}).filter((key) => !allowed.includes(key));
  if (unknown.length) {
    const error = new Error(`Invalid recommendation policy field: ${unknown[0]}`);
    error.status = 400;
    throw error;
  }
  if (Object.prototype.hasOwnProperty.call(updates, "enabled") && typeof updates.enabled !== "boolean") {
    const error = new Error("Recommendation policy enabled must be a Boolean");
    error.status = 400;
    throw error;
  }
  for (const key of allowed.filter((field) => field !== "enabled")) {
    if (Object.prototype.hasOwnProperty.call(updates, key) && !Number.isFinite(Number(updates[key]))) {
      const error = new Error(`Recommendation policy ${key} must be numeric`);
      error.status = 400;
      throw error;
    }
  }
  if (!String(reason || "").trim()) {
    const error = new Error("A change reason is required");
    error.status = 400;
    throw error;
  }
  const current = await getRecommendationPolicy();
  const next = normalizePolicy({ ...current, ...updates });
  const policy = await RecommendationPolicy.findOneAndUpdate(
    { key: "global" },
    {
      $set: {
        enabled: next.enabled,
        maxRepeatedCreatorCount: next.maxRepeatedCreatorCount,
        maxContentTypeStreak: next.maxContentTypeStreak,
        minimumExplorationShare: next.minimumExplorationShare,
        hideRatePenalty: next.hideRatePenalty,
        reportRatePenalty: next.reportRatePenalty,
        conversionRateBoost: next.conversionRateBoost,
        updatedBy: userId || null,
        changeReason: String(reason).trim().slice(0, 300),
      },
      $setOnInsert: { key: "global" },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  ).lean();
  return { previous: current, policy: normalizePolicy(policy) };
};

const loadCreatorRecommendationSignals = async ({ creatorIds = [], lookbackDays = 30 } = {}) => {
  const ids = Array.from(new Set(creatorIds.map(toId).filter(Boolean)));
  if (!ids.length) return new Map();
  const start = new Date(Date.now() - Math.max(1, Number(lookbackDays) || 30) * DAY_MS);
  const rows = await AnalyticsEvent.aggregate([
    {
      $match: {
        "metadata.creatorId": { $in: ids },
        createdAt: { $gte: start },
        type: {
          $in: [
            "feed_impression",
            "recommendation_clicked",
            "recommendation_hidden",
            "recommendation_dismissed",
            "recommendation_reported",
            "creator_followed",
            "purchase_success",
          ],
        },
      },
    },
    {
      $group: {
        _id: { creatorId: "$metadata.creatorId", type: "$type" },
        count: { $sum: 1 },
      },
    },
  ]).catch(() => []);

  const counts = new Map(ids.map((id) => [id, {}]));
  for (const row of rows) {
    const creatorId = toId(row?._id?.creatorId);
    const type = String(row?._id?.type || "");
    if (!counts.has(creatorId)) counts.set(creatorId, {});
    counts.get(creatorId)[type] = Number(row?.count || 0);
  }

  return new Map(Array.from(counts.entries()).map(([creatorId, values]) => {
    const observedImpressions = Number(values.feed_impression || 0);
    const impressions = Math.max(1, observedImpressions);
    const hasStableSample = observedImpressions >= 10;
    return [creatorId, {
      impressions: observedImpressions,
      clicks: Number(values.recommendation_clicked || 0),
      hides: Number(values.recommendation_hidden || 0) + Number(values.recommendation_dismissed || 0),
      reports: Number(values.recommendation_reported || 0),
      conversions: Number(values.purchase_success || 0) + Number(values.creator_followed || 0),
      hideRate: hasStableSample ? roundRate((Number(values.recommendation_hidden || 0) + Number(values.recommendation_dismissed || 0)) / impressions) : 0,
      reportRate: hasStableSample ? roundRate(Number(values.recommendation_reported || 0) / impressions) : 0,
      conversionRate: hasStableSample ? roundRate((Number(values.purchase_success || 0) + Number(values.creator_followed || 0)) / impressions) : 0,
      sampleReady: hasStableSample,
    }];
  }));
};

const getMaxContentTypeStreak = (items = []) => {
  let max = 0;
  let current = 0;
  let previous = "";
  for (const item of [...items].sort((left, right) => Number(left.rank || 0) - Number(right.rank || 0))) {
    const type = String(item?.contentType || item?.entityType || "unknown");
    current = type === previous ? current + 1 : 1;
    previous = type;
    max = Math.max(max, current);
  }
  return max;
};

const buildDateRange = ({ range = "30d", startDate = "", endDate = "" } = {}) => {
  const now = new Date();
  const end = range === "custom" ? new Date(endDate) : now;
  if (Number.isNaN(end.getTime())) throw new Error("Invalid analytics end date");
  if (range === "custom") end.setHours(23, 59, 59, 999);
  let start;
  if (range === "custom") {
    start = new Date(startDate);
    if (Number.isNaN(start.getTime())) throw new Error("Invalid analytics start date");
    start.setHours(0, 0, 0, 0);
  } else if (range === "today") {
    start = new Date(now);
    start.setHours(0, 0, 0, 0);
  } else if (range === "year") {
    start = new Date(now.getFullYear(), 0, 1);
  } else {
    const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
    start = new Date(now.getTime() - (days - 1) * DAY_MS);
    start.setHours(0, 0, 0, 0);
  }
  if (start > end) throw new Error("Invalid analytics date range");
  return { range, start, end };
};

const buildRecommendationDiagnostics = async ({ range, startDate, endDate } = {}) => {
  const dates = buildDateRange({ range, startDate, endDate });
  const policy = await getRecommendationPolicy();
  const rawLogs = await RecommendationLog.find({ servedAt: { $gte: dates.start, $lte: dates.end } })
    .select("userId surface rankedItemRefs creatorExposures feedback servedAt")
    .sort({ servedAt: 1 })
    .limit(50001)
    .lean();
  const logsTruncated = rawLogs.length > 50000;
  const logs = rawLogs.slice(0, 50000);

  let servedItems = 0;
  let repeatedCreatorViolations = 0;
  let contentTypeStreakViolations = 0;
  let hides = 0;
  let reports = 0;
  let clicks = 0;
  const surfaces = new Map();
  for (const log of logs) {
    const itemCount = Array.isArray(log.rankedItemRefs) ? log.rankedItemRefs.length : 0;
    servedItems += itemCount;
    if ((log.creatorExposures || []).some((exposure) => Number(exposure.count || 0) > policy.maxRepeatedCreatorCount)) {
      repeatedCreatorViolations += 1;
    }
    if (getMaxContentTypeStreak(log.rankedItemRefs) > policy.maxContentTypeStreak) {
      contentTypeStreakViolations += 1;
    }
    const bucket = surfaces.get(log.surface) || { surface: log.surface, requests: 0, servedItems: 0, hides: 0, reports: 0, clicks: 0 };
    bucket.requests += 1;
    bucket.servedItems += itemCount;
    for (const feedback of log.feedback || []) {
      const type = String(feedback.type || "");
      if (["recommendation_hidden", "recommendation_dismissed"].includes(type)) {
        hides += 1;
        bucket.hides += 1;
      }
      if (type === "recommendation_reported") {
        reports += 1;
        bucket.reports += 1;
      }
      if (type === "recommendation_clicked") {
        clicks += 1;
        bucket.clicks += 1;
      }
    }
    surfaces.set(log.surface, bucket);
  }

  const outcomes = await AnalyticsEvent.find({
    type: { $in: ["purchase_success", "creator_followed"] },
    createdAt: { $gte: dates.start, $lte: dates.end },
    "metadata.creatorId": { $nin: [null, ""] },
  })
    .select("userId type createdAt metadata.creatorId")
    .lean();
  const exposuresByUserAndCreator = new Map();
  for (const log of logs) {
    const userId = toId(log.userId);
    const servedAt = new Date(log.servedAt).getTime();
    if (!userId || !Number.isFinite(servedAt)) continue;
    for (const exposure of log.creatorExposures || []) {
      const creatorId = toId(exposure.creatorId);
      if (!creatorId) continue;
      const key = `${userId}:${creatorId}`;
      const timestamps = exposuresByUserAndCreator.get(key) || [];
      timestamps.push(servedAt);
      exposuresByUserAndCreator.set(key, timestamps);
    }
  }
  let purchasesAfterRecommendation = 0;
  let followsAfterRecommendation = 0;
  for (const outcome of outcomes) {
    const outcomeUserId = toId(outcome.userId);
    const outcomeCreatorId = toId(outcome.metadata?.creatorId);
    const outcomeAt = new Date(outcome.createdAt).getTime();
    const matched = (exposuresByUserAndCreator.get(`${outcomeUserId}:${outcomeCreatorId}`) || [])
      .some((servedAt) => servedAt <= outcomeAt && servedAt >= outcomeAt - 7 * DAY_MS);
    if (!matched) continue;
    if (outcome.type === "purchase_success") purchasesAfterRecommendation += 1;
    if (outcome.type === "creator_followed") followsAfterRecommendation += 1;
  }

  return {
    filters: { range: dates.range, startDate: dates.start.toISOString(), endDate: dates.end.toISOString() },
    dataQuality: {
      complete: !logsTruncated,
      recommendationLogs: logs.length,
      logsTruncated,
      rowLimit: 50000,
    },
    policy,
    summary: {
      requests: logs.length,
      servedItems,
      repeatedCreatorViolations,
      contentTypeStreakViolations,
      hides,
      reports,
      clicks,
      purchasesAfterRecommendation,
      followsAfterRecommendation,
      hideRate: roundRate(servedItems ? hides / servedItems : 0),
      reportRate: roundRate(servedItems ? reports / servedItems : 0),
      clickThroughRate: roundRate(servedItems ? clicks / servedItems : 0),
      conversionRate: roundRate(servedItems ? (purchasesAfterRecommendation + followsAfterRecommendation) / servedItems : 0),
    },
    surfaces: Array.from(surfaces.values()).map((surface) => ({
      ...surface,
      hideRate: roundRate(surface.servedItems ? surface.hides / surface.servedItems : 0),
      reportRate: roundRate(surface.servedItems ? surface.reports / surface.servedItems : 0),
      clickThroughRate: roundRate(surface.servedItems ? surface.clicks / surface.servedItems : 0),
    })),
  };
};

module.exports = {
  DEFAULT_RECOMMENDATION_POLICY,
  buildRecommendationDiagnostics,
  getMaxContentTypeStreak,
  getRecommendationPolicy,
  loadCreatorRecommendationSignals,
  normalizePolicy,
  updateRecommendationPolicy,
};
