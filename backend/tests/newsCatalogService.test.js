const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "12345678901234567890123456789012";
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "12345678901234567890123456789012";

require("../config/env");

const NewsSource = require("../models/NewsSource");
const { repairNewsSourceIndexes } = require("../services/newsCatalogService");

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

describe("newsCatalogService", () => {
  test("drops the legacy parallel-array index and keeps source upserts working", async () => {
    await NewsSource.createCollection();
    await NewsSource.collection.createIndex({ countries: 1, states: 1 }, { background: true });

    await repairNewsSourceIndexes({
      logger: {
        log: () => {},
      },
    });

    const indexes = await NewsSource.collection.indexes();
    expect(indexes.some((index) => index.name === "countries_1_states_1")).toBe(false);
    expect(indexes.some((index) => index.name === "countries_1")).toBe(true);
    expect(indexes.some((index) => index.name === "states_1")).toBe(true);

    await expect(
      NewsSource.findOneAndUpdate(
        { slug: "channels-tv" },
        {
          $set: {
            slug: "channels-tv",
            displayName: "Channels TV",
            publisherName: "Channels TV",
            providerType: "partner_rss",
            publisherTier: "partner",
            sourceType: "publisher",
            countries: ["Nigeria"],
            states: ["Lagos", "FCT"],
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    ).resolves.toBeTruthy();
  });
});
