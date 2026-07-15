const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";

const CreatorProfile = require("../models/CreatorProfile");
const Purchase = require("../models/Purchase");
const Track = require("../models/Track");
const User = require("../models/User");
const WalletEntry = require("../models/WalletEntry");
const { buildCreatorFinanceRepository } = require("../services/creatorFinanceRepositoryService");
const { buildRevenueLedgerSummary } = require("../services/revenueLedgerService");
const { reconcilePaidPurchaseWalletEntries } = require("../services/walletService");

let mongod;

const createCreator = async () => {
  const user = await User.create({
    name: "Finance Creator",
    username: "finance_creator",
    email: "finance-creator@example.com",
    password: "Password123!",
    role: "artist",
    isArtist: true,
    isVerified: true,
  });

  const profile = await CreatorProfile.create({
    userId: user._id,
    displayName: "Finance Creator",
    fullName: "Finance Creator",
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

describe("creatorFinanceRepositoryService", () => {
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

  test("builds the repository view from wallet ledger entries when available", async () => {
    const creator = await createCreator();
    const track = await Track.create({
      _id: new mongoose.Types.ObjectId(),
      creatorId: creator.profile._id,
      title: "Ledger-backed Track",
      description: "Premium release",
      price: 2500,
      audioUrl: "https://example.com/full-track.mp3",
      previewUrl: "https://example.com/preview-track.mp3",
      kind: "music",
      creatorCategory: "music",
      contentType: "track",
      publishedStatus: "published",
      isPublished: true,
    });

    const purchase = await Purchase.create({
      userId: new mongoose.Types.ObjectId(),
      creatorId: creator.profile._id,
      itemType: "track",
      itemId: track._id,
      amount: 2500,
      priceNGN: 2500,
      currency: "NGN",
      status: "paid",
      provider: "paystack",
      providerRef: "finance_wallet_ref",
      paidAt: new Date(),
    });

    await reconcilePaidPurchaseWalletEntries({ logger: null, reason: "test" });

    await Purchase.updateOne({ _id: purchase._id }, { $set: { amount: 9999 } });

    const repository = await buildCreatorFinanceRepository({ range: "30d" });

    expect(repository.repository).toMatchObject({
      grossRevenue: 2500,
      processingFees: 0,
      taxes: 0,
      netRevenue: 2500,
      repositoryAmount: 1500,
      creatorAmount: 1000,
      paidTransactions: 1,
      activeCreators: 1,
      settlementAccount: {
        accountName: "Stephen Mamman Kurah",
        bankName: "Opay",
        accountNumber: "8061201090",
      },
      songAlbumPlatformSharePercent: 25,
      songAlbumCreatorSharePercent: 75,
    });
    expect(repository.repository.purpose).toContain("song and album sales");
    expect(repository.repository.accountingNote).toContain(
      "Historical payments retain their original stored split"
    );
    expect(repository.breakdown.items[0]).toMatchObject({
      key: "music",
      grossRevenue: 2500,
      netRevenue: 2500,
      repositoryAmount: 1500,
      creatorAmount: 1000,
      transactions: 1,
    });
    expect(repository.recentEntries[0]).toMatchObject({
      itemTitle: "Ledger-backed Track",
      providerRef: "finance_wallet_ref",
      grossAmount: 2500,
      netRevenueAmount: 2500,
      repositoryAmount: 1500,
      creatorAmount: 1000,
    });

    const ledger = await buildRevenueLedgerSummary({ range: "30d" });
    expect(ledger.summary).toMatchObject({
      totalEntries: 3,
      paymentSettled: 1,
      platformCommissionReserved: 1500,
      creatorEarningCredited: 1000,
    });
    expect(ledger.balances).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountType: "creator",
          balanceScope: "available",
          balance: 1000,
        }),
        expect.objectContaining({
          accountType: "platform",
          balanceScope: "commission",
          balance: 1500,
        }),
      ])
    );
  });

  test("nets a processed chargeback against repository and creator earnings", async () => {
    const saleAt = new Date("2026-06-30T12:00:00.000Z");
    const chargebackAt = new Date("2026-07-15T12:00:00.000Z");
    const creator = await createCreator();
    const track = await Track.create({
      _id: new mongoose.Types.ObjectId(),
      creatorId: creator.profile._id,
      title: "Chargeback Track",
      description: "Premium release",
      price: 2500,
      audioUrl: "https://example.com/full-track.mp3",
      previewUrl: "https://example.com/preview-track.mp3",
      kind: "music",
      creatorCategory: "music",
      contentType: "track",
      publishedStatus: "published",
      isPublished: true,
    });

    const purchase = await Purchase.create({
      userId: new mongoose.Types.ObjectId(),
      creatorId: creator.profile._id,
      itemType: "track",
      itemId: track._id,
      amount: 2500,
      priceNGN: 2500,
      currency: "NGN",
      status: "paid",
      provider: "paystack",
      providerRef: "finance_chargeback_ref",
      paidAt: saleAt,
    });

    await reconcilePaidPurchaseWalletEntries({ logger: null, reason: "test" });
    const platformFee = await WalletEntry.findOne({
      ownerType: "platform",
      entryType: "platform_fee",
      sourceId: purchase._id,
    }).lean();

    await WalletEntry.create({
      walletAccountId: platformFee.walletAccountId,
      ownerType: "platform",
      ownerId: null,
      currency: "NGN",
      direction: "debit",
      bucket: "available",
      entryType: "chargeback_debit",
      amount: 600,
      grossAmount: 1000,
      sourceType: "dispute",
      sourceId: new mongoose.Types.ObjectId(),
      sourceRef: "DSP_REPOSITORY_TEST",
      dedupeKey: "repository_chargeback_platform_test",
      effectiveAt: chargebackAt,
      metadata: {
        ...platformFee.metadata,
        purchaseId: purchase._id.toString(),
        creatorAmount: 400,
        platformAmount: 600,
        netRevenueAmount: 1000,
        providerLossAmount: 1000,
      },
    });

    const repository = await buildCreatorFinanceRepository({
      range: "custom",
      startDate: "2026-07-01",
      endDate: "2026-07-31",
    });

    expect(repository.repository).toMatchObject({
      grossRevenue: 0,
      reversalGrossRevenue: 1000,
      refundedGrossRevenue: 0,
      chargebackGrossRevenue: 1000,
      netRevenue: -1000,
      repositoryAmount: -600,
      creatorAmount: -400,
      paidTransactions: 0,
      reversalEntries: 1,
    });
    expect(repository.breakdown.items[0]).toMatchObject({
      key: "music",
      grossRevenue: 0,
      reversalGrossRevenue: 1000,
      chargebackGrossRevenue: 1000,
      netRevenue: -1000,
      repositoryAmount: -600,
      creatorAmount: -400,
      transactions: 0,
      reversals: 1,
    });
    expect(repository.recentEntries[0]).toMatchObject({
      purchaseId: purchase._id.toString(),
      entryType: "chargeback_debit",
      direction: "debit",
      isReversal: true,
      sourceLabel: "Chargeback - Music Downloads & Stream Access",
      grossAmount: -1000,
      netRevenueAmount: -1000,
      repositoryAmount: -600,
      creatorAmount: -400,
    });
    expect(repository.recentEntries[0].id).not.toBe(purchase._id.toString());
  });
});
