const mongoose = require("mongoose");

const EntitlementSchema = new mongoose.Schema(
  {
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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
    grantedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

EntitlementSchema.index({ buyerId: 1, itemType: 1, itemId: 1 }, { unique: true });

module.exports = mongoose.model("Entitlement", EntitlementSchema);
