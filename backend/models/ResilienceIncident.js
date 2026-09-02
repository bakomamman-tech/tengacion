const mongoose = require("mongoose");

const RESILIENCE_SEVERITIES = ["watch", "degraded", "incident", "critical", "rollback_required"];
const DEGRADATION_MODES = ["normal", "watch", "degraded", "read_only", "queue_only", "manual_review_only", "paused", "rollback_required"];
const INCIDENT_STATUSES = ["open", "monitoring", "mitigated", "recovered", "closed"];

const communicationSchema = new mongoose.Schema({
  audience: { type: String, enum: ["internal", "support", "creator", "fan", "partner", "public"], required: true },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  nextUpdateAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const ResilienceIncidentSchema = new mongoose.Schema({
  incidentKey: { type: String, required: true, unique: true, index: true, trim: true, lowercase: true, maxlength: 120 },
  incidentClass: { type: String, required: true, trim: true, lowercase: true, maxlength: 120, index: true },
  severity: { type: String, enum: RESILIENCE_SEVERITIES, required: true, index: true },
  affectedSurface: { type: String, required: true, trim: true, maxlength: 200 },
  userImpact: { type: String, required: true, trim: true, maxlength: 2000 },
  workflowState: { type: String, required: true, trim: true, maxlength: 120 },
  degradedMode: { type: String, enum: DEGRADATION_MODES, required: true, index: true },
  ownerName: { type: String, required: true, trim: true, maxlength: 120 },
  ownerRole: { type: String, required: true, trim: true, maxlength: 120 },
  responderTeams: [{ type: String, trim: true, maxlength: 120 }],
  currentMitigation: { type: String, required: true, trim: true, maxlength: 2000 },
  nextUpdateAt: { type: Date, required: true, index: true },
  rollbackOption: { type: String, required: true, trim: true, maxlength: 1500 },
  supportCopy: { type: String, required: true, trim: true, maxlength: 2000 },
  postIncidentReviewOwner: { type: String, required: true, trim: true, maxlength: 120 },
  runbookPath: { type: String, required: true, trim: true, maxlength: 500 },
  relatedWorkflowKeys: [{ type: String, trim: true, lowercase: true, maxlength: 120 }],
  relatedAutomationKeys: [{ type: String, trim: true, lowercase: true, maxlength: 120 }],
  relatedMetricKeys: [{ type: String, trim: true, lowercase: true, maxlength: 120 }],
  status: { type: String, enum: INCIDENT_STATUSES, default: "open", index: true },
  detectedAt: { type: Date, required: true },
  startedAt: { type: Date, required: true },
  mitigatedAt: { type: Date, default: null },
  recoveredAt: { type: Date, default: null },
  closedAt: { type: Date, default: null },
  recoveryEvidence: { type: String, default: "", trim: true, maxlength: 2000 },
  correctionRequired: { type: Boolean, default: false },
  communications: { type: [communicationSchema], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  lastChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  history: [{
    status: { type: String, enum: INCIDENT_STATUSES, required: true },
    severity: { type: String, enum: RESILIENCE_SEVERITIES, required: true },
    degradedMode: { type: String, enum: DEGRADATION_MODES, required: true },
    at: { type: Date, default: Date.now },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
  }],
}, { timestamps: true });

ResilienceIncidentSchema.index({ status: 1, severity: 1, startedAt: -1 });

ResilienceIncidentSchema.pre("validate", function () {
  this.incidentKey = String(this.incidentKey || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  this.incidentClass = String(this.incidentClass || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (this.detectedAt && this.startedAt && this.detectedAt < this.startedAt) {
    this.invalidate("detectedAt", "Detection time cannot precede incident start time");
  }
  if (["recovered", "closed"].includes(this.status) && (!this.recoveredAt || !String(this.recoveryEvidence || "").trim())) {
    this.invalidate("recoveryEvidence", "Recovered incidents require a recovery time and completion evidence");
  }
  if (this.status === "closed" && !this.closedAt) this.invalidate("closedAt", "Closed incidents require a closure time");
});

module.exports = mongoose.model("ResilienceIncident", ResilienceIncidentSchema);
module.exports.RESILIENCE_SEVERITIES = RESILIENCE_SEVERITIES;
module.exports.DEGRADATION_MODES = DEGRADATION_MODES;
module.exports.INCIDENT_STATUSES = INCIDENT_STATUSES;
