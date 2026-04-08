const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";

const Purchase = require("../models/Purchase");
const {
  runPendingPurchaseCleanup,
  DEFAULT_PENDING_PAYMENT_TTL_MS,
} = require("../services/paymentMaintenanceService");

let mongod;

const makePurchase = (overrides = {}) => ({
  userId: new mongoose.Types.ObjectId(),
  creatorId: new mongoose.Types.ObjectId(),
  itemType: "track",
  itemId: new mongoose.Types.ObjectId(),
  amount: 500,
  priceNGN: 500,
  currency: "NGN",
  provider: "paystack",
  providerRef: `ref_${new mongoose.Types.ObjectId()}`,
  status: "pending",
  ...overrides,
});

describe("paymentMaintenanceService", () => {
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

  test("marks only stale pending purchases as abandoned", async () => {
    const staleCreatedAt = new Date(Date.now() - DEFAULT_PENDING_PAYMENT_TTL_MS - (15 * 60 * 1000));
    const freshCreatedAt = new Date(Date.now() - (15 * 60 * 1000));

    const stale = await Purchase.create(
      makePurchase({
        providerRef: "stale_ref",
        createdAt: staleCreatedAt,
        updatedAt: staleCreatedAt,
      })
    );
    const fresh = await Purchase.create(
      makePurchase({
        providerRef: "fresh_ref",
        createdAt: freshCreatedAt,
        updatedAt: freshCreatedAt,
      })
    );
    const paid = await Purchase.create(
      makePurchase({
        providerRef: "paid_ref",
        status: "paid",
        paidAt: freshCreatedAt,
        createdAt: staleCreatedAt,
        updatedAt: staleCreatedAt,
      })
    );

    const result = await runPendingPurchaseCleanup({ logger: null });

    expect(result).toMatchObject({
      abandonedCount: 1,
      matchedCount: 1,
      olderThanMs: DEFAULT_PENDING_PAYMENT_TTL_MS,
    });

    const [staleUpdated, freshUpdated, paidUpdated] = await Promise.all([
      Purchase.findById(stale._id).lean(),
      Purchase.findById(fresh._id).lean(),
      Purchase.findById(paid._id).lean(),
    ]);

    expect(staleUpdated.status).toBe("abandoned");
    expect(freshUpdated.status).toBe("pending");
    expect(paidUpdated.status).toBe("paid");
  });
});
