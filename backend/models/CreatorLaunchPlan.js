const mongoose = require("mongoose");
const { sanitizePlainObject } = require("../config/storage");

const CREATOR_PLAYBOOK_TYPES = [
  "first_paid_music_drop",
  "first_ebook_or_chapter_launch",
  "podcast_subscription_launch",
  "live_event_launch",
  "marketplace_product_spotlight",
  "dormant_creator_comeback",
];

const CREATOR_OFFER_TYPES = [
  "paid_drop",
  "bundle",
  "subscription_package",
  "live_event_pass",
  "marketplace_spotlight",
];

const CREATOR_LAUNCH_PLAN_STATUSES = [
  "draft",
  "planning",
  "review_required",
  "approved",
  "scheduled",
  "launched",
  "paused",
  "completed",
  "cancelled",
];

const checklistItemSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true, maxlength: 80 },
    label: { type: String, required: true, trim: true, maxlength: 180 },
    complete: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  { _id: false }
);

const CreatorLaunchPlanSchema = new mongoose.Schema(
  {
    creatorProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CreatorProfile",
      required: true,
      index: true,
    },
    creatorUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    planKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 120,
    },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    playbookType: {
      type: String,
      enum: CREATOR_PLAYBOOK_TYPES,
      required: true,
      index: true,
    },
    offerType: {
      type: String,
      enum: CREATOR_OFFER_TYPES,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: CREATOR_LAUNCH_PLAN_STATUSES,
      default: "draft",
      index: true,
    },
    contentType: { type: String, default: "", trim: true, lowercase: true, maxlength: 40 },
    contentId: { type: mongoose.Schema.Types.ObjectId, default: null },
    launchAt: { type: Date, default: null, index: true },
    price: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "NGN", trim: true, uppercase: true, maxlength: 10 },
    requiredMetadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    coverReady: { type: Boolean, default: false },
    previewReady: { type: Boolean, default: false },
    payoutReadySnapshot: { type: Boolean, default: false },
    announcementDraft: { type: String, default: "", trim: true, maxlength: 3000 },
    fanUpdatePlan: { type: String, default: "", trim: true, maxlength: 1200 },
    eligibilityNotes: { type: String, default: "", trim: true, maxlength: 800 },
    successMetric: { type: String, default: "", trim: true, maxlength: 300 },
    postLaunchReviewMetric: { type: String, default: "", trim: true, maxlength: 300 },
    stopCondition: { type: String, default: "", trim: true, maxlength: 400 },
    checklist: { type: [checklistItemSchema], default: [] },
    riskLevel: { type: String, enum: ["low", "standard", "elevated"], default: "standard", index: true },
    reviewReason: { type: String, default: "", trim: true, maxlength: 600 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: "", trim: true, maxlength: 800 },
    statusHistory: [
      {
        status: { type: String, enum: CREATOR_LAUNCH_PLAN_STATUSES, required: true },
        at: { type: Date, default: Date.now },
        actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        actorRole: { type: String, default: "creator", trim: true, lowercase: true, maxlength: 40 },
        reason: { type: String, default: "", trim: true, maxlength: 500 },
      },
    ],
  },
  { timestamps: true }
);

CreatorLaunchPlanSchema.index({ creatorProfile: 1, status: 1, launchAt: 1 });
CreatorLaunchPlanSchema.index({ playbookType: 1, status: 1, updatedAt: -1 });

CreatorLaunchPlanSchema.pre("validate", function () {
  if (this.requiredMetadata && typeof this.requiredMetadata === "object") {
    this.requiredMetadata = sanitizePlainObject(this.requiredMetadata, {
      maxDepth: 2,
      maxKeys: 16,
      maxStringLength: 300,
      maxArrayLength: 10,
    });
  }
  if (this.launchAt && this.launchAt < new Date(this.createdAt || Date.now() - 365 * 24 * 60 * 60 * 1000)) {
    this.invalidate("launchAt", "Launch date is outside the supported planning window");
  }
});

module.exports = mongoose.model("CreatorLaunchPlan", CreatorLaunchPlanSchema);
module.exports.CREATOR_PLAYBOOK_TYPES = CREATOR_PLAYBOOK_TYPES;
module.exports.CREATOR_OFFER_TYPES = CREATOR_OFFER_TYPES;
module.exports.CREATOR_LAUNCH_PLAN_STATUSES = CREATOR_LAUNCH_PLAN_STATUSES;
