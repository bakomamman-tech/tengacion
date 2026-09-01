const mongoose = require("mongoose");

const WORKFLOW_LIFECYCLES = ["draft", "pilot", "default", "manual", "paused", "rolled_back", "retired"];
const WORKFLOW_REVIEW_DECISIONS = ["unreviewed", "make_default", "keep_pilot", "simplify", "return_manual", "pause", "retire"];
const WORKFLOW_DEPENDENCY_TYPES = [
  "data_quality", "consent", "privacy_review", "security_review", "finance_reconciliation",
  "payout_readiness", "entitlement_preflight", "catalog_quality", "support_capacity",
  "moderation_capacity", "rights_review", "recommendation_trust", "akuso_eval_gate", "launch_approval",
];

const WorkflowDefinitionSchema = new mongoose.Schema(
  {
    workflowKey: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 180 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    workflowDomain: { type: String, enum: ["creator_campaign", "fan_community", "partner_api", "finance", "support_trust", "akuso_response"], required: true, index: true },
    ownerName: { type: String, required: true, trim: true, maxlength: 120 },
    ownerRole: { type: String, required: true, trim: true, maxlength: 120 },
    participantTeams: [{ type: String, trim: true, lowercase: true, maxlength: 120 }],
    affectedUserType: { type: String, enum: ["creator", "fan", "partner", "internal"], required: true },
    startTrigger: { type: String, required: true, trim: true, maxlength: 1000 },
    dependencies: [{
      type: { type: String, enum: WORKFLOW_DEPENDENCY_TYPES, required: true },
      sourceSystem: { type: String, required: true, trim: true, maxlength: 200 },
      ownerName: { type: String, required: true, trim: true, maxlength: 120 },
      passCondition: { type: String, required: true, trim: true, maxlength: 800 },
      staleCondition: { type: String, required: true, trim: true, maxlength: 800 },
      overridePolicy: { type: String, required: true, trim: true, maxlength: 800 },
      escalationPath: { type: String, required: true, trim: true, maxlength: 500 },
      userVisibleCopy: { type: String, required: true, trim: true, maxlength: 800 },
    }],
    approvalGates: [{ type: String, trim: true, maxlength: 400 }],
    automationChecks: [{ type: String, trim: true, lowercase: true, maxlength: 180 }],
    humanReviewGates: [{ type: String, trim: true, maxlength: 400 }],
    escalationRules: [{ type: String, trim: true, maxlength: 600 }],
    userVisibleStatuses: [{ type: String, trim: true, maxlength: 400 }],
    auditEvents: [{ type: String, trim: true, lowercase: true, maxlength: 180 }],
    pauseCondition: { type: String, required: true, trim: true, maxlength: 1000 },
    rollbackCondition: { type: String, required: true, trim: true, maxlength: 1000 },
    supportPath: { type: String, required: true, trim: true, maxlength: 500 },
    externalCommunicationRule: { type: String, required: true, trim: true, maxlength: 1000 },
    successMetric: { type: String, required: true, trim: true, lowercase: true, maxlength: 180 },
    guardrailMetrics: [{ type: String, trim: true, lowercase: true, maxlength: 180 }],
    reviewCadence: { type: String, required: true, trim: true, lowercase: true, maxlength: 100 },
    lifecycle: { type: String, enum: WORKFLOW_LIFECYCLES, default: "draft", index: true },
    reviewDecision: { type: String, enum: WORKFLOW_REVIEW_DECISIONS, default: "unreviewed", index: true },
    reviewEvidence: {
      runCount: { type: Number, default: 0, min: 0 },
      completedCount: { type: Number, default: 0, min: 0 },
      completionRate: { type: Number, default: null, min: 0, max: 1 },
      averageBlockedMinutes: { type: Number, default: null, min: 0 },
      averageHandoffMinutes: { type: Number, default: null, min: 0 },
      overrideRate: { type: Number, default: null, min: 0, max: 1 },
      approvalQuality: { type: Number, default: null, min: 0, max: 1 },
      supportMinutes: { type: Number, default: 0, min: 0 },
      incidentCount: { type: Number, default: 0, min: 0 },
      akusoHelpfulRate: { type: Number, default: null, min: 0, max: 1 },
      operatingCost: { type: Number, default: 0, min: 0 },
      privacyConsentTrustState: { type: String, enum: ["not_observed", "trusted", "watch", "blocked"], default: "not_observed" },
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    rollbackTestedAt: { type: Date, default: null },
    reviewAt: { type: Date, required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lastChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    history: [{
      lifecycle: { type: String, enum: WORKFLOW_LIFECYCLES, required: true },
      reviewDecision: { type: String, enum: WORKFLOW_REVIEW_DECISIONS, required: true },
      at: { type: Date, default: Date.now },
      actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      reason: { type: String, required: true, trim: true, maxlength: 1000 },
    }],
  },
  { timestamps: true }
);

WorkflowDefinitionSchema.index({ lifecycle: 1, workflowDomain: 1, reviewAt: 1 });

WorkflowDefinitionSchema.pre("validate", function () {
  if (!(this.participantTeams || []).length) this.invalidate("participantTeams", "Workflow definitions require participant teams");
  if (!(this.dependencies || []).length) this.invalidate("dependencies", "Workflow definitions require explicit dependencies");
  if (!(this.auditEvents || []).length) this.invalidate("auditEvents", "Workflow definitions require audit events");
  if (["pilot", "default"].includes(this.lifecycle)) {
    if (!this.approvedBy || !this.approvedAt) this.invalidate("approvedBy", "Pilot and default workflows require human approval");
  }
  if (this.lifecycle === "default") {
    if (this.reviewDecision !== "make_default") this.invalidate("reviewDecision", "Default workflows require an evidence-backed make-default decision");
    if (!this.rollbackTestedAt) this.invalidate("rollbackTestedAt", "Default workflows require a tested rollback path");
    if (!Number(this.reviewEvidence?.runCount || 0)) this.invalidate("reviewEvidence", "Default workflows require observed pilot runs");
  }
  if (this.reviewDecision !== "unreviewed" && !String(this.history?.[this.history.length - 1]?.reason || "").trim()) {
    this.invalidate("history", "Workflow review decisions require a recorded reason");
  }
});

module.exports = mongoose.model("WorkflowDefinition", WorkflowDefinitionSchema);
module.exports.WORKFLOW_DEPENDENCY_TYPES = WORKFLOW_DEPENDENCY_TYPES;
module.exports.WORKFLOW_LIFECYCLES = WORKFLOW_LIFECYCLES;
module.exports.WORKFLOW_REVIEW_DECISIONS = WORKFLOW_REVIEW_DECISIONS;
