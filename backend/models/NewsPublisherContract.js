const mongoose = require("mongoose");
const {
  NEWS_RIGHTS_MODES,
  createAttributionSchema,
  createRightsSchema,
} = require("./newsSubschemas");

const NewsPublisherContractSchema = new mongoose.Schema(
  {
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NewsSource",
      required: true,
      index: true,
    },
    contractName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    contractVersion: {
      type: String,
      default: "v1",
      trim: true,
      maxlength: 80,
    },
    publisherTier: {
      type: String,
      enum: ["licensed", "partner", "discovery"],
      default: "discovery",
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "active", "expired", "suspended"],
      default: "active",
      index: true,
    },
    rightsModeDefault: {
      type: String,
      enum: NEWS_RIGHTS_MODES,
      default: "SUMMARY_PLUS_LINKOUT",
      index: true,
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
    attribution: {
      type: createAttributionSchema(),
      default: () => ({}),
    },
    allowedCountries: [{ type: String, trim: true, maxlength: 120 }],
    allowedStates: [{ type: String, trim: true, maxlength: 120 }],
    startAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    signedBy: { type: String, default: "", trim: true, maxlength: 160 },
    notes: { type: String, default: "", trim: true, maxlength: 1200 },
  },
  { timestamps: true }
);

NewsPublisherContractSchema.index({ sourceId: 1, status: 1, expiresAt: 1 });

NewsPublisherContractSchema.methods.isExpired = function (now = new Date()) {
  return Boolean(this.expiresAt && new Date(this.expiresAt).getTime() <= now.getTime());
};

NewsPublisherContractSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model(
  "NewsPublisherContract",
  NewsPublisherContractSchema
);
