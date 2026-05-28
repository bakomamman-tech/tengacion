const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";

const CreatorProfile = require("../models/CreatorProfile");
const Entitlement = require("../models/Entitlement");
const PaymentWebhookEvent = require("../models/PaymentWebhookEvent");
const Purchase = require("../models/Purchase");
const User = require("../models/User");
const { buildFinanceAssuranceClose } = require("../services/financeAssuranceCloseService");
const {
  createCreatorPayoutRequest,
  updateCreatorPayoutRequestStatus,
} = require("../services/creatorPayoutRequestService");
const {
  reconcilePaidPurchaseWalletEntries,
  recordPurchaseRefundEntries,
} = require("../services/walletService");

let mongod;

const createCreatorProfile = async () => {
  const user = await User.create({
    name: "Assurance Creator",
    username: "assurance_creator",
    email: "assurance-creator@example.com",
    password: "Password123!",
    role: "artist",
    isArtist: true,
    isVerified: true,
  });

  const profile = await CreatorProfile.create({
    userId: user._id,
    displayName: "Assurance Creator",
    fullName: "Assurance Creator",
    phoneNumber: "08000000000",
    accountNumber: "1234567890",
    country: "Nigeria",
    countryOfResidence: "Nigeria",
    creatorTypes: ["music"],
    acceptedTerms: true,
    acceptedCopyrightDeclaration: true,
    onboardingCompleted: true,
    onboardingComplete: true,
    status: "active",
  });

  return { user, profile };
};

const createAdmin = () =>
  User.create({
    name: "Assurance Admin",
    username: "assurance_admin",
    email: "assurance-admin@example.com",
    password: "Password123!",
    role: "admin",
    isVerified: true,
  });

const createPaidPurchase = ({
  buyerId = new mongoose.Types.ObjectId(),
  creatorId,
  itemId = new mongoose.Types.ObjectId(),
  amount = 2500,
  providerRef,
} = {}) =>
  Purchase.create({
    userId: buyerId,
    creatorId,
    itemType: "track",
    itemId,
    amount,
    priceNGN: amount,
    currency: "NGN",
    status: "paid",
    provider: "paystack",
    providerRef,
    paidAt: new Date(),
  });

describe("financeAssuranceCloseService", () => {
  let creator;

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
    creator = await createCreatorProfile();
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

  test("blocks the close when paid purchases lack entitlement and wallet evidence", async () => {
    const buyerId = new mongoose.Types.ObjectId();
    const entitledItemId = new mongoose.Types.ObjectId();
    const reconciledPurchase = await createPaidPurchase({
      buyerId,
      creatorId: creator.profile._id,
      itemId: entitledItemId,
      amount: 2500,
      providerRef: "assurance_reconciled_purchase",
    });
    await Entitlement.create({
      buyerId,
      itemType: "track",
      itemId: entitledItemId,
      grantedAt: new Date(),
    });
    await reconcilePaidPurchaseWalletEntries({ logger: null, reason: "test" });

    await createPaidPurchase({
      buyerId,
      creatorId: creator.profile._id,
      amount: 1800,
      providerRef: "assurance_missing_wallet_and_access",
    });
    await PaymentWebhookEvent.create({
      provider: "paystack",
      eventId: "assurance-webhook-failed",
      eventType: "charge.success",
      providerRef: "assurance_missing_wallet_and_access",
      purchaseId: reconciledPurchase._id,
      payloadHash: "assurance-failed-hash",
      status: "failed",
      errorMessage: "provider replay failed",
    });

    const close = await buildFinanceAssuranceClose({ range: "30d" });

    expect(close.close).toMatchObject({
      readinessState: "blocked",
      approvalStatus: "blocked_pending_reconciliation",
    });
    expect(close.summary).toMatchObject({
      successfulPayments: 2,
      entitlementEligiblePurchases: 2,
      entitlementGrants: 1,
      entitlementMissing: 1,
      walletExpectedEntries: 4,
      walletActualEntries: 2,
      walletMissingEntries: 2,
      creatorBalanceConfidenceState: "degraded",
    });
    expect(close.exceptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "entitlement_gap", severity: "critical" }),
        expect.objectContaining({ key: "wallet_settlement_gap", severity: "critical" }),
        expect.objectContaining({ key: "webhook_failures", severity: "high" }),
      ])
    );
  });

  test("marks the close ready when settlement, refund, payout, and entitlement evidence reconcile", async () => {
    const admin = await createAdmin();
    const buyerId = new mongoose.Types.ObjectId();
    const paidItemId = new mongoose.Types.ObjectId();
    const paidPurchase = await createPaidPurchase({
      buyerId,
      creatorId: creator.profile._id,
      itemId: paidItemId,
      amount: 5000,
      providerRef: "assurance_ready_paid",
    });
    const refundedPurchase = await createPaidPurchase({
      buyerId,
      creatorId: creator.profile._id,
      amount: 2500,
      providerRef: "assurance_ready_refunded",
    });
    await Entitlement.create({
      buyerId,
      itemType: "track",
      itemId: paidItemId,
      grantedAt: new Date(),
    });

    await reconcilePaidPurchaseWalletEntries({ logger: null, reason: "test" });

    refundedPurchase.status = "refunded";
    refundedPurchase.refundedAt = new Date();
    refundedPurchase.refundReason = "assurance_test_refund";
    await refundedPurchase.save();
    await recordPurchaseRefundEntries({
      purchase: refundedPurchase,
      logger: null,
      actorUserId: admin._id,
      actorRole: "admin",
      reason: "assurance_test_refund",
    });

    const payout = await createCreatorPayoutRequest({
      userId: creator.user._id,
      amount: 1000,
      creatorNote: "Assurance close payout",
    });
    await updateCreatorPayoutRequestStatus({
      requestId: payout.request.id,
      status: "approved",
      adminUserId: admin._id,
      adminRole: "admin",
    });
    await updateCreatorPayoutRequestStatus({
      requestId: payout.request.id,
      status: "processing",
      adminUserId: admin._id,
      adminRole: "admin",
    });
    await updateCreatorPayoutRequestStatus({
      requestId: payout.request.id,
      status: "paid",
      adminUserId: admin._id,
      adminRole: "admin",
      payoutReference: "ASSURANCE_PAYOUT_001",
    });

    const close = await buildFinanceAssuranceClose({ range: "30d" });

    expect(close.close).toMatchObject({
      readinessState: "ready",
      approvalStatus: "ready_for_finance_approval",
    });
    expect(close.summary).toMatchObject({
      successfulPayments: 2,
      refundedPayments: 1,
      grossPaidAmount: 7500,
      refundedAmount: 2500,
      netSettledAmount: 5000,
      entitlementEligiblePurchases: 1,
      entitlementMissing: 0,
      walletExpectedEntries: 4,
      walletActualEntries: 4,
      refundWalletExpectedEntries: 2,
      refundWalletActualEntries: 2,
      payoutPaidAmount: 1000,
      creatorBalanceConfidenceRate: 1,
      creatorBalanceConfidenceState: "current",
      exceptionCount: 0,
    });
    expect(close.reconciliation.purchases.statusCounts).toMatchObject({
      paid: 1,
      refunded: 1,
    });
    expect(close.exceptions).toEqual([]);
    expect(paidPurchase.providerRef).toBe("assurance_ready_paid");
  });
});
