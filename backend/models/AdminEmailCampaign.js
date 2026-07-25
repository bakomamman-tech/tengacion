const mongoose = require("mongoose");

const AdminEmailCampaignSchema = new mongoose.Schema(
  {
    campaignKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 120,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 220,
    },
    status: {
      type: String,
      enum: ["queued", "sending", "completed", "partial", "failed"],
      default: "queued",
      index: true,
    },
    launchAt: {
      type: Date,
      required: true,
    },
    flyerUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    audienceCount: { type: Number, default: 0, min: 0 },
    sentCount: { type: Number, default: 0, min: 0 },
    failedCount: { type: Number, default: 0, min: 0 },
    pendingCount: { type: Number, default: 0, min: 0 },
    runCount: { type: Number, default: 0, min: 0 },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    lastHeartbeatAt: { type: Date, default: null },
    lastError: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdminEmailCampaign", AdminEmailCampaignSchema);
