const mongoose = require("mongoose");
const {
  createRightsSchema,
  createModerationSchema,
  createAttributionSchema,
} = require("./newsSubschemas");

const NewsAssetSchema = new mongoose.Schema(
  {
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NewsSource",
      required: true,
      index: true,
    },
    storyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NewsStory",
      default: null,
      index: true,
    },
    externalId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
      index: true,
    },
    assetType: {
      type: String,
      enum: ["image", "video", "embed", "logo"],
      default: "image",
      index: true,
    },
    role: {
      type: String,
      enum: ["hero", "thumbnail", "inline", "logo", "embed"],
      default: "thumbnail",
      index: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    secureUrl: { type: String, default: "", trim: true, maxlength: 1000 },
    width: { type: Number, default: 0, min: 0 },
    height: { type: Number, default: 0, min: 0 },
    mimeType: { type: String, default: "", trim: true, maxlength: 120 },
    altText: { type: String, default: "", trim: true, maxlength: 500 },
    caption: { type: String, default: "", trim: true, maxlength: 500 },
    creditLine: { type: String, default: "", trim: true, maxlength: 220 },
    hash: { type: String, default: "", trim: true, maxlength: 160, index: true },
    attribution: {
      type: createAttributionSchema(),
      default: () => ({}),
    },
    rights: {
      type: createRightsSchema(),
      default: () => ({
        mode: "THUMBNAIL_LINKOUT",
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
  },
  { timestamps: true }
);

NewsAssetSchema.index({ sourceId: 1, externalId: 1 });
NewsAssetSchema.index({ sourceId: 1, url: 1 });

NewsAssetSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("NewsAsset", NewsAssetSchema);
