const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-story-music-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret_1234567890123456789012";
process.env.MODERATION_ENABLED = "false";

const app = require("../app");
const CreatorProfile = require("../models/CreatorProfile");
const Story = require("../models/Story");
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

const createCreator = async () => {
  const user = await User.create({
    name: "Sound Creator",
    username: "sound_creator",
    email: "soundcreator@example.com",
    password: "Password123!",
    role: "artist",
    isArtist: true,
    isVerified: true,
  });

  const profile = await CreatorProfile.create({
    userId: user._id,
    displayName: "Sound Creator",
    fullName: "Sound Creator",
    phoneNumber: "08000000000",
    accountNumber: "1234567890",
    country: "Nigeria",
    countryOfResidence: "Nigeria",
    creatorTypes: ["music"],
    acceptedTerms: true,
    acceptedCopyrightDeclaration: true,
    onboardingCompleted: true,
    onboardingComplete: true,
    status: "active",
  });

  const token = await issueSessionToken(user._id);
  return { user, profile, token };
};

const createViewer = async () => {
  const user = await User.create({
    name: "Story Viewer",
    username: "story_viewer",
    email: "storyviewer@example.com",
    password: "Password123!",
    role: "user",
    isVerified: true,
    friends: [],
  });

  const token = await issueSessionToken(user._id);
  return { user, token };
};

describe("story music attachment", () => {
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

  test("creates a story with a creator soundtrack and hydrates it in the feed", async () => {
    const creator = await createCreator();
    const viewer = await createViewer();

    await User.updateOne(
      { _id: viewer.user._id },
      { $set: { friends: [creator.user._id.toString()] } }
    );

    const track = await Track.create({
      creatorId: creator.profile._id,
      title: "After Sunset",
      description: "A story-ready preview clip",
      price: 2500,
      currency: "NGN",
      audioUrl: "https://cdn.tengacion.test/tracks/after-sunset-full.mp3",
      previewUrl: "https://cdn.tengacion.test/tracks/after-sunset-preview.mp3",
      coverImageUrl: "https://cdn.tengacion.test/tracks/after-sunset-cover.jpg",
      artistName: "Sound Creator",
      releaseType: "single",
      previewStartSec: 0,
      previewLimitSec: 30,
      durationSec: 180,
      isPublished: true,
      archivedAt: null,
    });

    const soundtrack = {
      itemType: "track",
      itemId: track._id.toString(),
      creatorId: creator.profile._id.toString(),
      creatorUserId: creator.user._id.toString(),
      creatorName: "Sound Creator",
      creatorUsername: creator.user.username,
      creatorAvatar: "",
      title: track.title,
      coverImage: track.coverImageUrl,
      previewStartSec: 0,
      previewLimitSec: 30,
      durationSec: 180,
      summaryLabel: "Music",
    };

    const createResponse = await request(app)
      .post("/api/stories")
      .set("Authorization", `Bearer ${creator.token}`)
      .field("caption", "Story with soundtrack")
      .field("visibility", "friends")
      .field("musicAttachment", JSON.stringify(soundtrack))
      .attach("media", Buffer.from("story-image-binary"), {
        filename: "story.jpg",
        contentType: "image/jpeg",
      })
      .expect(200);

    expect(createResponse.body.musicAttachment).toBeTruthy();
    expect(createResponse.body.musicAttachment.title).toBe("After Sunset");
    expect(createResponse.body.musicAttachment.previewUrl).toContain("/api/media/delivery/");

    const feedResponse = await request(app)
      .get("/api/stories")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);

    const feedStory = feedResponse.body.find((entry) => entry.username === creator.user.username);
    expect(feedStory).toBeTruthy();
    expect(feedStory.musicAttachment).toBeTruthy();
    expect(feedStory.musicAttachment.title).toBe("After Sunset");
    expect(feedStory.musicAttachment.previewUrl).toContain("/api/media/delivery/");
  });

  test("rejects a soundtrack selection that no longer resolves", async () => {
    const creator = await createCreator();

    const response = await request(app)
      .post("/api/stories")
      .set("Authorization", `Bearer ${creator.token}`)
      .field("caption", "Broken soundtrack")
      .field(
        "musicAttachment",
        JSON.stringify({
          itemType: "track",
          itemId: new mongoose.Types.ObjectId().toString(),
        })
      )
      .attach("media", Buffer.from("story-image-binary"), {
        filename: "story.jpg",
        contentType: "image/jpeg",
      })
      .expect(400);

    expect(response.body.error).toBe("Selected soundtrack is unavailable");
    expect(await Story.countDocuments()).toBe(0);
  });
});
