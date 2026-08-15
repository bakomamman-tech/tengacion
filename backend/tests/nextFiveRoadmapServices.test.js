const {
  buildCreatorGrowthExperiments,
} = require("../services/creatorGrowthExperimentService");
const {
  buildFanRetentionCohortsFromRows,
} = require("../services/fanRetentionCohortService");
const {
  applyGovernedOrdering,
} = require("../services/rankingService");
const {
  getMaxContentTypeStreak,
  normalizePolicy,
} = require("../services/recommendationGovernanceService");
const {
  buildStaticAkusoReleaseGate,
} = require("../services/assistant/releaseGateService");
const {
  getMetricStatus,
} = require("../services/executiveOperatingDashboardService");

describe("next five Tengacion roadmap services", () => {
  test("personalizes creator experiments and uses dismissals to improve selection", () => {
    const payload = buildCreatorGrowthExperiments({
      activation: { progressPercent: 100, steps: [{ key: "payout_ready", complete: true }] },
      payoutReadiness: { ready: true },
      profile: {
        bio: "Creator bio",
        subscriptionDescription: "Monthly studio updates",
        subscriptionBenefits: ["Early access"],
        subscriptionPrice: 2000,
      },
      contentItems: [
        {
          id: "track-1",
          title: "First release",
          description: "A complete release description for fans.",
          price: 1000,
          raw: { previewUrl: "https://cdn.test/preview.mp3" },
          createdAt: "2026-01-05T00:00:00.000Z",
          updatedAt: "2026-01-05T00:00:00.000Z",
        },
      ],
      recentSales: [],
      recentSubscribers: [],
      growthEvents: [
        {
          targetId: "first_paid_product_launch",
          contentType: "dismissed",
          createdAt: "2026-01-08T00:00:00.000Z",
        },
      ],
      now: new Date("2026-01-10T00:00:00.000Z"),
    });

    expect(payload.stage).toBe("conversion");
    expect(payload.dismissedCount).toBe(1);
    expect(payload.experiments.map((item) => item.key)).not.toContain("first_paid_product_launch");
    expect(payload.experiments[0].key).toBe("follower_announcement");
    expect(payload.summary.dismissed).toBe(1);
    expect(payload.experiments.every((item) => item.measurement.purchaseLift === 0)).toBe(true);
  });

  test("builds mature D1, D7, and D30 fan cohorts without counting future windows", () => {
    const eventRows = [
      { userId: "fan-1", type: "creator_followed", createdAt: "2026-01-01T00:00:00.000Z" },
      { userId: "fan-1", type: "route_viewed", createdAt: "2026-01-02T04:00:00.000Z" },
      { userId: "fan-1", type: "route_viewed", createdAt: "2026-01-08T03:00:00.000Z" },
      { userId: "fan-1", type: "route_viewed", createdAt: "2026-01-31T02:00:00.000Z" },
      { userId: "fan-2", type: "live_joined", createdAt: "2026-01-20T00:00:00.000Z" },
    ];
    const purchaseRows = [
      { userId: "fan-1", status: "paid", itemType: "track", paidAt: "2026-01-03T00:00:00.000Z" },
      { userId: "fan-1", status: "paid", itemType: "track", paidAt: "2026-01-10T00:00:00.000Z" },
      { userId: "fan-1", status: "paid", itemType: "subscription", paidAt: "2026-01-15T00:00:00.000Z" },
      { userId: "fan-1", status: "paid", itemType: "subscription", paidAt: "2026-02-15T00:00:00.000Z" },
    ];
    const payload = buildFanRetentionCohortsFromRows({
      eventRows,
      purchaseRows,
      users: [
        { _id: "fan-1", notificationPrefs: { likes: true, messages: false } },
        { _id: "fan-2", notificationPrefs: { likes: true, messages: true } },
      ],
      start: "2026-01-01T00:00:00.000Z",
      end: "2026-02-28T23:59:59.999Z",
      observedThrough: "2026-02-28T23:59:59.999Z",
    });

    const followCohort = payload.cohorts.find((cohort) => cohort.key === "first_follow");
    const liveCohort = payload.cohorts.find((cohort) => cohort.key === "first_live_join");
    expect(followCohort).toMatchObject({
      entrants: 1,
      repeatPurchaseRate: 1,
      subscriptionConversionRate: 1,
      notificationOptOutRate: 1,
    });
    expect(followCohort.retention.d1.rate).toBe(1);
    expect(followCohort.retention.d7.rate).toBe(1);
    expect(followCohort.retention.d30.rate).toBe(1);
    expect(liveCohort.retention.d30.mature).toBe(true);
    expect(payload.summary.d30Eligible).toBe(3);
    expect(payload.summary.d30RetentionRate).toBe(0.3333);
    expect(payload.window.maturityRule).toMatch(/24-hour activity window/i);
  });

  test("enforces creator caps, type streaks, and a safe exploration share", () => {
    const policy = normalizePolicy({
      maxRepeatedCreatorCount: 2,
      maxContentTypeStreak: 1,
      minimumExplorationShare: 0.4,
    });
    const items = [
      { candidateId: "a", creatorId: "creator-1", authorUserId: "user-1", contentType: "track" },
      { candidateId: "b", creatorId: "creator-1", authorUserId: "user-1", contentType: "track" },
      { candidateId: "c", creatorId: "creator-1", authorUserId: "user-1", contentType: "book" },
      { candidateId: "d", creatorId: "creator-2", authorUserId: "user-2", contentType: "book" },
      { candidateId: "e", creatorId: "creator-3", authorUserId: "user-3", contentType: "track" },
    ];
    const ordered = applyGovernedOrdering({
      items,
      limit: 5,
      policy,
      affinity: {
        relationshipSets: {
          followingUserIds: new Set(["user-1"]),
          friendUserIds: new Set(),
          followingCreatorIds: new Set(["creator-1"]),
          friendCreatorIds: new Set(),
          purchaseCreatorIds: new Set(),
        },
      },
    });

    const creatorOneCount = ordered.filter((item) => item.creatorId === "creator-1").length;
    expect(creatorOneCount).toBeLessThanOrEqual(2);
    expect(ordered.filter((item) => item.isExploration)).toHaveLength(2);
    expect(getMaxContentTypeStreak(ordered.map((item, index) => ({ entityType: item.contentType, rank: index + 1 })))).toBeLessThanOrEqual(1);
  });

  test("blocks Akuso releases on eval failures and exposes the complete checklist", () => {
    const gate = buildStaticAkusoReleaseGate();
    expect(gate.reportId).toMatch(/^akuso-gate-/);
    expect(gate.checks.map((check) => check.key)).toEqual(
      expect.arrayContaining([
        "eval_report_generated",
        "critical_safety",
        "route_targets",
        "feature_grounding",
        "commerce_guidance",
        "fallback_quality",
      ])
    );
    expect(gate.eval.failedCritical).toBe(0);
    expect(gate.eval.failedRouteTargets).toEqual([]);
  });

  test("assigns target status in the executive metric contract", () => {
    expect(getMetricStatus({ current: 0.96, target: 0.95 })).toBe("on_target");
    expect(getMetricStatus({ current: 0.8, target: 0.95 })).toBe("watch");
    expect(getMetricStatus({ current: 3, target: 0, direction: "lower" })).toBe("off_target");
    expect(getMetricStatus({ current: 0, target: 1, hasData: false })).toBe("no_data");
  });
});
