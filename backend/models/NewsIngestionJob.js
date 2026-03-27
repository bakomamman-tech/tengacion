const mongoose = require("mongoose");
const {
  buildExpiryDate,
  newsIngestionJobRetentionDays,
  sanitizePlainObject,
} = require("../config/storage");

const NewsIngestionJobSchema = new mongoose.Schema(
  {
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NewsSource",
      default: null,
      index: true,
    },
    sourceSlug: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 80,
      index: true,
    },
    providerType: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 80,
      index: true,
    },
    status: {
      type: String,
      enum: ["running", "completed", "failed"],
      default: "running",
      index: true,
    },
    licenseType: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 80,
    },
    startedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    ingestedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    skippedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    errorMessage: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
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
          retentionDays: newsIngestionJobRetentionDays,
        }),
    },
  },
  { timestamps: true }
);

NewsIngestionJobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

NewsIngestionJobSchema.pre("validate", function () {
  if (this.metadata && typeof this.metadata === "object") {
    this.metadata = sanitizePlainObject(this.metadata, {
      maxDepth: 1,
      maxKeys: 8,
      maxStringLength: 220,
      maxArrayLength: 4,
    });
  }
});

NewsIngestionJobSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("NewsIngestionJob", NewsIngestionJobSchema);
