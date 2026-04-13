const mongoose = require("mongoose");
const { sanitizePlainObject } = require("../config/storage");

const REVIEW_STATUSES = ["open", "under_review", "resolved", "dismissed"];
const REVIEW_SEVERITIES = ["low", "medium", "high"];
const REVIEW_CATEGORIES = ["quality", "safety", "feedback", "abuse"];

const AssistantReviewItemSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    conversationId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
      index: true,
    },
    messageId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
      index: true,
    },
    responseId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
      index: true,
    },
    feedbackId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AssistantFeedback",
      default: null,
      index: true,
    },
    category: {
      type: String,
      default: "feedback",
      enum: REVIEW_CATEGORIES,
      trim: true,
      index: true,
    },
    severity: {
      type: String,
      default: "medium",
      enum: REVIEW_SEVERITIES,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      default: "open",
      enum: REVIEW_STATUSES,
      trim: true,
      index: true,
    },
    reason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    mode: {
      type: String,
      default: "",
      trim: true,
      maxlength: 40,
      index: true,
    },
    surface: {
      type: String,
      default: "",
      trim: true,
      maxlength: 60,
      index: true,
    },
    responseMode: {
      type: String,
      default: "",
      trim: true,
      maxlength: 40,
    },
    safetyLevel: {
      type: String,
      default: "safe",
      trim: true,
      maxlength: 24,
      index: true,
    },
    requestSummary: {
      type: String,
      default: "",
      trim: true,
      maxlength: 800,
    },
    responseSummary: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1200,
    },
    trust: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    reviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    resolutionNote: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    resolvedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

AssistantReviewItemSchema.index({ createdAt: -1 });
AssistantReviewItemSchema.index({ status: 1, createdAt: -1 });
AssistantReviewItemSchema.index({ category: 1, severity: 1, createdAt: -1 });

AssistantReviewItemSchema.pre("validate", function () {
  if (this.trust && typeof this.trust === "object") {
    this.trust = sanitizePlainObject(this.trust, {
      maxDepth: 1,
      maxKeys: 8,
      maxStringLength: 160,
      maxArrayLength: 4,
    });
  }

  if (this.metadata && typeof this.metadata === "object") {
    this.metadata = sanitizePlainObject(this.metadata, {
      maxDepth: 2,
      maxKeys: 16,
      maxStringLength: 240,
      maxArrayLength: 6,
    });
  }
});

module.exports = mongoose.model("AssistantReviewItem", AssistantReviewItemSchema);
