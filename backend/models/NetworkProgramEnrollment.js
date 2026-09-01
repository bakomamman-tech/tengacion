const mongoose = require("mongoose");
const { sanitizePlainObject } = require("../config/storage");

const NETWORK_PROGRAM_TYPES = [
  "catalog_collaboration",
  "launch_collaboration",
  "shared_campaign",
  "service_provider_program",
  "community_activation",
  "partner_opportunity",
];

const NETWORK_PROGRAM_STATUSES = [
  "candidate",
  "invited",
  "consented",
  "active",
  "completed",
  "paused",
  "withdrawn",
  "cancelled",
];

const NetworkProgramEnrollmentSchema = new mongoose.Schema(
  {
    programKey: { type: String, required: true, trim: true, lowercase: true, maxlength: 120, index: true },
    programType: { type: String, enum: NETWORK_PROGRAM_TYPES, required: true, index: true },
    creatorProfile: { type: mongoose.Schema.Types.ObjectId, ref: "CreatorProfile", required: true, index: true },
    creatorUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: NETWORK_PROGRAM_STATUSES, default: "candidate", index: true },
    ownerName: { type: String, required: true, trim: true, maxlength: 120 },
    ownerRole: { type: String, required: true, trim: true, maxlength: 120 },
    creatorBenefit: { type: String, required: true, trim: true, maxlength: 600 },
    creatorCommitment: { type: String, required: true, trim: true, maxlength: 600 },
    collaboratorProfileIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "CreatorProfile" }],
    providerName: { type: String, default: "", trim: true, maxlength: 160 },
    partnerIntegration: { type: mongoose.Schema.Types.ObjectId, ref: "PartnerIntegration", default: null },
    creatorConsentAt: { type: Date, default: null },
    baselineSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
    outcomeSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
    grossValue: { type: Number, default: 0, min: 0 },
    creatorEarnings: { type: Number, default: 0, min: 0 },
    providerCost: { type: Number, default: 0, min: 0 },
    supportMinutes: { type: Number, default: 0, min: 0 },
    creatorSatisfactionScore: { type: Number, default: null, min: 1, max: 5 },
    currency: { type: String, default: "NGN", trim: true, uppercase: true, maxlength: 10 },
    successMetric: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    stopCondition: { type: String, required: true, trim: true, maxlength: 600 },
    reviewAt: { type: Date, required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lastChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    history: [{
      status: { type: String, enum: NETWORK_PROGRAM_STATUSES, required: true },
      at: { type: Date, default: Date.now },
      actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      reason: { type: String, default: "", trim: true, maxlength: 600 },
    }],
  },
  { timestamps: true }
);

NetworkProgramEnrollmentSchema.index({ programKey: 1, creatorProfile: 1 }, { unique: true });
NetworkProgramEnrollmentSchema.index({ status: 1, reviewAt: 1 });

NetworkProgramEnrollmentSchema.pre("validate", function () {
  for (const field of ["baselineSnapshot", "outcomeSnapshot"]) {
    this[field] = sanitizePlainObject(this[field] || {}, {
      maxDepth: 2,
      maxKeys: 32,
      maxStringLength: 300,
      maxArrayLength: 16,
    });
  }
  if (["consented", "active", "completed"].includes(this.status) && !this.creatorConsentAt) {
    this.invalidate("creatorConsentAt", "Active network programs require recorded creator consent");
  }
  if (Number(this.creatorEarnings || 0) > Number(this.grossValue || 0)) {
    this.invalidate("creatorEarnings", "Creator earnings cannot exceed the program's stored gross value");
  }
});

module.exports = mongoose.model("NetworkProgramEnrollment", NetworkProgramEnrollmentSchema);
module.exports.NETWORK_PROGRAM_TYPES = NETWORK_PROGRAM_TYPES;
module.exports.NETWORK_PROGRAM_STATUSES = NETWORK_PROGRAM_STATUSES;
