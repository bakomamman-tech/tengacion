const mongoose = require("mongoose");
const { sanitizePlainObject } = require("../config/storage");

const EXPANSION_EXPERIMENT_STATUSES = [
  "draft",
  "review",
  "approved",
  "running",
  "paused",
  "completed",
  "cancelled",
];

const ExpansionExperimentSchema = new mongoose.Schema(
  {
    experimentKey: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 120 },
    name: { type: String, required: true, trim: true, maxlength: 180 },
    hypothesis: { type: String, required: true, trim: true, maxlength: 800 },
    ownerName: { type: String, required: true, trim: true, maxlength: 120 },
    ownerRole: { type: String, default: "Product and data", trim: true, maxlength: 120 },
    cohort: { type: String, required: true, trim: true, maxlength: 400 },
    surface: { type: String, required: true, trim: true, lowercase: true, maxlength: 80, index: true },
    variants: [
      {
        key: { type: String, required: true, trim: true, lowercase: true, maxlength: 60 },
        description: { type: String, required: true, trim: true, maxlength: 300 },
        allocationPercent: { type: Number, required: true, min: 0, max: 100 },
      },
    ],
    primaryMetric: { type: String, required: true, trim: true, lowercase: true, maxlength: 100 },
    guardrailMetrics: [{ type: String, trim: true, lowercase: true, maxlength: 100 }],
    stopCondition: { type: String, required: true, trim: true, maxlength: 500 },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true, index: true },
    decisionAt: { type: Date, required: true, index: true },
    status: { type: String, enum: EXPANSION_EXPERIMENT_STATUSES, default: "draft", index: true },
    dataQualityState: { type: String, enum: ["not_checked", "ready", "degraded", "blocked"], default: "not_checked", index: true },
    resultSummary: { type: String, default: "", trim: true, maxlength: 1500 },
    decision: { type: String, enum: ["", "ship", "iterate", "hold", "stop"], default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lastChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    statusHistory: [
      {
        status: { type: String, enum: EXPANSION_EXPERIMENT_STATUSES, required: true },
        at: { type: Date, default: Date.now },
        actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        reason: { type: String, default: "", trim: true, maxlength: 500 },
      },
    ],
  },
  { timestamps: true }
);

ExpansionExperimentSchema.index({ status: 1, decisionAt: 1 });

ExpansionExperimentSchema.pre("validate", function () {
  if (this.endAt && this.startAt && this.endAt <= this.startAt) {
    this.invalidate("endAt", "Experiment end must be after its start");
  }
  if (this.decisionAt && this.endAt && this.decisionAt < this.endAt) {
    this.invalidate("decisionAt", "Experiment decision date cannot precede its end");
  }
  const allocation = (this.variants || []).reduce((sum, variant) => sum + Number(variant.allocationPercent || 0), 0);
  if ((this.variants || []).length && Math.abs(allocation - 100) > 0.001) {
    this.invalidate("variants", "Experiment variant allocation must total 100 percent");
  }
  if (this.metadata && typeof this.metadata === "object") {
    this.metadata = sanitizePlainObject(this.metadata, {
      maxDepth: 2,
      maxKeys: 16,
      maxStringLength: 300,
      maxArrayLength: 10,
    });
  }
});

module.exports = mongoose.model("ExpansionExperiment", ExpansionExperimentSchema);
module.exports.EXPANSION_EXPERIMENT_STATUSES = EXPANSION_EXPERIMENT_STATUSES;
