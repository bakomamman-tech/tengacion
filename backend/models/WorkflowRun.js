const mongoose = require("mongoose");
const { WORKFLOW_DEPENDENCY_TYPES } = require("./WorkflowDefinition");

const WORKFLOW_STATES = [
  "draft", "preflight", "waiting_on_creator", "waiting_on_fan", "waiting_on_partner",
  "waiting_on_internal_review", "blocked", "approved", "scheduled", "active", "paused",
  "completed", "rolled_back", "retired",
];
const DEPENDENCY_STATES = ["pending", "passed", "failed", "stale", "overridden"];
const WORKFLOW_USER_CONTROL_STATES = ["visible", "snoozed", "hidden", "help_requested"];

const WorkflowRunSchema = new mongoose.Schema(
  {
    runKey: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 180 },
    workflowDefinition: { type: mongoose.Schema.Types.ObjectId, ref: "WorkflowDefinition", required: true, index: true },
    workflowKey: { type: String, required: true, trim: true, lowercase: true, maxlength: 180, index: true },
    workflowDomain: { type: String, enum: ["creator_campaign", "fan_community", "partner_api", "finance", "support_trust", "akuso_response"], required: true, index: true },
    affectedUserType: { type: String, enum: ["creator", "fan", "partner", "internal"], required: true },
    affectedUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    creatorProfile: { type: mongoose.Schema.Types.ObjectId, ref: "CreatorProfile", default: null, index: true },
    ownerName: { type: String, required: true, trim: true, maxlength: 120 },
    ownerRole: { type: String, required: true, trim: true, maxlength: 120 },
    currentState: { type: String, enum: WORKFLOW_STATES, default: "draft", index: true },
    dependencies: [{
      type: { type: String, enum: WORKFLOW_DEPENDENCY_TYPES, required: true },
      ownerName: { type: String, required: true, trim: true, maxlength: 120 },
      state: { type: String, enum: DEPENDENCY_STATES, default: "pending" },
      evidenceRef: { type: String, default: "", trim: true, maxlength: 500 },
      observedAt: { type: Date, default: null },
      expiresAt: { type: Date, default: null },
      userVisibleCopy: { type: String, required: true, trim: true, maxlength: 800 },
      override: {
        status: { type: String, enum: ["none", "requested", "approved", "rejected", "expired"], default: "none" },
        requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        reason: { type: String, default: "", trim: true, maxlength: 1000 },
        requestedAt: { type: Date, default: null },
        decidedAt: { type: Date, default: null },
        expiresAt: { type: Date, default: null },
      },
    }],
    humanReviewRequired: { type: Boolean, default: false },
    approval: {
      status: { type: String, enum: ["not_required", "pending", "approved", "rejected"], default: "pending" },
      gate: { type: String, default: "", trim: true, maxlength: 400 },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      reviewedAt: { type: Date, default: null },
      reason: { type: String, default: "", trim: true, maxlength: 1000 },
    },
    userVisibleStatus: { type: String, required: true, trim: true, maxlength: 800 },
    waitingOn: { type: String, required: true, trim: true, maxlength: 240 },
    nextStep: { type: String, required: true, trim: true, maxlength: 800 },
    supportPath: { type: String, required: true, trim: true, maxlength: 500 },
    expectedAt: { type: Date, default: null },
    userControlState: { type: String, enum: WORKFLOW_USER_CONTROL_STATES, default: "visible", index: true },
    snoozedUntil: { type: Date, default: null },
    pauseReason: { type: String, default: "", trim: true, maxlength: 1000 },
    rollbackReason: { type: String, default: "", trim: true, maxlength: 1000 },
    incidentRef: { type: String, default: "", trim: true, maxlength: 240 },
    metrics: {
      blockedMinutes: { type: Number, default: 0, min: 0 },
      handoffMinutes: { type: Number, default: 0, min: 0 },
      supportMinutes: { type: Number, default: 0, min: 0 },
      userConfusionReported: { type: Boolean, default: false },
      guardrailBreach: { type: Boolean, default: false },
      akusoHelpful: { type: Boolean, default: false },
      operatingCost: { type: Number, default: 0, min: 0 },
    },
    startedAt: { type: Date, default: Date.now, index: true },
    completedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lastChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    history: [{
      state: { type: String, enum: WORKFLOW_STATES, required: true },
      at: { type: Date, default: Date.now },
      actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      reason: { type: String, required: true, trim: true, maxlength: 1000 },
    }],
  },
  { timestamps: true }
);

WorkflowRunSchema.index({ workflowDefinition: 1, startedAt: -1 });
WorkflowRunSchema.index({ currentState: 1, workflowDomain: 1, startedAt: -1 });
WorkflowRunSchema.index({ affectedUser: 1, currentState: 1, startedAt: -1 });

WorkflowRunSchema.pre("validate", function () {
  if (!(this.dependencies || []).length) this.invalidate("dependencies", "Workflow runs require dependency state");
  const advancingStates = ["approved", "scheduled", "active", "completed"];
  if (advancingStates.includes(this.currentState)) {
    const blocking = (this.dependencies || []).filter((dependency) => {
      if (dependency.state === "passed") return false;
      return !(dependency.state === "overridden" && dependency.override?.status === "approved" && dependency.override?.expiresAt && new Date(dependency.override.expiresAt) > new Date());
    });
    if (blocking.length) this.invalidate("dependencies", "Failed, stale, pending, or expired dependencies block workflow progression");
    if (this.humanReviewRequired && (this.approval?.status !== "approved" || !this.approval?.reviewedBy || !this.approval?.reviewedAt || !String(this.approval?.reason || "").trim())) {
      this.invalidate("approval", "Sensitive workflow progression requires recorded human approval");
    }
  }
  for (const dependency of this.dependencies || []) {
    if (dependency.override?.status === "approved") {
      if (!dependency.override?.approvedBy || !dependency.override?.decidedAt || !dependency.override?.expiresAt || !String(dependency.override?.reason || "").trim()) {
        this.invalidate("dependencies", "Approved dependency overrides require an approver, reason, decision time, and expiration");
      }
    }
  }
  if (this.userControlState === "snoozed" && !this.snoozedUntil) this.invalidate("snoozedUntil", "Snoozed workflows require an end time");
  if (this.currentState === "paused" && !String(this.pauseReason || "").trim()) this.invalidate("pauseReason", "Paused workflows require a reason");
  if (this.currentState === "rolled_back" && !String(this.rollbackReason || "").trim()) this.invalidate("rollbackReason", "Rolled-back workflows require a reason");
  if (this.metrics?.guardrailBreach && !["paused", "rolled_back"].includes(this.currentState)) this.invalidate("currentState", "Guardrail breaches must pause or roll back the workflow");
  if (this.currentState === "completed" && !this.completedAt) this.completedAt = new Date();
});

module.exports = mongoose.model("WorkflowRun", WorkflowRunSchema);
module.exports.DEPENDENCY_STATES = DEPENDENCY_STATES;
module.exports.WORKFLOW_STATES = WORKFLOW_STATES;
module.exports.WORKFLOW_USER_CONTROL_STATES = WORKFLOW_USER_CONTROL_STATES;
