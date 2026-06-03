const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";

const CreatorProfile = require("../models/CreatorProfile");
const Purchase = require("../models/Purchase");
const User = require("../models/User");
const {
  ASSURANCE_EVIDENCE_PACKS,
  CONTROL_DEFINITIONS,
  DATA_PRODUCT_EVIDENCE_PACKS,
  EVIDENCE_PACK_STANDARD,
  LAUNCH_GATE_DEFINITIONS,
  LAUNCH_GATE_STATES,
  LAUNCH_ROLLBACK_PLANS,
  LAUNCH_SUPPORT_MACROS,
  METRIC_CONTRACT_DEFINITIONS,
  PARTNER_API_MARKET_EVIDENCE_PACKS,
  buildAssuranceDashboard,
} = require("../services/assuranceDashboardService");

let mongod;

const createCreatorProfile = async () => {
  const user = await User.create({
    name: "Registry Creator",
    username: "registry_creator",
    email: "registry-creator@example.com",
    password: "Password123!",
    role: "artist",
    isArtist: true,
    isVerified: true,
  });

  const profile = await CreatorProfile.create({
    userId: user._id,
    displayName: "Registry Creator",
    fullName: "Registry Creator",
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

describe("assuranceDashboardService", () => {
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

  test("returns the assurance control registry and evidence pack standard", async () => {
    const dashboard = await buildAssuranceDashboard({ range: "30d" });

    expect(dashboard.dashboard).toMatchObject({
      key: "assurance_dashboard",
      owner: "Product leadership",
      reviewer: "Assurance review board",
    });
    expect(dashboard.summary.totalControls).toBe(CONTROL_DEFINITIONS.length);
    expect(dashboard.summary.evidencePackCount).toBe(ASSURANCE_EVIDENCE_PACKS.length);
    expect(dashboard.summary.metricContractCount).toBe(METRIC_CONTRACT_DEFINITIONS.length);
    expect(dashboard.controls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          controlKey: "finance_revenue_close",
          owner: "Finance and operations",
          evidenceFreshness: "current",
        }),
        expect.objectContaining({
          controlKey: "partner_export_access_review",
          evidenceFreshness: "delayed",
          automationStatus: "manual",
        }),
        expect.objectContaining({
          controlKey: "akuso_high_risk_boundaries",
          reviewer: "Security and compliance",
        }),
      ])
    );
    expect(dashboard.evidencePackStandard).toEqual(EVIDENCE_PACK_STANDARD);
    expect(PARTNER_API_MARKET_EVIDENCE_PACKS.length).toBe(3);
    expect(DATA_PRODUCT_EVIDENCE_PACKS.length).toBe(3);
    expect(dashboard.evidencePacks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "partner_assurance_pack",
          readinessState: "needs_review",
          evidenceFreshness: "delayed",
          sharingLevel: "partner_shareable_after_review",
          requiredEvidence: expect.arrayContaining([
            expect.objectContaining({
              key: "access_scope",
              status: "pending",
            }),
            expect.objectContaining({
              key: "revocation_path",
              status: "pending",
            }),
          ]),
        }),
        expect.objectContaining({
          key: "api_assurance_pack",
          blockingControls: ["api_access_review"],
        }),
        expect.objectContaining({
          key: "market_assurance_pack",
          reviewer: "Trust, policy, and legal",
        }),
        expect.objectContaining({
          key: "metric_contract_registry",
          workstream: "data_product",
          requiredEvidence: expect.arrayContaining([
            expect.objectContaining({
              key: "gmv",
              status: "pending",
            }),
            expect.objectContaining({
              key: "recommendation_clicks",
              status: "pending",
            }),
          ]),
        }),
        expect.objectContaining({
          key: "experiment_assurance_pack",
          blockingControls: expect.arrayContaining(["experiment_guardrails", "data_contract_coverage"]),
        }),
        expect.objectContaining({
          key: "recommendation_assurance_pack",
          owner: "Discovery and analytics",
        }),
      ])
    );
    expect(dashboard.metricContracts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "gmv",
          trustState: "trusted",
          externalUseAllowed: true,
          controlKeys: ["finance_revenue_close", "wallet_settlement_accuracy"],
        }),
        expect.objectContaining({
          key: "subscription_retention",
          trustState: "needs_contract",
          externalUseAllowed: false,
          blockingControls: ["data_contract_coverage"],
        }),
        expect.objectContaining({
          key: "recommendation_clicks",
          sourceSystem: "recommendation_logs",
        }),
      ])
    );
    expect(dashboard.readinessGates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "finance_close_readiness" }),
        expect.objectContaining({ key: "akuso_readiness" }),
      ])
    );
    expect(dashboard.launchCommandCenter).toMatchObject({
      key: "launch_command_center",
      owner: "Product and launch",
      gateStates: LAUNCH_GATE_STATES,
      summary: expect.objectContaining({
        totalGates: LAUNCH_GATE_DEFINITIONS.length,
        readyCount: expect.any(Number),
        watchCount: expect.any(Number),
        blockedCount: expect.any(Number),
        rollbackRequiredCount: expect.any(Number),
      }),
    });
    expect(dashboard.launchCommandCenter.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "checkout_callbacks",
          gateState: "ready",
          rollbackPlanKey: "checkout_failures",
        }),
        expect.objectContaining({
          key: "notification_delivery",
          owner: "Fan growth",
          rollbackPlanKey: "notification_misfires",
        }),
        expect.objectContaining({
          key: "support_moderation_coverage",
          controlKeys: expect.arrayContaining(["moderation_appeal_assurance"]),
        }),
      ])
    );
    expect(dashboard.launchCommandCenter.rollbackPlans).toHaveLength(LAUNCH_ROLLBACK_PLANS.length);
    expect(dashboard.launchCommandCenter.supportMacros).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "payment_succeeded_content_locked" }),
        expect.objectContaining({ key: "akuso_unsafe_or_incorrect_answer" }),
      ])
    );
    expect(LAUNCH_SUPPORT_MACROS.length).toBeGreaterThanOrEqual(8);
  });

  test("surfaces finance blockers as control registry alerts", async () => {
    const creator = await createCreatorProfile();
    await Purchase.create({
      userId: new mongoose.Types.ObjectId(),
      creatorId: creator.profile._id,
      itemType: "track",
      itemId: new mongoose.Types.ObjectId(),
      amount: 2500,
      priceNGN: 2500,
      currency: "NGN",
      status: "paid",
      provider: "paystack",
      providerRef: "assurance_registry_gap",
      paidAt: new Date(),
    });

    const dashboard = await buildAssuranceDashboard({ range: "30d" });

    expect(dashboard.summary).toMatchObject({
      readinessState: "blocked",
      blockerCount: expect.any(Number),
      highSeverityCount: expect.any(Number),
    });
    expect(dashboard.controls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          controlKey: "purchase_entitlement_continuity",
          readinessState: "blocked",
          exceptionSeverity: "critical",
        }),
        expect.objectContaining({
          controlKey: "wallet_settlement_accuracy",
          readinessState: "blocked",
          exceptionSeverity: "critical",
        }),
      ])
    );
    expect(dashboard.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          controlKey: "purchase_entitlement_continuity",
          severity: "critical",
        }),
      ])
    );
    expect(dashboard.evidencePacks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "market_assurance_pack",
          readinessState: "blocked",
          openRisks: expect.arrayContaining([
            expect.objectContaining({
              controlKey: "finance_revenue_close",
              severity: "critical",
            }),
            expect.objectContaining({
              controlKey: "purchase_entitlement_continuity",
              readinessState: "blocked",
            }),
          ]),
        }),
      ])
    );
    expect(dashboard.metricContracts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "gmv",
          trustState: "blocked",
          externalUseAllowed: false,
          blockingControls: expect.arrayContaining([
            "finance_revenue_close",
            "wallet_settlement_accuracy",
          ]),
        }),
        expect.objectContaining({
          key: "recommendation_conversions",
          trustState: "blocked",
          blockingControls: expect.arrayContaining(["purchase_entitlement_continuity"]),
        }),
      ])
    );
    expect(dashboard.launchCommandCenter.summary).toMatchObject({
      overallState: "rollback_required",
      expansionPaused: true,
      rollbackRequiredCount: expect.any(Number),
    });
    expect(dashboard.launchCommandCenter.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "entitlement_unlocks",
          gateState: "rollback_required",
          rollbackPlanKey: "entitlement_delays",
          openIssues: expect.arrayContaining([
            expect.objectContaining({
              kind: "reliability",
              key: "entitlement_reconciliation",
              gateState: "rollback_required",
            }),
          ]),
        }),
      ])
    );
  });
});
