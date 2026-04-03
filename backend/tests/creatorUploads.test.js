const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");
const { v2: cloudinary } = require("cloudinary");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret_1234567890123456789012";

const app = require("../app");
const Book = require("../models/Book");
const CreatorProfile = require("../models/CreatorProfile");
const Track = require("../models/Track");
const User = require("../models/User");
const Video = require("../models/Video");

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
      .field("previewStartSec", "75")
      .field("price", "0")
      .field("publishedStatus", "draft")
      .attach("audio", Buffer.from("music-audio"), {
        filename: "aurora.mp3",
        contentType: "audio/mpeg",
      })
      .attach("preview", Buffer.from("music-preview"), {
        filename: "aurora-preview.mp3",
        contentType: "audio/mpeg",
      })
      .attach("cover", Buffer.from("music-cover"), {
        filename: "aurora-cover.webp",
        contentType: "image/webp",
      })
      .expect(201);

    expect(response.body.title).toBe("Aurora");
    expect(response.body.artistName).toBe("Creator Example");
    expect(response.body.releaseType).toBe("single");
    expect(response.body.previewStartSec).toBe(75);
    expect(response.body.previewLimitSec).toBe(30);
    expect(response.body.audioUrl).toContain(
      "https://res.cloudinary.com/test-cloud/video/upload/"
    );
    expect(response.body.previewUrl).toContain(
      "https://res.cloudinary.com/test-cloud/video/upload/"
    );
    expect(response.body.coverImageUrl).toContain(
      "https://res.cloudinary.com/test-cloud/image/upload/"
    );

    const savedTrack = await Track.findOne({ title: "Aurora" }).lean();
    expect(savedTrack).toBeTruthy();
    expect(savedTrack.kind).toBe("music");
    expect(savedTrack.contentType).toBe("track");
    expect(savedTrack.previewStartSec).toBe(75);
    expect(savedTrack.previewLimitSec).toBe(30);
    expect(savedTrack.audioMedia).toMatchObject({
      publicId: "tengacion/creators/audio/mock-1",
      secureUrl: expect.stringContaining(
        "https://res.cloudinary.com/test-cloud/video/upload/"
      ),
      resourceType: "video",
      folder: "tengacion/creators/audio",
      originalFilename: "aurora.mp3",
    });
    expect(savedTrack.previewMedia).toMatchObject({
      publicId: "tengacion/creators/audio/mock-2",
      resourceType: "video",
      folder: "tengacion/creators/audio",
      originalFilename: "aurora-preview.mp3",
    });
    expect(savedTrack.coverMedia).toMatchObject({
      publicId: "tengacion/creators/music-covers/mock-3",
      secureUrl: expect.stringContaining(
        "https://res.cloudinary.com/test-cloud/image/upload/"
      ),
      resourceType: "image",
      folder: "tengacion/creators/music-covers",
      originalFilename: "aurora-cover.webp",
    });

    expect(cloudinary.uploader.upload_stream).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        folder: "tengacion/creators/audio",
        resource_type: "video",
      }),
      expect.any(Function)
    );
    expect(cloudinary.uploader.upload_stream).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        folder: "tengacion/creators/music-covers",
        resource_type: "image",
      }),
      expect.any(Function)
    );
  });

  test("POST /api/creator/music/videos creates a music video upload with supported formats", async () => {
    const { token } = await createUserAndProfile();

    const response = await request(app)
      .post("/api/creator/music/videos")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "Visual Anthem")
      .field("description", "High-energy performance video")
      .field("price", "0")
      .field("durationSec", "215")
      .field("publishedStatus", "draft")
      .attach("video", Buffer.from("music-video"), {
        filename: "visual-anthem.m4v",
        contentType: "video/x-m4v",
      })
      .attach("previewClip", Buffer.from("music-video-preview"), {
        filename: "visual-anthem-preview.webm",
        contentType: "video/webm",
      })
      .attach("thumbnail", Buffer.from("music-video-thumbnail"), {
        filename: "visual-anthem.webp",
        contentType: "image/webp",
      })
      .expect(201);

    expect(response.body.title).toBe("Visual Anthem");
    expect(response.body.description).toBe("High-energy performance video");
    expect(response.body.durationSec).toBe(215);
    expect(response.body.videoFormat).toBe("m4v");

    const savedVideo = await Video.findOne({ caption: "Visual Anthem" }).lean();
    expect(savedVideo).toBeTruthy();
    expect(savedVideo.contentType).toBe("music_video");
    expect(savedVideo.previewClipUrl).toBeTruthy();
    expect(savedVideo.coverImageUrl).toBeTruthy();
    expect(savedVideo.durationSec).toBe(215);
    expect(savedVideo.videoFormat).toBe("m4v");
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

  test("POST /api/creator/podcasts creates a video podcast episode with supported formats", async () => {
    const { token } = await createUserAndProfile();

    const response = await request(app)
      .post("/api/creator/podcasts")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "Video Episode One")
      .field("podcastSeries", "Studio Stories")
      .field("mediaType", "video")
      .field("category", "Culture")
      .field("price", "0")
      .field("publishedStatus", "draft")
      .attach("media", Buffer.from("podcast-video"), {
        filename: "video-episode.mp4",
        contentType: "video/mp4",
      })
      .attach("cover", Buffer.from("podcast-cover"), {
        filename: "video-episode-cover.png",
        contentType: "image/png",
      })
      .expect(201);

    expect(response.body.title).toBe("Video Episode One");
    expect(response.body.mediaType).toBe("video");
    expect(response.body.videoUrl).toContain(
      "https://res.cloudinary.com/test-cloud/video/upload/"
    );
    expect(response.body.coverImageUrl).toContain(
      "https://res.cloudinary.com/test-cloud/image/upload/"
    );

    const savedTrack = await Track.findOne({ title: "Video Episode One" }).lean();
    expect(savedTrack).toBeTruthy();
    expect(savedTrack.kind).toBe("podcast");
    expect(savedTrack.mediaType).toBe("video");
    expect(savedTrack.videoUrl).toBeTruthy();
    expect(savedTrack.audioUrl).toBe(savedTrack.videoUrl);
    expect(savedTrack.videoMedia).toMatchObject({
      publicId: "tengacion/podcasts/videos/mock-1",
      resourceType: "video",
      folder: "tengacion/podcasts/videos",
      originalFilename: "video-episode.mp4",
    });
    expect(savedTrack.coverMedia).toMatchObject({
      publicId: "tengacion/podcasts/covers/mock-2",
      resourceType: "image",
      folder: "tengacion/podcasts/covers",
      originalFilename: "video-episode-cover.png",
    });
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
