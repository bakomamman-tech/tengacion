const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";

const CreatorProfile = require("../models/CreatorProfile");
const Purchase = require("../models/Purchase");
const User = require("../models/User");
const WalletAccount = require("../models/WalletAccount");
const WalletEntry = require("../models/WalletEntry");
const {
  buildCreatorWalletSummary,
  reconcilePaidPurchaseWalletEntries,
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

const createPurchase = async ({ creatorId, amount, status = "paid", providerRef }) =>
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

    const secondRun = await reconcilePaidPurchaseWalletEntries({ logger: null, reason: "test" });
    expect(secondRun.createdCount).toBe(0);
    expect(await WalletEntry.countDocuments({})).toBe(4);
  });
});
