const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "12345678901234567890123456789012";
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "12345678901234567890123456789012";

require("../../apps/api/config/env");

const newsRoutes = require("../routes/news.routes");
const errorHandler = require("../../apps/api/middleware/errorHandler");
const NewsCluster = require("../models/NewsCluster");
const NewsSource = require("../models/NewsSource");
const NewsStory = require("../models/NewsStory");

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create({
    instance: { launchTimeout: 60000 },
  });
  await mongoose.connect(mongod.getUri(), {
    serverSelectionTimeoutMS: 60000,
    socketTimeoutMS: 60000,
  });

  app = express();
  app.use(express.json());
  app.use("/api/news", newsRoutes);
  app.use(errorHandler);
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();

  const source = await NewsSource.create({
    slug: "reuters",
    displayName: "Reuters",
    publisherName: "Reuters",
    providerType: "reuters",
    publisherTier: "licensed",
    sourceType: "wire",
    homepageUrl: "https://www.reuters.com",
    canonicalDomain: "reuters.com",
    trustScore: 0.92,
    attribution: {
      displayName: "Reuters",
      attributionRequired: true,
      canonicalLinkRequired: true,
    },
  });

  const story = await NewsStory.create({
    sourceId: source._id,
    sourceSlug: source.slug,
    externalId: "story-1",
    sourceUrlKey: "story-1",
    title: "Lagos adds new early-morning bus routes",
    normalizedTitle: "lagos adds new early morning bus routes",
    subtitle: "Transit upgrade targets workers and students",
    bodyHtml: "<p>Full text should not render here.</p>",
    summaryText: "Transit upgrade targets workers and students in Lagos.",
    canonicalUrl: "https://www.reuters.com/world/africa/lagos-transit-2026-03-20/",
    publishedAt: new Date(),
    authorByline: "Reuters Staff",
    articleType: "report",
    topicTags: ["lagos", "transport"],
    namedEntities: ["Lagos"],
    geography: {
      scope: "local",
      countries: ["Nigeria"],
      states: ["Lagos"],
      primaryCountry: "Nigeria",
      primaryState: "Lagos",
      relevanceScore: 0.94,
    },
    rights: {
      mode: "SUMMARY_PLUS_LINKOUT",
      attributionRequired: true,
      canonicalLinkRequired: true,
      allowBodyHtml: false,
      allowSummary: true,
      allowThumbnail: true,
      allowEmbed: false,
    },
    moderation: {
      status: "approved",
      trustScore: 0.92,
      sourceTrustScore: 0.92,
    },
    scoring: {
      finalScore: 0.88,
      importanceScore: 0.82,
      freshnessScore: 0.9,
      localRelevanceScore: 0.94,
    },
  });

  const cluster = await NewsCluster.create({
    representativeStoryId: story._id,
    storyIds: [story._id],
    title: story.title,
    summary: story.summaryText,
    topicTags: story.topicTags,
    geography: story.geography,
    articleType: story.articleType,
    storyCount: 1,
    sourceCount: 1,
    sourceSlugs: [story.sourceSlug],
    importanceScore: 0.82,
    freshnessScore: 0.9,
    coverageDiversityScore: 0.16,
    rights: story.rights,
    moderation: story.moderation,
    scoring: {
      finalScore: 0.88,
      importanceScore: 0.82,
      freshnessScore: 0.9,
      localRelevanceScore: 0.94,
      sourceTrustScore: 0.92,
      coverageDiversityScore: 0.16,
      engagementScore: 0.2,
    },
    lastPublishedAt: story.publishedAt,
    clusteringKey: "cluster-1",
  });

  await NewsStory.updateOne({ _id: story._id }, { $set: { clusterId: cluster._id } });
});

afterAll(async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
    }
  } finally {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  }
});

describe("GET /api/news/feed", () => {
  test("returns a rights-aware news payload", async () => {
    const response = await request(app).get("/api/news/feed?tab=for-you").expect(200);

    expect(response.body).toMatchObject({
      tab: "for-you",
      cards: [
        expect.objectContaining({
          cardType: "story",
          topicTags: expect.arrayContaining(["lagos", "transport"]),
          representativeStory: expect.objectContaining({
            title: "Lagos adds new early-morning bus routes",
            summaryText: "Transit upgrade targets workers and students in Lagos.",
            bodyHtml: "",
            display: expect.objectContaining({
              canRenderFullText: false,
              linkOutOnly: true,
            }),
            source: expect.objectContaining({
              slug: "reuters",
              displayName: "Reuters",
            }),
          }),
        }),
      ],
    });
  });
});
