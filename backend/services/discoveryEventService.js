const crypto = require("crypto");
const RecommendationLog = require("../models/RecommendationLog");
const { logAnalyticsEvent } = require("./analyticsService");

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

const createRecommendationLog = async ({
  userId,
  surface,
  candidates = [],
  rankedItems = [],
  affinity,
}) => {
  const requestId = crypto.randomUUID();
  const doc = await RecommendationLog.create({
    requestId,
    userId,
    surface: normalizeText(surface, 60),
    candidateIds: (Array.isArray(candidates) ? candidates : [])
      .map((candidate) => String(candidate?.candidateId || ""))
      .filter(Boolean),
    rankedIds: (Array.isArray(rankedItems) ? rankedItems : [])
      .map((item) => `${String(item?.entityType || "")}:${String(item?.id || "")}`)
      .filter(Boolean),
    featuresSnapshot: {
      topCreators: Array.isArray(affinity?.topCreators) ? affinity.topCreators.slice(0, 8) : [],
      preferredContentTypes: Array.isArray(affinity?.preferredContentTypes)
        ? affinity.preferredContentTypes.slice(0, 6)
        : [],
      topTopics: Array.isArray(affinity?.topTopics) ? affinity.topTopics.slice(0, 6) : [],
      recentSignals: affinity?.recentSignals || {},
    },
    responseMeta: {
      itemCount: Array.isArray(rankedItems) ? rankedItems.length : 0,
    },
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

  await Promise.all(
    normalizedEvents.map((event) =>
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
            $each: normalizedEvents.map((event) => ({
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

  return { accepted: normalizedEvents.length };
};

module.exports = {
  createRecommendationLog,
  trackDiscoveryEvents,
};
