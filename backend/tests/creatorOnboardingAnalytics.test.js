const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-onboarding-analytics-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "onboarding_analytics_test_secret_123456789012";

const app = require("../app");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const DailyAnalytics = require("../models/DailyAnalytics");
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
    {
      id: userId.toString(),
      tv: 0,
      sid: sessionId,
    },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );
};

const createUser = () =>
  User.create({
    name: "Creator Metrics",
    username: "creator_metrics",
    email: "creator-metrics@test.com",
    password: "Password123!",
    isVerified: true,
    emailVerified: true,
  });

const creatorRegistrationPayload = {
  fullName: "Creator Metrics",
  displayName: "Creator Metrics Studio",
  phoneNumber: "08000000000",
  accountNumber: "1234567890",
  country: "Nigeria",
  countryOfResidence: "Nigeria",
  creatorTypes: ["music"],
  acceptedTerms: true,
  acceptedCopyrightDeclaration: true,
  socialHandles: {},
  musicProfile: {},
  booksProfile: {},
  podcastsProfile: {},
};

describe("creator onboarding analytics", () => {
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
      if (mongod) {
        await mongod.stop();
      }
    }
  });

  test("creator registration records newly completed onboarding steps", async () => {
    const user = await createUser();
    const token = await issueSessionToken(user._id);

    await request(app)
      .post("/api/creator/register")
      .set("Authorization", `Bearer ${token}`)
      .send(creatorRegistrationPayload)
      .expect(201);

    const events = await AnalyticsEvent.find({
      type: "creator_onboarding_step_completed",
      userId: user._id,
    })
      .sort({ contentType: 1 })
      .lean();

    expect(events).toHaveLength(4);
    expect(events.map((event) => event.contentType)).toEqual([
      "account_created",
      "creator_lane_selected",
      "payment_readiness_started",
      "profile_ready",
    ]);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorRole: "artist",
          targetType: "creator_profile",
          metadata: expect.objectContaining({
            source: "creator_registration",
            totalSteps: 4,
            progressPercent: 100,
          }),
        }),
      ])
    );

    const daily = await DailyAnalytics.findOne().lean();
    expect(daily.creatorOnboardingStepCompletions).toBe(4);

    await request(app)
      .post("/api/creator/register")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...creatorRegistrationPayload,
        displayName: "Creator Metrics Studio Updated",
      })
      .expect(201);

    await expect(
      AnalyticsEvent.countDocuments({ type: "creator_onboarding_step_completed" })
    ).resolves.toBe(4);
  });
});
