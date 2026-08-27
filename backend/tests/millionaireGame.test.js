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
const {
  OPTIONS_PER_QUESTION,
  QUESTIONS,
  getQuestionById,
} = require("../data/millionaireQuestionBank");
const MillionaireAttempt = require("../models/MillionaireAttempt");
const MillionaireDailyPrizeSlot = require("../models/MillionaireDailyPrizeSlot");
const MillionaireParticipant = require("../models/MillionaireParticipant");
const User = require("../models/User");
const {
  answerMillionaireQuestion,
  getMillionaireStatus,
  startMillionaireAttempt,
} = require("../services/millionaireGameService");

let mongod;
const LIVE_NOW = new Date("2026-07-26T10:15:00.000Z");

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
  profilePhotos = false,
} = {}) =>
  User.create({
    name: "Millionaire Player",
    username,
    email,
    password: "Password123!",
    role,
    isVerified: true,
    emailVerified: true,
    ...(completeProfile || profilePhotos
      ? {
          ...(completeProfile
            ? {
                phone: "+2348012345678",
                country: "Nigeria",
                stateOfOrigin: "Kaduna",
                dob: new Date("1994-06-18"),
                gender: "female",
              }
            : {}),
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

  test("keeps every question to five distinct options with one valid correct answer", () => {
    expect(OPTIONS_PER_QUESTION).toBe(5);
    QUESTIONS.forEach((question) => {
      expect(question.options).toHaveLength(OPTIONS_PER_QUESTION);
      expect(new Set(question.options.map((option) => option.toLocaleLowerCase("en"))).size).toBe(
        OPTIONS_PER_QUESTION
      );
      expect(Number.isInteger(question.correctIndex)).toBe(true);
      expect(question.correctIndex).toBeGreaterThanOrEqual(0);
      expect(question.correctIndex).toBeLessThan(OPTIONS_PER_QUESTION);
      expect(question.options[question.correctIndex]).toEqual(expect.any(String));
    });
    expect(QUESTIONS.some((question) => question.correctIndex === 4)).toBe(true);
  });

  test("accepts basic account information but blocks play until both profile photos exist", async () => {
    const user = await createUser();
    const token = await issueSessionToken(user._id);

    const registration = await registerPlayer(token).expect(201);
    expect(registration.body.game.registration.registered).toBe(true);
    expect(registration.body.game.eligibility.eligible).toBe(false);
    expect(registration.body.game.eligibility.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "profile", complete: true }),
        expect.objectContaining({ id: "avatar", complete: false }),
        expect.objectContaining({ id: "cover", complete: false }),
      ])
    );

    await expect(
      startMillionaireAttempt(user._id, { now: LIVE_NOW, random: () => 0 })
    ).rejects.toMatchObject({ code: "profile_incomplete", status: 403 });
    expect(await MillionaireAttempt.countDocuments({})).toBe(0);
  });

  test("serves three protected stages and makes the one Ask AI suggestion incorrect", async () => {
    const testNow = new Date();
    const user = await createUser({ completeProfile: true });
    const token = await issueSessionToken(user._id);
    await registerPlayer(token).expect(201);

    const started = {
      body: await startMillionaireAttempt(user._id, {
        now: testNow,
        random: () => 0,
      }),
    };
    expect(started.body.attempt.status).toBe("in_progress");
    expect(started.body.attempt.currentQuestion).toMatchObject({
      number: 1,
      stage: 1,
      difficulty: "Challenging",
      timeLimitSeconds: 20,
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

    const answer = {
      body: await answerMillionaireQuestion({
        userId: user._id,
        questionId: question.id,
        selectedIndex: question.correctIndex,
        now: new Date(),
      }),
    };
    expect(answer.body.answerResult.correct).toBe(true);
    expect(answer.body.answerResult.prizeUnlocked).toBe(100);
    expect(answer.body.game.attempt.currentQuestion.number).toBe(2);
    expect(answer.body.game.attempt.currentQuestion.timeLimitSeconds).toBe(20);
    expect(answer.body.game.attempt.currentQuestion.secondsRemaining).toBe(20);

    const secondAdvice = await request(app)
      .post("/api/millionaire/ask-ai")
      .set("Authorization", `Bearer ${token}`)
      .send({ questionId: answer.body.game.attempt.currentQuestion.id })
      .expect(409);
    expect(secondAdvice.body.code).toBe("lifeline_used");
  });

  test("accepts the fifth answer button and rejects choices outside the five options", async () => {
    const user = await createUser({
      completeProfile: true,
      email: "five-options@example.com",
      username: "fiveoptions",
    });
    await registerPlayer(await issueSessionToken(user._id)).expect(201);
    const started = await startMillionaireAttempt(user._id, {
      now: LIVE_NOW,
      random: () => 0,
    });
    const question = getQuestionById(started.attempt.currentQuestion.id);

    await expect(
      answerMillionaireQuestion({
        userId: user._id,
        questionId: question.id,
        selectedIndex: 5,
        now: new Date(LIVE_NOW.getTime() + 1_000),
      })
    ).rejects.toMatchObject({ code: "invalid_answer", status: 400 });

    await expect(
      answerMillionaireQuestion({
        userId: user._id,
        questionId: question.id,
        selectedIndex: 4,
        now: new Date(LIVE_NOW.getTime() + 2_000),
      })
    ).resolves.toMatchObject({
      answerResult: { selectedIndex: 4 },
    });
  });

  test("reuses an existing account with basic information and both photos without asking for optional details", async () => {
    const user = await createUser({
      profilePhotos: true,
      email: "existing-profile@example.com",
      username: "existingprofile",
    });

    const token = await issueSessionToken(user._id);
    const registration = await registerPlayer(token).expect(201);

    expect(registration.body.game.eligibility).toMatchObject({
      profileDetailsComplete: true,
      profilePhotoComplete: true,
      coverPhotoComplete: true,
      eligible: true,
    });
    expect(
      registration.body.game.eligibility.requirements.find(
        (requirement) => requirement.id === "profile"
      )?.missingFields
    ).toEqual([]);

    await expect(
      startMillionaireAttempt(user._id, { now: LIVE_NOW, random: () => 0 })
    ).resolves.toMatchObject({ attempt: { status: "in_progress" } });
  });

  test("assigns only one random eligible account to the ₦1,000 daily tier and keeps others at ₦400", async () => {
    const first = await createUser({
      profilePhotos: true,
      email: "daily-one@example.com",
      username: "dailyone",
    });
    const second = await createUser({
      profilePhotos: true,
      email: "daily-two@example.com",
      username: "dailytwo",
    });
    await registerPlayer(await issueSessionToken(first._id)).expect(201);
    await registerPlayer(await issueSessionToken(second._id)).expect(201);

    const now = LIVE_NOW;
    const firstGame = await startMillionaireAttempt(first._id, { now, random: () => 0 });
    const secondGame = await startMillionaireAttempt(second._id, {
      now: new Date(now.getTime() + 1000),
      random: () => 0.75,
    });
    const tiers = [firstGame.attempt.prizeTier, secondGame.attempt.prizeTier].sort();

    expect(tiers).toEqual(["daily_premium", "standard"]);
    expect(firstGame.campaign.standardPrizeLadder.at(-1)).toBe(400);
    expect(firstGame.campaign.dailyPremiumPrizeLadder.at(-1)).toBe(1000);
    expect(await MillionaireDailyPrizeSlot.countDocuments({ dateKey: "2026-07-26" })).toBe(1);
  });

  test("gives the Stephen Daniel Kurah QA account unlimited payout-disabled access before launch", async () => {
    const qaUser = await createUser({
      email: "tmintldo4_life@yahoo.com",
      username: "pyrexx_singz",
    });
    await registerPlayer(await issueSessionToken(qaUser._id)).expect(201);
    const beforeLaunch = new Date("2026-07-26T08:00:00.000Z");

    const started = await startMillionaireAttempt(qaUser._id, {
      now: beforeLaunch,
      random: () => 0,
    });
    expect(started.access).toMatchObject({ qaMode: true, publicOpen: false });
    expect(started.attempt).toMatchObject({
      prizeTier: "qa",
      payoutEligible: false,
      qaMode: true,
    });
    const firstQuestion = getQuestionById(started.attempt.currentQuestion.id);
    const finished = await answerMillionaireQuestion({
      userId: qaUser._id,
      questionId: firstQuestion.id,
      selectedIndex: (firstQuestion.correctIndex + 1) % firstQuestion.options.length,
      now: new Date(beforeLaunch.getTime() + 1000),
    });
    expect(finished.game.attempt).toMatchObject({
      status: "lost",
      finalPrize: 0,
      payoutStatus: "not_applicable",
    });

    const replay = await startMillionaireAttempt(qaUser._id, {
      now: new Date(beforeLaunch.getTime() + 2000),
      random: () => 0.5,
    });
    expect(replay.attempt.status).toBe("in_progress");
    expect(await MillionaireAttempt.countDocuments({ userId: qaUser._id })).toBe(2);
  });

  test("blocks admin accounts from registration and game participation", async () => {
    const admin = await createUser({
      role: "admin",
      email: "excluded-admin@example.com",
      username: "excludedadmin",
    });
    const adminToken = await issueSessionToken(admin._id);
    const status = await getMillionaireStatus(admin._id);
    expect(status.access.adminExcluded).toBe(true);
    expect(status.canStart).toBe(false);

    const registration = await registerPlayer(adminToken).expect(403);
    expect(registration.body.code).toBe("admin_excluded");
  });

  test("keeps ordinary eligible accounts closed until the 10:00 AM WAT launch", async () => {
    const user = await createUser({
      profilePhotos: true,
      email: "waiting-player@example.com",
      username: "waitingplayer",
    });
    await registerPlayer(await issueSessionToken(user._id)).expect(201);

    await expect(
      startMillionaireAttempt(user._id, {
        now: new Date("2026-07-26T08:59:59.000Z"),
        random: () => 0,
      })
    ).rejects.toMatchObject({ code: "game_not_open", status: 403 });
  });

  test("banks earned winnings after a wrong answer and enforces the six-month replay window", async () => {
    const testNow = new Date();
    const user = await createUser({ completeProfile: true });
    const token = await issueSessionToken(user._id);
    await registerPlayer(token).expect(201);
    const started = {
      body: await startMillionaireAttempt(user._id, {
        now: testNow,
        random: () => 0,
      }),
    };

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

    await expect(
      startMillionaireAttempt(user._id, {
        now: new Date(),
        random: () => 0,
      })
    ).rejects.toMatchObject({ code: "six_month_cooldown", status: 409 });
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
