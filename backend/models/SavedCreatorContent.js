const mongoose = require("mongoose");

const SavedCreatorContentSchema = new mongoose.Schema(
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
      enum: ["track", "book", "album", "video"],
      required: true,
      index: true,
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    savedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastNotifiedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

SavedCreatorContentSchema.index(
  { userId: 1, itemType: 1, itemId: 1 },
  { unique: true }
);
SavedCreatorContentSchema.index({ creatorId: 1, savedAt: -1 });

module.exports = mongoose.model("SavedCreatorContent", SavedCreatorContentSchema);
