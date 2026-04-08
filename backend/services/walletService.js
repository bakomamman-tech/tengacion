const mongoose = require("mongoose");
const CreatorProfile = require("../models/CreatorProfile");
const Purchase = require("../models/Purchase");
const WalletAccount = require("../models/WalletAccount");
const WalletEntry = require("../models/WalletEntry");

const CREATOR_SHARE_RATE = 0.4;
const PLATFORM_SHARE_RATE = 0.6;
const DEFAULT_WALLET_RECONCILIATION_INTERVAL_MS = 60 * 60 * 1000;
const PLATFORM_WALLET_OWNER_KEY = "tengacion";

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

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const clampMoney = (value) => Math.max(0, roundMoney(value));

const normalizeCurrency = (value = "NGN") => String(value || "NGN").trim().toUpperCase() || "NGN";

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

const getPlatformWalletSlug = (currency = "NGN") =>
  `platform:${PLATFORM_WALLET_OWNER_KEY}:${normalizeCurrency(currency)}`;

const getCreatorWalletSlug = (creatorId, currency = "NGN") =>
  `creator:${toIdString(creatorId)}:${normalizeCurrency(currency)}`;

const buildWalletLabel = ({ ownerType, ownerId, currency }) => {
  const normalizedCurrency = normalizeCurrency(currency);
  if (ownerType === "platform") {
    return `Tengacion platform wallet (${normalizedCurrency})`;
  }
  return `Creator wallet ${toIdString(ownerId)} (${normalizedCurrency})`;
};

const ensureWalletAccount = async ({ ownerType, ownerId = null, currency = "NGN", label = "" } = {}) => {
  const normalizedCurrency = normalizeCurrency(currency);
  const slug =
    ownerType === "platform"
      ? getPlatformWalletSlug(normalizedCurrency)
      : getCreatorWalletSlug(ownerId, normalizedCurrency);

  const account = await WalletAccount.findOneAndUpdate(
    { slug },
    {
      $setOnInsert: {
        slug,
        ownerType,
        ownerId: ownerType === "platform" ? null : ownerId || null,
        currency: normalizedCurrency,
        label: label || buildWalletLabel({ ownerType, ownerId, currency: normalizedCurrency }),
        status: "active",
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  return account;
};

const ensureCreatorWalletAccount = async (creatorId, currency = "NGN") =>
  ensureWalletAccount({ ownerType: "creator", ownerId: creatorId, currency });

const ensurePlatformWalletAccount = async (currency = "NGN") =>
  ensureWalletAccount({ ownerType: "platform", currency });

const computeCreatorShare = (grossAmount) => clampMoney(Number(grossAmount || 0) * CREATOR_SHARE_RATE);
const computePlatformShare = (grossAmount) => clampMoney(Number(grossAmount || 0) * PLATFORM_SHARE_RATE);

const buildPurchaseSettlementEntryPayloads = async (purchase) => {
  if (!purchase?.creatorId) {
    return [];
  }

  const grossAmount = clampMoney(purchase.amount);
  if (grossAmount <= 0) {
    return [];
  }

  const currency = normalizeCurrency(purchase.currency);
  const creatorAmount = computeCreatorShare(grossAmount);
  const platformAmount = computePlatformShare(grossAmount);
  const [creatorWallet, platformWallet] = await Promise.all([
    ensureCreatorWalletAccount(purchase.creatorId, currency),
    ensurePlatformWalletAccount(currency),
  ]);

  const creatorId = toIdString(purchase.creatorId);
  const purchaseId = toIdString(purchase._id);
  const itemId = toIdString(purchase.itemId);
  const paidAt = purchase.paidAt || purchase.updatedAt || purchase.createdAt || new Date();
  const sharedMetadata = {
    creatorId,
    itemType: String(purchase.itemType || "").trim().toLowerCase(),
    itemId,
    purchaseId,
    provider: purchase.provider || "paystack",
    providerRef: purchase.providerRef || "",
    billingInterval: purchase.billingInterval || "one_time",
    creatorAmount,
    platformAmount,
  };

  return [
    {
      walletAccountId: creatorWallet._id,
      ownerType: "creator",
      ownerId: purchase.creatorId,
      currency,
      direction: "credit",
      bucket: "available",
      entryType: "sale_credit",
      amount: creatorAmount,
      grossAmount,
      sourceType: "purchase",
      sourceId: purchase._id,
      sourceRef: purchase.providerRef || "",
      dedupeKey: `purchase_sale_credit:${purchaseId}`,
      effectiveAt: paidAt,
      metadata: sharedMetadata,
    },
    {
      walletAccountId: platformWallet._id,
      ownerType: "platform",
      ownerId: null,
      currency,
      direction: "credit",
      bucket: "available",
      entryType: "platform_fee",
      amount: platformAmount,
      grossAmount,
      sourceType: "purchase",
      sourceId: purchase._id,
      sourceRef: purchase.providerRef || "",
      dedupeKey: `purchase_platform_fee:${purchaseId}`,
      effectiveAt: paidAt,
      metadata: sharedMetadata,
    },
  ];
};

const upsertWalletEntry = async (payload) => {
  const result = await WalletEntry.updateOne(
    { dedupeKey: payload.dedupeKey },
    { $setOnInsert: payload },
    { upsert: true, setDefaultsOnInsert: true }
  );

  return {
    created: Boolean(result?.upsertedCount),
  };
};

const recordPurchaseSettlementEntries = async ({ purchase, logger = console } = {}) => {
  if (!purchase?._id) {
    return {
      createdCount: 0,
      skipped: true,
      reason: "missing_purchase",
    };
  }

  const entryPayloads = await buildPurchaseSettlementEntryPayloads(purchase);
  if (!entryPayloads.length) {
    return {
      createdCount: 0,
      skipped: true,
      reason: purchase?.creatorId ? "non_positive_amount" : "missing_creator",
    };
  }

  let createdCount = 0;
  for (const payload of entryPayloads) {
    const result = await upsertWalletEntry(payload);
    if (result.created) {
      createdCount += 1;
    }
  }

  if (createdCount > 0 && logger?.info) {
    logger.info("[wallet] purchase settlement recorded", {
      purchaseId: toIdString(purchase._id),
      createdCount,
      providerRef: purchase.providerRef || "",
    });
  }

  return {
    createdCount,
    skipped: false,
    purchaseId: toIdString(purchase._id),
  };
};

const buildCreatorWalletSummary = async ({ creatorId, fallbackGrossRevenue = 0, currency = "NGN" } = {}) => {
  if (!creatorId) {
    return {
      currency: normalizeCurrency(currency),
      grossRevenue: clampMoney(fallbackGrossRevenue),
      totalEarnings: 0,
      availableBalance: 0,
      pendingBalance: 0,
      withdrawn: 0,
      walletBacked: false,
    };
  }

  const normalizedCurrency = normalizeCurrency(currency);
  const wallet = await WalletAccount.findOne({
    slug: getCreatorWalletSlug(creatorId, normalizedCurrency),
  })
    .select("_id")
    .lean();

  if (!wallet) {
    return {
      currency: normalizedCurrency,
      grossRevenue: clampMoney(fallbackGrossRevenue),
      totalEarnings: 0,
      availableBalance: 0,
      pendingBalance: 0,
      withdrawn: 0,
      walletBacked: false,
    };
  }

  const [aggregate] = await WalletEntry.aggregate([
    {
      $match: {
        walletAccountId: new mongoose.Types.ObjectId(wallet._id),
      },
    },
    {
      $group: {
        _id: null,
        entryCount: { $sum: 1 },
        grossRevenue: {
          $sum: {
            $cond: [{ $eq: ["$entryType", "sale_credit"] }, "$grossAmount", 0],
          },
        },
        saleCredits: {
          $sum: {
            $cond: [{ $eq: ["$entryType", "sale_credit"] }, "$amount", 0],
          },
        },
        adjustmentCredits: {
          $sum: {
            $cond: [{ $eq: ["$entryType", "adjustment_credit"] }, "$amount", 0],
          },
        },
        adjustmentDebits: {
          $sum: {
            $cond: [{ $eq: ["$entryType", "adjustment_debit"] }, "$amount", 0],
          },
        },
        refundDebits: {
          $sum: {
            $cond: [{ $eq: ["$entryType", "refund_debit"] }, "$amount", 0],
          },
        },
        payoutDebits: {
          $sum: {
            $cond: [{ $eq: ["$entryType", "payout_debit"] }, "$amount", 0],
          },
        },
        availableCredits: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$bucket", "available"] },
                  { $eq: ["$direction", "credit"] },
                ],
              },
              "$amount",
              0,
            ],
          },
        },
        availableDebits: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$bucket", "available"] },
                  { $eq: ["$direction", "debit"] },
                ],
              },
              "$amount",
              0,
            ],
          },
        },
        pendingCredits: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$bucket", "pending"] },
                  { $eq: ["$direction", "credit"] },
                ],
              },
              "$amount",
              0,
            ],
          },
        },
        pendingDebits: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$bucket", "pending"] },
                  { $eq: ["$direction", "debit"] },
                ],
              },
              "$amount",
              0,
            ],
          },
        },
      },
    },
  ]);

  const totalEarnings = clampMoney(
    Number(aggregate?.saleCredits || 0)
      + Number(aggregate?.adjustmentCredits || 0)
      - Number(aggregate?.adjustmentDebits || 0)
      - Number(aggregate?.refundDebits || 0)
  );
  const hasLedgerEntries = Number(aggregate?.entryCount || 0) > 0;

  return {
    currency: normalizedCurrency,
    grossRevenue: clampMoney(
      Number(aggregate?.grossRevenue || 0) || Number(fallbackGrossRevenue || 0)
    ),
    totalEarnings,
    availableBalance: clampMoney(
      Number(aggregate?.availableCredits || 0) - Number(aggregate?.availableDebits || 0)
    ),
    pendingBalance: clampMoney(
      Number(aggregate?.pendingCredits || 0) - Number(aggregate?.pendingDebits || 0)
    ),
    withdrawn: clampMoney(Number(aggregate?.payoutDebits || 0)),
    walletBacked: hasLedgerEntries,
  };
};

const loadCreatorProfileIds = async () => {
  const profiles = await CreatorProfile.find({})
    .select("_id")
    .lean();
  return new Set(profiles.map((row) => toIdString(row._id)));
};

const reconcilePaidPurchaseWalletEntries = async ({ logger = console, reason = "manual" } = {}) => {
  const validCreatorIds = await loadCreatorProfileIds();
  const cursor = Purchase.find({
    status: "paid",
    creatorId: { $ne: null },
  })
    .sort({ paidAt: 1, createdAt: 1, _id: 1 })
    .select(
      "_id creatorId itemType itemId amount currency provider providerRef billingInterval paidAt createdAt updatedAt"
    )
    .cursor();

  let scannedCount = 0;
  let createdCount = 0;
  let matchedCount = 0;

  for await (const purchase of cursor) {
    scannedCount += 1;
    if (!validCreatorIds.has(toIdString(purchase.creatorId))) {
      continue;
    }

    matchedCount += 1;
    const result = await recordPurchaseSettlementEntries({ purchase, logger: null });
    createdCount += Number(result.createdCount || 0);
  }

  const payload = {
    reason,
    scannedCount,
    matchedCount,
    createdCount,
  };

  if (logger?.info) {
    logger.info("[wallet-reconciliation] completed", payload);
  } else if (logger?.log) {
    logger.log("[wallet-reconciliation] completed", payload);
  }

  return payload;
};

const startWalletMaintenance = async ({ logger = console } = {}) => {
  const enabled = parseBooleanEnv(process.env.WALLET_RECONCILIATION_ENABLED, true);
  if (!enabled) {
    if (logger?.info) {
      logger.info("Wallet reconciliation disabled.");
    } else if (logger?.log) {
      logger.log("Wallet reconciliation disabled.");
    }
    return { enabled: false, intervalMs: 0 };
  }

  const parsedInterval = Number(
    process.env.WALLET_RECONCILIATION_INTERVAL_MS || DEFAULT_WALLET_RECONCILIATION_INTERVAL_MS
  );
  const intervalMs =
    Number.isFinite(parsedInterval) && parsedInterval >= 5 * 60 * 1000
      ? parsedInterval
      : DEFAULT_WALLET_RECONCILIATION_INTERVAL_MS;

  if (parseBooleanEnv(process.env.WALLET_RECONCILIATION_RUN_ON_BOOT, true)) {
    await reconcilePaidPurchaseWalletEntries({ logger, reason: "startup" });
  }

  const interval = setInterval(() => {
    reconcilePaidPurchaseWalletEntries({ logger, reason: "interval" }).catch((error) => {
      const message = error?.message || error;
      if (logger?.error) {
        logger.error("[wallet-reconciliation] failed", { message });
      } else if (logger?.warn) {
        logger.warn("[wallet-reconciliation] failed", { message });
      } else if (logger?.log) {
        logger.log("[wallet-reconciliation] failed", { message });
      }
    });
  }, intervalMs);
  interval.unref?.();

  if (logger?.info) {
    logger.info(`Wallet reconciliation scheduled every ${intervalMs}ms.`);
  } else if (logger?.log) {
    logger.log(`Wallet reconciliation scheduled every ${intervalMs}ms.`);
  }

  return {
    enabled: true,
    intervalMs,
  };
};

module.exports = {
  CREATOR_SHARE_RATE,
  PLATFORM_SHARE_RATE,
  DEFAULT_WALLET_RECONCILIATION_INTERVAL_MS,
  getPlatformWalletSlug,
  getCreatorWalletSlug,
  ensureCreatorWalletAccount,
  ensurePlatformWalletAccount,
  recordPurchaseSettlementEntries,
  buildCreatorWalletSummary,
  reconcilePaidPurchaseWalletEntries,
  startWalletMaintenance,
};
