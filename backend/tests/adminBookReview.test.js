const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-admin-book-review-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "admin_book_review_test_secret_123456789012";

const app = require("../app");
const Album = require("../models/Album");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const AuditLog = require("../models/AuditLog");
const Book = require("../models/Book");
const CreatorProfile = require("../models/CreatorProfile");
const Notification = require("../models/Notification");
const Track = require("../models/Track");
const User = require("../models/User");
const Video = require("../models/Video");

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

const createAdminToken = async () => {
  const admin = await User.create({
    name: "Book Review Admin",
    username: "book_review_admin",
    email: "book-review-admin@test.com",
    password: "Password123!",
    role: "admin",
    isVerified: true,
    emailVerified: true,
  });

  return issueSessionToken(admin._id);
};

describe("admin book review", () => {
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

  test("admin rejects a book draft and approves it after manuscript submission", async () => {
    const adminToken = await createAdminToken();
    const creatorUser = await User.create({
      name: "Stephen Daniel Kurah",
      username: "stephen_daniel_kurah",
      email: "stephen-daniel-kurah@test.com",
      password: "Password123!",
      isVerified: true,
      emailVerified: true,
    });
    const creator = await CreatorProfile.create({
      userId: creatorUser._id,
      displayName: "Stephen Daniel Kurah",
      creatorTypes: ["bookPublishing"],
      acceptedTerms: true,
      acceptedCopyrightDeclaration: true,
    });
    const book = await Book.create({
      creatorId: creator._id,
      title: "Rustle of Death",
      authorName: "Stephen Daniel Kurah",
      description: "A manuscript awaiting admin approval.",
      price: 2500,
      priceNGN: 2500,
      contentUrl: "https://cdn.test/manuscripts/rustle-of-death.pdf",
      fileUrl: "https://cdn.test/manuscripts/rustle-of-death.pdf",
      fileFormat: "pdf",
      publishedStatus: "draft",
      copyrightScanStatus: "passed",
      verificationNotes: "Saved as a creator draft.",
      reviewRequired: false,
      isPublished: false,
    });

    await request(app)
      .get(`/api/books/${book._id}`)
      .expect(404);

    const draftApprovalResponse = await request(app)
      .post(`/api/admin/books/${book._id}/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Attempted early manuscript approval" })
      .expect(409);

    expect(draftApprovalResponse.body.error).toContain("submitted for review");
    expect((await Book.findById(book._id).lean()).publishedStatus).toBe("draft");
    expect(
      await AuditLog.findOne({
        action: "admin.book.approve",
        targetId: book._id.toString(),
      }).lean()
    ).toBeNull();

    book.publishedStatus = "under_review";
    book.copyrightScanStatus = "flagged";
    book.verificationNotes = "Similar title match requires manual rights review.";
    book.reviewRequired = true;
    await book.save();

    const contentResponse = await request(app)
      .get("/api/admin/content?category=books&status=under_review")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(contentResponse.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: book._id.toString(),
          type: "book",
          title: "Rustle of Death",
          status: "under_review",
          reviewRequired: true,
          manuscriptAvailable: true,
        }),
      ])
    );

    const reviewResponse = await request(app)
      .get(`/api/admin/books/${book._id}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(reviewResponse.body.book).toMatchObject({
      id: book._id.toString(),
      title: "Rustle of Death",
      manuscriptUrl: "https://cdn.test/manuscripts/rustle-of-death.pdf",
      creator: {
        displayName: "Stephen Daniel Kurah",
      },
    });

    const approveResponse = await request(app)
      .post(`/api/admin/books/${book._id}/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Rights and manuscript reviewed" })
      .expect(200);

    expect(approveResponse.body.book).toMatchObject({
      id: book._id.toString(),
      status: "published",
      reviewRequired: false,
      copyrightScanStatus: "passed",
    });

    const refreshed = await Book.findById(book._id).lean();
    expect(refreshed.isPublished).toBe(true);
    expect(refreshed.publishedStatus).toBe("published");
    expect(refreshed.reviewRequired).toBe(false);

    await request(app)
      .get(`/api/books/${book._id}`)
      .expect(200);

    const auditLog = await AuditLog.findOne({
      action: "admin.book.approve",
      targetId: book._id.toString(),
    }).lean();
    expect(auditLog).toBeTruthy();

    const notification = await Notification.findOne({
      recipient: creatorUser._id,
      "entity.id": book._id,
    }).lean();
    expect(notification?.text).toContain("Rustle of Death");
  });

  test("admin rejects a music draft and approves it after submission for review", async () => {
    const adminToken = await createAdminToken();
    const creatorUser = await User.create({
      name: "Pyrexx Singz",
      username: "Pyrexx_Singz",
      email: "pyrexx-singz@test.com",
      password: "Password123!",
      isVerified: true,
      emailVerified: true,
    });
    const creator = await CreatorProfile.create({
      userId: creatorUser._id,
      displayName: "Pyrexx_Singz",
      creatorTypes: ["music"],
      acceptedTerms: true,
      acceptedCopyrightDeclaration: true,
    });
    const track = await Track.create({
      creatorId: creator._id,
      title: "Yarinya (My Girl)",
      artistName: "Pyrexx_Singz",
      description: "A music draft waiting for final publication.",
      price: 1500,
      priceNGN: 1500,
      audioUrl: "https://cdn.test/music/yarinya-my-girl.mp3",
      fullAudioUrl: "https://cdn.test/music/yarinya-my-girl.mp3",
      publishedStatus: "draft",
      copyrightScanStatus: "passed",
      verificationNotes: "Metadata screening passed.",
      reviewRequired: false,
      isPublished: false,
      kind: "music",
      creatorCategory: "music",
      contentType: "track",
    });

    await request(app)
      .get(`/api/tracks/${track._id}`)
      .expect(404);

    const contentResponse = await request(app)
      .get("/api/admin/content?category=music&status=draft")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(contentResponse.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: track._id.toString(),
          type: "track",
          title: "Yarinya (My Girl)",
          status: "draft",
          audioAvailable: true,
          previewAvailable: false,
        }),
      ])
    );

    const draftPublishResponse = await request(app)
      .post(`/api/admin/tracks/${track._id}/publish`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Audio rights and release metadata reviewed" })
      .expect(409);

    expect(draftPublishResponse.body.error).toContain("submitted for review");
    expect((await Track.findById(track._id).lean()).publishedStatus).toBe("draft");

    track.publishedStatus = "under_review";
    track.reviewRequired = true;
    await track.save();

    const publishResponse = await request(app)
      .post(`/api/admin/tracks/${track._id}/publish`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Audio rights and release metadata reviewed" })
      .expect(200);

    expect(publishResponse.body.track).toMatchObject({
      id: track._id.toString(),
      title: "Yarinya (My Girl)",
      status: "published",
      reviewRequired: false,
      copyrightScanStatus: "passed",
    });

    const refreshed = await Track.findById(track._id).lean();
    expect(refreshed.isPublished).toBe(true);
    expect(refreshed.publishedStatus).toBe("published");

    await request(app)
      .get(`/api/tracks/${track._id}`)
      .expect(200);

    await request(app)
      .get(`/api/tracks/${track._id}/stream`)
      .expect(404);

    const auditLog = await AuditLog.findOne({
      action: "admin.track.publish",
      targetId: track._id.toString(),
    }).lean();
    expect(auditLog).toBeTruthy();

    const notification = await Notification.findOne({
      recipient: creatorUser._id,
      "entity.id": track._id,
    }).lean();
    expect(notification?.text).toContain("Yarinya (My Girl)");
  });

  test("admin rejects an album draft and approves a submitted EP", async () => {
    const adminToken = await createAdminToken();
    const creatorUser = await User.create({
      name: "Northern Sound",
      username: "northern_sound",
      email: "northern-sound@test.com",
      password: "Password123!",
      isVerified: true,
      emailVerified: true,
    });
    const creator = await CreatorProfile.create({
      userId: creatorUser._id,
      displayName: "Northern Sound",
      creatorTypes: ["music"],
      acceptedTerms: true,
      acceptedCopyrightDeclaration: true,
    });
    const album = await Album.create({
      creatorId: creator._id,
      title: "Harmattan Sessions",
      description: "A two-track EP awaiting review.",
      price: 1200,
      priceNGN: 1200,
      currency: "NGN",
      coverUrl: "https://cdn.test/albums/harmattan-sessions.jpg",
      releaseType: "ep",
      contentType: "ep",
      tracks: [
        {
          title: "Northern Wind",
          trackUrl: "https://cdn.test/albums/northern-wind.mp3",
          order: 1,
        },
        {
          title: "Dust and Gold",
          trackUrl: "https://cdn.test/albums/dust-and-gold.mp3",
          order: 2,
        },
      ],
      totalTracks: 2,
      status: "draft",
      publishedStatus: "draft",
      copyrightScanStatus: "passed",
      verificationNotes: "Saved as a creator draft.",
      reviewRequired: false,
      isPublished: false,
    });

    const draftApprovalResponse = await request(app)
      .post(`/api/admin/albums/${album._id}/publish`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Attempted early approval" })
      .expect(409);

    expect(draftApprovalResponse.body.error).toContain("submitted for review");
    expect((await Album.findById(album._id).lean()).publishedStatus).toBe("draft");

    album.publishedStatus = "under_review";
    album.copyrightScanStatus = "flagged";
    album.verificationNotes = "Manual rights review is required.";
    album.reviewRequired = true;
    await album.save();

    const contentResponse = await request(app)
      .get("/api/admin/content?category=albums&status=under_review")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(contentResponse.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: album._id.toString(),
          type: "album",
          title: "Harmattan Sessions",
          releaseType: "ep",
          status: "under_review",
          reviewRequired: true,
          tracksAvailable: true,
          totalTracks: 2,
          tracks: expect.arrayContaining([
            expect.objectContaining({
              title: "Northern Wind",
              audioUrl: "https://cdn.test/albums/northern-wind.mp3",
            }),
          ]),
        }),
      ])
    );

    const approveResponse = await request(app)
      .post(`/api/admin/albums/${album._id}/publish`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Album rights and tracks reviewed" })
      .expect(200);

    expect(approveResponse.body.album).toMatchObject({
      id: album._id.toString(),
      title: "Harmattan Sessions",
      releaseType: "ep",
      status: "published",
      reviewRequired: false,
      copyrightScanStatus: "passed",
      tracksAvailable: true,
    });

    expect(await Album.findById(album._id).lean()).toMatchObject({
      status: "published",
      publishedStatus: "published",
      reviewRequired: false,
      isPublished: true,
    });

    await request(app)
      .get(`/api/albums/${album._id}`)
      .expect(200);

    expect(
      await AuditLog.findOne({
        action: "admin.album.publish",
        targetId: album._id.toString(),
      }).lean()
    ).toBeTruthy();
    expect(
      await AnalyticsEvent.findOne({
        type: "album_approved",
        targetId: album._id,
      }).lean()
    ).toBeTruthy();

    const notification = await Notification.findOne({
      recipient: creatorUser._id,
      "entity.id": album._id,
    }).lean();
    expect(notification?.text).toContain("Harmattan Sessions");
  });

  test("admin can review and approve a submitted creator video", async () => {
    const adminToken = await createAdminToken();
    const creatorUser = await User.create({
      name: "Amina Films",
      username: "amina_films",
      email: "amina-films@test.com",
      password: "Password123!",
      isVerified: true,
      emailVerified: true,
    });
    const creator = await CreatorProfile.create({
      userId: creatorUser._id,
      displayName: "Amina Films",
      creatorTypes: ["music"],
      acceptedTerms: true,
      acceptedCopyrightDeclaration: true,
    });
    const video = await Video.create({
      userId: creatorUser._id.toString(),
      name: "Amina Films",
      username: "amina_films",
      creatorProfileId: creator._id,
      caption: "Kaduna Nights",
      description: "A short film submitted for administrator review.",
      videoUrl: "https://cdn.test/videos/kaduna-nights.mp4",
      coverImageUrl: "https://cdn.test/videos/kaduna-nights.jpg",
      durationSec: 180,
      videoFormat: "mp4",
      price: 750,
      isFree: false,
      publishedStatus: "draft",
      copyrightScanStatus: "passed",
      verificationNotes: "Saved as a creator draft.",
      reviewRequired: false,
      isPublished: false,
      visibility: "private",
      moderationStatus: "approved",
      storageStage: "permanent",
    });

    const draftApprovalResponse = await request(app)
      .post(`/api/admin/videos/${video._id}/publish`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Attempted early approval" })
      .expect(409);

    expect(draftApprovalResponse.body.error).toContain("submitted for review");

    video.publishedStatus = "under_review";
    video.copyrightScanStatus = "flagged";
    video.verificationNotes = "Manual rights review is required.";
    video.reviewRequired = true;
    await video.save();

    const contentResponse = await request(app)
      .get("/api/admin/content?category=videos&status=under_review")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(contentResponse.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: video._id.toString(),
          type: "video",
          title: "Kaduna Nights",
          status: "under_review",
          reviewRequired: true,
          videoAvailable: true,
          videoUrl: "https://cdn.test/videos/kaduna-nights.mp4",
          coverImageUrl: "https://cdn.test/videos/kaduna-nights.jpg",
          durationSec: 180,
        }),
      ])
    );

    const approveResponse = await request(app)
      .post(`/api/admin/videos/${video._id}/publish`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Video rights and release metadata reviewed" })
      .expect(200);

    expect(approveResponse.body.video).toMatchObject({
      id: video._id.toString(),
      title: "Kaduna Nights",
      status: "published",
      reviewRequired: false,
      copyrightScanStatus: "passed",
      visibility: "public",
      videoUrl: "https://cdn.test/videos/kaduna-nights.mp4",
    });

    const refreshed = await Video.findById(video._id).lean();
    expect(refreshed).toMatchObject({
      isPublished: true,
      publishedStatus: "published",
      visibility: "public",
      reviewRequired: false,
      moderationStatus: "ALLOW",
    });
    expect(refreshed.reviewedBy).toBeTruthy();
    expect(refreshed.reviewedAt).toBeTruthy();

    expect(
      await AuditLog.findOne({
        action: "admin.video.publish",
        targetId: video._id.toString(),
      }).lean()
    ).toBeTruthy();
    expect(
      await AnalyticsEvent.findOne({
        type: "video_approved",
        targetId: video._id,
      }).lean()
    ).toBeTruthy();

    const notification = await Notification.findOne({
      recipient: creatorUser._id,
      "entity.id": video._id,
    }).lean();
    expect(notification?.text).toContain("Kaduna Nights");
  });
});
