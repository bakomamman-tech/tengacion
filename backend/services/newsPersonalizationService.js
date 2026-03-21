const mongoose = require("mongoose");
const NewsFeedImpression = require("../models/NewsFeedImpression");
const { getSavedTopicInsights } = require("./newsSavedService");
const { normalizeSlug } = require("./newsNormalizeService");

const isValidId = (value) => mongoose.Types.ObjectId.isValid(value);

const addWeight = (map, key, weight) => {
  const slug = normalizeSlug(key);
  if (!slug || !Number.isFinite(weight)) {
    return;
  }
  map.set(slug, (map.get(slug) || 0) + weight);
};

const buildPersonalizationSignals = async ({ userId = "", preferences = null } = {}) => {
  if (!isValidId(userId)) {
    return {
      topicWeights: new Map(),
      sourceWeights: new Map(),
      savedStoryIds: new Set(),
      readStoryIds: new Set(),
    };
  }

  const [saved, impressions] = await Promise.all([
    getSavedTopicInsights(userId),
    NewsFeedImpression.find({
      userId,
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    })
      .sort({ createdAt: -1 })
      .limit(400)
      .lean(),
  ]);

  const topicWeights = new Map(saved.topicWeights);
  const sourceWeights = new Map(saved.sourceWeights);
  const readStoryIds = new Set();

  const actionWeight = {
    impression: 0.08,
    open: 0.9,
    click: 1.2,
    save: 1.6,
    share: 1.1,
  };

  for (const impression of impressions) {
    const weight = actionWeight[String(impression?.action || "impression")] || 0.05;
    addWeight(sourceWeights, impression?.sourceSlug || "", weight);

    for (const topic of Array.isArray(impression?.topicTags) ? impression.topicTags : []) {
      addWeight(topicWeights, topic, weight);
    }

    const storyId = String(impression?.storyId || "");
    if (storyId && ["open", "click", "save", "share"].includes(String(impression?.action || ""))) {
      readStoryIds.add(storyId);
    }
  }

  for (const topic of Array.isArray(preferences?.preferredTopics) ? preferences.preferredTopics : []) {
    addWeight(topicWeights, topic, 2);
  }
  for (const topic of Array.isArray(preferences?.followedTopicSlugs) ? preferences.followedTopicSlugs : []) {
    addWeight(topicWeights, topic, 2.4);
  }
  for (const source of Array.isArray(preferences?.followedSourceSlugs) ? preferences.followedSourceSlugs : []) {
    addWeight(sourceWeights, source, 2.2);
  }

  return {
    topicWeights,
    sourceWeights,
    savedStoryIds: saved.savedStoryIds,
    readStoryIds,
  };
};

module.exports = {
  buildPersonalizationSignals,
};
