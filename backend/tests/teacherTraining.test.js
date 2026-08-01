const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-teacher-training-test";

const {
  MIN_MODULE_CONTENT_WORDS,
  MODULES,
  QUESTIONS_PER_MODULE,
  QUESTION_TIME_LIMIT_SECONDS,
  countModuleContentWords,
  getQuestionById,
} = require("../data/teacherTrainingCatalog");
const TeacherTrainingAttempt = require("../models/TeacherTrainingAttempt");
const User = require("../models/User");
const {
  TeacherTrainingError,
  answerTeacherTrainingQuestion,
  getTeacherTrainingStatus,
  startTeacherTrainingAssessment,
} = require("../services/teacherTrainingService");

let mongod;

const createTeacher = () =>
  User.create({
    name: "Kurah Academy Teacher",
    username: "kurah_teacher",
    email: "teacher@kurahacademy.test",
    password: "Password123!",
    role: "user",
    isVerified: true,
    emailVerified: true,
  });

describe("Kurah academy teacher training", () => {
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

  test("contains 22 substantial PDE modules with revised protected questions", () => {
    expect(MODULES).toHaveLength(22);
    expect(MODULES.map((module) => module.code)).toEqual([
      "PDE 701",
      "PDE 702",
      "PDE 703",
      "PDE 704",
      "PDE 705",
      "PDE 706",
      "PDE 707",
      "PDE 708",
      "PDE 709",
      "PDE 710",
      "PDE 711",
      "PDE 712",
      "PDE 713",
      "PDE 714",
      "PDE 715",
      "PDE 716",
      "PDE 717",
      "PDE 718",
      "PDE 719",
      "PDE 720",
      "PDE 721",
      "PDE 722",
    ]);

    MODULES.forEach((module) => {
      expect(countModuleContentWords(module)).toBeGreaterThanOrEqual(
        MIN_MODULE_CONTENT_WORDS
      );
      expect(module.readingSections).toHaveLength(3);
      module.readingSections.forEach((readingSection) => {
        expect(readingSection.title).toEqual(expect.any(String));
        expect(readingSection.paragraphs).toHaveLength(2);
      });
      expect(module.assessment).toHaveLength(QUESTIONS_PER_MODULE);
      expect(
        module.assessment.filter((entry) => entry.revisedForExpandedReading)
      ).toHaveLength(2);
      module.assessment.forEach((question) => {
        expect(module.readingSections.map((entry) => entry.title)).toContain(
          question.readingFocus
        );
        expect(question.options).toHaveLength(4);
        expect(new Set(question.options).size).toBe(4);
        expect(question.correctIndex).toBeGreaterThanOrEqual(0);
        expect(question.correctIndex).toBeLessThan(4);
      });
    });
  });

  test("shows preview content before 1 August but blocks assessment starts", async () => {
    const teacher = await createTeacher();
    const now = new Date("2026-07-30T10:00:00.000Z");
    const training = await getTeacherTrainingStatus(teacher._id, { now });

    expect(training.campaign.access.isPreview).toBe(true);
    expect(training.campaign.questionTimeLimitSeconds).toBe(45);
    expect(training.modules).toHaveLength(22);
    expect(training.modules[0]).not.toHaveProperty("assessment");
    expect(training.finalResult).toBeNull();

    await expect(
      startTeacherTrainingAssessment(
        { userId: teacher._id, moduleCode: "PDE 701" },
        { now }
      )
    ).rejects.toMatchObject({
      code: "training_not_open",
      status: 403,
    });
  });

  test("serves one randomised question at a time without exposing its answer key", async () => {
    const teacher = await createTeacher();
    let now = new Date("2026-08-01T08:00:00.000Z");
    let training = await startTeacherTrainingAssessment(
      { userId: teacher._id, moduleCode: "PDE 701" },
      { now, random: () => 0.37 }
    );

    for (let index = 0; index < QUESTIONS_PER_MODULE; index += 1) {
      const activeModule = training.modules.find((module) => module.code === "PDE 701");
      const current = activeModule.attempt.currentQuestion;
      expect(current).not.toHaveProperty("correctIndex");
      expect(current).not.toHaveProperty("explanation");
      expect(current.options).toHaveLength(4);
      expect(current.timeLimitSeconds).toBe(QUESTION_TIME_LIMIT_SECONDS);
      expect(activeModule.attempt.scorePercent).toBeNull();

      const source = getQuestionById(current.id);
      const displayedCorrectIndex = current.options.indexOf(
        source.options[source.correctIndex]
      );
      now = new Date(now.getTime() + 3_000);
      const payload = await answerTeacherTrainingQuestion(
        {
          userId: teacher._id,
          moduleCode: "PDE 701",
          questionId: current.id,
          selectedIndex: displayedCorrectIndex,
        },
        { now }
      );
      training = payload.training;
    }

    const completed = training.modules.find((module) => module.code === "PDE 701");
    expect(completed.attempt).toMatchObject({
      status: "completed",
      scorePercent: 100,
      correctAnswers: 5,
      timedOutAnswers: 0,
      passed: true,
    });
    expect(await TeacherTrainingAttempt.countDocuments({ userId: teacher._id })).toBe(1);
  });

  test("records every unanswered question as zero when a teacher leaves the assessment", async () => {
    const teacher = await createTeacher();
    const startedAt = new Date("2026-08-02T09:00:00.000Z");
    await startTeacherTrainingAssessment(
      { userId: teacher._id, moduleCode: "PDE 702" },
      { now: startedAt, random: () => 0.5 }
    );

    const training = await getTeacherTrainingStatus(teacher._id, {
      now: new Date(
        startedAt.getTime() +
          QUESTIONS_PER_MODULE * QUESTION_TIME_LIMIT_SECONDS * 1000 +
          1_000
      ),
    });
    const completed = training.modules.find((module) => module.code === "PDE 702");

    expect(completed.attempt).toMatchObject({
      status: "completed",
      scorePercent: 0,
      correctAnswers: 0,
      timedOutAnswers: 5,
      passed: false,
    });
  });

  test("keeps cumulative performance locked until the stated release time", async () => {
    const teacher = await createTeacher();
    const before = await getTeacherTrainingStatus(teacher._id, {
      now: new Date("2026-08-31T22:58:59.000Z"),
    });
    expect(before.finalResult).toBeNull();
    expect(before.finalResultLock.releaseAt).toEqual(
      new Date("2026-08-31T22:59:00.000Z")
    );

    const after = await getTeacherTrainingStatus(teacher._id, {
      now: new Date("2026-08-31T22:59:00.000Z"),
    });
    expect(after.finalResult).toMatchObject({
      scorePercent: 0,
      completedModules: 0,
      totalModules: 22,
      completedAllModules: false,
      passed: false,
      salaryIncrementEligible: false,
      nextTermEligible: false,
    });
  });

  test("uses typed training errors for invalid modules", async () => {
    const teacher = await createTeacher();
    await expect(
      startTeacherTrainingAssessment(
        { userId: teacher._id, moduleCode: "PDE 999" },
        { now: new Date("2026-08-01T08:00:00.000Z") }
      )
    ).rejects.toBeInstanceOf(TeacherTrainingError);
  });
});
