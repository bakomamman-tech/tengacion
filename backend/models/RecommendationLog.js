const mongoose = require("mongoose");

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
  },
  { timestamps: true }
);

RecommendationLogSchema.index({ userId: 1, servedAt: -1 });

module.exports = mongoose.model("RecommendationLog", RecommendationLogSchema);
