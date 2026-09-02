const mongoose = require("mongoose");

const PACK_TYPES = ["finance_close", "partner", "api", "market", "data", "experiment", "recommendation", "privacy_consent", "trust_safety", "rights", "akuso", "due_diligence"];
const SHARING_LEVELS = ["internal_only", "finance", "creator_support", "partner_success", "executive_review", "partner_shareable", "sponsor_shareable", "investor_executive_shareable", "regulator_audit_support", "restricted_internal"];
const READINESS_STATES = ["not_configured", "needs_review", "ready", "watch", "blocked", "withdrawn"];
const EVIDENCE_FRESHNESS = ["current", "stale", "delayed", "disputed", "blocked", "withdrawn"];

const exceptionSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true, maxlength: 120 },
  severity: { type: String, enum: ["low", "medium", "high", "critical"], required: true },
  summary: { type: String, required: true, trim: true, maxlength: 1500 },
  ownerName: { type: String, required: true, trim: true, maxlength: 120 },
  dueAt: { type: Date, required: true },
  status: { type: String, enum: ["open", "remediating", "resolved", "risk_accepted"], default: "open" },
}, { _id: false });

const AssuranceEvidencePackSchema = new mongoose.Schema({
  packKey: { type: String, required: true, unique: true, index: true, trim: true, lowercase: true, maxlength: 140 },
  packType: { type: String, enum: PACK_TYPES, required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 220 },
  workflowSummary: { type: String, required: true, trim: true, maxlength: 3000 },
  ownerName: { type: String, required: true, trim: true, maxlength: 120 },
  ownerRole: { type: String, required: true, trim: true, maxlength: 120 },
  reviewerName: { type: String, required: true, trim: true, maxlength: 120 },
  controlKeys: [{ type: String, trim: true, lowercase: true, maxlength: 140 }],
  sourceSystems: [{ type: String, trim: true, maxlength: 200 }],
  metricSnapshots: [{
    key: { type: String, required: true, trim: true, maxlength: 120 },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
    source: { type: String, required: true, trim: true, maxlength: 300 },
    observedAt: { type: Date, required: true },
    trustState: { type: String, enum: ["trusted", "watch", "stale", "disputed", "blocked"], required: true },
  }],
  exceptions: { type: [exceptionSchema], default: [] },
  reconciliationStatus: { type: String, enum: ["not_applicable", "not_run", "incomplete", "reconciled", "variance_open", "blocked"], default: "not_run" },
  incidentRefs: [{ type: String, trim: true, maxlength: 200 }],
  impactSummary: { type: String, default: "", trim: true, maxlength: 2000 },
  approvalHistory: [{
    decision: { type: String, enum: ["submitted", "approved", "rejected", "revoked"], required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    at: { type: Date, default: Date.now },
    reason: { type: String, required: true, trim: true, maxlength: 1200 },
  }],
  openRisks: [{ type: String, trim: true, maxlength: 1200 }],
  evidenceFreshness: { type: String, enum: EVIDENCE_FRESHNESS, default: "delayed", index: true },
  readinessState: { type: String, enum: READINESS_STATES, default: "needs_review", index: true },
  sharingLevel: { type: String, enum: SHARING_LEVELS, default: "internal_only", index: true },
  externalShareApproved: { type: Boolean, default: false },
  containsRestrictedDetails: { type: Boolean, default: true },
  nextReviewAt: { type: Date, required: true, index: true },
  approvalExpiresAt: { type: Date, default: null, index: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reviewedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  lastChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

AssuranceEvidencePackSchema.index({ packType: 1, readinessState: 1, nextReviewAt: 1 });

AssuranceEvidencePackSchema.pre("validate", function () {
  this.packKey = String(this.packKey || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const unresolvedHighRisk = (this.exceptions || []).some((item) => ["high", "critical"].includes(item.severity) && !["resolved", "risk_accepted"].includes(item.status));
  if (this.readinessState === "ready") {
    if (this.evidenceFreshness !== "current" || !this.reviewedBy || !this.reviewedAt || unresolvedHighRisk) {
      this.invalidate("readinessState", "Ready evidence packs require current reviewed evidence with no unresolved high-risk exception");
    }
    if (!this.approvalExpiresAt) this.invalidate("approvalExpiresAt", "Ready evidence packs require an approval shelf life");
  }
  const externallyShareable = ["partner_shareable", "sponsor_shareable", "investor_executive_shareable", "regulator_audit_support"].includes(this.sharingLevel);
  if (externallyShareable && (!this.externalShareApproved || !this.reviewedBy || this.containsRestrictedDetails || this.evidenceFreshness !== "current")) {
    this.invalidate("sharingLevel", "External assurance sharing requires approved, current, sanitized evidence");
  }
});

module.exports = mongoose.model("AssuranceEvidencePack", AssuranceEvidencePackSchema);
module.exports.PACK_TYPES = PACK_TYPES;
module.exports.SHARING_LEVELS = SHARING_LEVELS;
module.exports.READINESS_STATES = READINESS_STATES;
