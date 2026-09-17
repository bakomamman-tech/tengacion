process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/tengaagent-prepaid-renewal-guard-test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "tengaagent-prepaid-renewal-guard-test-secret-not-for-production";

const {
  hasProtectedActivePrepaidPeriod,
} = require("../services/tengaAgent/subscriptionCheckoutService");

describe("TengaAgent prepaid renewal guard", () => {
  const now = new Date("2026-09-17T12:00:00.000Z");

  it("protects remaining paid days for the same active prepaid plan", () => {
    expect(
      hasProtectedActivePrepaidPeriod({
        subscription: {
          status: "active",
          renewalMode: "prepaid",
          planCode: "starter",
          currentPeriodEnd: new Date("2026-10-01T00:00:00.000Z"),
        },
        planCode: "starter",
        now,
      })
    ).toBe(true);
  });

  it("allows a different plan to be purchased immediately", () => {
    expect(
      hasProtectedActivePrepaidPeriod({
        subscription: {
          status: "active",
          renewalMode: "prepaid",
          planCode: "starter",
          currentPeriodEnd: new Date("2026-10-01T00:00:00.000Z"),
        },
        planCode: "growth",
        now,
      })
    ).toBe(false);
  });

  it("allows the same plan again once the prepaid period has ended", () => {
    expect(
      hasProtectedActivePrepaidPeriod({
        subscription: {
          status: "active",
          renewalMode: "prepaid",
          planCode: "starter",
          currentPeriodEnd: new Date("2026-09-17T12:00:00.000Z"),
        },
        planCode: "starter",
        now,
      })
    ).toBe(false);
  });

  it("does not apply prepaid protection to manual billing", () => {
    expect(
      hasProtectedActivePrepaidPeriod({
        subscription: {
          status: "active",
          renewalMode: "manual",
          planCode: "starter",
          currentPeriodEnd: new Date("2026-10-01T00:00:00.000Z"),
        },
        planCode: "starter",
        now,
      })
    ).toBe(false);
  });
});
