const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

require("../config/env");

const connectDB = require("../config/db");
const { QUESTIONS } = require("../data/brightFutureQuestionBank");
const BrightFutureCompetitionConfig = require("../models/BrightFutureCompetitionConfig");
const BrightFutureExamAttempt = require("../models/BrightFutureExamAttempt");
const BrightFutureParticipant = require("../models/BrightFutureParticipant");
const BrightFutureQuestion = require("../models/BrightFutureQuestion");

const CONFIRMATION = "RESET-BRIGHT-FUTURE-EXAMS";
const ARCHIVE_COLLECTION = "brightfutureexamresetarchives";
const RESET_REASON = "question_bank_refresh";
const TOTAL_QUESTIONS = QUESTIONS.length;

const getSummary = async () => {
  const currentQuestionIds = QUESTIONS.map((question) => question.questionId);
  const [
    participants,
    activeParticipants,
    completedParticipants,
    startedParticipants,
    inProgressParticipants,
    attempts,
    activeQuestions,
    activeCurrentQuestions,
    activeLegacyQuestions,
  ] = await Promise.all([
    BrightFutureParticipant.countDocuments({}),
    BrightFutureParticipant.countDocuments({ status: "active" }),
    BrightFutureParticipant.countDocuments({ examCompleted: true }),
    BrightFutureParticipant.countDocuments({ examStarted: true }),
    BrightFutureParticipant.countDocuments({ competitionStatus: "in_progress" }),
    BrightFutureExamAttempt.countDocuments({}),
    BrightFutureQuestion.countDocuments({ active: true }),
    BrightFutureQuestion.countDocuments({ questionId: { $in: currentQuestionIds }, active: true }),
    BrightFutureQuestion.countDocuments({ questionId: { $nin: currentQuestionIds }, active: true }),
  ]);
  return {
    database: mongoose.connection.name,
    participants,
    activeParticipants,
    completedParticipants,
    startedParticipants,
    inProgressParticipants,
    attempts,
    activeQuestions,
    activeCurrentQuestions,
    activeLegacyQuestions,
    expectedCurrentQuestions: TOTAL_QUESTIONS,
  };
};

const archiveExamState = async ({ batchId, archivedAt, before }) => {
  const [participants, attempts] = await Promise.all([
    BrightFutureParticipant.find({})
      .select([
        "candidateId", "status", "examStarted", "examStartedAt", "examCompleted", "examCompletedAt",
        "attemptNumber", "retakeAuthorized", "subjectScores", "maximumScore", "totalScore", "percentage",
        "totalCorrect", "totalWrong", "totalUnanswered", "totalTimeUsed", "averageResponseTime", "ranking",
        "violationCount", "violationEvents", "submissionReason", "competitionStatus", "winnerStatus",
        "latestAttemptId",
      ].join(" "))
      .lean(),
    BrightFutureExamAttempt.find({})
      .select("+questions.correctPresentedIndex +questions.correct +questions.idempotencyKey")
      .lean(),
  ]);
  const collection = mongoose.connection.collection(ARCHIVE_COLLECTION);
  await collection.insertOne({
    batchId,
    kind: "manifest",
    status: "prepared",
    archivedAt,
    reason: RESET_REASON,
    before,
  });
  const snapshots = [
    ...participants.map((data) => ({ batchId, kind: "participant", sourceId: data._id, archivedAt, data })),
    ...attempts.map((data) => ({ batchId, kind: "attempt", sourceId: data._id, archivedAt, data })),
  ];
  if (snapshots.length) await collection.insertMany(snapshots, { ordered: true });
};

const resetExamState = async ({ batchId, resetAt }) => {
  const currentQuestionIds = QUESTIONS.map((question) => question.questionId);
  const session = await mongoose.startSession();
  let results;
  try {
    await session.withTransaction(async () => {
      const attempts = await BrightFutureExamAttempt.deleteMany({}, { session });
      const participants = await BrightFutureParticipant.updateMany(
        {},
        {
          $set: {
            examStarted: false,
            examStartedAt: null,
            examCompleted: false,
            examCompletedAt: null,
            attemptNumber: 0,
            retakeAuthorized: false,
            subjectScores: {},
            maximumScore: TOTAL_QUESTIONS,
            totalScore: 0,
            percentage: 0,
            totalCorrect: 0,
            totalWrong: 0,
            totalUnanswered: 0,
            totalTimeUsed: 0,
            averageResponseTime: 0,
            ranking: null,
            violationCount: 0,
            violationEvents: [],
            submissionReason: "",
            winnerStatus: "none",
            latestAttemptId: null,
          },
        },
        { session }
      );
      const activeParticipants = await BrightFutureParticipant.updateMany(
        { status: "active" },
        { $set: { competitionStatus: "registered" } },
        { session }
      );
      await BrightFutureParticipant.updateMany(
        { status: { $ne: "active" } },
        { $set: { competitionStatus: "disabled" } },
        { session }
      );
      const legacyQuestions = await BrightFutureQuestion.updateMany(
        { questionId: { $nin: currentQuestionIds }, active: true },
        { $set: { active: false } },
        { session }
      );
      await BrightFutureCompetitionConfig.findOneAndUpdate(
        { key: "default" },
        {
          $set: {
            competitionStatus: "examination_open",
            examinationOpen: true,
          },
          $setOnInsert: { key: "default" },
        },
        { returnDocument: "after", upsert: true, setDefaultsOnInsert: true, session }
      );
      results = {
        deletedAttempts: attempts.deletedCount,
        resetParticipants: participants.modifiedCount,
        activeParticipantsReady: activeParticipants.matchedCount,
        deactivatedLegacyQuestions: legacyQuestions.modifiedCount,
      };
    });
  } finally {
    await session.endSession();
  }
  await mongoose.connection.collection(ARCHIVE_COLLECTION).updateOne(
    { batchId, kind: "manifest" },
    { $set: { status: "complete", completedAt: resetAt, results } }
  );
  return results;
};

const main = async () => {
  const args = process.argv.slice(2);
  const execute = args.includes("--run");
  const confirmation = args.find((value) => value.startsWith("--confirm="))?.slice("--confirm=".length);

  await connectDB();
  try {
    const before = await getSummary();
    console.log(JSON.stringify({ mode: execute ? "execute" : "dry-run", before }, null, 2));
    if (!execute) {
      console.log(`Dry-run only. Use --run --confirm=${CONFIRMATION} to reset CBT exam data.`);
      return;
    }
    if (confirmation !== CONFIRMATION) {
      throw new Error(`Execution requires --confirm=${CONFIRMATION}`);
    }
    if (before.activeCurrentQuestions !== TOTAL_QUESTIONS || before.activeLegacyQuestions !== 0) {
      throw new Error(
        `Question-bank preflight failed: expected ${TOTAL_QUESTIONS} active current questions and no active legacy questions.`
      );
    }
    const batchId = new mongoose.Types.ObjectId();
    const resetAt = new Date();
    await archiveExamState({ batchId, archivedAt: resetAt, before });
    const results = await resetExamState({ batchId, resetAt });
    const after = await getSummary();
    console.log(JSON.stringify({ archiveBatchId: String(batchId), results, after }, null, 2));
    if (
      after.completedParticipants !== 0 ||
      after.startedParticipants !== 0 ||
      after.inProgressParticipants !== 0 ||
      after.attempts !== 0 ||
      after.activeCurrentQuestions !== TOTAL_QUESTIONS ||
      after.activeLegacyQuestions !== 0
    ) {
      throw new Error("Post-reset verification failed.");
    }
  } finally {
    await mongoose.disconnect().catch(() => null);
  }
};

main().catch((error) => {
  console.error("Bright Future exam reset failed:", error?.message || error);
  process.exitCode = 1;
});
