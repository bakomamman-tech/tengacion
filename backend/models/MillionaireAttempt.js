const mongoose = require("mongoose");

const ATTEMPT_STATUS_VALUES = ["in_progress", "lost", "completed", "expired"];
const PAYOUT_STATUS_VALUES = ["not_applicable", "pending", "approved", "paid", "rejected"];

const AttemptQuestionSchema = new mongoose.Schema(
  {
    questionId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    stage: {
      type: Number,
      required: true,
      min: 1,
      max: 3,
    },
    order: {
      type: Number,
      required: true,
      min: 1,
      max: 15,
    },
    presentedAt: {
      type: Date,
      default: null,
    },
    answeredAt: {
      type: Date,
      default: null,
    },
    selectedIndex: {
      type: Number,
      default: null,
      min: 0,
      max: 3,
    },
    correct: {
      type: Boolean,
      default: null,
    },
    timedOut: {
      type: Boolean,
      default: false,
    },
    lifelineSuggestedIndex: {
      type: Number,
      default: null,
      min: 0,
      max: 3,
    },
  },
  { _id: false }
);

const MillionaireAttemptSchema = new mongoose.Schema(
  {
    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MillionaireParticipant",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ATTEMPT_STATUS_VALUES,
      default: "in_progress",
      index: true,
    },
    questions: {
      type: [AttemptQuestionSchema],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length === 15,
        message: "A Millionaire attempt must contain exactly 15 questions.",
      },
    },
    currentQuestionIndex: {
      type: Number,
      default: 0,
      min: 0,
      max: 14,
    },
    correctAnswers: {
      type: Number,
      default: 0,
      min: 0,
      max: 15,
    },
    currentPrize: {
      type: Number,
      default: 0,
      min: 0,
      max: 5000,
    },
    finalPrize: {
      type: Number,
      default: 0,
      min: 0,
      max: 5000,
    },
    lifelineUsed: {
      type: Boolean,
      default: false,
    },
    lifelineUsedAt: {
      type: Date,
      default: null,
    },
    startedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
      index: true,
    },
    nextEligibleAt: {
      type: Date,
      required: true,
      index: true,
    },
    outcomeReason: {
      type: String,
      enum: ["", "wrong_answer", "time_expired", "all_questions_correct"],
      default: "",
    },
    payoutStatus: {
      type: String,
      enum: PAYOUT_STATUS_VALUES,
      default: "not_applicable",
      index: true,
    },
    payoutReference: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
    },
    payoutNote: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    payoutUpdatedAt: {
      type: Date,
      default: null,
    },
    payoutUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

MillionaireAttemptSchema.index({ userId: 1, startedAt: -1 });
MillionaireAttemptSchema.index({ participantId: 1, startedAt: -1 });
MillionaireAttemptSchema.index({ payoutStatus: 1, finalPrize: -1, completedAt: -1 });

MillionaireAttemptSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("MillionaireAttempt", MillionaireAttemptSchema);
module.exports.ATTEMPT_STATUS_VALUES = ATTEMPT_STATUS_VALUES;
module.exports.PAYOUT_STATUS_VALUES = PAYOUT_STATUS_VALUES;
