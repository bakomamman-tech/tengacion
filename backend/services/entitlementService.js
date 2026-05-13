const mongoose = require("mongoose");
const Purchase = require("../models/Purchase");
const Entitlement = require("../models/Entitlement");
const { logAnalyticsEvent } = require("./analyticsService");
const { isSubscriptionAccessActive } = require("./purchaseLifecycleService");

const ENTITLEMENT_ITEM_TYPES = ["track", "book", "album", "video"];
const DEFAULT_ENTITLEMENT_RECONCILIATION_INTERVAL_MS = 60 * 60 * 1000;

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const toIdString = (value) => {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (value._id) {
    return value._id.toString();
  }
  return value.toString();
};

const parseBooleanEnv = (value, fallback = true) => {
  if (value == null || value === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
};

const normalizeEntitlementItemType = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  return ENTITLEMENT_ITEM_TYPES.includes(normalized) ? normalized : "";
};

const logEntitlementReconciled = ({ purchase, reason = "manual" } = {}) =>
  logAnalyticsEvent({
    type: "purchase_entitlement_granted",
    userId: toIdString(purchase?.userId),
    targetId: purchase?._id || null,
    targetType: "purchase",
    contentType: purchase?.itemType || "",
    metadata: {
      purchaseId: toIdString(purchase?._id),
      providerRef: purchase?.providerRef || "",
      provider: purchase?.provider || "",
      status: purchase?.status || "",
      itemType: purchase?.itemType || "",
      itemId: toIdString(purchase?.itemId),
      creatorId: toIdString(purchase?.creatorId),
      amount: Number(purchase?.amount || 0),
      currency: purchase?.currency || "NGN",
      source: "entitlement_reconciliation",
      reason,
    },
  }).catch(() => null);

const backfillEntitlementForPaidPurchase = async ({ purchase, reason = "manual" } = {}) => {
  const itemType = normalizeEntitlementItemType(purchase?.itemType);
  const buyerId = toIdString(purchase?.userId);
  const itemId = toIdString(purchase?.itemId);

  if (!purchase?._id || String(purchase?.status || "").trim().toLowerCase() !== "paid") {
    return { created: false, skipped: true, reason: "not_paid_purchase" };
  }
  if (!itemType) {
    return { created: false, skipped: true, reason: "non_entitlement_item" };
  }
  if (!isValidObjectId(buyerId) || !isValidObjectId(itemId)) {
    return { created: false, skipped: true, reason: "invalid_entitlement_target" };
  }

  const result = await Entitlement.updateOne(
    {
      buyerId,
      itemType,
      itemId,
    },
    {
      $setOnInsert: {
        buyerId,
        itemType,
        itemId,
        grantedAt: purchase?.paidAt || purchase?.updatedAt || purchase?.createdAt || new Date(),
      },
    },
    {
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  const created = Boolean(result?.upsertedCount || result?.upsertedId);
  if (created) {
    await logEntitlementReconciled({ purchase, reason });
  }

  return {
    created,
    skipped: false,
    purchaseId: toIdString(purchase._id),
  };
};

const hasCreatorSubscriptionAccess = async ({ userId, creatorId, at = new Date() }) => {
  if (!userId || !creatorId) {
    return false;
  }

  if (!isValidObjectId(userId) || !isValidObjectId(creatorId)) {
    return false;
  }

  const exists = await Purchase.exists({
    userId,
    creatorId,
    itemType: "subscription",
    status: "paid",
  });
  if (!exists) {
    return false;
  }

  const purchase = await Purchase.findOne({
    userId,
    creatorId,
    itemType: "subscription",
    status: "paid",
  })
    .sort({ accessExpiresAt: -1, paidAt: -1, createdAt: -1 })
    .lean();

  return isSubscriptionAccessActive(purchase, { at });
};

const hasEntitlement = async ({ userId, itemType, itemId, creatorId = "" }) => {
  if (!userId || !itemType || !itemId) {
    return false;
  }

  if (!isValidObjectId(userId) || !isValidObjectId(itemId)) {
    return false;
  }

  const entitlement = await Entitlement.exists({
    buyerId: userId,
    itemType,
    itemId,
  });
  if (entitlement) {
    return true;
  }

  const normalizedItemType = String(itemType || "").trim().toLowerCase();
  const exists = await Purchase.exists({
    userId,
    itemType,
    itemId,
    status: "paid",
    ...(normalizedItemType === "subscription"
      ? {
          $or: [
            { accessExpiresAt: null },
            { accessExpiresAt: { $gt: new Date() } },
          ],
        }
      : {}),
  });

  if (exists) {
    return true;
  }

  return hasCreatorSubscriptionAccess({ userId, creatorId });
};

const getUserPaidPurchases = async (userId) => {
  if (!isValidObjectId(userId)) {
    return [];
  }

  const [purchases, directEntitlements] = await Promise.all([
    Purchase.find({
      userId,
      status: "paid",
    })
    .sort({ paidAt: -1, createdAt: -1 })
    .lean(),
    Entitlement.find({ buyerId: userId }).sort({ grantedAt: -1 }).lean(),
  ]);

  const now = new Date();
  const activePurchases = purchases.filter((row) => (
    String(row?.itemType || "").trim().toLowerCase() !== "subscription"
      || isSubscriptionAccessActive(row, { at: now })
  ));

  if (!directEntitlements.length) {
    return activePurchases;
  }

  const existingKeys = new Set(
    activePurchases.map((row) => `${row.itemType}:${String(row.itemId || "")}`)
  );
  const synthesized = directEntitlements
    .filter((row) => !existingKeys.has(`${row.itemType}:${String(row.itemId || "")}`))
    .map((row) => ({
      _id: row._id,
      userId: row.buyerId,
      itemType: row.itemType,
      itemId: row.itemId,
      status: "paid",
      amount: 0,
      currency: "NGN",
      provider: "manual",
      providerRef: `entitlement-${row._id}`,
      paidAt: row.grantedAt || row.createdAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

  return [...activePurchases, ...synthesized];
};

const getLatestCreatorSubscriptionPurchase = async ({ userId, creatorId } = {}) => {
  if (!isValidObjectId(userId) || !isValidObjectId(creatorId)) {
    return null;
  }

  return Purchase.findOne({
    userId,
    creatorId,
    itemType: "subscription",
  })
    .sort({ paidAt: -1, createdAt: -1, updatedAt: -1 })
    .lean();
};

const reconcilePaidPurchaseEntitlements = async ({ logger = console, reason = "manual" } = {}) => {
  const cursor = Purchase.find({
    status: "paid",
    itemType: { $in: ENTITLEMENT_ITEM_TYPES },
  })
    .sort({ paidAt: 1, createdAt: 1, _id: 1 })
    .select("_id userId creatorId itemType itemId amount currency status provider providerRef paidAt createdAt updatedAt")
    .cursor();

  let scannedCount = 0;
  let createdCount = 0;
  let existingCount = 0;
  let skippedCount = 0;
  const skippedByReason = {};

  for await (const purchase of cursor) {
    scannedCount += 1;
    const result = await backfillEntitlementForPaidPurchase({ purchase, reason });
    if (result.created) {
      createdCount += 1;
    } else if (result.skipped) {
      skippedCount += 1;
      skippedByReason[result.reason] = Number(skippedByReason[result.reason] || 0) + 1;
    } else {
      existingCount += 1;
    }
  }

  const payload = {
    reason,
    scannedCount,
    createdCount,
    existingCount,
    skippedCount,
    skippedByReason,
  };

  if (logger?.info) {
    logger.info("[entitlement-reconciliation] completed", payload);
  } else if (logger?.log) {
    logger.log("[entitlement-reconciliation] completed", payload);
  }

  return payload;
};

const startEntitlementMaintenance = async ({ logger = console } = {}) => {
  const enabled = parseBooleanEnv(process.env.ENTITLEMENT_RECONCILIATION_ENABLED, true);
  if (!enabled) {
    if (logger?.info) {
      logger.info("Entitlement reconciliation disabled.");
    } else if (logger?.log) {
      logger.log("Entitlement reconciliation disabled.");
    }
    return { enabled: false, intervalMs: 0 };
  }

  const parsedInterval = Number(
    process.env.ENTITLEMENT_RECONCILIATION_INTERVAL_MS || DEFAULT_ENTITLEMENT_RECONCILIATION_INTERVAL_MS
  );
  const intervalMs =
    Number.isFinite(parsedInterval) && parsedInterval >= 5 * 60 * 1000
      ? parsedInterval
      : DEFAULT_ENTITLEMENT_RECONCILIATION_INTERVAL_MS;

  if (parseBooleanEnv(process.env.ENTITLEMENT_RECONCILIATION_RUN_ON_BOOT, true)) {
    await reconcilePaidPurchaseEntitlements({ logger, reason: "startup" });
  }

  const interval = setInterval(() => {
    reconcilePaidPurchaseEntitlements({ logger, reason: "interval" }).catch((error) => {
      const message = error?.message || error;
      if (logger?.error) {
        logger.error("[entitlement-reconciliation] failed", { message });
      } else if (logger?.warn) {
        logger.warn("[entitlement-reconciliation] failed", { message });
      } else if (logger?.log) {
        logger.log("[entitlement-reconciliation] failed", { message });
      }
    });
  }, intervalMs);
  interval.unref?.();

  if (logger?.info) {
    logger.info(`Entitlement reconciliation scheduled every ${intervalMs}ms.`);
  } else if (logger?.log) {
    logger.log(`Entitlement reconciliation scheduled every ${intervalMs}ms.`);
  }

  return {
    enabled: true,
    intervalMs,
  };
};

module.exports = {
  DEFAULT_ENTITLEMENT_RECONCILIATION_INTERVAL_MS,
  hasEntitlement,
  hasCreatorSubscriptionAccess,
  getUserPaidPurchases,
  getLatestCreatorSubscriptionPurchase,
  backfillEntitlementForPaidPurchase,
  reconcilePaidPurchaseEntitlements,
  startEntitlementMaintenance,
};
