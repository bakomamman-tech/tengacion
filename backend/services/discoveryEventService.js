const crypto = require("crypto");
const mongoose = require("mongoose");
const RecommendationLog = require("../models/RecommendationLog");
const { logAnalyticsEvent } = require("./analyticsService");
const {
  sanitizePlainObject,
  limitArray,
  truncate,
} = require("../config/storage");

const ALLOWED_EVENT_TYPES = new Set([
  "feed_impression",
  "post_opened",
  "post_dwell",
  "post_shared",
  "story_seen",
  "story_replied",
  "creator_followed",
  "creator_profile_viewed",
  "search_result_clicked",
  "live_joined",
  "live_left",
  "track_preview_started",
  "track_stream_started",
  "track_stream_completed",
  "book_preview_opened",
  "book_downloaded",
  "paywall_viewed",
  "recommendation_served",
  "recommendation_clicked",
  "recommendation_hidden",
  "recommendation_dismissed",
]);

const normalizeText = (value, maxLength = 80) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .slice(0, maxLength);

const normalizeId = (value = "") => {
  if (!value) return "";
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (typeof value === "string") return value;
  if (value._id && value._id !== value) return normalizeId(value._id);
  return String(value);
};

const toObjectId = (value = "") => {
  const normalized = normalizeId(value);
  return mongoose.Types.ObjectId.isValid(normalized)
    ? new mongoose.Types.ObjectId(normalized)
    : null;
};

const makeEntityKey = (entityType = "", entityId = "") =>
  `${normalizeText(entityType, 40)}:${String(entityId || "").trim().slice(0, 120)}`;

const buildRankedItemRefs = (rankedItems = []) =>
  limitArray(Array.isArray(rankedItems) ? rankedItems : [], 40)
    .map((item) => {
      const entityType = normalizeText(item?.entityType, 40);
      const entityId = String(item?.id || item?.entityId || "").trim().slice(0, 120);
      const creatorId = toObjectId(item?.creatorId);

      return {
        entityKey: entityType && entityId ? makeEntityKey(entityType, entityId) : "",
        entityType,
        entityId,
        creatorId,
        rank: Number(item?.rank || 0),
        reason: normalizeText(item?.reason, 80),
      };
    })
    .filter((item) => item.entityKey);

const buildCreatorExposures = (rankedItemRefs = []) => {
  const byCreator = new Map();

  for (const item of Array.isArray(rankedItemRefs) ? rankedItemRefs : []) {
    const creatorId = toObjectId(item?.creatorId);
    if (!creatorId) continue;

    const key = creatorId.toString();
    const existing = byCreator.get(key) || {
      creatorId,
      count: 0,
      highestRank: Number(item?.rank || 0),
      entityTypes: new Set(),
    };

    existing.count += 1;
    const rank = Number(item?.rank || 0);
    if (rank > 0) {
      existing.highestRank = existing.highestRank
        ? Math.min(existing.highestRank, rank)
        : rank;
    }
    if (item?.entityType) {
      existing.entityTypes.add(normalizeText(item.entityType, 40));
    }
    byCreator.set(key, existing);
  }

  return Array.from(byCreator.values()).map((entry) => ({
    creatorId: entry.creatorId,
    count: entry.count,
    highestRank: entry.highestRank,
    entityTypes: Array.from(entry.entityTypes).filter(Boolean),
  }));
};

const buildResponseMeta = ({ rankedItems = [], creatorIds = [], recommendationMeta = {} } = {}) => ({
  itemCount: Array.isArray(rankedItems) ? rankedItems.length : 0,
  creatorCount: Array.isArray(creatorIds) ? creatorIds.length : 0,
  candidateCount: Number(recommendationMeta?.candidateCount || 0),
  eligibleCount: Number(recommendationMeta?.eligibleCount || 0),
  filteredCount: Number(recommendationMeta?.filteredCount || 0),
  filteredByReason: recommendationMeta?.filteredByReason || {},
  fallbackMode: normalizeText(recommendationMeta?.fallbackMode, 40),
  rankedCount: Number(recommendationMeta?.rankedCount || 0),
  diversityCap: Number(recommendationMeta?.diversityCap || 0),
  limit: Number(recommendationMeta?.limit || 0),
});

const createRecommendationLog = async ({
  userId,
  surface,
  candidates = [],
  rankedItems = [],
  affinity,
  recommendationMeta = {},
}) => {
  const requestId = crypto.randomUUID();
  const rankedItemRefs = buildRankedItemRefs(rankedItems);
  const creatorExposures = buildCreatorExposures(rankedItemRefs);
  const creatorIds = creatorExposures.map((entry) => entry.creatorId).filter(Boolean);
  const doc = await RecommendationLog.create({
    requestId,
    userId,
    surface: normalizeText(surface, 60),
    candidateIds: limitArray(Array.isArray(candidates) ? candidates : [], 25)
      .map((candidate) => String(candidate?.candidateId || ""))
      .map((value) => truncate(value, 120))
      .filter(Boolean),
    rankedIds: limitArray(Array.isArray(rankedItems) ? rankedItems : [], 40)
      .map((item) => `${String(item?.entityType || "")}:${String(item?.id || "")}`)
      .map((value) => truncate(value, 160))
      .filter(Boolean),
    creatorIds,
    rankedItemRefs,
    creatorExposures,
    featuresSnapshot: sanitizePlainObject({
      topCreators: Array.isArray(affinity?.topCreators) ? affinity.topCreators.slice(0, 8) : [],
      preferredContentTypes: Array.isArray(affinity?.preferredContentTypes)
        ? affinity.preferredContentTypes.slice(0, 6)
        : [],
      topTopics: Array.isArray(affinity?.topTopics) ? affinity.topTopics.slice(0, 6) : [],
      recentSignals: affinity?.recentSignals || {},
    }, {
      maxDepth: 2,
      maxKeys: 16,
      maxStringLength: 280,
      maxArrayLength: 8,
    }),
    responseMeta: sanitizePlainObject(buildResponseMeta({
      rankedItems,
      creatorIds,
      recommendationMeta,
    }), {
      maxDepth: 2,
      maxKeys: 12,
      maxStringLength: 120,
      maxArrayLength: 4,
    }),
    servedAt: new Date(),
  });

  await logAnalyticsEvent({
    type: "recommendation_served",
    userId,
    targetId: requestId,
    targetType: "recommendation_request",
    contentType: normalizeText(surface, 40),
    metadata: {
      requestId,
      surface: normalizeText(surface, 40),
      itemCount: Array.isArray(rankedItems) ? rankedItems.length : 0,
    },
  }).catch(() => null);

  return doc.requestId;
};

const loadRankedCreatorMap = async ({ userId, requestId }) => {
  if (!requestId) {
    return new Map();
  }

  const log = await RecommendationLog.findOne({ requestId, userId })
    .select("rankedItemRefs")
    .lean()
    .catch(() => null);
  if (!log?.rankedItemRefs?.length) {
    return new Map();
  }

  return new Map(
    log.rankedItemRefs
      .map((item) => [
        item.entityKey || makeEntityKey(item.entityType, item.entityId),
        normalizeId(item.creatorId),
      ])
      .filter(([, creatorId]) => creatorId)
  );
};

const trackDiscoveryEvents = async ({
  userId,
  requestId,
  surface,
  events = [],
}) => {
  const normalizedEvents = (Array.isArray(events) ? events : [])
    .map((event) => ({
      type: normalizeText(event?.type, 80),
      entityType: normalizeText(event?.entityType, 40),
      entityId: String(event?.entityId || "").trim().slice(0, 120),
      position: Number.isFinite(Number(event?.position)) ? Number(event.position) : -1,
      value: Number.isFinite(Number(event?.value)) ? Number(event.value) : 0,
      metadata: event?.metadata && typeof event.metadata === "object" ? event.metadata : {},
    }))
    .filter((event) => event.type && ALLOWED_EVENT_TYPES.has(event.type));

  if (!normalizedEvents.length) {
    return { accepted: 0 };
  }

  const creatorByEntityKey = await loadRankedCreatorMap({ userId, requestId });
  const eventsWithCreator = normalizedEvents.map((event) => {
    const metadata = event.metadata && typeof event.metadata === "object"
      ? { ...event.metadata }
      : {};
    const creatorId =
      String(metadata.creatorId || "").trim() ||
      creatorByEntityKey.get(makeEntityKey(event.entityType, event.entityId)) ||
      "";

    if (creatorId) {
      metadata.creatorId = creatorId;
    }

    return {
      ...event,
      metadata,
    };
  });

  await Promise.all(
    eventsWithCreator.map((event) =>
      logAnalyticsEvent({
        type: event.type,
        userId,
        targetId: event.entityId || requestId,
        targetType: event.entityType || "discovery_item",
        contentType: normalizeText(surface, 40),
        metadata: {
          ...event.metadata,
          requestId,
          surface: normalizeText(surface, 40),
          position: event.position,
          value: event.value,
        },
      }).catch(() => null)
    )
  );

  if (requestId) {
    await RecommendationLog.updateOne(
      { requestId, userId },
      {
        $push: {
          feedback: {
            $each: eventsWithCreator.map((event) => ({
              type: event.type,
              entityType: event.entityType,
              entityId: event.entityId,
              position: event.position,
              value: event.value,
              metadata: {
                ...event.metadata,
                surface: normalizeText(surface, 40),
              },
              createdAt: new Date(),
            })),
          },
        },
      }
    ).catch(() => null);
  }

  return { accepted: eventsWithCreator.length };
};

module.exports = {
  createRecommendationLog,
  trackDiscoveryEvents,
};
