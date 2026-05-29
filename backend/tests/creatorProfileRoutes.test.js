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
const AnalyticsEvent = require("../models/AnalyticsEvent");
const Purchase = require("../models/Purchase");
const RecommendationLog = require("../models/RecommendationLog");
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

const daysFromNow = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

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

  test("PUT /api/creator/profile saves creator subscription packaging for fan-facing pages", async () => {
    const { profile, token } = await createUserAndProfile({ creatorTypes: ["music"] });

    const updateResponse = await request(app)
      .put("/api/creator/profile")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...buildProfileUpdatePayload(["music"]),
        subscriptionPrice: 3500,
        subscriptionPriceGlobal: 8.99,
        subscriptionDescription: "Join the studio circle for private demos and monthly release notes.",
        subscriptionBenefits: [
          "Private demo listening sessions",
          "Monthly production notes",
          "Member-only download drops",
        ],
      })
      .expect(200);

    expect(updateResponse.body.creatorProfile).toMatchObject({
      subscriptionPrice: 3500,
      subscriptionPriceGlobal: 8.99,
      subscriptionDescription: "Join the studio circle for private demos and monthly release notes.",
      subscriptionBenefits: [
        "Private demo listening sessions",
        "Monthly production notes",
        "Member-only download drops",
      ],
    });

    const publicResponse = await request(app)
      .get(`/api/creator/${profile._id}/public-profile`)
      .expect(200);

    expect(publicResponse.body.subscription).toMatchObject({
      price: 3500,
      description: "Join the studio circle for private demos and monthly release notes.",
      benefits: [
        "Private demo listening sessions",
        "Monthly production notes",
        "Member-only download drops",
      ],
    });
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

  test("GET /api/creator/me/content-summary includes activation progress", async () => {
    const { profile, token } = await createUserAndProfile({ creatorTypes: ["music"] });

    await Track.create({
      creatorId: profile._id,
      title: "Activation Draft",
      description: "Creator started a first upload",
      price: 0,
      audioUrl: "https://example.com/draft.mp3",
      kind: "music",
      creatorCategory: "music",
      contentType: "track",
      publishedStatus: "draft",
      isPublished: false,
    });

    const response = await request(app)
      .get("/api/creator/me/content-summary")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.activation).toMatchObject({
      status: "in_progress",
      firstUploadStarted: true,
      firstUploadCompleted: false,
      nextStep: expect.objectContaining({
        key: "first_upload_completed",
        actionTo: "/creator/music/upload",
      }),
    });
    expect(response.body.activation.steps.map((step) => step.key)).toEqual([
      "account_created",
      "creator_lane_selected",
      "profile_ready",
      "first_upload_started",
      "first_upload_completed",
      "payment_readiness_started",
    ]);
  });

  test("GET /api/creator/me/content-summary exposes operating console insights", async () => {
    const { profile, token } = await createUserAndProfile({ creatorTypes: ["music"] });
    const { user: viewer } = await createViewer();

    const track = await Track.create({
      creatorId: profile._id,
      title: "Console Single",
      description: "",
      price: 2500,
      priceNGN: 2500,
      audioUrl: "https://example.com/console-single.mp3",
      previewUrl: "",
      kind: "music",
      creatorCategory: "music",
      contentType: "track",
      publishedStatus: "published",
      isPublished: true,
      playsCount: 31,
      purchaseCount: 1,
    });

    await Purchase.create([
      {
        userId: viewer._id,
        creatorId: profile._id,
        itemType: "track",
        itemId: track._id,
        amount: 2500,
        priceNGN: 2500,
        currency: "NGN",
        status: "paid",
        provider: "paystack",
        providerRef: "console_track_ref_001",
        paidAt: new Date(),
      },
      {
        userId: viewer._id,
        creatorId: profile._id,
        itemType: "subscription",
        itemId: profile._id,
        amount: 2000,
        priceNGN: 2000,
        currency: "NGN",
        status: "paid",
        provider: "paystack",
        providerRef: "console_subscription_ref_001",
        billingInterval: "monthly",
        accessExpiresAt: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)),
        paidAt: new Date(),
      },
    ]);

    const response = await request(app)
      .get("/api/creator/me/content-summary")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.wallet.payoutReadiness).toBeTruthy();
    expect(response.body.operatingConsole.funnel).toMatchObject({
      contentItems: 1,
      publishedItems: 1,
      paidItems: 1,
      paidPurchases: 1,
      subscribers: 1,
    });
    expect(response.body.operatingConsole.recentSales[0]).toMatchObject({
      itemTitle: "Console Single",
      buyer: expect.objectContaining({ name: "Viewer Example" }),
      creatorAmount: 1000,
    });
    expect(response.body.operatingConsole.recentSubscribers[0]).toMatchObject({
      buyer: expect.objectContaining({ name: "Viewer Example" }),
      lifecycleStatus: "active",
    });
    expect(response.body.operatingConsole.metadataFixes[0]).toMatchObject({
      title: "Console Single",
      missingFields: expect.arrayContaining(["Description", "Cover image", "Paid preview", "Genre"]),
    });
    expect(response.body.operatingConsole.catalogHealth).toMatchObject({
      itemCount: 1,
      monetizedItems: 1,
      issueCount: 4,
      label: "At risk",
    });
    expect(response.body.operatingConsole.catalogGrowthPrompts[0]).toMatchObject({
      title: "Add cover art",
      actionLabel: "Add cover",
    });
    expect(response.body.operatingConsole.akusoTemplates.map((template) => template.key)).toEqual(
      expect.arrayContaining(["track_description", "subscription_benefits", "launch_announcement"])
    );
  });

  test("GET /api/creator/subscriptions/analytics reports churn, retention, and cohort revenue", async () => {
    const { profile, token } = await createUserAndProfile({ creatorTypes: ["music"] });
    const { user: retainedFan } = await createViewer({
      name: "Retained Fan",
      username: "retained_fan",
      email: "retained-fan@example.com",
    });
    const { user: churnedFan } = await createViewer({
      name: "Churned Fan",
      username: "churned_fan",
      email: "churned-fan@example.com",
    });
    const { user: newFan } = await createViewer({
      name: "New Member",
      username: "new_member",
      email: "new-member@example.com",
    });

    await Purchase.create([
      {
        userId: retainedFan._id,
        creatorId: profile._id,
        itemType: "subscription",
        itemId: profile._id,
        amount: 2000,
        priceNGN: 2000,
        currency: "NGN",
        status: "paid",
        provider: "paystack",
        providerRef: "subscription_retained_initial",
        billingInterval: "monthly",
        paidAt: daysFromNow(-35),
        accessExpiresAt: daysFromNow(20),
      },
      {
        userId: retainedFan._id,
        creatorId: profile._id,
        itemType: "subscription",
        itemId: profile._id,
        amount: 2000,
        priceNGN: 2000,
        currency: "NGN",
        status: "paid",
        provider: "paystack",
        providerRef: "subscription_retained_renewal",
        billingInterval: "monthly",
        paidAt: daysFromNow(-2),
        accessExpiresAt: daysFromNow(50),
      },
      {
        userId: churnedFan._id,
        creatorId: profile._id,
        itemType: "subscription",
        itemId: profile._id,
        amount: 2000,
        priceNGN: 2000,
        currency: "NGN",
        status: "paid",
        provider: "paystack",
        providerRef: "subscription_churned_initial",
        billingInterval: "monthly",
        paidAt: daysFromNow(-35),
        accessExpiresAt: daysFromNow(-1),
      },
      {
        userId: newFan._id,
        creatorId: profile._id,
        itemType: "subscription",
        itemId: profile._id,
        amount: 2000,
        priceNGN: 2000,
        currency: "NGN",
        status: "paid",
        provider: "paystack",
        providerRef: "subscription_new_cancel_scheduled",
        billingInterval: "monthly",
        paidAt: daysFromNow(-3),
        accessExpiresAt: daysFromNow(27),
        cancelAtPeriodEnd: true,
        canceledAt: daysFromNow(-1),
      },
    ]);

    const response = await request(app)
      .get("/api/creator/subscriptions/analytics?range=30d")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.summary).toMatchObject({
      totalSubscribers: 3,
      activeSubscribers: 2,
      startingSubscribers: 2,
      newSubscribers: 1,
      retainedSubscribers: 1,
      churnedSubscribers: 1,
      cancelScheduledSubscribers: 1,
      expiredSubscribers: 1,
      renewalPurchases: 1,
      revenue: 4000,
      creatorRevenue: 1600,
      retentionRate: 50,
      churnRate: 50,
      repeatSubscribers: 1,
      repeatSubscriberRate: 33.3,
    });
    expect(response.body.cohortRevenue.length).toBeGreaterThan(0);
    expect(response.body.repeatBuyerIndicators).toMatchObject({
      repeatSubscribers: 1,
      renewalPurchases: 1,
    });
    expect(response.body.actionPrompts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "subscription_churn_attention" }),
        expect.objectContaining({ key: "subscription_new_member_momentum" }),
      ])
    );

    const summaryResponse = await request(app)
      .get("/api/creator/me/content-summary")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(summaryResponse.body.subscriptionAnalytics.summary).toMatchObject({
      activeSubscribers: 2,
      churnedSubscribers: 1,
      revenue: 4000,
    });
  });

  test("GET /api/creator/me/content-summary exposes discovery recommendation insights", async () => {
    const { profile, token } = await createUserAndProfile({ creatorTypes: ["music"] });
    const { user: viewer } = await createViewer({
      name: "Discovery Viewer",
      username: "discovery_viewer",
      email: "discovery-viewer@example.com",
    });
    const track = await Track.create({
      creatorId: profile._id,
      title: "Discovery Single",
      description: "Recommendation-ready track",
      price: 1500,
      audioUrl: "https://example.com/discovery-single.mp3",
      previewUrl: "https://example.com/discovery-single-preview.mp3",
      kind: "music",
      creatorCategory: "music",
      contentType: "track",
      publishedStatus: "published",
      isPublished: true,
    });
    const entityKey = `track:${track._id}`;

    await RecommendationLog.create({
      requestId: "creator-discovery-insights-001",
      userId: viewer._id,
      surface: "creator_hub",
      candidateIds: [entityKey],
      rankedIds: [entityKey],
      creatorIds: [profile._id],
      rankedItemRefs: [
        {
          entityKey,
          entityType: "track",
          entityId: track._id.toString(),
          creatorId: profile._id,
          rank: 1,
          reason: "popular_now",
        },
      ],
      creatorExposures: [
        {
          creatorId: profile._id,
          count: 1,
          highestRank: 1,
          entityTypes: ["track"],
        },
      ],
      responseMeta: {
        itemCount: 1,
        creatorCount: 1,
      },
      servedAt: new Date(),
    });

    await AnalyticsEvent.create([
      {
        type: "recommendation_clicked",
        userId: viewer._id,
        targetId: track._id.toString(),
        targetType: "track",
        contentType: "creator_hub",
        metadata: {
          creatorId: profile._id.toString(),
          surface: "creator_hub",
        },
      },
      {
        type: "creator_followed",
        userId: viewer._id,
        targetId: profile._id.toString(),
        targetType: "creator",
        contentType: "creator_hub",
        metadata: {
          creatorId: profile._id.toString(),
          surface: "creator_hub",
        },
      },
    ]);

    const response = await request(app)
      .get("/api/creator/me/content-summary")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.discoveryInsights.summary).toMatchObject({
      impressions: 1,
      recommendationRequests: 1,
      clicks: 1,
      follows: 1,
      clickThroughRate: 100,
    });
    expect(response.body.discoveryInsights.surfaceBreakdown[0]).toMatchObject({
      surface: "creator_hub",
      impressions: 1,
      clicks: 1,
      follows: 1,
    });

    const endpointResponse = await request(app)
      .get("/api/creator/discovery/insights?range=7d")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(endpointResponse.body.filters.range).toBe("7d");
    expect(endpointResponse.body.summary.impressions).toBe(1);
  });

  test("GET /api/creator/discovery/content/:itemType/:itemId returns item-level conversion insights", async () => {
    const { profile, token } = await createUserAndProfile({ creatorTypes: ["music"] });
    const { user: viewer } = await createViewer({
      name: "Content Insights Viewer",
      username: "content_insights_viewer",
      email: "content-insights-viewer@example.com",
    });
    const track = await Track.create({
      creatorId: profile._id,
      title: "Conversion Single",
      description: "Track with recommendation conversion data",
      price: 1800,
      audioUrl: "https://example.com/conversion-single.mp3",
      previewUrl: "https://example.com/conversion-single-preview.mp3",
      kind: "music",
      creatorCategory: "music",
      contentType: "track",
      publishedStatus: "published",
      isPublished: true,
    });
    const entityKey = `track:${track._id}`;

    await RecommendationLog.create({
      requestId: "content-discovery-insights-001",
      userId: viewer._id,
      surface: "creator_hub",
      candidateIds: [entityKey],
      rankedIds: [entityKey],
      creatorIds: [profile._id],
      rankedItemRefs: [
        {
          entityKey,
          entityType: "track",
          entityId: track._id.toString(),
          creatorId: profile._id,
          rank: 2,
          reason: "popular_now",
        },
      ],
      creatorExposures: [
        {
          creatorId: profile._id,
          count: 1,
          highestRank: 2,
          entityTypes: ["track"],
        },
      ],
      servedAt: new Date(),
    });

    await AnalyticsEvent.create([
      {
        type: "recommendation_clicked",
        userId: viewer._id,
        targetId: track._id.toString(),
        targetType: "track",
        contentType: "creator_hub",
        metadata: {
          creatorId: profile._id.toString(),
          surface: "creator_hub",
        },
      },
      {
        type: "track_preview_started",
        userId: viewer._id,
        targetId: track._id.toString(),
        targetType: "track",
        contentType: "creator_hub",
        metadata: {
          creatorId: profile._id.toString(),
          surface: "creator_hub",
        },
      },
    ]);

    await Purchase.create({
      userId: viewer._id,
      creatorId: profile._id,
      itemType: "track",
      itemId: track._id,
      amount: 1800,
      priceNGN: 1800,
      currency: "NGN",
      status: "paid",
      provider: "paystack",
      providerRef: "content_insights_purchase_001",
      paidAt: new Date(),
    });

    const response = await request(app)
      .get(`/api/creator/discovery/content/track/${track._id}?range=7d`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.filters.range).toBe("7d");
    expect(response.body.item).toMatchObject({
      id: track._id.toString(),
      itemType: "track",
      title: "Conversion Single",
      price: 1800,
    });
    expect(response.body.summary).toMatchObject({
      impressions: 1,
      recommendationRequests: 1,
      clicks: 1,
      previews: 1,
      purchases: 1,
      revenue: 1800,
      uniqueBuyers: 1,
      clickThroughRate: 100,
      purchaseConversionRate: 100,
      clickToPurchaseRate: 100,
    });
    expect(response.body.surfaceBreakdown[0]).toMatchObject({
      surface: "creator_hub",
      impressions: 1,
      clicks: 1,
      previews: 1,
      averageRank: 2,
      bestRank: 2,
    });
    expect(response.body.reasonBreakdown[0]).toMatchObject({
      reason: "popular_now",
      impressions: 1,
      averageRank: 2,
    });
    expect(response.body.actionPrompts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "content_purchase_momentum",
          tone: "success",
        }),
      ])
    );
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

  test("GET /api/download/book/:itemId streams the paid PDF with the manuscript filename", async () => {
    const { profile } = await createUserAndProfile({
      creatorTypes: ["bookPublishing"],
    });
    const { token } = await createViewer();

    const book = await Book.create({
      creatorId: profile._id,
      title: "The Rustle of Death",
      description: "Premium book release",
      price: 0,
      priceNGN: 0,
      contentUrl: toDataUrl("application/pdf", "%PDF-1.4 original manuscript"),
      fileUrl: toDataUrl("application/pdf", "%PDF-1.4 original manuscript"),
      contentMedia: {
        provider: "cloudinary",
        publicId: "tengacion/books/files/ufj4jgvse6wybs1fckoz",
        secureUrl: toDataUrl("application/pdf", "%PDF-1.4 original manuscript"),
        resourceType: "raw",
        format: "pdf",
        originalFilename: "The Rustle of Death.pdf",
      },
      fileFormat: "pdf",
      creatorCategory: "books",
      contentType: "pdf_book",
      publishedStatus: "published",
      isPublished: true,
    });

    const downloadResponse = await request(app)
      .get(`/api/download/book/${book._id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(downloadResponse.body.downloadUrl).toContain("/api/media/delivery/");
    expect(downloadResponse.body.download).toMatchObject({
      filename: "The Rustle of Death.pdf",
      contentType: "application/pdf",
    });

    const downloadPath = new URL(downloadResponse.body.downloadUrl).pathname;
    const pdfResponse = await request(app)
      .get(downloadPath)
      .buffer(true)
      .parse((res, callback) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(pdfResponse.headers["content-type"]).toContain("application/pdf");
    expect(pdfResponse.headers["content-disposition"]).toContain("attachment;");
    expect(pdfResponse.headers["content-disposition"]).toContain("The Rustle of Death.pdf");
    expect(pdfResponse.body.toString("utf8")).toContain("%PDF-1.4 original manuscript");
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
      canResume: false,
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
          canResume: true,
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
      canResume: true,
      canRenew: false,
    });

    const resumeResponse = await request(app)
      .post(`/api/purchases/${purchase._id}/resume-subscription`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({})
      .expect(200);

    expect(resumeResponse.body).toMatchObject({
      success: true,
      alreadyResumed: false,
      purchase: expect.objectContaining({
        status: "paid",
        cancelAtPeriodEnd: false,
        canceledAt: null,
        lifecycle: expect.objectContaining({
          lifecycleStatus: "active",
          canCancel: true,
          canResume: false,
        }),
      }),
    });

    const resumedProfileResponse = await request(app)
      .get(`/api/creator/${profile._id}/public-profile`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);

    expect(resumedProfileResponse.body.subscription).toMatchObject({
      isSubscribed: true,
      lifecycleStatus: "active",
      cancelAtPeriodEnd: false,
      canCancel: true,
      canResume: false,
      canRenew: false,
    });

    await request(app)
      .post(`/api/purchases/${purchase._id}/cancel-subscription`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({})
      .expect(200);

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
      canResume: false,
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
