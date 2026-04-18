const mongoose = require("mongoose");
const CreatorProfile = require("../models/CreatorProfile");
const Purchase = require("../models/Purchase");
const WalletAccount = require("../models/WalletAccount");
const WalletEntry = require("../models/WalletEntry");

const CREATOR_SHARE_RATE = 0.4;
const PLATFORM_SHARE_RATE = 0.6;
const DEFAULT_WALLET_RECONCILIATION_INTERVAL_MS = 60 * 60 * 1000;
const PLATFORM_WALLET_OWNER_KEY = "tengacion";
const DEFAULT_CREATOR_WALLET_RECENT_LIMIT = 10;

const WALLET_BREAKDOWN_LABELS = {
  track: "Music",
  book: "Books",
  album: "Albums",
  video: "Videos",
  subscription: "Subscriptions",
  other: "Other sales",
};

const WALLET_ENTRY_LABELS = {
  sale_credit: "Sale credited",
  platform_fee: "Platform fee",
  pending_hold: "Pending hold",
  hold_release: "Hold released",
  payout_debit: "Payout sent",
  refund_debit: "Refund",
  adjustment_credit: "Adjustment credit",
  adjustment_debit: "Adjustment debit",
};

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

const normalizeItemType = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "other";
  }
  if (["music", "song", "songs", "track", "tracks"].includes(normalized)) {
    return "track";
  }
  if (["book", "books", "ebook", "ebooks"].includes(normalized)) {
    return "book";
  }
  if (["album", "albums"].includes(normalized)) {
    return "album";
  }
  if (["video", "videos"].includes(normalized)) {
    return "video";
  }
  if (["subscription", "subscriptions", "membership", "fanpass"].includes(normalized)) {
    return "subscription";
  }
  return normalized;
};

const buildBreakdownLabel = (itemType = "") =>
  WALLET_BREAKDOWN_LABELS[normalizeItemType(itemType)] || WALLET_BREAKDOWN_LABELS.other;

const buildWalletEntryLabel = (entryType = "") =>
  WALLET_ENTRY_LABELS[String(entryType || "").trim().toLowerCase()] || "Wallet entry";

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

const buildAvailableOnlySummary = ({ grossRevenue = 0, currency = "NGN", walletBacked = false } = {}) => {
  const normalizedGrossRevenue = clampMoney(grossRevenue);
  const totalEarnings = computeCreatorShare(normalizedGrossRevenue);

  return {
    currency: normalizeCurrency(currency),
    grossRevenue: normalizedGrossRevenue,
    totalEarnings,
    availableBalance: totalEarnings,
    pendingBalance: 0,
    withdrawn: 0,
    walletBacked,
  };
};

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

const buildWalletRecentEntryFromLedger = (entry = {}) => {
  const metadata = entry?.metadata || {};
  const itemType = normalizeItemType(metadata?.itemType || "");
  const signedAmount =
    String(entry?.direction || "").trim().toLowerCase() === "debit"
      ? -clampMoney(entry?.amount)
      : clampMoney(entry?.amount);

  return {
    id: toIdString(entry?._id),
    entryType: entry?.entryType || "",
    label: buildWalletEntryLabel(entry?.entryType),
    amount: clampMoney(entry?.amount),
    signedAmount,
    grossAmount: clampMoney(entry?.grossAmount),
    currency: normalizeCurrency(entry?.currency),
    bucket: entry?.bucket || "available",
    direction: entry?.direction || "credit",
    itemType,
    itemLabel: buildBreakdownLabel(itemType),
    itemId: toIdString(metadata?.itemId),
    purchaseId: toIdString(metadata?.purchaseId || entry?.sourceId),
    provider: metadata?.provider || "",
    providerRef: entry?.sourceRef || metadata?.providerRef || "",
    creatorAmount: clampMoney(metadata?.creatorAmount || 0),
    platformAmount: clampMoney(metadata?.platformAmount || 0),
    effectiveAt: entry?.effectiveAt || entry?.createdAt || null,
  };
};

const buildWalletRecentEntryFromPurchase = (purchase = {}) => {
  const grossAmount = clampMoney(purchase?.amount);
  const creatorAmount = computeCreatorShare(grossAmount);
  const platformAmount = computePlatformShare(grossAmount);
  const itemType = normalizeItemType(purchase?.itemType || "");

  return {
    id: toIdString(purchase?._id),
    entryType: "sale_credit",
    label: buildWalletEntryLabel("sale_credit"),
    amount: creatorAmount,
    signedAmount: creatorAmount,
    grossAmount,
    currency: normalizeCurrency(purchase?.currency),
    bucket: "available",
    direction: "credit",
    itemType,
    itemLabel: buildBreakdownLabel(itemType),
    itemId: toIdString(purchase?.itemId),
    purchaseId: toIdString(purchase?._id),
    provider: purchase?.provider || "",
    providerRef: purchase?.providerRef || "",
    creatorAmount,
    platformAmount,
    effectiveAt: purchase?.paidAt || purchase?.updatedAt || purchase?.createdAt || null,
  };
};

const buildCreatorWalletSnapshot = async ({
  creatorId,
  currency = "NGN",
  recentLimit = DEFAULT_CREATOR_WALLET_RECENT_LIMIT,
} = {}) => {
  const normalizedCurrency = normalizeCurrency(currency);
  const safeRecentLimit =
    Number.isFinite(Number(recentLimit)) && Number(recentLimit) > 0 ? Math.floor(Number(recentLimit)) : DEFAULT_CREATOR_WALLET_RECENT_LIMIT;
  const wallet = creatorId
    ? await WalletAccount.findOne({
        slug: getCreatorWalletSlug(creatorId, normalizedCurrency),
      })
        .select("_id currency")
        .lean()
    : null;

  if (wallet?._id) {
    const walletObjectId = new mongoose.Types.ObjectId(wallet._id);
    const [summary, recentEntryDocs, breakdownRows, itemRows] = await Promise.all([
      buildCreatorWalletSummary({
        creatorId,
        currency: normalizedCurrency,
      }),
      WalletEntry.find({ walletAccountId: walletObjectId })
        .sort({ effectiveAt: -1, createdAt: -1, _id: -1 })
        .limit(safeRecentLimit)
        .select(
          "_id entryType amount grossAmount currency bucket direction sourceId sourceRef effectiveAt createdAt metadata"
        )
        .lean(),
      WalletEntry.aggregate([
        {
          $match: {
            walletAccountId: walletObjectId,
            entryType: "sale_credit",
          },
        },
        {
          $group: {
            _id: "$metadata.itemType",
            grossRevenue: { $sum: "$grossAmount" },
            creatorEarnings: { $sum: "$amount" },
            transactions: { $sum: 1 },
          },
        },
      ]),
      WalletEntry.aggregate([
        {
          $match: {
            walletAccountId: walletObjectId,
            entryType: "sale_credit",
          },
        },
        {
          $group: {
            _id: {
              itemType: "$metadata.itemType",
              itemId: "$metadata.itemId",
            },
            creatorEarnings: { $sum: "$amount" },
          },
        },
      ]),
    ]);

    if (summary.walletBacked) {
      const itemEarningsMap = new Map();
      itemRows.forEach((row) => {
        const itemType = normalizeItemType(row?._id?.itemType || "");
        const itemId = toIdString(row?._id?.itemId);
        if (!itemId) {
          return;
        }
        itemEarningsMap.set(`${itemType}:${itemId}`, clampMoney(row?.creatorEarnings));
      });

      return {
        currency: normalizedCurrency,
        summary: {
          ...summary,
          walletBacked: true,
        },
        walletBacked: true,
        settlementSource: "wallet",
        recentEntries: recentEntryDocs.map(buildWalletRecentEntryFromLedger),
        breakdown: breakdownRows
          .map((row) => {
            const itemType = normalizeItemType(row?._id || "");
            return {
              key: itemType,
              label: buildBreakdownLabel(itemType),
              grossRevenue: clampMoney(row?.grossRevenue),
              creatorEarnings: clampMoney(row?.creatorEarnings),
              transactions: Number(row?.transactions || 0),
            };
          })
          .sort((left, right) => Number(right.creatorEarnings || 0) - Number(left.creatorEarnings || 0)),
        itemEarningsMap,
      };
    }
  }

  const purchases = creatorId
    ? await Purchase.find({
        creatorId,
        status: "paid",
        currency: normalizedCurrency,
      })
        .sort({ paidAt: -1, createdAt: -1, _id: -1 })
        .select("_id itemType itemId amount currency provider providerRef paidAt createdAt updatedAt")
        .lean()
    : [];

  const grossRevenue = purchases.reduce((sum, row) => sum + clampMoney(row?.amount), 0);
  const summary = buildAvailableOnlySummary({
    grossRevenue,
    currency: normalizedCurrency,
    walletBacked: false,
  });

  const itemEarningsMap = new Map();
  const breakdownMap = new Map();

  purchases.forEach((purchase) => {
    const itemType = normalizeItemType(purchase?.itemType || "");
    const itemId = toIdString(purchase?.itemId);
    const creatorAmount = computeCreatorShare(purchase?.amount);
    const grossAmount = clampMoney(purchase?.amount);

    if (itemId) {
      const itemKey = `${itemType}:${itemId}`;
      itemEarningsMap.set(itemKey, clampMoney((itemEarningsMap.get(itemKey) || 0) + creatorAmount));
    }

    const bucket = breakdownMap.get(itemType) || {
      key: itemType,
      label: buildBreakdownLabel(itemType),
      grossRevenue: 0,
      creatorEarnings: 0,
      transactions: 0,
    };

    bucket.grossRevenue += grossAmount;
    bucket.creatorEarnings += creatorAmount;
    bucket.transactions += 1;
    breakdownMap.set(itemType, bucket);
  });

  return {
    currency: normalizedCurrency,
    summary,
    walletBacked: false,
    settlementSource: "purchase_fallback",
    recentEntries: purchases.slice(0, safeRecentLimit).map(buildWalletRecentEntryFromPurchase),
    breakdown: Array.from(breakdownMap.values())
      .map((row) => ({
        ...row,
        grossRevenue: clampMoney(row.grossRevenue),
        creatorEarnings: clampMoney(row.creatorEarnings),
      }))
      .sort((left, right) => Number(right.creatorEarnings || 0) - Number(left.creatorEarnings || 0)),
    itemEarningsMap,
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
  buildCreatorWalletSnapshot,
  reconcilePaidPurchaseWalletEntries,
  startWalletMaintenance,
};
