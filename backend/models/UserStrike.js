const mongoose = require("mongoose");

const UserStrikeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    count: {
      type: Number,
      default: 0,
      min: 0,
    },
    history: [
      {
        reportId: { type: mongoose.Schema.Types.ObjectId, ref: "Report", default: null },
        moderationCaseId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "ModerationCase",
          default: null,
        },
        actionType: {
          type: String,
          default: "",
          trim: true,
          maxlength: 80,
        },
        reasonCategory: {
          type: String,
          default: "",
          trim: true,
          maxlength: 80,
        },
        severity: {
          type: String,
          enum: ["low", "medium", "high", "critical"],
          default: "medium",
        },
        actionTaken: {
          type: String,
          enum: ["none", "warning", "temporary_suspend", "permanent_ban"],
          default: "none",
        },
        actorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        targetType: {
          type: String,
          default: "",
          trim: true,
          maxlength: 40,
        },
        targetId: {
          type: String,
          default: "",
          trim: true,
          maxlength: 120,
        },
        count: { type: Number, default: 1 },
        reason: { type: String, default: "", trim: true, maxlength: 300 },
        expiresAt: { type: Date, default: null },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    lastActionAt: {
      type: Date,
      default: null,
    },
    lastActionType: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },
    lastSeverity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    lastEnforcementAction: {
      type: String,
      enum: ["none", "warning", "temporary_suspend", "permanent_ban"],
      default: "none",
    },
    lastModeratorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserStrike", UserStrikeSchema);
