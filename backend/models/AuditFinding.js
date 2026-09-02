const mongoose = require("mongoose");

const FINDING_SEVERITIES = ["observation", "low", "medium", "high", "critical"];
const RETEST_STATES = ["not_ready", "ready_for_retest", "retest_in_progress", "passed", "failed", "risk_accepted"];
const FINDING_STATUSES = ["open", "remediating", "retest", "closed", "risk_accepted"];

const AuditFindingSchema = new mongoose.Schema({
  findingKey: { type: String, required: true, unique: true, index: true, trim: true, lowercase: true, maxlength: 160 },
  domainKey: { type: String, enum: require("./AuditDomain").AUDIT_DOMAINS, required: true, index: true },
  controlTest: { type: mongoose.Schema.Types.ObjectId, ref: "AuditControlTest", default: null, index: true },
  severity: { type: String, enum: FINDING_SEVERITIES, required: true, index: true },
  affectedObligation: { type: String, required: true, trim: true, maxlength: 1000 },
  affectedControl: { type: String, required: true, trim: true, maxlength: 500 },
  affectedUsersOrPartners: { type: String, required: true, trim: true, maxlength: 1500 },
  rootCause: { type: String, required: true, trim: true, maxlength: 2000 },
  evidenceRefs: [{ type: String, required: true, trim: true, maxlength: 1000 }],
  ownerName: { type: String, required: true, trim: true, maxlength: 120 },
  ownerRole: { type: String, required: true, trim: true, maxlength: 120 },
  dueAt: { type: Date, required: true, index: true },
  remediationPlan: { type: String, required: true, trim: true, maxlength: 2500 },
  compensatingControl: { type: String, default: "", trim: true, maxlength: 1800 },
  acceptedRisk: {
    accepted: { type: Boolean, default: false },
    ownerName: { type: String, default: "", trim: true, maxlength: 120 },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    reviewTrigger: { type: String, default: "", trim: true, maxlength: 1000 },
    reason: { type: String, default: "", trim: true, maxlength: 1500 },
  },
  retestOwnerName: { type: String, required: true, trim: true, maxlength: 120 },
  retestState: { type: String, enum: RETEST_STATES, default: "not_ready", index: true },
  retestAt: { type: Date, default: null },
  retestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  closureEvidenceRefs: [{ type: String, trim: true, maxlength: 1000 }],
  status: { type: String, enum: FINDING_STATUSES, default: "open", index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  lastChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  history: [{
    status: { type: String, enum: FINDING_STATUSES, required: true },
    retestState: { type: String, enum: RETEST_STATES, required: true },
    at: { type: Date, default: Date.now },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
  }],
}, { timestamps: true });

AuditFindingSchema.index({ severity: 1, status: 1, dueAt: 1 });

AuditFindingSchema.pre("validate", function () {
  this.findingKey = String(this.findingKey || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (this.status === "closed" && (this.retestState !== "passed" || !(this.closureEvidenceRefs || []).length || !this.retestedBy || !this.retestAt)) {
    this.invalidate("closureEvidenceRefs", "Closed findings require a passed independent retest and closure evidence");
  }
  if (this.status === "risk_accepted" || this.retestState === "risk_accepted" || this.acceptedRisk?.accepted) {
    const risk = this.acceptedRisk || {};
    if (!risk.accepted || !risk.ownerName || !risk.approvedBy || !risk.approvedAt || !risk.expiresAt || !risk.reviewTrigger || !this.compensatingControl) {
      this.invalidate("acceptedRisk", "Accepted risk requires an owner, approver, expiry, review trigger, and compensating control");
    }
  }
});

module.exports = mongoose.model("AuditFinding", AuditFindingSchema);
module.exports.FINDING_SEVERITIES = FINDING_SEVERITIES;
module.exports.RETEST_STATES = RETEST_STATES;
module.exports.FINDING_STATUSES = FINDING_STATUSES;
