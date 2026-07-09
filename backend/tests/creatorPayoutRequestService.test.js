const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";

const CreatorProfile = require("../models/CreatorProfile");
const Purchase = require("../models/Purchase");
const RevenueLedgerEntry = require("../models/RevenueLedgerEntry");
const User = require("../models/User");
const WalletEntry = require("../models/WalletEntry");
const {
  createCreatorPayoutBatch,
  exportCreatorPayoutBatch,
  listCreatorPayoutBatches,
  reconcileCreatorPayoutBatch,
} = require("../services/creatorPayoutBatchService");
const {
  createCreatorPayoutRequest,
  listCreatorPayoutRequests,
  updateCreatorPayoutRequestStatus,
} = require("../services/creatorPayoutRequestService");
const {
  buildCreatorWalletSummary,
  reconcilePaidPurchaseWalletEntries,
} = require("../services/walletService");

let mongod;

const createCreatorProfile = async () => {
  const user = await User.create({
    name: "Payout Creator",
    username: "payout_creator",
    email: "payout-creator@example.com",
    password: "Password123!",
    role: "artist",
    isArtist: true,
    isVerified: true,
  });

  const profile = await CreatorProfile.create({
    userId: user._id,
    displayName: "Payout Creator",
    fullName: "Payout Creator",
    phoneNumber: "08000000000",
    accountNumber: "1234567890",
    bankName: "Access Bank",
    bankCode: "044",
    accountName: "Payout Creator",
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

const createPaidPurchase = ({ creatorId, amount = 2500, providerRef = "payout_wallet_ref" }) =>
  Purchase.create({
    userId: new mongoose.Types.ObjectId(),
    creatorId,
    itemType: "track",
    itemId: new mongoose.Types.ObjectId(),
    amount,
    priceNGN: amount,
    currency: "NGN",
    status: "paid",
    provider: "paystack",
    providerRef,
    paidAt: new Date(),
  });

describe("creatorPayoutRequestService", () => {
  let creator;
  let admin;

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
    admin = await User.create({
      name: "Finance Admin",
      username: "finance_admin",
      email: "finance-admin@example.com",
      password: "Password123!",
      role: "admin",
      isVerified: true,
    });
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

  test("reserves available creator balance and records paid payout movement idempotently", async () => {
    await createPaidPurchase({
      creatorId: creator.profile._id,
      amount: 2500,
      providerRef: "creator_payout_sale",
    });
    await reconcilePaidPurchaseWalletEntries({ logger: null, reason: "test" });

    const created = await createCreatorPayoutRequest({
      userId: creator.user._id,
      amount: 1000,
      creatorNote: "Ready to withdraw",
    });

    expect(created.request).toMatchObject({
      amount: 1000,
      currency: "NGN",
      status: "pending_review",
      creatorNote: "Ready to withdraw",
    });
    expect(created.summary.availableForRequest).toBe(0);

    await expect(
      createCreatorPayoutRequest({
        userId: creator.user._id,
        amount: 1000,
      })
    ).rejects.toMatchObject({
      status: 400,
      message: "Requested amount exceeds available payout balance",
    });

    await updateCreatorPayoutRequestStatus({
      requestId: created.request.id,
      status: "approved",
      adminUserId: admin._id,
      adminRole: "admin",
      adminNote: "Approved for settlement",
    });
    await updateCreatorPayoutRequestStatus({
      requestId: created.request.id,
      status: "processing",
      adminUserId: admin._id,
      adminRole: "admin",
    });
    const paid = await updateCreatorPayoutRequestStatus({
      requestId: created.request.id,
      status: "paid",
      adminUserId: admin._id,
      adminRole: "admin",
      payoutReference: "BANK_TRANSFER_001",
      creatorMessage: "Payout sent.",
    });

    expect(paid).toMatchObject({
      previousStatus: "processing",
      walletEntryCreated: true,
      revenueLedgerCreatedCount: 1,
      request: {
        status: "paid",
        payoutReference: "BANK_TRANSFER_001",
      },
    });

    const summary = await buildCreatorWalletSummary({
      creatorId: creator.profile._id,
    });
    expect(summary).toMatchObject({
      availableBalance: 0,
      withdrawn: 1000,
    });

    const payoutDebit = await WalletEntry.findOne({
      entryType: "payout_debit",
      sourceId: created.request.id,
    }).lean();
    expect(payoutDebit).toMatchObject({
      amount: 1000,
      direction: "debit",
      bucket: "available",
      sourceRef: "BANK_TRANSFER_001",
    });

    const payoutSentLedger = await RevenueLedgerEntry.findOne({
      ledgerEventType: "payout_sent",
      sourceId: created.request.id,
    }).lean();
    expect(payoutSentLedger).toMatchObject({
      accountType: "creator",
      amount: 1000,
      direction: "debit",
      balanceScope: "available",
      previousBalance: 1000,
      resultingBalance: 0,
    });

    await updateCreatorPayoutRequestStatus({
      requestId: created.request.id,
      status: "paid",
      adminUserId: admin._id,
      adminRole: "admin",
      payoutReference: "BANK_TRANSFER_001",
    });
    expect(await WalletEntry.countDocuments({ entryType: "payout_debit" })).toBe(1);
    expect(await RevenueLedgerEntry.countDocuments({ ledgerEventType: "payout_sent" })).toBe(1);
  });

  test("tracks failed payout retries without debiting the creator wallet", async () => {
    await createPaidPurchase({
      creatorId: creator.profile._id,
      amount: 5000,
      providerRef: "creator_payout_retry_sale",
    });
    await reconcilePaidPurchaseWalletEntries({ logger: null, reason: "test" });

    const created = await createCreatorPayoutRequest({
      userId: creator.user._id,
      amount: 1000,
    });

    await updateCreatorPayoutRequestStatus({
      requestId: created.request.id,
      status: "approved",
      adminUserId: admin._id,
      adminRole: "admin",
    });
    await updateCreatorPayoutRequestStatus({
      requestId: created.request.id,
      status: "processing",
      adminUserId: admin._id,
      adminRole: "admin",
    });
    await updateCreatorPayoutRequestStatus({
      requestId: created.request.id,
      status: "failed",
      adminUserId: admin._id,
      adminRole: "admin",
      adminNote: "Bank rejected transfer",
      creatorMessage: "We need to retry this payout.",
    });
    await updateCreatorPayoutRequestStatus({
      requestId: created.request.id,
      status: "processing",
      adminUserId: admin._id,
      adminRole: "admin",
    });
    const failedAgain = await updateCreatorPayoutRequestStatus({
      requestId: created.request.id,
      status: "failed",
      adminUserId: admin._id,
      adminRole: "admin",
      adminNote: "Retry failed",
    });

    expect(failedAgain.request).toMatchObject({
      status: "failed",
      attemptCount: 2,
    });
    expect(await WalletEntry.countDocuments({ entryType: "payout_debit" })).toBe(0);
    expect(await RevenueLedgerEntry.countDocuments({ ledgerEventType: "payout_failed" })).toBe(2);

    const history = await listCreatorPayoutRequests({
      userId: creator.user._id,
    });
    expect(history.summary.availableForRequest).toBe(2000);
    expect(history.requests[0]).toMatchObject({
      status: "failed",
      amount: 1000,
      creatorVisibleMessage: "We need to retry this payout.",
    });
  });

  test("creates, exports, and reconciles payout batches with retry-safe outcomes", async () => {
    await createPaidPurchase({
      creatorId: creator.profile._id,
      amount: 5000,
      providerRef: "creator_payout_batch_sale",
    });
    await reconcilePaidPurchaseWalletEntries({ logger: null, reason: "test" });

    const first = await createCreatorPayoutRequest({
      userId: creator.user._id,
      amount: 1000,
      creatorNote: "First batch payout",
    });
    const second = await createCreatorPayoutRequest({
      userId: creator.user._id,
      amount: 1000,
      creatorNote: "Second batch payout",
    });

    await updateCreatorPayoutRequestStatus({
      requestId: first.request.id,
      status: "approved",
      adminUserId: admin._id,
      adminRole: "admin",
    });
    await updateCreatorPayoutRequestStatus({
      requestId: second.request.id,
      status: "approved",
      adminUserId: admin._id,
      adminRole: "admin",
    });

    const createdBatch = await createCreatorPayoutBatch({
      requestIds: [first.request.id, second.request.id],
      adminUserId: admin._id,
      adminRole: "admin",
      note: "Weekly creator payouts",
    });

    expect(createdBatch.batch).toMatchObject({
      status: "ready_for_export",
      itemCount: 2,
      totalAmount: 2000,
      currency: "NGN",
    });

    const creatorHistory = await listCreatorPayoutRequests({ userId: creator.user._id });
    expect(creatorHistory.requests.every((entry) => entry.payoutBatchReference === createdBatch.batch.batchReference)).toBe(true);

    const exportedBatch = await exportCreatorPayoutBatch({
      batchId: createdBatch.batch.id,
      adminUserId: admin._id,
      adminRole: "admin",
      note: "Export to bank ops",
    });

    expect(exportedBatch.batch.status).toBe("exported");
    expect(exportedBatch.providerExport).toMatchObject({
      filename: `${createdBatch.batch.batchReference}.csv`,
    });
    expect(exportedBatch.providerExport.rows).toHaveLength(2);
    expect(exportedBatch.providerExport.csv).toContain("batch_reference,request_reference");

    const partial = await reconcileCreatorPayoutBatch({
      batchId: createdBatch.batch.id,
      adminUserId: admin._id,
      adminRole: "admin",
      note: "Provider returned mixed outcomes",
      outcomes: [
        {
          requestId: first.request.id,
          status: "paid",
          payoutReference: "BANK_BATCH_001",
        },
        {
          requestId: second.request.id,
          status: "failed",
          adminNote: "Bank rejected account",
          creatorMessage: "We need to retry this payout.",
        },
      ],
    });

    expect(partial.batch).toMatchObject({
      status: "partially_paid",
      reconciliationSummary: {
        paidCount: 1,
        failedCount: 1,
        pendingCount: 0,
      },
    });
    expect(await WalletEntry.countDocuments({ entryType: "payout_debit" })).toBe(1);
    expect(await RevenueLedgerEntry.countDocuments({ ledgerEventType: "payout_sent" })).toBe(1);
    expect(await RevenueLedgerEntry.countDocuments({ ledgerEventType: "payout_failed" })).toBe(1);

    const retried = await reconcileCreatorPayoutBatch({
      batchId: createdBatch.batch.id,
      adminUserId: admin._id,
      adminRole: "admin",
      note: "Retry succeeded",
      outcomes: [
        {
          requestId: second.request.id,
          status: "paid",
          payoutReference: "BANK_BATCH_002",
        },
      ],
    });

    expect(retried.batch).toMatchObject({
      status: "paid",
      reconciliationSummary: {
        paidCount: 2,
        failedCount: 0,
        pendingCount: 0,
      },
      slaSummary: {
        paidAfterFailureCount: 1,
      },
    });
    expect(await WalletEntry.countDocuments({ entryType: "payout_debit" })).toBe(2);
    expect(await RevenueLedgerEntry.countDocuments({ ledgerEventType: "payout_sent" })).toBe(2);
    expect(await RevenueLedgerEntry.countDocuments({ ledgerEventType: "payout_failed" })).toBe(1);

    const batches = await listCreatorPayoutBatches();
    expect(batches).toMatchObject({
      total: 1,
      summary: {
        statusCounts: {
          paid: 1,
        },
      },
    });
  });
});
