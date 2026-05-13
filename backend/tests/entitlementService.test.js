const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";

const AnalyticsEvent = require("../models/AnalyticsEvent");
const Entitlement = require("../models/Entitlement");
const Purchase = require("../models/Purchase");
const User = require("../models/User");
const {
  reconcilePaidPurchaseEntitlements,
} = require("../services/entitlementService");

let mongod;

const createBuyer = () =>
  User.create({
    name: "Entitled Fan",
    username: "entitled_fan",
    email: "entitled-fan@example.com",
    password: "Password123!",
    role: "user",
    isVerified: true,
  });

const createPurchase = ({
  userId,
  itemType = "track",
  itemId = new mongoose.Types.ObjectId(),
  status = "paid",
  providerRef,
} = {}) =>
  Purchase.create({
    userId,
    creatorId: new mongoose.Types.ObjectId(),
    itemType,
    itemId,
    amount: 2500,
    priceNGN: 2500,
    currency: "NGN",
    status,
    provider: "paystack",
    providerRef,
    paidAt: status === "paid" ? new Date() : null,
  });

describe("entitlementService", () => {
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

  test("reconciliation backfills paid purchase entitlements idempotently", async () => {
    const buyer = await createBuyer();
    const trackPurchase = await createPurchase({
      userId: buyer._id,
      itemType: "track",
      providerRef: "entitlement_track_ref",
    });
    const bookPurchase = await createPurchase({
      userId: buyer._id,
      itemType: "book",
      providerRef: "entitlement_book_ref",
    });
    await createPurchase({
      userId: buyer._id,
      itemType: "subscription",
      providerRef: "entitlement_subscription_ref",
    });
    await createPurchase({
      userId: buyer._id,
      itemType: "track",
      status: "pending",
      providerRef: "entitlement_pending_ref",
    });

    const firstRun = await reconcilePaidPurchaseEntitlements({ logger: null, reason: "test" });
    expect(firstRun).toMatchObject({
      scannedCount: 2,
      createdCount: 2,
      existingCount: 0,
      skippedCount: 0,
    });

    expect(await Entitlement.countDocuments({ buyerId: buyer._id })).toBe(2);
    await expect(
      Entitlement.findOne({
        buyerId: buyer._id,
        itemType: "track",
        itemId: trackPurchase.itemId,
      })
    ).resolves.toBeTruthy();
    await expect(
      Entitlement.findOne({
        buyerId: buyer._id,
        itemType: "book",
        itemId: bookPurchase.itemId,
      })
    ).resolves.toBeTruthy();

    const grantEvents = await AnalyticsEvent.find({ type: "purchase_entitlement_granted" }).lean();
    expect(grantEvents).toHaveLength(2);
    expect(grantEvents[0].metadata).toMatchObject({
      source: "entitlement_reconciliation",
      reason: "test",
    });

    const secondRun = await reconcilePaidPurchaseEntitlements({ logger: null, reason: "test" });
    expect(secondRun).toMatchObject({
      scannedCount: 2,
      createdCount: 0,
      existingCount: 2,
      skippedCount: 0,
    });
    expect(await Entitlement.countDocuments({ buyerId: buyer._id })).toBe(2);
    expect(await AnalyticsEvent.countDocuments({ type: "purchase_entitlement_granted" })).toBe(2);
  });
});
