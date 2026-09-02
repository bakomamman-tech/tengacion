const mongoose = require("mongoose");

const TEST_RESULTS = ["not_run", "pass", "pass_with_observation", "fail", "not_testable", "out_of_scope"];
const TEST_METHODS = ["sample_transaction_review", "access_grant_review", "workflow_state_review", "log_review", "policy_trace_review", "evidence_freshness_review", "user_facing_copy_review", "system_configuration_review", "akuso_output_review"];

const AuditControlTestSchema = new mongoose.Schema({
  testKey: { type: String, required: true, unique: true, index: true, trim: true, lowercase: true, maxlength: 160 },
  domainKey: { type: String, enum: require("./AuditDomain").AUDIT_DOMAINS, required: true, index: true },
  auditDomain: { type: mongoose.Schema.Types.ObjectId, ref: "AuditDomain", required: true, index: true },
  controlKey: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
  objective: { type: String, required: true, trim: true, maxlength: 1500 },
  population: { type: String, required: true, trim: true, maxlength: 1500 },
  populationCount: { type: Number, default: null, min: 0 },
  sampleSize: { type: Number, required: true, min: 1 },
  sampleSelectionMethod: { type: String, required: true, trim: true, maxlength: 1200 },
  testingMethod: { type: String, enum: TEST_METHODS, required: true },
  expectedEvidence: [{ type: String, required: true, trim: true, maxlength: 1000 }],
  actualEvidenceRefs: [{ type: String, trim: true, maxlength: 1000 }],
  result: { type: String, enum: TEST_RESULTS, default: "not_run", index: true },
  exceptionSummary: { type: String, default: "", trim: true, maxlength: 2500 },
  rootCause: { type: String, default: "", trim: true, maxlength: 2000 },
  reviewerName: { type: String, required: true, trim: true, maxlength: 120 },
  reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  testedAt: { type: Date, default: null, index: true },
  retestRequired: { type: Boolean, default: false },
  retestDueAt: { type: Date, default: null },
  closureEvidenceRefs: [{ type: String, trim: true, maxlength: 1000 }],
  evidenceState: { type: String, enum: require("./AuditDomain").EVIDENCE_STATES, default: "incomplete" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  lastChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  history: [{
    result: { type: String, enum: TEST_RESULTS, required: true },
    at: { type: Date, default: Date.now },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
  }],
}, { timestamps: true });

AuditControlTestSchema.index({ domainKey: 1, result: 1, testedAt: -1 });

AuditControlTestSchema.pre("validate", function () {
  this.testKey = String(this.testKey || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  this.controlKey = String(this.controlKey || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!['not_run', 'not_testable', 'out_of_scope'].includes(this.result) && (!this.reviewerId || !this.testedAt || !(this.actualEvidenceRefs || []).length)) {
    this.invalidate("actualEvidenceRefs", "Completed control tests require actual evidence, a reviewer, and a test time");
  }
  if (this.result === "fail" && (!String(this.exceptionSummary || "").trim() || !String(this.rootCause || "").trim())) {
    this.invalidate("exceptionSummary", "Failed control tests require an exception and root cause");
  }
  if (this.retestRequired && !this.retestDueAt) this.invalidate("retestDueAt", "Required retests need a due date");
});

module.exports = mongoose.model("AuditControlTest", AuditControlTestSchema);
module.exports.TEST_RESULTS = TEST_RESULTS;
module.exports.TEST_METHODS = TEST_METHODS;
