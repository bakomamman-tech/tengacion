const mongoose = require("mongoose");

const RAFFLE_PLAY_STATUS_VALUES = ["active", "won", "exhausted"];

const RechargeRaffleSpinSchema = new mongoose.Schema(
  {
    spinNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    outcome: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    won: {
      type: Boolean,
      default: false,
    },
    amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const RechargeRafflePlaySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    network: {
      type: String,
      enum: ["mtn", "airtel"],
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: RAFFLE_PLAY_STATUS_VALUES,
      default: "active",
      index: true,
    },
    spinsUsed: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    maxSpins: {
      type: Number,
      default: 5,
      min: 5,
      max: 5,
    },
    prizeAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    rechargeCardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RechargeRaffleCard",
      default: null,
      index: true,
    },
    prizePin: {
      type: String,
      default: "",
      trim: true,
      maxlength: 24,
    },
    wonAt: {
      type: Date,
      default: null,
      index: true,
    },
    nextAvailableAt: {
      type: Date,
      default: null,
      index: true,
    },
    spinHistory: {
      type: [RechargeRaffleSpinSchema],
      default: [],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

RechargeRafflePlaySchema.index({ userId: 1, createdAt: -1 });
RechargeRafflePlaySchema.index({ userId: 1, status: 1, createdAt: -1 });

RechargeRafflePlaySchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("RechargeRafflePlay", RechargeRafflePlaySchema);
module.exports.RAFFLE_PLAY_STATUS_VALUES = RAFFLE_PLAY_STATUS_VALUES;
