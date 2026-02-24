const mongoose = require("mongoose");

const SubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tier: { type: String, default: "basic" },
    currency: { type: String, default: "NGN" },
    status: {
      type: String,
      enum: ["pending", "active", "canceled"],
      default: "pending",
    },
    provider: { type: String, default: "paystack" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    startedAt: Date,
    endedAt: Date,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Subscription", SubscriptionSchema);
