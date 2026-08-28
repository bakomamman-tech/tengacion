const mongoose = require("mongoose");

const REFERRAL_MILESTONES = [
  "link_opened",
  "signup",
  "first_follow",
  "first_preview",
  "first_purchase",
  "first_subscription",
  "d7_return",
];

const ReferralAttributionEventSchema = new mongoose.Schema(
  {
    attribution: { type: mongoose.Schema.Types.ObjectId, ref: "ReferralAttribution", required: true, index: true },
    milestone: { type: String, enum: REFERRAL_MILESTONES, required: true, index: true },
    actorHash: { type: String, required: true, select: false, maxlength: 128 },
  },
  { timestamps: true }
);

ReferralAttributionEventSchema.index(
  { attribution: 1, milestone: 1, actorHash: 1 },
  { unique: true }
);
ReferralAttributionEventSchema.index({ milestone: 1, createdAt: -1 });

module.exports = mongoose.model("ReferralAttributionEvent", ReferralAttributionEventSchema);
module.exports.REFERRAL_MILESTONES = REFERRAL_MILESTONES;
