const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-marketplace-test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret_1234567890123456789012";
process.env.PAYSTACK_SECRET_KEY =
  process.env.PAYSTACK_SECRET_KEY || "test_paystack_secret_1234567890";
process.env.PAYSTACK_CALLBACK_URL =
  process.env.PAYSTACK_CALLBACK_URL || "https://tengacion.test/marketplace/orders";
process.env.PAYSTACK_CURRENCY = process.env.PAYSTACK_CURRENCY || "NGN";

const app = require("../app");
const MarketplaceOrder = require("../models/MarketplaceOrder");
const MarketplacePayout = require("../models/MarketplacePayout");
const MarketplaceProduct = require("../models/MarketplaceProduct");
const MarketplaceSeller = require("../models/MarketplaceSeller");
const User = require("../models/User");
const { PLATFORM_FEE_NGN } = require("../services/marketplaceFeeService");
const { validateProductPayload } = require("../validators/marketplaceValidators");

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

const createUser = async ({
  name,
  username,
  email,
  role = "user",
  isArtist = false,
} = {}) => {
  const user = await User.create({
    name,
    username,
    email,
    password: "Password123!",
    role,
    isArtist,
    isVerified: true,
    emailVerified: true,
  });

  const token = await issueSessionToken(user._id);
  return { user, token };
};

const createSellerProfile = async ({
  userId,
  storeName,
  status = "approved",
  state = "Lagos",
  city = "Ikeja",
  cacUrl = "https://example.com/cac.pdf",
} = {}) =>
  MarketplaceSeller.create({
    user: userId,
    fullName: `${storeName} Owner`,
    storeName,
    slug: storeName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    phoneNumber: "08012345678",
    bankName: "Access Bank",
    accountNumber: "0123456789",
    accountName: `${storeName} Ventures`,
    residentialAddress: "12 Admiralty Way, Lekki",
    businessAddress: "44 Warehouse Road, Yaba",
    state,
    city,
    cacCertificate: {
      publicId: "cac-file",
      url: cacUrl,
      originalName: "cac.pdf",
      mimeType: "application/pdf",
      provider: "gridfs",
    },
    status,
    isActive: status !== "suspended",
  });

const createProduct = async ({
  sellerId,
  title,
  price = 5000,
  stock = 8,
  state = "Lagos",
  city = "Ikeja",
  deliveryOptions = ["pickup", "nationwide_delivery"],
  isPublished = true,
  isHidden = false,
  moderationStatus = "approved",
} = {}) =>
  MarketplaceProduct.create({
    seller: sellerId,
    title,
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    description: `${title} description`,
    images: [
      {
        publicId: `${title}-image`,
        url: `https://example.com/${encodeURIComponent(title)}.jpg`,
        secureUrl: `https://example.com/${encodeURIComponent(title)}.jpg`,
        resourceType: "image",
        type: "image",
      },
    ],
    category: "Fashion",
    price,
    currency: "NGN",
    stock,
    condition: "new",
    state,
    city,
    deliveryOptions,
    deliveryNotes: "Same-day dispatch available",
    isPublished,
    isHidden,
    moderationStatus,
  });

const mockFetchJson = (payload, { ok = true } = {}) => ({
  ok,
  json: async () => payload,
});

describe("Marketplace routes", () => {
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
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  afterAll(async () => {
    try {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.dropDatabase();
      }
    } catch {
      // ignore cleanup failures
    } finally {
      await mongoose.disconnect().catch(() => null);
      if (mongod) {
        await mongod.stop();
      }
    }
  });

  test("public storefront hides sensitive seller fields while admin detail exposes secure verification data", async () => {
    const { user: sellerUser } = await createUser({
      name: "Seller Owner",
      username: "seller_owner",
      email: "seller-owner@example.com",
    });
    const { token: buyerToken } = await createUser({
      name: "Buyer Viewer",
      username: "buyer_viewer",
      email: "buyer-viewer@example.com",
    });
    const { token: adminToken } = await createUser({
      name: "Admin User",
      username: "admin_user",
      email: "admin-user@example.com",
      role: "admin",
    });

    const seller = await createSellerProfile({
      userId: sellerUser._id,
      storeName: "Prime Wares",
    });

    const publicResponse = await request(app).get(`/api/marketplace/store/${seller.slug}`);
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.body.seller.storeName).toBe("Prime Wares");
    expect(publicResponse.body.seller.bankName).toBeUndefined();
    expect(publicResponse.body.seller.accountNumber).toBeUndefined();
    expect(publicResponse.body.seller.cacCertificate).toBeUndefined();

    const forbiddenResponse = await request(app)
      .get(`/api/admin/marketplace/sellers/${seller._id.toString()}`)
      .set("Authorization", `Bearer ${buyerToken}`);
    expect(forbiddenResponse.status).toBe(403);

    const adminResponse = await request(app)
      .get(`/api/admin/marketplace/sellers/${seller._id.toString()}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.seller.bankName).toBe("Access Bank");
    expect(adminResponse.body.seller.accountNumber).toBe("0123456789");
    expect(adminResponse.body.seller.cacCertificate.hasFile).toBe(true);
    expect(adminResponse.body.seller.cacCertificate.secureUrl).toContain("/api/media/delivery/");
  });

  test("pending sellers cannot publish marketplace listings", async () => {
    const { user: sellerUser, token } = await createUser({
      name: "Pending Seller",
      username: "pending_seller",
      email: "pending-seller@example.com",
    });

    await createSellerProfile({
      userId: sellerUser._id,
      storeName: "Pending Store",
      status: "pending_review",
    });

    const product = await createProduct({
      sellerId: new mongoose.Types.ObjectId(),
      title: "Hidden Draft Listing",
      isPublished: false,
    });

    const response = await request(app)
      .patch(`/api/marketplace/products/${product._id.toString()}/publish`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/approved sellers/i);
  });

  test("product validation enforces the minimum NGN 300 listing price", () => {
    const result = validateProductPayload({
      payload: {
        title: "Budget Item",
        description: "Affordable item",
        category: "Fashion",
        price: 299,
        stock: 3,
        condition: "new",
        state: "Lagos",
        city: "Ikeja",
        deliveryOptions: ["pickup"],
      },
      files: [{ originalname: "item.jpg" }],
      requireImages: true,
      hasExistingImages: false,
    });

    expect(result.errors).toContain("Product price must be at least NGN 300");
  });

  test("marketplace feed supports location and delivery filters", async () => {
    const { user: sellerUserA } = await createUser({
      name: "Lagos Seller",
      username: "lagos_seller",
      email: "lagos-seller@example.com",
    });
    const { user: sellerUserB } = await createUser({
      name: "Abuja Seller",
      username: "abuja_seller",
      email: "abuja-seller@example.com",
    });

    const lagosSeller = await createSellerProfile({
      userId: sellerUserA._id,
      storeName: "Lagos Couture",
      state: "Lagos",
      city: "Lekki",
    });
    const abujaSeller = await createSellerProfile({
      userId: sellerUserB._id,
      storeName: "Abuja Outfitters",
      state: "FCT",
      city: "Abuja",
    });

    await createProduct({
      sellerId: lagosSeller._id,
      title: "Lagos Pickup Bag",
      state: "Lagos",
      city: "Lekki",
      deliveryOptions: ["pickup"],
    });
    await createProduct({
      sellerId: abujaSeller._id,
      title: "Abuja Nationwide Bag",
      state: "FCT",
      city: "Abuja",
      deliveryOptions: ["nationwide_delivery"],
    });

    const response = await request(app)
      .get("/api/marketplace/products")
      .query({
        state: "Lagos",
        deliveryOption: "pickup",
      });

    expect(response.status).toBe(200);
    expect(response.body.products).toHaveLength(1);
    expect(response.body.products[0].title).toBe("Lagos Pickup Bag");
    expect(response.body.products[0].location.state).toBe("Lagos");
    expect(response.body.products[0].deliveryOptions).toEqual(["pickup"]);
  });

  test("paystack initialization and verification keep the buyer price intact, enforce the flat fee, and create payout records", async () => {
    const { user: sellerUser } = await createUser({
      name: "Approved Seller",
      username: "approved_seller",
      email: "approved-seller@example.com",
    });
    const { token: buyerToken } = await createUser({
      name: "Marketplace Buyer",
      username: "marketplace_buyer",
      email: "marketplace-buyer@example.com",
    });

    const seller = await createSellerProfile({
      userId: sellerUser._id,
      storeName: "Prime Gadgets",
    });
    const product = await createProduct({
      sellerId: seller._id,
      title: "Gaming Headset",
      price: 5000,
      stock: 4,
      deliveryOptions: ["pickup", "nationwide_delivery"],
    });

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        mockFetchJson({
          status: true,
          data: {
            authorization_url: "https://paystack.test/authorize-marketplace",
            access_code: "ACCESS_MARKETPLACE_123",
            reference: "TGN_MARKETPLACE_TEST_123",
          },
        })
      )
      .mockResolvedValueOnce(
        mockFetchJson({
          status: true,
          data: {
            amount: 500000,
            currency: "NGN",
            status: "success",
            reference: "TGN_MARKETPLACE_TEST_123",
          },
        })
      );

    const initializeResponse = await request(app)
      .post("/api/marketplace/orders/initialize")
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({
        productId: product._id.toString(),
        quantity: 1,
        deliveryMethod: "nationwide_delivery",
        deliveryAddress: "77 Admiralty Way, Lekki",
        deliveryContactPhone: "08012345678",
        returnUrl: "/marketplace/orders",
      });

    expect(initializeResponse.status).toBe(201);
    expect(initializeResponse.body.authorizationUrl).toBe(
      "https://paystack.test/authorize-marketplace"
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/transaction/initialize"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"amount":500000'),
      })
    );

    const storedPendingOrder = await MarketplaceOrder.findOne({
      paymentReference: "TGN_MARKETPLACE_TEST_123",
    }).lean();
    expect(storedPendingOrder).toBeTruthy();
    expect(storedPendingOrder.totalPrice).toBe(5000);
    expect(storedPendingOrder.platformFee).toBe(PLATFORM_FEE_NGN);
    expect(storedPendingOrder.sellerReceivable).toBe(4700);

    const verifyResponse = await request(app)
      .post("/api/marketplace/orders/verify")
      .set("Authorization", `Bearer ${buyerToken}`)
      .send({
        reference: "TGN_MARKETPLACE_TEST_123",
      });

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.success).toBe(true);
    expect(verifyResponse.body.verified).toBe(true);
    expect(verifyResponse.body.order.totalPrice).toBe(5000);
    expect(verifyResponse.body.order.platformFee).toBe(PLATFORM_FEE_NGN);
    expect(verifyResponse.body.order.sellerReceivable).toBe(4700);
    expect(verifyResponse.body.order.paymentStatus).toBe("paid");
    expect(verifyResponse.body.order.orderStatus).toBe("paid");

    const paidOrder = await MarketplaceOrder.findOne({
      paymentReference: "TGN_MARKETPLACE_TEST_123",
    }).lean();
    expect(paidOrder.paymentStatus).toBe("paid");
    expect(paidOrder.platformFee).toBe(PLATFORM_FEE_NGN);
    expect(paidOrder.sellerReceivable).toBe(paidOrder.totalPrice - PLATFORM_FEE_NGN);

    const payout = await MarketplacePayout.findOne({ order: paidOrder._id }).lean();
    expect(payout).toBeTruthy();
    expect(payout.grossAmount).toBe(5000);
    expect(payout.platformFee).toBe(PLATFORM_FEE_NGN);
    expect(payout.netAmount).toBe(4700);
    expect(payout.payoutStatus).toBe("pending");
  });
});
