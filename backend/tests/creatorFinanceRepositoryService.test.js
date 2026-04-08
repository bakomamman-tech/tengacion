const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";

const CreatorProfile = require("../models/CreatorProfile");
const Purchase = require("../models/Purchase");
const Track = require("../models/Track");
const User = require("../models/User");
const { buildCreatorFinanceRepository } = require("../services/creatorFinanceRepositoryService");
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
      repositoryAmount: 1500,
      creatorAmount: 1000,
      paidTransactions: 1,
      activeCreators: 1,
    });
    expect(repository.breakdown.items[0]).toMatchObject({
      key: "music",
      grossRevenue: 2500,
      repositoryAmount: 1500,
      creatorAmount: 1000,
      transactions: 1,
    });
    expect(repository.recentEntries[0]).toMatchObject({
      itemTitle: "Ledger-backed Track",
      providerRef: "finance_wallet_ref",
      grossAmount: 2500,
      repositoryAmount: 1500,
      creatorAmount: 1000,
    });
  });
});
