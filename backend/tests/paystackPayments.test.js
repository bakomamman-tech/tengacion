const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-paystack-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret_1234567890123456789012";
process.env.PAYSTACK_SECRET_KEY =
  process.env.PAYSTACK_SECRET_KEY || "test_paystack_secret_1234567890";
process.env.PAYSTACK_CALLBACK_URL =
  process.env.PAYSTACK_CALLBACK_URL || "https://tengacion.test/payment/verify";
process.env.PAYSTACK_CURRENCY = process.env.PAYSTACK_CURRENCY || "NGN";

const app = require("../app");
const Book = require("../models/Book");
const CreatorProfile = require("../models/CreatorProfile");
const Entitlement = require("../models/Entitlement");
const Message = require("../models/Message");
const Purchase = require("../models/Purchase");
const Track = require("../models/Track");
const User = require("../models/User");

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

    await createAdmin();
    creator = await createCreator();
    ({ user: viewer, token: viewerToken } = await createViewer());

    track = await Track.create({
      creatorId: creator.profile._id,
      title: "Paid Music Track",
      description: "Premium release",
      price: 2500,
      audioUrl: "https://example.com/full-track.mp3",
      previewUrl: "https://example.com/preview-track.mp3",
      previewStartSec: 30,
      previewLimitSec: 30,
      kind: "music",
      creatorCategory: "music",
      contentType: "track",
      publishedStatus: "published",
      isPublished: true,
    });

    book = await Book.create({
      creatorId: creator.profile._id,
      title: "Paid Book",
      description: "Premium ebook",
      price: 1800,
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

  test("unauthenticated initialize is rejected", async () => {
    await request(app)
      .post("/api/payments/paystack/initialize")
      .send({
        productType: "music",
        productId: track._id.toString(),
      })
      .expect(401);
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

    const salesAlert = await Message.findOne({
      receiverId: creator.user._id,
      isSystem: true,
    }).lean();
    expect(salesAlert).toBeTruthy();
    expect(salesAlert.senderName).toBe("Tengacion Sales");
    expect(String(salesAlert.text || "")).toContain(track.title);
    expect(String(salesAlert.text || "")).toContain("NGN 2,500");
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
});
