const mongoose = require("mongoose");

const MARKET_READINESS_STATES = ["research", "partner_seed", "creator_seed", "controlled_launch", "growth", "hold", "exit"];
const MARKET_GATE_KEYS = [
  "payment_fit",
  "payout_fit",
  "creator_supply",
  "fan_demand",
  "support_coverage",
  "moderation_capacity",
  "rights_and_takedown",
  "partner_readiness",
  "low_bandwidth_performance",
  "data_and_privacy",
];

const gateSchema = new mongoose.Schema(
  {
    key: { type: String, enum: MARKET_GATE_KEYS, required: true },
    status: { type: String, enum: ["not_assessed", "blocked", "watch", "ready"], default: "not_assessed" },
    ownerRole: { type: String, required: true, trim: true, maxlength: 120 },
    evidence: { type: String, default: "", trim: true, maxlength: 600 },
    reviewedAt: { type: Date, default: null },
  },
  { _id: false }
);

const MarketReadinessReviewSchema = new mongoose.Schema(
  {
    marketKey: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 120 },
    marketName: { type: String, required: true, trim: true, maxlength: 180 },
    marketType: { type: String, enum: ["country", "region", "city", "community"], required: true },
    state: { type: String, enum: MARKET_READINESS_STATES, default: "research", index: true },
    ownerName: { type: String, required: true, trim: true, maxlength: 120 },
    ownerRole: { type: String, required: true, trim: true, maxlength: 120 },
    gates: { type: [gateSchema], default: [] },
    primaryMetric: { type: String, required: true, trim: true, maxlength: 200 },
    costCap: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "NGN", trim: true, uppercase: true, maxlength: 10 },
    stopCondition: { type: String, required: true, trim: true, maxlength: 600 },
    reviewAt: { type: Date, required: true, index: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lastChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    history: [{
      state: { type: String, enum: MARKET_READINESS_STATES, required: true },
      at: { type: Date, default: Date.now },
      actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      reason: { type: String, default: "", trim: true, maxlength: 600 },
    }],
  },
  { timestamps: true }
);

MarketReadinessReviewSchema.index({ state: 1, reviewAt: 1 });

MarketReadinessReviewSchema.pre("validate", function () {
  const gateKeys = (this.gates || []).map((gate) => gate.key);
  if (new Set(gateKeys).size !== gateKeys.length) {
    this.invalidate("gates", "Market readiness gates must be unique");
  }
  if (["controlled_launch", "growth"].includes(this.state)) {
    const gatesByKey = new Map((this.gates || []).map((gate) => [gate.key, gate]));
    const incomplete = MARKET_GATE_KEYS.filter((key) => {
      const gate = gatesByKey.get(key);
      return !gate || gate.status !== "ready" || !gate.reviewedAt || !String(gate.evidence || "").trim();
    });
    if (incomplete.length) {
      this.invalidate("gates", `Controlled launch requires all readiness gates: ${incomplete.join(", ")}`);
    }
    if (!this.approvedBy || !this.approvedAt) {
      this.invalidate("approvedBy", "Controlled market launch requires recorded human approval");
    }
  }
});

module.exports = mongoose.model("MarketReadinessReview", MarketReadinessReviewSchema);
module.exports.MARKET_READINESS_STATES = MARKET_READINESS_STATES;
module.exports.MARKET_GATE_KEYS = MARKET_GATE_KEYS;
