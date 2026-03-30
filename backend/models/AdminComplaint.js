const mongoose = require("mongoose");

const AdminComplaintSchema = new mongoose.Schema(
  {
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    category: {
      type: String,
      enum: ["general", "safety", "abuse", "privacy", "bug", "account", "other"],
      default: "general",
      index: true,
    },
    details: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    sourcePath: {
      type: String,
      default: "",
      trim: true,
      maxlength: 260,
    },
    sourceLabel: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
      index: true,
    },
    priorityScore: {
      type: Number,
      default: 200,
      min: 0,
      max: 1000,
      index: true,
    },
    status: {
      type: String,
      enum: ["open", "reviewing", "resolved", "dismissed"],
      default: "open",
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    reviewedAt: {
      type: Date,
      default: null,
      index: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
      index: true,
    },
    adminNote: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

AdminComplaintSchema.index({ status: 1, priorityScore: -1, createdAt: -1 });

AdminComplaintSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("AdminComplaint", AdminComplaintSchema);
