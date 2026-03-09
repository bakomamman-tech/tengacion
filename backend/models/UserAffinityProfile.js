const mongoose = require("mongoose");

const ScoredCreatorSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CreatorProfile",
      required: true,
      index: true,
    },
    score: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const ScoredLabelSchema = new mongoose.Schema(
  {
    value: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      index: true,
    },
    score: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const UserAffinityProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    topCreators: {
      type: [ScoredCreatorSchema],
      default: [],
    },
    topTopics: {
      type: [ScoredLabelSchema],
      default: [],
    },
    preferredContentTypes: {
      type: [ScoredLabelSchema],
      default: [],
    },
    recentSignals: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    negativeSignals: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    lastComputedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserAffinityProfile", UserAffinityProfileSchema);
