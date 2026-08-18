const mongoose = require("mongoose");

const AttemptQuestionSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true, trim: true, maxlength: 80 },
    subject: { type: String, required: true, trim: true, maxlength: 50 },
    subjectLabel: { type: String, required: true, trim: true, maxlength: 80 },
    prompt: { type: String, required: true, trim: true, maxlength: 1000 },
    options: {
      type: [{ type: String, trim: true, maxlength: 300 }],
      required: true,
      validate: (value) => Array.isArray(value) && value.length === 5,
    },
    correctPresentedIndex: { type: Number, required: true, min: 0, max: 4, select: false },
    order: { type: Number, required: true, min: 1, max: 40 },
    presentedAt: { type: Date, default: null },
    deadlineAt: { type: Date, default: null },
    answeredAt: { type: Date, default: null },
    selectedPresentedIndex: { type: Number, default: null, min: 0, max: 4 },
    correct: { type: Boolean, default: null, select: false },
    unanswered: { type: Boolean, default: false },
    timedOut: { type: Boolean, default: false },
    responseTimeMs: { type: Number, default: 0, min: 0 },
    idempotencyKey: { type: String, default: "", trim: true, maxlength: 100, select: false },
  },
  { _id: false }
);

const AttemptViolationSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, trim: true, maxlength: 60 },
    occurredAt: { type: Date, default: Date.now },
    recordedAt: { type: Date, default: Date.now },
    detail: { type: String, default: "", trim: true, maxlength: 240 },
  },
  { _id: false }
);

const BrightFutureExamAttemptSchema = new mongoose.Schema(
  {
    participantId: { type: mongoose.Schema.Types.ObjectId, ref: "BrightFutureParticipant", required: true, index: true },
    candidateId: { type: String, required: true, uppercase: true, trim: true, index: true },
    attemptNumber: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ["in_progress", "completed", "auto_submitted", "reset"], default: "in_progress", index: true },
    questions: {
      type: [AttemptQuestionSchema],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length === 40,
        message: "A Bright Future attempt must contain exactly 40 questions.",
      },
    },
    currentQuestionIndex: { type: Number, default: 0, min: 0, max: 40 },
    timerSeconds: { type: Number, required: true, default: 50, min: 20, max: 180 },
    allowedViolations: { type: Number, required: true, default: 3, min: 1, max: 10 },
    violationCount: { type: Number, default: 0, min: 0 },
    violationEvents: { type: [AttemptViolationSchema], default: [] },
    startedAt: { type: Date, default: Date.now, index: true },
    completedAt: { type: Date, default: null, index: true },
    submissionReason: { type: String, default: "", trim: true, maxlength: 80 },
    subjectScores: { type: mongoose.Schema.Types.Mixed, default: {} },
    totalScore: { type: Number, default: 0, min: 0, max: 40 },
    percentage: { type: Number, default: 0, min: 0, max: 100 },
    totalCorrect: { type: Number, default: 0, min: 0, max: 40 },
    totalWrong: { type: Number, default: 0, min: 0, max: 40 },
    totalUnanswered: { type: Number, default: 0, min: 0, max: 40 },
    totalTimeUsed: { type: Number, default: 0, min: 0 },
    averageResponseTime: { type: Number, default: 0, min: 0 },
    rank: { type: Number, default: null, min: 1 },
  },
  { timestamps: true, optimisticConcurrency: true }
);

BrightFutureExamAttemptSchema.index({ participantId: 1, attemptNumber: 1 }, { unique: true });
BrightFutureExamAttemptSchema.index({ status: 1, totalScore: -1, totalTimeUsed: 1 });

module.exports = mongoose.model("BrightFutureExamAttempt", BrightFutureExamAttemptSchema);
