const mongoose = require("mongoose");
const { MODERATION_STATUSES } = require("../config/moderation");
const {
  buildExpiryDate,
  moderationDecisionRetentionDays,
  sanitizePlainObject,
} = require("../config/storage");

const ModerationDecisionLogSchema = new mongoose.Schema(
  {
    moderationCaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ModerationCase",
      required: true,
      index: true,
    },
    adminUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    adminEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 160,
    },
    actionType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      index: true,
    },
    targetMediaId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    previousStatus: {
      type: String,
      enum: MODERATION_STATUSES,
      default: "ALLOW",
    },
    newStatus: {
      type: String,
      enum: MODERATION_STATUSES,
      required: true,
      index: true,
    },
    reason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    expiresAt: {
      type: Date,
      default: () =>
        buildExpiryDate({
          createdAt: new Date(),
          retentionDays: moderationDecisionRetentionDays,
        }),
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ModerationDecisionLogSchema.index({ createdAt: -1 });
ModerationDecisionLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

ModerationDecisionLogSchema.pre("validate", function () {
  if (this.metadata && typeof this.metadata === "object") {
    this.metadata = sanitizePlainObject(this.metadata, {
      maxDepth: 2,
      maxKeys: 12,
      maxStringLength: 400,
      maxArrayLength: 6,
    });
  }
});

module.exports = mongoose.model("ModerationDecisionLog", ModerationDecisionLogSchema);
