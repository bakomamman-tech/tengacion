const mongoose = require("mongoose");

const CRITICAL_FLOW_KEYS = [
  "checkout_initialization", "payment_verification", "webhook_processing", "entitlement_grant_delay",
  "payout_queue_processing", "refund_dispute_tracking", "media_upload_playback", "live_join",
  "discovery_recommendation", "notification_delivery", "partner_export_generation", "api_availability",
  "data_freshness", "orchestration_state_transition", "akuso_availability_eval",
];

const ResilienceObjectiveSchema = new mongoose.Schema(
  {
    flowKey: { type: String, enum: CRITICAL_FLOW_KEYS, required: true, unique: true, index: true },
    ownerName: { type: String, required: true, trim: true, maxlength: 120 },
    ownerRole: { type: String, required: true, trim: true, maxlength: 120 },
    measurementSource: { type: String, required: true, trim: true, maxlength: 500 },
    availabilityTarget: { type: Number, required: true, min: 0.5, max: 1 },
    latencyTargetMs: { type: Number, default: null, min: 0 },
    errorBudgetMinutes: { type: Number, required: true, min: 0 },
    maximumDowntimeMinutes: { type: Number, required: true, min: 0 },
    maximumDataDelayMinutes: { type: Number, required: true, min: 0 },
    maximumEntitlementDelayMinutes: { type: Number, default: null, min: 0 },
    maximumPayoutQueueAgeMinutes: { type: Number, default: null, min: 0 },
    maximumPartnerReportDelayMinutes: { type: Number, default: null, min: 0 },
    recoveryPriority: { type: Number, required: true, min: 1, max: 15, index: true },
    pauseTrigger: { type: String, required: true, trim: true, maxlength: 800 },
    rollbackTrigger: { type: String, required: true, trim: true, maxlength: 800 },
    status: { type: String, enum: ["draft", "approved", "watch", "blocked"], default: "draft", index: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    reviewAt: { type: Date, required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lastChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    history: [{
      status: { type: String, enum: ["draft", "approved", "watch", "blocked"], required: true },
      at: { type: Date, default: Date.now },
      actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      reason: { type: String, required: true, trim: true, maxlength: 1000 },
    }],
  },
  { timestamps: true }
);

ResilienceObjectiveSchema.index({ status: 1, recoveryPriority: 1, reviewAt: 1 });

ResilienceObjectiveSchema.pre("validate", function () {
  if (this.status === "approved" && (!this.reviewedBy || !this.reviewedAt)) {
    this.invalidate("reviewedBy", "Approved resilience objectives require recorded human review");
  }
  if (this.flowKey === "entitlement_grant_delay" && this.maximumEntitlementDelayMinutes === null) {
    this.invalidate("maximumEntitlementDelayMinutes", "Entitlement recovery requires an explicit delay objective");
  }
  if (this.flowKey === "payout_queue_processing" && this.maximumPayoutQueueAgeMinutes === null) {
    this.invalidate("maximumPayoutQueueAgeMinutes", "Payout recovery requires an explicit queue-aging objective");
  }
  if (this.flowKey === "partner_export_generation" && this.maximumPartnerReportDelayMinutes === null) {
    this.invalidate("maximumPartnerReportDelayMinutes", "Partner export recovery requires an explicit report-delay objective");
  }
});

module.exports = mongoose.model("ResilienceObjective", ResilienceObjectiveSchema);
module.exports.CRITICAL_FLOW_KEYS = CRITICAL_FLOW_KEYS;
