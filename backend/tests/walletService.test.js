const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";

const CreatorProfile = require("../models/CreatorProfile");
const Purchase = require("../models/Purchase");
const User = require("../models/User");
const WalletAccount = require("../models/WalletAccount");
const WalletEntry = require("../models/WalletEntry");
const RevenueLedgerEntry = require("../models/RevenueLedgerEntry");
const {
  buildCreatorWalletSummary,
  reconcilePaidPurchaseWalletEntries,
  recordPurchaseRefundEntries,
} = require("../services/walletService");

let mongod;

const createCreatorProfile = async () => {
  const user = await User.create({
    name: "Wallet Creator",
    username: "wallet_creator",
    email: "wallet-creator@example.com",
    password: "Password123!",
    role: "artist",
    isArtist: true,
    isVerified: true,
  });

  const profile = await CreatorProfile.create({
    userId: user._id,
    displayName: "Wallet Creator",
    fullName: "Wallet Creator",
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

const createPurchase = async ({
  creatorId,
  amount,
  status = "paid",
  providerRef,
  ...shareSnapshot
}) =>
  Purchase.create({
    userId: new mongoose.Types.ObjectId(),
    creatorId,
    itemType: "track",
    itemId: new mongoose.Types.ObjectId(),
    amount,
    priceNGN: amount,
    currency: "NGN",
    status,
    provider: "paystack",
    providerRef,
    paidAt: status === "paid" ? new Date() : null,
    ...shareSnapshot,
  });

describe("walletService", () => {
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

  test("reconciliation backfills creator and platform ledger entries idempotently", async () => {
    await createPurchase({
      creatorId: creator.profile._id,
      amount: 2500,
      providerRef: "wallet_ref_one",
    });
    await createPurchase({
      creatorId: creator.profile._id,
      amount: 1800,
      providerRef: "wallet_ref_two",
    });

    const firstRun = await reconcilePaidPurchaseWalletEntries({ logger: null, reason: "test" });
    expect(firstRun).toMatchObject({
      scannedCount: 2,
      matchedCount: 2,
      createdCount: 4,
    });

    expect(await WalletAccount.countDocuments({})).toBe(2);
    expect(await WalletEntry.countDocuments({})).toBe(4);
    expect(await RevenueLedgerEntry.countDocuments({})).toBe(6);

    const platformWallet = await WalletAccount.findOne({ ownerType: "platform" }).lean();
    expect(platformWallet).toMatchObject({
      label: "Stephen Mamman Kurah - Opay platform wallet (NGN)",
      settlementAccount: {
        accountName: "Stephen Mamman Kurah",
        bankName: "Opay",
        accountNumber: "8061201090",
      },
    });

    const summary = await buildCreatorWalletSummary({
      creatorId: creator.profile._id,
    });
    expect(summary).toMatchObject({
      grossRevenue: 4300,
      totalEarnings: 1720,
      availableBalance: 1720,
      pendingBalance: 0,
      withdrawn: 0,
      walletBacked: true,
    });
    const creatorLedgerEntries = await RevenueLedgerEntry.find({
      accountType: "creator",
      ledgerEventType: "creator_earning_credited",
    })
      .sort({ occurredAt: 1, createdAt: 1 })
      .lean();
    expect(creatorLedgerEntries).toHaveLength(2);
    expect(creatorLedgerEntries[0]).toMatchObject({
      amount: 1000,
      previousBalance: 0,
      resultingBalance: 1000,
      balanceScope: "available",
      providerReference: "wallet_ref_one",
    });
    expect(creatorLedgerEntries[1]).toMatchObject({
      amount: 720,
      previousBalance: 1000,
      resultingBalance: 1720,
      balanceScope: "available",
      providerReference: "wallet_ref_two",
    });

    const secondRun = await reconcilePaidPurchaseWalletEntries({ logger: null, reason: "test" });
    expect(secondRun.createdCount).toBe(0);
    expect(await WalletEntry.countDocuments({})).toBe(4);
    expect(await RevenueLedgerEntry.countDocuments({})).toBe(6);
  });

  test("records refund ledger reversals without drifting balances", async () => {
    const purchase = await createPurchase({
      creatorId: creator.profile._id,
      amount: 2500,
      providerRef: "wallet_ref_refund",
    });

    await reconcilePaidPurchaseWalletEntries({ logger: null, reason: "test" });

    purchase.status = "refunded";
    purchase.refundedAt = new Date();
    purchase.refundReason = "buyer_support_refund";
    await purchase.save();

    const refundResult = await recordPurchaseRefundEntries({
      purchase,
      logger: null,
      actorUserId: new mongoose.Types.ObjectId(),
      actorRole: "admin",
      reason: "buyer_support_refund",
    });

    expect(refundResult).toMatchObject({
      createdCount: 2,
      revenueLedgerCreatedCount: 2,
    });

    const creatorRefund = await RevenueLedgerEntry.findOne({
      ledgerEventType: "refund_settled",
      accountType: "creator",
    }).lean();
    expect(creatorRefund).toMatchObject({
      amount: 1000,
      direction: "debit",
      balanceScope: "available",
      previousBalance: 1000,
      resultingBalance: 0,
      actorType: "admin",
    });

    const secondRefund = await recordPurchaseRefundEntries({
      purchase,
      logger: null,
      reason: "buyer_support_refund",
    });
    expect(secondRefund.createdCount).toBe(0);
    expect(secondRefund.revenueLedgerCreatedCount).toBe(0);
  });

  test("uses the new split only when a purchase stores the prospective policy", async () => {
    const legacyPurchase = await createPurchase({
      creatorId: creator.profile._id,
      amount: 2500,
      providerRef: "wallet_ref_legacy",
    });
    const newPurchase = await createPurchase({
      creatorId: creator.profile._id,
      amount: 2500,
      providerRef: "wallet_ref_new_policy",
      revenueCategory: "music",
      revenueSharePolicy: "creator_content_platform_40_v1",
      creatorShareRate: 0.6,
      platformShareRate: 0.4,
    });

    await reconcilePaidPurchaseWalletEntries({ logger: null, reason: "test" });

    const legacyEntries = await WalletEntry.find({ sourceId: legacyPurchase._id }).lean();
    const newEntries = await WalletEntry.find({ sourceId: newPurchase._id }).lean();

    expect(legacyEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entryType: "sale_credit", amount: 1000 }),
        expect.objectContaining({ entryType: "platform_fee", amount: 1500 }),
      ])
    );
    expect(newEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entryType: "sale_credit", amount: 1500 }),
        expect.objectContaining({ entryType: "platform_fee", amount: 1000 }),
      ])
    );

    newPurchase.status = "refunded";
    newPurchase.refundedAt = new Date();
    await newPurchase.save();
    await recordPurchaseRefundEntries({
      purchase: newPurchase,
      logger: null,
      reason: "new_policy_refund",
    });

    const refundEntries = await WalletEntry.find({
      sourceId: newPurchase._id,
      sourceType: "refund",
    }).lean();
    expect(refundEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ownerType: "creator",
          entryType: "refund_debit",
          amount: 1500,
        }),
        expect.objectContaining({
          ownerType: "platform",
          entryType: "refund_debit",
          amount: 1000,
        }),
      ])
    );
  });

  test("credits and reverses the dated 75/25 artist split from net revenue", async () => {
    const purchase = await createPurchase({
      creatorId: creator.profile._id,
      amount: 2500,
      providerRef: "wallet_ref_artist_net_policy",
      revenueCategory: "music",
      revenueSharePolicy: "artist_music_net_75_v1",
      creatorShareRate: 0.75,
      platformShareRate: 0.25,
      processingFeeAmount: 137.5,
      taxAmount: 12.5,
    });

    await reconcilePaidPurchaseWalletEntries({ logger: null, reason: "test" });

    const entries = await WalletEntry.find({ sourceId: purchase._id }).lean();
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entryType: "sale_credit",
          amount: 1762.5,
          metadata: expect.objectContaining({
            processingFeeAmount: 137.5,
            taxAmount: 12.5,
            netRevenueAmount: 2350,
          }),
        }),
        expect.objectContaining({
          entryType: "platform_fee",
          amount: 587.5,
        }),
      ])
    );

    await expect(
      buildCreatorWalletSummary({ creatorId: creator.profile._id })
    ).resolves.toMatchObject({
      grossRevenue: 2500,
      processingFees: 137.5,
      taxes: 12.5,
      netRevenue: 2350,
      totalEarnings: 1762.5,
      platformRevenue: 587.5,
    });

    purchase.status = "refunded";
    purchase.refundedAt = new Date();
    await purchase.save();
    await recordPurchaseRefundEntries({
      purchase,
      logger: null,
      reason: "artist_net_policy_refund",
    });

    const refundEntries = await WalletEntry.find({
      sourceId: purchase._id,
      sourceType: "refund",
    }).lean();
    expect(refundEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ownerType: "creator", amount: 1762.5 }),
        expect.objectContaining({ ownerType: "platform", amount: 587.5 }),
      ])
    );
    await expect(
      buildCreatorWalletSummary({ creatorId: creator.profile._id })
    ).resolves.toMatchObject({
      netRevenue: 0,
      totalEarnings: 0,
      platformRevenue: 0,
    });
  });
});
