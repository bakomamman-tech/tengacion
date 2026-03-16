const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret_1234567890123456789012";

const app = require("../app");
const Book = require("../models/Book");
const CreatorProfile = require("../models/CreatorProfile");
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

const createUserAndProfile = async ({ creatorTypes = ["music", "books", "podcasts"] } = {}) => {
  const user = await User.create({
    name: "Creator Example",
    username: "creator_example",
    email: "creator@example.com",
    password: "Password123!",
    role: "artist",
    isArtist: true,
    isVerified: true,
  });

  const profile = await CreatorProfile.create({
    userId: user._id,
    displayName: "Creator Example",
    fullName: "Creator Example",
    phoneNumber: "08000000000",
    accountNumber: "1234567890",
    country: "Nigeria",
    countryOfResidence: "Nigeria",
    creatorTypes,
    acceptedTerms: true,
    acceptedCopyrightDeclaration: true,
    onboardingCompleted: true,
    onboardingComplete: true,
    status: "active",
  });

  const token = await issueSessionToken(user._id);
  return { user, profile, token };
};

describe("creator profile routes", () => {
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
    } catch {
      // ignore cleanup errors
    } finally {
      await mongoose.disconnect().catch(() => null);
      if (mongod) {
        await mongod.stop();
      }
    }
  });

  test("GET /api/creator/profile returns the saved creator types even when content exists in another lane", async () => {
    const { profile, token } = await createUserAndProfile();

    await Book.create({
      creatorId: profile._id,
      title: "Existing Book",
      description: "Already published content",
      price: 0,
      contentUrl: "https://example.com/book.pdf",
      fileFormat: "pdf",
      publishedStatus: "published",
      isPublished: true,
    });

    await request(app)
      .put("/api/creator/profile")
      .set("Authorization", `Bearer ${token}`)
      .send({
        fullName: "Creator Example",
        displayName: "Creator Example",
        phoneNumber: "08000000000",
        accountNumber: "1234567890",
        country: "Nigeria",
        countryOfResidence: "Nigeria",
        socialHandles: {},
        musicProfile: {},
        booksProfile: {},
        podcastsProfile: {},
        creatorTypes: ["music", "podcasts"],
        acceptedTerms: true,
        acceptedCopyrightDeclaration: true,
      })
      .expect(200);

    const response = await request(app)
      .get("/api/creator/profile")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.creatorTypes).toEqual(["music", "podcasts"]);
  });

  test("GET /api/creator/profile sends no-store headers", async () => {
    const { token } = await createUserAndProfile({ creatorTypes: ["music"] });

    const response = await request(app)
      .get("/api/creator/profile")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.headers["cache-control"]).toContain("no-store");
    expect(response.headers.pragma).toBe("no-cache");
  });
});
