const mongoose = require("mongoose");

const NEWS_RIGHTS_MODES = [
  "FULL_IN_APP",
  "SUMMARY_PLUS_LINKOUT",
  "THUMBNAIL_LINKOUT",
  "EMBED_ONLY",
];

const NEWS_MODERATION_STATUSES = ["pending", "approved", "limited", "blocked"];
const NEWS_ARTICLE_TYPES = [
  "breaking",
  "analysis",
  "opinion",
  "explainer",
  "report",
];

const NEWS_SENSITIVE_FLAGS = [
  "elections",
  "violence",
  "crisis",
  "misinformation-risk",
];

const createAttributionSchema = () =>
  new mongoose.Schema(
    {
      attributionRequired: { type: Boolean, default: true },
      canonicalLinkRequired: { type: Boolean, default: true },
      copyrightLine: { type: String, default: "", trim: true, maxlength: 220 },
      displayName: { type: String, default: "", trim: true, maxlength: 160 },
      homepageUrl: { type: String, default: "", trim: true, maxlength: 500 },
    },
    { _id: false }
  );

const createRightsSchema = () =>
  new mongoose.Schema(
    {
      mode: {
        type: String,
        enum: NEWS_RIGHTS_MODES,
        default: "SUMMARY_PLUS_LINKOUT",
        index: true,
      },
      attributionRequired: { type: Boolean, default: true },
      canonicalLinkRequired: { type: Boolean, default: true },
      allowBodyHtml: { type: Boolean, default: false },
      allowSummary: { type: Boolean, default: true },
      allowThumbnail: { type: Boolean, default: true },
      allowEmbed: { type: Boolean, default: false },
      expiresAt: { type: Date, default: null, index: true },
      isExpired: { type: Boolean, default: false, index: true },
      contractVersion: { type: String, default: "", trim: true, maxlength: 80 },
      notes: { type: String, default: "", trim: true, maxlength: 500 },
    },
    { _id: false }
  );

const createModerationSchema = () =>
  new mongoose.Schema(
    {
      status: {
        type: String,
        enum: NEWS_MODERATION_STATUSES,
        default: "pending",
        index: true,
      },
      reason: { type: String, default: "", trim: true, maxlength: 500 },
      trustScore: { type: Number, default: 0.6, min: 0, max: 1 },
      sourceTrustScore: { type: Number, default: 0.6, min: 0, max: 1 },
      sensitiveFlags: {
        type: [String],
        default: [],
        validate: {
          validator(value) {
            return (Array.isArray(value) ? value : []).every((entry) =>
              NEWS_SENSITIVE_FLAGS.includes(String(entry || ""))
            );
          },
          message: "Invalid sensitive news flag",
        },
      },
      misinformationRisk: { type: Number, default: 0, min: 0, max: 1 },
      reviewedAt: { type: Date, default: null },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      notes: { type: String, default: "", trim: true, maxlength: 1000 },
    },
    { _id: false }
  );

const createGeographySchema = () =>
  new mongoose.Schema(
    {
      scope: {
        type: String,
        enum: ["local", "national", "regional", "international", "unknown"],
        default: "unknown",
        index: true,
      },
      countries: [{ type: String, trim: true, maxlength: 120 }],
      states: [{ type: String, trim: true, maxlength: 120 }],
      cities: [{ type: String, trim: true, maxlength: 120 }],
      primaryCountry: { type: String, default: "", trim: true, maxlength: 120 },
      primaryState: { type: String, default: "", trim: true, maxlength: 120 },
      primaryCity: { type: String, default: "", trim: true, maxlength: 120 },
      coordinates: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
      },
      relevanceScore: { type: Number, default: 0, min: 0, max: 1 },
    },
    { _id: false }
  );

const createScoringSchema = () =>
  new mongoose.Schema(
    {
      importanceScore: { type: Number, default: 0, min: 0, max: 1 },
      freshnessScore: { type: Number, default: 0, min: 0, max: 1 },
      localRelevanceScore: { type: Number, default: 0, min: 0, max: 1 },
      userAffinityScore: { type: Number, default: 0, min: 0, max: 1 },
      sourceTrustScore: { type: Number, default: 0, min: 0, max: 1 },
      coverageDiversityScore: { type: Number, default: 0, min: 0, max: 1 },
      engagementScore: { type: Number, default: 0, min: 0, max: 1 },
      diversityPenalty: { type: Number, default: 0, min: 0, max: 1 },
      duplicatePenalty: { type: Number, default: 0, min: 0, max: 1 },
      fatiguePenalty: { type: Number, default: 0, min: 0, max: 1 },
      blockedTopicPenalty: { type: Number, default: 0, min: 0, max: 1 },
      publicInterestBoost: { type: Number, default: 0, min: 0, max: 1 },
      finalScore: { type: Number, default: 0, index: true },
      reasons: [{ type: String, trim: true, maxlength: 160 }],
      scoredAt: { type: Date, default: null },
    },
    { _id: false }
  );

const createAssetRefSchema = () =>
  new mongoose.Schema(
    {
      assetId: { type: mongoose.Schema.Types.ObjectId, ref: "NewsAsset", required: true },
      role: {
        type: String,
        enum: ["hero", "thumbnail", "inline", "logo", "embed"],
        default: "thumbnail",
      },
    },
    { _id: false }
  );

module.exports = {
  NEWS_RIGHTS_MODES,
  NEWS_MODERATION_STATUSES,
  NEWS_ARTICLE_TYPES,
  NEWS_SENSITIVE_FLAGS,
  createAttributionSchema,
  createRightsSchema,
  createModerationSchema,
  createGeographySchema,
  createScoringSchema,
  createAssetRefSchema,
};
