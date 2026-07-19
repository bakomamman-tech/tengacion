const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");
const { v2: cloudinary } = require("cloudinary");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret_1234567890123456789012";

const app = require("../app");
const Album = require("../models/Album");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const Book = require("../models/Book");
const CreatorProfile = require("../models/CreatorProfile");
const Track = require("../models/Track");
const User = require("../models/User");
const Video = require("../models/Video");
const {
  classifyRecordMedia,
  LEGACY_MEDIA_SOURCES,
} = require("../services/mediaAuditService");

let mongod;
let sequence = 0;
const trackSource = LEGACY_MEDIA_SOURCES.find((entry) => entry.key === "Track");

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
    expect(response.body).toMatchObject({
      publishedStatus: "draft",
      reviewRequired: false,
      approvalRequired: false,
      message: "Draft saved.",
    });
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
    expect(savedTrack.publishedStatus).toBe("draft");
    expect(savedTrack.isPublished).toBe(false);
    expect(savedTrack.audioMedia).toMatchObject({
      assetId: "asset-1",
      publicId: "tengacion/creators/audio/mock-1",
      secureUrl: expect.stringContaining(
        "https://res.cloudinary.com/test-cloud/video/upload/"
      ),
      resourceType: "video",
      folder: "tengacion/creators/audio",
      originalFilename: "aurora.mp3",
      legacyPath: "",
    });
    expect(savedTrack.previewMedia).toMatchObject({
      assetId: "asset-2",
      publicId: "tengacion/creators/audio/mock-2",
      resourceType: "video",
      folder: "tengacion/creators/audio",
      originalFilename: "aurora-preview.mp3",
      legacyPath: "",
    });
    expect(savedTrack.coverMedia).toMatchObject({
      assetId: "asset-3",
      publicId: "tengacion/creators/music-covers/mock-3",
      secureUrl: expect.stringContaining(
        "https://res.cloudinary.com/test-cloud/image/upload/"
      ),
      resourceType: "image",
      folder: "tengacion/creators/music-covers",
      originalFilename: "aurora-cover.webp",
      legacyPath: "",
    });
    expect(savedTrack.fullAudioUrl).toBe(savedTrack.audioUrl);
    expect(savedTrack.previewSampleUrl).toBe(savedTrack.previewUrl);
    expect(savedTrack.coverUrl).toBe(savedTrack.coverImageUrl);
    expect(classifyRecordMedia(savedTrack, trackSource).status).toBe("cloudinary");

    const savedDraftResponse = await request(app)
      .put(`/api/tracks/${savedTrack._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ description: "A polished single with updated notes" })
      .expect(200);

    expect(savedDraftResponse.body).toMatchObject({
      publishedStatus: "draft",
      reviewRequired: false,
      approvalRequired: false,
      message: "Draft saved.",
      copyrightScanStatus: "passed",
    });

    const publishResponse = await request(app)
      .put(`/api/tracks/${savedTrack._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ publishedStatus: "published" })
      .expect(200);

    expect(publishResponse.body).toMatchObject({
      publishedStatus: "published",
      reviewRequired: false,
      approvalRequired: false,
      message: "",
      copyrightScanStatus: "passed",
    });

    const submittedDraft = await Track.findById(savedTrack._id).lean();
    expect(submittedDraft).toMatchObject({
      publishedStatus: "published",
      reviewRequired: false,
      isPublished: true,
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

  test("creator albums stay private until submitted and then publish immediately", async () => {
    const { token } = await createUserAndProfile();

    const draftResponse = await request(app)
      .post("/api/creator/music/albums")
      .set("Authorization", `Bearer ${token}`)
      .field("albumTitle", "Northern Lights")
      .field("description", "An album draft in progress")
      .field("releaseType", "album")
      .field("price", "0")
      .field("publishedStatus", "draft")
      .attach("coverImage", Buffer.from("northern-lights-cover"), {
        filename: "northern-lights.webp",
        contentType: "image/webp",
      })
      .attach("tracks", Buffer.from("northern-lights-track"), {
        filename: "opening-light.mp3",
        contentType: "audio/mpeg",
      })
      .expect(201);

    expect(draftResponse.body).toMatchObject({
      title: "Northern Lights",
      releaseType: "album",
      publishedStatus: "draft",
      reviewRequired: false,
      approvalRequired: false,
      message: "Draft saved.",
    });
    expect(await Album.findById(draftResponse.body._id).lean()).toMatchObject({
      status: "draft",
      publishedStatus: "draft",
      reviewRequired: false,
      isPublished: false,
    });

    const savedDraftResponse = await request(app)
      .put(`/api/albums/${draftResponse.body._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ description: "Updated album notes" })
      .expect(200);

    expect(savedDraftResponse.body).toMatchObject({
      publishedStatus: "draft",
      reviewRequired: false,
      approvalRequired: false,
      message: "Draft saved.",
      copyrightScanStatus: "passed",
    });

    const submittedResponse = await request(app)
      .put(`/api/albums/${draftResponse.body._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ publishedStatus: "published" })
      .expect(200);

    expect(submittedResponse.body).toMatchObject({
      publishedStatus: "published",
      reviewRequired: false,
      approvalRequired: false,
      message: "",
      copyrightScanStatus: "passed",
    });
    expect(await Album.findById(draftResponse.body._id).lean()).toMatchObject({
      status: "published",
      publishedStatus: "published",
      reviewRequired: false,
      isPublished: true,
    });

    await Album.updateOne(
      { _id: draftResponse.body._id },
      {
        $set: {
          status: "published",
          publishedStatus: "published",
          reviewRequired: false,
          isPublished: true,
        },
      }
    );
    const publishedEditResponse = await request(app)
      .put(`/api/albums/${draftResponse.body._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ description: "A corrected public album description" })
      .expect(200);

    expect(publishedEditResponse.body).toMatchObject({
      publishedStatus: "published",
      reviewRequired: false,
      approvalRequired: false,
    });
    expect(await Album.findById(draftResponse.body._id).lean()).toMatchObject({
      status: "published",
      publishedStatus: "published",
      reviewRequired: false,
      isPublished: true,
    });

    const submittedEpResponse = await request(app)
      .post("/api/creator/music/albums")
      .set("Authorization", `Bearer ${token}`)
      .field("albumTitle", "Three Songs North")
      .field("description", "An EP submitted for release")
      .field("releaseType", "ep")
      .field("price", "500")
      .field("publishedStatus", "published")
      .attach("coverImage", Buffer.from("three-songs-cover"), {
        filename: "three-songs.webp",
        contentType: "image/webp",
      })
      .attach("tracks", Buffer.from("three-songs-track"), {
        filename: "first-song.mp3",
        contentType: "audio/mpeg",
      })
      .expect(201);

    expect(submittedEpResponse.body).toMatchObject({
      releaseType: "ep",
      publishedStatus: "published",
      reviewRequired: false,
      approvalRequired: false,
      message: "",
    });
    expect(await Album.findById(submittedEpResponse.body._id).lean()).toMatchObject({
      status: "published",
      publishedStatus: "published",
      reviewRequired: false,
      isPublished: true,
    });
  });

  test("creator uploads record first upload onboarding milestones once", async () => {
    const { profile, token } = await createUserAndProfile();

    await request(app)
      .post("/api/creator/music")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "First Draft")
      .field("artistName", "Creator Example")
      .field("genre", "Afrobeats")
      .field("description", "First draft upload")
      .field("releaseType", "single")
      .field("price", "0")
      .field("publishedStatus", "draft")
      .attach("audio", Buffer.from("draft-audio"), {
        filename: "first-draft.mp3",
        contentType: "audio/mpeg",
      })
      .expect(201);

    let events = await AnalyticsEvent.find({
      type: "creator_onboarding_step_completed",
      targetId: profile._id,
    })
      .sort({ createdAt: 1, _id: 1 })
      .lean();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      contentType: "first_upload_started",
      metadata: expect.objectContaining({
        source: "creator_music_upload",
        totalSteps: 6,
        progressPercent: 83,
        uploadStatus: "draft",
        uploadContentType: "music",
      }),
    });

    const submittedResponse = await request(app)
      .post("/api/creator/music")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "First Published")
      .field("artistName", "Creator Example")
      .field("genre", "Afrobeats")
      .field("description", "First completed upload")
      .field("releaseType", "single")
      .field("price", "0")
      .field("publishedStatus", "published")
      .attach("audio", Buffer.from("published-audio"), {
        filename: "first-published.mp3",
        contentType: "audio/mpeg",
      })
      .expect(201);

    expect(submittedResponse.body).toMatchObject({
      publishedStatus: "published",
      reviewRequired: false,
      approvalRequired: false,
      message: "",
    });

    const submittedTrack = await Track.findById(submittedResponse.body._id).lean();
    expect(submittedTrack).toMatchObject({
      publishedStatus: "published",
      reviewRequired: false,
      isPublished: true,
    });

    events = await AnalyticsEvent.find({
      type: "creator_onboarding_step_completed",
      targetId: profile._id,
    })
      .sort({ createdAt: 1, _id: 1 })
      .lean();

    expect(events.map((event) => event.contentType)).toEqual([
      "first_upload_started",
      "first_upload_completed",
    ]);
    expect(events[1]).toMatchObject({
      metadata: expect.objectContaining({
        source: "creator_music_upload",
        totalSteps: 6,
        progressPercent: 100,
        uploadStatus: "published",
        uploadContentType: "music",
      }),
    });
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
    expect(response.body).toMatchObject({
      publishedStatus: "draft",
      reviewRequired: false,
      approvalRequired: false,
      message: "Draft saved.",
    });

    const savedVideo = await Video.findOne({ caption: "Visual Anthem" }).lean();
    expect(savedVideo).toBeTruthy();
    expect(savedVideo.contentType).toBe("music_video");
    expect(savedVideo.previewClipUrl).toBeTruthy();
    expect(savedVideo.coverImageUrl).toBeTruthy();
    expect(savedVideo.durationSec).toBe(215);
    expect(savedVideo.videoFormat).toBe("m4v");
    expect(savedVideo.publishedStatus).toBe("draft");
    expect(savedVideo.isPublished).toBe(false);
    expect(savedVideo.visibility).toBe("private");

    const savedDraftResponse = await request(app)
      .put(`/api/videos/${savedVideo._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ description: "Updated performance notes" })
      .expect(200);

    expect(savedDraftResponse.body).toMatchObject({
      publishedStatus: "draft",
      reviewRequired: false,
      approvalRequired: false,
      message: "Draft saved.",
      copyrightScanStatus: "passed",
    });

    const publishResponse = await request(app)
      .put(`/api/videos/${savedVideo._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ publishedStatus: "published" })
      .expect(200);

    expect(publishResponse.body).toMatchObject({
      publishedStatus: "published",
      reviewRequired: false,
      approvalRequired: false,
      message: "",
      copyrightScanStatus: "passed",
    });
    expect(await Video.findById(savedVideo._id).lean()).toMatchObject({
      publishedStatus: "published",
      reviewRequired: false,
      isPublished: true,
      visibility: "public",
    });
  });

  test("POST /api/creator/music/videos publishes eligible music videos immediately", async () => {
    const { token } = await createUserAndProfile();

    const response = await request(app)
      .post("/api/creator/music/videos")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "Review This Film")
      .field("description", "A creator film awaiting approval")
      .field("price", "0")
      .field("publishedStatus", "published")
      .attach("video", Buffer.from("review-film-video"), {
        filename: "review-film.mp4",
        contentType: "video/mp4",
      })
      .expect(201);

    expect(response.body).toMatchObject({
      publishedStatus: "published",
      reviewRequired: false,
      approvalRequired: false,
      message: "",
    });
    expect(await Video.findById(response.body._id).lean()).toMatchObject({
      publishedStatus: "published",
      reviewRequired: false,
      isPublished: true,
      visibility: "public",
    });
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
    expect(response.body).toMatchObject({
      publishedStatus: "draft",
      reviewRequired: false,
      approvalRequired: false,
      message: "Draft saved.",
    });

    const savedTrack = await Track.findOne({ title: "Video Episode One" }).lean();
    expect(savedTrack).toBeTruthy();
    expect(savedTrack.kind).toBe("podcast");
    expect(savedTrack.mediaType).toBe("video");
    expect(savedTrack.videoUrl).toBeTruthy();
    expect(savedTrack.audioUrl).toBe(savedTrack.videoUrl);
    expect(savedTrack.publishedStatus).toBe("draft");
    expect(savedTrack.isPublished).toBe(false);
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

    const savedDraftResponse = await request(app)
      .put(`/api/tracks/${savedTrack._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ description: "Updated episode notes" })
      .expect(200);

    expect(savedDraftResponse.body).toMatchObject({
      publishedStatus: "draft",
      reviewRequired: false,
      approvalRequired: false,
      message: "Draft saved.",
      copyrightScanStatus: "passed",
    });

    const publishResponse = await request(app)
      .put(`/api/tracks/${savedTrack._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ publishedStatus: "published" })
      .expect(200);

    expect(publishResponse.body).toMatchObject({
      publishedStatus: "published",
      reviewRequired: false,
      approvalRequired: false,
      message: "",
      copyrightScanStatus: "passed",
    });
    expect(await Track.findById(savedTrack._id).lean()).toMatchObject({
      publishedStatus: "published",
      reviewRequired: false,
      isPublished: true,
    });
  });

  test("POST /api/creator/podcasts publishes eligible episodes immediately", async () => {
    const { token } = await createUserAndProfile();

    const response = await request(app)
      .post("/api/creator/podcasts")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "Episode Awaiting Review")
      .field("podcastSeries", "Studio Stories")
      .field("mediaType", "audio")
      .field("category", "Culture")
      .field("price", "0")
      .field("publishedStatus", "published")
      .attach("media", Buffer.from("review-podcast-audio"), {
        filename: "review-episode.mp3",
        contentType: "audio/mpeg",
      })
      .expect(201);

    expect(response.body).toMatchObject({
      publishedStatus: "published",
      reviewRequired: false,
      approvalRequired: false,
      message: "",
    });
    expect(await Track.findById(response.body._id).lean()).toMatchObject({
      kind: "podcast",
      publishedStatus: "published",
      reviewRequired: false,
      isPublished: true,
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

  test("creator books stay draft until submitted and then publish immediately", async () => {
    const { token } = await createUserAndProfile();

    const draftResponse = await request(app)
      .post("/api/creator/books")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "A Draft Memoir")
      .field("authorName", "Creator Example")
      .field("genre", "Memoir")
      .field("language", "English")
      .field("description", "A manuscript being prepared")
      .field("price", "0")
      .field("publishedStatus", "draft")
      .field("copyrightDeclared", "true")
      .attach("content", Buffer.from("draft memoir manuscript"), {
        filename: "draft-memoir.pdf",
        contentType: "application/pdf",
      })
      .expect(201);

    expect(draftResponse.body).toMatchObject({
      publishedStatus: "draft",
      reviewRequired: false,
      approvalRequired: false,
      message: "Draft saved.",
    });
    expect(await Book.findById(draftResponse.body._id).lean()).toMatchObject({
      publishedStatus: "draft",
      reviewRequired: false,
      isPublished: false,
    });

    const savedDraftResponse = await request(app)
      .put(`/api/books/${draftResponse.body._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ description: "Updated manuscript notes" })
      .expect(200);

    expect(savedDraftResponse.body).toMatchObject({
      publishedStatus: "draft",
      reviewRequired: false,
      approvalRequired: false,
      message: "Draft saved.",
      copyrightScanStatus: "passed",
    });

    const submittedResponse = await request(app)
      .put(`/api/books/${draftResponse.body._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ publishedStatus: "published" })
      .expect(200);

    expect(submittedResponse.body).toMatchObject({
      publishedStatus: "published",
      reviewRequired: false,
      approvalRequired: false,
      message: "",
      copyrightScanStatus: "passed",
    });
    expect(await Book.findById(draftResponse.body._id).lean()).toMatchObject({
      publishedStatus: "published",
      reviewRequired: false,
      isPublished: true,
    });
  });

  test("POST /api/creator/books publishes eligible manuscripts immediately", async () => {
    const { token } = await createUserAndProfile();

    const response = await request(app)
      .post("/api/creator/books")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "Review This Manuscript")
      .field("authorName", "Creator Example")
      .field("genre", "Fiction")
      .field("language", "English")
      .field("description", "A manuscript awaiting approval")
      .field("price", "0")
      .field("publishedStatus", "published")
      .field("copyrightDeclared", "true")
      .attach("content", Buffer.from("submitted manuscript"), {
        filename: "submitted-manuscript.pdf",
        contentType: "application/pdf",
      })
      .expect(201);

    expect(response.body).toMatchObject({
      publishedStatus: "published",
      reviewRequired: false,
      approvalRequired: false,
      message: "",
    });
    expect(await Book.findById(response.body._id).lean()).toMatchObject({
      publishedStatus: "published",
      reviewRequired: false,
      isPublished: true,
    });
  });

  test("DELETE /api/tracks/:trackId removes associated cloudinary assets", async () => {
    const { token } = await createUserAndProfile();

    const createResponse = await request(app)
      .post("/api/creator/music")
      .set("Authorization", `Bearer ${token}`)
      .field("title", "Delete Me")
      .field("artistName", "Creator Example")
      .field("genre", "Afrobeats")
      .field("description", "Cleanup path")
      .field("releaseType", "single")
      .field("price", "0")
      .field("publishedStatus", "draft")
      .attach("audio", Buffer.from("music-audio"), {
        filename: "delete-me.mp3",
        contentType: "audio/mpeg",
      })
      .attach("preview", Buffer.from("music-preview"), {
        filename: "delete-me-preview.mp3",
        contentType: "audio/mpeg",
      })
      .attach("cover", Buffer.from("music-cover"), {
        filename: "delete-me-cover.webp",
        contentType: "image/webp",
      })
      .expect(201);

    const savedTrack = await Track.findById(createResponse.body._id).lean();
    expect(savedTrack).toBeTruthy();

    cloudinary.uploader.destroy.mockClear();

    await request(app)
      .delete(`/api/tracks/${savedTrack._id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(await Track.findById(savedTrack._id).lean()).toBeNull();
    expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(3);
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(
      "tengacion/creators/audio/mock-1",
      expect.objectContaining({ resource_type: "video", invalidate: true })
    );
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(
      "tengacion/creators/audio/mock-2",
      expect.objectContaining({ resource_type: "video", invalidate: true })
    );
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(
      "tengacion/creators/music-covers/mock-3",
      expect.objectContaining({ resource_type: "image", invalidate: true })
    );
  });
});
