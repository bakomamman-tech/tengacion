const mongoose = require("mongoose");

const AnalyticsEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      trim: true,
      index: true,
      maxlength: 80,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    actorRole: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 40,
    },
    targetId: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      index: true,
    },
    targetType: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 40,
      index: true,
    },
    contentType: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 40,
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

AnalyticsEventSchema.index({ createdAt: -1, type: 1 });
AnalyticsEventSchema.index({ userId: 1, createdAt: -1 });
AnalyticsEventSchema.index({ targetType: 1, createdAt: -1 });
AnalyticsEventSchema.index({ contentType: 1, createdAt: -1 });

module.exports = mongoose.model("AnalyticsEvent", AnalyticsEventSchema);
