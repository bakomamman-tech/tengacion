const mongoose = require("mongoose");

const AUTOMATION_STATES = ["proposed", "designed", "review_required", "pilot", "active", "paused", "rolled_back", "retired"];
const AUTOMATION_RISK_CLASSES = ["informational", "draft_only", "suggestion", "low_risk_action", "review_gated_action", "prohibited_action"];
const AUTOMATION_SCALE_DECISIONS = ["unreviewed", "scale", "stay_pilot", "suggestion_only", "review_gated_only", "pause", "retire"];

const AutomationRegistryEntrySchema = new mongoose.Schema(
  {
    automationKey: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 160 },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    ownerName: { type: String, required: true, trim: true, maxlength: 120 },
    ownerRole: { type: String, required: true, trim: true, maxlength: 120 },
    surface: { type: String, required: true, trim: true, lowercase: true, maxlength: 120 },
    actorAffected: { type: String, required: true, trim: true, lowercase: true, maxlength: 120 },
    trigger: { type: String, required: true, trim: true, maxlength: 800 },
    inputSignals: [{ type: String, trim: true, lowercase: true, maxlength: 120 }],
    actionType: { type: String, enum: ["suggestion", "draft", "notification", "bounded_execution"], required: true },
    riskLevel: { type: String, enum: ["low", "medium", "high", "critical"], required: true, index: true },
    riskClass: { type: String, enum: AUTOMATION_RISK_CLASSES, default: "suggestion", index: true },
    workflowDomain: { type: String, enum: ["creator", "fan", "partner_api", "finance", "operations", "akuso"], default: "operations", index: true },
    approvalRequirement: { type: String, required: true, trim: true, maxlength: 800 },
    approvedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    auditEvent: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    userVisibleStatus: { type: String, enum: ["suggested", "manual", "automated"], required: true },
    pauseControl: { type: String, required: true, trim: true, maxlength: 800 },
    rollbackPlan: { type: String, required: true, trim: true, maxlength: 1000 },
    runbookPath: { type: String, default: "", trim: true, maxlength: 500 },
    userControls: [{ type: String, enum: ["dismiss", "snooze", "explain", "request_help", "hide_type", "suppress", "pause"] }],
    successMetric: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    guardrailMetrics: [{ type: String, trim: true, lowercase: true, maxlength: 160 }],
    reviewCadence: { type: String, required: true, trim: true, lowercase: true, maxlength: 100 },
    state: { type: String, enum: AUTOMATION_STATES, default: "proposed", index: true },
    rolloutPercent: { type: Number, default: 0, min: 0, max: 100 },
    pilotApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    pilotApprovedAt: { type: Date, default: null },
    rollbackTestedAt: { type: Date, default: null },
    guardrailBreach: { type: Boolean, default: false },
    scaleDecision: { type: String, enum: AUTOMATION_SCALE_DECISIONS, default: "unreviewed", index: true },
    scaleDecisionReason: { type: String, default: "", trim: true, maxlength: 1000 },
    scaleDecisionBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    scaleDecisionAt: { type: Date, default: null },
    outcomeEvidence: {
      triggerCount: { type: Number, default: 0, min: 0 },
      actionCount: { type: Number, default: 0, min: 0 },
      completedCount: { type: Number, default: 0, min: 0 },
      overrideCount: { type: Number, default: 0, min: 0 },
      falsePositiveCount: { type: Number, default: 0, min: 0 },
      falseNegativeCount: { type: Number, default: 0, min: 0 },
      supportContactCount: { type: Number, default: 0, min: 0 },
      complaintCount: { type: Number, default: 0, min: 0 },
      optOutCount: { type: Number, default: 0, min: 0 },
      incidentCount: { type: Number, default: 0, min: 0 },
      modelCost: { type: Number, default: 0, min: 0 },
      reviewedAt: { type: Date, default: null },
    },
    reviewAt: { type: Date, required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lastChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    history: [{
      state: { type: String, enum: AUTOMATION_STATES, required: true },
      at: { type: Date, default: Date.now },
      actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      reason: { type: String, required: true, trim: true, maxlength: 800 },
    }],
  },
  { timestamps: true }
);

AutomationRegistryEntrySchema.index({ state: 1, riskLevel: 1, reviewAt: 1 });

AutomationRegistryEntrySchema.pre("validate", function () {
  if (["pilot", "active"].includes(this.state)) {
    if (!String(this.pauseControl || "").trim() || !String(this.rollbackPlan || "").trim()) {
      this.invalidate("pauseControl", "Pilot and active automations require explicit pause and rollback controls");
    }
    if (!this.pilotApprovedBy || !this.pilotApprovedAt || !(this.approvedBy || []).length) this.invalidate("pilotApprovedBy", "Automation pilots require recorded human approval");
    if (!String(this.runbookPath || "").trim() || !this.rollbackTestedAt) this.invalidate("runbookPath", "Automation pilots require a runbook and tested rollback path");
    if (this.riskClass === "prohibited_action") this.invalidate("riskClass", "Prohibited automations are blocked before implementation");
    if (this.riskClass === "review_gated_action" && !["suggestion", "draft"].includes(this.actionType)) this.invalidate("actionType", "Review-gated automation may only check, route, suggest, or draft before human approval");
    if (this.riskClass === "low_risk_action" && !(this.userControls || []).length) this.invalidate("userControls", "Low-risk action pilots require visible user controls");
  }
  if (this.guardrailBreach && !["paused", "rolled_back", "retired"].includes(this.state)) this.invalidate("state", "Guardrail breaches must pause or roll back automation");
  if (this.state === "active") {
    if (this.scaleDecision !== "scale" || !this.scaleDecisionBy || !this.scaleDecisionAt || !String(this.scaleDecisionReason || "").trim()) this.invalidate("scaleDecision", "Active automation requires an evidence-backed scale decision");
    if (!Number(this.outcomeEvidence?.triggerCount || 0) || !this.outcomeEvidence?.reviewedAt) this.invalidate("outcomeEvidence", "Active automation requires reviewed pilot evidence");
  }
  if (this.state === "active" && this.actionType === "bounded_execution" && this.userVisibleStatus !== "automated") {
    this.invalidate("userVisibleStatus", "Active bounded execution must be visibly labeled automated");
  }
});

module.exports = mongoose.model("AutomationRegistryEntry", AutomationRegistryEntrySchema);
module.exports.AUTOMATION_STATES = AUTOMATION_STATES;
module.exports.AUTOMATION_RISK_CLASSES = AUTOMATION_RISK_CLASSES;
module.exports.AUTOMATION_SCALE_DECISIONS = AUTOMATION_SCALE_DECISIONS;
