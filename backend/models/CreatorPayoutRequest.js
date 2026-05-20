const mongoose = require("mongoose");
const {
  sanitizePlainObject,
} = require("../config/storage");

const CREATOR_PAYOUT_REQUEST_STATUSES = [
  "pending_review",
  "needs_creator_action",
  "approved",
  "rejected",
  "processing",
  "paid",
  "failed",
];

const CreatorPayoutRequestSchema = new mongoose.Schema(
  {
    creatorProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CreatorProfile",
      required: true,
      index: true,
    },
    creatorUser: {
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
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 10,
      index: true,
    },
    status: {
      type: String,
      enum: CREATOR_PAYOUT_REQUEST_STATUSES,
      default: "pending_review",
      required: true,
      index: true,
    },
    requestReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 80,
      index: true,
    },
    payoutReference: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
      index: true,
    },
    creatorNote: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    adminNote: {
      type: String,
      default: "",
      trim: true,
      maxlength: 800,
    },
    creatorVisibleMessage: {
      type: String,
      default: "",
      trim: true,
      maxlength: 800,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    reviewedAt: {
      type: Date,
      default: null,
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    paidAt: {
      type: Date,
      default: null,
      index: true,
    },
    failedAt: {
      type: Date,
      default: null,
      index: true,
    },
    attemptCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    balanceSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    readinessSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    statusHistory: [
      {
        status: {
          type: String,
          enum: CREATOR_PAYOUT_REQUEST_STATUSES,
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
        creatorMessage: {
          type: String,
          default: "",
          trim: true,
          maxlength: 500,
        },
        payoutReference: {
          type: String,
          default: "",
          trim: true,
          maxlength: 160,
        },
        attemptCount: {
          type: Number,
          default: 0,
          min: 0,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

CreatorPayoutRequestSchema.index({ creatorProfile: 1, status: 1, requestedAt: -1 });
CreatorPayoutRequestSchema.index({ status: 1, requestedAt: -1 });

CreatorPayoutRequestSchema.pre("validate", function () {
  if (this.balanceSnapshot && typeof this.balanceSnapshot === "object") {
    this.balanceSnapshot = sanitizePlainObject(this.balanceSnapshot, {
      maxDepth: 2,
      maxKeys: 18,
      maxStringLength: 300,
      maxArrayLength: 8,
    });
  }

  if (this.readinessSnapshot && typeof this.readinessSnapshot === "object") {
    this.readinessSnapshot = sanitizePlainObject(this.readinessSnapshot, {
      maxDepth: 2,
      maxKeys: 18,
      maxStringLength: 300,
      maxArrayLength: 8,
    });
  }
});

module.exports = mongoose.model("CreatorPayoutRequest", CreatorPayoutRequestSchema);
module.exports.CREATOR_PAYOUT_REQUEST_STATUSES = CREATOR_PAYOUT_REQUEST_STATUSES;
