const {
  buildCampaignCalendar,
  buildFanRetentionInterventions,
  buildPartnerReporting,
  buildPerformanceCost,
  buildScaleEvidenceOperatingView,
  buildSloBudgets,
} = require("../services/scaleEvidenceOperatingService");
const { buildWritingFallbackDraft } = require("../services/assistant/writingProfiles");

const now = new Date("2026-08-27T12:00:00.000Z");

describe("scale evidence roadmap operating services", () => {
  test("measures a calendar entry against the eligible-creator baseline", () => {
    const calendar = buildCampaignCalendar({
      now,
      rows: [{
        _id: "entry-1",
        title: "September creator drop",
        entryKey: "september_creator_drop",
        type: "featured_drop",
        status: "ready",
        scheduledStartAt: "2026-08-27T00:00:00.000Z",
        scheduledEndAt: "2026-09-03T00:00:00.000Z",
        ownerName: "Growth Lead",
        ownerRole: "Growth",
        audience: "Fans of cohort creators",
        objective: "Convert qualified previews",
        callToAction: "Preview the drop",
        reportingKey: "september_creator_drop",
        creatorIds: ["creator-1"],
        contentIds: [],
      }],
      events: [{ type: "campaign_impression", metadata: { reportingKey: "september_creator_drop" }, createdAt: "2026-08-28T00:00:00.000Z" }],
      purchases: [
        { creatorId: "creator-1", status: "paid", itemType: "track", amount: 1000, creatorShareRate: 0.8, paidAt: "2026-08-29T00:00:00.000Z" },
        { creatorId: "creator-1", status: "paid", itemType: "track", amount: 500, creatorShareRate: 0.8, paidAt: "2026-08-20T00:00:00.000Z" },
      ],
    });

    expect(calendar.entries[0]).toMatchObject({ readinessState: "ready" });
    expect(calendar.entries[0].metrics).toMatchObject({ impressions: 1, purchases: 1, creatorEarnings: 800 });
    expect(calendar.entries[0].baselineComparison).toMatchObject({ currentGross: 1000, baselineGross: 500, grossChangePercent: 100 });
  });

  test("makes lifecycle suppression reasons visible", () => {
    const retention = buildFanRetentionInterventions({
      now,
      users: [{ _id: "fan-1", lastLogin: "2026-08-27T00:00:00.000Z", notificationPrefs: { system: false } }],
      events: [{ userId: "fan-1", type: "stream_started", createdAt: "2026-08-27T01:00:00.000Z" }],
      purchases: [],
    });

    expect(retention.interventions[0]).toMatchObject({
      key: "preview_no_purchase",
      deliveryState: "suppressed",
      suppressionReason: "system_notifications_disabled",
    });
    expect(retention.policy.requiredDimensions).toEqual(expect.arrayContaining(["lifecycle", "relationship", "consent", "complaint"]));
  });

  test("packages partner evidence without user-level identity or payment fields", () => {
    const partner = buildPartnerReporting({
      launch: { creatorLifecycle: { summary: { total: 12 } } },
      calendar: { summary: {}, entries: [] },
      purchases: [{ userId: "private-fan-1", providerRef: "secret-reference", status: "paid", amount: 2000, creatorShareRate: 0.75 }],
      payouts: [], reports: [], complaints: [],
    });
    const serialized = JSON.stringify(partner);

    expect(partner.privacyBoundary.aggregationOnly).toBe(true);
    expect(partner.commerce).toMatchObject({ grossMerchandiseValue: 2000, creatorEarnings: 1500, paidOrders: 1 });
    expect(serialized).not.toContain("private-fan-1");
    expect(serialized).not.toContain("secret-reference");
  });

  test("holds expansion when notification delivery is not instrumented", () => {
    const budgets = buildSloBudgets({ reliability: { snapshots: [] }, policyRows: [], events: [{ type: "paid_content_published_notification_sent" }] });
    const notification = budgets.policies.find((row) => row.key === "notification_delivery");

    expect(notification).toMatchObject({ state: "watch", expansionBlocked: true });
    expect(notification.evidence.total).toBe(0);
    expect(budgets.summary.expansionPaused).toBe(true);
  });

  test("exposes performance gaps and deterministic low-bandwidth controls", () => {
    const performance = buildPerformanceCost({ events: [{ type: "akuso_response", metadata: { durationMs: 320, payloadBytes: 2048 } }] });

    expect(performance.summary).toMatchObject({ averageRouteLatencyMs: 320, averagePayloadBytes: 2048, akusoAverageLatencyMs: 320 });
    expect(performance.lowBandwidth.automaticSignals).toEqual(expect.arrayContaining(["Save-Data"]));
    expect(performance.lowBandwidth.surfaces.map((row) => row.key)).toEqual(expect.arrayContaining(["creator_profile", "audio_preview", "book_preview", "akuso"]));
  });

  test("publishes all ten packages and a reliability-first 90-day decision", () => {
    const view = buildScaleEvidenceOperatingView({
      now,
      launch: { creatorLifecycle: { summary: { launchReady: 3 } }, fanLifecycle: { summary: {}, subscriptionDiagnostics: {} }, firstWeekActivation: { bySource: [] }, supportTrust: { queues: [] } },
      reliability: { snapshots: [] },
      users: [], events: [], purchases: [], payouts: [], reports: [], complaints: [],
    });

    expect(view.roadmapPackages).toHaveLength(10);
    expect(view.summary.roadmapPackagesComplete).toBe(10);
    expect(view.scaleReport.decision.key).toBe("invest_in_reliability_and_support");
    expect(view.expansionScorecard.expansionPaused).toBe(true);
    expect(view.partnerReporting.privacyBoundary.excludedFields).toContain("Akuso memory");
  });

  test("provides reviewable deterministic launch-copilot fallbacks", () => {
    const campaign = buildWritingFallbackDraft({ contentType: "campaign_copy", topic: "Friday drop", preferences: { audience: "fans" } });
    const payout = buildWritingFallbackDraft({ contentType: "payout_explanation", topic: "pending review" });
    const incident = buildWritingFallbackDraft({ contentType: "incident_summary", topic: "checkout delay" });

    expect(campaign).toHaveLength(3);
    expect(payout.join(" ")).toMatch(/cannot approve or move money/i);
    expect(incident.join(" ")).toMatch(/exclude private user and payment data/i);
  });
});
