const mongoose = require("mongoose");
const { sanitizePlainObject } = require("../config/storage");

const REVENUE_CAMPAIGN_TYPES = [
  "creator_drop",
  "subscription_launch",
  "bundle_offer",
  "live_event_pass",
  "marketplace_creator_spotlight",
  "partner_sponsored_feature",
];

const REVENUE_CAMPAIGN_STATUSES = [
  "draft",
  "ready",
  "active",
  "paused",
  "completed",
  "cancelled",
];

const RevenueCampaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    campaignKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 100,
      index: true,
    },
    type: {
      type: String,
      enum: REVENUE_CAMPAIGN_TYPES,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: REVENUE_CAMPAIGN_STATUSES,
      default: "draft",
      required: true,
      index: true,
    },
    ownerName: { type: String, default: "", trim: true, maxlength: 120 },
    ownerRole: {
      type: String,
      default: "Product and growth",
      trim: true,
      maxlength: 120,
    },
    startAt: { type: Date, default: null, index: true },
    endAt: { type: Date, default: null, index: true },
    eligibleCreatorIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "CreatorProfile" },
    ],
    eligibleContentIds: [{ type: mongoose.Schema.Types.ObjectId }],
    currency: {
      type: String,
      default: "NGN",
      trim: true,
      uppercase: true,
      maxlength: 10,
    },
    priceRule: {
      type: String,
      default: "",
      trim: true,
      maxlength: 240,
    },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    expectedMarginImpact: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },
    refundAndDisputeHandling: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    successMetric: {
      type: String,
      default: "",
      trim: true,
      maxlength: 240,
    },
    ledgerTrackingKey: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 100,
      index: true,
    },
    rollbackPlan: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    guardrails: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastChangedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    statusHistory: [
      {
        status: {
          type: String,
          enum: REVENUE_CAMPAIGN_STATUSES,
          required: true,
        },
        at: { type: Date, default: Date.now },
        actorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        reason: { type: String, default: "", trim: true, maxlength: 500 },
      },
    ],
  },
  { timestamps: true }
);

RevenueCampaignSchema.index({ status: 1, startAt: 1, endAt: 1 });
RevenueCampaignSchema.index({ eligibleCreatorIds: 1, status: 1 });

RevenueCampaignSchema.pre("validate", function () {
  if (this.endAt && this.startAt && this.endAt <= this.startAt) {
    this.invalidate("endAt", "Campaign end must be after its start");
  }
  if (this.guardrails && typeof this.guardrails === "object") {
    this.guardrails = sanitizePlainObject(this.guardrails, {
      maxDepth: 2,
      maxKeys: 18,
      maxStringLength: 300,
      maxArrayLength: 10,
    });
  }
});

module.exports = mongoose.model("RevenueCampaign", RevenueCampaignSchema);
module.exports.REVENUE_CAMPAIGN_TYPES = REVENUE_CAMPAIGN_TYPES;
module.exports.REVENUE_CAMPAIGN_STATUSES = REVENUE_CAMPAIGN_STATUSES;
