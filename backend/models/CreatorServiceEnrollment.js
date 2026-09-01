const mongoose = require("mongoose");
const { sanitizePlainObject } = require("../config/storage");

const CREATOR_SERVICE_PROGRAMS = [
  "launch_coaching",
  "catalog_quality_review",
  "pricing_and_packaging_review",
  "subscription_growth_review",
  "live_event_planning",
  "campaign_readiness",
  "rights_and_takedown_readiness",
  "payout_and_finance_readiness",
];

const CREATOR_SERVICE_STATUSES = [
  "candidate",
  "enrolled",
  "active",
  "completed",
  "paused",
  "withdrawn",
  "declined",
];

const serviceStepSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true, lowercase: true, maxlength: 80 },
    label: { type: String, required: true, trim: true, maxlength: 180 },
    complete: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  { _id: false }
);

const CreatorServiceEnrollmentSchema = new mongoose.Schema(
  {
    creatorProfile: { type: mongoose.Schema.Types.ObjectId, ref: "CreatorProfile", required: true, index: true },
    creatorUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    programKey: { type: String, enum: CREATOR_SERVICE_PROGRAMS, required: true, index: true },
    serviceTier: { type: String, enum: ["basic_support", "premium_service"], default: "basic_support", index: true },
    status: { type: String, enum: CREATOR_SERVICE_STATUSES, default: "candidate", index: true },
    ownerName: { type: String, required: true, trim: true, maxlength: 120 },
    ownerRole: { type: String, required: true, trim: true, maxlength: 120 },
    creatorCommitment: { type: String, required: true, trim: true, maxlength: 800 },
    expectedOutcome: { type: String, required: true, trim: true, maxlength: 600 },
    successMetric: { type: String, required: true, trim: true, maxlength: 240 },
    graduationCondition: { type: String, required: true, trim: true, maxlength: 500 },
    escalationPath: { type: String, required: true, trim: true, maxlength: 500 },
    commercialTerms: { type: String, default: "", trim: true, maxlength: 800 },
    creatorConsentAt: { type: Date, default: null },
    baselineSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
    outcomeSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
    creatorSatisfactionScore: { type: Number, default: null, min: 1, max: 5 },
    supportMinutes: { type: Number, default: 0, min: 0 },
    estimatedOperatingCost: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "NGN", trim: true, uppercase: true, maxlength: 10 },
    steps: { type: [serviceStepSchema], default: [] },
    enrolledAt: { type: Date, default: null },
    reviewAt: { type: Date, required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lastChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    history: [{
      status: { type: String, enum: CREATOR_SERVICE_STATUSES, required: true },
      at: { type: Date, default: Date.now },
      actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      reason: { type: String, default: "", trim: true, maxlength: 600 },
    }],
  },
  { timestamps: true }
);

CreatorServiceEnrollmentSchema.index({ creatorProfile: 1, programKey: 1 }, { unique: true });
CreatorServiceEnrollmentSchema.index({ programKey: 1, status: 1, reviewAt: 1 });

CreatorServiceEnrollmentSchema.pre("validate", function () {
  for (const field of ["baselineSnapshot", "outcomeSnapshot"]) {
    this[field] = sanitizePlainObject(this[field] || {}, {
      maxDepth: 2,
      maxKeys: 24,
      maxStringLength: 300,
      maxArrayLength: 12,
    });
  }
  if (this.serviceTier === "premium_service" && !String(this.commercialTerms || "").trim()) {
    this.invalidate("commercialTerms", "Premium creator services require explicit commercial terms");
  }
  if (["enrolled", "active", "completed"].includes(this.status) && !this.creatorConsentAt) {
    this.invalidate("creatorConsentAt", "Active creator services require recorded creator consent");
  }
});

module.exports = mongoose.model("CreatorServiceEnrollment", CreatorServiceEnrollmentSchema);
module.exports.CREATOR_SERVICE_PROGRAMS = CREATOR_SERVICE_PROGRAMS;
module.exports.CREATOR_SERVICE_STATUSES = CREATOR_SERVICE_STATUSES;
