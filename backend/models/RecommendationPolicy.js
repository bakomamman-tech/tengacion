const mongoose = require("mongoose");

const RecommendationPolicySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "global",
      unique: true,
      immutable: true,
      index: true,
    },
    enabled: { type: Boolean, default: true },
    maxRepeatedCreatorCount: { type: Number, default: 2, min: 1, max: 5 },
    maxContentTypeStreak: { type: Number, default: 2, min: 1, max: 5 },
    minimumExplorationShare: { type: Number, default: 0.15, min: 0, max: 0.5 },
    hideRatePenalty: { type: Number, default: 18, min: 0, max: 60 },
    reportRatePenalty: { type: Number, default: 40, min: 0, max: 100 },
    conversionRateBoost: { type: Number, default: 16, min: 0, max: 60 },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    changeReason: { type: String, default: "", trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RecommendationPolicy", RecommendationPolicySchema);
