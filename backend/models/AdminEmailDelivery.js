const mongoose = require("mongoose");

const AdminEmailDeliverySchema = new mongoose.Schema(
  {
    campaignKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 320,
    },
    name: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
    },
    username: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },
    status: {
      type: String,
      enum: ["pending", "sending", "sent", "failed"],
      default: "pending",
      index: true,
    },
    attempts: { type: Number, default: 0, min: 0 },
    lastRunId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },
    sentAt: { type: Date, default: null },
    lastError: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true }
);

AdminEmailDeliverySchema.index(
  { campaignKey: 1, userId: 1 },
  { unique: true, name: "admin_email_campaign_recipient" }
);
AdminEmailDeliverySchema.index({ campaignKey: 1, status: 1, attempts: 1 });

module.exports = mongoose.model("AdminEmailDelivery", AdminEmailDeliverySchema);
