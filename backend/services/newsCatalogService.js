const NewsSource = require("../models/NewsSource");
const NewsTopic = require("../models/NewsTopic");
const { NEWS_SOURCE_CATALOG } = require("../config/newsSources");
const { NEWS_TOPIC_CATALOG } = require("../config/newsTopics");

const syncNewsSourceCatalog = async () => {
  for (const entry of NEWS_SOURCE_CATALOG) {
    await NewsSource.findOneAndUpdate(
      { slug: entry.slug },
      { $set: entry },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
};

const syncNewsTopicCatalog = async () => {
  for (const entry of NEWS_TOPIC_CATALOG) {
    await NewsTopic.findOneAndUpdate(
      { slug: entry.slug },
      { $set: entry },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
};

const syncNewsCatalog = async () => {
  await Promise.all([syncNewsSourceCatalog(), syncNewsTopicCatalog()]);
};

const getTrustedSourceStrip = async ({ limit = 8 } = {}) => {
  const docs = await NewsSource.find({
    isActive: true,
    isBlocked: { $ne: true },
    trustScore: { $gte: 0.75 },
  })
    .sort({ trustScore: -1, updatedAt: -1 })
    .limit(Math.max(1, Number(limit) || 8))
    .lean();

  return docs.map((source) => ({
    id: String(source._id || ""),
    slug: String(source.slug || ""),
    displayName: String(source.displayName || ""),
    publisherName: String(source.publisherName || ""),
    logoUrl: String(source.logoUrl || ""),
    publisherTier: String(source.publisherTier || "partner"),
    trustScore: Number(source.trustScore || 0),
    verificationStatus: String(source.verificationStatus || "reviewed"),
    licenseType: String(source.licenseType || "official_rss"),
    useNotes: String(source.useNotes || ""),
  }));
};

module.exports = {
  NEWS_SOURCE_CATALOG,
  NEWS_TOPIC_CATALOG,
  syncNewsCatalog,
  syncNewsSourceCatalog,
  syncNewsTopicCatalog,
  getTrustedSourceStrip,
};
