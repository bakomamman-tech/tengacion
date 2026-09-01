const mongoose = require("mongoose");

const INTELLIGENCE_PRODUCT_STATUSES = ["draft", "review", "pilot", "active", "paused", "withdrawn"];

const IntelligenceProductSchema = new mongoose.Schema(
  {
    productKey: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 120 },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    audience: { type: String, enum: ["internal", "creator", "partner", "api_candidate", "akuso"], required: true, index: true },
    ownerName: { type: String, required: true, trim: true, maxlength: 120 },
    ownerRole: { type: String, required: true, trim: true, maxlength: 120 },
    cadence: { type: String, required: true, trim: true, lowercase: true, maxlength: 100 },
    sourceMetricKeys: [{ type: String, trim: true, lowercase: true, maxlength: 120 }],
    confidencePolicy: { type: String, required: true, trim: true, maxlength: 1000 },
    privacyPolicy: { type: String, required: true, trim: true, maxlength: 1000 },
    permittedActions: [{ type: String, trim: true, lowercase: true, maxlength: 120 }],
    reviewerRole: { type: String, required: true, trim: true, maxlength: 120 },
    withdrawalPath: { type: String, required: true, trim: true, maxlength: 1000 },
    status: { type: String, enum: INTELLIGENCE_PRODUCT_STATUSES, default: "draft", index: true },
    confidence: { type: Number, default: null, min: 0, max: 1 },
    qualityState: { type: String, enum: ["trusted", "watch", "stale", "disputed", "blocked"], default: "watch", index: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    reviewAt: { type: Date, required: true, index: true },
    withdrawnAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lastChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    history: [{
      status: { type: String, enum: INTELLIGENCE_PRODUCT_STATUSES, required: true },
      at: { type: Date, default: Date.now },
      actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      reason: { type: String, required: true, trim: true, maxlength: 800 },
    }],
  },
  { timestamps: true }
);

IntelligenceProductSchema.index({ status: 1, qualityState: 1, reviewAt: 1 });

IntelligenceProductSchema.pre("validate", function () {
  if (["pilot", "active"].includes(this.status) && (!this.approvedBy || !this.approvedAt)) {
    this.invalidate("approvedBy", "Pilot and active intelligence products require recorded human approval");
  }
  if (["stale", "disputed", "blocked"].includes(this.qualityState) && this.status === "active") {
    this.invalidate("status", "Stale, disputed, or blocked intelligence cannot remain active");
  }
  if (this.status === "withdrawn" && !this.withdrawnAt) {
    this.invalidate("withdrawnAt", "Withdrawn intelligence requires a withdrawal timestamp");
  }
});

module.exports = mongoose.model("IntelligenceProduct", IntelligenceProductSchema);
module.exports.INTELLIGENCE_PRODUCT_STATUSES = INTELLIGENCE_PRODUCT_STATUSES;
