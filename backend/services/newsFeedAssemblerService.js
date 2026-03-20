const mongoose = require("mongoose");
const NewsAsset = require("../models/NewsAsset");
const NewsCluster = require("../models/NewsCluster");
const NewsFeedImpression = require("../models/NewsFeedImpression");
const NewsSource = require("../models/NewsSource");
const NewsStory = require("../models/NewsStory");
const NewsUserPreference = require("../models/NewsUserPreference");
const User = require("../models/User");
const { enforceStoryRights } = require("./newsRightsService");
const { buildUserGeoProfile } = require("./newsGeoService");
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
  attribution: {
    attributionRequired: source?.attribution?.attributionRequired !== false,
    canonicalLinkRequired: source?.attribution?.canonicalLinkRequired !== false,
    copyrightLine: String(source?.attribution?.copyrightLine || ""),
  },
});

const serializeStory = (story = {}, { source = null } = {}) => {
  const safeStory = enforceStoryRights(story, { source });
  const primaryAsset = pickPrimaryAsset(story);

  return {
    id: String(story?._id || ""),
    clusterId: String(story?.clusterId || ""),
    sourceSlug: String(story?.sourceSlug || source?.slug || ""),
    title: String(safeStory?.title || ""),
    subtitle: String(safeStory?.subtitle || ""),
    bodyHtml: String(safeStory?.bodyHtml || ""),
    summaryText: String(safeStory?.summaryText || ""),
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
    scoring: safeStory?.scoring || {},
    source: source ? serializeSource(source) : null,
    media: primaryAsset ? normalizeAssetDoc(primaryAsset) : null,
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

const buildExposureMap = async (userId) => {
  if (!userId || !isValidId(userId)) {
    return new Map();
  }

  const impressions = await NewsFeedImpression.find({
    userId,
    createdAt: { $gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
  })
    .sort({ createdAt: -1 })
    .limit(300)
    .lean();

  const map = new Map();
  for (const impression of impressions) {
    const storyId = String(impression?.storyId || "");
    if (!storyId) {
      continue;
    }
    if (!map.has(storyId)) {
      map.set(storyId, {
        sameStoryImpressions: 0,
        recentSourceImpressions: 0,
        recentTopicImpressions: 0,
      });
    }
    map.get(storyId).sameStoryImpressions += 1;
  }

  return map;
};

const buildQueryContext = async (userId) => {
  if (!userId || !isValidId(userId)) {
    return {
      user: null,
      preferences: null,
      userGeo: { country: "Nigeria", state: "", city: "" },
    };
  }

  const [user, preferences] = await Promise.all([
    User.findById(userId).select("_id country currentCity state interests").lean(),
    NewsUserPreference.findOne({ userId }).lean(),
  ]);

  return {
    user,
    preferences,
    userGeo: buildUserGeoProfile(user || {}, preferences || {}),
  };
};

const buildClusterMongoQuery = ({
  tab = "for-you",
  topicSlug = "",
  sourceSlug = "",
  country = "",
  state = "",
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

  const normalizedCountry = normalizeWhitespace(country);
  const normalizedState = normalizeWhitespace(state);

  if (tab === "world") {
    query["geography.scope"] = "international";
  } else if (tab === "nigeria") {
    query["geography.primaryCountry"] = "Nigeria";
  } else if (tab === "local") {
    if (normalizedCountry) {
      query["geography.countries"] = normalizedCountry;
    }
    if (normalizedState) {
      query["geography.states"] = normalizedState;
    }
  }

  return query;
};

const buildStoryMongoQuery = ({
  tab = "for-you",
  topicSlug = "",
  sourceSlug = "",
  country = "",
  state = "",
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

  const normalizedCountry = normalizeWhitespace(country);
  const normalizedState = normalizeWhitespace(state);

  if (tab === "world") {
    query["geography.scope"] = "international";
  } else if (tab === "nigeria") {
    query["geography.primaryCountry"] = "Nigeria";
  } else if (tab === "local") {
    if (normalizedCountry) {
      query["geography.countries"] = normalizedCountry;
    }
    if (normalizedState) {
      query["geography.states"] = normalizedState;
    }
  }

  return query;
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
      exposure: context?.exposureByStory?.get(String(representativeStory?._id || "")) || {},
    });

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
      representativeStory: representativeStory
        ? serializeStory(representativeStory, { source: sourceDoc })
        : null,
      primarySourceSlug: String(
        representativeStory?.sourceSlug || cluster?.sourceSlugs?.[0] || ""
      ),
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
      exposure: context?.exposureByStory?.get(String(story?._id || "")) || {},
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
      representativeStory: serializeStory(story, { source: sourceDoc }),
      primarySourceSlug: String(story?.sourceSlug || ""),
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

const buildNewsFeed = async ({
  userId = "",
  tab = "for-you",
  cursor = "",
  limit = DEFAULT_PAGE_SIZE,
  topicSlug = "",
  sourceSlug = "",
  country = "",
  state = "",
} = {}) => {
  const pageSize = normalizeLimit(limit);
  const offset = normalizeOffset(cursor);
  const queryContext = await buildQueryContext(userId);
  const exposureByStory = await buildExposureMap(userId);
  const candidateLimit = Math.max(DEFAULT_CANDIDATE_SIZE, (offset + pageSize) * 4);

  const clusterQuery = buildClusterMongoQuery({
    tab,
    topicSlug,
    sourceSlug,
    country: country || (tab === "local" ? queryContext?.userGeo?.country || "Nigeria" : ""),
    state: state || (tab === "local" ? queryContext?.userGeo?.state || "" : ""),
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
      exposureByStory,
    });
  } else {
    const stories = await NewsStory.find(
      buildStoryMongoQuery({
        tab,
        topicSlug,
        sourceSlug,
        country: country || (tab === "local" ? queryContext?.userGeo?.country || "Nigeria" : ""),
        state: state || (tab === "local" ? queryContext?.userGeo?.state || "" : ""),
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
      exposureByStory,
    });
  }

  const filteredCards = cards.filter((card) => card?.representativeStory);
  const selectedCards = applyFeedDiversity(filteredCards, {
    limit: candidateLimit,
    sourceCap: 3,
    topicCap: 5,
    localTarget: 2,
    internationalTarget: 2,
  });

  const pageCards = selectedCards.slice(offset, offset + pageSize);
  const nextOffset = offset + pageCards.length;
  const hasMore = nextOffset < selectedCards.length;

  return {
    tab,
    pageSize,
    cursor: cursor || "",
    nextCursor: hasMore
      ? encodeCursor({ offset: nextOffset, tab, topicSlug, sourceSlug })
      : "",
    hasMore,
    cards: pageCards,
  };
};

const getStoryDetail = async (storyId) => {
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

  const assetsByStoryId = await loadStoryAssets([storyDoc._id]);
  const story = attachAssetsToStory(storyDoc.toObject(), assetsByStoryId);
  return serializeStory(story, { source: storyDoc.sourceId });
};

const getClusterDetail = async (clusterId) => {
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

  const assetsByStoryId = await loadStoryAssets(stories.map((entry) => entry._id));
  const serializedStories = stories.map((storyDoc) =>
    serializeStory(attachAssetsToStory(storyDoc.toObject(), assetsByStoryId), {
      source: storyDoc.sourceId,
    })
  );

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
  const source = await NewsSource.findOne({ slug: normalizeSlug(slug), isActive: true }).lean();
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
