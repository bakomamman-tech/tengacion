const mongoose = require("mongoose");
const NewsStory = require("../models/NewsStory");
const UserSavedNews = require("../models/UserSavedNews");

const isValidId = (value) => mongoose.Types.ObjectId.isValid(value);

const getSavedArticleIdsForUser = async (userId = "") => {
  if (!isValidId(userId)) {
    return new Set();
  }

  const rows = await UserSavedNews.find({ userId }).select("articleId").lean();
  return new Set(rows.map((row) => String(row.articleId || "")).filter(Boolean));
};

const saveNewsArticleForUser = async ({ userId = "", articleId = "" } = {}) => {
  if (!isValidId(userId) || !isValidId(articleId)) {
    throw new Error("Valid userId and articleId are required");
  }

  const story = await NewsStory.findById(articleId).lean();
  if (!story) {
    const error = new Error("News article not found");
    error.statusCode = 404;
    throw error;
  }

  return UserSavedNews.findOneAndUpdate(
    { userId, articleId },
    {
      $setOnInsert: {
        userId,
        articleId,
        clusterId: story.clusterId || null,
        sourceSlug: story.sourceSlug || "",
        canonicalUrl: story.canonicalUrl || "",
        topicTags: Array.isArray(story.topicTags) ? story.topicTags : [],
        savedAt: new Date(),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

const removeSavedNewsArticleForUser = async ({ userId = "", articleId = "" } = {}) => {
  if (!isValidId(userId) || !isValidId(articleId)) {
    throw new Error("Valid userId and articleId are required");
  }

  const result = await UserSavedNews.findOneAndDelete({ userId, articleId });
  return Boolean(result);
};

const getSavedTopicInsights = async (userId = "") => {
  if (!isValidId(userId)) {
    return {
      topicWeights: new Map(),
      sourceWeights: new Map(),
      savedStoryIds: new Set(),
    };
  }

  const rows = await UserSavedNews.find({ userId })
    .sort({ savedAt: -1 })
    .limit(120)
    .lean();

  const topicWeights = new Map();
  const sourceWeights = new Map();
  const savedStoryIds = new Set();

  for (const row of rows) {
    const storyId = String(row.articleId || "");
    if (storyId) {
      savedStoryIds.add(storyId);
    }
    const sourceSlug = String(row.sourceSlug || "").trim().toLowerCase();
    if (sourceSlug) {
      sourceWeights.set(sourceSlug, (sourceWeights.get(sourceSlug) || 0) + 1.4);
    }
    for (const topic of Array.isArray(row.topicTags) ? row.topicTags : []) {
      const slug = String(topic || "").trim().toLowerCase();
      if (!slug) {
        continue;
      }
      topicWeights.set(slug, (topicWeights.get(slug) || 0) + 1.8);
    }
  }

  return {
    topicWeights,
    sourceWeights,
    savedStoryIds,
  };
};

module.exports = {
  getSavedArticleIdsForUser,
  saveNewsArticleForUser,
  removeSavedNewsArticleForUser,
  getSavedTopicInsights,
};
