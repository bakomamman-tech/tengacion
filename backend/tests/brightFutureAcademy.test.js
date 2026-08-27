const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/bright-future-academy-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "bright_future_academy_test_secret_123456789";

const app = require("../app");
const { QUESTIONS, SUBJECT_DEFINITIONS } = require("../data/brightFutureQuestionBank");
const BrightFutureExamAttempt = require("../models/BrightFutureExamAttempt");
const BrightFutureParticipant = require("../models/BrightFutureParticipant");
const User = require("../models/User");
const {
  buildAdminOverview,
  getExamState,
  getLeaderboard,
  listPublicParticipants,
  loginParticipant,
  recordViolation,
  registerParticipant,
  resetAdminAttempt,
  resetAdminPassword,
  startExam,
  submitAnswer,
} = require("../services/brightFutureAcademyService");

let mongod;

const registration = (overrides = {}) => ({
  firstName: "Amina",
  middleName: "Zainab",
  lastName: "Bello",
  gender: "female",
  age: 13,
  classLevel: "JSS 2",
  schoolName: "Unity Model Academy",
  state: "Kaduna",
  lga: "Kaduna North",
  guardianPhone: "08031234567",
  studentPhone: "",
  password: "Bright2026!",
  passwordConfirmation: "Bright2026!",
  ...overrides,
});

const createAdminToken = async ({ role = "admin", username = "bfaadmin", email = "bfaadmin@example.com" } = {}) => {
  const user = await User.create({
    name: "Bright Future Admin",
    username,
    email,
    password: "Password123!",
    role,
    isVerified: true,
    emailVerified: true,
  });
  const sessionId = new mongoose.Types.ObjectId().toString();
  user.sessions.push({ sessionId, createdAt: new Date(), lastSeenAt: new Date() });
  await user.save();
  return jwt.sign({ id: user._id.toString(), tv: 0, sid: sessionId }, process.env.JWT_SECRET, { expiresIn: "1h" });
};

describe("Bright Future Academy CBT", () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
    await mongoose.connect(mongod.getUri(), { serverSelectionTimeoutMS: 60000 });
  });

  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.disconnect().catch(() => null);
    if (mongod) await mongod.stop();
  });

  test("ships exactly ten validated five-option questions for each of five challenging categories", () => {
    expect(QUESTIONS).toHaveLength(50);
    expect(SUBJECT_DEFINITIONS).toHaveLength(5);
    for (const subject of SUBJECT_DEFINITIONS) {
      expect(QUESTIONS.filter((question) => question.subject === subject.key)).toHaveLength(10);
    }
    for (const question of QUESTIONS) {
      expect(question.options).toHaveLength(5);
      expect(new Set(question.options).size).toBe(5);
      expect(question.correctIndex).toBeGreaterThanOrEqual(0);
      expect(question.correctIndex).toBeLessThan(5);
    }
  });

  test("registers without email, creates a server candidate ID, blocks duplicates and supports password login", async () => {
    const result = await registerParticipant(registration(), { ip: "127.0.0.1" });
    expect(result.candidate).toMatchObject({
      candidateId: "BFA-2026-000001",
      fullName: "Amina Zainab Bello",
      competitionStatus: "registered",
    });
    expect(result.candidate).not.toHaveProperty("guardianPhone");
    expect(result.candidateToken).toEqual(expect.any(String));

    await expect(registerParticipant(registration())).rejects.toMatchObject({
      status: 409,
      code: "duplicate_registration",
    });

    await expect(loginParticipant({
      candidateId: result.candidate.candidateId.toLowerCase(),
      password: "Bright2026!",
    })).resolves.toMatchObject({ candidate: { candidateId: "BFA-2026-000001" } });

    await expect(loginParticipant({
      candidateId: result.candidate.candidateId,
      password: "WrongPassword1",
    })).rejects.toMatchObject({ status: 401, code: "invalid_candidate_credentials" });

    await expect(registerParticipant(registration({ guardianPhone: "08039999999", password: "", passwordConfirmation: "" })))
      .rejects.toMatchObject({ status: 422, code: "validation_failed", payload: { details: { password: expect.any(String) } } });
    await expect(registerParticipant(registration({ guardianPhone: "08038888888", passwordConfirmation: "Different2026!" })))
      .rejects.toMatchObject({ status: 422, code: "validation_failed", payload: { details: { passwordConfirmation: expect.any(String) } } });
  });

  test("preserves legacy guardian-phone access and lets an admin reset a password without exposing stored secrets", async () => {
    const registered = await registerParticipant(registration());
    await BrightFutureParticipant.updateOne(
      { candidateId: registered.candidate.candidateId },
      { $unset: { passwordHash: 1, credentialsUpdatedAt: 1 } }
    );
    await expect(loginParticipant({
      candidateId: registered.candidate.candidateId,
      password: "08031234567",
    })).resolves.toMatchObject({ candidate: { candidateId: registered.candidate.candidateId } });

    const participant = await BrightFutureParticipant.findOne({ candidateId: registered.candidate.candidateId });
    const reset = await resetAdminPassword(participant._id);
    expect(reset.credentials).toMatchObject({ candidateId: registered.candidate.candidateId, temporaryPassword: expect.stringMatching(/^BFA-/) });
    expect(JSON.stringify(reset.student)).not.toContain("passwordHash");
    await expect(loginParticipant({ candidateId: registered.candidate.candidateId, password: reset.credentials.temporaryPassword }))
      .resolves.toMatchObject({ candidate: { candidateId: registered.candidate.candidateId } });
    await expect(loginParticipant({ candidateId: registered.candidate.candidateId, password: "08031234567" }))
      .rejects.toMatchObject({ status: 401, code: "invalid_candidate_credentials" });
  });

  test("delivers only the current randomized question and never exposes the answer key", async () => {
    const registered = await registerParticipant(registration());
    const token = registered.candidateToken;
    const startResponse = await request(app)
      .post("/api/bright-future-academy/exam/start")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(startResponse.body.attempt.currentQuestion).toMatchObject({
      number: 1,
      totalQuestions: 50,
      options: expect.any(Array),
    });
    expect(startResponse.body.attempt.currentQuestion.options).toHaveLength(5);
    expect(startResponse.body.attempt.currentQuestion).not.toHaveProperty("correctIndex");
    expect(startResponse.body.attempt.currentQuestion).not.toHaveProperty("correctPresentedIndex");
    expect(JSON.stringify(startResponse.body)).not.toContain("answer key");
  });

  test("uses persisted deadlines so refresh cannot restore expired question time", async () => {
    const registered = await registerParticipant(registration());
    const participant = await BrightFutureParticipant.findOne({ candidateId: registered.candidate.candidateId });
    const startedAt = new Date("2026-08-18T10:00:00.000Z");
    const started = await startExam(participant._id, { now: startedAt });
    expect(started.attempt.currentQuestion.number).toBe(1);

    const recovered = await getExamState(participant._id, {
      now: new Date(startedAt.getTime() + 51_000),
    });
    expect(recovered.attempt.currentQuestion.number).toBe(2);
    expect(recovered.attempt.currentQuestion.secondsRemaining).toBe(49);
    const attempt = await BrightFutureExamAttempt.findById(started.attempt.id);
    expect(attempt.questions[0]).toMatchObject({ unanswered: true, timedOut: true });
  });

  test("scores all answers on the server and calculates subject totals", async () => {
    const registered = await registerParticipant(registration());
    const participant = await BrightFutureParticipant.findOne({ candidateId: registered.candidate.candidateId });
    let now = new Date("2026-08-18T11:00:00.000Z");
    let state = await startExam(participant._id, { now });

    for (let index = 0; index < 50; index += 1) {
      const secureAttempt = await BrightFutureExamAttempt.findById(state.attempt.id)
        .select("+questions.correctPresentedIndex +questions.correct +questions.idempotencyKey");
      const current = secureAttempt.questions[secureAttempt.currentQuestionIndex];
      now = new Date(now.getTime() + 1_000);
      state = await submitAnswer(participant._id, {
        questionId: current.questionId,
        selectedOptionIndex: current.correctPresentedIndex,
        idempotencyKey: `answer-${index}`,
      }, { now });
    }

    const completed = await BrightFutureParticipant.findById(participant._id);
    expect(completed).toMatchObject({
      examCompleted: true,
      maximumScore: 50,
      totalScore: 50,
      percentage: 100,
      totalCorrect: 50,
      totalWrong: 0,
      totalUnanswered: 0,
    });
    expect(completed.subjectScores).toMatchObject({
      nigerianEntertainment: 10,
      football: 10,
      technology: 10,
      generalEnglish: 10,
      stem: 10,
    });
    await expect(startExam(participant._id, { now: new Date(now.getTime() + 1000) })).rejects.toMatchObject({
      status: 409,
      code: "attempt_completed",
    });
    await resetAdminAttempt(participant._id);
    await expect(startExam(participant._id, { now: new Date(now.getTime() + 2000) })).resolves.toMatchObject({
      attempt: { status: "in_progress", attemptNumber: 2 },
    });
  });

  test("records focus violations and auto-submits at the configured threshold", async () => {
    const registered = await registerParticipant(registration());
    const participant = await BrightFutureParticipant.findOne({ candidateId: registered.candidate.candidateId });
    const now = new Date("2026-08-18T12:00:00.000Z");
    await startExam(participant._id, { now });
    await recordViolation(participant._id, { type: "visibility_hidden" }, { now: new Date(now.getTime() + 1000) });
    await recordViolation(participant._id, { type: "window_blur" }, { now: new Date(now.getTime() + 2000) });
    const third = await recordViolation(participant._id, { type: "fullscreen_exit" }, { now: new Date(now.getTime() + 3000) });
    expect(third.autoSubmitted).toBe(true);
    expect(third.attempt.status).toBe("auto_submitted");
    const completed = await BrightFutureParticipant.findById(participant._id);
    expect(completed).toMatchObject({ examCompleted: true, violationCount: 3, submissionReason: "violation_limit" });
  });

  test("ranks current and legacy results fairly while keeping public data private", async () => {
    const first = await registerParticipant(registration({ guardianPhone: "08031111111" }));
    const second = await registerParticipant(registration({ firstName: "Chidi", lastName: "Okafor", guardianPhone: "08032222222" }));
    const firstRecord = await BrightFutureParticipant.findOne({ candidateId: first.candidate.candidateId });
    const secondRecord = await BrightFutureParticipant.findOne({ candidateId: second.candidate.candidateId });
    await BrightFutureParticipant.updateOne({ _id: firstRecord._id }, { $set: { examCompleted: true, maximumScore: 40, totalScore: 32, percentage: 80, subjectScores: { mathematics: 7, english: 8, basicScienceTechnology: 9, socialStudies: 8 }, totalTimeUsed: 900 } });
    await BrightFutureParticipant.updateOne({ _id: secondRecord._id }, { $set: { examCompleted: true, maximumScore: 50, totalScore: 40, percentage: 80, subjectScores: { nigerianEntertainment: 8, football: 9, technology: 8, generalEnglish: 7, stem: 8 }, totalTimeUsed: 1000 } });

    const leaderboard = await getLeaderboard();
    expect(leaderboard.entries[0]).toMatchObject({ displayName: "Chidi O.", rank: 1, score: 40, maximumScore: 50, percentage: 80 });
    expect(leaderboard.entries[1]).toMatchObject({ displayName: "Amina B.", rank: 2, score: 32, maximumScore: 40, percentage: 80 });
    expect(leaderboard.entries[0].candidateId).toContain("••");
    expect(leaderboard.entries[0]).not.toHaveProperty("guardianPhone");
    await expect(buildAdminOverview()).resolves.toMatchObject({ averageScore: 40, highestScore: 40, lowestScore: 40, maximumScore: 50 });
    const publicList = await listPublicParticipants({ search: "Unity" });
    expect(publicList.participants[0]).not.toHaveProperty("studentPhone");
    expect(publicList.participants[0]).not.toHaveProperty("age");
  });

  test("protects Bright Future administration with existing Tengacion admin authorization", async () => {
    await request(app).get("/api/admin/bright-future-academy/overview").expect(401);
    const userToken = await createAdminToken({ role: "user", username: "ordinarybfa", email: "ordinarybfa@example.com" });
    await request(app)
      .get("/api/admin/bright-future-academy/overview")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(403);
    const adminToken = await createAdminToken();
    const response = await request(app)
      .get("/api/admin/bright-future-academy/overview")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(response.body.overview).toHaveProperty("totalRegistrations");
  });
});
