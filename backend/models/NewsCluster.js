const mongoose = require("mongoose");
const {
  NEWS_ARTICLE_TYPES,
  createRightsSchema,
  createModerationSchema,
  createGeographySchema,
  createScoringSchema,
} = require("./newsSubschemas");

const NewsClusterSchema = new mongoose.Schema(
  {
    representativeStoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NewsStory",
      required: true,
      index: true,
    },
    storyIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "NewsStory" }],
      default: [],
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
      index: true,
    },
    summary: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1500,
    },
    topicTags: [{ type: String, trim: true, lowercase: true, maxlength: 80, index: true }],
    geography: {
      type: createGeographySchema(),
      default: () => ({}),
    },
    articleType: {
      type: String,
      enum: NEWS_ARTICLE_TYPES,
      default: "report",
      index: true,
    },
    storyCount: { type: Number, default: 1, min: 1 },
    sourceCount: { type: Number, default: 1, min: 1 },
    sourceSlugs: [{ type: String, trim: true, lowercase: true, maxlength: 80 }],
    importanceScore: { type: Number, default: 0, min: 0, max: 1 },
    freshnessScore: { type: Number, default: 0, min: 0, max: 1 },
    coverageDiversityScore: { type: Number, default: 0, min: 0, max: 1 },
    scoring: {
      type: createScoringSchema(),
      default: () => ({}),
    },
    rights: {
      type: createRightsSchema(),
      default: () => ({
        mode: "SUMMARY_PLUS_LINKOUT",
        attributionRequired: true,
        canonicalLinkRequired: true,
        allowBodyHtml: false,
        allowSummary: true,
        allowThumbnail: true,
        allowEmbed: false,
      }),
    },
    moderation: {
      type: createModerationSchema(),
      default: () => ({
        status: "approved",
        trustScore: 0.7,
        sourceTrustScore: 0.7,
      }),
    },
    lastPublishedAt: { type: Date, default: null, index: true },
    clusteringKey: { type: String, default: "", trim: true, maxlength: 220, index: true },
  },
  { timestamps: true }
);

NewsClusterSchema.index({ storyIds: 1 });
NewsClusterSchema.index({ "moderation.status": 1, lastPublishedAt: -1 });
NewsClusterSchema.index({ "scoring.finalScore": -1, lastPublishedAt: -1 });

NewsClusterSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("NewsCluster", NewsClusterSchema);
