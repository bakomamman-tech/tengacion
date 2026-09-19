const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/tengaagent-checkout-reuse-test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "tengaagent-checkout-reuse-test-secret-not-for-production";

const mockFindOwnerWorkspace = jest.fn();
const mockGeneratePaymentReference = jest.fn();
const mockInitializeTransaction = jest.fn();
const mockCreateCheckoutSession = jest.fn();
const mockGenerateStripeReference = jest.fn();

jest.mock("../services/tengaAgent/ownerWorkspaceService", () => ({
  findOwnerWorkspace: (...args) => mockFindOwnerWorkspace(...args),
}));

jest.mock("../services/paystackService", () => ({
  generatePaymentReference: (...args) => mockGeneratePaymentReference(...args),
  initializeTransaction: (...args) => mockInitializeTransaction(...args),
  validateWebhookSignature: jest.fn(() => true),
  verifyTransaction: jest.fn(),
}));

jest.mock("../services/stripeService", () => ({
  constructWebhookEvent: jest.fn(),
  createCheckoutSession: (...args) => mockCreateCheckoutSession(...args),
  generateStripeReference: (...args) => mockGenerateStripeReference(...args),
  retrieveCheckoutSession: jest.fn(),
}));

require("../../apps/api/config/env");

const Agent = require("../models/tengaAgent/Agent");
const BillingCheckout = require("../models/tengaAgent/BillingCheckout");
const Subscription = require("../models/tengaAgent/Subscription");
const {
  PENDING_CHECKOUT_REUSE_MINUTES,
  initializeOwnerPlanCheckout,
} = require("../services/tengaAgent/subscriptionCheckoutService");

let mongod;
let organizationId;
let userId;
let referenceCounter;

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
  await Promise.all([
    Agent.deleteMany({}),
    BillingCheckout.deleteMany({}),
    Subscription.deleteMany({}),
  ]);

  organizationId = new mongoose.Types.ObjectId();
  userId = new mongoose.Types.ObjectId();
  referenceCounter = 0;

  mockFindOwnerWorkspace.mockReset();
  mockGeneratePaymentReference.mockReset();
  mockInitializeTransaction.mockReset();
  mockCreateCheckoutSession.mockReset();
  mockGenerateStripeReference.mockReset();

  mockFindOwnerWorkspace.mockResolvedValue({
    organization: {
      _id: organizationId,
      countryCode: "NG",
    },
  });
  mockGeneratePaymentReference.mockImplementation(() => {
    referenceCounter += 1;
    return `tengaagent-reuse-paystack-${referenceCounter}`;
  });
  mockGenerateStripeReference.mockImplementation(() => {
    referenceCounter += 1;
    return `tengaagent-reuse-stripe-${referenceCounter}`;
  });
  mockInitializeTransaction.mockResolvedValue({
    authorization_url: "https://checkout.example/paystack/reusable",
  });
  mockCreateCheckoutSession.mockResolvedValue({
    id: "cs_tengaagent_reusable",
    url: "https://checkout.example/stripe/reusable",
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

describe("TengaAgent checkout reuse", () => {
  it("reuses a recent Paystack checkout instead of creating a duplicate payment attempt", async () => {
    const first = await initializeOwnerPlanCheckout({
      userId,
      userEmail: "owner@example.com",
      planCode: "starter",
      currency: "NGN",
    });
    const second = await initializeOwnerPlanCheckout({
      userId,
      userEmail: "owner@example.com",
      planCode: "starter",
      currency: "NGN",
    });

    expect(first.reused).toBe(false);
    expect(second.reused).toBe(true);
    expect(second.checkout.reference).toBe(first.checkout.reference);
    expect(second.checkout.checkoutUrl).toBe(first.checkout.checkoutUrl);
    expect(mockInitializeTransaction).toHaveBeenCalledTimes(1);
    expect(mockGeneratePaymentReference).toHaveBeenCalledTimes(1);
    expect(await BillingCheckout.countDocuments({})).toBe(1);

    const persisted = await BillingCheckout.findOne({}).select(
      "+providerCheckoutUrl"
    );
    expect(persisted.providerCheckoutUrl).toBe(
      "https://checkout.example/paystack/reusable"
    );
  });

  it("reuses a recent Stripe checkout without creating another Stripe session", async () => {
    const first = await initializeOwnerPlanCheckout({
      userId,
      userEmail: "owner@example.com",
      planCode: "starter",
      currency: "USD",
    });
    const second = await initializeOwnerPlanCheckout({
      userId,
      userEmail: "owner@example.com",
      planCode: "starter",
      currency: "USD",
    });

    expect(first.reused).toBe(false);
    expect(second.reused).toBe(true);
    expect(second.checkout.reference).toBe(first.checkout.reference);
    expect(mockCreateCheckoutSession).toHaveBeenCalledTimes(1);
    expect(mockGenerateStripeReference).toHaveBeenCalledTimes(1);
    expect(await BillingCheckout.countDocuments({})).toBe(1);
  });

  it("creates a fresh checkout when the previous pending URL is outside the reuse window", async () => {
    const stale = await BillingCheckout.create({
      organizationId,
      requestedByUserId: userId,
      planCode: "starter",
      provider: "paystack",
      currency: "NGN",
      amount: 19900,
      reference: "tengaagent-stale-reference",
      providerCheckoutUrl: "https://checkout.example/paystack/stale",
      status: "pending",
    });

    const staleCreatedAt = new Date(
      Date.now() - (PENDING_CHECKOUT_REUSE_MINUTES + 1) * 60 * 1000
    );
    await BillingCheckout.collection.updateOne(
      { _id: stale._id },
      { $set: { createdAt: staleCreatedAt } }
    );

    const result = await initializeOwnerPlanCheckout({
      userId,
      userEmail: "owner@example.com",
      planCode: "starter",
      currency: "NGN",
    });

    expect(result.reused).toBe(false);
    expect(result.checkout.reference).not.toBe("tengaagent-stale-reference");
    expect(mockInitializeTransaction).toHaveBeenCalledTimes(1);
    expect(await BillingCheckout.countDocuments({})).toBe(2);
  });

  it("fails the pending record when Paystack does not return a checkout URL", async () => {
    mockInitializeTransaction.mockResolvedValueOnce({});

    await expect(
      initializeOwnerPlanCheckout({
        userId,
        userEmail: "owner@example.com",
        planCode: "starter",
        currency: "NGN",
      })
    ).rejects.toMatchObject({
      code: "TENGAAGENT_PAYSTACK_CHECKOUT_URL_MISSING",
      status: 502,
    });

    const checkout = await BillingCheckout.findOne({});
    expect(checkout.status).toBe("failed");
    expect(checkout.failureCode).toBe(
      "TENGAAGENT_PAYSTACK_CHECKOUT_URL_MISSING"
    );
  });
});
