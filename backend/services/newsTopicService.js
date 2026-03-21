const NewsStory = require("../models/NewsStory");
const NewsTopic = require("../models/NewsTopic");
const NewsUserPreference = require("../models/NewsUserPreference");
const { normalizeSlug } = require("./newsNormalizeService");

const mergeTopicCounts = (docs = [], countsBySlug = new Map(), followed = new Set()) =>
  docs.map((topic) => {
    const slug = normalizeSlug(topic?.slug || "");
    return {
      id: String(topic?._id || slug),
      slug,
      displayName: String(topic?.displayName || slug.replace(/-/g, " ")),
      category: String(topic?.category || "general"),
      summary: String(topic?.summary || ""),
      icon: String(topic?.icon || ""),
      regionScopes: Array.isArray(topic?.regionScopes) ? topic.regionScopes : [],
      isFeatured: Boolean(topic?.isFeatured),
      trustPriority: Number(topic?.trustPriority || 0.5),
      articleCount: Number(countsBySlug.get(slug) || 0),
      isFollowed: followed.has(slug),
    };
  });

const getNewsTopics = async ({ userId = "", limit = 12 } = {}) => {
  const [topics, counts, preferences] = await Promise.all([
    NewsTopic.find({}).sort({ isFeatured: -1, trustPriority: -1, displayName: 1 }).lean(),
    NewsStory.aggregate([
      {
        $match: {
          "moderation.status": { $in: ["approved", "limited"] },
          publishedAt: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
        },
      },
      { $unwind: "$topicTags" },
      { $group: { _id: "$topicTags", articleCount: { $sum: 1 } } },
      { $sort: { articleCount: -1 } },
      { $limit: Math.max(20, Number(limit) * 3 || 36) },
    ]),
    userId ? NewsUserPreference.findOne({ userId }).lean() : null,
  ]);

  const countsBySlug = new Map(
    counts.map((entry) => [normalizeSlug(entry?._id || ""), Number(entry?.articleCount || 0)])
  );
  const followed = new Set(
    (Array.isArray(preferences?.followedTopicSlugs) ? preferences.followedTopicSlugs : [])
      .map((entry) => normalizeSlug(entry))
      .filter(Boolean)
  );

  const merged = mergeTopicCounts(topics, countsBySlug, followed)
    .sort((left, right) => {
      if (Boolean(left.isFollowed) !== Boolean(right.isFollowed)) {
        return left.isFollowed ? -1 : 1;
      }
      if (Boolean(left.isFeatured) !== Boolean(right.isFeatured)) {
        return left.isFeatured ? -1 : 1;
      }
      return (
        Number(right.articleCount || 0) - Number(left.articleCount || 0) ||
        Number(right.trustPriority || 0) - Number(left.trustPriority || 0)
      );
    })
    .slice(0, Math.max(1, Number(limit) || 12));

  return merged;
};

module.exports = {
  getNewsTopics,
};
