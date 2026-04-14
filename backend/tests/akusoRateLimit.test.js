const express = require("express");
const request = require("supertest");

process.env.NODE_ENV = "test";
require("../../apps/api/config/env");

const {
  createAkusoRateLimiter,
} = require("../middleware/akusoRateLimit");
const {
  getAkusoMetricsSnapshot,
  resetAkusoMetrics,
} = require("../services/akusoMetricsService");

describe("Akuso rate limiter", () => {
  beforeEach(() => {
    resetAkusoMetrics();
  });

  it("throttles repeated requests with a structured response", async () => {
    const app = express();
    app.use(
      "/limited",
      createAkusoRateLimiter({
        windowMs: 60 * 1000,
        max: 1,
      }),
      (_req, res) => {
        res.json({ ok: true });
      }
    );

    await request(app).get("/limited").expect(200);
    const response = await request(app).get("/limited").expect(429);

    expect(response.body).toEqual(
      expect.objectContaining({
        ok: false,
        error: "AKUSO_RATE_LIMITED",
        traceId: expect.any(String),
      })
    );
    expect(getAkusoMetricsSnapshot().security.rateLimitHits).toBe(1);
  });
});
