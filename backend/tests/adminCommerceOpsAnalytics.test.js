const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-commerce-ops-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "commerce_ops_test_secret_123456789012";

const app = require("../app");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const Entitlement = require("../models/Entitlement");
const PaymentWebhookEvent = require("../models/PaymentWebhookEvent");
const Purchase = require("../models/Purchase");
const User = require("../models/User");

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
    name: "Commerce Ops Admin",
    username: "commerce_ops_admin",
    email: "commerce-ops-admin@test.com",
    password: "Password123!",
    role: "admin",
    isVerified: true,
    emailVerified: true,
  });

  return issueSessionToken(admin._id);
};

const makePurchase = (overrides = {}) => ({
  userId: new mongoose.Types.ObjectId(),
  itemType: "track",
  itemId: new mongoose.Types.ObjectId(),
  amount: 2500,
  priceNGN: 2500,
  currency: "NGN",
  provider: "paystack",
  providerRef: `ops_${new mongoose.Types.ObjectId()}`,
  status: "pending",
  ...overrides,
});

describe("admin commerce operations analytics", () => {
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

  test("summarizes purchases, webhook outcomes, entitlement gaps, and onboarding steps", async () => {
    const adminToken = await createAdminToken();
    const buyerId = new mongoose.Types.ObjectId();
    const itemId = new mongoose.Types.ObjectId();
    const missingEntitlementItemId = new mongoose.Types.ObjectId();
    const now = new Date();

    const paidPurchase = await Purchase.create(
      makePurchase({
        userId: buyerId,
        itemId,
        providerRef: "ops_paid_entitled",
        status: "paid",
        paidAt: now,
      })
    );
    const paidMissingEntitlement = await Purchase.create(
      makePurchase({
        userId: buyerId,
        itemId: missingEntitlementItemId,
        providerRef: "ops_paid_missing_entitlement",
        status: "paid",
        paidAt: now,
      })
    );
    const failedPurchase = await Purchase.create(
      makePurchase({
        userId: buyerId,
        providerRef: "ops_failed_checkout",
        status: "failed",
      })
    );

    await Entitlement.create({
      buyerId,
      itemType: "track",
      itemId,
      grantedAt: now,
    });

    await PaymentWebhookEvent.create([
      {
        provider: "paystack",
        eventId: "ops-webhook-processed",
        eventType: "charge.success",
        providerRef: paidPurchase.providerRef,
        purchaseId: paidPurchase._id,
        payloadHash: "processed-hash",
        status: "processed",
      },
      {
        provider: "stripe",
        eventId: "ops-webhook-failed",
        eventType: "checkout.session.completed",
        providerRef: paidMissingEntitlement.providerRef,
        purchaseId: paidMissingEntitlement._id,
        payloadHash: "failed-hash",
        status: "failed",
        duplicateCount: 2,
        errorMessage: "signature mismatch",
      },
    ]);

    await AnalyticsEvent.create([
      { type: "purchase_record_created", userId: buyerId, targetId: paidPurchase._id, targetType: "purchase", contentType: "track", createdAt: now },
      { type: "purchase_record_created", userId: buyerId, targetId: paidMissingEntitlement._id, targetType: "purchase", contentType: "track", createdAt: now },
      { type: "purchase_record_created", userId: buyerId, targetId: failedPurchase._id, targetType: "purchase", contentType: "track", createdAt: now },
      { type: "purchase_checkout_initialized", userId: buyerId, targetId: paidPurchase._id, targetType: "purchase", contentType: "track", createdAt: now },
      { type: "purchase_checkout_failed", userId: buyerId, targetId: failedPurchase._id, targetType: "purchase", contentType: "track", createdAt: now },
      { type: "purchase_success", userId: buyerId, targetId: paidPurchase._id, targetType: "purchase", contentType: "track", createdAt: now },
      { type: "purchase_failed", userId: buyerId, targetId: failedPurchase._id, targetType: "purchase", contentType: "track", createdAt: now },
      { type: "purchase_webhook_received", userId: buyerId, targetId: paidPurchase._id, targetType: "purchase", contentType: "track", createdAt: now },
      { type: "purchase_webhook_failed", userId: buyerId, targetId: paidMissingEntitlement._id, targetType: "purchase", contentType: "track", createdAt: now },
      { type: "purchase_entitlement_granted", userId: buyerId, targetId: paidPurchase._id, targetType: "purchase", contentType: "track", createdAt: now },
      { type: "creator_onboarding_step_completed", userId: buyerId, targetId: new mongoose.Types.ObjectId(), targetType: "creator_profile", contentType: "account_created", createdAt: now },
      { type: "creator_onboarding_step_completed", userId: buyerId, targetId: new mongoose.Types.ObjectId(), targetType: "creator_profile", contentType: "profile_ready", createdAt: now },
      { type: "creator_onboarding_step_completed", userId: buyerId, targetId: new mongoose.Types.ObjectId(), targetType: "creator_profile", contentType: "first_upload_started", createdAt: now },
    ]);

    const response = await request(app)
      .get("/api/admin/analytics/commerce-ops?range=7d")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.summary).toMatchObject({
      purchaseAttempts: 3,
      checkoutInitialized: 1,
      checkoutFailures: 1,
      successfulPurchases: 2,
      failedPurchases: 1,
      webhookReceived: 2,
      webhookProcessed: 1,
      webhookFailures: 1,
      webhookReplays: 2,
      entitlementEligiblePurchases: 2,
      entitlementGrants: 1,
      entitlementGrantFailures: 1,
      entitlementContinuityRate: 0.5,
      onboardingStepCompletions: 3,
      onboardingStarts: 1,
      profileReady: 1,
      firstUploadStarted: 1,
    });
    expect(response.body.webhooks.statusCounts).toMatchObject({
      processed: 1,
      failed: 1,
    });
    expect(response.body.onboarding.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "account_created", count: 1 }),
        expect.objectContaining({ key: "profile_ready", count: 1 }),
      ])
    );
    expect(response.body.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "entitlement_continuity", severity: "high" }),
      ])
    );
    expect(response.body.series.some((row) => row.purchaseAttempts >= 3)).toBe(true);
  });
});
