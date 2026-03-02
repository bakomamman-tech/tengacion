const mongoose = require("mongoose");

const PlayerProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CreatorProfile",
      required: true,
      index: true,
    },
    itemType: {
      type: String,
      enum: ["song", "podcast"],
      required: true,
      index: true,
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    positionSec: {
      type: Number,
      default: 0,
      min: 0,
    },
    durationSec: {
      type: Number,
      default: 0,
      min: 0,
    },
    playedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

PlayerProgressSchema.index({ userId: 1, itemType: 1, itemId: 1 }, { unique: true });

module.exports = mongoose.model("PlayerProgress", PlayerProgressSchema);
