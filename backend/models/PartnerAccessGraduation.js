const mongoose = require("mongoose");

const PARTNER_ACCESS_LEVELS = [
  "manual_report",
  "scheduled_export",
  "scoped_dashboard_access",
  "campaign_collaboration",
  "sponsor_package",
  "api_candidate",
  "approved_api_integration",
];

const PARTNER_GRADUATION_STATUSES = ["assessing", "blocked", "review_required", "approved", "active", "paused", "revoked"];
const PARTNER_GRADUATION_GATES = [
  "stable_data_contract",
  "permission_model",
  "revocation",
  "rate_limits",
  "audit",
  "security",
  "privacy",
  "retention",
  "rollback",
  "renewal",
  "finance_reconciliation",
  "export_reliability",
];

const gateSchema = new mongoose.Schema(
  {
    key: { type: String, enum: PARTNER_GRADUATION_GATES, required: true },
    status: { type: String, enum: ["not_assessed", "blocked", "watch", "ready"], default: "not_assessed" },
    evidence: { type: String, default: "", trim: true, maxlength: 1000 },
    reviewedAt: { type: Date, default: null },
  },
  { _id: false }
);

const PartnerAccessGraduationSchema = new mongoose.Schema(
  {
    integration: { type: mongoose.Schema.Types.ObjectId, ref: "PartnerIntegration", required: true, unique: true },
    currentLevel: { type: String, enum: PARTNER_ACCESS_LEVELS, required: true },
    proposedLevel: { type: String, enum: PARTNER_ACCESS_LEVELS, required: true, index: true },
    status: { type: String, enum: PARTNER_GRADUATION_STATUSES, default: "assessing", index: true },
    ownerName: { type: String, required: true, trim: true, maxlength: 120 },
    ownerRole: { type: String, required: true, trim: true, maxlength: 120 },
    gates: { type: [gateSchema], default: [] },
    allowedData: [{ type: String, trim: true, lowercase: true, maxlength: 100 }],
    prohibitedData: [{ type: String, trim: true, lowercase: true, maxlength: 100 }],
    approvalReason: { type: String, default: "", trim: true, maxlength: 1000 },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    reviewAt: { type: Date, required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lastChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    history: [{
      status: { type: String, enum: PARTNER_GRADUATION_STATUSES, required: true },
      at: { type: Date, default: Date.now },
      actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      reason: { type: String, default: "", trim: true, maxlength: 600 },
    }],
  },
  { timestamps: true }
);

PartnerAccessGraduationSchema.index({ status: 1, reviewAt: 1, expiresAt: 1 });

PartnerAccessGraduationSchema.pre("validate", function () {
  const requiredProhibitions = ["payment_identifiers", "private_user_behavior", "identity_verification", "moderation_sensitive_detail"];
  const prohibited = new Set((this.prohibitedData || []).map(String));
  if (requiredProhibitions.some((key) => !prohibited.has(key))) {
    this.invalidate("prohibitedData", "Graduated access must retain all protected-data prohibitions");
  }
  if (this.expiresAt && this.reviewAt && this.reviewAt > this.expiresAt) {
    this.invalidate("reviewAt", "Partner access must be reviewed before it expires");
  }
  if (["approved", "active"].includes(this.status)) {
    const byKey = new Map((this.gates || []).map((gate) => [gate.key, gate]));
    const missing = PARTNER_GRADUATION_GATES.filter((key) => {
      const gate = byKey.get(key);
      return !gate || gate.status !== "ready" || !String(gate.evidence || "").trim() || !gate.reviewedAt;
    });
    if (missing.length) this.invalidate("gates", `Approved access is missing reviewed gates: ${missing.join(", ")}`);
    if (!this.approvedBy || !this.approvedAt || !String(this.approvalReason || "").trim()) {
      this.invalidate("approvedBy", "Approved access requires a human approval, timestamp, and reason");
    }
  }
});

module.exports = mongoose.model("PartnerAccessGraduation", PartnerAccessGraduationSchema);
module.exports.PARTNER_ACCESS_LEVELS = PARTNER_ACCESS_LEVELS;
module.exports.PARTNER_GRADUATION_STATUSES = PARTNER_GRADUATION_STATUSES;
module.exports.PARTNER_GRADUATION_GATES = PARTNER_GRADUATION_GATES;
