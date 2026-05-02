const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { STEP_UP_COOKIE_NAME, signStepUpToken } = require("../services/authTokens");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-paystack-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret_1234567890123456789012";
process.env.PAYSTACK_SECRET_KEY =
  process.env.PAYSTACK_SECRET_KEY || "test_paystack_secret_1234567890";
process.env.PAYSTACK_CALLBACK_URL =
  process.env.PAYSTACK_CALLBACK_URL || "https://tengacion.test/payment/verify";
process.env.PAYSTACK_CURRENCY = process.env.PAYSTACK_CURRENCY || "NGN";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_tengacion";
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_tengacion";

const mockStripeCheckoutCreate = jest.fn();
const mockStripeCheckoutRetrieve = jest.fn();
const mockStripeConstructEvent = jest.fn();

jest.mock("stripe", () =>
  jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: mockStripeCheckoutCreate,
        retrieve: mockStripeCheckoutRetrieve,
      },
    },
    webhooks: {
      constructEvent: mockStripeConstructEvent,
    },
  }))
);

const app = require("../app");
const Book = require("../models/Book");
const CreatorProfile = require("../models/CreatorProfile");
const Entitlement = require("../models/Entitlement");
const Message = require("../models/Message");
const PaymentWebhookEvent = require("../models/PaymentWebhookEvent");
const Purchase = require("../models/Purchase");
const Track = require("../models/Track");
const User = require("../models/User");
const WalletEntry = require("../models/WalletEntry");

let mongod;
const originalFetch = global.fetch;

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
  const user = await User.create({
    name: "Creator Example",
    username: "creator_example",
    email: "creator@example.com",
    password: "Password123!",
    role: "artist",
    isArtist: true,
    isVerified: true,
  });

  const profile = await CreatorProfile.create({
    userId: user._id,
    displayName: "Creator Example",
    fullName: "Creator Example",
    phoneNumber: "08000000000",
    accountNumber: "1234567890",
    country: "Nigeria",
    countryOfResidence: "Nigeria",
    creatorTypes: ["music", "bookPublishing", "podcast"],
    acceptedTerms: true,
    acceptedCopyrightDeclaration: true,
    onboardingCompleted: true,
    onboardingComplete: true,
    status: "active",
    subscriptionPriceGlobal: 6.99,
  });

  return { user, profile };
};

const createViewer = async () => {
  const user = await User.create({
    name: "Viewer Example",
    username: "viewer_example",
    email: "viewer@example.com",
    password: "Password123!",
    role: "user",
    isVerified: true,
  });

  const token = await issueSessionToken(user._id);
  return { user, token };
};

const createAdmin = async () =>
  User.create({
    name: "Tengacion Admin",
    username: "tengacion_admin",
    email: "admin@example.com",
    password: "Password123!",
    role: "admin",
    isVerified: true,
    emailVerified: true,
  });

const mockPaystackResponse = (data) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      status: true,
      data,
    }),
  });
};

const mockPaystackFailure = (message = "Paystack error") => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: async () => ({
      status: false,
      message,
    }),
  });
};

describe("Paystack payments", () => {
  let creator;
  let viewer;
  let viewerToken;
  let creatorToken;
  let track;
  let book;

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
    global.fetch = originalFetch;
    mockStripeCheckoutCreate.mockReset();
    mockStripeCheckoutRetrieve.mockReset();
    mockStripeConstructEvent.mockReset();

    await createAdmin();
    creator = await createCreator();
    creatorToken = await issueSessionToken(creator.user._id);
    ({ user: viewer, token: viewerToken } = await createViewer());

    track = await Track.create({
      creatorId: creator.profile._id,
      title: "Paid Music Track",
      description: "Premium release",
      price: 2500,
      priceNGN: 2500,
      audioUrl: "https://example.com/full-track.mp3",
      previewUrl: "https://example.com/preview-track.mp3",
      previewStartSec: 30,
      previewLimitSec: 30,
      kind: "music",
      creatorCategory: "music",
      contentType: "track",
      publishedStatus: "published",
      isPublished: true,
      priceGlobal: 7.5,
    });

    book = await Book.create({
      creatorId: creator.profile._id,
      title: "Paid Book",
      description: "Premium ebook",
      price: 1800,
      priceNGN: 1800,
      contentUrl: "https://example.com/full-book.pdf",
      previewUrl: "https://example.com/preview-book.pdf",
      creatorCategory: "books",
      contentType: "ebook",
      publishedStatus: "published",
      isPublished: true,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
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

  test("initialize uses the database price and sends the required Paystack channels", async () => {
    mockPaystackResponse({
      authorization_url: "https://paystack.test/authorize",
      access_code: "ACCESS_123",
      reference: "TGN_TRACK_TEST",
    });

    const response = await request(app)
      .post("/api/payments/paystack/initialize")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        productType: "music",
        productId: track._id.toString(),
        price: 1,
      })
      .expect(201);

    expect(response.body).toMatchObject({
      authorization_url: "https://paystack.test/authorize",
      access_code: "ACCESS_123",
    });

    const initCall = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(initCall.amount).toBe(2500 * 100);
    expect(initCall.channels).toEqual(["card", "ussd", "bank_transfer"]);
    expect(initCall.metadata).toMatchObject({
      buyerId: viewer._id.toString(),
      creatorId: creator.profile._id.toString(),
      productId: track._id.toString(),
      productType: "track",
      productTitle: track.title,
    });

    const stored = await Purchase.findOne({ providerRef: response.body.reference }).lean();
    expect(stored).toBeTruthy();
    expect(stored.status).toBe("pending");
    expect(await Entitlement.countDocuments({ buyerId: viewer._id, itemType: "track", itemId: track._id })).toBe(0);
  });

  test("legacy billing purchase route initializes the real Paystack checkout", async () => {
    mockPaystackResponse({
      authorization_url: "https://paystack.test/legacy-purchase",
      access_code: "ACCESS_LEGACY_PURCHASE",
      reference: "TGN_LEGACY_PURCHASE",
    });

    const response = await request(app)
      .post("/api/billing/purchase")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        itemType: "music",
        itemId: track._id.toString(),
      })
      .expect(201);

    expect(response.body).toMatchObject({
      success: true,
      kind: "purchase",
      checkoutUrl: "https://paystack.test/legacy-purchase",
      authorization_url: "https://paystack.test/legacy-purchase",
      access_code: "ACCESS_LEGACY_PURCHASE",
      itemType: "track",
      itemId: track._id.toString(),
      amount: 2500,
      currency: "NGN",
    });

    const stored = await Purchase.findById(response.body.purchaseId).lean();
    expect(stored).toMatchObject({
      itemType: "track",
      status: "pending",
      provider: "paystack",
      amount: 2500,
    });
  });

  test("legacy billing subscribe route initializes creator membership checkout", async () => {
    mockPaystackResponse({
      authorization_url: "https://paystack.test/legacy-subscribe",
      access_code: "ACCESS_LEGACY_SUBSCRIBE",
      reference: "TGN_LEGACY_SUBSCRIBE",
    });

    const response = await request(app)
      .post("/api/billing/subscribe")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        creatorId: creator.profile._id.toString(),
      })
      .expect(201);

    expect(response.body).toMatchObject({
      success: true,
      kind: "subscription",
      checkoutUrl: "https://paystack.test/legacy-subscribe",
      itemType: "subscription",
      itemId: creator.profile._id.toString(),
      amount: 2000,
      currency: "NGN",
    });

    const stored = await Purchase.findById(response.body.purchaseId).lean();
    expect(stored).toMatchObject({
      itemType: "subscription",
      status: "pending",
      billingInterval: "monthly",
    });
    expect(stored.itemId.toString()).toBe(creator.profile._id.toString());
    expect(stored.creatorId.toString()).toBe(creator.profile._id.toString());
  });

  test("legacy billing purchase route initializes Stripe checkout for USD", async () => {
    mockStripeCheckoutCreate.mockImplementation(async (payload) => ({
      id: "cs_test_legacy_purchase",
      url: "https://stripe.test/legacy-purchase",
      amount_total: payload.line_items[0].price_data.unit_amount,
      currency: "usd",
      payment_status: "unpaid",
      status: "open",
      metadata: payload.metadata,
    }));

    const response = await request(app)
      .post("/api/billing/purchase")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        itemType: "music",
        itemId: track._id.toString(),
        currency: "USD",
      })
      .expect(201);

    expect(response.body).toMatchObject({
      success: true,
      kind: "purchase",
      checkoutUrl: "https://stripe.test/legacy-purchase",
      authorization_url: "https://stripe.test/legacy-purchase",
      itemType: "track",
      itemId: track._id.toString(),
      amount: 7.5,
      currency: "USD",
      currencyMode: "GLOBAL",
      purchase: expect.objectContaining({
        provider: "stripe",
        currency: "USD",
        status: "pending",
      }),
    });

    expect(mockStripeCheckoutCreate).toHaveBeenCalledTimes(1);
    const stripePayload = mockStripeCheckoutCreate.mock.calls[0][0];
    expect(stripePayload.line_items[0].price_data).toMatchObject({
      currency: "usd",
      unit_amount: 750,
    });
    expect(stripePayload.metadata).toMatchObject({
      buyerId: viewer._id.toString(),
      creatorId: creator.profile._id.toString(),
      productId: track._id.toString(),
      productType: "track",
      productTitle: track.title,
      currencyMode: "GLOBAL",
    });

    const stored = await Purchase.findById(response.body.purchaseId).lean();
    expect(stored).toMatchObject({
      itemType: "track",
      status: "pending",
      provider: "stripe",
      amount: 7.5,
      currency: "USD",
      providerSessionId: "cs_test_legacy_purchase",
    });
  });

  test("Stripe checkout webhook settles access once and records replay deliveries", async () => {
    mockStripeCheckoutCreate.mockImplementation(async (payload) => ({
      id: "cs_test_webhook_purchase",
      url: "https://stripe.test/webhook-purchase",
      amount_total: payload.line_items[0].price_data.unit_amount,
      currency: "usd",
      payment_status: "unpaid",
      status: "open",
      metadata: payload.metadata,
    }));

    const initResponse = await request(app)
      .post("/api/billing/purchase")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        itemType: "music",
        itemId: track._id.toString(),
        currency: "USD",
      })
      .expect(201);

    const purchase = await Purchase.findById(initResponse.body.purchaseId).lean();
    const stripeSession = {
      id: "cs_test_webhook_purchase",
      amount_total: 750,
      currency: "usd",
      payment_status: "paid",
      status: "complete",
      metadata: {
        providerRef: purchase.providerRef,
        purchaseId: purchase._id.toString(),
      },
    };

    mockStripeConstructEvent.mockReturnValue({
      id: "evt_checkout_paid_once",
      type: "checkout.session.completed",
      data: {
        object: stripeSession,
      },
    });
    mockStripeCheckoutRetrieve.mockResolvedValue(stripeSession);

    await request(app)
      .post("/api/payments/stripe/webhook")
      .set("stripe-signature", "test_signature")
      .send({ id: "evt_checkout_paid_once" })
      .expect(200);

    await request(app)
      .post("/api/payments/stripe/webhook")
      .set("stripe-signature", "test_signature")
      .send({ id: "evt_checkout_paid_once" })
      .expect(200);

    expect(mockStripeConstructEvent).toHaveBeenCalledTimes(2);
    expect(mockStripeCheckoutRetrieve).toHaveBeenCalledTimes(1);

    const stored = await Purchase.findById(purchase._id).lean();
    expect(stored).toMatchObject({
      status: "paid",
      provider: "stripe",
      currency: "USD",
    });
    expect(await Entitlement.countDocuments({ buyerId: viewer._id, itemType: "track", itemId: track._id })).toBe(1);
    expect(await WalletEntry.countDocuments({ sourceId: purchase._id })).toBe(2);

    const webhookEvent = await PaymentWebhookEvent.findOne({
      provider: "stripe",
      eventId: "evt_checkout_paid_once",
    }).lean();
    expect(webhookEvent).toMatchObject({
      status: "processed",
      providerRef: purchase.providerRef,
      duplicateCount: 1,
    });
  });

  test("unauthenticated initialize is rejected", async () => {
    await request(app)
      .post("/api/payments/paystack/initialize")
      .send({
        productType: "music",
        productId: track._id.toString(),
      })
      .expect(401);
  });

  test("verify keeps a purchase pending while Paystack is still processing", async () => {
    mockPaystackResponse({
      authorization_url: "https://paystack.test/authorize",
      access_code: "ACCESS_PENDING",
      reference: "TGN_TRACK_PENDING",
    });

    const initResponse = await request(app)
      .post("/api/payments/paystack/initialize")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        productType: "music",
        productId: track._id.toString(),
      })
      .expect(201);

    mockPaystackResponse({
      id: 1,
      status: "pending",
      reference: initResponse.body.reference,
      amount: 2500 * 100,
      currency: "NGN",
    });

    const verifyResponse = await request(app)
      .get(`/api/payments/paystack/verify/${encodeURIComponent(initResponse.body.reference)}`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);

    expect(verifyResponse.body).toMatchObject({
      success: false,
      verified: false,
      accessGranted: false,
      status: "pending",
    });

    const stored = await Purchase.findOne({ providerRef: initResponse.body.reference }).lean();
    expect(stored.status).toBe("pending");
    expect(await Entitlement.countDocuments({ buyerId: viewer._id, itemType: "track", itemId: track._id })).toBe(0);
  });

  test("verify grants access only when Paystack amount matches the stored amount exactly", async () => {
    mockPaystackResponse({
      authorization_url: "https://paystack.test/authorize",
      access_code: "ACCESS_456",
      reference: "TGN_TRACK_VERIFY",
    });

    const initResponse = await request(app)
      .post("/api/payments/paystack/initialize")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        productType: "music",
        productId: track._id.toString(),
      })
      .expect(201);

    mockPaystackResponse({
      id: 1,
      status: "success",
      reference: initResponse.body.reference,
      amount: 2500 * 100,
      currency: "NGN",
    });

    const verifyResponse = await request(app)
      .get(`/api/payments/paystack/verify/${encodeURIComponent(initResponse.body.reference)}`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);

    expect(verifyResponse.body.accessGranted).toBe(true);
    expect(await Entitlement.countDocuments({ buyerId: viewer._id, itemType: "track", itemId: track._id })).toBe(1);

    const stored = await Purchase.findOne({ providerRef: initResponse.body.reference }).lean();
    expect(stored.status).toBe("paid");

    const walletEntries = await WalletEntry.find({ sourceId: stored._id })
      .sort({ entryType: 1 })
      .lean();
    expect(walletEntries).toHaveLength(2);
    expect(walletEntries.map((entry) => entry.entryType)).toEqual(["platform_fee", "sale_credit"]);

    const salesAlert = await Message.findOne({
      receiverId: creator.user._id,
      isSystem: true,
    }).lean();
    expect(salesAlert).toBeTruthy();
    expect(salesAlert.senderName).toBe("Tengacion Sales");
    expect(String(salesAlert.text || "")).toContain(track.title);
    expect(String(salesAlert.text || "")).toContain("NGN 2,500");

    const dashboardResponse = await request(app)
      .get("/api/creator/dashboard")
      .set("Authorization", `Bearer ${creatorToken}`)
      .expect(200);

    expect(dashboardResponse.body.summary).toMatchObject({
      grossRevenue: 2500,
      totalEarnings: 1000,
      availableBalance: 1000,
      pendingBalance: 0,
      withdrawn: 0,
    });
    expect(dashboardResponse.body.summary.walletBacked).toBe(true);
    expect(dashboardResponse.body.categories.music.earnings).toBe(1000);
    expect(dashboardResponse.body.wallet).toMatchObject({
      walletBacked: true,
      settlementSource: "wallet",
      summary: {
        grossRevenue: 2500,
        totalEarnings: 1000,
        availableBalance: 1000,
        pendingBalance: 0,
        withdrawn: 0,
        walletBacked: true,
      },
    });
    expect(dashboardResponse.body.wallet.breakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "track",
          grossRevenue: 2500,
          creatorEarnings: 1000,
          transactions: 1,
        }),
      ])
    );
    expect(dashboardResponse.body.wallet.recentEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entryType: "sale_credit",
          amount: 1000,
          grossAmount: 2500,
          itemType: "track",
          providerRef: initResponse.body.reference,
        }),
      ])
    );

    const creatorSalesResponse = await request(app)
      .get("/api/purchases/creator/sales")
      .set("Authorization", `Bearer ${creatorToken}`)
      .expect(200);

    expect(creatorSalesResponse.body).toMatchObject({
      totalSalesCount: 1,
      totalRevenue: 2500,
      totalCreatorEarnings: 1000,
      availableBalance: 1000,
      pendingBalance: 0,
      withdrawn: 0,
      walletBacked: true,
      settlementSource: "wallet",
    });
    expect(creatorSalesResponse.body.breakdown.track).toMatchObject({
      count: 1,
      revenue: 2500,
      creatorAmount: 1000,
    });
    expect(creatorSalesResponse.body.recentSales).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entryType: "sale_credit",
          amount: 1000,
          grossAmount: 2500,
          itemType: "track",
          providerRef: initResponse.body.reference,
        }),
      ])
    );
  });

  test("amount mismatch blocks access", async () => {
    mockPaystackResponse({
      authorization_url: "https://paystack.test/authorize",
      access_code: "ACCESS_789",
      reference: "TGN_BOOK_VERIFY",
    });

    const initResponse = await request(app)
      .post("/api/payments/paystack/initialize")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        productType: "book",
        productId: book._id.toString(),
      })
      .expect(201);

    mockPaystackResponse({
      id: 1,
      status: "success",
      reference: initResponse.body.reference,
      amount: (1800 * 100) + 100,
      currency: "NGN",
    });

    await request(app)
      .get(`/api/payments/paystack/verify/${encodeURIComponent(initResponse.body.reference)}`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(400);

    const stored = await Purchase.findOne({ providerRef: initResponse.body.reference }).lean();
    expect(stored.status).toBe("failed");
    expect(await Entitlement.countDocuments({ buyerId: viewer._id, itemType: "book", itemId: book._id })).toBe(0);
  });

  test("verify can still settle an abandoned pending purchase", async () => {
    mockPaystackResponse({
      authorization_url: "https://paystack.test/authorize",
      access_code: "ACCESS_ABANDONED",
      reference: "TGN_TRACK_ABANDONED",
    });

    const initResponse = await request(app)
      .post("/api/payments/paystack/initialize")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        productType: "music",
        productId: track._id.toString(),
      })
      .expect(201);

    await Purchase.updateOne(
      { providerRef: initResponse.body.reference },
      { $set: { status: "abandoned" } }
    );

    mockPaystackResponse({
      id: 1,
      status: "success",
      reference: initResponse.body.reference,
      amount: 2500 * 100,
      currency: "NGN",
    });

    const verifyResponse = await request(app)
      .get(`/api/payments/paystack/verify/${encodeURIComponent(initResponse.body.reference)}`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);

    expect(verifyResponse.body.accessGranted).toBe(true);

    const stored = await Purchase.findOne({ providerRef: initResponse.body.reference }).lean();
    expect(stored.status).toBe("paid");
    expect(await Entitlement.countDocuments({ buyerId: viewer._id, itemType: "track", itemId: track._id })).toBe(1);
  });

  test("duplicate webhook delivery is idempotent", async () => {
    mockPaystackResponse({
      authorization_url: "https://paystack.test/authorize",
      access_code: "ACCESS_WEBHOOK",
      reference: "TGN_TRACK_WEBHOOK",
    });

    const initResponse = await request(app)
      .post("/api/payments/paystack/initialize")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        productType: "music",
        productId: track._id.toString(),
      })
      .expect(201);

    const payload = {
      event: "charge.success",
      data: {
        reference: initResponse.body.reference,
        amount: 2500 * 100,
        currency: "NGN",
      },
    };
    const rawBody = JSON.stringify(payload);
    const signature = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest("hex");

    mockPaystackResponse({
      id: 1,
      status: "success",
      reference: initResponse.body.reference,
      amount: 2500 * 100,
      currency: "NGN",
    });

    await request(app)
      .post("/api/payments/paystack/webhook")
      .set("x-paystack-signature", signature)
      .send(payload)
      .expect(200);

    await request(app)
      .post("/api/payments/paystack/webhook")
      .set("x-paystack-signature", signature)
      .send(payload)
      .expect(200);

    expect(await Entitlement.countDocuments({ buyerId: viewer._id, itemType: "track", itemId: track._id })).toBe(1);

    const updatedTrack = await Track.findById(track._id).lean();
    expect(Number(updatedTrack.purchaseCount || 0)).toBe(1);

    const stored = await Purchase.findOne({ providerRef: initResponse.body.reference }).lean();
    expect(stored.status).toBe("paid");
    expect(await WalletEntry.countDocuments({ sourceId: stored._id })).toBe(2);
    expect(
      await Message.countDocuments({
        receiverId: creator.user._id,
        isSystem: true,
      })
    ).toBe(1);
  });

  test("webhook signature failure is rejected", async () => {
    const payload = {
      event: "charge.success",
      data: {
        reference: "missing-reference",
        amount: 1000,
        currency: "NGN",
      },
    };

    await request(app)
      .post("/api/payments/paystack/webhook")
      .set("x-paystack-signature", "deadbeef")
      .send(payload)
      .expect(401);
  });

  test("admin transaction detail exposes lifecycle events and wallet settlement", async () => {
    const admin = await User.findOne({ role: "admin" }).lean();
    const adminSessionId = new mongoose.Types.ObjectId().toString();
    await User.updateOne(
      { _id: admin._id },
      {
        $push: {
          sessions: {
            sessionId: adminSessionId,
            createdAt: new Date(),
            lastSeenAt: new Date(),
          },
        },
      }
    );
    const adminToken = jwt.sign(
      {
        id: admin._id.toString(),
        tv: 0,
        sid: adminSessionId,
      },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    mockPaystackResponse({
      authorization_url: "https://paystack.test/authorize",
      access_code: "ACCESS_TIMELINE",
      reference: "TGN_TRACK_TIMELINE",
    });

    const initResponse = await request(app)
      .post("/api/payments/paystack/initialize")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        productType: "music",
        productId: track._id.toString(),
      })
      .expect(201);

    mockPaystackResponse({
      id: 1,
      status: "success",
      reference: initResponse.body.reference,
      amount: 2500 * 100,
      currency: "NGN",
    });

    await request(app)
      .get(`/api/payments/paystack/verify/${encodeURIComponent(initResponse.body.reference)}`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);

    const purchase = await Purchase.findOne({ providerRef: initResponse.body.reference }).lean();
    const detailResponse = await request(app)
      .get(`/api/admin/transactions/${purchase._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(detailResponse.body.ops).toMatchObject({
      entitlementPresent: true,
      walletSettled: true,
      needsAttention: false,
    });
    expect(detailResponse.body.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "purchase_checkout_initialized" }),
        expect.objectContaining({ type: "purchase_verification_succeeded" }),
        expect.objectContaining({ kind: "wallet_entry", type: "sale_credit" }),
        expect.objectContaining({ kind: "wallet_entry", type: "platform_fee" }),
      ])
    );
  });

  test("admin reconcile can settle a stuck purchase after step-up", async () => {
    const admin = await User.findOne({ role: "admin" });
    const adminToken = await issueSessionToken(admin._id);
    const adminSession = jwt.verify(adminToken, process.env.JWT_SECRET);
    const stepUpToken = signStepUpToken({
      userId: admin._id,
      sessionId: adminSession.sid,
    });
    const stepUpCookie = `${STEP_UP_COOKIE_NAME}=${stepUpToken}`;

    mockPaystackResponse({
      authorization_url: "https://paystack.test/authorize",
      access_code: "ACCESS_RECONCILE",
      reference: "TGN_TRACK_RECONCILE",
    });

    const initResponse = await request(app)
      .post("/api/payments/paystack/initialize")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        productType: "music",
        productId: track._id.toString(),
      })
      .expect(201);

    const purchase = await Purchase.findOne({ providerRef: initResponse.body.reference });
    await Purchase.updateOne(
      { _id: purchase._id },
      {
        $set: {
          status: "abandoned",
          updatedAt: new Date(Date.now() - (20 * 60 * 1000)),
        },
      }
    );

    mockPaystackResponse({
      id: 1,
      status: "success",
      reference: initResponse.body.reference,
      amount: 2500 * 100,
      currency: "NGN",
    });

    const reconcileResponse = await request(app)
      .post(`/api/admin/transactions/${purchase._id}/reconcile`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("Cookie", stepUpCookie)
      .send({ reason: "jest_reconcile" })
      .expect(200);

    expect(reconcileResponse.body).toMatchObject({
      success: true,
      accessGranted: true,
      transaction: expect.objectContaining({
        status: "paid",
      }),
    });

    expect(await Entitlement.countDocuments({ buyerId: viewer._id, itemType: "track", itemId: track._id })).toBe(1);
    expect(await WalletEntry.countDocuments({ sourceId: purchase._id })).toBe(2);
  });

  test("admin refund reverses wallet settlement and revokes purchase access after step-up", async () => {
    const admin = await User.findOne({ role: "admin" });
    const adminToken = await issueSessionToken(admin._id);
    const adminSession = jwt.verify(adminToken, process.env.JWT_SECRET);
    const stepUpToken = signStepUpToken({
      userId: admin._id,
      sessionId: adminSession.sid,
    });
    const stepUpCookie = `${STEP_UP_COOKIE_NAME}=${stepUpToken}`;

    mockPaystackResponse({
      authorization_url: "https://paystack.test/authorize",
      access_code: "ACCESS_REFUND",
      reference: "TGN_TRACK_REFUND",
    });

    const initResponse = await request(app)
      .post("/api/payments/paystack/initialize")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        productType: "music",
        productId: track._id.toString(),
      })
      .expect(201);

    mockPaystackResponse({
      id: 1,
      status: "success",
      reference: initResponse.body.reference,
      amount: 2500 * 100,
      currency: "NGN",
    });

    await request(app)
      .get(`/api/payments/paystack/verify/${encodeURIComponent(initResponse.body.reference)}`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);

    const purchase = await Purchase.findOne({ providerRef: initResponse.body.reference });
    expect(purchase).toBeTruthy();
    expect(await Entitlement.countDocuments({ buyerId: viewer._id, itemType: "track", itemId: track._id })).toBe(1);
    expect(await WalletEntry.countDocuments({ sourceId: purchase._id })).toBe(2);

    const refundResponse = await request(app)
      .post(`/api/admin/transactions/${purchase._id}/refund`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("Cookie", stepUpCookie)
      .send({ reason: "jest_refund" })
      .expect(200);

    expect(refundResponse.body).toMatchObject({
      success: true,
      transaction: expect.objectContaining({
        status: "refunded",
      }),
    });

    const updatedPurchase = await Purchase.findById(purchase._id).lean();
    expect(updatedPurchase.status).toBe("refunded");
    expect(updatedPurchase.refundedAt).toBeTruthy();
    expect(updatedPurchase.refundReason).toBe("jest_refund");
    expect(await Entitlement.countDocuments({ buyerId: viewer._id, itemType: "track", itemId: track._id })).toBe(0);

    const walletEntries = await WalletEntry.find({ sourceId: purchase._id })
      .sort({ effectiveAt: 1, createdAt: 1, _id: 1 })
      .lean();
    expect(walletEntries).toHaveLength(4);
    expect(walletEntries.filter((entry) => entry.entryType === "refund_debit")).toHaveLength(2);
    expect(walletEntries.filter((entry) => entry.sourceType === "refund")).toHaveLength(2);

    const updatedTrack = await Track.findById(track._id).lean();
    expect(Number(updatedTrack.purchaseCount || 0)).toBe(0);

    const dashboardResponse = await request(app)
      .get("/api/creator/dashboard")
      .set("Authorization", `Bearer ${creatorToken}`)
      .expect(200);

    expect(dashboardResponse.body.summary).toMatchObject({
      totalEarnings: 0,
      availableBalance: 0,
      pendingBalance: 0,
    });

    const detailResponse = await request(app)
      .get(`/api/admin/transactions/${purchase._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(detailResponse.body.ops).toMatchObject({
      entitlementPresent: false,
      walletSettled: true,
      refundEntryCount: 2,
      canRefund: false,
    });
    expect(detailResponse.body.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "purchase_refunded" }),
        expect.objectContaining({ type: "purchase_access_revoked" }),
        expect.objectContaining({ kind: "wallet_entry", type: "refund_debit" }),
      ])
    );
  });
});
