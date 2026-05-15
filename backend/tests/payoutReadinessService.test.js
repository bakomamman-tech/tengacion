const {
  buildPayoutReadiness,
  maskAccountNumber,
} = require("../services/payoutReadinessService");

describe("payoutReadinessService", () => {
  test("masks account numbers before returning creator payout readiness", () => {
    expect(maskAccountNumber("0048044805")).toBe("******4805");
  });

  test("returns ready when creator onboarding, declarations, account, location, and status are complete", () => {
    const readiness = buildPayoutReadiness({
      _id: "creator-1",
      userId: "user-1",
      accountNumber: "0048044805",
      country: "Nigeria",
      countryOfResidence: "Nigeria",
      onboardingCompleted: true,
      acceptedTerms: true,
      acceptedCopyrightDeclaration: true,
      status: "active",
    });

    expect(readiness).toMatchObject({
      ready: true,
      canRequestPayout: true,
      status: "ready",
      label: "Ready",
      supportFlow: "creator_payouts",
      primaryAction: {
        label: "Review earnings",
        path: "/creator/earnings",
      },
      accountNumberMasked: "******4805",
      missingChecks: [],
      blockingReasons: [],
      missingCheckCount: 0,
    });
  });

  test("uses actionable operational states for incomplete, missing payout, pending, and restricted creators", () => {
    expect(buildPayoutReadiness(null)).toMatchObject({
      ready: false,
      status: "not_started",
    });

    expect(
      buildPayoutReadiness({
        _id: "creator-1",
        userId: "user-1",
        accountNumber: "",
        country: "Nigeria",
        countryOfResidence: "Nigeria",
        onboardingCompleted: true,
        acceptedTerms: true,
        acceptedCopyrightDeclaration: true,
        status: "active",
      })
    ).toMatchObject({
      ready: false,
      canRequestPayout: false,
      status: "payout_method_missing",
      label: "Payout method missing",
      supportFlow: "creator_payouts",
      primaryAction: {
        label: "Update payout details",
        path: "/creator/settings",
      },
    });

    expect(
      buildPayoutReadiness({
        _id: "creator-1",
        userId: "user-1",
        accountNumber: "0048044805",
        country: "Nigeria",
        countryOfResidence: "Nigeria",
        onboardingCompleted: true,
        acceptedTerms: true,
        acceptedCopyrightDeclaration: true,
        status: "pending_review",
      })
    ).toMatchObject({
      ready: false,
      status: "verification_pending",
      label: "Verification pending",
      primaryAction: {
        label: "Review verification status",
        path: "/creator/verification",
      },
    });

    expect(
      buildPayoutReadiness({
        _id: "creator-1",
        userId: "user-1",
        accountNumber: "0048044805",
        country: "Nigeria",
        countryOfResidence: "Nigeria",
        onboardingCompleted: true,
        acceptedTerms: true,
        acceptedCopyrightDeclaration: true,
        status: "restricted",
      })
    ).toMatchObject({
      ready: false,
      status: "restricted",
      label: "Restricted",
      primaryAction: {
        label: "Contact creator support",
        path: "/creator/support",
      },
    });
  });

  test("keeps profile incomplete copy when an onboarded creator is missing profile fields", () => {
    const readiness = buildPayoutReadiness({
      _id: "creator-1",
      userId: "user-1",
      accountNumber: "0048044805",
      country: "",
      countryOfResidence: "Nigeria",
      onboardingCompleted: true,
      acceptedTerms: true,
      acceptedCopyrightDeclaration: true,
      status: "active",
    });

    expect(readiness).toMatchObject({
      ready: false,
      status: "profile_incomplete",
      label: "Profile incomplete",
      supportFlow: "creator_onboarding",
      primaryAction: {
        label: "Update creator profile",
        path: "/creator/settings",
      },
      missingChecks: ["country"],
      missingCheckCount: 1,
    });
    expect(readiness.blockingReasons).toEqual([
      expect.objectContaining({
        key: "country",
        label: "Country",
        group: "profile",
        status: "profile_incomplete",
      }),
    ]);
  });
});
