const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-millionaire-test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "millionaire_game_test_secret_123456789012345";

const app = require("../app");
const { getQuestionById } = require("../data/millionaireQuestionBank");
const MillionaireAttempt = require("../models/MillionaireAttempt");
const MillionaireParticipant = require("../models/MillionaireParticipant");
const User = require("../models/User");

let mongod;

const issueSessionToken = async (userId) => {
  const sessionId = new mongoose.Types.ObjectId().toString();
  await User.updateOne(
    { _id: userId },
    {
      $push: {
        sessions: {
          sessionId,
          createdAt: new Date(),
          lastSeenAt: new Date(),
        },
      },
    }
  );
  return jwt.sign(
    { id: userId.toString(), tv: 0, sid: sessionId },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );
};

const createUser = async ({
  role = "user",
  email = "millionaire@example.com",
  username = "millionaire",
  completeProfile = false,
} = {}) =>
  User.create({
    name: "Millionaire Player",
    username,
    email,
    password: "Password123!",
    role,
    isVerified: true,
    emailVerified: true,
    ...(completeProfile
      ? {
          phone: "+2348012345678",
          country: "Nigeria",
          stateOfOrigin: "Kaduna",
          dob: new Date("1994-06-18"),
          gender: "female",
          avatar: {
            url: "https://res.cloudinary.com/demo/image/upload/player-avatar.jpg",
            secureUrl: "https://res.cloudinary.com/demo/image/upload/player-avatar.jpg",
          },
          cover: {
            url: "https://res.cloudinary.com/demo/image/upload/player-cover.jpg",
            secureUrl: "https://res.cloudinary.com/demo/image/upload/player-cover.jpg",
          },
        }
      : {}),
  });

const registerPlayer = (token) =>
  request(app)
    .post("/api/millionaire/register")
    .set("Authorization", `Bearer ${token}`)
    .send({
      rulesAccepted: true,
      prizeTermsAccepted: true,
      source: "landing_page",
    });

describe("Tengacion Millionaire game", () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create({
      instance: { launchTimeout: 60000 },
    });
    await mongoose.connect(mongod.getUri(), {
      serverSelectionTimeoutMS: 60000,
      socketTimeoutMS: 60000,
    });
  });

  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
  });

  afterAll(async () => {
    try {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.dropDatabase();
      }
    } finally {
      await mongoose.disconnect().catch(() => null);
      if (mongod) await mongod.stop();
    }
  });

  test("registers an account for the game but blocks play until profile details and both photos are complete", async () => {
    const user = await createUser();
    const token = await issueSessionToken(user._id);

    const registration = await registerPlayer(token).expect(201);
    expect(registration.body.game.registration.registered).toBe(true);
    expect(registration.body.game.eligibility.eligible).toBe(false);
    expect(registration.body.game.eligibility.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "profile", complete: false }),
        expect.objectContaining({ id: "avatar", complete: false }),
        expect.objectContaining({ id: "cover", complete: false }),
      ])
    );

    const start = await request(app)
      .post("/api/millionaire/start")
      .set("Authorization", `Bearer ${token}`)
      .send({})
      .expect(403);
    expect(start.body.code).toBe("profile_incomplete");
    expect(await MillionaireAttempt.countDocuments({})).toBe(0);
  });

  test("serves three protected stages and makes the one Ask AI suggestion incorrect", async () => {
    const user = await createUser({ completeProfile: true });
    const token = await issueSessionToken(user._id);
    await registerPlayer(token).expect(201);

    const started = await request(app)
      .post("/api/millionaire/start")
      .set("Authorization", `Bearer ${token}`)
      .send({})
      .expect(201);
    expect(started.body.attempt.status).toBe("in_progress");
    expect(started.body.attempt.currentQuestion).toMatchObject({
      number: 1,
      stage: 1,
      difficulty: "Foundation",
    });
    expect(started.body.attempt.currentQuestion).not.toHaveProperty("correctIndex");

    const question = getQuestionById(started.body.attempt.currentQuestion.id);
    const advice = await request(app)
      .post("/api/millionaire/ask-ai")
      .set("Authorization", `Bearer ${token}`)
      .send({ questionId: question.id })
      .expect(200);
    expect(advice.body.advice.suggestedIndex).not.toBe(question.correctIndex);
    expect(advice.body.game.attempt.lifelineUsed).toBe(true);

    const answer = await request(app)
      .post("/api/millionaire/answer")
      .set("Authorization", `Bearer ${token}`)
      .send({ questionId: question.id, selectedIndex: question.correctIndex })
      .expect(200);
    expect(answer.body.answerResult.correct).toBe(true);
    expect(answer.body.answerResult.prizeUnlocked).toBe(100);
    expect(answer.body.game.attempt.currentQuestion.number).toBe(2);

    const secondAdvice = await request(app)
      .post("/api/millionaire/ask-ai")
      .set("Authorization", `Bearer ${token}`)
      .send({ questionId: answer.body.game.attempt.currentQuestion.id })
      .expect(409);
    expect(secondAdvice.body.code).toBe("lifeline_used");
  });

  test("banks earned winnings after a wrong answer and enforces the six-month replay window", async () => {
    const user = await createUser({ completeProfile: true });
    const token = await issueSessionToken(user._id);
    await registerPlayer(token).expect(201);
    const started = await request(app)
      .post("/api/millionaire/start")
      .set("Authorization", `Bearer ${token}`)
      .send({})
      .expect(201);

    const firstQuestion = getQuestionById(started.body.attempt.currentQuestion.id);
    const firstAnswer = await request(app)
      .post("/api/millionaire/answer")
      .set("Authorization", `Bearer ${token}`)
      .send({
        questionId: firstQuestion.id,
        selectedIndex: firstQuestion.correctIndex,
      })
      .expect(200);
    const secondQuestion = getQuestionById(firstAnswer.body.game.attempt.currentQuestion.id);
    const wrongIndex = (secondQuestion.correctIndex + 1) % secondQuestion.options.length;
    const loss = await request(app)
      .post("/api/millionaire/answer")
      .set("Authorization", `Bearer ${token}`)
      .send({ questionId: secondQuestion.id, selectedIndex: wrongIndex })
      .expect(200);

    expect(loss.body.answerResult.correct).toBe(false);
    expect(loss.body.game.attempt).toMatchObject({
      status: "lost",
      finalPrize: 100,
      payoutStatus: "pending",
    });
    expect(loss.body.game.cooldown.active).toBe(true);

    const replay = await request(app)
      .post("/api/millionaire/start")
      .set("Authorization", `Bearer ${token}`)
      .send({})
      .expect(409);
    expect(replay.body.code).toBe("six_month_cooldown");
    expect(await MillionaireAttempt.countDocuments({ userId: user._id })).toBe(1);
  });

  test("gives administrators participant records and controlled prize payout updates", async () => {
    const player = await createUser({ completeProfile: true });
    const playerToken = await issueSessionToken(player._id);
    await registerPlayer(playerToken).expect(201);
    const participant = await MillionaireParticipant.findOne({ userId: player._id });
    const attempt = await MillionaireAttempt.create({
      participantId: participant._id,
      userId: player._id,
      status: "lost",
      questions: Array.from({ length: 15 }, (_, index) => {
        const stage = Math.floor(index / 5) + 1;
        const idsByStage = [
          "spark-math-percent-01",
          "climb-physics-acceleration-01",
          "summit-math-euler-01",
        ];
        return {
          questionId: idsByStage[stage - 1],
          stage,
          order: index + 1,
          presentedAt: new Date(),
          ...(index === 0
            ? { answeredAt: new Date(), selectedIndex: 2, correct: true }
            : {}),
        };
      }),
      currentQuestionIndex: 1,
      correctAnswers: 1,
      currentPrize: 100,
      finalPrize: 100,
      outcomeReason: "wrong_answer",
      payoutStatus: "pending",
      startedAt: new Date(),
      completedAt: new Date(),
      nextEligibleAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
    });
    participant.lastAttemptId = attempt._id;
    participant.playCount = 1;
    participant.nextEligibleAt = attempt.nextEligibleAt;
    await participant.save();

    const admin = await createUser({
      role: "admin",
      email: "millionaire-admin@example.com",
      username: "millionaireadmin",
    });
    const adminToken = await issueSessionToken(admin._id);
    const list = await request(app)
      .get("/api/admin/millionaire/participants")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(list.body.stats.registrations).toBe(1);
    expect(list.body.participants[0]).toMatchObject({
      user: { email: "millionaire@example.com" },
      latestAttempt: { finalPrize: 100, payoutStatus: "pending" },
    });

    const payout = await request(app)
      .patch(`/api/admin/millionaire/attempts/${attempt._id}/payout`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "paid",
        reference: "BANK-TRANSFER-001",
        note: "Verified by finance",
      })
      .expect(200);
    expect(payout.body.attempt).toMatchObject({
      payoutStatus: "paid",
      payoutReference: "BANK-TRANSFER-001",
      finalPrize: 100,
    });
  });
});
