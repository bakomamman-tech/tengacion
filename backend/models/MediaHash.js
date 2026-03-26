const mongoose = require("mongoose");

const MediaHashSchema = new mongoose.Schema(
  {
    moderationCaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ModerationCase",
      default: null,
      index: true,
    },
    sourceCaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ModerationCase",
      default: null,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    targetType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
      index: true,
    },
    targetId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
    },
    mediaRole: {
      type: String,
      default: "primary",
      trim: true,
      maxlength: 40,
    },
    algorithm: {
      type: String,
      default: "sha256",
      trim: true,
      maxlength: 40,
    },
    hashKind: {
      type: String,
      enum: ["content_file", "fingerprint", "source_reference"],
      required: true,
      index: true,
    },
    hashValue: {
      type: String,
      required: true,
      trim: true,
      maxlength: 256,
      index: true,
    },
    sourceUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1200,
    },
    mimeType: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    originalFilename: {
      type: String,
      default: "",
      trim: true,
      maxlength: 260,
    },
    status: {
      type: String,
      enum: ["banned", "restricted", "informational"],
      default: "informational",
      index: true,
    },
    banReason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },
  },
  { timestamps: true }
);

MediaHashSchema.index({ hashKind: 1, hashValue: 1 });

module.exports = mongoose.model("MediaHash", MediaHashSchema);
