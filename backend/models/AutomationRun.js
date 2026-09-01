const mongoose = require("mongoose");

const AUTOMATION_RISK_CLASSES = [
  "informational",
  "draft_only",
  "suggestion",
  "low_risk_action",
  "review_gated_action",
  "prohibited_action",
];
const AUTOMATION_RUN_STATUSES = [
  "triggered",
  "check_passed",
  "check_failed",
  "suggested",
  "draft_ready",
  "awaiting_review",
  "completed",
  "suppressed",
  "overridden",
  "paused",
  "rolled_back",
  "failed",
  "blocked_prohibited",
];
const USER_CONTROL_STATES = ["visible", "dismissed", "snoozed", "hidden", "help_requested"];

const AutomationRunSchema = new mongoose.Schema(
  {
    runKey: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 180 },
    automationRegistry: { type: mongoose.Schema.Types.ObjectId, ref: "AutomationRegistryEntry", required: true, index: true },
    automationKey: { type: String, required: true, trim: true, lowercase: true, maxlength: 160, index: true },
    workflowDomain: { type: String, enum: ["creator", "fan", "partner_api", "finance", "operations", "akuso"], required: true, index: true },
    affectedActor: { type: String, enum: ["creator", "fan", "partner", "support", "finance", "moderator", "admin", "system"], required: true },
    affectedUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    creatorProfile: { type: mongoose.Schema.Types.ObjectId, ref: "CreatorProfile", default: null, index: true },
    riskClass: { type: String, enum: AUTOMATION_RISK_CLASSES, required: true, index: true },
    status: { type: String, enum: AUTOMATION_RUN_STATUSES, default: "triggered", index: true },
    triggerSummary: { type: String, required: true, trim: true, maxlength: 1000 },
    sourceSignals: [{
      key: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
      sourceAuthority: { type: String, required: true, trim: true, maxlength: 240 },
      observedAt: { type: Date, required: true },
      confidence: { type: Number, default: null, min: 0, max: 1 },
    }],
    actionSummary: { type: String, required: true, trim: true, maxlength: 1200 },
    userVisibleMessage: { type: String, required: true, trim: true, maxlength: 1200 },
    ownerName: { type: String, required: true, trim: true, maxlength: 120 },
    ownerRole: { type: String, required: true, trim: true, maxlength: 120 },
    runbookPath: { type: String, required: true, trim: true, maxlength: 500 },
    humanReviewRequired: { type: Boolean, default: false },
    review: {
      decision: { type: String, enum: ["pending", "approved", "rejected", "not_required"], default: "pending" },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      reviewedAt: { type: Date, default: null },
      reason: { type: String, default: "", trim: true, maxlength: 1000 },
    },
    userControlState: { type: String, enum: USER_CONTROL_STATES, default: "visible", index: true },
    snoozedUntil: { type: Date, default: null },
    feedback: { type: String, enum: ["", "helpful", "not_relevant", "confusing", "incorrect", "needs_help"], default: "" },
    feedbackNote: { type: String, default: "", trim: true, maxlength: 800 },
    outcome: {
      actionTaken: { type: Boolean, default: false },
      taskCompleted: { type: Boolean, default: false },
      supportContact: { type: Boolean, default: false },
      truePositive: { type: Boolean, default: false },
      falsePositive: { type: Boolean, default: false },
      missedIncident: { type: Boolean, default: false },
      complaint: { type: Boolean, default: false },
      optOut: { type: Boolean, default: false },
      abuseSignal: { type: Boolean, default: false },
      ownerResponseMinutes: { type: Number, default: null, min: 0 },
      supportMinutes: { type: Number, default: 0, min: 0 },
      modelCost: { type: Number, default: 0, min: 0 },
      modelLatencyMs: { type: Number, default: null, min: 0 },
    },
    pauseReason: { type: String, default: "", trim: true, maxlength: 1000 },
    rollbackReason: { type: String, default: "", trim: true, maxlength: 1000 },
    incidentRefs: [{ type: String, trim: true, maxlength: 200 }],
    triggeredAt: { type: Date, default: Date.now, index: true },
    completedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lastChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    history: [{
      status: { type: String, enum: AUTOMATION_RUN_STATUSES, required: true },
      at: { type: Date, default: Date.now },
      actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      reason: { type: String, required: true, trim: true, maxlength: 1000 },
    }],
  },
  { timestamps: true }
);

AutomationRunSchema.index({ automationRegistry: 1, triggeredAt: -1 });
AutomationRunSchema.index({ workflowDomain: 1, status: 1, triggeredAt: -1 });
AutomationRunSchema.index({ affectedUser: 1, userControlState: 1, triggeredAt: -1 });

AutomationRunSchema.pre("validate", function () {
  if (!(this.sourceSignals || []).length) {
    this.invalidate("sourceSignals", "Automation runs require at least one authoritative source signal");
  }
  if (this.riskClass === "prohibited_action" && this.status !== "blocked_prohibited") {
    this.invalidate("status", "Prohibited automation actions must be blocked before implementation");
  }
  if (this.riskClass === "review_gated_action") this.humanReviewRequired = true;
  if (this.humanReviewRequired && this.status === "completed") {
    if (this.review?.decision !== "approved" || !this.review?.reviewedBy || !this.review?.reviewedAt || !String(this.review?.reason || "").trim()) {
      this.invalidate("review", "Review-gated automation cannot complete without recorded human approval");
    }
  }
  if (this.review?.decision === "approved" && (!this.review?.reviewedBy || !this.review?.reviewedAt || !String(this.review?.reason || "").trim())) {
    this.invalidate("review", "Approved automation reviews require reviewer, timestamp, and reason");
  }
  if (this.userControlState === "snoozed" && !this.snoozedUntil) {
    this.invalidate("snoozedUntil", "Snoozed automation output requires an end time");
  }
  if (this.status === "paused" && !String(this.pauseReason || "").trim()) {
    this.invalidate("pauseReason", "Paused automation runs require a reason");
  }
  if (this.status === "rolled_back" && !String(this.rollbackReason || "").trim()) {
    this.invalidate("rollbackReason", "Rolled-back automation runs require a reason");
  }
  if (this.status === "completed" && !this.completedAt) this.completedAt = new Date();
});

module.exports = mongoose.model("AutomationRun", AutomationRunSchema);
module.exports.AUTOMATION_RISK_CLASSES = AUTOMATION_RISK_CLASSES;
module.exports.AUTOMATION_RUN_STATUSES = AUTOMATION_RUN_STATUSES;
module.exports.USER_CONTROL_STATES = USER_CONTROL_STATES;
