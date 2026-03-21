const mongoose = require("mongoose");
const {
  createAttributionSchema,
  createModerationSchema,
} = require("./newsSubschemas");

const NewsSourceSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    publisherName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
    },
    providerType: {
      type: String,
      enum: ["reuters", "ap", "guardian", "gdelt", "partner_rss", "custom"],
      required: true,
      index: true,
    },
    publisherTier: {
      type: String,
      enum: ["licensed", "partner", "discovery"],
      default: "discovery",
      index: true,
    },
    sourceType: {
      type: String,
      enum: ["wire", "publisher", "aggregator", "government", "ngo", "local"],
      default: "publisher",
    },
    homepageUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    canonicalDomain: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 255,
      index: true,
    },
    logoUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    defaultLanguage: {
      type: String,
      default: "en",
      trim: true,
      lowercase: true,
      maxlength: 12,
      index: true,
    },
    countries: [{ type: String, trim: true, maxlength: 120 }],
    states: [{ type: String, trim: true, maxlength: 120 }],
    topicTags: [{ type: String, trim: true, lowercase: true, maxlength: 80 }],
    categoryCoverage: [{ type: String, trim: true, lowercase: true, maxlength: 80 }],
    preferredTabs: [{ type: String, trim: true, lowercase: true, maxlength: 40 }],
    supportedRegions: [{ type: String, trim: true, maxlength: 120 }],
    discoveryOnly: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
    isBlocked: { type: Boolean, default: false, index: true },
    trustScore: { type: Number, default: 0.7, min: 0, max: 1, index: true },
    verificationStatus: {
      type: String,
      enum: ["verified", "reviewed", "discovery"],
      default: "reviewed",
    },
    licenseType: {
      type: String,
      enum: ["licensed_api", "official_rss", "public_domain", "in_house", "discovery"],
      default: "official_rss",
      index: true,
    },
    licenseNotes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 800,
    },
    useNotes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 800,
    },
    attribution: {
      type: createAttributionSchema(),
      default: () => ({}),
    },
    ingest: {
      apiBaseUrl: { type: String, default: "", trim: true, maxlength: 500 },
      rssUrl: { type: String, default: "", trim: true, maxlength: 500 },
      envKey: { type: String, default: "", trim: true, maxlength: 80 },
      envSecret: { type: String, default: "", trim: true, maxlength: 80 },
      enabled: { type: Boolean, default: true },
      schedule: { type: String, default: "*/15 * * * *", trim: true, maxlength: 80 },
      config: { type: mongoose.Schema.Types.Mixed, default: {} },
      lastIngestedAt: { type: Date, default: null },
      lastIngestStatus: { type: String, default: "", trim: true, maxlength: 120 },
    },
    moderation: {
      type: createModerationSchema(),
      default: () => ({
        status: "approved",
        trustScore: 0.7,
        sourceTrustScore: 0.7,
      }),
    },
  },
  { timestamps: true }
);

NewsSourceSchema.index({ providerType: 1, isActive: 1 });
NewsSourceSchema.index({ publisherTier: 1, isActive: 1 });
NewsSourceSchema.index({ topicTags: 1 });
NewsSourceSchema.index({ countries: 1 });
NewsSourceSchema.index({ states: 1 });
NewsSourceSchema.index({ supportedRegions: 1 });

NewsSourceSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("NewsSource", NewsSourceSchema);
