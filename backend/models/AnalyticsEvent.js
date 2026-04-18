const mongoose = require("mongoose");
const {
  buildExpiryDate,
  analyticsEventRetentionDays,
  sanitizePlainObject,
} = require("../config/storage");

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
    expiresAt: {
      type: Date,
      default: () =>
        buildExpiryDate({
          createdAt: new Date(),
          retentionDays: analyticsEventRetentionDays,
        }),
    },
  },
  {
    timestamps: true,
  }
);

AnalyticsEventSchema.index({ createdAt: -1, type: 1 });
AnalyticsEventSchema.index({ userId: 1, createdAt: -1 });
AnalyticsEventSchema.index({ targetType: 1, createdAt: -1 });
AnalyticsEventSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
AnalyticsEventSchema.index({ contentType: 1, createdAt: -1 });
AnalyticsEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

AnalyticsEventSchema.pre("validate", function () {
  if (this.metadata && typeof this.metadata === "object") {
    this.metadata = sanitizePlainObject(this.metadata, {
      maxDepth: 2,
      maxKeys: 14,
      maxStringLength: 400,
      maxArrayLength: 8,
    });
  }
});

module.exports = mongoose.model("AnalyticsEvent", AnalyticsEventSchema);
