const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "tengaagent-billing-app-test-secret-not-for-production";

const initializeOwnerPlanCheckout = jest.fn();
const verifyOwnerPlanCheckout = jest.fn();
const handlePaystackWebhook = jest.fn(async () => ({ handled: true }));
const handleStripeWebhook = jest.fn(async () => ({ handled: true }));

jest.mock("../services/tengaAgent/subscriptionCheckoutService", () => ({
  initializeOwnerPlanCheckout,
  verifyOwnerPlanCheckout,
  handlePaystackWebhook,
  handleStripeWebhook,
}));

const app = require("../app");

describe("TengaAgent billing app wiring", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("mounts the Paystack webhook and preserves the exact raw JSON body", async () => {
    const rawPayload = JSON.stringify({
      event: "charge.success",
      data: { reference: "tengaagent-paystack-test" },
    });

    const response = await request(app)
      .post("/api/tengaagent/billing/webhook/paystack")
      .set("Content-Type", "application/json")
      .set("x-paystack-signature", "test-signature")
      .send(rawPayload)
      .expect(200);

    expect(response.body).toEqual({ ok: true, handled: true });
    expect(handlePaystackWebhook).toHaveBeenCalledTimes(1);

    const call = handlePaystackWebhook.mock.calls[0][0];
    expect(Buffer.isBuffer(call.rawBody)).toBe(true);
    expect(call.rawBody.toString("utf8")).toBe(rawPayload);
    expect(call.signature).toBe("test-signature");
    expect(call.payload).toEqual(JSON.parse(rawPayload));
  });

  it("mounts the Stripe webhook and preserves the exact raw JSON body", async () => {
    const rawPayload = JSON.stringify({
      id: "evt_tengaagent_test",
      type: "checkout.session.completed",
    });

    const response = await request(app)
      .post("/api/tengaagent/billing/webhook/stripe")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "stripe-test-signature")
      .send(rawPayload)
      .expect(200);

    expect(response.body).toEqual({ ok: true, handled: true });
    expect(handleStripeWebhook).toHaveBeenCalledTimes(1);

    const call = handleStripeWebhook.mock.calls[0][0];
    expect(Buffer.isBuffer(call.rawBody)).toBe(true);
    expect(call.rawBody.toString("utf8")).toBe(rawPayload);
    expect(call.signature).toBe("stripe-test-signature");
  });
});
