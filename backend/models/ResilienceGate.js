const mongoose = require("mongoose");

const GATE_STATUSES = ["draft", "approved", "watch", "blocked", "expired", "retired"];

const ResilienceGateSchema = new mongoose.Schema({
  gateKey: { type: String, required: true, unique: true, index: true, trim: true, lowercase: true, maxlength: 120 },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  target: { type: String, required: true, trim: true, maxlength: 1000 },
  evidenceRequired: [{ type: String, required: true, trim: true, maxlength: 500 }],
  evidenceRefs: [{ type: String, trim: true, maxlength: 1000 }],
  ownerName: { type: String, required: true, trim: true, maxlength: 120 },
  ownerRole: { type: String, required: true, trim: true, maxlength: 120 },
  reviewerName: { type: String, required: true, trim: true, maxlength: 120 },
  reviewCadence: { type: String, required: true, trim: true, maxlength: 120 },
  blockerCondition: { type: String, required: true, trim: true, maxlength: 1000 },
  rollbackOrPauseCondition: { type: String, required: true, trim: true, maxlength: 1000 },
  launchOrPartnerImplication: { type: String, required: true, trim: true, maxlength: 1000 },
  status: { type: String, enum: GATE_STATUSES, default: "draft", index: true },
  lastReviewedAt: { type: Date, default: null },
  nextReviewAt: { type: Date, required: true, index: true },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  approvedAt: { type: Date, default: null },
  approvalExpiresAt: { type: Date, default: null, index: true },
  decisionReason: { type: String, default: "", trim: true, maxlength: 1500 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  lastChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  history: [{
    status: { type: String, enum: GATE_STATUSES, required: true },
    at: { type: Date, default: Date.now },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
  }],
}, { timestamps: true });

ResilienceGateSchema.pre("validate", function () {
  this.gateKey = String(this.gateKey || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (this.status === "approved") {
    if (!this.approvedBy || !this.approvedAt || !this.approvalExpiresAt) this.invalidate("approvedBy", "Approved resilience gates require human approval and expiry");
    if (!(this.evidenceRefs || []).length) this.invalidate("evidenceRefs", "Approved resilience gates require stored evidence references");
  }
});

module.exports = mongoose.model("ResilienceGate", ResilienceGateSchema);
module.exports.GATE_STATUSES = GATE_STATUSES;
