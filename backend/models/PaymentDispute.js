const mongoose = require("mongoose");
const { sanitizePlainObject } = require("../config/storage");

const PaymentDisputeSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ["paystack", "stripe"],
      required: true,
      default: "paystack",
      trim: true,
      lowercase: true,
      index: true,
    },
    providerDisputeId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    purchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Purchase",
      default: null,
      index: true,
    },
    providerRef: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
      index: true,
    },
    providerTransactionId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
      index: true,
    },
    status: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 80,
      index: true,
    },
    resolution: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 80,
      index: true,
    },
    currency: {
      type: String,
      default: "NGN",
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 10,
      index: true,
    },
    disputedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    refundAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    category: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 120,
    },
    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    openedAt: {
      type: Date,
      default: null,
      index: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastEventAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastEventType: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 120,
      index: true,
    },
    financialState: {
      type: String,
      enum: ["none", "held", "released", "debited", "manual_review"],
      default: "none",
      required: true,
      index: true,
    },
    holdAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    creatorHoldAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    platformHoldAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    chargebackAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    creatorChargebackAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    platformChargebackAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    manualReviewReason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
      index: true,
    },
    payloadSummary: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

PaymentDisputeSchema.index(
  { provider: 1, providerDisputeId: 1 },
  { unique: true }
);
PaymentDisputeSchema.index({ purchaseId: 1, financialState: 1, resolvedAt: -1 });

PaymentDisputeSchema.pre("validate", function () {
  if (this.payloadSummary && typeof this.payloadSummary === "object") {
    this.payloadSummary = sanitizePlainObject(this.payloadSummary, {
      maxDepth: 2,
      maxKeys: 24,
      maxStringLength: 300,
      maxArrayLength: 6,
    });
  }
});

module.exports = mongoose.model("PaymentDispute", PaymentDisputeSchema);
