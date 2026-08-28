const mongoose = require("mongoose");

const REFERRAL_SOURCE_TYPES = [
  "creator_profile_share",
  "content_share",
  "campaign_link",
  "partner_link",
  "fan_invite",
  "live_event_invite",
];

const ReferralAttributionSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 64 },
    sourceType: { type: String, enum: REFERRAL_SOURCE_TYPES, required: true, index: true },
    sourceKey: { type: String, default: "", trim: true, lowercase: true, maxlength: 120, index: true },
    creatorProfile: { type: mongoose.Schema.Types.ObjectId, ref: "CreatorProfile", default: null, index: true },
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: "RevenueCampaign", default: null, index: true },
    partnerPilot: { type: mongoose.Schema.Types.ObjectId, ref: "PartnerPilot", default: null, index: true },
    destinationPath: { type: String, required: true, trim: true, maxlength: 500 },
    label: { type: String, default: "", trim: true, maxlength: 160 },
    status: { type: String, enum: ["active", "paused", "expired", "revoked"], default: "active", index: true },
    expiresAt: { type: Date, required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    counters: {
      inviteSent: { type: Number, default: 1, min: 0 },
      linkOpened: { type: Number, default: 0, min: 0 },
      signup: { type: Number, default: 0, min: 0 },
      firstFollow: { type: Number, default: 0, min: 0 },
      firstPreview: { type: Number, default: 0, min: 0 },
      firstPurchase: { type: Number, default: 0, min: 0 },
      firstSubscription: { type: Number, default: 0, min: 0 },
      d7Return: { type: Number, default: 0, min: 0 },
    },
  },
  { timestamps: true }
);

ReferralAttributionSchema.index({ creatorProfile: 1, createdAt: -1 });
ReferralAttributionSchema.index({ sourceType: 1, sourceKey: 1, createdAt: -1 });

ReferralAttributionSchema.pre("validate", function () {
  const destination = String(this.destinationPath || "");
  if (!destination.startsWith("/") || destination.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(destination)) {
    this.invalidate("destinationPath", "Referral destination must be a safe internal path");
  }
});

module.exports = mongoose.model("ReferralAttribution", ReferralAttributionSchema);
module.exports.REFERRAL_SOURCE_TYPES = REFERRAL_SOURCE_TYPES;
