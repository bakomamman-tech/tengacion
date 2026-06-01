const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";

const CreatorProfile = require("../models/CreatorProfile");
const Purchase = require("../models/Purchase");
const User = require("../models/User");
const {
  FINANCING_PATH_DEFINITIONS,
  USE_OF_FUNDS_DEFINITIONS,
  buildCapitalReadiness,
} = require("../services/capitalReadinessService");

let mongod;

const createCreatorProfile = async () => {
  const user = await User.create({
    name: "Capital Creator",
    username: "capital_creator",
    email: "capital-creator@example.com",
    password: "Password123!",
    role: "artist",
    isArtist: true,
    isVerified: true,
  });

  const profile = await CreatorProfile.create({
    userId: user._id,
    displayName: "Capital Creator",
    fullName: "Capital Creator",
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

describe("capitalReadinessService", () => {
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

  test("returns a capital roadmap operating view with conservative external-use labels", async () => {
    const report = await buildCapitalReadiness({ range: "30d" });

    expect(report.capitalPlan).toMatchObject({
      key: "capital_readiness",
      owner: "Product leadership",
    });
    expect(report.scorecard).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "trusted_gmv",
          state: "evidence_needed",
          externalUseAllowed: false,
        }),
        expect.objectContaining({
          key: "akuso_governance",
          owner: "AI and assistant",
        }),
      ])
    );
    expect(report.runwayScenarios).toHaveLength(4);
    expect(report.runwayScenarios).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "base",
          runwayStatus: "cash_balance_required",
          inputLabels: expect.arrayContaining([
            expect.objectContaining({
              key: "starting_cash_balance",
              classification: "not_configured",
            }),
            expect.objectContaining({
              key: "dispute_reserve",
              classification: "coverage_gap",
            }),
          ]),
        }),
      ])
    );
    expect(report.useOfFundsGates).toHaveLength(USE_OF_FUNDS_DEFINITIONS.length);
    expect(report.useOfFundsGates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "akuso_ai",
          stopLossRule: expect.stringContaining("Pause AI expansion"),
        }),
      ])
    );
    expect(report.capitalPathOptions).toHaveLength(FINANCING_PATH_DEFINITIONS.length);
    expect(report.capitalPathOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "delay_capital_and_prove_milestones",
          status: "plausible",
        }),
      ])
    );
    expect(report.claimRegister).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "gmv_revenue_claim",
          approvalState: "internal_only",
          externalUseAllowed: false,
        }),
      ])
    );
    expect(report.riskRegister).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "finance_gap_provider_dispute_feed",
        }),
        expect.objectContaining({
          key: "scenario_inputs_not_external",
        }),
      ])
    );
  });

  test("withdraws capital claims when finance evidence is blocked", async () => {
    const creator = await createCreatorProfile();
    await Purchase.create({
      userId: new mongoose.Types.ObjectId(),
      creatorId: creator.profile._id,
      itemType: "track",
      itemId: new mongoose.Types.ObjectId(),
      amount: 5000,
      priceNGN: 5000,
      currency: "NGN",
      status: "paid",
      provider: "paystack",
      providerRef: "capital_missing_wallet_and_entitlement",
      paidAt: new Date(),
    });

    const report = await buildCapitalReadiness({ range: "30d", startingCashBalance: 250000 });

    expect(report.summary.recommendedPath).toMatchObject({
      key: "delay_capital_and_prove_milestones",
    });
    expect(report.scorecard).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "trusted_gmv",
          state: "not_ready",
          externalUseAllowed: false,
        }),
        expect.objectContaining({
          key: "creator_earnings_confidence",
          state: expect.stringMatching(/not_ready|remediation_needed/),
        }),
      ])
    );
    expect(report.claimRegister).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "gmv_revenue_claim",
          approvalState: "withdrawn",
          externalUseAllowed: false,
        }),
      ])
    );
    expect(report.runwayScenarios).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "base",
          runwayStatus: "modeled_from_inputs",
          runwayMonths: expect.any(Number),
        }),
      ])
    );
    expect(report.riskRegister).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Trusted GMV",
          severity: "critical",
        }),
      ])
    );
  });
});
