const mongoose = require("mongoose");

const WalletEntrySchema = new mongoose.Schema(
  {
    walletAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WalletAccount",
      required: true,
      index: true,
    },
    ownerType: {
      type: String,
      enum: ["creator", "platform"],
      required: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
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
    direction: {
      type: String,
      enum: ["credit", "debit"],
      required: true,
    },
    bucket: {
      type: String,
      enum: ["available", "pending"],
      default: "available",
      required: true,
      index: true,
    },
    entryType: {
      type: String,
      enum: [
        "sale_credit",
        "platform_fee",
        "pending_hold",
        "hold_release",
        "payout_debit",
        "refund_debit",
        "adjustment_credit",
        "adjustment_debit",
      ],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    grossAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    sourceType: {
      type: String,
      enum: ["purchase", "payout", "refund", "adjustment", "system"],
      default: "purchase",
      required: true,
      index: true,
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    sourceRef: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    dedupeKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    effectiveAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

WalletEntrySchema.index({ walletAccountId: 1, effectiveAt: -1, createdAt: -1 });
WalletEntrySchema.index({ ownerType: 1, ownerId: 1, entryType: 1, effectiveAt: -1 });
WalletEntrySchema.index({ sourceType: 1, sourceId: 1, entryType: 1 });

module.exports = mongoose.model("WalletEntry", WalletEntrySchema);
