const mongoose = require("mongoose");

const MarketplaceTransactionSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MarketplaceOrder",
      required: true,
      index: true,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MarketplaceSeller",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    platformFee: {
      type: Number,
      default: 300,
      min: 0,
    },
    sellerReceivable: {
      type: Number,
      required: true,
      min: 0,
    },
    provider: {
      type: String,
      default: "paystack",
      trim: true,
      lowercase: true,
      maxlength: 40,
    },
    reference: {
      type: String,
      default: "",
      trim: true,
      unique: true,
      sparse: true,
      index: true,
    },
    status: {
      type: String,
      default: "pending",
      trim: true,
      lowercase: true,
      maxlength: 40,
      index: true,
    },
    rawVerificationSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

MarketplaceTransactionSchema.index({ seller: 1, createdAt: -1 });
MarketplaceTransactionSchema.index({ buyer: 1, createdAt: -1 });

module.exports = mongoose.model("MarketplaceTransaction", MarketplaceTransactionSchema);
