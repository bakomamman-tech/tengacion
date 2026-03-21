const NewsComplaint = require("../models/NewsComplaint");
const NewsFeedImpression = require("../models/NewsFeedImpression");
const NewsUserPreference = require("../models/NewsUserPreference");
const asyncHandler = require("../middleware/asyncHandler");
const { saveNewsArticleForUser, removeSavedNewsArticleForUser } = require("../services/newsSavedService");
const { getNewsTopics } = require("../services/newsTopicService");
const {
  buildNewsFeed,
  getClusterDetail,
  getStoryDetail,
} = require("../services/newsFeedAssemblerService");
const { normalizeSlug, normalizeWhitespace } = require("../services/newsNormalizeService");

const ensurePreferencesDoc = async (userId) =>
  NewsUserPreference.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

const parseLimit = (value, fallback = 20) => {
  const limit = Number(value);
  if (!Number.isFinite(limit)) {
    return fallback;
  }
  return Math.max(1, Math.min(40, limit));
};

const normalizeStringArray = (value = []) =>
  (Array.isArray(value) ? value : [])
    .map((entry) => normalizeSlug(entry))
    .filter(Boolean);

const normalizeLocationArray = (value = []) =>
  (Array.isArray(value) ? value : [])
    .map((entry) => normalizeWhitespace(entry))
    .filter(Boolean);

const getFeed = asyncHandler(async (req, res) => {
  const tab = String(req.query.tab || "for-you").trim().toLowerCase();
  const payload = await buildNewsFeed({
    userId: req.user?.id || "",
    tab,
    cursor: String(req.query.cursor || ""),
    limit: parseLimit(req.query.limit, 20),
  });

  res.json(payload);
});

const getLocal = asyncHandler(async (req, res) => {
  const payload = await buildNewsFeed({
    userId: req.user?.id || "",
    tab: "local",
    cursor: String(req.query.cursor || ""),
    limit: parseLimit(req.query.limit, 20),
    country: String(req.query.country || ""),
    state: String(req.query.state || ""),
    city: String(req.query.city || ""),
  });

  res.json(payload);
});

const getWorld = asyncHandler(async (req, res) => {
  const payload = await buildNewsFeed({
    userId: req.user?.id || "",
    tab: "world",
    cursor: String(req.query.cursor || ""),
    limit: parseLimit(req.query.limit, 20),
  });

  res.json(payload);
});

const getTopic = asyncHandler(async (req, res) => {
  const payload = await buildNewsFeed({
    userId: req.user?.id || "",
    tab: String(req.query.tab || "for-you").trim().toLowerCase(),
    cursor: String(req.query.cursor || ""),
    limit: parseLimit(req.query.limit, 20),
    topicSlug: req.params.slug,
  });

  res.json({
    topic: normalizeSlug(req.params.slug),
    ...payload,
  });
});

const getCluster = asyncHandler(async (req, res) => {
  const cluster = await getClusterDetail(req.params.clusterId, {
    userId: req.user?.id || "",
  });
  if (!cluster) {
    return res.status(404).json({ error: "Cluster not found" });
  }
  return res.json(cluster);
});

const getStory = asyncHandler(async (req, res) => {
  const story = await getStoryDetail(req.params.storyId, {
    userId: req.user?.id || "",
  });
  if (!story) {
    return res.status(404).json({ error: "Story not found" });
  }
  return res.json(story);
});

const getTopics = asyncHandler(async (req, res) => {
  const topics = await getNewsTopics({
    userId: req.user?.id || "",
    limit: parseLimit(req.query.limit, 12),
  });

  return res.json({ topics });
});

const getPreferences = asyncHandler(async (req, res) => {
  const preferences = await ensurePreferencesDoc(req.user.id);
  return res.json({ preferences });
});

const updatePreferences = asyncHandler(async (req, res) => {
  const prefs = await ensurePreferencesDoc(req.user.id);
  const payload = req.body && typeof req.body === "object" ? req.body : {};

  if (payload.preferredTopics) {
    prefs.preferredTopics = normalizeStringArray(payload.preferredTopics);
  }
  if (payload.blockedTopics) {
    prefs.blockedTopicSlugs = normalizeStringArray(payload.blockedTopics);
  }
  if (payload.preferredRegions) {
    prefs.preferredRegions = normalizeStringArray(payload.preferredRegions);
  }
  if (payload.followedSources) {
    prefs.followedSourceSlugs = normalizeStringArray(payload.followedSources);
  }
  if (payload.followedTopics) {
    prefs.followedTopicSlugs = normalizeStringArray(payload.followedTopics);
  }
  if (payload.preferredCountries) {
    prefs.preferredCountries = normalizeLocationArray(payload.preferredCountries);
  }
  if (payload.preferredStates) {
    prefs.preferredStates = normalizeLocationArray(payload.preferredStates);
  }
  if (payload.preferredCities) {
    prefs.preferredCities = normalizeLocationArray(payload.preferredCities);
  }
  if (payload.preferredLanguage !== undefined) {
    prefs.preferredLanguage = String(payload.preferredLanguage || "en").trim().toLowerCase() || "en";
  }
  if (payload.personalizationEnabled !== undefined) {
    prefs.personalizationEnabled = Boolean(payload.personalizationEnabled);
  }
  if (payload.localBoostEnabled !== undefined) {
    prefs.localBoostEnabled = Boolean(payload.localBoostEnabled);
  }
  if (payload.worldBoostEnabled !== undefined) {
    prefs.worldBoostEnabled = Boolean(payload.worldBoostEnabled);
  }

  await prefs.save();
  return res.json({ success: true, preferences: prefs });
});

const saveArticle = asyncHandler(async (req, res) => {
  const saved = await saveNewsArticleForUser({
    userId: req.user.id,
    articleId: req.params.articleId,
  });

  await NewsFeedImpression.create({
    userId: req.user.id,
    surface: "news",
    feedTab: String(req.body?.feedTab || "for-you").trim().toLowerCase(),
    cardType: "story",
    storyId: saved.articleId,
    clusterId: saved.clusterId || null,
    sourceSlug: saved.sourceSlug || "",
    topicTags: Array.isArray(saved.topicTags) ? saved.topicTags : [],
    action: "save",
  });

  return res.status(201).json({
    success: true,
    saved: {
      articleId: String(saved.articleId || ""),
      savedAt: saved.savedAt,
    },
  });
});

const removeSavedArticle = asyncHandler(async (req, res) => {
  const removed = await removeSavedNewsArticleForUser({
    userId: req.user.id,
    articleId: req.params.articleId,
  });

  return res.json({
    success: true,
    removed,
    articleId: String(req.params.articleId || ""),
  });
});

const postImpression = asyncHandler(async (req, res) => {
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const impression = await NewsFeedImpression.create({
    userId: req.user.id,
    sessionId: String(payload.sessionId || "").trim(),
    surface: String(payload.surface || "news").trim().toLowerCase(),
    feedTab: String(payload.feedTab || "for-you").trim().toLowerCase(),
    cursor: String(payload.cursor || "").trim(),
    requestId: String(payload.requestId || "").trim(),
    cardType: String(payload.cardType || "story").trim().toLowerCase(),
    storyId: payload.storyId || null,
    clusterId: payload.clusterId || null,
    sourceSlug: normalizeSlug(payload.sourceSlug || ""),
    topicTags: Array.isArray(payload.topicTags)
      ? payload.topicTags.map((entry) => normalizeSlug(entry)).filter(Boolean)
      : [],
    position: Number(payload.position || 0),
    action: String(payload.action || "impression").trim().toLowerCase(),
    dwellMs: Number(payload.dwellMs || 0),
    metadata: payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {},
  });

  return res.status(201).json({ success: true, impressionId: impression._id });
});

const hidePreference = asyncHandler(async (req, res) => {
  const prefs = await ensurePreferencesDoc(req.user.id);
  const storyId = String(req.body?.storyId || "").trim();
  const clusterId = String(req.body?.clusterId || "").trim();
  const topicSlug = normalizeSlug(req.body?.topicSlug || "");

  if (!storyId && !clusterId && !topicSlug) {
    return res.status(400).json({ error: "storyId, clusterId, or topicSlug is required" });
  }

  if (storyId && !prefs.hiddenStoryIds.some((entry) => String(entry) === storyId)) {
    prefs.hiddenStoryIds.push(storyId);
  }
  if (clusterId && !prefs.hiddenClusterIds.some((entry) => String(entry) === clusterId)) {
    prefs.hiddenClusterIds.push(clusterId);
  }
  if (topicSlug && !prefs.blockedTopicSlugs.includes(topicSlug)) {
    prefs.blockedTopicSlugs.push(topicSlug);
  }

  await prefs.save();
  return res.json({ success: true, preferences: prefs });
});

const followSource = asyncHandler(async (req, res) => {
  const sourceSlug = normalizeSlug(req.body?.sourceSlug || "");
  const follow = req.body?.follow !== false;
  if (!sourceSlug) {
    return res.status(400).json({ error: "sourceSlug is required" });
  }

  const prefs = await ensurePreferencesDoc(req.user.id);
  const current = new Set(
    (Array.isArray(prefs.followedSourceSlugs) ? prefs.followedSourceSlugs : [])
      .map((entry) => normalizeSlug(entry))
      .filter(Boolean)
  );

  if (follow) {
    current.add(sourceSlug);
  } else {
    current.delete(sourceSlug);
  }

  prefs.followedSourceSlugs = [...current];
  await prefs.save();

  return res.json({
    success: true,
    sourceSlug,
    following: follow,
    preferences: prefs,
  });
});

const report = asyncHandler(async (req, res) => {
  const storyId = String(req.body?.storyId || "").trim();
  const clusterId = String(req.body?.clusterId || "").trim();
  const reason = normalizeWhitespace(req.body?.reason || "");
  if (!storyId && !clusterId) {
    return res.status(400).json({ error: "storyId or clusterId is required" });
  }
  if (!reason) {
    return res.status(400).json({ error: "reason is required" });
  }

  const complaint = await NewsComplaint.create({
    userId: req.user.id,
    storyId: storyId || null,
    clusterId: clusterId || null,
    reason,
    details: normalizeWhitespace(req.body?.details || ""),
    sensitiveFlags: Array.isArray(req.body?.sensitiveFlags)
      ? req.body.sensitiveFlags.map((entry) => String(entry || "").trim()).filter(Boolean)
      : [],
    metadata: req.body?.metadata && typeof req.body.metadata === "object" ? req.body.metadata : {},
  });

  return res.status(201).json({ success: true, complaintId: complaint._id });
});

module.exports = {
  getFeed,
  getLocal,
  getWorld,
  getTopic,
  getTopics,
  getPreferences,
  updatePreferences,
  saveArticle,
  removeSavedArticle,
  getCluster,
  getStory,
  postImpression,
  hidePreference,
  followSource,
  report,
};
