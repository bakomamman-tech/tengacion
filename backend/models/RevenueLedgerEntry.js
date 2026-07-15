const mongoose = require("mongoose");
const {
  sanitizePlainObject,
} = require("../config/storage");

const LEDGER_EVENT_TYPES = [
  "purchase_authorized",
  "payment_settled",
  "platform_commission_reserved",
  "creator_earning_credited",
  "refund_initiated",
  "refund_settled",
  "payout_requested",
  "payout_approved",
  "payout_sent",
  "payout_failed",
  "payout_reversed",
];

const RevenueLedgerEntrySchema = new mongoose.Schema(
  {
    ledgerEventType: {
      type: String,
      enum: LEDGER_EVENT_TYPES,
      required: true,
      index: true,
    },
    accountType: {
      type: String,
      enum: ["buyer", "creator", "platform", "marketplace_seller", "system"],
      required: true,
      index: true,
    },
    accountId: {
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
    amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    direction: {
      type: String,
      enum: ["credit", "debit", "none"],
      default: "none",
      required: true,
    },
    balanceScope: {
      type: String,
      enum: ["available", "pending", "commission", "settlement", "none"],
      default: "none",
      required: true,
      index: true,
    },
    previousBalance: {
      type: Number,
      default: 0,
    },
    resultingBalance: {
      type: Number,
      default: 0,
    },
    actorType: {
      type: String,
      enum: ["user", "admin", "provider", "system"],
      default: "system",
      required: true,
      index: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    actorRole: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 60,
    },
    sourceType: {
      type: String,
      enum: ["purchase", "marketplace_order", "marketplace_payout", "creator_payout", "refund", "system"],
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
      maxlength: 160,
      index: true,
    },
    provider: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 40,
      index: true,
    },
    providerReference: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
      index: true,
    },
    dedupeKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
      maxlength: 220,
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    auditMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

RevenueLedgerEntrySchema.index({
  accountType: 1,
  accountId: 1,
  currency: 1,
  balanceScope: 1,
  occurredAt: -1,
  createdAt: -1,
});
RevenueLedgerEntrySchema.index({ sourceType: 1, sourceId: 1, ledgerEventType: 1 });
RevenueLedgerEntrySchema.index({ provider: 1, providerReference: 1 });

RevenueLedgerEntrySchema.pre("validate", function () {
  if (this.auditMetadata && typeof this.auditMetadata === "object") {
    this.auditMetadata = sanitizePlainObject(this.auditMetadata, {
      maxDepth: 2,
      maxKeys: 24,
      maxStringLength: 400,
      maxArrayLength: 8,
    });
  }
});

module.exports = mongoose.model("RevenueLedgerEntry", RevenueLedgerEntrySchema);
module.exports.LEDGER_EVENT_TYPES = LEDGER_EVENT_TYPES;
