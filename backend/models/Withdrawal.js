const mongoose = require("mongoose");

const WITHDRAWAL_OWNER_TYPES = ["creator", "seller"];
const WITHDRAWAL_STATUSES = [
  "requested",
  "processing",
  "otp_required",
  "provider_setup_required",
  "succeeded",
  "failed",
  "reversed",
];
const OPEN_WITHDRAWAL_STATUSES = [
  "requested",
  "processing",
  "otp_required",
  "provider_setup_required",
];

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: WITHDRAWAL_STATUSES,
      required: true,
    },
    at: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },
    providerStatus: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },
  },
  { _id: false }
);

const WithdrawalSchema = new mongoose.Schema(
  {
    ownerType: {
      type: String,
      enum: WITHDRAWAL_OWNER_TYPES,
      required: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "NGN",
      trim: true,
      uppercase: true,
      maxlength: 10,
      index: true,
    },
    status: {
      type: String,
      enum: WITHDRAWAL_STATUSES,
      default: "requested",
      required: true,
      index: true,
    },
    reference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 80,
      index: true,
    },
    provider: {
      type: String,
      default: "paystack",
      trim: true,
      lowercase: true,
      maxlength: 40,
      index: true,
    },
    providerRecipientCode: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
      index: true,
    },
    providerTransferCode: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
      index: true,
    },
    providerTransferId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
      index: true,
    },
    providerStatus: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
      index: true,
    },
    providerResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    failureReason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    bankSnapshot: {
      bankName: { type: String, default: "", trim: true, maxlength: 120 },
      bankCode: { type: String, default: "", trim: true, maxlength: 30 },
      accountNumberMasked: { type: String, default: "", trim: true, maxlength: 40 },
      accountName: { type: String, default: "", trim: true, maxlength: 140 },
      recipientCode: { type: String, default: "", trim: true, maxlength: 120 },
    },
    balanceSnapshot: {
      availableBalance: { type: Number, default: 0 },
      openWithdrawalAmount: { type: Number, default: 0 },
      legacyOpenPayoutAmount: { type: Number, default: 0 },
      reserveAmount: { type: Number, default: 0 },
      withdrawableAmount: { type: Number, default: 0 },
    },
    requestedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    initiatedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
      index: true,
    },
    failedAt: {
      type: Date,
      default: null,
    },
    reversedAt: {
      type: Date,
      default: null,
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
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

WithdrawalSchema.index({ ownerType: 1, ownerId: 1, status: 1, requestedAt: -1 });
WithdrawalSchema.index({ userId: 1, requestedAt: -1 });
WithdrawalSchema.index({ provider: 1, providerTransferCode: 1 });

WithdrawalSchema.pre("validate", function normalizeWithdrawal(next) {
  this.currency = String(this.currency || "NGN").trim().toUpperCase() || "NGN";
  this.reference = String(this.reference || "").trim().toLowerCase();
  this.provider = String(this.provider || "paystack").trim().toLowerCase() || "paystack";
  this.amount = Math.max(0, Math.round((Number(this.amount || 0) + Number.EPSILON) * 100) / 100);

  if (!Array.isArray(this.statusHistory) || !this.statusHistory.length) {
    this.statusHistory = [
      {
        status: this.status || "requested",
        at: this.requestedAt || new Date(),
        note: "Withdrawal created",
      },
    ];
  }

  if (typeof next === "function") {
    next();
  }
});

module.exports = mongoose.model("Withdrawal", WithdrawalSchema);
module.exports.WITHDRAWAL_STATUSES = WITHDRAWAL_STATUSES;
module.exports.OPEN_WITHDRAWAL_STATUSES = OPEN_WITHDRAWAL_STATUSES;
