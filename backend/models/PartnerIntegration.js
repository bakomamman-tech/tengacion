const mongoose = require("mongoose");

const PARTNER_INTEGRATION_LEVELS = [
  "manual_report",
  "scheduled_export",
  "scoped_dashboard_access",
  "campaign_collaboration",
  "sponsor_package",
  "api_candidate",
];

const PARTNER_INTEGRATION_STATUSES = [
  "requested",
  "scoped",
  "privacy_review",
  "creator_consent",
  "approved",
  "active",
  "suspended",
  "renewal_review",
  "closed",
];

const PartnerIntegrationSchema = new mongoose.Schema(
  {
    integrationKey: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 120 },
    partnerName: { type: String, required: true, trim: true, maxlength: 180 },
    partnerType: { type: String, required: true, trim: true, lowercase: true, maxlength: 80 },
    level: { type: String, enum: PARTNER_INTEGRATION_LEVELS, required: true, index: true },
    status: { type: String, enum: PARTNER_INTEGRATION_STATUSES, default: "requested", index: true },
    ownerName: { type: String, required: true, trim: true, maxlength: 120 },
    ownerRole: { type: String, required: true, trim: true, maxlength: 120 },
    allowedData: [{ type: String, trim: true, lowercase: true, maxlength: 100 }],
    prohibitedData: [{ type: String, trim: true, lowercase: true, maxlength: 100 }],
    creatorConsentRequired: { type: Boolean, default: true },
    creatorConsentAt: { type: Date, default: null },
    privacyReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    privacyReviewedAt: { type: Date, default: null },
    sponsorLabel: { type: String, default: "", trim: true, maxlength: 160 },
    revocationPath: { type: String, required: true, trim: true, maxlength: 500 },
    auditEvent: { type: String, required: true, trim: true, lowercase: true, maxlength: 100 },
    renewalMetric: { type: String, required: true, trim: true, maxlength: 240 },
    accessExpiresAt: { type: Date, required: true, index: true },
    reviewAt: { type: Date, required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lastChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    history: [{
      status: { type: String, enum: PARTNER_INTEGRATION_STATUSES, required: true },
      at: { type: Date, default: Date.now },
      actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      reason: { type: String, default: "", trim: true, maxlength: 600 },
    }],
  },
  { timestamps: true }
);

PartnerIntegrationSchema.index({ status: 1, reviewAt: 1, accessExpiresAt: 1 });
PartnerIntegrationSchema.index({ partnerType: 1, level: 1, status: 1 });

PartnerIntegrationSchema.pre("validate", function () {
  const prohibited = new Set((this.prohibitedData || []).map(String));
  const requiredProhibitions = ["payment_identifiers", "private_user_behavior", "identity_verification", "moderation_sensitive_detail"];
  if (requiredProhibitions.some((key) => !prohibited.has(key))) {
    this.invalidate("prohibitedData", "Partner integrations must prohibit payment, private behavior, identity verification, and moderation-sensitive data");
  }
  if (["approved", "active", "renewal_review"].includes(this.status) && (!this.privacyReviewedBy || !this.privacyReviewedAt)) {
    this.invalidate("privacyReviewedBy", "Approved partner access requires a completed privacy review");
  }
  if (["approved", "active", "renewal_review"].includes(this.status) && this.creatorConsentRequired && !this.creatorConsentAt) {
    this.invalidate("creatorConsentAt", "Approved partner access requires creator consent when the scope includes creators");
  }
  if (this.level === "sponsor_package" && ["approved", "active", "renewal_review"].includes(this.status) && !String(this.sponsorLabel || "").trim()) {
    this.invalidate("sponsorLabel", "Active sponsor packages require a visible disclosure label");
  }
  if (this.level === "api_candidate" && ["approved", "active", "renewal_review"].includes(this.status)) {
    this.invalidate("status", "API candidates require a later network/API implementation before activation");
  }
});

module.exports = mongoose.model("PartnerIntegration", PartnerIntegrationSchema);
module.exports.PARTNER_INTEGRATION_LEVELS = PARTNER_INTEGRATION_LEVELS;
module.exports.PARTNER_INTEGRATION_STATUSES = PARTNER_INTEGRATION_STATUSES;
