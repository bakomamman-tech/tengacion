const mongoose = require("mongoose");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const CreatorProfile = require("../models/CreatorProfile");
const RecommendationLog = require("../models/RecommendationLog");
const { buildDateRange } = require("./analyticsService");

const DISCOVERY_ACTION_EVENT_TYPES = [
  "recommendation_clicked",
  "recommendation_hidden",
  "recommendation_dismissed",
  "creator_followed",
  "creator_profile_viewed",
];

const CLICK_EVENT_TYPES = new Set([
  "recommendation_clicked",
  "creator_profile_viewed",
]);

const NEGATIVE_EVENT_TYPES = new Set([
  "recommendation_hidden",
  "recommendation_dismissed",
]);

const toId = (value = "") => {
  if (!value) return "";
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (typeof value === "string") return value;
  if (value._id && value._id !== value) return toId(value._id);
  return String(value);
};

const toObjectId = (value = "") => {
  const normalized = toId(value);
  return mongoose.Types.ObjectId.isValid(normalized)
    ? new mongoose.Types.ObjectId(normalized)
    : null;
};

const toNumber = (value = 0) => Math.max(0, Number(value || 0));

const toPercent = (numerator = 0, denominator = 0) =>
  denominator > 0 ? Number(((toNumber(numerator) / toNumber(denominator)) * 100).toFixed(1)) : 0;

const normalizeSurface = (value = "") =>
  String(value || "unknown").trim().toLowerCase() || "unknown";

const buildSafeDateRange = ({ range = "30d", startDate, endDate } = {}) => {
  try {
    return buildDateRange({ range, startDate, endDate });
  } catch (err) {
    err.statusCode = 400;
    throw err;
  }
};

const countActionRows = (rows = []) =>
  (Array.isArray(rows) ? rows : []).reduce((acc, row) => {
    const count = toNumber(row?.count);
    const type = String(row?._id?.type || row?.type || "").trim();
    if (!type) return acc;

    acc.byType[type] = toNumber(acc.byType[type]) + count;
    if (CLICK_EVENT_TYPES.has(type)) {
      acc.clicks += count;
    }
    if (NEGATIVE_EVENT_TYPES.has(type)) {
      acc.negativeActions += count;
    }
    if (type === "creator_followed") {
      acc.follows += count;
    }
    if (type === "creator_profile_viewed") {
      acc.profileViews += count;
    }
    return acc;
  }, {
    byType: {},
    clicks: 0,
    follows: 0,
    profileViews: 0,
    negativeActions: 0,
  });

const mergeSurfaceRows = ({ exposureRows = [], actionRows = [] } = {}) => {
  const surfaces = new Map();
  const ensure = (surface) => {
    const key = normalizeSurface(surface);
    if (!surfaces.has(key)) {
      surfaces.set(key, {
        surface: key,
        impressions: 0,
        recommendationRequests: 0,
        clicks: 0,
        follows: 0,
        negativeActions: 0,
        averageBestRank: 0,
      });
    }
    return surfaces.get(key);
  };

  for (const row of exposureRows) {
    const entry = ensure(row?._id?.surface);
    entry.impressions += toNumber(row?.impressions);
    entry.recommendationRequests += toNumber(row?.recommendationRequests);
    entry.averageBestRank = row?.averageBestRank
      ? Number(Number(row.averageBestRank).toFixed(1))
      : entry.averageBestRank;
  }

  for (const row of actionRows) {
    const entry = ensure(row?._id?.surface);
    const type = String(row?._id?.type || "").trim();
    const count = toNumber(row?.count);

    if (CLICK_EVENT_TYPES.has(type)) {
      entry.clicks += count;
    }
    if (type === "creator_followed") {
      entry.follows += count;
    }
    if (NEGATIVE_EVENT_TYPES.has(type)) {
      entry.negativeActions += count;
    }
  }

  return Array.from(surfaces.values())
    .map((entry) => ({
      ...entry,
      clickThroughRate: toPercent(entry.clicks, entry.impressions),
      negativeRate: toPercent(entry.negativeActions, entry.impressions),
    }))
    .sort((left, right) => Number(right.impressions || 0) - Number(left.impressions || 0));
};

const buildActionPrompts = ({ summary = {}, surfaceBreakdown = [] } = {}) => {
  const prompts = [];
  const topSurface = surfaceBreakdown[0];

  if (!summary.impressions) {
    prompts.push({
      key: "discovery_no_exposure",
      title: "Strengthen discovery eligibility",
      description: "Publish or refresh at least one complete creator item so recommendations have a clear candidate to serve.",
      actionLabel: "Review catalog",
      actionTo: "/creator/dashboard",
      tone: "warning",
    });
    return prompts;
  }

  if (summary.clickThroughRate < 2) {
    prompts.push({
      key: "discovery_low_click_rate",
      title: "Improve recommendation pull",
      description: "Refresh cover art, previews, or titles on the items most likely to appear in discovery.",
      actionLabel: "Fix metadata",
      actionTo: "/creator/dashboard",
      tone: "neutral",
    });
  }

  if (summary.negativeRate >= 8) {
    prompts.push({
      key: "discovery_negative_feedback",
      title: "Review audience fit",
      description: "Recommendation hides or dismissals are elevated. Tighten genres, descriptions, and creator positioning.",
      actionLabel: "Edit profile",
      actionTo: "/creator/settings",
      tone: "warning",
    });
  }

  if (summary.follows > 0 && summary.clickThroughRate >= 2) {
    prompts.push({
      key: "discovery_follow_momentum",
      title: "Convert discovery momentum",
      description: "Fans are responding to your recommendations. Keep the fan page and subscription offer current.",
      actionLabel: "Preview fan page",
      actionTo: "/creator/fan-page-view",
      tone: "success",
    });
  }

  if (topSurface?.surface) {
    prompts.push({
      key: `discovery_surface_${topSurface.surface}`,
      title: "Lean into your strongest surface",
      description: `${topSurface.surface.replace(/_/g, " ")} is currently your biggest recommendation source.`,
      actionLabel: "Open dashboard",
      actionTo: "/creator/dashboard",
      tone: "neutral",
    });
  }

  return prompts.slice(0, 4);
};

const buildCreatorDiscoveryInsights = async ({
  profile,
  range = "30d",
  startDate,
  endDate,
} = {}) => {
  const creatorObjectId = toObjectId(profile?._id);
  if (!creatorObjectId) {
    return {
      filters: { range: "30d" },
      summary: {
        impressions: 0,
        recommendationRequests: 0,
        clicks: 0,
        follows: 0,
        profileViews: 0,
        negativeActions: 0,
        clickThroughRate: 0,
        negativeRate: 0,
      },
      surfaceBreakdown: [],
      actionPrompts: [],
    };
  }

  const dates = buildSafeDateRange({ range, startDate, endDate });
  const creatorId = creatorObjectId.toString();
  const recommendationMatch = {
    creatorIds: creatorObjectId,
    servedAt: { $gte: dates.start, $lte: dates.end },
  };
  const actionMatch = {
    type: { $in: DISCOVERY_ACTION_EVENT_TYPES },
    createdAt: { $gte: dates.start, $lte: dates.end },
    $or: [
      { "metadata.creatorId": creatorId },
      { "metadata.creatorId": creatorObjectId },
    ],
  };

  const [exposureRows, actionRows] = await Promise.all([
    RecommendationLog.aggregate([
      { $match: recommendationMatch },
      { $unwind: "$creatorExposures" },
      { $match: { "creatorExposures.creatorId": creatorObjectId } },
      {
        $group: {
          _id: { surface: "$surface" },
          impressions: { $sum: "$creatorExposures.count" },
          recommendationRequests: { $sum: 1 },
          averageBestRank: { $avg: "$creatorExposures.highestRank" },
        },
      },
    ]),
    AnalyticsEvent.aggregate([
      { $match: actionMatch },
      {
        $group: {
          _id: {
            surface: {
              $ifNull: ["$metadata.surface", "$contentType"],
            },
            type: "$type",
          },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const actionCounts = countActionRows(actionRows);
  const impressions = exposureRows.reduce((sum, row) => sum + toNumber(row?.impressions), 0);
  const recommendationRequests = exposureRows.reduce(
    (sum, row) => sum + toNumber(row?.recommendationRequests),
    0
  );
  const surfaceBreakdown = mergeSurfaceRows({ exposureRows, actionRows });
  const summary = {
    impressions,
    recommendationRequests,
    clicks: actionCounts.clicks,
    follows: actionCounts.follows,
    profileViews: actionCounts.profileViews,
    negativeActions: actionCounts.negativeActions,
    clickThroughRate: toPercent(actionCounts.clicks, impressions),
    negativeRate: toPercent(actionCounts.negativeActions, impressions),
    byEventType: actionCounts.byType,
  };

  return {
    filters: {
      range: dates.range,
      startDate: dates.start,
      endDate: dates.end,
    },
    summary,
    surfaceBreakdown,
    actionPrompts: buildActionPrompts({ summary, surfaceBreakdown }),
  };
};

const buildCreatorDiscoveryInsightsForUser = async ({
  userId,
  range = "30d",
  startDate,
  endDate,
} = {}) => {
  const profile = await CreatorProfile.findOne({ userId }).lean();
  if (!profile) {
    const error = new Error("Creator profile not found");
    error.statusCode = 404;
    throw error;
  }

  return buildCreatorDiscoveryInsights({ profile, range, startDate, endDate });
};

module.exports = {
  buildCreatorDiscoveryInsights,
  buildCreatorDiscoveryInsightsForUser,
};
