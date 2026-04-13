const mongoose = require("mongoose");
const {
  buildExpiryDate,
  assistantMemoryRetentionDays,
  sanitizePlainObject,
} = require("../config/storage");

const AssistantMemorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    kind: {
      type: String,
      required: true,
      enum: ["conversation", "preferences"],
      trim: true,
      index: true,
    },
    conversationId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
      index: true,
    },
    summary: {
      type: String,
      default: "",
      trim: true,
      maxlength: 800,
    },
    lastTopic: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
    },
    lastMode: {
      type: String,
      default: "",
      trim: true,
      maxlength: 40,
    },
    lastSurface: {
      type: String,
      default: "",
      trim: true,
      maxlength: 60,
    },
    lastRoute: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
    },
    lastFeatureId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },
    preferences: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
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
          retentionDays: assistantMemoryRetentionDays,
        }),
    },
  },
  { timestamps: true }
);

AssistantMemorySchema.index({ userId: 1, kind: 1, conversationId: 1 }, { unique: true });
AssistantMemorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

AssistantMemorySchema.pre("validate", function () {
  if (this.preferences && typeof this.preferences === "object") {
    this.preferences = sanitizePlainObject(this.preferences, {
      maxDepth: 1,
      maxKeys: 10,
      maxStringLength: 120,
      maxArrayLength: 4,
    });
  }

  if (this.metadata && typeof this.metadata === "object") {
    this.metadata = sanitizePlainObject(this.metadata, {
      maxDepth: 1,
      maxKeys: 12,
      maxStringLength: 160,
      maxArrayLength: 4,
    });
  }
});

module.exports = mongoose.model("AssistantMemory", AssistantMemorySchema);
