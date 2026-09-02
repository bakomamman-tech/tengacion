const mongoose = require("mongoose");

const DRILL_STATUSES = ["planned", "scheduled", "running", "completed", "failed", "cancelled"];
const DRILL_DOMAINS = ["money_access", "partner_api_data", "trust_safety_market", "akuso"];
const CHECK_KEYS = ["detection", "degraded_mode", "queue_or_containment", "replay_or_correction", "reconciliation", "communication", "rollback_or_pause", "audit_evidence"];

const validationSchema = new mongoose.Schema({
  key: { type: String, enum: CHECK_KEYS, required: true },
  result: { type: String, enum: ["not_run", "pass", "partial", "fail", "not_applicable"], default: "not_run" },
  evidenceRef: { type: String, default: "", trim: true, maxlength: 1000 },
}, { _id: false });

const ResilienceDrillSchema = new mongoose.Schema({
  drillKey: { type: String, required: true, unique: true, index: true, trim: true, lowercase: true, maxlength: 120 },
  scenarioKey: { type: String, required: true, trim: true, lowercase: true, maxlength: 120, index: true },
  domain: { type: String, enum: DRILL_DOMAINS, required: true, index: true },
  scenario: { type: String, required: true, trim: true, maxlength: 1200 },
  ownerName: { type: String, required: true, trim: true, maxlength: 120 },
  ownerRole: { type: String, required: true, trim: true, maxlength: 120 },
  participatingTeams: [{ type: String, trim: true, maxlength: 120 }],
  expectedDegradedMode: { type: String, enum: ["watch", "degraded", "read_only", "queue_only", "manual_review_only", "paused", "rollback_required"], required: true },
  rollbackPath: { type: String, required: true, trim: true, maxlength: 1200 },
  communicationPath: { type: String, required: true, trim: true, maxlength: 1200 },
  successMetric: { type: String, required: true, trim: true, maxlength: 500 },
  followUpOwner: { type: String, required: true, trim: true, maxlength: 120 },
  scheduledAt: { type: Date, required: true, index: true },
  status: { type: String, enum: DRILL_STATUSES, default: "planned", index: true },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reviewedAt: { type: Date, default: null },
  validationChecks: { type: [validationSchema], default: () => CHECK_KEYS.map((key) => ({ key, result: "not_run" })) },
  metrics: {
    timeToDetectMinutes: { type: Number, default: null, min: 0 },
    timeToCoordinateMinutes: { type: Number, default: null, min: 0 },
    timeToRecoverMinutes: { type: Number, default: null, min: 0 },
    timeToCommunicateMinutes: { type: Number, default: null, min: 0 },
  },
  findings: [{ type: String, trim: true, maxlength: 1000 }],
  runbookUpdates: [{ type: String, trim: true, maxlength: 1000 }],
  workflowUpdates: [{ type: String, trim: true, maxlength: 1000 }],
  akusoEvalFixtures: [{ type: String, trim: true, maxlength: 200 }],
  costProxies: {
    incident: { type: Number, default: null, min: 0 },
    support: { type: Number, default: null, min: 0 },
    provider: { type: Number, default: null, min: 0 },
    correction: { type: Number, default: null, min: 0 },
    rollback: { type: Number, default: null, min: 0 },
    currency: { type: String, default: "NGN", trim: true, uppercase: true, maxlength: 3 },
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  lastChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  history: [{
    status: { type: String, enum: DRILL_STATUSES, required: true },
    at: { type: Date, default: Date.now },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
  }],
}, { timestamps: true });

ResilienceDrillSchema.index({ domain: 1, status: 1, scheduledAt: -1 });

ResilienceDrillSchema.pre("validate", function () {
  this.drillKey = String(this.drillKey || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  this.scenarioKey = String(this.scenarioKey || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (["completed", "failed"].includes(this.status)) {
    if (!this.startedAt || !this.completedAt || !this.reviewedBy || !this.reviewedAt) {
      this.invalidate("reviewedBy", "Completed drills require execution times and recorded human review");
    }
    if (!(this.validationChecks || []).some((check) => check.result !== "not_run")) {
      this.invalidate("validationChecks", "Completed drills require observed validation evidence");
    }
  }
});

module.exports = mongoose.model("ResilienceDrill", ResilienceDrillSchema);
module.exports.DRILL_STATUSES = DRILL_STATUSES;
module.exports.DRILL_DOMAINS = DRILL_DOMAINS;
module.exports.CHECK_KEYS = CHECK_KEYS;
