const mongoose = require("mongoose");

const CreatorQualityProfileSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CreatorProfile",
      required: true,
      unique: true,
      index: true,
    },
    engagementRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    completionRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    purchaseRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    reportRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    trustScore: {
      type: Number,
      default: 0.5,
      min: 0,
      max: 1,
    },
    qualityTier: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
      index: true,
    },
    followerCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    contentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paidPurchaseCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastComputedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CreatorQualityProfile", CreatorQualityProfileSchema);
