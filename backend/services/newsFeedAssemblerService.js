const mongoose = require("mongoose");
const NewsAsset = require("../models/NewsAsset");
const NewsCluster = require("../models/NewsCluster");
const NewsFeedImpression = require("../models/NewsFeedImpression");
const NewsSource = require("../models/NewsSource");
const NewsStory = require("../models/NewsStory");
const NewsUserPreference = require("../models/NewsUserPreference");
const User = require("../models/User");
const { getTrustedSourceStrip } = require("./newsCatalogService");
const { buildUserGeoProfile } = require("./newsGeoService");
const { getSavedArticleIdsForUser } = require("./newsSavedService");
const { buildPersonalizationSignals } = require("./newsPersonalizationService");
const { getNewsTopics } = require("./newsTopicService");
const { enforceStoryRights } = require("./newsRightsService");
const { applyFeedDiversity, scoreCluster, scoreStory } = require("./newsRankingService");
const {
  decodeCursor,
  encodeCursor,
  normalizeSlug,
  normalizeWhitespace,
} = require("./newsNormalizeService");

const PUBLIC_STATUSES = ["approved", "limited"];
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_CANDIDATE_SIZE = 120;

const TAB_META = {
  "for-you": {
    title: "For You",
    description:
      "A calm mix of trusted reporting shaped by your interests, reading history, region, and important public-interest updates.",
    emptyTitle: "Your trusted feed is quiet right now",
    emptyDescription:
      "Try following a few topics or trusted sources and check back as fresh coverage arrives.",
  },
  local: {
    title: "Local",
    description:
      "Nearby reporting with city, state, and country fallbacks for transport, safety, weather, community, and local governance.",
    emptyTitle: "No local stories yet",
    emptyDescription:
      "We could not find trusted local coverage for your area right now. We will fall back as soon as verified local feeds update.",
  },
  nigeria: {
    title: "Nigeria",
    description:
      "National Nigerian coverage across politics, economy, education, security, culture, sports, entertainment, technology, and business.",
    emptyTitle: "Nigeria coverage is refreshing",
    emptyDescription:
      "Trusted Nigeria-wide stories will appear here as source feeds update.",
  },
  world: {
    title: "World",
    description:
      "International reporting with broader source diversity and less sensational weighting.",
    emptyTitle: "World coverage is temporarily unavailable",
    emptyDescription:
      "We are waiting for fresh verified global stories from trusted sources.",
  },
};

const isValidId = (value) => mongoose.Types.ObjectId.isValid(value);

const normalizeLimit = (value, fallback = DEFAULT_PAGE_SIZE) =>
  Math.max(1, Math.min(40, Number(value) || fallback));

const normalizeOffset = (cursor = "") => {
  const payload = decodeCursor(cursor);
  const offset = Number(payload?.offset || 0);
  return Number.isFinite(offset) && offset > 0 ? offset : 0;
};

const normalizeAssetDoc = (asset = {}) => ({
  id: String(asset?._id || ""),
  assetType: String(asset?.assetType || "image"),
  role: String(asset?.role || "thumbnail"),
  url: String(asset?.secureUrl || asset?.url || ""),
  width: Number(asset?.width || 0),
  height: Number(asset?.height || 0),
  altText: String(asset?.altText || ""),
  caption: String(asset?.caption || ""),
  creditLine: String(asset?.creditLine || ""),
});

const pickPrimaryAsset = (story = {}) => {
  const refs = Array.isArray(story?.assetRefs) ? story.assetRefs : [];
  const candidates = refs
    .map((entry) => entry?.assetId)
    .filter(Boolean)
    .map((entry) => (entry?.toObject ? entry.toObject() : entry));
  return (
    candidates.find((entry) => ["hero", "thumbnail"].includes(String(entry?.role || ""))) ||
    candidates[0] ||
    null
  );
};

const serializeSource = (source = {}) => ({
  id: String(source?._id || ""),
  slug: String(source?.slug || ""),
  displayName: normalizeWhitespace(source?.displayName || ""),
  publisherName: normalizeWhitespace(source?.publisherName || ""),
  homepageUrl: String(source?.homepageUrl || ""),
  logoUrl: String(source?.logoUrl || ""),
  publisherTier: String(source?.publisherTier || "discovery"),
  trustScore: Number(source?.trustScore || 0.6),
  isBlocked: Boolean(source?.isBlocked),
  verificationStatus: String(source?.verificationStatus || "reviewed"),
  licenseType: String(source?.licenseType || "official_rss"),
  licenseNotes: String(source?.licenseNotes || ""),
  useNotes: String(source?.useNotes || ""),
  categoryCoverage: Array.isArray(source?.categoryCoverage) ? source.categoryCoverage : [],
  supportedRegions: Array.isArray(source?.supportedRegions) ? source.supportedRegions : [],
  attribution: {
    attributionRequired: source?.attribution?.attributionRequired !== false,
    canonicalLinkRequired: source?.attribution?.canonicalLinkRequired !== false,
    copyrightLine: String(source?.attribution?.copyrightLine || ""),
  },
});

const serializeStory = (story = {}, { source = null, savedArticleIds = new Set() } = {}) => {
  const safeStory = enforceStoryRights(story, { source });
  const primaryAsset = pickPrimaryAsset(story);
  const storyId = String(story?._id || story?.id || "");

  return {
    id: storyId,
    clusterId: String(story?.clusterId || ""),
    sourceSlug: String(story?.sourceSlug || source?.slug || ""),
    title: String(safeStory?.title || ""),
    subtitle: String(safeStory?.subtitle || ""),
    bodyHtml: String(safeStory?.bodyHtml || ""),
    summaryText: String(safeStory?.summaryText || ""),
    contentType: String(safeStory?.contentType || "summary"),
    canonicalUrl: String(safeStory?.canonicalUrl || ""),
    publishedAt: safeStory?.publishedAt || null,
    updatedAt: safeStory?.updatedAtSource || null,
    authorByline: String(safeStory?.authorByline || ""),
    language: String(safeStory?.language || "en"),
    articleType: String(safeStory?.articleType || "report"),
    topicTags: Array.isArray(safeStory?.topicTags) ? safeStory.topicTags : [],
    geography: safeStory?.geography || {},
    rights: safeStory?.rights || {},
    display: safeStory?.display || {},
    moderation: {
      status: String(safeStory?.moderation?.status || "pending"),
      sensitiveFlags: Array.isArray(safeStory?.moderation?.sensitiveFlags)
        ? safeStory.moderation.sensitiveFlags
        : [],
    },
    trustScore: Number(
      safeStory?.trustScore ??
        safeStory?.moderation?.sourceTrustScore ??
        safeStory?.moderation?.trustScore ??
        source?.trustScore ??
        0.6
    ),
    isBreaking: Boolean(safeStory?.isBreaking || safeStory?.articleType === "breaking"),
    isOpinion: Boolean(safeStory?.isOpinion || safeStory?.articleType === "opinion"),
    source: source ? serializeSource(source) : null,
    media: primaryAsset ? normalizeAssetDoc(primaryAsset) : null,
    isSaved: savedArticleIds.has(storyId),
  };
};

const loadStoryAssets = async (storyIds = []) => {
  const ids = (Array.isArray(storyIds) ? storyIds : []).filter(Boolean);
  if (!ids.length) {
    return new Map();
  }

  const assets = await NewsAsset.find({ storyId: { $in: ids } }).lean();
  const grouped = new Map();
  for (const asset of assets) {
    const key = String(asset.storyId || "");
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(asset);
  }
  return grouped;
};

const attachAssetsToStory = (story = {}, assetsByStoryId = new Map()) => {
  const next = story?.toObject ? story.toObject() : { ...story };
  const storyId = String(next?._id || "");
  const assetDocs = assetsByStoryId.get(storyId) || [];
  next.assetRefs = assetDocs.map((asset) => ({
    role: asset?.role || "thumbnail",
    assetId: asset,
  }));
  return next;
};

const buildExposureMaps = async (userId) => {
  if (!userId || !isValidId(userId)) {
    return {
      storyExposure: new Map(),
      sourceExposure: new Map(),
      topicExposure: new Map(),
    };
  }

  const impressions = await NewsFeedImpression.find({
    userId,
    createdAt: { $gte: new Date(Date.now() - 72 * 60 * 60 * 1000) },
  })
    .sort({ createdAt: -1 })
    .limit(400)
    .lean();

  const storyExposure = new Map();
  const sourceExposure = new Map();
  const topicExposure = new Map();

  for (const impression of impressions) {
    const storyId = String(impression?.storyId || "");
    if (storyId) {
      if (!storyExposure.has(storyId)) {
        storyExposure.set(storyId, {
          sameStoryImpressions: 0,
        });
      }
      storyExposure.get(storyId).sameStoryImpressions += 1;
    }

    const sourceSlug = normalizeSlug(impression?.sourceSlug || "");
    if (sourceSlug) {
      sourceExposure.set(sourceSlug, (sourceExposure.get(sourceSlug) || 0) + 1);
    }

    for (const topic of Array.isArray(impression?.topicTags) ? impression.topicTags : []) {
      const slug = normalizeSlug(topic);
      if (!slug) {
        continue;
      }
      topicExposure.set(slug, (topicExposure.get(slug) || 0) + 1);
    }
  }

  return {
    storyExposure,
    sourceExposure,
    topicExposure,
  };
};

const buildQueryContext = async (userId) => {
  if (!userId || !isValidId(userId)) {
    return {
      user: null,
      preferences: null,
      userGeo: { country: "Nigeria", state: "", city: "" },
      signals: {
        topicWeights: new Map(),
        sourceWeights: new Map(),
        savedStoryIds: new Set(),
        readStoryIds: new Set(),
      },
      savedArticleIds: new Set(),
    };
  }

  const [user, preferences] = await Promise.all([
    User.findById(userId).select("_id country currentCity hometown interests").lean(),
    NewsUserPreference.findOne({ userId }).lean(),
  ]);
  const signals = await buildPersonalizationSignals({
    userId,
    preferences: preferences || {},
  });

  return {
    user,
    preferences,
    userGeo: buildUserGeoProfile(user || {}, preferences || {}),
    signals,
    savedArticleIds: signals.savedStoryIds,
  };
};

const buildLocalGeoFilter = ({ country = "", state = "", city = "" } = {}) => {
  const clauses = [];
  const normalizedCity = normalizeWhitespace(city);
  const normalizedState = normalizeWhitespace(state);
  const normalizedCountry = normalizeWhitespace(country);

  if (normalizedCity) {
    clauses.push({ "geography.primaryCity": normalizedCity });
    clauses.push({ "geography.cities": normalizedCity });
  }
  if (normalizedState) {
    clauses.push({ "geography.primaryState": normalizedState });
    clauses.push({ "geography.states": normalizedState });
  }
  if (normalizedCountry) {
    clauses.push({ "geography.primaryCountry": normalizedCountry });
    clauses.push({ "geography.countries": normalizedCountry });
  }

  return clauses.length ? { $or: clauses } : {};
};

const buildClusterMongoQuery = ({
  tab = "for-you",
  topicSlug = "",
  sourceSlug = "",
  country = "",
  state = "",
  city = "",
} = {}) => {
  const query = {
    "moderation.status": { $in: PUBLIC_STATUSES },
  };

  if (topicSlug) {
    query.topicTags = normalizeSlug(topicSlug);
  }
  if (sourceSlug) {
    query.sourceSlugs = normalizeSlug(sourceSlug);
  }

  if (tab === "world") {
    query["geography.scope"] = "international";
  } else if (tab === "nigeria") {
    query.$or = [
      { "geography.primaryCountry": "Nigeria" },
      { "geography.countries": "Nigeria" },
    ];
  } else if (tab === "local") {
    Object.assign(query, buildLocalGeoFilter({ country, state, city }));
  }

  return query;
};

const buildStoryMongoQuery = ({
  tab = "for-you",
  topicSlug = "",
  sourceSlug = "",
  country = "",
  state = "",
  city = "",
} = {}) => {
  const query = {
    "moderation.status": { $in: PUBLIC_STATUSES },
  };

  if (topicSlug) {
    query.topicTags = normalizeSlug(topicSlug);
  }
  if (sourceSlug) {
    query.sourceSlug = normalizeSlug(sourceSlug);
  }

  if (tab === "world") {
    query["geography.scope"] = "international";
  } else if (tab === "nigeria") {
    query.$or = [
      { "geography.primaryCountry": "Nigeria" },
      { "geography.countries": "Nigeria" },
    ];
  } else if (tab === "local") {
    Object.assign(query, buildLocalGeoFilter({ country, state, city }));
  }

  return query;
};

const buildStoryExposure = (story = {}, exposureMaps = {}) => {
  const storyId = String(story?._id || story?.id || "");
  const sourceSlug = normalizeSlug(story?.sourceSlug || "");
  const topics = Array.isArray(story?.topicTags) ? story.topicTags : [];

  return {
    sameStoryImpressions:
      Number(exposureMaps?.storyExposure?.get(storyId)?.sameStoryImpressions || 0),
    recentSourceImpressions: Number(exposureMaps?.sourceExposure?.get(sourceSlug) || 0),
    recentTopicImpressions: topics.reduce((maxValue, topic) => {
      const current = Number(exposureMaps?.topicExposure?.get(normalizeSlug(topic)) || 0);
      return Math.max(maxValue, current);
    }, 0),
  };
};

const enrichClusterCards = async (clusters = [], context = {}) => {
  const representativeStories = clusters
    .map((entry) => entry?.representativeStoryId)
    .filter(Boolean);
  const storyIds = representativeStories.map((entry) => entry?._id || entry).filter(Boolean);
  const assetsByStoryId = await loadStoryAssets(storyIds);

  return clusters.map((clusterDoc) => {
    const cluster = clusterDoc?.toObject ? clusterDoc.toObject() : clusterDoc;
    const representativeStoryDoc =
      clusterDoc?.representativeStoryId || cluster?.representativeStoryId || null;
    const sourceDoc = representativeStoryDoc?.sourceId || cluster?.sourceId || null;
    const representativeStory = representativeStoryDoc
      ? attachAssetsToStory(
          representativeStoryDoc?.toObject
            ? representativeStoryDoc.toObject()
            : representativeStoryDoc,
          assetsByStoryId
        )
      : null;

    const scoring = scoreCluster(cluster, representativeStory ? [representativeStory] : [], {
      source: sourceDoc,
      user: context?.user,
      preferences: context?.preferences,
      userGeo: context?.userGeo,
      engagement: context?.engagementByCluster?.get(String(cluster?._id || "")) || {},
      exposure: representativeStory ? buildStoryExposure(representativeStory, context?.exposureMaps) : {},
      signals: context?.signals,
    });

    const serializedStory = representativeStory
      ? serializeStory(representativeStory, {
          source: sourceDoc,
          savedArticleIds: context?.savedArticleIds || new Set(),
        })
      : null;

    return {
      id: String(cluster?._id || ""),
      clusterId: String(cluster?._id || ""),
      storyId: representativeStory ? String(representativeStory._id || "") : "",
      cardType: Number(cluster?.storyCount || 1) > 1 ? "cluster" : "story",
      title: String(cluster?.title || representativeStory?.title || ""),
      summary: String(cluster?.summary || representativeStory?.summaryText || ""),
      articleType: String(cluster?.articleType || representativeStory?.articleType || "report"),
      topicTags: Array.isArray(cluster?.topicTags) ? cluster.topicTags : [],
      geography: cluster?.geography || representativeStory?.geography || {},
      storyCount: Number(cluster?.storyCount || 1),
      sourceCount: Number(cluster?.sourceCount || 1),
      sourceSlugs: Array.isArray(cluster?.sourceSlugs) ? cluster.sourceSlugs : [],
      rights: cluster?.rights || representativeStory?.rights || {},
      moderation: cluster?.moderation || representativeStory?.moderation || {},
      scoring,
      finalScore: Number(scoring?.finalScore || 0),
      whyThis: Array.isArray(scoring?.reasons) ? scoring.reasons : [],
      reasonLabel: String(scoring?.reasons?.[0] || ""),
      representativeStory: serializedStory,
      primarySourceSlug: String(
        representativeStory?.sourceSlug || cluster?.sourceSlugs?.[0] || ""
      ),
      isSaved: Boolean(serializedStory?.isSaved),
    };
  });
};

const enrichStoryCards = async (stories = [], context = {}) => {
  const storyIds = stories.map((entry) => entry?._id).filter(Boolean);
  const assetsByStoryId = await loadStoryAssets(storyIds);

  return stories.map((storyDoc) => {
    const story = attachAssetsToStory(
      storyDoc?.toObject ? storyDoc.toObject() : storyDoc,
      assetsByStoryId
    );
    const sourceDoc = storyDoc?.sourceId || story?.sourceId || null;
    const scoring = scoreStory(story, {
      source: sourceDoc,
      user: context?.user,
      preferences: context?.preferences,
      userGeo: context?.userGeo,
      engagement: context?.engagementByStory?.get(String(story?._id || "")) || {},
      exposure: buildStoryExposure(story, context?.exposureMaps),
      signals: context?.signals,
    });
    const serializedStory = serializeStory(story, {
      source: sourceDoc,
      savedArticleIds: context?.savedArticleIds || new Set(),
    });

    return {
      id: String(story?._id || ""),
      storyId: String(story?._id || ""),
      clusterId: String(story?.clusterId || ""),
      cardType: "story",
      title: String(story?.title || ""),
      summary: String(story?.summaryText || ""),
      articleType: String(story?.articleType || "report"),
      topicTags: Array.isArray(story?.topicTags) ? story.topicTags : [],
      geography: story?.geography || {},
      storyCount: 1,
      sourceCount: 1,
      sourceSlugs: [String(story?.sourceSlug || "")].filter(Boolean),
      rights: story?.rights || {},
      moderation: story?.moderation || {},
      scoring,
      finalScore: Number(scoring?.finalScore || 0),
      whyThis: Array.isArray(scoring?.reasons) ? scoring.reasons : [],
      reasonLabel: String(scoring?.reasons?.[0] || ""),
      representativeStory: serializedStory,
      primarySourceSlug: String(story?.sourceSlug || ""),
      isSaved: Boolean(serializedStory?.isSaved),
    };
  });
};

const buildEngagementMaps = async ({ clusterIds = [], storyIds = [] } = {}) => {
  const or = [];
  const clusterObjectIds = (Array.isArray(clusterIds) ? clusterIds : [])
    .filter(Boolean)
    .filter(isValidId)
    .map((entry) => new mongoose.Types.ObjectId(entry));
  const storyObjectIds = (Array.isArray(storyIds) ? storyIds : [])
    .filter(Boolean)
    .filter(isValidId)
    .map((entry) => new mongoose.Types.ObjectId(entry));

  if (clusterObjectIds.length) {
    or.push({ clusterId: { $in: clusterObjectIds } });
  }
  if (storyObjectIds.length) {
    or.push({ storyId: { $in: storyObjectIds } });
  }
  if (!or.length) {
    return {
      engagementByCluster: new Map(),
      engagementByStory: new Map(),
    };
  }

  const rows = await NewsFeedImpression.aggregate([
    {
      $match: {
        $or: or,
        createdAt: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      },
    },
    {
      $group: {
        _id: { clusterId: "$clusterId", storyId: "$storyId", action: "$action" },
        count: { $sum: 1 },
      },
    },
  ]);

  const engagementByCluster = new Map();
  const engagementByStory = new Map();

  for (const row of rows) {
    const clusterId = row?._id?.clusterId ? String(row._id.clusterId) : "";
    const storyId = row?._id?.storyId ? String(row._id.storyId) : "";
    const action = String(row?._id?.action || "impression");
    const count = Number(row?.count || 0);

    if (clusterId) {
      if (!engagementByCluster.has(clusterId)) {
        engagementByCluster.set(clusterId, {
          impressions: 0,
          opens: 0,
          clicks: 0,
          reports: 0,
          hides: 0,
        });
      }
      const bucket = engagementByCluster.get(clusterId);
      if (action === "open") bucket.opens += count;
      else if (action === "click") bucket.clicks += count;
      else if (action === "report") bucket.reports += count;
      else if (action === "hide") bucket.hides += count;
      else bucket.impressions += count;
    }

    if (storyId) {
      if (!engagementByStory.has(storyId)) {
        engagementByStory.set(storyId, {
          impressions: 0,
          opens: 0,
          clicks: 0,
          reports: 0,
          hides: 0,
        });
      }
      const bucket = engagementByStory.get(storyId);
      if (action === "open") bucket.opens += count;
      else if (action === "click") bucket.clicks += count;
      else if (action === "report") bucket.reports += count;
      else if (action === "hide") bucket.hides += count;
      else bucket.impressions += count;
    }
  }

  return { engagementByCluster, engagementByStory };
};

const filterByPreferences = (cards = [], preferences = {}) => {
  const hiddenStoryIds = new Set(
    (Array.isArray(preferences?.hiddenStoryIds) ? preferences.hiddenStoryIds : [])
      .map((entry) => String(entry || ""))
      .filter(Boolean)
  );
  const hiddenClusterIds = new Set(
    (Array.isArray(preferences?.hiddenClusterIds) ? preferences.hiddenClusterIds : [])
      .map((entry) => String(entry || ""))
      .filter(Boolean)
  );
  const blockedTopics = new Set(
    (Array.isArray(preferences?.blockedTopicSlugs) ? preferences.blockedTopicSlugs : [])
      .map((entry) => normalizeSlug(entry))
      .filter(Boolean)
  );

  return (Array.isArray(cards) ? cards : []).filter((card) => {
    if (hiddenStoryIds.has(String(card?.storyId || ""))) {
      return false;
    }
    if (hiddenClusterIds.has(String(card?.clusterId || ""))) {
      return false;
    }
    const topics = Array.isArray(card?.topicTags) ? card.topicTags : [];
    if (topics.some((entry) => blockedTopics.has(normalizeSlug(entry)))) {
      return false;
    }
    return true;
  });
};

const hasRequiredAttribution = (story = {}) => {
  const source = story?.source || null;
  const attributionRequired = source?.attribution?.attributionRequired !== false;
  const canonicalRequired = source?.attribution?.canonicalLinkRequired !== false;

  if (!source?.displayName && !source?.publisherName) {
    return false;
  }
  if (attributionRequired && !String(source?.displayName || source?.publisherName || "").trim()) {
    return false;
  }
  if (canonicalRequired && !String(story?.canonicalUrl || "").trim()) {
    return false;
  }
  return true;
};

const isCardDisplayable = (card = {}) => {
  const story = card?.representativeStory || null;
  if (!story || !hasRequiredAttribution(story)) {
    return false;
  }
  if (Number(story?.trustScore || 0) < 0.45) {
    return false;
  }
  if (!story?.source || story?.source?.isBlocked) {
    return false;
  }
  return true;
};

const dedupeByCanonicalUrl = (cards = []) => {
  const seen = new Set();
  const deduped = [];

  for (const card of cards) {
    const canonical = String(card?.representativeStory?.canonicalUrl || "").trim();
    const key = canonical || `${card?.cardType}:${card?.id}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(card);
  }

  return deduped;
};

const buildHighlightPayload = async ({ userId = "", tab = "for-you" } = {}) => {
  const [topics, trustedSources] = await Promise.all([
    getNewsTopics({ userId, limit: tab === "local" ? 6 : 8 }),
    getTrustedSourceStrip({ limit: 6 }),
  ]);

  return {
    topics,
    trustedSources,
  };
};

const buildFeedMeta = ({ tab = "for-you", userGeo = {} } = {}) => {
  const meta = TAB_META[tab] || TAB_META["for-you"];
  const locationLabel =
    normalizeWhitespace(userGeo?.city || "") ||
    normalizeWhitespace(userGeo?.state || "") ||
    normalizeWhitespace(userGeo?.country || "") ||
    "your area";

  return {
    tab,
    ...meta,
    locationLabel,
  };
};

const buildNewsFeed = async ({
  userId = "",
  tab = "for-you",
  cursor = "",
  limit = DEFAULT_PAGE_SIZE,
  topicSlug = "",
  sourceSlug = "",
  country = "",
  state = "",
  city = "",
} = {}) => {
  const pageSize = normalizeLimit(limit);
  const offset = normalizeOffset(cursor);
  const queryContext = await buildQueryContext(userId);
  const exposureMaps = await buildExposureMaps(userId);
  const candidateLimit = Math.max(DEFAULT_CANDIDATE_SIZE, (offset + pageSize) * 4);

  const geoCountry = country || (tab === "local" ? queryContext?.userGeo?.country || "Nigeria" : "");
  const geoState = state || (tab === "local" ? queryContext?.userGeo?.state || "" : "");
  const geoCity = city || (tab === "local" ? queryContext?.userGeo?.city || "" : "");

  const clusterQuery = buildClusterMongoQuery({
    tab,
    topicSlug,
    sourceSlug,
    country: geoCountry,
    state: geoState,
    city: geoCity,
  });

  const clusters = await NewsCluster.find(clusterQuery)
    .sort({ "scoring.finalScore": -1, lastPublishedAt: -1 })
    .limit(candidateLimit)
    .populate({
      path: "representativeStoryId",
      populate: { path: "sourceId" },
    });

  let cards = [];
  if (clusters.length) {
    const clusterIds = clusters.map((entry) => String(entry._id || ""));
    const storyIds = clusters
      .map((entry) => entry?.representativeStoryId?._id)
      .filter(Boolean)
      .map((entry) => String(entry));
    const engagement = await buildEngagementMaps({ clusterIds, storyIds });
    cards = await enrichClusterCards(clusters, {
      ...queryContext,
      ...engagement,
      exposureMaps,
    });
  } else {
    const stories = await NewsStory.find(
      buildStoryMongoQuery({
        tab,
        topicSlug,
        sourceSlug,
        country: geoCountry,
        state: geoState,
        city: geoCity,
      })
    )
      .sort({ "scoring.finalScore": -1, publishedAt: -1 })
      .limit(candidateLimit)
      .populate("sourceId");
    const storyIds = stories.map((entry) => String(entry._id || ""));
    const engagement = await buildEngagementMaps({ storyIds });
    cards = await enrichStoryCards(stories, {
      ...queryContext,
      ...engagement,
      exposureMaps,
    });
  }

  const filteredCards = dedupeByCanonicalUrl(
    filterByPreferences(cards, queryContext?.preferences || {}).filter(isCardDisplayable)
  );

  const diversityOptionsByTab = {
    "for-you": { sourceCap: 3, topicCap: 4, localTarget: 2, internationalTarget: 2 },
    local: { sourceCap: 2, topicCap: 4, localTarget: 5, internationalTarget: 0 },
    nigeria: { sourceCap: 3, topicCap: 5, localTarget: 4, internationalTarget: 0 },
    world: { sourceCap: 2, topicCap: 4, localTarget: 0, internationalTarget: 5 },
  };
  const selectedCards = applyFeedDiversity(filteredCards, {
    limit: candidateLimit,
    ...(diversityOptionsByTab[tab] || diversityOptionsByTab["for-you"]),
  });

  const pageCards = selectedCards.slice(offset, offset + pageSize);
  const nextOffset = offset + pageCards.length;
  const hasMore = nextOffset < selectedCards.length;
  const highlights = await buildHighlightPayload({ userId, tab });

  return {
    tab,
    pageSize,
    cursor: cursor || "",
    nextCursor: hasMore
      ? encodeCursor({ offset: nextOffset, tab, topicSlug, sourceSlug })
      : "",
    hasMore,
    meta: buildFeedMeta({ tab, userGeo: queryContext?.userGeo || {} }),
    highlights,
    savedArticleIds: [...(queryContext?.savedArticleIds || new Set())],
    cards: pageCards,
  };
};

const getStoryDetail = async (storyId, { userId = "" } = {}) => {
  if (!isValidId(storyId)) {
    return null;
  }

  const storyDoc = await NewsStory.findOne({
    _id: storyId,
    "moderation.status": { $in: PUBLIC_STATUSES },
  }).populate("sourceId");
  if (!storyDoc) {
    return null;
  }

  const savedArticleIds = await getSavedArticleIdsForUser(userId);
  const assetsByStoryId = await loadStoryAssets([storyDoc._id]);
  const story = attachAssetsToStory(storyDoc.toObject(), assetsByStoryId);
  return serializeStory(story, { source: storyDoc.sourceId, savedArticleIds });
};

const getClusterDetail = async (clusterId, { userId = "" } = {}) => {
  if (!isValidId(clusterId)) {
    return null;
  }

  const clusterDoc = await NewsCluster.findOne({
    _id: clusterId,
    "moderation.status": { $in: PUBLIC_STATUSES },
  }).lean();
  if (!clusterDoc) {
    return null;
  }

  const stories = await NewsStory.find({
    _id: { $in: clusterDoc.storyIds || [] },
    "moderation.status": { $in: PUBLIC_STATUSES },
  })
    .sort({ publishedAt: -1 })
    .populate("sourceId");

  const savedArticleIds = await getSavedArticleIdsForUser(userId);
  const assetsByStoryId = await loadStoryAssets(stories.map((entry) => entry._id));
  const serializedStories = stories
    .map((storyDoc) =>
      serializeStory(attachAssetsToStory(storyDoc.toObject(), assetsByStoryId), {
        source: storyDoc.sourceId,
        savedArticleIds,
      })
    )
    .filter(hasRequiredAttribution);

  return {
    id: String(clusterDoc._id || ""),
    clusterId: String(clusterDoc._id || ""),
    title: String(clusterDoc.title || ""),
    summary: String(clusterDoc.summary || ""),
    topicTags: Array.isArray(clusterDoc.topicTags) ? clusterDoc.topicTags : [],
    geography: clusterDoc.geography || {},
    storyCount: Number(clusterDoc.storyCount || serializedStories.length || 1),
    sourceCount: Number(clusterDoc.sourceCount || 1),
    rights: clusterDoc.rights || {},
    moderation: clusterDoc.moderation || {},
    scoring: clusterDoc.scoring || {},
    stories: serializedStories,
    representativeStoryId: String(clusterDoc.representativeStoryId || ""),
  };
};

const getSourceProfile = async (slug = "") => {
  const source = await NewsSource.findOne({
    slug: normalizeSlug(slug),
    isActive: true,
    isBlocked: { $ne: true },
  }).lean();
  if (!source) {
    return null;
  }
  return serializeSource(source);
};

module.exports = {
  buildNewsFeed,
  getStoryDetail,
  getClusterDetail,
  getSourceProfile,
};
