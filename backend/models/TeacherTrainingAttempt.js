const mongoose = require("mongoose");

const TrainingQuestionStateSchema = new mongoose.Schema(
  {
    questionId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    optionOrder: {
      type: [Number],
      required: true,
      validate: {
        validator: (value) =>
          Array.isArray(value) &&
          value.length === 4 &&
          new Set(value).size === 4 &&
          value.every((entry) => Number.isInteger(entry) && entry >= 0 && entry <= 3),
        message: "Every training question must contain one ordering of four options.",
      },
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
    selectedOriginalIndex: {
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
  },
  { _id: false }
);

const TeacherTrainingAttemptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    campaignId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      index: true,
    },
    moduleCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 20,
      index: true,
    },
    status: {
      type: String,
      enum: ["in_progress", "completed"],
      default: "in_progress",
      index: true,
    },
    questions: {
      type: [TrainingQuestionStateSchema],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length === 5,
        message: "A module assessment must contain exactly five questions.",
      },
    },
    currentQuestionIndex: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    correctAnswers: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    timedOutAnswers: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    scorePercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
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
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

TeacherTrainingAttemptSchema.index(
  { userId: 1, campaignId: 1, moduleCode: 1 },
  { unique: true }
);
TeacherTrainingAttemptSchema.index({ campaignId: 1, completedAt: -1 });

TeacherTrainingAttemptSchema.methods.toJSON = function toJSON() {
  const value = this.toObject();
  delete value.__v;
  return value;
};

module.exports = mongoose.model("TeacherTrainingAttempt", TeacherTrainingAttemptSchema);
