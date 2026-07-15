const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const TAX_ENV_KEYS = [
  "ARTIST_MUSIC_TAX_ENABLED",
  "ARTIST_MUSIC_TAX_RATE_BPS",
  "ARTIST_MUSIC_TAX_PRICE_MODE",
  "ARTIST_MUSIC_TAX_EFFECTIVE_AT",
  "ARTIST_MUSIC_TAX_CURRENCIES",
  "ARTIST_MUSIC_TAX_JURISDICTION",
];
const originalTaxEnv = Object.fromEntries(
  TAX_ENV_KEYS.map((key) => [key, process.env[key]])
);

process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-tax-payment-test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test_secret_1234567890123456789012";
process.env.PAYSTACK_SECRET_KEY = "sk_test_tax_payment_integration_1234567890";
process.env.PAYSTACK_CALLBACK_URL = "https://tengacion.test/payment/verify";
process.env.PAYSTACK_CURRENCY = "NGN";
process.env.ARTIST_MUSIC_TAX_ENABLED = "true";
process.env.ARTIST_MUSIC_TAX_RATE_BPS = "750";
process.env.ARTIST_MUSIC_TAX_PRICE_MODE = "inclusive";
process.env.ARTIST_MUSIC_TAX_EFFECTIVE_AT = "2000-01-01T00:00:00.000Z";
process.env.ARTIST_MUSIC_TAX_CURRENCIES = "NGN";
process.env.ARTIST_MUSIC_TAX_JURISDICTION = "NG";

jest.mock("../services/creatorSalesMessengerService", () => ({
  sendCreatorPurchaseMessengerAlert: jest.fn().mockResolvedValue({
    sent: false,
    skipped: true,
    reason: "test",
  }),
}));

jest.mock("../services/fanReturnPathService", () => ({
  notifyPurchaseUnlocked: jest.fn().mockResolvedValue({
    sent: false,
    skipped: true,
    reason: "test",
  }),
}));

jest.mock("../services/purchaseConfirmationService", () => ({
  sendPurchaseConfirmationEmail: jest.fn().mockResolvedValue({
    sent: false,
    skipped: true,
    reason: "test",
  }),
}));

const Purchase = require("../models/Purchase");
const Track = require("../models/Track");
const User = require("../models/User");
const {
  CONFIGURED_ARTIST_MUSIC_TAX_POLICY,
  PROVIDER_REPORTED_TAX_POLICY,
} = require("../services/artistSaleTaxService");
const {
  initializePaystackCheckout,
  reconcilePurchase,
} = require("../services/paymentOpsService");

const originalFetch = global.fetch;
let mongod;
let buyer;
let track;

const providerResponse = (data) => ({
  ok: true,
  json: async () => ({ status: true, data }),
});

const startCheckout = async () => {
  let initializeBody = null;
  global.fetch = jest.fn(async (_url, options = {}) => {
    initializeBody = JSON.parse(options.body || "{}");
    return providerResponse({
      id: `paystack-init-${Date.now()}`,
      authorization_url: "https://checkout.paystack.test/tax",
      access_code: "tax_access_code",
      reference: initializeBody.reference,
    });
  });

  const result = await initializePaystackCheckout({
    userId: buyer._id,
    productType: "track",
    productId: track._id,
    returnUrl: "https://tengacion.test/payment/verify",
  });

  return { ...result, initializeBody };
};

const settleThroughPaystack = async (
  purchase,
  { taxAmountMinor, feeAmountMinor = 25000 } = {}
) => {
  const gatewayData = {
    status: "success",
    amount: Math.round(Number(purchase.amount) * 100),
    currency: "NGN",
    reference: purchase.providerRef,
    fees: feeAmountMinor,
    paid_at: "2026-07-15T12:00:00.000Z",
  };
  if (taxAmountMinor !== undefined) {
    gatewayData.tax_amount = taxAmountMinor;
  }

  global.fetch = jest.fn().mockResolvedValue(providerResponse(gatewayData));
  return reconcilePurchase({ purchase });
};

describe("artist sales tax payment integration", () => {
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
    buyer = await User.create({
      name: "Tax Test Buyer",
      username: "tax_test_buyer",
      email: "tax-buyer@example.com",
      password: "Password123!",
      role: "user",
      isVerified: true,
    });
    track = await Track.create({
      creatorId: new mongoose.Types.ObjectId(),
      title: "Tax Snapshot Song",
      description: "Integration fixture",
      price: 10000,
      priceNGN: 10000,
      audioUrl: "https://example.com/tax-song.mp3",
      kind: "music",
      creatorCategory: "music",
      contentType: "track",
      publishedStatus: "published",
      isPublished: true,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
    TAX_ENV_KEYS.forEach((key) => {
      if (originalTaxEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalTaxEnv[key];
      }
    });
  });

  test("charges the snapshotted total and persists the configured inclusive tax", async () => {
    const { purchase, initializeBody } = await startCheckout();
    const stored = await Purchase.findById(purchase._id).lean();

    expect(initializeBody.amount).toBe(1000000);
    expect(stored).toMatchObject({
      amount: 10000,
      listedPriceAmount: 10000,
      taxableBaseAmount: 9302.33,
      taxAmount: 697.67,
      taxRateBps: 750,
      taxPriceMode: "inclusive",
      taxSource: "configured",
      taxPolicy: CONFIGURED_ARTIST_MUSIC_TAX_POLICY,
      taxJurisdiction: "NG",
      taxProviderReported: false,
      status: "pending",
    });
    expect(stored.taxEffectiveAt).toEqual(new Date("2000-01-01T00:00:00.000Z"));
  });

  test("retains the immutable configured snapshot when Paystack omits tax", async () => {
    const { purchase } = await startCheckout();

    const result = await settleThroughPaystack(purchase);
    const settled = await Purchase.findById(purchase._id).lean();

    expect(result.success).toBe(true);
    expect(settled).toMatchObject({
      status: "paid",
      processingFeeAmount: 250,
      taxableBaseAmount: 9302.33,
      taxAmount: 697.67,
      taxRateBps: 750,
      taxSource: "configured",
      taxPolicy: CONFIGURED_ARTIST_MUSIC_TAX_POLICY,
      taxProviderReported: false,
    });
    expect(settled.taxEffectiveAt).toEqual(new Date("2000-01-01T00:00:00.000Z"));
  });

  test("overrides the configured amount only when Paystack explicitly reports tax", async () => {
    const { purchase } = await startCheckout();

    const result = await settleThroughPaystack(purchase, {
      taxAmountMinor: 50000,
    });
    const settled = await Purchase.findById(purchase._id).lean();

    expect(result.success).toBe(true);
    expect(settled).toMatchObject({
      status: "paid",
      taxableBaseAmount: 9500,
      taxAmount: 500,
      taxRateBps: null,
      taxPriceMode: null,
      taxSource: "provider",
      taxPolicy: PROVIDER_REPORTED_TAX_POLICY,
      taxJurisdiction: "",
      taxProviderReported: true,
    });
    expect(settled.taxEffectiveAt).toEqual(new Date("2026-07-15T12:00:00.000Z"));
  });
});
