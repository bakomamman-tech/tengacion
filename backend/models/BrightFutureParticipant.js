const mongoose = require("mongoose");

const CLASS_LEVELS = [
  "Basic One", "Basic Two", "Basic Three", "Basic Four", "Basic Five", "Basic Six",
  "JSS 1", "JSS 2", "JSS 3", "SSS 1", "SSS 2", "SSS 3",
];

const SubjectScoresSchema = new mongoose.Schema(
  {
    mathematics: { type: Number, default: 0, min: 0, max: 10 },
    english: { type: Number, default: 0, min: 0, max: 10 },
    basicScienceTechnology: { type: Number, default: 0, min: 0, max: 10 },
    socialStudies: { type: Number, default: 0, min: 0, max: 10 },
  },
  { _id: false }
);

const ViolationEventSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, trim: true, maxlength: 60 },
    occurredAt: { type: Date, default: Date.now },
    recordedAt: { type: Date, default: Date.now },
    detail: { type: String, default: "", trim: true, maxlength: 240 },
  },
  { _id: false }
);

const BrightFutureParticipantSchema = new mongoose.Schema(
  {
    candidateId: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    duplicateKey: { type: String, required: true, unique: true, select: false },
    firstName: { type: String, required: true, trim: true, maxlength: 50 },
    middleName: { type: String, default: "", trim: true, maxlength: 50 },
    lastName: { type: String, required: true, trim: true, maxlength: 50 },
    gender: { type: String, required: true, enum: ["female", "male"] },
    age: { type: Number, required: true, min: 5, max: 20 },
    classLevel: { type: String, required: true, enum: CLASS_LEVELS, index: true },
    schoolName: { type: String, required: true, trim: true, maxlength: 160, index: true },
    state: { type: String, required: true, trim: true, maxlength: 80, index: true },
    lga: { type: String, required: true, trim: true, maxlength: 100 },
    guardianPhone: { type: String, required: true, trim: true, maxlength: 20, select: false },
    studentPhone: { type: String, default: "", trim: true, maxlength: 20, select: false },
    registrationTimestamp: { type: Date, default: Date.now, index: true },
    registrationMetadata: {
      ipHash: { type: String, default: "", select: false },
      userAgent: { type: String, default: "", maxlength: 240, select: false },
    },
    status: { type: String, enum: ["active", "disabled", "withdrawn"], default: "active", index: true },
    examStarted: { type: Boolean, default: false, index: true },
    examStartedAt: { type: Date, default: null },
    examCompleted: { type: Boolean, default: false, index: true },
    examCompletedAt: { type: Date, default: null, index: true },
    attemptNumber: { type: Number, default: 0, min: 0 },
    retakeAuthorized: { type: Boolean, default: false },
    subjectScores: { type: SubjectScoresSchema, default: () => ({}) },
    totalScore: { type: Number, default: 0, min: 0, max: 40, index: true },
    percentage: { type: Number, default: 0, min: 0, max: 100 },
    totalCorrect: { type: Number, default: 0, min: 0, max: 40 },
    totalWrong: { type: Number, default: 0, min: 0, max: 40 },
    totalUnanswered: { type: Number, default: 0, min: 0, max: 40 },
    totalTimeUsed: { type: Number, default: 0, min: 0 },
    averageResponseTime: { type: Number, default: 0, min: 0 },
    ranking: { type: Number, default: null, min: 1, index: true },
    violationCount: { type: Number, default: 0, min: 0 },
    violationEvents: { type: [ViolationEventSchema], default: [] },
    submissionReason: { type: String, default: "", trim: true, maxlength: 80 },
    competitionStatus: {
      type: String,
      enum: ["registered", "in_progress", "completed", "auto_submitted", "disabled"],
      default: "registered",
      index: true,
    },
    winnerStatus: { type: String, enum: ["none", "leader", "champion", "tied"], default: "none" },
    latestAttemptId: { type: mongoose.Schema.Types.ObjectId, ref: "BrightFutureExamAttempt", default: null, index: true },
  },
  { timestamps: true, optimisticConcurrency: true }
);

BrightFutureParticipantSchema.index({ status: 1, registrationTimestamp: -1 });
BrightFutureParticipantSchema.index({ examCompleted: 1, totalScore: -1, totalTimeUsed: 1 });

BrightFutureParticipantSchema.virtual("fullName").get(function getFullName() {
  return [this.firstName, this.middleName, this.lastName].filter(Boolean).join(" ");
});

BrightFutureParticipantSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("BrightFutureParticipant", BrightFutureParticipantSchema);
module.exports.BRIGHT_FUTURE_CLASS_LEVELS = CLASS_LEVELS;
