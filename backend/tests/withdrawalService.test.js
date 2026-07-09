const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "sk_test_mock_key_for_tests";

const MarketplaceOrder = require("../models/MarketplaceOrder");
const MarketplacePayout = require("../models/MarketplacePayout");
const MarketplaceProduct = require("../models/MarketplaceProduct");
const MarketplaceSeller = require("../models/MarketplaceSeller");
const RevenueLedgerEntry = require("../models/RevenueLedgerEntry");
const User = require("../models/User");
const Withdrawal = require("../models/Withdrawal");
const {
  buildSellerWithdrawalAvailability,
  createSellerWithdrawal,
  retryWithdrawalTransfer,
} = require("../services/withdrawalService");

let mongod;
const originalFetch = global.fetch;

const createSeller = async () => {
  const user = await User.create({
    name: "Withdrawal Seller",
    username: "withdrawal_seller",
    email: "withdrawal-seller@example.com",
    password: "Password123!",
    role: "user",
    isVerified: true,
  });

  const seller = await MarketplaceSeller.create({
    user: user._id,
    fullName: "Withdrawal Seller",
    storeName: "Withdrawal Store",
    slug: "withdrawal-store",
    phoneNumber: "08012345678",
    bankName: "Access Bank",
    bankCode: "044",
    accountNumber: "0123456789",
    accountName: "Withdrawal Store",
    residentialAddress: "12 Test Street",
    businessAddress: "14 Test Road",
    state: "Lagos",
    city: "Ikeja",
    status: "approved",
    isActive: true,
  });

  const product = await MarketplaceProduct.create({
    seller: seller._id,
    title: "Withdrawal Test Product",
    slug: "withdrawal-test-product",
    description: "A product used for withdrawal tests.",
    category: "Accessories",
    price: 5300,
    stock: 5,
    condition: "new",
    currency: "NGN",
    state: "Lagos",
    city: "Ikeja",
    deliveryOptions: ["pickup"],
    isPublished: true,
    moderationStatus: "approved",
  });

  return { user, seller, product };
};

const createOrderAndPayout = async ({
  buyerId,
  sellerId,
  productId,
  reference,
  sellerReceivable,
  buyerConfirmedHealthy = false,
}) => {
  const order = await MarketplaceOrder.create({
    buyer: buyerId,
    seller: sellerId,
    product: productId,
    quantity: 1,
    totalPrice: sellerReceivable + 300,
    platformFee: 300,
    sellerReceivable,
    paymentStatus: "paid",
    orderStatus: buyerConfirmedHealthy ? "completed" : "delivered",
    paymentReference: reference,
    deliveryMethod: "pickup",
    productTitle: "Withdrawal Test Product",
    storeName: "Withdrawal Store",
    buyerDeliveryConfirmedAt: buyerConfirmedHealthy ? new Date() : null,
    buyerDeliveryCondition: buyerConfirmedHealthy ? "healthy" : "",
  });

  await MarketplacePayout.create({
    seller: sellerId,
    order: order._id,
    grossAmount: sellerReceivable + 300,
    platformFee: 300,
    netAmount: sellerReceivable,
    payoutStatus: "pending",
  });

  return order;
};

describe("withdrawalService", () => {
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
    global.fetch = jest.fn(async (url) => {
      const text = String(url || "");
      if (text.includes("/transferrecipient")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: true,
            data: {
              id: 101,
              recipient_code: "RCP_test_recipient",
              type: "nuban",
              name: "Withdrawal Store",
              details: {
                account_number: "0123456789",
                account_name: "Withdrawal Store",
                bank_code: "044",
                bank_name: "Access Bank",
              },
            },
          }),
        };
      }
      if (text.includes("/transfer")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: true,
            data: {
              id: 202,
              amount: 400000,
              currency: "NGN",
              reference: "tgn_wd_test_reference_001",
              status: "success",
              transfer_code: "TRF_test_transfer",
              recipient: "RCP_test_recipient",
            },
          }),
        };
      }
      throw new Error(`Unexpected Paystack URL ${text}`);
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
    } finally {
      await mongoose.disconnect().catch(() => null);
      if (mongod) {
        await mongod.stop();
      }
      global.fetch = originalFetch;
    }
  });

  test("seller withdrawals only include buyer-confirmed healthy deliveries", async () => {
    const { user, seller, product } = await createSeller();
    const buyer = await User.create({
      name: "Marketplace Buyer",
      username: "marketplace_buyer",
      email: "marketplace-buyer@example.com",
      password: "Password123!",
      isVerified: true,
    });

    await createOrderAndPayout({
      buyerId: buyer._id,
      sellerId: seller._id,
      productId: product._id,
      reference: "confirmed_delivery_ref",
      sellerReceivable: 5000,
      buyerConfirmedHealthy: true,
    });
    await createOrderAndPayout({
      buyerId: buyer._id,
      sellerId: seller._id,
      productId: product._id,
      reference: "held_delivery_ref",
      sellerReceivable: 3000,
      buyerConfirmedHealthy: false,
    });

    const availability = await buildSellerWithdrawalAvailability({
      sellerId: seller._id,
    });

    expect(availability).toMatchObject({
      totalNetReceivable: 8000,
      confirmedNetReceivable: 5000,
      heldNetReceivable: 3000,
      reserveAmount: 1000,
      withdrawableAmount: 4000,
    });

    await expect(
      createSellerWithdrawal({
        seller,
        userId: user._id,
        amount: 4500,
      })
    ).rejects.toMatchObject({
      status: 400,
      message: "Withdrawal amount exceeds your available balance after the reserve",
    });

    const result = await createSellerWithdrawal({
      seller,
      userId: user._id,
      amount: 4000,
    });

    expect(result.withdrawal).toMatchObject({
      ownerType: "seller",
      amount: 4000,
      status: "succeeded",
      providerTransferCode: "TRF_test_transfer",
    });
    expect(result.summary).toMatchObject({
      withdrawn: 4000,
      heldNetReceivable: 3000,
      withdrawableAmount: 0,
    });

    expect(await Withdrawal.countDocuments({ ownerType: "seller" })).toBe(1);
    const sentLedger = await RevenueLedgerEntry.findOne({
      accountType: "marketplace_seller",
      ledgerEventType: "payout_sent",
    }).lean();
    expect(sentLedger).toMatchObject({
      amount: 4000,
      direction: "debit",
      balanceScope: "available",
      providerReference: "TRF_test_transfer",
    });
  });

  test("queues Paystack starter business transfer restrictions for admin retry", async () => {
    const { user, seller, product } = await createSeller();
    const buyer = await User.create({
      name: "Marketplace Buyer",
      username: "marketplace_buyer_two",
      email: "marketplace-buyer-two@example.com",
      password: "Password123!",
      isVerified: true,
    });

    await createOrderAndPayout({
      buyerId: buyer._id,
      sellerId: seller._id,
      productId: product._id,
      reference: "confirmed_delivery_restricted_ref",
      sellerReceivable: 5000,
      buyerConfirmedHealthy: true,
    });

    global.fetch = jest.fn(async (url) => {
      const text = String(url || "");
      if (text.includes("/transferrecipient")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: true,
            data: {
              id: 101,
              recipient_code: "RCP_test_recipient",
              type: "nuban",
              name: "Withdrawal Store",
              details: {
                account_number: "0123456789",
                account_name: "Withdrawal Store",
                bank_code: "044",
                bank_name: "Access Bank",
              },
            },
          }),
        };
      }
      if (text.includes("/transfer")) {
        return {
          ok: false,
          status: 400,
          json: async () => ({
            status: false,
            message: "You cannot initiate third party payouts as a starter business",
          }),
        };
      }
      throw new Error(`Unexpected Paystack URL ${text}`);
    });

    const queuedResult = await createSellerWithdrawal({
      seller,
      userId: user._id,
      amount: 4000,
    });

    expect(queuedResult.withdrawal).toMatchObject({
      ownerType: "seller",
      amount: 4000,
      status: "provider_setup_required",
      providerStatus: "paystack_business_restriction",
      failureReason:
        "Tengacion payouts are waiting for Paystack business transfer activation. The withdrawal has not been sent yet, and the requested amount is reserved until finance retries or resolves it.",
    });
    expect(queuedResult.providerIssue).toMatchObject({
      code: "paystack_business_restriction",
    });
    expect(queuedResult.summary).toMatchObject({
      openWithdrawalAmount: 4000,
      withdrawableAmount: 0,
    });
    expect(await RevenueLedgerEntry.countDocuments({ ledgerEventType: "payout_failed" })).toBe(0);

    const queuedWithdrawal = await Withdrawal.findOne({ ownerType: "seller" });
    expect(queuedWithdrawal).toBeTruthy();

    global.fetch = jest.fn(async (url) => {
      const text = String(url || "");
      if (text.includes("/transfer")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: true,
            data: {
              id: 303,
              amount: 400000,
              currency: "NGN",
              reference: queuedWithdrawal.reference,
              status: "success",
              transfer_code: "TRF_retry_transfer",
              recipient: "RCP_test_recipient",
            },
          }),
        };
      }
      throw new Error(`Unexpected Paystack URL ${text}`);
    });

    const retried = await retryWithdrawalTransfer({
      withdrawalId: queuedWithdrawal._id,
      adminUserId: user._id,
    });

    expect(retried.withdrawal).toMatchObject({
      status: "succeeded",
      providerTransferCode: "TRF_retry_transfer",
      failureReason: "",
    });
    expect(await RevenueLedgerEntry.countDocuments({ ledgerEventType: "payout_sent" })).toBe(1);
  });
});
