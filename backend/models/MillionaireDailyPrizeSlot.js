const mongoose = require("mongoose");

const MillionaireDailyPrizeSlotSchema = new mongoose.Schema(
  {
    dateKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    selectedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    selectedParticipantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MillionaireParticipant",
      required: true,
      index: true,
    },
    selectionPoolSize: {
      type: Number,
      default: 0,
      min: 1,
    },
    maximumPrize: {
      type: Number,
      default: 1000,
      min: 1000,
      max: 1000,
    },
    selectedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "MillionaireDailyPrizeSlot",
  MillionaireDailyPrizeSlotSchema
);
