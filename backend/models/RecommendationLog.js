const mongoose = require("mongoose");
const {
  buildExpiryDate,
  recommendationLogRetentionDays,
  sanitizePlainObject,
  limitArray,
} = require("../config/storage");

const RecommendationFeedbackSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    entityType: {
      type: String,
      default: "",
      trim: true,
      maxlength: 40,
    },
    entityId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    position: {
      type: Number,
      default: -1,
      min: -1,
    },
    value: {
      type: Number,
      default: 0,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { _id: false }
);

const RecommendationRankedItemRefSchema = new mongoose.Schema(
  {
    entityKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    entityType: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 40,
    },
    entityId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CreatorProfile",
      default: null,
      index: true,
    },
    rank: {
      type: Number,
      default: 0,
      min: 0,
    },
    reason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },
  },
  { _id: false }
);

const RecommendationCreatorExposureSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CreatorProfile",
      required: true,
      index: true,
    },
    count: {
      type: Number,
      default: 0,
      min: 0,
    },
    highestRank: {
      type: Number,
      default: 0,
      min: 0,
    },
    entityTypes: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const RecommendationLogSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
      maxlength: 120,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    surface: {
      type: String,
      required: true,
      trim: true,
      index: true,
      maxlength: 60,
    },
    candidateIds: {
      type: [String],
      default: [],
    },
    rankedIds: {
      type: [String],
      default: [],
    },
    creatorIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "CreatorProfile",
        },
      ],
      default: [],
      index: true,
    },
    rankedItemRefs: {
      type: [RecommendationRankedItemRefSchema],
      default: [],
    },
    creatorExposures: {
      type: [RecommendationCreatorExposureSchema],
      default: [],
    },
    featuresSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    responseMeta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    feedback: {
      type: [RecommendationFeedbackSchema],
      default: [],
    },
    servedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: () =>
        buildExpiryDate({
          createdAt: new Date(),
          retentionDays: recommendationLogRetentionDays,
        }),
    },
  },
  { timestamps: true }
);

RecommendationLogSchema.index({ userId: 1, servedAt: -1 });
RecommendationLogSchema.index({ creatorIds: 1, servedAt: -1 });
RecommendationLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

RecommendationLogSchema.pre("validate", function () {
  this.candidateIds = limitArray(this.candidateIds, 25).map((value) => String(value || "").slice(0, 120)).filter(Boolean);
  this.rankedIds = limitArray(this.rankedIds, 40).map((value) => String(value || "").slice(0, 160)).filter(Boolean);
  this.creatorIds = limitArray(this.creatorIds, 25)
    .map((value) => String(value || ""))
    .filter((value) => mongoose.Types.ObjectId.isValid(value))
    .map((value) => new mongoose.Types.ObjectId(value));
  this.rankedItemRefs = limitArray(this.rankedItemRefs, 40)
    .map((item) => ({
      entityKey: String(item?.entityKey || "").slice(0, 160),
      entityType: String(item?.entityType || "").trim().toLowerCase().slice(0, 40),
      entityId: String(item?.entityId || "").trim().slice(0, 120),
      creatorId: mongoose.Types.ObjectId.isValid(item?.creatorId)
        ? new mongoose.Types.ObjectId(item.creatorId)
        : null,
      rank: Math.max(0, Number(item?.rank || 0)),
      reason: String(item?.reason || "").trim().slice(0, 80),
    }))
    .filter((item) => item.entityKey);
  this.creatorExposures = limitArray(this.creatorExposures, 25)
    .map((item) => ({
      creatorId: mongoose.Types.ObjectId.isValid(item?.creatorId)
        ? new mongoose.Types.ObjectId(item.creatorId)
        : null,
      count: Math.max(0, Number(item?.count || 0)),
      highestRank: Math.max(0, Number(item?.highestRank || 0)),
      entityTypes: limitArray(item?.entityTypes, 8)
        .map((value) => String(value || "").trim().toLowerCase().slice(0, 40))
        .filter(Boolean),
    }))
    .filter((item) => item.creatorId && item.count > 0);
  if (this.featuresSnapshot && typeof this.featuresSnapshot === "object") {
    this.featuresSnapshot = sanitizePlainObject(this.featuresSnapshot, {
      maxDepth: 2,
      maxKeys: 16,
      maxStringLength: 300,
      maxArrayLength: 6,
    });
  }
  if (this.responseMeta && typeof this.responseMeta === "object") {
    this.responseMeta = sanitizePlainObject(this.responseMeta, {
      maxDepth: 2,
      maxKeys: 16,
      maxStringLength: 200,
      maxArrayLength: 4,
    });
  }
});

module.exports = mongoose.model("RecommendationLog", RecommendationLogSchema);
