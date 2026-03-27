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
RecommendationLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

RecommendationLogSchema.pre("validate", function () {
  this.candidateIds = limitArray(this.candidateIds, 25).map((value) => String(value || "").slice(0, 120)).filter(Boolean);
  this.rankedIds = limitArray(this.rankedIds, 40).map((value) => String(value || "").slice(0, 160)).filter(Boolean);
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
      maxDepth: 1,
      maxKeys: 8,
      maxStringLength: 200,
      maxArrayLength: 4,
    });
  }
});

module.exports = mongoose.model("RecommendationLog", RecommendationLogSchema);
