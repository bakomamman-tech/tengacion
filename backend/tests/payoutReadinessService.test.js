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
      status: "ready",
      label: "Ready",
      accountNumberMasked: "******4805",
      missingChecks: [],
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
      status: "payout_method_missing",
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
    });
  });
});
