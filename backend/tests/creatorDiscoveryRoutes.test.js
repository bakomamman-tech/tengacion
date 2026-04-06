const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");
const jwt = require("jsonwebtoken");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret_1234567890123456789012";

const app = require("../app");
const Book = require("../models/Book");
const CreatorProfile = require("../models/CreatorProfile");
const Track = require("../models/Track");
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

const seedCreator = async ({
  name,
  username,
  displayName,
  creatorTypes,
  subscriptionPrice = 2500,
  coverImageUrl = "",
  userAvatar = "",
}) => {
  const user = await User.create({
    name,
    username,
    email: `${username}@test.com`,
    password: "Password123!",
    role: "artist",
    isArtist: true,
    isVerified: true,
    avatar: userAvatar || undefined,
  });

  const profile = await CreatorProfile.create({
    userId: user._id,
    displayName,
    fullName: displayName,
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
    tagline: `${displayName} tagline`,
    subscriptionPrice,
    coverImageUrl,
  });

  return { user, profile };
};

describe("creator discovery routes", () => {
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

  it("returns a mixed creator summary feed with preview and creator route metadata", async () => {
    const viewer = await User.create({
      name: "Viewer User",
      username: "viewer_user",
      email: "viewer@test.com",
      password: "Password123!",
      isVerified: true,
    });
    const token = await issueSessionToken(viewer._id);
    const { profile: musicCreator } = await seedCreator({
      name: "Music Creator",
      username: "music_creator",
      displayName: "Music Creator",
      creatorTypes: ["music"],
      coverImageUrl: "https://cdn.test/music-creator-profile.jpg",
      userAvatar: {
        url: "https://cdn.test/user-avatar-should-not-win.jpg",
      },
    });
    const { profile: bookCreator } = await seedCreator({
      name: "Book Creator",
      username: "book_creator",
      displayName: "Book Creator",
      creatorTypes: ["bookPublishing"],
    });

    await Track.create({
      creatorId: musicCreator._id,
      title: "Midnight Echoes",
      description: "A premium release for the summary feed",
      price: 1500,
      audioUrl: "https://cdn.test/midnight-echoes.mp3",
      previewUrl: "https://cdn.test/midnight-echoes-preview.mp3",
      coverImageUrl: "https://cdn.test/midnight-echoes.jpg",
      creatorCategory: "music",
      kind: "music",
      contentType: "track",
      playsCount: 82,
      purchaseCount: 7,
      isPublished: true,
    });

    await Book.create({
      creatorId: bookCreator._id,
      title: "The Future of Tech",
      description: "A creator book release",
      price: 0,
      contentUrl: "https://cdn.test/future-tech.pdf",
      previewUrl: "https://cdn.test/future-tech-preview.pdf",
      coverImageUrl: "https://cdn.test/future-tech.jpg",
      creatorCategory: "books",
      contentType: "ebook",
      isPublished: true,
    });

    const response = await request(app)
      .get("/api/creators/feed?limit=8&mode=mixed")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(response.body.items)).toBe(true);
    expect(response.body.items.length).toBeGreaterThan(0);
    expect(response.body.items[0]).toMatchObject({
      creatorId: expect.any(String),
      creatorName: expect.any(String),
      creatorRoute: expect.stringContaining("/creator/"),
    });
    expect(response.body.items.some((item) => item.creatorAvatar === "https://cdn.test/music-creator-profile.jpg")).toBe(true);
    expect(response.body.items.some((item) => item.previewUrl)).toBe(true);
  });

  it("finds creators by @handle and display name", async () => {
    const viewer = await User.create({
      name: "Viewer User",
      username: "viewer_user",
      email: "viewer2@test.com",
      password: "Password123!",
      isVerified: true,
    });
    const token = await issueSessionToken(viewer._id);
    const { profile: creator } = await seedCreator({
      name: "Jordan Bangoji",
      username: "jordan.bangoji",
      displayName: "Jordan Bangoji",
      creatorTypes: ["podcast"],
    });

    const response = await request(app)
      .get("/api/creators/discover?search=@jordan.bangoji&sort=alphabetical")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      creatorId: creator._id.toString(),
      username: "jordan.bangoji",
      route: `/creator/${creator._id.toString()}`,
      subscribeRoute: `/creators/${creator._id.toString()}/subscribe`,
    });
  });
});
