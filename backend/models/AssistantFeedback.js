const mongoose = require("mongoose");
const {
  buildExpiryDate,
  assistantFeedbackRetentionDays,
  sanitizePlainObject,
} = require("../config/storage");

const AssistantFeedbackSchema = new mongoose.Schema(
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
    rating: {
      type: String,
      required: true,
      enum: ["helpful", "not_helpful"],
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
    responseSummary: {
      type: String,
      default: "",
      trim: true,
      maxlength: 800,
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
          retentionDays: assistantFeedbackRetentionDays,
        }),
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AssistantFeedbackSchema.index({ createdAt: -1 });
AssistantFeedbackSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

AssistantFeedbackSchema.pre("validate", function () {
  if (this.metadata && typeof this.metadata === "object") {
    this.metadata = sanitizePlainObject(this.metadata, {
      maxDepth: 1,
      maxKeys: 12,
      maxStringLength: 160,
      maxArrayLength: 4,
    });
  }
});

module.exports = mongoose.model("AssistantFeedback", AssistantFeedbackSchema);
