const mongoose = require("mongoose");

const CommunityLoopProgram = require("../models/CommunityLoopProgram");
const CreatorServiceEnrollment = require("../models/CreatorServiceEnrollment");
const MarketReadinessReview = require("../models/MarketReadinessReview");
const PartnerIntegration = require("../models/PartnerIntegration");
const {
  CREATOR_BUSINESS_NETWORK_MODEL,
  CREATOR_SERVICE_CATALOG,
  PARTNER_INTEGRATION_STANDARDS,
  buildCommunityLoops,
  buildCreatorServices,
  buildEcosystemNetworkOperatingView,
  buildMarketReadiness,
  buildPartnerIntegrations,
} = require("../services/ecosystemNetworkOperatingService");

const now = new Date("2026-09-01T12:00:00.000Z");

const expansion = {
  summary: { roadmapPackagesComplete: 20 },
  campaignPackages: {
    packages: [{ key: "creator_drop_week", configuredCampaigns: 2, activeCampaigns: 1, reversible: true }],
  },
  fanRelationships: { summary: { usersClassified: 3, suppressed: 1 }, stages: [] },
  unitEconomics: {
    summary: { grossRevenue: 1000, knownCreatorEarnings: 800, knownContribution: 150, completenessState: "partial" },
    instrumentationGaps: ["Support cost proxy is not instrumented."],
    topLevers: [{ key: "instrument_costs", action: "Instrument missing cost categories." }],
  },
  expansionGovernance: { decisions: [] },
  operationsAutomation: { suggestions: [] },
  nextRoadmap: { rankedCandidates: [{ key: "fan_community_depth" }] },
};

describe("next twenty-five platform, ecosystem, and network operating services", () => {
  test("publishes exactly the next twenty-five packages and does not claim a network launch", () => {
    const view = buildEcosystemNetworkOperatingView({ expansion, now });

    expect(view.roadmapPackages).toHaveLength(25);
    expect(view.summary.roadmapPackagesComplete).toBe(25);
    expect(view.roadmapPackages[0].key).toBe("PLATFORM-007");
    expect(view.roadmapPackages.at(-1).key).toBe("NETWORK-001");
    expect(view.platform.campaignOperations.summary).toMatchObject({ configured: 2, live: 1, packagesWithRollback: 1 });
    expect(view.network.creatorBusinessNetworkModel.status).toBe("defined_not_launched");
    expect(view.readiness.platform.decision).toBe("hold_for_evidence");
    expect(view.dataLimits).toMatchObject({ fanLevelRowsExposed: false, ledgerReconciliationRequiredForExternalFinance: true });
  });

  test("defines eight creator services and reports only stored outcome evidence", () => {
    const rows = [{
      _id: new mongoose.Types.ObjectId(),
      creatorProfile: new mongoose.Types.ObjectId(),
      programKey: "launch_coaching",
      serviceTier: "basic_support",
      status: "completed",
      ownerName: "Creator Lead",
      ownerRole: "Creator growth",
      creatorConsentAt: now,
      baselineSnapshot: { earnings: 100 },
      outcomeSnapshot: {},
      steps: [{ key: "one", label: "One", complete: true }],
      reviewAt: now,
    }];
    const result = buildCreatorServices(rows);
    const launch = result.programs.find((program) => program.key === "launch_coaching");

    expect(CREATOR_SERVICE_CATALOG).toHaveLength(8);
    expect(result.programs).toHaveLength(8);
    expect(result.enrollments[0].observedOutcome).toMatchObject({ evidenceState: "not_observed", earningsMovement: null });
    expect(launch.recommendation).toBe("repeat_with_measurement");
    expect(result.truthBoundary).toMatch(/not merged or inferred/i);
  });

  test("keeps community reporting aggregate and pauses on stored complaint evidence", () => {
    const rows = [{
      _id: new mongoose.Types.ObjectId(),
      loopKey: "creator_one_saved_loop",
      loopType: "saved_content_completion",
      status: "running",
      scopeType: "creator",
      scopeId: "creator-one",
      ownerName: "Lifecycle Lead",
      ownerRole: "Lifecycle growth",
      primaryMetric: "completion_after_save",
      guardrailMetrics: ["complaint_rate"],
      maxMessagesPerSevenDays: 1,
      ignoredPromptLimit: 2,
      complaintPauseThreshold: 0.02,
      referralAbuseChecksRequired: true,
      reviewAt: "2026-09-02T00:00:00.000Z",
      stopCondition: "Pause on complaint",
    }];
    const result = buildCommunityLoops({
      rows,
      now,
      events: [
        { type: "community_loop_prompted", metadata: { communityLoopKey: "creator_one_saved_loop", privateFanId: "fan-secret" } },
        { type: "notification_complaint", metadata: { communityLoopKey: "creator_one_saved_loop", privateFanId: "fan-secret" } },
      ],
    });

    expect(result.programs[0]).toMatchObject({ guardrailState: "pause_and_review", evidenceState: "partial_attributed_evidence" });
    expect(JSON.stringify(result)).not.toContain("fan-secret");
    expect(result.privacyBoundary).toMatch(/private fan rows/i);
  });

  test("scopes partner access and market launch through explicit gates", () => {
    const integrations = buildPartnerIntegrations([{
      _id: new mongoose.Types.ObjectId(),
      integrationKey: "campus_partner",
      partnerName: "Campus Partner",
      partnerType: "school",
      level: "scoped_dashboard_access",
      status: "active",
      ownerName: "Partner Lead",
      ownerRole: "Partnerships",
      allowedData: ["bounded_aggregate_dashboard"],
      prohibitedData: PARTNER_INTEGRATION_STANDARDS[0].prohibitedData,
      creatorConsentRequired: true,
      creatorConsentAt: now,
      privacyReviewedBy: new mongoose.Types.ObjectId(),
      privacyReviewedAt: now,
      auditEvent: "partner_access",
      renewalMetric: "value_and_load",
      accessExpiresAt: "2026-10-01T00:00:00.000Z",
      reviewAt: "2026-09-15T00:00:00.000Z",
    }], now);
    const markets = buildMarketReadiness([{
      _id: new mongoose.Types.ObjectId(),
      marketKey: "kaduna_music",
      marketName: "Kaduna Music",
      marketType: "community",
      state: "creator_seed",
      ownerName: "Expansion Lead",
      ownerRole: "Expansion",
      gates: [],
      primaryMetric: "activation",
      costCap: 100000,
      currency: "NGN",
      stopCondition: "Hold on trust breach",
      reviewAt: "2026-09-15T00:00:00.000Z",
    }], now);

    expect(integrations.summary).toMatchObject({ active: 1, pendingPrivacyReview: 0, pendingCreatorConsent: 0 });
    expect(integrations.integrations[0].fanLevelRowsExposed).toBe(false);
    expect(markets.markets[0].summary).toMatchObject({ ready: 0, total: 10 });
    expect(markets.markets[0].controlledLaunchEligible).toBe(false);
  });

  test("enforces model-level consent, privacy, and controlled-launch boundaries", async () => {
    const userId = new mongoose.Types.ObjectId();
    const creatorId = new mongoose.Types.ObjectId();

    const premiumWithoutTerms = new CreatorServiceEnrollment({
      creatorProfile: creatorId, creatorUser: userId, programKey: "launch_coaching", serviceTier: "premium_service", status: "candidate",
      ownerName: "Lead", ownerRole: "Growth", creatorCommitment: "Commit", expectedOutcome: "Outcome", successMetric: "metric",
      graduationCondition: "Graduate", escalationPath: "Escalate", reviewAt: now, createdBy: userId,
    });
    await expect(premiumWithoutTerms.validate()).rejects.toThrow(/commercial terms/i);

    const privateLoop = new CommunityLoopProgram({
      loopKey: "unsafe_loop", loopType: "saved_content_completion", status: "draft", ownerName: "Lead", ownerRole: "Growth",
      scopeType: "creator", scopeId: "creator-one", eligibility: "Eligible", primaryMetric: "completion", guardrailMetrics: ["complaint_rate"],
      privateFanRowsExposed: true, stopCondition: "Pause", startAt: now, endAt: "2026-09-10T00:00:00.000Z", reviewAt: "2026-09-05T00:00:00.000Z", createdBy: userId,
    });
    await expect(privateLoop.validate()).rejects.toThrow(/private fan-level rows/i);

    const unsafePartner = new PartnerIntegration({
      integrationKey: "unsafe_partner", partnerName: "Unsafe", partnerType: "brand", level: "scoped_dashboard_access", status: "active",
      ownerName: "Lead", ownerRole: "Partnerships", allowedData: ["aggregate"], prohibitedData: [], creatorConsentRequired: true,
      revocationPath: "Revoke", auditEvent: "partner_access", renewalMetric: "value", accessExpiresAt: "2026-10-01T00:00:00.000Z", reviewAt: now, createdBy: userId,
    });
    await expect(unsafePartner.validate()).rejects.toThrow(/must prohibit payment/i);

    const prematureMarket = new MarketReadinessReview({
      marketKey: "premature", marketName: "Premature", marketType: "community", state: "controlled_launch", ownerName: "Lead", ownerRole: "Expansion",
      gates: [], primaryMetric: "activation", costCap: 1000, stopCondition: "Hold", reviewAt: now, createdBy: userId,
    });
    await expect(prematureMarket.validate()).rejects.toThrow(/all readiness gates/i);
    expect(CREATOR_BUSINESS_NETWORK_MODEL.prohibitedCapabilities).toContain("pooled_creator_wallet");
  });
});
