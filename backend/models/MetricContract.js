const mongoose = require("mongoose");

const METRIC_TRUST_STATES = ["trusted", "watch", "stale", "disputed", "blocked"];

const MetricContractSchema = new mongoose.Schema(
  {
    metricKey: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 120 },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    ownerName: { type: String, required: true, trim: true, maxlength: 120 },
    ownerRole: { type: String, required: true, trim: true, maxlength: 120 },
    sourceAuthorities: [{ type: String, trim: true, lowercase: true, maxlength: 120 }],
    calculation: { type: String, required: true, trim: true, maxlength: 1600 },
    freshnessMinutes: { type: Number, required: true, min: 1, max: 525600 },
    limitations: { type: String, required: true, trim: true, maxlength: 1200 },
    privacyClass: { type: String, enum: ["aggregate", "creator_private", "operations_restricted", "finance_restricted"], required: true },
    decisionsAllowed: [{ type: String, trim: true, lowercase: true, maxlength: 120 }],
    exportPolicy: { type: String, enum: ["internal_only", "reviewed_aggregate", "creator_self_only", "prohibited"], default: "internal_only" },
    trustState: { type: String, enum: METRIC_TRUST_STATES, default: "watch", index: true },
    trustReason: { type: String, required: true, trim: true, maxlength: 1000 },
    observedAt: { type: Date, default: null, index: true },
    reviewedAt: { type: Date, required: true },
    reviewAt: { type: Date, required: true, index: true },
    withdrawnAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lastChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    history: [{
      trustState: { type: String, enum: METRIC_TRUST_STATES, required: true },
      at: { type: Date, default: Date.now },
      actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      reason: { type: String, required: true, trim: true, maxlength: 1000 },
    }],
  },
  { timestamps: true }
);

MetricContractSchema.index({ trustState: 1, reviewAt: 1 });

MetricContractSchema.pre("validate", function () {
  if (this.trustState === "trusted" && !this.observedAt) {
    this.invalidate("observedAt", "Trusted metrics require an observed-at timestamp");
  }
  if (this.withdrawnAt && this.trustState !== "blocked") {
    this.invalidate("trustState", "Withdrawn metrics must be blocked");
  }
});

module.exports = mongoose.model("MetricContract", MetricContractSchema);
module.exports.METRIC_TRUST_STATES = METRIC_TRUST_STATES;
