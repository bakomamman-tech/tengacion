const mongoose = require("mongoose");

const GOVERNANCE_WORKFLOW_TYPES = [
  "market_or_community_launch",
  "sponsored_campaign",
  "high_risk_creator_cohort",
  "payout_automation_change",
  "refund_or_dispute_override",
  "recommendation_ranking_change",
  "akuso_prompt_memory_or_tool_change",
  "partner_report_export",
  "content_takedown",
  "user_data_export_change",
];

const GOVERNANCE_DECISION_STATUSES = [
  "draft",
  "approved",
  "conditional",
  "rejected",
  "expired",
  "revoked",
];

const GovernanceDecisionSchema = new mongoose.Schema(
  {
    decisionKey: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 120 },
    workflowType: { type: String, enum: GOVERNANCE_WORKFLOW_TYPES, required: true, index: true },
    subjectType: { type: String, required: true, trim: true, lowercase: true, maxlength: 80 },
    subjectId: { type: String, required: true, trim: true, maxlength: 120, index: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    ownerName: { type: String, required: true, trim: true, maxlength: 120 },
    ownerRole: { type: String, required: true, trim: true, maxlength: 120 },
    riskLevel: { type: String, enum: ["low", "medium", "high", "critical"], required: true, index: true },
    status: { type: String, enum: GOVERNANCE_DECISION_STATUSES, default: "draft", index: true },
    requiredReviewRoles: [{ type: String, trim: true, lowercase: true, maxlength: 80 }],
    approvals: [
      {
        role: { type: String, required: true, trim: true, lowercase: true, maxlength: 80 },
        reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        decision: { type: String, enum: ["approved", "rejected", "conditional"], required: true },
        note: { type: String, default: "", trim: true, maxlength: 600 },
        at: { type: Date, default: Date.now },
      },
    ],
    evidence: [
      {
        key: { type: String, required: true, trim: true, maxlength: 100 },
        reference: { type: String, required: true, trim: true, maxlength: 500 },
        reviewedAt: { type: Date, default: null },
      },
    ],
    conditions: { type: String, default: "", trim: true, maxlength: 1200 },
    rollbackPlan: { type: String, required: true, trim: true, maxlength: 1000 },
    effectiveAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true, index: true },
    followUpAt: { type: Date, required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lastChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    history: [
      {
        status: { type: String, enum: GOVERNANCE_DECISION_STATUSES, required: true },
        at: { type: Date, default: Date.now },
        actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        reason: { type: String, default: "", trim: true, maxlength: 600 },
      },
    ],
  },
  { timestamps: true }
);

GovernanceDecisionSchema.index({ status: 1, expiresAt: 1 });
GovernanceDecisionSchema.index({ workflowType: 1, subjectType: 1, subjectId: 1 });

GovernanceDecisionSchema.pre("validate", function () {
  if (this.followUpAt && this.expiresAt && this.followUpAt > this.expiresAt) {
    this.invalidate("followUpAt", "Follow-up review cannot occur after the decision expires");
  }
  if (["high", "critical"].includes(this.riskLevel) && (this.requiredReviewRoles || []).length < 2) {
    this.invalidate("requiredReviewRoles", "High-risk decisions require at least two independent review roles");
  }
});

module.exports = mongoose.model("GovernanceDecision", GovernanceDecisionSchema);
module.exports.GOVERNANCE_WORKFLOW_TYPES = GOVERNANCE_WORKFLOW_TYPES;
module.exports.GOVERNANCE_DECISION_STATUSES = GOVERNANCE_DECISION_STATUSES;
