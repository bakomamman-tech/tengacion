const mongoose = require("mongoose");

const CONTROL_STATUSES = ["draft", "active", "watch", "blocked", "paused", "retired"];
const FRESHNESS_LEVELS = ["current", "stale", "delayed", "disputed", "blocked", "withdrawn"];

const AssuranceControlSchema = new mongoose.Schema({
  controlKey: { type: String, required: true, unique: true, index: true, trim: true, lowercase: true, maxlength: 140 },
  workflow: { type: String, required: true, trim: true, maxlength: 160, index: true },
  surface: { type: String, required: true, trim: true, maxlength: 160 },
  ownerName: { type: String, required: true, trim: true, maxlength: 120 },
  ownerRole: { type: String, required: true, trim: true, maxlength: 120 },
  reviewerName: { type: String, required: true, trim: true, maxlength: 120 },
  reviewerRole: { type: String, required: true, trim: true, maxlength: 120 },
  objective: { type: String, required: true, trim: true, maxlength: 1500 },
  evidenceSource: { type: String, required: true, trim: true, maxlength: 1000 },
  freshnessExpectation: { type: String, required: true, trim: true, maxlength: 200 },
  automationStatus: { type: String, enum: ["automated", "partially_automated", "manual"], required: true },
  evidenceFreshness: { type: String, enum: FRESHNESS_LEVELS, default: "delayed", index: true },
  exceptionSeverity: { type: String, enum: ["none", "low", "medium", "high", "critical"], default: "none", index: true },
  readinessImplication: { type: String, required: true, trim: true, maxlength: 1000 },
  status: { type: String, enum: CONTROL_STATUSES, default: "draft", index: true },
  lastReviewAt: { type: Date, default: null },
  nextReviewAt: { type: Date, required: true, index: true },
  auditNotes: { type: String, default: "", trim: true, maxlength: 3000 },
  evidenceRefs: [{ type: String, trim: true, maxlength: 1000 }],
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  lastChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  history: [{
    status: { type: String, enum: CONTROL_STATUSES, required: true },
    evidenceFreshness: { type: String, enum: FRESHNESS_LEVELS, required: true },
    exceptionSeverity: { type: String, enum: ["none", "low", "medium", "high", "critical"], required: true },
    at: { type: Date, default: Date.now },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
  }],
}, { timestamps: true });

AssuranceControlSchema.index({ status: 1, evidenceFreshness: 1, nextReviewAt: 1 });

AssuranceControlSchema.pre("validate", function () {
  this.controlKey = String(this.controlKey || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (this.status === "active" && (!this.lastReviewAt || !this.reviewedBy || !(this.evidenceRefs || []).length)) {
    this.invalidate("reviewedBy", "Active assurance controls require reviewed evidence");
  }
  if (["stale", "delayed", "disputed", "blocked", "withdrawn"].includes(this.evidenceFreshness) && this.status === "active") {
    this.invalidate("status", "Non-current evidence cannot support an active assurance control");
  }
});

module.exports = mongoose.model("AssuranceControl", AssuranceControlSchema);
module.exports.CONTROL_STATUSES = CONTROL_STATUSES;
module.exports.FRESHNESS_LEVELS = FRESHNESS_LEVELS;
