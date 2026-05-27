const mongoose = require("mongoose");

const { setDraining } = require("./runtimeStateService");

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 25000;

const parseTimeoutMs = (value, fallback = DEFAULT_SHUTDOWN_TIMEOUT_MS) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1000 ? parsed : fallback;
};

const withTimeout = (promise, timeoutMs, label) => {
  let timer;
  return Promise.race([
    Promise.resolve(promise).finally(() => {
      if (timer) {
        clearTimeout(timer);
      }
    }),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
      timer.unref?.();
    }),
  ]);
};

const closeHttpServer = (server) =>
  new Promise((resolve, reject) => {
    if (!server || typeof server.close !== "function" || !server.listening) {
      resolve({ skipped: true });
      return;
    }

    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      server.closeIdleConnections?.();
      resolve({ skipped: false });
    });
  });

const closeSocketServer = (io) =>
  new Promise((resolve, reject) => {
    if (!io || typeof io.close !== "function") {
      resolve({ skipped: true });
      return;
    }

    io.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ skipped: false });
    });
  });

const disconnectDatabase = async () => {
  if (!mongoose.connection || Number(mongoose.connection.readyState) === 0) {
    return { skipped: true };
  }

  await mongoose.disconnect();
  return { skipped: false };
};

const throwIfSettledFailures = (results = []) => {
  const failures = results.filter((result) => result.status === "rejected");
  if (!failures.length) {
    return results;
  }

  const message = failures
    .map((failure) => failure.reason?.message || String(failure.reason || "shutdown task failed"))
    .join("; ");
  throw new Error(message || "Graceful shutdown task failed");
};

const createGracefulShutdown = ({
  server,
  io,
  logger = console,
  timeoutMs = parseTimeoutMs(process.env.GRACEFUL_SHUTDOWN_TIMEOUT_MS),
  closeServerFn = closeHttpServer,
  closeSocketServerFn = closeSocketServer,
  disconnectDatabaseFn = disconnectDatabase,
  exitProcess = process.exit,
} = {}) => {
  let shuttingDown = false;

  return async (signal = "SIGTERM") => {
    if (shuttingDown) {
      logger?.warn?.("[shutdown] signal ignored; shutdown already in progress", { signal });
      return false;
    }

    shuttingDown = true;
    setDraining({ reason: signal });
    logger?.warn?.("[shutdown] draining runtime", { signal, timeoutMs });

    let exitCode = 0;
    try {
      await withTimeout(
        Promise.allSettled([
          closeSocketServerFn(io),
          closeServerFn(server),
          disconnectDatabaseFn(),
        ]).then(throwIfSettledFailures),
        timeoutMs,
        "Graceful shutdown"
      );
      logger?.info?.("[shutdown] graceful shutdown complete", { signal });
    } catch (error) {
      exitCode = 1;
      logger?.error?.("[shutdown] graceful shutdown failed", {
        signal,
        message: error?.message || String(error),
      });
    }

    if (typeof exitProcess === "function") {
      exitProcess(exitCode);
    }

    return exitCode === 0;
  };
};

const registerGracefulShutdown = ({
  signals = ["SIGTERM", "SIGINT"],
  ...options
} = {}) => {
  const shutdown = createGracefulShutdown(options);
  signals.forEach((signal) => {
    process.once(signal, () => {
      shutdown(signal).catch((error) => {
        options.logger?.error?.("[shutdown] unhandled shutdown failure", {
          signal,
          message: error?.message || String(error),
        });
        process.exit(1);
      });
    });
  });
  return shutdown;
};

module.exports = {
  DEFAULT_SHUTDOWN_TIMEOUT_MS,
  closeHttpServer,
  closeSocketServer,
  createGracefulShutdown,
  disconnectDatabase,
  parseTimeoutMs,
  registerGracefulShutdown,
};
