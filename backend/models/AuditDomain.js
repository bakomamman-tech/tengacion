const mongoose = require("mongoose");

const AUDIT_DOMAINS = [
  "finance_settlement", "payments_entitlements", "payouts_creator_balances", "refunds_disputes",
  "subscriptions_pricing", "privacy_data_protection", "security_access_audit_logs", "vendors_subprocessors",
  "content_rights_takedowns", "moderation_appeals", "recommendations_experiments", "partner_sponsor_access",
  "apis_exports", "external_reporting", "market_readiness", "akuso_ai_governance",
];
const READINESS_STATES = ["unscoped", "scoped", "scheduled", "testing", "remediation", "internal_ready", "external_review_candidate", "blocked"];
const EVIDENCE_STATES = ["current", "stale", "incomplete", "disputed", "not_testable", "replaced", "withdrawn"];
const SHARING_LEVELS = ["internal_operations", "executive_review", "partner_due_diligence", "investor_due_diligence", "auditor_support", "regulator_support", "restricted_internal_only"];

const AuditDomainSchema = new mongoose.Schema({
  domainKey: { type: String, enum: AUDIT_DOMAINS, required: true, unique: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 220 },
  controlFamilies: [{ type: String, required: true, trim: true, maxlength: 200 }],
  relatedObligations: [{ type: String, trim: true, maxlength: 500 }],
  relatedPolicies: [{ type: String, trim: true, maxlength: 500 }],
  relatedWorkflows: [{ type: String, trim: true, maxlength: 200 }],
  ownerName: { type: String, required: true, trim: true, maxlength: 120 },
  ownerRole: { type: String, required: true, trim: true, maxlength: 120 },
  reviewerName: { type: String, required: true, trim: true, maxlength: 120 },
  reviewerRole: { type: String, required: true, trim: true, maxlength: 120 },
  evidenceSources: [{ type: String, required: true, trim: true, maxlength: 1000 }],
  impact: {
    userOrPartner: { type: Number, required: true, min: 0, max: 5 },
    financial: { type: Number, required: true, min: 0, max: 5 },
    privacy: { type: Number, required: true, min: 0, max: 5 },
    security: { type: Number, required: true, min: 0, max: 5 },
    ai: { type: Number, required: true, min: 0, max: 5 },
  },
  riskScore: { type: Number, required: true, min: 0, max: 100, index: true },
  reviewCadence: { type: String, required: true, trim: true, maxlength: 120 },
  readinessState: { type: String, enum: READINESS_STATES, default: "unscoped", index: true },
  evidenceState: { type: String, enum: EVIDENCE_STATES, default: "incomplete", index: true },
  selectedForFirstAudit: { type: Boolean, default: false, index: true },
  scheduledAt: { type: Date, default: null, index: true },
  auditOwnerSignoff: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  evidenceRoom: {
    scopeSummary: { type: String, required: true, trim: true, maxlength: 3000 },
    policyReferences: [{ type: String, trim: true, maxlength: 500 }],
    controlMapRefs: [{ type: String, trim: true, maxlength: 500 }],
    obligationMapRefs: [{ type: String, trim: true, maxlength: 500 }],
    evidenceIndexRefs: [{ type: String, trim: true, maxlength: 1000 }],
    samplePopulation: { type: String, default: "", trim: true, maxlength: 1500 },
    sampleSelectionMethod: { type: String, default: "", trim: true, maxlength: 1200 },
    reviewerNotes: { type: String, default: "", trim: true, maxlength: 3000 },
    sharingLevel: { type: String, enum: SHARING_LEVELS, default: "restricted_internal_only" },
  },
  nextReviewAt: { type: Date, required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  lastChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  history: [{
    readinessState: { type: String, enum: READINESS_STATES, required: true },
    evidenceState: { type: String, enum: EVIDENCE_STATES, required: true },
    at: { type: Date, default: Date.now },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
  }],
}, { timestamps: true });

AuditDomainSchema.index({ selectedForFirstAudit: 1, scheduledAt: 1, riskScore: -1 });

AuditDomainSchema.pre("validate", function () {
  if (this.riskScore >= 70 && (!(this.evidenceSources || []).length || !this.reviewCadence)) {
    this.invalidate("evidenceSources", "High-risk audit domains require evidence sources and a review cadence");
  }
  if (this.selectedForFirstAudit && !this.scheduledAt) this.invalidate("scheduledAt", "Selected first-audit domains require a visible schedule");
  if (["internal_ready", "external_review_candidate"].includes(this.readinessState) && this.evidenceState !== "current") {
    this.invalidate("evidenceState", "Audit readiness cannot rely on non-current evidence");
  }
  if (this.readinessState === "external_review_candidate" && !this.auditOwnerSignoff) {
    this.invalidate("auditOwnerSignoff", "External review candidates require control-owner signoff");
  }
});

module.exports = mongoose.model("AuditDomain", AuditDomainSchema);
module.exports.AUDIT_DOMAINS = AUDIT_DOMAINS;
module.exports.READINESS_STATES = READINESS_STATES;
module.exports.EVIDENCE_STATES = EVIDENCE_STATES;
module.exports.SHARING_LEVELS = SHARING_LEVELS;
