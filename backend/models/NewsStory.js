const mongoose = require("mongoose");
const {
  NEWS_ARTICLE_TYPES,
  createRightsSchema,
  createModerationSchema,
  createGeographySchema,
  createScoringSchema,
  createAssetRefSchema,
} = require("./newsSubschemas");

const NewsStorySchema = new mongoose.Schema(
  {
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NewsSource",
      required: true,
      index: true,
    },
    publisherContractId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NewsPublisherContract",
      default: null,
      index: true,
    },
    clusterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NewsCluster",
      default: null,
      index: true,
    },
    sourceSlug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    externalId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    sourceUrlKey: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
      index: true,
    },
    normalizedTitle: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
      index: true,
    },
    subtitle: {
      type: String,
      default: "",
      trim: true,
      maxlength: 600,
    },
    bodyHtml: {
      type: String,
      default: "",
    },
    summaryText: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1500,
    },
    contentType: {
      type: String,
      enum: ["summary", "link", "explainer"],
      default: "summary",
      index: true,
    },
    canonicalUrl: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    publishedAt: {
      type: Date,
      required: true,
      index: true,
    },
    updatedAtSource: {
      type: Date,
      default: null,
      index: true,
    },
    authorByline: {
      type: String,
      default: "",
      trim: true,
      maxlength: 220,
    },
    language: {
      type: String,
      default: "en",
      trim: true,
      lowercase: true,
      maxlength: 12,
      index: true,
    },
    country: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
      index: true,
    },
    region: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
      index: true,
    },
    city: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
      index: true,
    },
    articleType: {
      type: String,
      enum: NEWS_ARTICLE_TYPES,
      default: "report",
      index: true,
    },
    trustScore: {
      type: Number,
      default: 0.7,
      min: 0,
      max: 1,
      index: true,
    },
    isBreaking: { type: Boolean, default: false, index: true },
    isOpinion: { type: Boolean, default: false, index: true },
    assetRefs: {
      type: [createAssetRefSchema()],
      default: [],
    },
    topicTags: [{ type: String, trim: true, lowercase: true, maxlength: 80, index: true }],
    namedEntities: [{ type: String, trim: true, maxlength: 120 }],
    geography: {
      type: createGeographySchema(),
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
        status: "pending",
        trustScore: 0.7,
        sourceTrustScore: 0.7,
      }),
    },
    scoring: {
      type: createScoringSchema(),
      default: () => ({}),
    },
    isDiscoveryOnly: { type: Boolean, default: false, index: true },
    ingestionKey: { type: String, default: "", trim: true, maxlength: 220, index: true },
    ingestedAt: { type: Date, default: Date.now, index: true },
    raw: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

NewsStorySchema.index({ sourceSlug: 1, externalId: 1 }, { unique: true });
NewsStorySchema.index({ sourceSlug: 1, canonicalUrl: 1 });
NewsStorySchema.index({ "moderation.status": 1, publishedAt: -1 });
NewsStorySchema.index({ "scoring.finalScore": -1, publishedAt: -1 });
NewsStorySchema.index({ "geography.scope": 1, publishedAt: -1 });

NewsStorySchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("NewsStory", NewsStorySchema);
