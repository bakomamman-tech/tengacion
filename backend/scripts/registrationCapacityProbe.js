const { performance } = require("perf_hooks");

const parsePositiveIntegerArg = (name, fallback) => {
  const prefix = `--${name}=`;
  const raw = process.argv.find((entry) => entry.startsWith(prefix));
  const parsed = Number(raw ? raw.slice(prefix.length) : "");
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const totalUsers = parsePositiveIntegerArg("users", 100);
const concurrency = Math.min(
  totalUsers,
  parsePositiveIntegerArg("concurrency", 10)
);

process.env.NODE_ENV = "test";
process.env.MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tengacion-capacity-probe";
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "capacity-probe-jwt-secret-1234567890";
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "capacity-probe-refresh-secret-123456";
process.env.AUTH_CHALLENGE_SECRET =
  process.env.AUTH_CHALLENGE_SECRET || "capacity-probe-challenge-secret-1234";
process.env.REQUIRE_EMAIL_OTP = "false";

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const percentile = (sortedValues, value) => {
  if (!sortedValues.length) return 0;
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * value) - 1)
  );
  return sortedValues[index];
};

const round = (value, digits = 1) => Number(Number(value || 0).toFixed(digits));

const runWorkerPool = async (items, workerCount, handler) => {
  let cursor = 0;
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await handler(items[index], index);
    }
  });
  await Promise.all(workers);
};

const main = async () => {
  const mongod = await MongoMemoryServer.create({
    instance: { launchTimeout: 60000 },
  });

  process.env.MONGO_URI = mongod.getUri();
  delete process.env.EMAIL_USER;
  delete process.env.EMAIL_PASS;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;

  const AuthService = require("../../apps/api/services/authService");
  const User = require("../models/User");

  let peakRssBytes = process.memoryUsage().rss;
  const memorySampler = setInterval(() => {
    peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
  }, 100);
  memorySampler.unref?.();

  const latencies = [];
  const failures = [];
  const users = Array.from({ length: totalUsers }, (_, index) => index + 1);

  try {
    await mongoose.connect(mongod.getUri(), {
      maxPoolSize: Math.max(20, concurrency * 2),
      serverSelectionTimeoutMS: 60000,
      socketTimeoutMS: 60000,
    });
    await User.init();

    const startedAt = performance.now();
    await runWorkerPool(users, concurrency, async (sequence) => {
      const requestStartedAt = performance.now();
      const suffix = String(sequence).padStart(6, "0");
      try {
        await AuthService.register({
          name: `Capacity User ${suffix}`,
          username: `capacity_${suffix}`,
          email: `capacity.${suffix}@example.test`,
          phone: `+2348${String(sequence).padStart(9, "0")}`,
          country: "Nigeria",
          stateOfOrigin: "Kaduna",
          password: `CapacityPass${suffix}!`,
          sessionMeta: {
            deviceName: "capacity-probe",
            ip: `198.51.100.${(sequence % 250) + 1}`,
            userAgent: "tengacion-registration-capacity-probe",
          },
        });
      } catch (error) {
        failures.push({
          sequence,
          name: error?.name || "Error",
          message: error?.message || String(error),
        });
      } finally {
        latencies.push(performance.now() - requestStartedAt);
      }
    });
    const elapsedMs = performance.now() - startedAt;
    const storedUsers = await User.countDocuments();
    const sortedLatencies = [...latencies].sort((left, right) => left - right);

    console.log(
      JSON.stringify(
        {
          probe: "registration-capacity",
          synthetic: true,
          requestedUsers: totalUsers,
          concurrency,
          successfulRegistrations: totalUsers - failures.length,
          failedRegistrations: failures.length,
          storedUsers,
          elapsedSeconds: round(elapsedMs / 1000, 2),
          throughputPerSecond: round(
            (totalUsers - failures.length) / (elapsedMs / 1000),
            2
          ),
          latencyMs: {
            p50: round(percentile(sortedLatencies, 0.5)),
            p95: round(percentile(sortedLatencies, 0.95)),
            p99: round(percentile(sortedLatencies, 0.99)),
            max: round(sortedLatencies.at(-1) || 0),
          },
          peakRssMb: round(peakRssBytes / (1024 * 1024), 2),
          failureSamples: failures.slice(0, 5),
        },
        null,
        2
      )
    );

    if (failures.length > 0 || storedUsers !== totalUsers) {
      process.exitCode = 1;
    }
  } finally {
    clearInterval(memorySampler);
    await mongoose.disconnect().catch(() => null);
    await mongod.stop().catch(() => null);
  }
};

main().catch((error) => {
  console.error("Registration capacity probe failed:", error);
  process.exitCode = 1;
});
