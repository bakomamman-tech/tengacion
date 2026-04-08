const Purchase = require("../models/Purchase");

const DEFAULT_PENDING_PAYMENT_TTL_MS = 2 * 60 * 60 * 1000;
const DEFAULT_PAYMENT_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

let schedulerStarted = false;
let schedulerHandle = null;

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
};

const runPendingPurchaseCleanup = async ({
  logger = console,
  olderThanMs = parsePositiveInteger(
    process.env.PAYMENT_PENDING_TTL_MS,
    DEFAULT_PENDING_PAYMENT_TTL_MS
  ),
  reason = "manual",
} = {}) => {
  const now = new Date();
  const cutoff = new Date(now.getTime() - olderThanMs);

  const result = await Purchase.updateMany(
    {
      status: "pending",
      updatedAt: { $lt: cutoff },
    },
    {
      $set: {
        status: "abandoned",
        updatedAt: now,
      },
    }
  );

  const summary = {
    reason,
    cutoff: cutoff.toISOString(),
    olderThanMs,
    abandonedCount: Number(result?.modifiedCount || 0),
    matchedCount: Number(result?.matchedCount || 0),
  };

  logger?.info?.("[payment-cleanup] completed", summary);
  return summary;
};

const startPaymentMaintenance = async ({ logger = console } = {}) => {
  if (schedulerStarted) {
    return schedulerHandle;
  }

  schedulerStarted = true;

  const enabled = String(process.env.PAYMENT_CLEANUP_ENABLED || "true").toLowerCase() !== "false";
  if (!enabled) {
    logger?.log?.("Payment cleanup disabled.");
    return null;
  }

  const intervalMs = parsePositiveInteger(
    process.env.PAYMENT_CLEANUP_INTERVAL_MS,
    DEFAULT_PAYMENT_CLEANUP_INTERVAL_MS
  );
  const runOnBoot = String(process.env.PAYMENT_CLEANUP_RUN_ON_BOOT || "true").toLowerCase() !== "false";

  const scheduleTick = (reason = "interval") =>
    runPendingPurchaseCleanup({ logger, reason }).catch((error) => {
      logger?.error?.("Payment cleanup failed:", error?.message || error);
      return null;
    });

  if (runOnBoot) {
    await scheduleTick("startup");
  }

  schedulerHandle = setInterval(() => {
    scheduleTick("interval");
  }, intervalMs);
  schedulerHandle.unref?.();

  logger?.log?.(`Payment cleanup scheduled every ${intervalMs}ms.`);
  return schedulerHandle;
};

module.exports = {
  DEFAULT_PENDING_PAYMENT_TTL_MS,
  DEFAULT_PAYMENT_CLEANUP_INTERVAL_MS,
  runPendingPurchaseCleanup,
  startPaymentMaintenance,
};
