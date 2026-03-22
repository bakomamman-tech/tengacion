const mongoose = require("mongoose");

const PurchaseSchema = new mongoose.Schema(
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
      index: true,
    },
    itemType: {
      type: String,
      enum: ["track", "book", "album", "video", "subscription"],
      required: true,
      index: true,
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    priceNGN: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: "NGN",
      trim: true,
      uppercase: true,
      maxlength: 10,
    },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
      index: true,
    },
    provider: {
      type: String,
      enum: ["paystack", "flutterwave", "stripe", "manual"],
      required: true,
      default: "paystack",
      index: true,
    },
    providerRef: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    billingInterval: {
      type: String,
      enum: ["one_time", "monthly"],
      default: "one_time",
    },
    accessExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

PurchaseSchema.index({ userId: 1, itemType: 1, itemId: 1, status: 1 });

module.exports = mongoose.model("Purchase", PurchaseSchema);
