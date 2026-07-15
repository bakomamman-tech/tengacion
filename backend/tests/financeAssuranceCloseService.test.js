const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";

const CreatorProfile = require("../models/CreatorProfile");
const Entitlement = require("../models/Entitlement");
const PaymentDispute = require("../models/PaymentDispute");
const PaymentWebhookEvent = require("../models/PaymentWebhookEvent");
const Purchase = require("../models/Purchase");
const User = require("../models/User");
const WalletEntry = require("../models/WalletEntry");
const {
  computePurchaseRevenueShare,
} = require("../services/creatorRevenueSharePolicy");
const { buildFinanceAssuranceClose } = require("../services/financeAssuranceCloseService");
const {
  createCreatorPayoutRequest,
  updateCreatorPayoutRequestStatus,
} = require("../services/creatorPayoutRequestService");
const {
  reconcilePaidPurchaseWalletEntries,
  recordPurchaseRefundEntries,
  ensureCreatorWalletAccount,
  ensurePlatformWalletAccount,
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
    accountName: "Assurance Creator",
    bankName: "Opay",
    bankCode: "999992",
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

const createChargebackWalletEntries = async ({
  purchase,
  dispute,
  creatorAmount,
  platformAmount,
  effectiveAt = new Date(),
  keyPrefix = "test-chargeback",
} = {}) => {
  const [creatorWallet, platformWallet] = await Promise.all([
    ensureCreatorWalletAccount(purchase.creatorId, purchase.currency || "NGN"),
    ensurePlatformWalletAccount(purchase.currency || "NGN"),
  ]);
  return WalletEntry.create([
    {
      walletAccountId: creatorWallet._id,
      ownerType: "creator",
      ownerId: purchase.creatorId,
      currency: purchase.currency || "NGN",
      direction: "debit",
      bucket: "available",
      entryType: "chargeback_debit",
      amount: creatorAmount,
      grossAmount: purchase.amount,
      sourceType: "dispute",
      sourceId: dispute._id,
      sourceRef: dispute.providerDisputeId,
      dedupeKey: `${keyPrefix}-creator:${dispute.id}`,
      effectiveAt,
    },
    {
      walletAccountId: platformWallet._id,
      ownerType: "platform",
      ownerId: null,
      currency: purchase.currency || "NGN",
      direction: "debit",
      bucket: "available",
      entryType: "chargeback_debit",
      amount: platformAmount,
      grossAmount: purchase.amount,
      sourceType: "dispute",
      sourceId: dispute._id,
      sourceRef: dispute.providerDisputeId,
      dedupeKey: `${keyPrefix}-platform:${dispute.id}`,
      effectiveAt,
    },
  ]);
};

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
    expect(close.reconciliation.disputes).toMatchObject({
      sourceStatus: "unobserved",
      sourceFreshness: "delayed",
      reconciliationStatus: "reconciled",
      disputeEvents: 0,
      disputeCount: 0,
    });
    expect(
      close.sourceSystems.find((entry) => entry.key === "disputes")
    ).toMatchObject({ freshness: "delayed", latestEventAt: null });
    expect(close.evidenceGaps).toEqual([]);
    expect(close.exceptions).toEqual([]);
    expect(paidPurchase.providerRef).toBe("assurance_ready_paid");
  });

  test("reports provider disputes requiring manual finance review", async () => {
    const buyerId = new mongoose.Types.ObjectId();
    const itemId = new mongoose.Types.ObjectId();
    const purchase = await createPaidPurchase({
      buyerId,
      creatorId: creator.profile._id,
      itemId,
      amount: 3200,
      providerRef: "assurance_dispute_manual_review",
    });
    await Entitlement.create({
      buyerId,
      itemType: "track",
      itemId,
      grantedAt: new Date(),
    });
    await reconcilePaidPurchaseWalletEntries({ logger: null, reason: "test" });
    await PaymentDispute.create({
      provider: "paystack",
      providerDisputeId: "paystack-dispute-manual-review",
      purchaseId: purchase._id,
      providerRef: purchase.providerRef,
      status: "pending",
      currency: "NGN",
      disputedAmount: 3200,
      financialState: "manual_review",
      manualReviewReason: "purchase_currency_mismatch",
      openedAt: new Date(),
      lastEventAt: new Date(),
      lastEventType: "charge.dispute.create",
    });

    const close = await buildFinanceAssuranceClose({ range: "30d" });

    expect(close.close).toMatchObject({
      readinessState: "needs_review",
      approvalStatus: "finance_review_required",
    });
    expect(close.reconciliation.disputes).toMatchObject({
      sourceStatus: "current_model_evidence",
      sourceFreshness: "current",
      reconciliationStatus: "attention_required",
      disputeCount: 1,
      openCount: 1,
      manualReviewCount: 1,
      missingFinancialCount: 0,
    });
    expect(close.evidenceGaps).toEqual([]);
    expect(close.exceptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "dispute_open_exposure", severity: "medium" }),
        expect.objectContaining({ key: "dispute_manual_review", severity: "high" }),
      ])
    );
  });

  test("reconciles accepted chargebacks without treating them as ordinary refunds", async () => {
    const purchase = await createPaidPurchase({
      creatorId: creator.profile._id,
      amount: 4000,
      providerRef: "assurance_chargeback_settled",
    });
    purchase.paidAt = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    await purchase.save();
    await reconcilePaidPurchaseWalletEntries({ logger: null, reason: "test" });
    const revenueShare = computePurchaseRevenueShare(purchase);

    purchase.status = "refunded";
    purchase.refundedAt = new Date();
    purchase.refundReason = "paystack_chargeback";
    await purchase.save();

    const dispute = await PaymentDispute.create({
      provider: "paystack",
      providerDisputeId: "paystack-dispute-settled",
      purchaseId: purchase._id,
      providerRef: purchase.providerRef,
      status: "resolved",
      resolution: "merchant-accepted",
      currency: "NGN",
      disputedAmount: purchase.amount,
      refundAmount: purchase.amount,
      financialState: "debited",
      chargebackAmount: revenueShare.netRevenueAmount,
      creatorChargebackAmount: revenueShare.creatorAmount,
      platformChargebackAmount: revenueShare.platformAmount,
      openedAt: new Date(),
      resolvedAt: new Date(),
      lastEventAt: new Date(),
      lastEventType: "charge.dispute.resolve",
    });
    const [creatorWallet, platformWallet] = await Promise.all([
      ensureCreatorWalletAccount(creator.profile._id, "NGN"),
      ensurePlatformWalletAccount("NGN"),
    ]);
    await WalletEntry.create([
      {
        walletAccountId: creatorWallet._id,
        ownerType: "creator",
        ownerId: creator.profile._id,
        currency: "NGN",
        direction: "debit",
        bucket: "available",
        entryType: "chargeback_debit",
        amount: revenueShare.creatorAmount,
        grossAmount: purchase.amount,
        sourceType: "dispute",
        sourceId: dispute._id,
        sourceRef: dispute.providerDisputeId,
        dedupeKey: `test-chargeback-creator:${dispute.id}`,
      },
      {
        walletAccountId: platformWallet._id,
        ownerType: "platform",
        ownerId: null,
        currency: "NGN",
        direction: "debit",
        bucket: "available",
        entryType: "chargeback_debit",
        amount: revenueShare.platformAmount,
        grossAmount: purchase.amount,
        sourceType: "dispute",
        sourceId: dispute._id,
        sourceRef: dispute.providerDisputeId,
        dedupeKey: `test-chargeback-platform:${dispute.id}`,
      },
    ]);

    const close = await buildFinanceAssuranceClose({ range: "30d" });

    expect(close.close).toMatchObject({
      readinessState: "ready",
      approvalStatus: "ready_for_finance_approval",
    });
    expect(close.summary).toMatchObject({
      refundedPayments: 0,
      refundedAmount: 0,
      chargebackProviderAmount: purchase.amount,
      chargebackNetRevenueAmount: revenueShare.netRevenueAmount,
      netSettledAmount: -revenueShare.netRevenueAmount,
    });
    expect(close.reconciliation.refunds).toMatchObject({
      events: 0,
      expectedEntries: 0,
      actualEntries: 0,
    });
    expect(close.reconciliation.disputes).toMatchObject({
      reconciliationStatus: "reconciled",
      disputeCount: 1,
      debitedCount: 1,
      expectedWalletEntries: 2,
      actualWalletEntries: 2,
    });
    expect(close.exceptions).toEqual([]);
  });

  test("periodizes an opened dispute and its later chargeback into separate closes", async () => {
    const openedAt = new Date("2026-06-10T12:00:00.000Z");
    const resolvedAt = new Date("2026-07-10T12:00:00.000Z");
    const purchase = await createPaidPurchase({
      creatorId: creator.profile._id,
      amount: 5000,
      providerRef: "assurance_cross_period_chargeback",
    });
    purchase.paidAt = new Date("2026-05-20T12:00:00.000Z");
    purchase.status = "refunded";
    purchase.refundedAt = resolvedAt;
    purchase.refundReason = "paystack_chargeback:cross-period-dispute";
    await purchase.save();
    const revenueShare = computePurchaseRevenueShare(purchase);
    const dispute = await PaymentDispute.create({
      provider: "paystack",
      providerDisputeId: "cross-period-dispute",
      purchaseId: purchase._id,
      providerRef: purchase.providerRef,
      status: "resolved",
      resolution: "merchant-accepted",
      currency: "NGN",
      disputedAmount: purchase.amount,
      refundAmount: purchase.amount,
      financialState: "debited",
      chargebackAmount: revenueShare.netRevenueAmount,
      creatorChargebackAmount: revenueShare.creatorAmount,
      platformChargebackAmount: revenueShare.platformAmount,
      openedAt,
      resolvedAt,
      lastEventAt: resolvedAt,
      lastEventType: "charge.dispute.resolve",
    });
    await createChargebackWalletEntries({
      purchase,
      dispute,
      creatorAmount: revenueShare.creatorAmount,
      platformAmount: revenueShare.platformAmount,
      effectiveAt: resolvedAt,
      keyPrefix: "cross-period-chargeback",
    });
    await PaymentWebhookEvent.create([
      {
        provider: "paystack",
        eventId: "cross-period-dispute-create",
        eventType: "charge.dispute.create",
        providerRef: purchase.providerRef,
        purchaseId: purchase._id,
        payloadHash: "cross-period-create-hash",
        status: "processed",
        createdAt: openedAt,
      },
      {
        provider: "paystack",
        eventId: "cross-period-dispute-resolve",
        eventType: "charge.dispute.resolve",
        providerRef: purchase.providerRef,
        purchaseId: purchase._id,
        payloadHash: "cross-period-resolve-hash",
        status: "processed",
        createdAt: resolvedAt,
      },
    ]);

    const juneClose = await buildFinanceAssuranceClose({
      range: "custom",
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });
    const julyClose = await buildFinanceAssuranceClose({
      range: "custom",
      startDate: "2026-07-01",
      endDate: "2026-07-31",
    });

    expect(juneClose.summary).toMatchObject({
      chargebackNetRevenueAmount: 0,
      netSettledAmount: 0,
      disputeOpenCount: 1,
    });
    expect(juneClose.reconciliation.disputes).toMatchObject({
      sourceStatus: "current",
      sourceFreshness: "current",
      disputeEvents: 1,
      disputeEventTypeCounts: { "charge.dispute.create": 1 },
      openedCount: 1,
      resolvedCount: 0,
      openCount: 1,
      debitedCount: 0,
      expectedWalletEntries: 0,
      actualWalletEntries: 0,
    });
    expect(juneClose.exceptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "dispute_open_exposure" }),
      ])
    );

    expect(julyClose.summary).toMatchObject({
      refundedPayments: 0,
      chargebackNetRevenueAmount: revenueShare.netRevenueAmount,
      netSettledAmount: -revenueShare.netRevenueAmount,
      disputeOpenCount: 0,
    });
    expect(julyClose.reconciliation.disputes).toMatchObject({
      sourceStatus: "current",
      sourceFreshness: "current",
      disputeEvents: 1,
      disputeEventTypeCounts: { "charge.dispute.resolve": 1 },
      openedCount: 0,
      resolvedCount: 1,
      openCount: 0,
      debitedCount: 1,
      expectedWalletEntries: 2,
      actualWalletEntries: 2,
    });
    expect(julyClose.exceptions).toEqual([]);
  });

  test("keeps an ordinary refund in reconciliation until a dispute debit is confirmed", async () => {
    const admin = await createAdmin();
    const purchase = await createPaidPurchase({
      creatorId: creator.profile._id,
      amount: 3600,
      providerRef: "assurance_refund_with_manual_dispute",
    });
    await reconcilePaidPurchaseWalletEntries({ logger: null, reason: "test" });
    purchase.status = "refunded";
    purchase.refundedAt = new Date();
    purchase.refundReason = "customer_refund";
    await purchase.save();
    await recordPurchaseRefundEntries({
      purchase,
      logger: null,
      actorUserId: admin._id,
      actorRole: "admin",
      reason: purchase.refundReason,
    });
    await PaymentDispute.create({
      provider: "paystack",
      providerDisputeId: "accepted-dispute-awaiting-accounting",
      purchaseId: purchase._id,
      providerRef: purchase.providerRef,
      status: "resolved",
      resolution: "merchant-accepted",
      currency: "NGN",
      disputedAmount: purchase.amount,
      refundAmount: purchase.amount,
      financialState: "manual_review",
      manualReviewReason: "purchase_already_refunded",
      openedAt: new Date(),
      resolvedAt: new Date(),
      lastEventAt: new Date(),
      lastEventType: "charge.dispute.resolve",
    });

    const close = await buildFinanceAssuranceClose({ range: "30d" });

    expect(close.summary).toMatchObject({
      refundedPayments: 1,
      refundedAmount: purchase.amount,
      chargebackNetRevenueAmount: 0,
      netSettledAmount: 0,
    });
    expect(close.reconciliation.refunds).toMatchObject({
      events: 1,
      expectedEntries: 2,
      actualEntries: 2,
    });
    expect(close.reconciliation.disputes).toMatchObject({
      debitedCount: 0,
      missingFinancialCount: 1,
      manualReviewCount: 1,
    });
    expect(close.exceptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "dispute_financial_gap" }),
        expect.objectContaining({ key: "dispute_manual_review" }),
      ])
    );
  });

  test("ignores zero-side chargeback entries when reconciling wallet entry counts", async () => {
    const purchase = await createPaidPurchase({
      creatorId: creator.profile._id,
      amount: 100,
      providerRef: "assurance_zero_side_chargeback",
    });
    purchase.paidAt = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    await purchase.save();
    const dispute = await PaymentDispute.create({
      provider: "paystack",
      providerDisputeId: "zero-side-dispute",
      purchaseId: purchase._id,
      providerRef: purchase.providerRef,
      status: "resolved",
      resolution: "merchant-accepted",
      currency: "NGN",
      disputedAmount: 0.01,
      refundAmount: 0.01,
      financialState: "debited",
      chargebackAmount: 0.01,
      creatorChargebackAmount: 0.01,
      platformChargebackAmount: 0,
      openedAt: new Date(),
      resolvedAt: new Date(),
      lastEventAt: new Date(),
      lastEventType: "charge.dispute.resolve",
    });
    await createChargebackWalletEntries({
      purchase,
      dispute,
      creatorAmount: 0.01,
      platformAmount: 0,
      keyPrefix: "zero-side-chargeback",
    });

    const close = await buildFinanceAssuranceClose({ range: "30d" });

    expect(close.reconciliation.disputes).toMatchObject({
      reconciliationStatus: "reconciled",
      debitedCount: 1,
      expectedWalletEntries: 1,
      actualWalletEntries: 1,
      ignoredZeroAmountWalletEntries: 1,
    });
    expect(close.summary).toMatchObject({
      chargebackNetRevenueAmount: 0.01,
      netSettledAmount: -0.01,
    });
    expect(close.exceptions).toEqual([]);
  });
});
