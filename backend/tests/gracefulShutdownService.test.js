const {
  clearDraining,
  getRuntimeState,
  setDraining,
} = require("../services/runtimeStateService");
const { buildReadinessPayload } = require("../services/healthService");
const {
  createGracefulShutdown,
  parseTimeoutMs,
} = require("../services/gracefulShutdownService");

describe("graceful shutdown runtime state", () => {
  afterEach(() => {
    clearDraining();
    jest.restoreAllMocks();
  });

  test("tracks draining state for readiness checks", () => {
    const state = setDraining({
      reason: "SIGTERM",
      since: new Date("2026-05-27T00:00:00.000Z"),
    });

    expect(state).toMatchObject({
      draining: true,
      drainingReason: "SIGTERM",
      drainingSince: "2026-05-27T00:00:00.000Z",
    });

    expect(clearDraining()).toMatchObject({
      draining: false,
      drainingReason: "",
      drainingSince: "",
    });
  });

  test("readiness reports draining while shutdown is active", async () => {
    setDraining({ reason: "SIGTERM" });

    const payload = await buildReadinessPayload({ timeoutMs: 1 });

    expect(payload.status).toBe("draining");
    expect(payload.requiredFailures).toContain("runtime");
    expect(payload.checks.runtime).toMatchObject({
      status: "fail",
      required: true,
    });
  });

  test("graceful shutdown marks runtime draining and closes dependencies once", async () => {
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const closeSocketServerFn = jest.fn(async () => ({ skipped: false }));
    const closeServerFn = jest.fn(async () => ({ skipped: false }));
    const disconnectDatabaseFn = jest.fn(async () => ({ skipped: false }));
    const exitProcess = jest.fn();
    const shutdown = createGracefulShutdown({
      server: { listening: true },
      io: {},
      logger,
      closeSocketServerFn,
      closeServerFn,
      disconnectDatabaseFn,
      exitProcess,
      timeoutMs: 1000,
    });

    await expect(shutdown("SIGTERM")).resolves.toBe(true);
    await expect(shutdown("SIGINT")).resolves.toBe(false);

    expect(getRuntimeState()).toMatchObject({
      draining: true,
      drainingReason: "SIGTERM",
    });
    expect(closeSocketServerFn).toHaveBeenCalledTimes(1);
    expect(closeServerFn).toHaveBeenCalledTimes(1);
    expect(disconnectDatabaseFn).toHaveBeenCalledTimes(1);
    expect(exitProcess).toHaveBeenCalledWith(0);
    expect(logger.warn).toHaveBeenCalledWith(
      "[shutdown] signal ignored; shutdown already in progress",
      { signal: "SIGINT" }
    );
  });

  test("graceful shutdown exits non-zero when a dependency fails to close", async () => {
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const exitProcess = jest.fn();
    const shutdown = createGracefulShutdown({
      logger,
      closeSocketServerFn: jest.fn(async () => ({ skipped: true })),
      closeServerFn: jest.fn(async () => {
        throw new Error("server close failed");
      }),
      disconnectDatabaseFn: jest.fn(async () => ({ skipped: true })),
      exitProcess,
      timeoutMs: 1000,
    });

    await expect(shutdown("SIGTERM")).resolves.toBe(false);

    expect(exitProcess).toHaveBeenCalledWith(1);
    expect(logger.error).toHaveBeenCalledWith(
      "[shutdown] graceful shutdown failed",
      expect.objectContaining({
        signal: "SIGTERM",
        message: expect.stringContaining("server close failed"),
      })
    );
  });

  test("parses shutdown timeout with safe fallback", () => {
    expect(parseTimeoutMs("1500")).toBe(1500);
    expect(parseTimeoutMs("250")).toBe(25000);
    expect(parseTimeoutMs("nope", 3000)).toBe(3000);
  });
});
