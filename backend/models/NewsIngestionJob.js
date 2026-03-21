const mongoose = require("mongoose");

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
  },
  { timestamps: true }
);

NewsIngestionJobSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("NewsIngestionJob", NewsIngestionJobSchema);
