const mongoose = require("mongoose");

const AUTOMATION_STATES = ["proposed", "designed", "review_required", "pilot", "active", "paused", "rolled_back", "retired"];

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
    approvalRequirement: { type: String, required: true, trim: true, maxlength: 800 },
    approvedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    auditEvent: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    userVisibleStatus: { type: String, enum: ["suggested", "manual", "automated"], required: true },
    pauseControl: { type: String, required: true, trim: true, maxlength: 800 },
    rollbackPlan: { type: String, required: true, trim: true, maxlength: 1000 },
    successMetric: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    guardrailMetrics: [{ type: String, trim: true, lowercase: true, maxlength: 160 }],
    reviewCadence: { type: String, required: true, trim: true, lowercase: true, maxlength: 100 },
    state: { type: String, enum: AUTOMATION_STATES, default: "proposed", index: true },
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
    if (!["low", "medium"].includes(this.riskLevel) && !(this.approvedBy || []).length) {
      this.invalidate("approvedBy", "High-risk automation pilots require recorded human approval");
    }
  }
  if (this.state === "active" && this.actionType === "bounded_execution" && this.userVisibleStatus !== "automated") {
    this.invalidate("userVisibleStatus", "Active bounded execution must be visibly labeled automated");
  }
});

module.exports = mongoose.model("AutomationRegistryEntry", AutomationRegistryEntrySchema);
module.exports.AUTOMATION_STATES = AUTOMATION_STATES;
