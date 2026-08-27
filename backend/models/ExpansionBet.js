const mongoose = require("mongoose");

const EXPANSION_STATES = ["research", "seed", "controlled_launch", "expand", "hold", "exit"];
const SCORE_INPUT_KEYS = [
  "creatorSupply",
  "fanDemand",
  "localPaymentFit",
  "categoryStrength",
  "supportCapacity",
  "moderationRightsReadiness",
  "partnerAccess",
  "acquisitionEfficiency",
  "retentionEvidence",
  "payoutFeasibility",
];

const scoreFields = SCORE_INPUT_KEYS.reduce((fields, key) => {
  fields[key] = { type: Number, required: true, min: 0, max: 5 };
  return fields;
}, {});

const ExpansionBetSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    betKey: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 100 },
    marketOrSegment: { type: String, required: true, trim: true, maxlength: 160 },
    state: { type: String, enum: EXPANSION_STATES, default: "research", index: true },
    ownerName: { type: String, required: true, trim: true, maxlength: 120 },
    ownerRole: { type: String, default: "Growth and partnerships", trim: true, maxlength: 120 },
    cohortDefinition: { type: String, required: true, trim: true, maxlength: 400 },
    gate: { type: String, required: true, trim: true, maxlength: 400 },
    costCap: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "NGN", trim: true, uppercase: true, maxlength: 10 },
    successMetric: { type: String, required: true, trim: true, maxlength: 300 },
    stopCondition: { type: String, required: true, trim: true, maxlength: 400 },
    reviewAt: { type: Date, required: true, index: true },
    scores: { type: new mongoose.Schema(scoreFields, { _id: false }), required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lastChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    stateHistory: [
      {
        state: { type: String, enum: EXPANSION_STATES, required: true },
        at: { type: Date, default: Date.now },
        actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        reason: { type: String, default: "", trim: true, maxlength: 500 },
      },
    ],
  },
  { timestamps: true }
);

ExpansionBetSchema.index({ state: 1, reviewAt: 1 });

module.exports = mongoose.model("ExpansionBet", ExpansionBetSchema);
module.exports.EXPANSION_STATES = EXPANSION_STATES;
module.exports.SCORE_INPUT_KEYS = SCORE_INPUT_KEYS;
