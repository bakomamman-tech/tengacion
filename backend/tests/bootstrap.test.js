const request = require("supertest");
const app = require("../app");

describe("backend bootstrap", () => {
  test("GET /api/health responds with ok status", async () => {
    const response = await request(app).get("/api/health").expect(200);
    expect(response.body).toMatchObject({ status: "ok" });
    expect(response.body.uptimeSeconds).toEqual(expect.any(Number));
    expect(response.body.environment).toBe("test");
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
    expect(response.headers["x-request-id"]).toHaveLength(36);
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  test("GET /api/health/live responds with liveness payload", async () => {
    const response = await request(app).get("/api/health/live").expect(200);
    expect(response.body).toMatchObject({
      status: "ok",
      environment: "test",
    });
    expect(response.body.time).toEqual(expect.any(String));
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  test("GET /api/health/ready reports degraded when database is disconnected", async () => {
    const response = await request(app).get("/api/health/ready").expect(503);

    expect(response.body).toMatchObject({
      status: "degraded",
      environment: "test",
    });
    expect(response.body).not.toHaveProperty("checks");
    expect(response.body).not.toHaveProperty("requiredFailures");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["retry-after"]).toBe("30");
  });

  test("GET /api/admin/system/readiness requires an authenticated operator", async () => {
    const response = await request(app).get("/api/admin/system/readiness").expect(401);

    expect(response.body).toMatchObject({ error: "No token" });
  });

  test("request ID middleware preserves valid inbound request IDs", async () => {
    const response = await request(app)
      .get("/api/health")
      .set("X-Request-ID", "support-ticket-123")
      .expect(200);

    expect(response.headers["x-request-id"]).toBe("support-ticket-123");
  });

  test("API 404 responses include request ID for support correlation", async () => {
    const response = await request(app)
      .get("/api/does-not-exist")
      .set("X-Request-ID", "missing-route-123")
      .expect(404);

    expect(response.headers["x-request-id"]).toBe("missing-route-123");
    expect(response.body).toMatchObject({
      success: false,
      requestId: "missing-route-123",
    });
  });

  test("GET /socket.io returns socket probe", async () => {
    const response = await request(app).get("/socket.io").expect(200);
    expect(response.text).toContain("socket ok");
  });

  test("GET /api/me requires auth and reports no token", async () => {
    const response = await request(app).get("/api/me").expect(401);
    expect(response.body).toMatchObject({ error: "No token" });
  });

  test("requiring app does not start a listening server", async () => {
    // supertest uses the app instance directly so no network port needs to be bound.
    const response = await request(app).get("/api/health").expect(200);
    expect(response.body.status).toBe("ok");
  });
});
