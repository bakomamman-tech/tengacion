const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/tengaagent-billing-app-test";
process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  "tengaagent-billing-app-test-secret-not-for-production";

jest.mock("../services/tengaAgent/subscriptionCheckoutService", () => ({
  initializeOwnerPlanCheckout: jest.fn(),
  verifyOwnerPlanCheckout: jest.fn(),
  handlePaystackWebhook: jest.fn(async () => ({ handled: true })),
  handleStripeWebhook: jest.fn(async () => ({ handled: true })),
}));

const {
  handlePaystackWebhook: mockHandlePaystackWebhook,
  handleStripeWebhook: mockHandleStripeWebhook,
} = require("../services/tengaAgent/subscriptionCheckoutService");
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
    expect(mockHandlePaystackWebhook).toHaveBeenCalledTimes(1);

    const call = mockHandlePaystackWebhook.mock.calls[0][0];
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
    expect(mockHandleStripeWebhook).toHaveBeenCalledTimes(1);

    const call = mockHandleStripeWebhook.mock.calls[0][0];
    expect(Buffer.isBuffer(call.rawBody)).toBe(true);
    expect(call.rawBody.toString("utf8")).toBe(rawPayload);
    expect(call.signature).toBe("stripe-test-signature");
  });
});
