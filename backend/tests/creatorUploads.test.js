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
const Track = require("../models/Track");
const User = require("../models/User");

let mongod;
let sequence = 0;

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

const createUserAndProfile = async ({ creatorTypes = ["music", "bookPublishing", "podcast"] } = {}) => {
  sequence += 1;
  const slug = `creator_upload_${sequence}`;
  const user = await User.create({
    name: "Creator Example",
    username: slug,
    email: `${slug}@example.com`,
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

describe("creator upload routes", () => {
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

  test("POST /api/creator/music creates a music upload with strict music metadata", async () => {
    const { token } = await createUserAndProfile();

    const response = await request(app)
      .post("/api/creator/music")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "Aurora")
      .field("artistName", "Creator Example")
      .field("genre", "Afrobeats")
      .field("description", "A polished single")
      .field("releaseType", "single")
      .field("price", "0")
      .field("publishedStatus", "draft")
      .attach("audio", Buffer.from("music-audio"), {
        filename: "aurora.mp3",
        contentType: "audio/mpeg",
      })
      .expect(201);

    expect(response.body.title).toBe("Aurora");
    expect(response.body.artistName).toBe("Creator Example");
    expect(response.body.releaseType).toBe("single");

    const savedTrack = await Track.findOne({ title: "Aurora" }).lean();
    expect(savedTrack).toBeTruthy();
    expect(savedTrack.kind).toBe("music");
    expect(savedTrack.contentType).toBe("track");
  });

  test("POST /api/creator/music rejects podcast-only metadata fields", async () => {
    const { token } = await createUserAndProfile();

    await request(app)
      .post("/api/creator/music")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "Bad Mixed Upload")
      .field("artistName", "Creator Example")
      .field("genre", "Alternative")
      .field("seasonNumber", "2")
      .field("price", "0")
      .field("publishedStatus", "draft")
      .attach("audio", Buffer.from("music-audio"), {
        filename: "bad-mix.mp3",
        contentType: "audio/mpeg",
      })
      .expect(400);

    expect(await Track.countDocuments()).toBe(0);
  });

  test("POST /api/creator/podcasts rejects book-only metadata fields", async () => {
    const { token } = await createUserAndProfile();

    await request(app)
      .post("/api/creator/podcasts")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "Episode One")
      .field("podcastSeries", "Studio Stories")
      .field("category", "Culture")
      .field("fileFormat", "pdf")
      .field("price", "0")
      .field("publishedStatus", "draft")
      .attach("audio", Buffer.from("podcast-audio"), {
        filename: "episode-one.mp3",
        contentType: "audio/mpeg",
      })
      .expect(400);

    expect(await Track.countDocuments()).toBe(0);
  });

  test("POST /api/creator/books rejects unsupported manuscript file types", async () => {
    const { token } = await createUserAndProfile();

    await request(app)
      .post("/api/creator/books")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "Broken Manuscript")
      .field("authorName", "Creator Example")
      .field("genre", "Memoir")
      .field("language", "English")
      .field("price", "0")
      .field("publishedStatus", "draft")
      .attach("content", Buffer.from("not-a-book"), {
        filename: "broken.mp3",
        contentType: "audio/mpeg",
      })
      .expect(400);

    expect(await Book.countDocuments()).toBe(0);
  });
});
