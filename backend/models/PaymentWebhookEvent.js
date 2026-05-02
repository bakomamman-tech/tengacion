const mongoose = require("mongoose");

const PaymentWebhookEventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ["paystack", "stripe"],
      required: true,
      index: true,
    },
    eventId: {
      type: String,
      required: true,
      trim: true,
    },
    eventType: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
      index: true,
    },
    providerRef: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    purchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Purchase",
      default: null,
      index: true,
    },
    payloadHash: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["received", "processed", "skipped", "failed"],
      default: "received",
      index: true,
    },
    duplicateCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    firstSeenAt: {
      type: Date,
      default: Date.now,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    errorMessage: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    payloadSummary: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

PaymentWebhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
PaymentWebhookEventSchema.index({ provider: 1, payloadHash: 1 });

module.exports = mongoose.model("PaymentWebhookEvent", PaymentWebhookEventSchema);
