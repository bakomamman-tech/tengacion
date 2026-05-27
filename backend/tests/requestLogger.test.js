const express = require("express");
const request = require("supertest");

const { requestId } = require("../middleware/requestId");
const {
  getLogLevel,
  requestLogger,
  shouldSkipSuccessfulRequest,
} = require("../middleware/requestLogger");

const buildApp = (logger) => {
  const app = express();
  app.use(requestId);
  app.use(requestLogger({ logger, enabled: true }));
  app.get("/api/example", (_req, res) => {
    res.json({ ok: true });
  });
  app.get("/api/missing", (_req, res) => {
    res.status(404).json({ error: "Missing" });
  });
  app.get("/api/broken", (_req, res) => {
    res.status(503).json({ error: "Unavailable" });
  });
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  return app;
};

describe("requestLogger middleware", () => {
  test("maps status codes to log levels", () => {
    expect(getLogLevel(200)).toBe("info");
    expect(getLogLevel(404)).toBe("warn");
    expect(getLogLevel(503)).toBe("error");
  });

  test("skips successful static and liveness requests", () => {
    expect(shouldSkipSuccessfulRequest({ path: "/api/health", statusCode: 200 })).toBe(true);
    expect(shouldSkipSuccessfulRequest({ path: "/assets/index.js", statusCode: 200 })).toBe(true);
    expect(shouldSkipSuccessfulRequest({ path: "/api/health", statusCode: 503 })).toBe(false);
  });

  test("logs completed requests with request ID and query keys only", async () => {
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const app = buildApp(logger);

    await request(app)
      .get("/api/example?token=secret&filter=music")
      .set("X-Request-ID", "support-req-123")
      .expect(200);

    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      "http.request.completed",
      expect.objectContaining({
        requestId: "support-req-123",
        method: "GET",
        path: "/api/example",
        statusCode: 200,
        queryKeys: ["token", "filter"],
      })
    );
    expect(JSON.stringify(logger.info.mock.calls[0][1])).not.toContain("secret");
  });

  test("logs 4xx and 5xx responses at elevated levels", async () => {
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const app = buildApp(logger);

    await request(app).get("/api/missing").expect(404);
    await request(app).get("/api/broken").expect(503);

    expect(logger.warn).toHaveBeenCalledWith(
      "http.request.completed",
      expect.objectContaining({ path: "/api/missing", statusCode: 404 })
    );
    expect(logger.error).toHaveBeenCalledWith(
      "http.request.completed",
      expect.objectContaining({ path: "/api/broken", statusCode: 503 })
    );
  });

  test("does not log successful liveness probes", async () => {
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const app = buildApp(logger);

    await request(app).get("/api/health").expect(200);

    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });
});
