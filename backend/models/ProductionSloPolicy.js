const mongoose = require("mongoose");

const SLO_POLICY_STATES = ["watch", "degraded", "incident", "blocked"];

const ProductionSloPolicySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 100 },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    targetPercent: { type: Number, required: true, min: 0, max: 100 },
    windowDays: { type: Number, required: true, min: 1, max: 90, default: 28 },
    errorBudgetMinutes: { type: Number, required: true, min: 0 },
    warnAtPercentConsumed: { type: Number, default: 50, min: 0, max: 100 },
    expansionBlockAtPercentConsumed: { type: Number, default: 100, min: 1, max: 500 },
    owner: { type: String, required: true, trim: true, maxlength: 120 },
    runbookKey: { type: String, required: true, trim: true, lowercase: true, maxlength: 100 },
    userImpact: { type: String, required: true, trim: true, maxlength: 400 },
    rollbackPlan: { type: String, required: true, trim: true, maxlength: 500 },
    ticketUrl: { type: String, default: "", trim: true, maxlength: 500 },
    enabled: { type: Boolean, default: true },
    lastState: { type: String, enum: SLO_POLICY_STATES, default: "watch" },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    changeReason: { type: String, required: true, trim: true, maxlength: 500 },
    changeHistory: [
      {
        at: { type: Date, default: Date.now },
        actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        reason: { type: String, required: true, trim: true, maxlength: 500 },
        targetPercent: { type: Number, min: 0, max: 100 },
        windowDays: { type: Number, min: 1, max: 90 },
      },
    ],
  },
  { timestamps: true }
);

ProductionSloPolicySchema.index({ enabled: 1, updatedAt: -1 });

module.exports = mongoose.model("ProductionSloPolicy", ProductionSloPolicySchema);
module.exports.SLO_POLICY_STATES = SLO_POLICY_STATES;
