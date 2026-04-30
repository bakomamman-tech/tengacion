const mongoose = require("mongoose");

const RAFFLE_NETWORK_VALUES = ["mtn", "airtel"];
const RAFFLE_CARD_STATUS_VALUES = ["available", "claimed", "void"];

const RechargeRaffleCardSchema = new mongoose.Schema(
  {
    network: {
      type: String,
      enum: RAFFLE_NETWORK_VALUES,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    amount: {
      type: Number,
      default: 100,
      min: 100,
      max: 100,
      index: true,
    },
    pin: {
      type: String,
      required: true,
      trim: true,
      maxlength: 24,
    },
    status: {
      type: String,
      enum: RAFFLE_CARD_STATUS_VALUES,
      default: "available",
      index: true,
    },
    loadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    claimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    claimedAt: {
      type: Date,
      default: null,
      index: true,
    },
    playId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RechargeRafflePlay",
      default: null,
      index: true,
    },
    batchLabel: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    adminNote: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },
  },
  {
    timestamps: true,
  }
);

RechargeRaffleCardSchema.index({ network: 1, pin: 1 }, { unique: true });
RechargeRaffleCardSchema.index({ status: 1, network: 1, createdAt: 1 });
RechargeRaffleCardSchema.index({ claimedBy: 1, claimedAt: -1 });

RechargeRaffleCardSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("RechargeRaffleCard", RechargeRaffleCardSchema);
module.exports.RAFFLE_NETWORK_VALUES = RAFFLE_NETWORK_VALUES;
module.exports.RAFFLE_CARD_STATUS_VALUES = RAFFLE_CARD_STATUS_VALUES;
