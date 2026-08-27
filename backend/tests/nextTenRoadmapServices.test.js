const {
  buildCreatorLifecycle,
  buildFanLifecycle,
  buildFirstWeekActivation,
  buildNextTenOperatingViewFromRows,
  buildPayoutAutomationDecision,
  buildSupportTrustOperations,
  campaignReadinessChecks,
} = require("../services/launchGrowthOperatingService");

const readyCreatorProfile = (overrides = {}) => ({
  _id: "creator-1",
  userId: { _id: "user-creator-1", name: "Launch Creator", username: "launchcreator" },
  displayName: "Launch Creator",
  creatorTypes: ["music"],
  profileCompletionScore: 100,
  status: "active",
  onboardingComplete: true,
  acceptedTerms: true,
  acceptedCopyrightDeclaration: true,
  accountNumber: "0123456789",
  bankName: "Tengacion Test Bank",
  bankCode: "999",
  accountName: "Launch Creator",
  country: "Nigeria",
  countryOfResidence: "Nigeria",
  payoutRecipientVerifiedAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
  ...overrides,
});

describe("next ten Tengacion roadmap operating services", () => {
  test("automates only low-risk payout preflight and never authorizes money movement", () => {
    const decision = buildPayoutAutomationDecision({
      request: {
        _id: "request-2",
        creatorProfile: "creator-1",
        requestReference: "PAY-002",
        amount: 100000,
        currency: "NGN",
        status: "approved",
        balanceSnapshot: { availableForRequest: 300000 },
      },
      profile: readyCreatorProfile(),
      creatorPurchases: Array.from({ length: 10 }, (_, index) => ({
        status: "paid",
        amount: 50000,
        createdAt: `2026-06-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
      })),
      priorRequests: [{
        _id: "request-1",
        creatorProfile: "creator-1",
        amount: 50000,
        currency: "NGN",
        status: "paid",
      }],
      now: new Date("2026-08-27T00:00:00.000Z"),
    });

    expect(decision.validationPassed).toBe(true);
    expect(decision.riskFlags).toEqual([]);
    expect(decision.batchPreflightEligible).toBe(true);
    expect(decision.decision).toBe("eligible_for_batch_preparation");
    expect(decision.moneyMovementAuthorized).toBe(false);
  });

  test("keeps first, high-value, changed-method, and verification-risk payouts in human review", () => {
    const decision = buildPayoutAutomationDecision({
      request: {
        _id: "request-risk",
        amount: 500000,
        currency: "NGN",
        status: "approved",
        balanceSnapshot: { availableForRequest: 600000 },
      },
      profile: readyCreatorProfile({
        payoutRecipientVerifiedAt: null,
        updatedAt: "2026-08-25T00:00:00.000Z",
      }),
      creatorPurchases: [{ status: "paid", amount: 50000 }],
      now: new Date("2026-08-27T00:00:00.000Z"),
    });

    expect(decision.humanApprovalRequired).toBe(true);
    expect(decision.batchPreflightEligible).toBe(false);
    expect(decision.riskFlags.map((flag) => flag.key)).toEqual(expect.arrayContaining([
      "first_payout",
      "high_value_payout",
      "recent_payout_method_change",
      "identity_or_verification_mismatch",
    ]));
  });

  test("classifies creators into measurable lifecycle programs and requires manual promotion confirmation", () => {
    const profile = readyCreatorProfile();
    const contentRows = [{
      creatorId: "creator-1",
      title: "First paid drop",
      price: 1000,
      createdAt: "2026-08-01T00:00:00.000Z",
    }];
    const withoutEnrollment = buildCreatorLifecycle({
      profiles: [profile],
      contentRows,
      now: new Date("2026-08-27T00:00:00.000Z"),
    });
    expect(withoutEnrollment.creators[0].lifecycleStage).toBe("first_sale_recovery");
    expect(withoutEnrollment.creators[0].blockingCriteria).toContain("external_promotion");

    const enrolled = buildCreatorLifecycle({
      profiles: [profile],
      contentRows,
      enrollments: [{
        _id: "enrollment-1",
        creatorProfile: "creator-1",
        creatorUser: "user-creator-1",
        programKey: "first_paid_drop",
        lifecycleStage: "first_sale_recovery",
        status: "enrolled",
      }],
      now: new Date("2026-08-27T00:00:00.000Z"),
    });
    expect(enrolled.creators[0].launchReadinessState).toBe("ready");
    expect(enrolled.summary.launchReady).toBe(1);
  });

  test("tracks first-week activation by source and identifies lifecycle renewal risk", () => {
    const users = [{ _id: "fan-1", createdAt: "2026-08-01T00:00:00.000Z" }];
    const events = [
      { userId: "fan-1", type: "route_viewed", metadata: { source: "creator_share" }, createdAt: "2026-08-01T01:00:00.000Z" },
      { userId: "fan-1", type: "creator_followed", createdAt: "2026-08-01T02:00:00.000Z" },
      { userId: "fan-1", type: "route_viewed", createdAt: "2026-08-03T02:00:00.000Z" },
    ];
    const purchases = [{
      _id: "subscription-1",
      userId: "fan-1",
      itemType: "subscription",
      status: "failed",
      createdAt: "2026-08-04T00:00:00.000Z",
    }];
    const activation = buildFirstWeekActivation({
      users,
      events,
      purchases,
      now: new Date("2026-08-27T00:00:00.000Z"),
    });
    const fanLifecycle = buildFanLifecycle({
      users,
      events,
      purchases,
      now: new Date("2026-08-27T00:00:00.000Z"),
    });

    expect(activation.summary.meaningfulActionRate).toBe(1);
    expect(activation.summary.firstWeekReturnRate).toBe(1);
    expect(activation.bySource[0]).toMatchObject({ source: "creator_share", activationRate: 1 });
    expect(fanLifecycle.fans[0].stage).toBe("renewal_risk");
    expect(fanLifecycle.subscriptionDiagnostics.failedRenewals).toBe(1);
  });

  test("requires ledger, margin, refund, metric, scope, and rollback evidence before a campaign is ready", () => {
    const incomplete = campaignReadinessChecks({
      ownerName: "Growth Lead",
      ownerRole: "Growth",
      startAt: "2026-09-01T00:00:00.000Z",
      endAt: "2026-09-08T00:00:00.000Z",
      priceRule: "10 percent launch discount",
    });
    expect(incomplete.filter((check) => !check.complete).map((check) => check.key)).toEqual(expect.arrayContaining([
      "eligibility",
      "margin",
      "refunds",
      "metric",
      "ledger",
      "rollback",
    ]));
  });

  test("detects support SLA breaches and preserves grounded escalation ownership", () => {
    const operations = buildSupportTrustOperations({
      reports: [{ status: "open", category: "content", createdAt: "2026-08-25T00:00:00.000Z" }],
      complaints: [{ status: "open", category: "assistant", subject: "Unsafe Akuso answer", createdAt: "2026-08-26T00:00:00.000Z" }],
      supportMacros: [{ key: "payment_succeeded_content_locked", title: "Payment access issue" }],
      now: new Date("2026-08-27T12:00:00.000Z"),
    });

    expect(operations.summary.breached).toBe(2);
    expect(operations.queues.find((queue) => queue.key === "assistant_output")).toMatchObject({
      status: "blocked",
      escalationOwner: "AI and safety",
    });
    expect(operations.macros).toHaveLength(1);
  });

  test("publishes one evidence-backed operating contract for all ten roadmap packages", () => {
    const now = new Date("2026-08-27T00:00:00.000Z");
    const profile = readyCreatorProfile();
    const payload = buildNextTenOperatingViewFromRows({
      users: [{ _id: "fan-1", createdAt: "2026-08-01T00:00:00.000Z" }],
      profiles: [profile],
      contentRows: [{ creatorId: "creator-1", title: "Drop", price: 1000, createdAt: "2026-08-01T00:00:00.000Z" }],
      enrollments: [{ creatorProfile: "creator-1", creatorUser: "user-creator-1", programKey: "first_paid_drop", lifecycleStage: "first_sale_recovery", status: "active" }],
      campaignRows: [{
        _id: "campaign-1",
        name: "Creator drop week",
        campaignKey: "creator_drop_week",
        type: "creator_drop",
        status: "ready",
        ownerName: "Growth Lead",
        ownerRole: "Growth",
        startAt: "2026-09-01T00:00:00.000Z",
        endAt: "2026-09-08T00:00:00.000Z",
        eligibleCreatorIds: ["creator-1"],
        priceRule: "Standard catalog price",
        expectedMarginImpact: "No commission change",
        refundAndDisputeHandling: "Use the existing purchase dispute workflow",
        successMetric: "Paid conversion",
        ledgerTrackingKey: "creator_drop_week",
        rollbackPlan: "Pause campaign discovery placements",
      }],
      assurance: {
        launchCommandCenter: {
          gates: [{ key: "checkout_callbacks", title: "Checkout", owner: "Backend", gateState: "ready" }],
          supportMacros: [{ key: "payment_succeeded_content_locked", title: "Payment access issue" }],
          rollbackPlans: [{ key: "checkout_failures", title: "Checkout failures" }],
        },
      },
      now,
    });

    expect(payload.roadmapPackages).toHaveLength(10);
    expect(payload.summary.packagesImplemented).toBe(10);
    expect(payload.creatorLifecycle.summary.launchReady).toBe(1);
    expect(payload.revenueCampaigns.summary.ready).toBe(1);
    expect(payload.launchGovernance.launchReport.automated).toEqual(expect.arrayContaining([
      "Low-risk payout preflight",
      "Creator and fan lifecycle classification",
      "Campaign readiness validation",
    ]));
    expect(payload.dataLimits.note).toMatch(/bounded/i);
  });
});
