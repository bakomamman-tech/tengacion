const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret_1234567890123456789012";
process.env.MODERATION_ENABLED = "false";

const app = require("../app");
const Book = require("../models/Book");
const CreatorProfile = require("../models/CreatorProfile");
const Track = require("../models/Track");
const User = require("../models/User");
const {
  classifyRecordMedia,
  LEGACY_MEDIA_SOURCES,
} = require("../services/mediaAuditService");

let mongod;
let sequence = 0;

const trackSource = LEGACY_MEDIA_SOURCES.find((entry) => entry.key === "Track");
const bookSource = LEGACY_MEDIA_SOURCES.find((entry) => entry.key === "Book");

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
  sequence += 1;
  const slug = `media_write_creator_${sequence}`;
  const user = await User.create({
    name: "Media Write Creator",
    username: slug,
    email: `${slug}@example.com`,
    password: "Password123!",
    role: "artist",
    isArtist: true,
    isVerified: true,
  });

  const profile = await CreatorProfile.create({
    userId: user._id,
    displayName: "Media Write Creator",
    fullName: "Media Write Creator",
    phoneNumber: "08000000000",
    accountNumber: "1234567890",
    country: "Nigeria",
    countryOfResidence: "Nigeria",
    creatorTypes: ["music", "bookPublishing"],
    acceptedTerms: true,
    acceptedCopyrightDeclaration: true,
    onboardingCompleted: true,
    onboardingComplete: true,
    status: "active",
  });

  const token = await issueSessionToken(user._id);
  return { user, profile, token };
};

describe("media write normalization", () => {
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

  test("replacing a legacy track cover rewrites cover aliases to cloudinary", async () => {
    const { profile, token } = await createCreator();

    const track = await Track.create({
      creatorId: profile._id,
      title: "Legacy Cover Track",
      description: "Track with an old local cover alias",
      price: 0,
      priceNGN: 0,
      audioUrl:
        "https://res.cloudinary.com/test-cloud/video/upload/v1/tengacion/creators/audio/existing-track.mp4",
      fullAudioUrl:
        "https://res.cloudinary.com/test-cloud/video/upload/v1/tengacion/creators/audio/existing-track.mp4",
      previewUrl:
        "https://res.cloudinary.com/test-cloud/video/upload/v1/tengacion/creators/audio/existing-track-preview.mp4",
      previewSampleUrl:
        "https://res.cloudinary.com/test-cloud/video/upload/v1/tengacion/creators/audio/existing-track-preview.mp4",
      coverImageUrl: "/uploads/legacy/track-cover.jpg",
      coverUrl: "/uploads/legacy/track-cover.jpg",
      kind: "music",
      creatorCategory: "music",
      contentType: "track",
      publishedStatus: "draft",
      isPublished: false,
      archivedAt: null,
    });

    const response = await request(app)
      .put(`/api/tracks/${track._id}`)
      .set("Authorization", `Bearer ${token}`)
      .attach("cover", Buffer.from("new-cover"), {
        filename: "track-cover.jpg",
        contentType: "image/jpeg",
      })
      .expect(200);

    expect(response.body.coverImageUrl).toContain(
      "https://res.cloudinary.com/test-cloud/image/upload/"
    );

    const refreshed = await Track.findById(track._id).lean();
    expect(refreshed.coverImageUrl).toContain(
      "https://res.cloudinary.com/test-cloud/image/upload/"
    );
    expect(refreshed.coverUrl).toBe(refreshed.coverImageUrl);
    expect(refreshed.coverUrl).not.toContain("/uploads/");
    expect(refreshed.coverMedia).toMatchObject({
      provider: "cloudinary",
      assetId: "asset-1",
      publicId: "tengacion/creators/music-covers/mock-1",
      legacyPath: "",
    });
    expect(classifyRecordMedia(refreshed, trackSource).status).toBe("cloudinary");
  });

  test("replacing a legacy book file rewrites cover and file aliases to cloudinary", async () => {
    const { profile, token } = await createCreator();

    const book = await Book.create({
      creatorId: profile._id,
      title: "Legacy Alias Book",
      description: "Book with old local aliases",
      price: 0,
      priceNGN: 0,
      coverImageUrl: "/uploads/legacy/book-cover.jpg",
      coverUrl: "/uploads/legacy/book-cover.jpg",
      contentUrl:
        "https://res.cloudinary.com/test-cloud/raw/upload/v1/tengacion/books/files/existing-book.bin",
      fileUrl: "/uploads/legacy/book-file.pdf",
      fileFormat: "pdf",
      creatorCategory: "books",
      contentType: "pdf_book",
      publishedStatus: "draft",
      isPublished: false,
      archivedAt: null,
    });

    const response = await request(app)
      .put(`/api/books/${book._id}`)
      .set("Authorization", `Bearer ${token}`)
      .attach("cover", Buffer.from("new-cover"), {
        filename: "book-cover.jpg",
        contentType: "image/jpeg",
      })
      .attach("content", Buffer.from("new-book-content"), {
        filename: "book.pdf",
        contentType: "application/pdf",
      })
      .expect(200);

    expect(response.body.coverImageUrl).toContain(
      "https://res.cloudinary.com/test-cloud/image/upload/"
    );
    expect(response.body.contentUrl).toContain(
      "https://res.cloudinary.com/test-cloud/raw/upload/"
    );

    const refreshed = await Book.findById(book._id).lean();
    expect(refreshed.coverUrl).toBe(refreshed.coverImageUrl);
    expect(refreshed.fileUrl).toBe(refreshed.contentUrl);
    expect(refreshed.coverUrl).not.toContain("/uploads/");
    expect(refreshed.fileUrl).not.toContain("/uploads/");
    expect(refreshed.coverMedia).toMatchObject({
      provider: "cloudinary",
      assetId: "asset-1",
      publicId: "tengacion/books/covers/mock-1",
      legacyPath: "",
    });
    expect(refreshed.contentMedia).toMatchObject({
      provider: "cloudinary",
      assetId: "asset-2",
      publicId: "tengacion/books/files/mock-2",
      legacyPath: "",
    });
    expect(classifyRecordMedia(refreshed, bookSource).status).toBe("cloudinary");
  });
});
