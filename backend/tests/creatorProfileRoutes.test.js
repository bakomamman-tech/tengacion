const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret_1234567890123456789012";

const app = require("../app");
const Album = require("../models/Album");
const Book = require("../models/Book");
const CreatorProfile = require("../models/CreatorProfile");
const Purchase = require("../models/Purchase");
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

const createUserAndProfile = async ({
  creatorTypes = ["music", "bookPublishing", "podcast"],
  name = "Creator Example",
  username = "creator_example",
  email = "creator@example.com",
  displayName = "Creator Example",
  fullName = "Creator Example",
} = {}) => {
  const user = await User.create({
    name,
    username,
    email,
    password: "Password123!",
    role: "artist",
    isArtist: true,
    isVerified: true,
  });

  const profile = await CreatorProfile.create({
    userId: user._id,
    displayName,
    fullName,
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

const createViewer = async ({
  name = "Viewer Example",
  username = "viewer_example",
  email = "viewer@example.com",
} = {}) => {
  const user = await User.create({
    name,
    username,
    email,
    password: "Password123!",
    role: "user",
    isVerified: true,
  });

  const token = await issueSessionToken(user._id);
  return { user, token };
};

const buildProfileUpdatePayload = (creatorTypes = []) => ({
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
  creatorTypes,
  acceptedTerms: true,
  acceptedCopyrightDeclaration: true,
});

const saveCreatorTypes = (token, creatorTypes) =>
  request(app)
    .put("/api/creator/profile")
    .set("Authorization", `Bearer ${token}`)
    .send(buildProfileUpdatePayload(creatorTypes))
    .expect(200);

const fetchCreatorProfile = (token) =>
  request(app)
    .get("/api/creator/profile")
    .set("Authorization", `Bearer ${token}`)
    .expect(200);

const toDataUrl = (contentType, content) =>
  `data:${contentType};base64,${Buffer.from(String(content || ""), "utf8").toString("base64")}`;

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

  test.each([
    { creatorTypes: ["bookPublishing"], expected: ["bookPublishing"] },
    { creatorTypes: ["music", "bookPublishing"], expected: ["music", "bookPublishing"] },
    { creatorTypes: ["music", "bookPublishing", "podcast"], expected: ["music", "bookPublishing", "podcast"] },
  ])("save + refresh persists creator lanes $expected", async ({ creatorTypes, expected }) => {
    const { token } = await createUserAndProfile({ creatorTypes: ["music"] });

    await saveCreatorTypes(token, creatorTypes);
    const response = await fetchCreatorProfile(token);

    expect(response.body.creatorTypes).toEqual(expected);
  });

  test("legacy creator lane values are normalized to canonical keys on save", async () => {
    const { token } = await createUserAndProfile({ creatorTypes: ["music"] });

    await saveCreatorTypes(token, ["music", "books", "podcasts"]);
    const response = await fetchCreatorProfile(token);
    const profile = await CreatorProfile.findOne({ displayName: "Creator Example" }).lean();

    expect(response.body.creatorTypes).toEqual(["music", "bookPublishing", "podcast"]);
    expect(profile.creatorTypes).toEqual(["music", "bookPublishing", "podcast"]);
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

    await saveCreatorTypes(token, ["music", "podcast"]);
    const response = await fetchCreatorProfile(token);

    expect(response.body.creatorTypes).toEqual(["music", "podcast"]);
  });

  test("GET /api/creator/profile sends no-store headers", async () => {
    const { token } = await createUserAndProfile({ creatorTypes: ["music"] });

    const response = await fetchCreatorProfile(token);

    expect(response.headers["cache-control"]).toContain("no-store");
    expect(response.headers.pragma).toBe("no-cache");
  });

  test("GET /api/creator/:creatorId/public-profile returns grouped published creator content", async () => {
    const { profile } = await createUserAndProfile({
      creatorTypes: ["music", "bookPublishing", "podcast"],
    });

    await Track.create([
      {
        creatorId: profile._id,
        title: "Studio Single",
        description: "Published music release",
        price: 0,
        audioUrl: "https://example.com/song.mp3",
        previewUrl: "https://example.com/song-preview.mp3",
        previewStartSec: 64,
        previewLimitSec: 30,
        kind: "music",
        creatorCategory: "music",
        contentType: "track",
        publishedStatus: "published",
        isPublished: true,
      },
      {
        creatorId: profile._id,
        title: "Hidden Draft",
        description: "Should not show publicly",
        price: 0,
        audioUrl: "https://example.com/draft.mp3",
        previewUrl: "https://example.com/draft-preview.mp3",
        kind: "music",
        creatorCategory: "music",
        contentType: "track",
        publishedStatus: "draft",
        isPublished: false,
      },
      {
        creatorId: profile._id,
        title: "Pilot Episode",
        description: "Podcast launch",
        price: 0,
        audioUrl: "https://example.com/episode.mp3",
        previewUrl: "https://example.com/episode-preview.mp3",
        kind: "podcast",
        creatorCategory: "podcasts",
        contentType: "podcast_episode",
        podcastSeries: "Studio Stories",
        publishedStatus: "published",
        isPublished: true,
      },
    ]);

    await Album.create({
      creatorId: profile._id,
      title: "Debut Project",
      description: "Album release",
      price: 0,
      coverUrl: "https://example.com/album-cover.jpg",
      tracks: [
        {
          title: "Intro",
          trackUrl: "https://example.com/album-track.mp3",
          previewUrl: "https://example.com/album-preview.mp3",
          order: 1,
        },
      ],
      totalTracks: 1,
      status: "published",
      publishedStatus: "published",
      isPublished: true,
    });

    await Book.create({
      creatorId: profile._id,
      title: "Creator Notes",
      description: "Published book",
      price: 0,
      contentUrl: "https://example.com/book.pdf",
      previewUrl: "https://example.com/book-preview.pdf",
      fileFormat: "pdf",
      language: "English",
      tags: ["insight", "creative"],
      publishedStatus: "published",
      isPublished: true,
    });

    await Video.create({
      userId: profile.userId.toString(),
      creatorProfileId: profile._id,
      caption: "Launch Visual",
      videoUrl: "https://example.com/video.mp4",
      previewClipUrl: "https://example.com/video-preview.mp4",
      coverImageUrl: "https://example.com/video-cover.jpg",
      price: 0,
      publishedStatus: "published",
      isPublished: true,
    });

    const response = await request(app)
      .get(`/api/creator/${profile._id}/public-profile`)
      .expect(200);

    expect(response.body.creator.displayName).toBe("Creator Example");
    expect(response.body.creator.creatorTypes).toEqual(["music", "bookPublishing", "podcast"]);
    expect(response.body.music.tracks).toHaveLength(1);
    expect(response.body.music.tracks[0].previewStartSec).toBe(64);
    expect(response.body.music.tracks[0].previewLimitSec).toBe(30);
    expect(response.body.music.albums).toHaveLength(1);
    expect(response.body.music.albums[0].downloadUrl).toContain("/api/media/delivery/");
    expect(response.body.music.videos).toHaveLength(1);
    expect(response.body.podcasts.episodes).toHaveLength(1);
    expect(response.body.books).toHaveLength(1);
    expect(response.body.books[0].language).toBe("English");
    expect(response.body.books[0].tags).toEqual(["insight", "creative"]);
    expect(response.body.featured.item.title).toBeTruthy();
  });

  test("GET /api/creator/:username/public-profile resolves canonical public creator metadata by username", async () => {
    const { profile } = await createUserAndProfile({
      username: "creator.example",
      email: "creator.example@test.com",
      displayName: "Creator Example",
    });

    await Track.create({
      creatorId: profile._id,
      title: "Canonical Username Release",
      description: "Published music release",
      price: 0,
      audioUrl: "https://example.com/song.mp3",
      previewUrl: "https://example.com/song-preview.mp3",
      kind: "music",
      creatorCategory: "music",
      contentType: "track",
      publishedStatus: "published",
      isPublished: true,
    });

    const response = await request(app)
      .get("/api/creator/creator.example/public-profile")
      .expect(200);

    expect(response.body.creator.username).toBe("creator.example");
    expect(response.body.creator.canonicalPath).toBe("/creator/creator.example");
    expect(response.body.creator.tabPaths.music).toBe("/creator/creator.example/music");
    expect(response.body.seo.indexable).toBe(true);
  });

  test("GET /api/download/album/:itemId returns a signed archive URL and the archive streams successfully", async () => {
    const { profile, token } = await createUserAndProfile({
      creatorTypes: ["music", "bookPublishing", "podcast"],
    });

    const album = await Album.create({
      creatorId: profile._id,
      title: "Archive Ready Album",
      description: "Bundled release",
      price: 0,
      coverUrl: toDataUrl("image/png", "cover"),
      tracks: [
        {
          title: "Track One",
          trackUrl: toDataUrl("audio/mpeg", "track-one"),
          previewUrl: toDataUrl("audio/mpeg", "preview-one"),
          order: 1,
        },
        {
          title: "Track Two",
          trackUrl: toDataUrl("audio/mpeg", "track-two"),
          previewUrl: toDataUrl("audio/mpeg", "preview-two"),
          order: 2,
        },
      ],
      totalTracks: 2,
      status: "published",
      publishedStatus: "published",
      isPublished: true,
    });

    const downloadResponse = await request(app)
      .get(`/api/download/album/${album._id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(downloadResponse.body.downloadUrl).toContain("/api/media/delivery/");

    const downloadPath = new URL(downloadResponse.body.downloadUrl).pathname;
    const archiveResponse = await request(app)
      .get(downloadPath)
      .buffer(true)
      .parse((res, callback) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(archiveResponse.headers["content-type"]).toContain("application/zip");
    expect(archiveResponse.headers["content-disposition"]).toContain("attachment;");
    expect(Buffer.isBuffer(archiveResponse.body)).toBe(true);
    expect(archiveResponse.body.length).toBeGreaterThan(0);
  });

  test("creator subscriptions unlock full creator access for protected streams and public profile content", async () => {
    const { profile } = await createUserAndProfile({
      creatorTypes: ["music", "bookPublishing", "podcast"],
    });
    const { user: viewer, token: viewerToken } = await createViewer();

    const paidTrack = await Track.create({
      creatorId: profile._id,
      title: "Members Only Release",
      description: "Paid creator content",
      price: 3000,
      audioUrl: "https://example.com/members-only.mp3",
      previewUrl: "https://example.com/members-only-preview.mp3",
      previewStartSec: 45,
      previewLimitSec: 30,
      kind: "music",
      creatorCategory: "music",
      contentType: "track",
      publishedStatus: "published",
      isPublished: true,
    });

    await Purchase.create({
      userId: viewer._id,
      creatorId: profile._id,
      itemType: "subscription",
      itemId: profile._id,
      amount: 2000,
      priceNGN: 2000,
      currency: "NGN",
      status: "paid",
      provider: "paystack",
      providerRef: "subscription_ref_001",
      billingInterval: "monthly",
      accessExpiresAt: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)),
      paidAt: new Date(),
    });

    const profileResponse = await request(app)
      .get(`/api/creator/${profile._id}/public-profile`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);

    expect(profileResponse.body.subscription.price).toBe(2000);
    expect(profileResponse.body.subscription.isSubscribed).toBe(true);
    expect(profileResponse.body.music.tracks[0].canAccessFull).toBe(true);
    expect(profileResponse.body.music.tracks[0].canDownload).toBe(true);

    const entitlementResponse = await request(app)
      .get(`/api/entitlements/check?itemType=track&itemId=${paidTrack._id}`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);

    expect(entitlementResponse.body.entitled).toBe(true);

    const streamResponse = await request(app)
      .get(`/api/stream/track/${paidTrack._id}`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);

    expect(streamResponse.body.canAccessFull).toBe(true);
    expect(streamResponse.body.previewOnly).toBe(false);
  });

  test("subscription cancellation keeps access until expiry and then exposes renew state", async () => {
    const { profile } = await createUserAndProfile({
      creatorTypes: ["music", "bookPublishing", "podcast"],
    });
    const { user: viewer, token: viewerToken } = await createViewer({
      name: "Lifecycle Viewer",
      username: "lifecycle_viewer",
      email: "lifecycle-viewer@example.com",
    });

    const paidTrack = await Track.create({
      creatorId: profile._id,
      title: "Lifecycle Members Track",
      description: "Subscription-only access test",
      price: 3000,
      audioUrl: "https://example.com/lifecycle-members-only.mp3",
      previewUrl: "https://example.com/lifecycle-preview.mp3",
      previewStartSec: 30,
      previewLimitSec: 30,
      kind: "music",
      creatorCategory: "music",
      contentType: "track",
      publishedStatus: "published",
      isPublished: true,
    });

    const purchase = await Purchase.create({
      userId: viewer._id,
      creatorId: profile._id,
      itemType: "subscription",
      itemId: profile._id,
      amount: 2000,
      priceNGN: 2000,
      currency: "NGN",
      status: "paid",
      provider: "paystack",
      providerRef: "subscription_ref_cancel_001",
      billingInterval: "monthly",
      accessExpiresAt: new Date(Date.now() + (5 * 24 * 60 * 60 * 1000)),
      paidAt: new Date(),
    });

    const activeProfileResponse = await request(app)
      .get(`/api/creator/${profile._id}/public-profile`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);

    expect(activeProfileResponse.body.subscription).toMatchObject({
      isSubscribed: true,
      lifecycleStatus: "active",
      canCancel: true,
      canRenew: false,
    });
    expect(activeProfileResponse.body.music.tracks[0].canAccessFull).toBe(true);

    const cancelResponse = await request(app)
      .post(`/api/purchases/${purchase._id}/cancel-subscription`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({})
      .expect(200);

    expect(cancelResponse.body).toMatchObject({
      success: true,
      alreadyCancelled: false,
      purchase: expect.objectContaining({
        status: "paid",
        cancelAtPeriodEnd: true,
        lifecycle: expect.objectContaining({
          lifecycleStatus: "cancel_scheduled",
          canCancel: false,
        }),
      }),
    });

    const cancelledProfileResponse = await request(app)
      .get(`/api/creator/${profile._id}/public-profile`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);

    expect(cancelledProfileResponse.body.subscription).toMatchObject({
      isSubscribed: true,
      lifecycleStatus: "cancel_scheduled",
      cancelAtPeriodEnd: true,
      canCancel: false,
      canRenew: false,
    });

    const entitlementWhileActive = await request(app)
      .get(`/api/entitlements/check?itemType=track&itemId=${paidTrack._id}`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);

    expect(entitlementWhileActive.body.entitled).toBe(true);

    await Purchase.updateOne(
      { _id: purchase._id },
      {
        $set: {
          accessExpiresAt: new Date(Date.now() - (60 * 60 * 1000)),
        },
      }
    );

    const expiredProfileResponse = await request(app)
      .get(`/api/creator/${profile._id}/public-profile`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);

    expect(expiredProfileResponse.body.subscription).toMatchObject({
      isSubscribed: false,
      lifecycleStatus: "expired",
      cancelAtPeriodEnd: true,
      canCancel: false,
      canRenew: true,
    });
    expect(expiredProfileResponse.body.music.tracks[0].canAccessFull).toBe(false);
    expect(expiredProfileResponse.body.music.tracks[0].canDownload).toBe(false);

    const entitlementAfterExpiry = await request(app)
      .get(`/api/entitlements/check?itemType=track&itemId=${paidTrack._id}`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);

    expect(entitlementAfterExpiry.body.entitled).toBe(false);
  });
});
