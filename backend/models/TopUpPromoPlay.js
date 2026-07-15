const mongoose = require("mongoose");

const CAMPAIGN_KEY = "top-up-bank-account-promo-2026";
const CLAIM_STATUS_VALUES = ["pending", "contacted", "paid", "disqualified"];

const TopUpPromoPlaySchema = new mongoose.Schema(
  {
    campaignKey: {
      type: String,
      required: true,
      default: CAMPAIGN_KEY,
      trim: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    chestNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 50,
      index: true,
    },
    outcome: {
      type: String,
      required: true,
      enum: ["water", "win"],
      index: true,
    },
    prizeAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    passcode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 8,
      default: undefined,
    },
    contactSnapshot: {
      name: { type: String, required: true, trim: true, maxlength: 120 },
      username: { type: String, required: true, trim: true, maxlength: 30 },
      email: { type: String, required: true, trim: true, lowercase: true, maxlength: 180 },
      phone: { type: String, required: true, trim: true, maxlength: 40 },
    },
    discoveredAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    claimStatus: {
      type: String,
      enum: CLAIM_STATUS_VALUES,
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

TopUpPromoPlaySchema.index({ campaignKey: 1, userId: 1 }, { unique: true });
TopUpPromoPlaySchema.index({ passcode: 1 }, { unique: true, sparse: true });
TopUpPromoPlaySchema.index({ campaignKey: 1, outcome: 1, discoveredAt: -1 });

TopUpPromoPlaySchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("TopUpPromoPlay", TopUpPromoPlaySchema);
module.exports.CAMPAIGN_KEY = CAMPAIGN_KEY;
module.exports.CLAIM_STATUS_VALUES = CLAIM_STATUS_VALUES;
