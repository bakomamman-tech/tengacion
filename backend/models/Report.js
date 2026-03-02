const mongoose = require("mongoose");

const ReportSchema = new mongoose.Schema(
  {
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: ["user", "post", "comment", "message"],
      required: true,
      index: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    details: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1200,
    },
    status: {
      type: String,
      enum: ["open", "reviewing", "actioned", "dismissed"],
      default: "open",
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    actionTaken: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    strikesApplied: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      count: {
        type: Number,
        default: 0,
      },
    },
  },
  { timestamps: true }
);

ReportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Report", ReportSchema);
