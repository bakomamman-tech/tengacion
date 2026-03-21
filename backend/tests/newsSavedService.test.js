const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "12345678901234567890123456789012";
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "12345678901234567890123456789012";

require("../config/env");

const NewsSource = require("../models/NewsSource");
const NewsStory = require("../models/NewsStory");
const User = require("../models/User");
const {
  getSavedArticleIdsForUser,
  removeSavedNewsArticleForUser,
  saveNewsArticleForUser,
} = require("../services/newsSavedService");

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create({
    instance: { launchTimeout: 60000 },
  });
  await mongoose.connect(mongod.getUri(), {
    serverSelectionTimeoutMS: 60000,
    socketTimeoutMS: 60000,
  });
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

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
});

describe("newsSavedService", () => {
  test("saves and removes a news article for a user", async () => {
    const user = await User.create({
      name: "News Reader",
      username: "news_reader",
      email: "reader@example.com",
      password: "Password123!",
    });

    const source = await NewsSource.create({
      slug: "reuters",
      displayName: "Reuters",
      publisherName: "Reuters",
      providerType: "reuters",
      publisherTier: "licensed",
      sourceType: "wire",
      trustScore: 0.92,
    });

    const story = await NewsStory.create({
      sourceId: source._id,
      sourceSlug: source.slug,
      externalId: "story-1",
      sourceUrlKey: "story-1",
      title: "Lagos adds new early-morning bus routes",
      normalizedTitle: "lagos adds new early morning bus routes",
      summaryText: "Transit upgrade targets workers and students in Lagos.",
      canonicalUrl: "https://www.reuters.com/world/africa/lagos-transit-2026-03-20/",
      publishedAt: new Date(),
      articleType: "report",
      topicTags: ["lagos", "transport"],
      geography: {
        scope: "local",
        countries: ["Nigeria"],
        states: ["Lagos"],
        primaryCountry: "Nigeria",
        primaryState: "Lagos",
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
    });

    await saveNewsArticleForUser({
      userId: user._id,
      articleId: story._id,
    });

    const savedIds = await getSavedArticleIdsForUser(user._id);
    expect(savedIds.has(String(story._id))).toBe(true);

    const removed = await removeSavedNewsArticleForUser({
      userId: user._id,
      articleId: story._id,
    });
    expect(removed).toBe(true);

    const remainingSavedIds = await getSavedArticleIdsForUser(user._id);
    expect(remainingSavedIds.has(String(story._id))).toBe(false);
  });
});
