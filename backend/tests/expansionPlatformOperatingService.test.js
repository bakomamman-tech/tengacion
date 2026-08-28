const mongoose = require("mongoose");

const AutomationSuggestion = require("../models/AutomationSuggestion");
const ExpansionExperiment = require("../models/ExpansionExperiment");
const GovernanceDecision = require("../models/GovernanceDecision");
const ReferralAttribution = require("../models/ReferralAttribution");
const {
  buildCreatorBusinessSuite,
  buildExpansionPlatformOperatingView,
  buildFanRelationshipReport,
  buildReferralReporting,
  buildUnitEconomics,
  planReadinessChecks,
} = require("../services/expansionPlatformOperatingService");
const { buildWritingFallbackDraft } = require("../services/assistant/writingProfiles");

const now = new Date("2026-08-28T12:00:00.000Z");

describe("expansion and platform roadmap operating services", () => {
  test("publishes exactly the next twenty roadmap packages and shared platform objects", () => {
    const view = buildExpansionPlatformOperatingView({
      now,
      scale: {
        sloBudgets: { summary: { expansionPaused: true } },
        expansionScorecard: {
          bets: [{
            betKey: "kaduna_music", state: "controlled_launch", averageScore: 4.2,
            ownerName: "Growth Lead", cohortDefinition: "Kaduna music creators", gate: "Reliability ready",
            stopCondition: "Hold on refund breach", reviewAt: "2026-09-15T00:00:00.000Z",
          }],
        },
      },
      planRows: [], referralRows: [], experimentRows: [], automationRows: [], decisionRows: [], campaignRows: [], partnerRows: [], users: [], events: [], purchases: [], profileRows: [],
    });

    expect(view.roadmapPackages).toHaveLength(20);
    expect(view.summary.roadmapPackagesComplete).toBe(20);
    expect(view.platform.objectModel.map((item) => item.key)).toEqual(expect.arrayContaining(["campaign", "offer", "experiment", "governance_review"]));
    expect(view.expansionCohorts.reviews[0]).toMatchObject({ decision: "hold", evidenceState: "no_attributed_data" });
    expect(view.platform.launchPlanner).toMatchObject({ active: true, elevatedRiskReviewRequired: true });
  });

  test("keeps referral reporting aggregate and separates every roadmap source", () => {
    const report = buildReferralReporting([
      { sourceType: "creator_profile_share", counters: { inviteSent: 4, linkOpened: 3, signup: 2, firstFollow: 1 } },
      { sourceType: "partner_link", privateFanId: "fan-secret", counters: { inviteSent: 2, linkOpened: 1, firstPurchase: 1 } },
    ]);
    const serialized = JSON.stringify(report);

    expect(report.summary).toMatchObject({ inviteSent: 6, linkOpened: 4, signup: 2, firstFollow: 1, firstPurchase: 1 });
    expect(report.bySource.map((row) => row.sourceType)).toEqual(["creator_profile_share", "partner_link"]);
    expect(report.privacyBoundary).toMatchObject({ userIdsExposed: false, privateFanBehaviorExposed: false });
    expect(serialized).not.toContain("fan-secret");
  });

  test("classifies fan relationships without returning fan rows and honors suppressions", () => {
    const report = buildFanRelationshipReport({
      now,
      users: [
        { _id: "fan-1", notificationPrefs: { system: true } },
        { _id: "fan-2", notificationPrefs: { system: false } },
      ],
      events: [
        { userId: "fan-1", type: "creator_shared", createdAt: "2026-08-28T00:00:00.000Z" },
        { userId: "fan-2", type: "notification_complaint", createdAt: "2026-08-28T00:00:00.000Z" },
      ],
      purchases: [],
    });

    expect(report.stages.find((stage) => stage.key === "advocate").count).toBe(1);
    expect(report.stages.find((stage) => stage.key === "at_risk").count).toBe(1);
    expect(report.summary).toMatchObject({ usersClassified: 2, suppressed: 1, eligibleForPrompt: 1 });
    expect(report).not.toHaveProperty("fans");
  });

  test("reports only known contribution and exposes uninstrumented cost gaps", () => {
    const economics = buildUnitEconomics({
      purchases: [
        { creatorId: "creator-1", status: "paid", amount: 1000, creatorShareRate: 0.8, processingFeeAmount: 30, provider: "paystack" },
        { creatorId: "creator-1", status: "paid", amount: 500, creatorShareRate: null, processingFeeAmount: 15, provider: "paystack" },
        { creatorId: "creator-1", status: "refunded", amount: 200, provider: "paystack" },
      ],
      events: [{ type: "akuso_cost", metadata: { costType: "akuso_model_cost", costAmount: 10 } }],
      profileRows: [{ _id: "creator-1", creatorTypes: ["music"] }],
    });

    expect(economics.summary).toMatchObject({ grossRevenue: 1500, knownCreatorEarnings: 800, paymentFees: 45, refundAndDisputeLeakage: 200, instrumentedCosts: 10, knownContribution: 445, completenessState: "partial" });
    expect(economics.instrumentationGaps.join(" ")).toMatch(/no stored creator-share rate/i);
    expect(economics.truthBoundary).toMatch(/never infers/i);
  });

  test("builds all six creator playbooks and aggregate creator business-suite movement", () => {
    const suite = buildCreatorBusinessSuite({
      profile: { displayName: "Creator", bio: "Bio", country: "Nigeria", subscriptionDescription: "Monthly extras" },
      payoutReadiness: { ready: true },
      operatingConsole: { catalogHealth: { itemCount: 2, highImpactIssueCount: 0 } },
      planRows: [{
        _id: "plan-1", title: "Friday drop", planKey: "friday_drop", playbookType: "first_paid_music_drop", offerType: "paid_drop", status: "planning",
        launchAt: "2026-09-01T12:00:00.000Z", price: 2000, coverReady: true, previewReady: true, payoutReadySnapshot: true,
        announcementDraft: "Reviewed draft", fanUpdatePlan: "One consent-aware update", successMetric: "paid_unlocks", stopCondition: "Hold on refund breach",
        checklist: [{ key: "one", label: "Ready", complete: true }],
      }],
      referralRows: [{ counters: { inviteSent: 2, linkOpened: 1, firstFollow: 1 } }],
    });

    expect(suite.playbooks).toHaveLength(6);
    expect(suite.offerTypes).toEqual(expect.arrayContaining(["paid_drop", "bundle", "subscription_package", "live_event_pass", "marketplace_spotlight"]));
    expect(suite.summary).toMatchObject({ activePlans: 1, readyPlans: 1 });
    expect(suite.audienceRelationships).toMatchObject({ fanLevelRowsExposed: false, inviteSent: 2, linkOpened: 1, activated: 1 });
    expect(planReadinessChecks(suite.plans[0]).every((check) => check.complete)).toBe(true);
  });

  test("enforces safe model-level boundaries before persistence", async () => {
    const userId = new mongoose.Types.ObjectId();
    const unsafeAutomation = new AutomationSuggestion({
      suggestionType: "payout_queue_priority", targetType: "payout", targetId: "request-1", title: "Release payout", suggestedAction: "Move money", confidence: 0.9,
      sourceSignals: { queueAgeHours: 4 }, expiresAt: new Date("2026-09-01T00:00:00.000Z"), authorizesSensitiveAction: true, createdBy: userId,
    });
    await expect(unsafeAutomation.validate()).rejects.toThrow(/cannot authorize sensitive actions/i);

    const weakGovernance = new GovernanceDecision({
      decisionKey: "high_risk_test", workflowType: "sponsored_campaign", subjectType: "campaign", subjectId: "campaign-1", title: "Sponsor review",
      ownerName: "Growth Lead", ownerRole: "Growth", riskLevel: "high", requiredReviewRoles: ["product"], rollbackPlan: "Pause campaign",
      expiresAt: new Date("2026-10-01T00:00:00.000Z"), followUpAt: new Date("2026-09-01T00:00:00.000Z"), createdBy: userId,
    });
    await expect(weakGovernance.validate()).rejects.toThrow(/at least two independent review roles/i);

    const badReferral = new ReferralAttribution({
      token: "a".repeat(40), sourceType: "creator_profile_share", destinationPath: "https://external.test", expiresAt: new Date("2026-09-01T00:00:00.000Z"), createdBy: userId,
    });
    await expect(badReferral.validate()).rejects.toThrow(/safe internal path/i);

    const badExperiment = new ExpansionExperiment({
      experimentKey: "bad_allocation", name: "Bad allocation", hypothesis: "A change helps", ownerName: "Data Lead", cohort: "New fans", surface: "home",
      variants: [{ key: "control", description: "Control", allocationPercent: 40 }, { key: "test", description: "Test", allocationPercent: 40 }],
      primaryMetric: "activation", guardrailMetrics: ["complaint_rate"], stopCondition: "Stop on complaint breach",
      startAt: new Date("2026-09-01T00:00:00.000Z"), endAt: new Date("2026-09-08T00:00:00.000Z"), decisionAt: new Date("2026-09-09T00:00:00.000Z"), createdBy: userId,
    });
    await expect(badExperiment.validate()).rejects.toThrow(/allocation must total 100/i);
  });

  test("provides deterministic expansion guidance with explicit authority boundaries", () => {
    const referral = buildWritingFallbackDraft({ contentType: "referral_guidance", topic: "my creator share" });
    const partner = buildWritingFallbackDraft({ contentType: "partner_report_summary", topic: "campus pilot" });
    const offer = buildWritingFallbackDraft({ contentType: "offer_setup_guidance", topic: "live event pass" });

    expect(referral.join(" ")).toMatch(/never private fan-level behavior/i);
    expect(partner.join(" ")).toMatch(/exclude user identifiers/i);
    expect(offer.join(" ")).toMatch(/cannot approve finance/i);
  });
});
