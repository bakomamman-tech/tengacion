const mongoose = require("mongoose");

const WARNING_STATUSES = ["open", "acknowledged", "investigating", "mitigated", "false_positive", "closed"];

const PredictiveWarningSchema = new mongoose.Schema(
  {
    warningKey: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 160 },
    warningType: { type: String, required: true, trim: true, lowercase: true, maxlength: 120, index: true },
    ownerName: { type: String, required: true, trim: true, maxlength: 120 },
    ownerRole: { type: String, required: true, trim: true, maxlength: 120 },
    sourceMetricKeys: [{ type: String, trim: true, lowercase: true, maxlength: 120 }],
    confidence: { type: Number, required: true, min: 0, max: 1 },
    impact: { type: String, required: true, trim: true, maxlength: 1000 },
    runbookPath: { type: String, required: true, trim: true, maxlength: 500 },
    reviewPath: { type: String, required: true, trim: true, maxlength: 500 },
    rollbackPath: { type: String, required: true, trim: true, maxlength: 500 },
    status: { type: String, enum: WARNING_STATUSES, default: "open", index: true },
    observedAt: { type: Date, required: true },
    reviewAt: { type: Date, required: true, index: true },
    resolvedAt: { type: Date, default: null },
    resolutionNote: { type: String, default: "", trim: true, maxlength: 1000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lastChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    history: [{
      status: { type: String, enum: WARNING_STATUSES, required: true },
      at: { type: Date, default: Date.now },
      actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      reason: { type: String, required: true, trim: true, maxlength: 800 },
    }],
  },
  { timestamps: true }
);

PredictiveWarningSchema.index({ status: 1, reviewAt: 1, warningType: 1 });

PredictiveWarningSchema.pre("validate", function () {
  if (["mitigated", "false_positive", "closed"].includes(this.status) && (!this.resolvedAt || !String(this.resolutionNote || "").trim())) {
    this.invalidate("resolutionNote", "Resolved warnings require a timestamp and review note");
  }
});

module.exports = mongoose.model("PredictiveWarning", PredictiveWarningSchema);
module.exports.WARNING_STATUSES = WARNING_STATUSES;
