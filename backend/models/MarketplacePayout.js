const mongoose = require("mongoose");

const MarketplacePayoutSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MarketplaceSeller",
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MarketplaceOrder",
      required: true,
      unique: true,
      index: true,
    },
    grossAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    platformFee: {
      type: Number,
      default: 300,
      min: 0,
    },
    netAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    payoutStatus: {
      type: String,
      enum: ["pending", "queued", "paid_out", "failed"],
      default: "pending",
      index: true,
    },
    payoutReference: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

MarketplacePayoutSchema.index({ seller: 1, createdAt: -1 });

module.exports = mongoose.model("MarketplacePayout", MarketplacePayoutSchema);
