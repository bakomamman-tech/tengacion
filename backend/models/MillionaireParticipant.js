const mongoose = require("mongoose");

const PARTICIPANT_STATUS_VALUES = ["registered", "suspended", "withdrawn"];

const MillionaireParticipantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    campaignSlug: {
      type: String,
      default: "tengacion-millionaire-2026",
      trim: true,
      maxlength: 100,
      index: true,
    },
    status: {
      type: String,
      enum: PARTICIPANT_STATUS_VALUES,
      default: "registered",
      index: true,
    },
    registrationSource: {
      type: String,
      enum: ["landing_page", "right_sidebar", "game_lobby", "account_creation"],
      default: "landing_page",
    },
    registeredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    registrationProfile: {
      name: { type: String, default: "", trim: true, maxlength: 160 },
      username: { type: String, default: "", trim: true, maxlength: 40 },
      email: { type: String, default: "", trim: true, lowercase: true, maxlength: 180 },
      phone: { type: String, default: "", trim: true, maxlength: 40 },
      country: { type: String, default: "", trim: true, maxlength: 120 },
      stateOfOrigin: { type: String, default: "", trim: true, maxlength: 120 },
      dateOfBirth: { type: Date, default: null },
      gender: { type: String, default: "", trim: true, maxlength: 40 },
    },
    consent: {
      rulesAccepted: { type: Boolean, required: true, default: false },
      prizeTermsAccepted: { type: Boolean, required: true, default: false },
      acceptedAt: { type: Date, default: Date.now },
    },
    playCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    nextEligibleAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastAttemptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MillionaireAttempt",
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

MillionaireParticipantSchema.index({ status: 1, registeredAt: -1 });
MillionaireParticipantSchema.index({ nextEligibleAt: 1, status: 1 });

MillionaireParticipantSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("MillionaireParticipant", MillionaireParticipantSchema);
module.exports.PARTICIPANT_STATUS_VALUES = PARTICIPANT_STATUS_VALUES;
