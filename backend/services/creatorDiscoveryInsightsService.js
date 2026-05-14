const mongoose = require("mongoose");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const Album = require("../models/Album");
const Book = require("../models/Book");
const CreatorProfile = require("../models/CreatorProfile");
const Purchase = require("../models/Purchase");
const RecommendationLog = require("../models/RecommendationLog");
const Track = require("../models/Track");
const Video = require("../models/Video");
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

const CONTENT_ACTION_EVENT_TYPES = [
  "recommendation_clicked",
  "recommendation_hidden",
  "recommendation_dismissed",
  "track_preview_started",
  "track_stream_started",
  "track_stream_completed",
  "book_preview_opened",
  "book_downloaded",
  "paywall_viewed",
];

const PREVIEW_EVENT_TYPES = new Set([
  "track_preview_started",
  "book_preview_opened",
  "paywall_viewed",
]);

const STREAM_EVENT_TYPES = new Set([
  "track_stream_started",
  "track_stream_completed",
]);

const DOWNLOAD_EVENT_TYPES = new Set([
  "book_downloaded",
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

const normalizeItemType = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["track", "song", "music", "podcast", "podcast_episode"].includes(normalized)) return "track";
  if (["ebook", "book"].includes(normalized)) return "book";
  if (["album"].includes(normalized)) return "album";
  if (["video", "reel", "reels"].includes(normalized)) return "video";
  return "";
};

const getEntityTypesForItemType = (itemType = "") => {
  const normalized = normalizeItemType(itemType);
  if (normalized === "track") {
    return ["track", "podcast"];
  }
  return normalized ? [normalized] : [];
};

const getPurchaseTypesForItemType = (itemType = "") => {
  const normalized = normalizeItemType(itemType);
  return normalized ? [normalized] : [];
};

const resolveContentTitle = (itemType = "", item = {}) => {
  if (itemType === "video") return item.caption || item.title || "Video";
  return item.title || item.caption || "Untitled content";
};

const loadCreatorContentItem = async ({ profile, itemType, itemId }) => {
  const creatorObjectId = toObjectId(profile?._id);
  const itemObjectId = toObjectId(itemId);
  const normalizedItemType = normalizeItemType(itemType);
  if (!creatorObjectId || !itemObjectId || !normalizedItemType) {
    return null;
  }

  let item = null;
  if (normalizedItemType === "track") {
    item = await Track.findOne({
      _id: itemObjectId,
      creatorId: creatorObjectId,
      archivedAt: null,
    }).lean();
  } else if (normalizedItemType === "book") {
    item = await Book.findOne({
      _id: itemObjectId,
      creatorId: creatorObjectId,
      archivedAt: null,
    }).lean();
  } else if (normalizedItemType === "album") {
    item = await Album.findOne({
      _id: itemObjectId,
      creatorId: creatorObjectId,
      archivedAt: null,
    }).lean();
  } else if (normalizedItemType === "video") {
    item = await Video.findOne({
      _id: itemObjectId,
      archivedAt: null,
      $or: [
        { creatorProfileId: creatorObjectId },
        { userId: toId(profile?.userId) },
      ],
    }).lean();
  }

  if (!item) {
    return null;
  }

  return {
    id: itemObjectId.toString(),
    itemType: normalizedItemType,
    title: resolveContentTitle(normalizedItemType, item),
    price: toNumber(item.price),
    publishedStatus: item.publishedStatus || item.status || (item.isPublished === false ? "draft" : "published"),
    createdAt: item.createdAt || item.time || null,
    updatedAt: item.updatedAt || item.time || item.createdAt || null,
  };
};

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

const countContentActionRows = (rows = []) =>
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
    if (PREVIEW_EVENT_TYPES.has(type)) {
      acc.previews += count;
    }
    if (STREAM_EVENT_TYPES.has(type)) {
      acc.streams += count;
    }
    if (DOWNLOAD_EVENT_TYPES.has(type)) {
      acc.downloads += count;
    }
    return acc;
  }, {
    byType: {},
    clicks: 0,
    previews: 0,
    streams: 0,
    downloads: 0,
    negativeActions: 0,
  });

const mergeContentSurfaceRows = ({ exposureRows = [], actionRows = [] } = {}) => {
  const surfaces = new Map();
  const ensure = (surface) => {
    const key = normalizeSurface(surface);
    if (!surfaces.has(key)) {
      surfaces.set(key, {
        surface: key,
        impressions: 0,
        clicks: 0,
        previews: 0,
        streams: 0,
        downloads: 0,
        negativeActions: 0,
        averageRank: 0,
        bestRank: 0,
      });
    }
    return surfaces.get(key);
  };

  for (const row of exposureRows) {
    const entry = ensure(row?._id?.surface);
    entry.impressions += toNumber(row?.impressions);
    entry.averageRank = row?.averageRank
      ? Number(Number(row.averageRank).toFixed(1))
      : entry.averageRank;
    entry.bestRank = row?.bestRank ? Number(row.bestRank) : entry.bestRank;
  }

  for (const row of actionRows) {
    const entry = ensure(row?._id?.surface);
    const type = String(row?._id?.type || "").trim();
    const count = toNumber(row?.count);

    if (CLICK_EVENT_TYPES.has(type)) {
      entry.clicks += count;
    }
    if (NEGATIVE_EVENT_TYPES.has(type)) {
      entry.negativeActions += count;
    }
    if (PREVIEW_EVENT_TYPES.has(type)) {
      entry.previews += count;
    }
    if (STREAM_EVENT_TYPES.has(type)) {
      entry.streams += count;
    }
    if (DOWNLOAD_EVENT_TYPES.has(type)) {
      entry.downloads += count;
    }
  }

  return Array.from(surfaces.values())
    .map((entry) => ({
      ...entry,
      clickThroughRate: toPercent(entry.clicks, entry.impressions),
      purchaseIntentRate: toPercent(entry.previews + entry.clicks, entry.impressions),
      negativeRate: toPercent(entry.negativeActions, entry.impressions),
    }))
    .sort((left, right) => Number(right.impressions || 0) - Number(left.impressions || 0));
};

const buildContentActionPrompts = ({ summary = {}, item = {} } = {}) => {
  const prompts = [];

  if (!summary.impressions) {
    prompts.push({
      key: "content_no_discovery_exposure",
      title: "Prepare this item for discovery",
      description: "This content has not appeared in recommendation surfaces during the selected range.",
      actionLabel: "Review metadata",
      actionTo: "/creator/dashboard",
      tone: "warning",
    });
    return prompts;
  }

  if (summary.clickThroughRate < 2) {
    prompts.push({
      key: "content_low_click_rate",
      title: "Improve the first impression",
      description: "Recommendation exposure is not turning into enough clicks. Review title, cover, and opening preview quality.",
      actionLabel: "Edit content",
      actionTo: "/creator/dashboard",
      tone: "neutral",
    });
  }

  if (summary.clicks > 0 && summary.purchases === 0 && Number(item.price || 0) > 0) {
    prompts.push({
      key: "content_clicks_without_sales",
      title: "Review the purchase offer",
      description: "Fans are opening this content but not buying it yet. Check price, preview strength, and description clarity.",
      actionLabel: "Review offer",
      actionTo: "/creator/dashboard",
      tone: "warning",
    });
  }

  if (summary.purchases > 0) {
    prompts.push({
      key: "content_purchase_momentum",
      title: "Build on conversion momentum",
      description: "This item is converting from discovery. Keep related releases, bundles, and subscription benefits current.",
      actionLabel: "Open dashboard",
      actionTo: "/creator/dashboard",
      tone: "success",
    });
  }

  if (summary.negativeRate >= 8) {
    prompts.push({
      key: "content_negative_feedback",
      title: "Check audience fit",
      description: "Hide or dismiss feedback is elevated for this item. Tighten metadata and recommendation targeting signals.",
      actionLabel: "Edit metadata",
      actionTo: "/creator/dashboard",
      tone: "warning",
    });
  }

  return prompts.slice(0, 4);
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

const buildCreatorDiscoveryContentInsights = async ({
  profile,
  itemType,
  itemId,
  range = "30d",
  startDate,
  endDate,
} = {}) => {
  const creatorObjectId = toObjectId(profile?._id);
  const itemObjectId = toObjectId(itemId);
  const item = await loadCreatorContentItem({ profile, itemType, itemId });

  if (!creatorObjectId || !itemObjectId || !item) {
    const error = new Error("Creator content item not found");
    error.statusCode = 404;
    throw error;
  }

  const dates = buildSafeDateRange({ range, startDate, endDate });
  const creatorId = creatorObjectId.toString();
  const itemIdString = itemObjectId.toString();
  const entityTypes = getEntityTypesForItemType(item.itemType);
  const purchaseTypes = getPurchaseTypesForItemType(item.itemType);

  const [exposureRows, actionRows, purchaseRows] = await Promise.all([
    RecommendationLog.aggregate([
      {
        $match: {
          servedAt: { $gte: dates.start, $lte: dates.end },
          "rankedItemRefs.creatorId": creatorObjectId,
          "rankedItemRefs.entityId": itemIdString,
        },
      },
      { $unwind: "$rankedItemRefs" },
      {
        $match: {
          "rankedItemRefs.creatorId": creatorObjectId,
          "rankedItemRefs.entityId": itemIdString,
          "rankedItemRefs.entityType": { $in: entityTypes },
        },
      },
      {
        $group: {
          _id: {
            surface: "$surface",
            reason: "$rankedItemRefs.reason",
          },
          impressions: { $sum: 1 },
          averageRank: { $avg: "$rankedItemRefs.rank" },
          bestRank: { $min: "$rankedItemRefs.rank" },
        },
      },
    ]),
    AnalyticsEvent.aggregate([
      {
        $match: {
          type: { $in: CONTENT_ACTION_EVENT_TYPES },
          createdAt: { $gte: dates.start, $lte: dates.end },
          targetType: { $in: entityTypes },
          $or: [
            { targetId: itemIdString },
            { targetId: itemObjectId },
          ],
        },
      },
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
    Purchase.aggregate([
      {
        $match: {
          creatorId: creatorObjectId,
          itemType: { $in: purchaseTypes },
          itemId: itemObjectId,
          status: "paid",
          $or: [
            { paidAt: { $gte: dates.start, $lte: dates.end } },
            {
              paidAt: null,
              createdAt: { $gte: dates.start, $lte: dates.end },
            },
          ],
        },
      },
      {
        $group: {
          _id: null,
          purchases: { $sum: 1 },
          revenue: { $sum: "$amount" },
          buyers: { $addToSet: "$userId" },
        },
      },
    ]),
  ]);

  const actionCounts = countContentActionRows(actionRows);
  const impressions = exposureRows.reduce((sum, row) => sum + toNumber(row?.impressions), 0);
  const recommendationRequests = impressions;
  const purchaseSummary = purchaseRows[0] || {};
  const purchases = toNumber(purchaseSummary?.purchases);
  const revenue = toNumber(purchaseSummary?.revenue);
  const uniqueBuyers = Array.isArray(purchaseSummary?.buyers) ? purchaseSummary.buyers.length : 0;
  const reasonBreakdown = exposureRows
    .map((row) => ({
      reason: String(row?._id?.reason || "unknown").trim() || "unknown",
      surface: normalizeSurface(row?._id?.surface),
      impressions: toNumber(row?.impressions),
      averageRank: row?.averageRank ? Number(Number(row.averageRank).toFixed(1)) : 0,
      bestRank: row?.bestRank ? Number(row.bestRank) : 0,
    }))
    .sort((left, right) => Number(right.impressions || 0) - Number(left.impressions || 0));
  const summary = {
    impressions,
    recommendationRequests,
    clicks: actionCounts.clicks,
    previews: actionCounts.previews,
    streams: actionCounts.streams,
    downloads: actionCounts.downloads,
    negativeActions: actionCounts.negativeActions,
    purchases,
    revenue,
    uniqueBuyers,
    clickThroughRate: toPercent(actionCounts.clicks, impressions),
    engagementRate: toPercent(
      actionCounts.clicks + actionCounts.previews + actionCounts.streams + actionCounts.downloads,
      impressions
    ),
    negativeRate: toPercent(actionCounts.negativeActions, impressions),
    purchaseConversionRate: toPercent(purchases, impressions),
    clickToPurchaseRate: toPercent(purchases, actionCounts.clicks),
    byEventType: actionCounts.byType,
  };

  return {
    filters: {
      range: dates.range,
      startDate: dates.start,
      endDate: dates.end,
    },
    item,
    summary,
    surfaceBreakdown: mergeContentSurfaceRows({ exposureRows, actionRows }),
    reasonBreakdown,
    actionPrompts: buildContentActionPrompts({ summary, item }),
  };
};

const buildCreatorDiscoveryContentInsightsForUser = async ({
  userId,
  itemType,
  itemId,
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

  return buildCreatorDiscoveryContentInsights({
    profile,
    itemType,
    itemId,
    range,
    startDate,
    endDate,
  });
};

module.exports = {
  buildCreatorDiscoveryContentInsights,
  buildCreatorDiscoveryContentInsightsForUser,
  buildCreatorDiscoveryInsights,
  buildCreatorDiscoveryInsightsForUser,
};
