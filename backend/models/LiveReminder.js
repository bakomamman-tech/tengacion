const mongoose = require("mongoose");

const LiveReminderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CreatorProfile",
      required: true,
      index: true,
    },
    roomName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 180,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "notified", "cancelled"],
      default: "active",
      index: true,
    },
    source: {
      type: String,
      enum: ["creator", "active_session", "manual"],
      default: "creator",
    },
    remindedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

LiveReminderSchema.index(
  { userId: 1, creatorId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
);
LiveReminderSchema.index({ creatorId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("LiveReminder", LiveReminderSchema);
