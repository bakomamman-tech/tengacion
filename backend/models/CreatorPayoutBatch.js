const mongoose = require("mongoose");
const {
  sanitizePlainObject,
} = require("../config/storage");

const CREATOR_PAYOUT_BATCH_STATUSES = [
  "ready_for_export",
  "exported",
  "paid",
  "partially_paid",
  "failed",
  "cancelled",
];

const CreatorPayoutBatchSchema = new mongoose.Schema(
  {
    batchReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 80,
      index: true,
    },
    status: {
      type: String,
      enum: CREATOR_PAYOUT_BATCH_STATUSES,
      default: "ready_for_export",
      required: true,
      index: true,
    },
    provider: {
      type: String,
      default: "manual_bank_export",
      trim: true,
      lowercase: true,
      maxlength: 60,
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
    requestIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CreatorPayoutRequest",
        index: true,
      },
    ],
    itemSnapshots: [
      {
        requestId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "CreatorPayoutRequest",
          required: true,
        },
        requestReference: {
          type: String,
          default: "",
          trim: true,
          maxlength: 80,
        },
        creatorProfile: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "CreatorProfile",
          required: true,
        },
        creatorUser: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        creatorDisplayName: {
          type: String,
          default: "",
          trim: true,
          maxlength: 120,
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
        },
        payoutMethod: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
        validation: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
        statusAtBatch: {
          type: String,
          default: "approved",
          trim: true,
          maxlength: 60,
        },
        outcomeStatus: {
          type: String,
          enum: ["pending", "paid", "failed"],
          default: "pending",
          index: true,
        },
        payoutReference: {
          type: String,
          default: "",
          trim: true,
          maxlength: 160,
        },
        providerResponse: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
        resolvedAt: {
          type: Date,
          default: null,
        },
      },
    ],
    itemCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: 800,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    reconciledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    exportedAt: {
      type: Date,
      default: null,
      index: true,
    },
    reconciledAt: {
      type: Date,
      default: null,
      index: true,
    },
    providerResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    reconciliationSummary: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    slaSummary: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    statusHistory: [
      {
        status: {
          type: String,
          enum: CREATOR_PAYOUT_BATCH_STATUSES,
          required: true,
        },
        at: {
          type: Date,
          default: Date.now,
        },
        actorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        actorRole: {
          type: String,
          default: "",
          trim: true,
          lowercase: true,
          maxlength: 60,
        },
        note: {
          type: String,
          default: "",
          trim: true,
          maxlength: 500,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

CreatorPayoutBatchSchema.index({ status: 1, createdAt: -1 });
CreatorPayoutBatchSchema.index({ currency: 1, status: 1, createdAt: -1 });

CreatorPayoutBatchSchema.pre("validate", function () {
  this.itemCount = Array.isArray(this.requestIds) ? this.requestIds.length : 0;
  this.totalAmount = Math.max(
    0,
    Math.round(
      (Array.isArray(this.itemSnapshots)
        ? this.itemSnapshots.reduce((sum, item) => sum + Number(item.amount || 0), 0)
        : 0) * 100
    ) / 100
  );

  const sanitizeOptions = {
    maxDepth: 2,
    maxKeys: 20,
    maxStringLength: 400,
    maxArrayLength: 10,
  };

  if (this.providerResponse && typeof this.providerResponse === "object") {
    this.providerResponse = sanitizePlainObject(this.providerResponse, sanitizeOptions);
  }
  if (this.reconciliationSummary && typeof this.reconciliationSummary === "object") {
    this.reconciliationSummary = sanitizePlainObject(this.reconciliationSummary, sanitizeOptions);
  }
  if (this.slaSummary && typeof this.slaSummary === "object") {
    this.slaSummary = sanitizePlainObject(this.slaSummary, sanitizeOptions);
  }
  if (Array.isArray(this.itemSnapshots)) {
    this.itemSnapshots.forEach((item) => {
      if (item.payoutMethod && typeof item.payoutMethod === "object") {
        item.payoutMethod = sanitizePlainObject(item.payoutMethod, sanitizeOptions);
      }
      if (item.validation && typeof item.validation === "object") {
        item.validation = sanitizePlainObject(item.validation, sanitizeOptions);
      }
      if (item.providerResponse && typeof item.providerResponse === "object") {
        item.providerResponse = sanitizePlainObject(item.providerResponse, sanitizeOptions);
      }
    });
  }
});

module.exports = mongoose.model("CreatorPayoutBatch", CreatorPayoutBatchSchema);
module.exports.CREATOR_PAYOUT_BATCH_STATUSES = CREATOR_PAYOUT_BATCH_STATUSES;
