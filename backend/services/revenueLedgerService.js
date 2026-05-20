const mongoose = require("mongoose");
const RevenueLedgerEntry = require("../models/RevenueLedgerEntry");
const { buildDateRange } = require("./analyticsService");

const CREATOR_SHARE_RATE = 0.4;
const PLATFORM_SHARE_RATE = 0.6;
const DEFAULT_RECENT_LIMIT = 25;

const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const clampMoney = (value) => Math.max(0, roundMoney(value));

const normalizeCurrency = (value = "NGN") =>
  String(value || "NGN").trim().toUpperCase() || "NGN";

const normalizeText = (value = "", maxLength = 120) =>
  String(value || "").trim().slice(0, maxLength);

const toIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  return value.toString();
};

const toObjectIdOrNull = (value) => {
  const normalized = toIdString(value);
  return mongoose.Types.ObjectId.isValid(normalized)
    ? new mongoose.Types.ObjectId(normalized)
    : null;
};

const computeCreatorShare = (grossAmount) =>
  clampMoney(Number(grossAmount || 0) * CREATOR_SHARE_RATE);

const computePlatformShare = (grossAmount) =>
  clampMoney(Number(grossAmount || 0) * PLATFORM_SHARE_RATE);

const calculateResultingBalance = ({ previousBalance = 0, amount = 0, direction = "none" } = {}) => {
  const previous = roundMoney(previousBalance);
  const safeAmount = clampMoney(amount);
  if (direction === "credit") {
    return roundMoney(previous + safeAmount);
  }
  if (direction === "debit") {
    return roundMoney(previous - safeAmount);
  }
  return previous;
};

const loadPreviousBalance = async ({
  accountType,
  accountId = null,
  currency = "NGN",
  balanceScope = "none",
} = {}) => {
  if (!accountType || balanceScope === "none") {
    return 0;
  }

  const previous = await RevenueLedgerEntry.findOne({
    accountType,
    accountId: accountId || null,
    currency: normalizeCurrency(currency),
    balanceScope,
  })
    .sort({ occurredAt: -1, createdAt: -1, _id: -1 })
    .select("resultingBalance")
    .lean();

  return roundMoney(previous?.resultingBalance || 0);
};

const recordRevenueLedgerEntry = async ({
  ledgerEventType,
  accountType = "system",
  accountId = null,
  currency = "NGN",
  amount = 0,
  direction = "none",
  balanceScope = "none",
  actorType = "system",
  actorId = null,
  actorRole = "",
  sourceType,
  sourceId = null,
  sourceRef = "",
  provider = "",
  providerReference = "",
  dedupeKey,
  occurredAt = new Date(),
  auditMetadata = {},
} = {}) => {
  if (!ledgerEventType || !sourceType || !dedupeKey) {
    return {
      created: false,
      entry: null,
      skipped: true,
      reason: "missing_required_fields",
    };
  }

  const existing = await RevenueLedgerEntry.findOne({ dedupeKey });
  if (existing) {
    return {
      created: false,
      entry: existing,
      skipped: false,
      duplicate: true,
    };
  }

  const normalizedCurrency = normalizeCurrency(currency);
  const normalizedAmount = clampMoney(amount);
  const normalizedAccountId = toObjectIdOrNull(accountId);
  const previousBalance = await loadPreviousBalance({
    accountType,
    accountId: normalizedAccountId,
    currency: normalizedCurrency,
    balanceScope,
  });
  const resultingBalance = calculateResultingBalance({
    previousBalance,
    amount: normalizedAmount,
    direction,
  });

  try {
    const entry = await RevenueLedgerEntry.create({
      ledgerEventType,
      accountType,
      accountId: normalizedAccountId,
      currency: normalizedCurrency,
      amount: normalizedAmount,
      direction,
      balanceScope,
      previousBalance,
      resultingBalance,
      actorType,
      actorId: toObjectIdOrNull(actorId),
      actorRole: normalizeText(actorRole, 60).toLowerCase(),
      sourceType,
      sourceId: toObjectIdOrNull(sourceId),
      sourceRef: normalizeText(sourceRef, 160),
      provider: normalizeText(provider, 40).toLowerCase(),
      providerReference: normalizeText(providerReference || sourceRef, 160),
      dedupeKey: normalizeText(dedupeKey, 220),
      occurredAt,
      auditMetadata,
    });

    return {
      created: true,
      entry,
      skipped: false,
      duplicate: false,
    };
  } catch (error) {
    if (error?.code === 11000) {
      const duplicate = await RevenueLedgerEntry.findOne({ dedupeKey });
      return {
        created: false,
        entry: duplicate,
        skipped: false,
        duplicate: true,
      };
    }
    throw error;
  }
};

const recordMany = async (payloads = []) => {
  const results = [];
  for (const payload of payloads) {
    results.push(await recordRevenueLedgerEntry(payload));
  }
  return {
    createdCount: results.filter((entry) => entry.created).length,
    results,
  };
};

const buildPurchaseLedgerBase = ({ purchase, actorUserId = "", actorRole = "", actorType = "" } = {}) => {
  const purchaseId = toIdString(purchase?._id);
  const provider = normalizeText(purchase?.provider || "paystack", 40).toLowerCase();
  const providerReference = normalizeText(purchase?.providerRef || "", 160);
  const currency = normalizeCurrency(purchase?.currency);
  const amount = clampMoney(purchase?.amount);
  const systemActorType = actorType || (actorUserId ? "user" : provider ? "provider" : "system");

  return {
    purchaseId,
    provider,
    providerReference,
    currency,
    amount,
    actorType: systemActorType,
    actorId: actorUserId || null,
    actorRole,
    sourceType: "purchase",
    sourceId: purchase?._id,
    sourceRef: providerReference,
    auditMetadata: {
      purchaseId,
      buyerId: toIdString(purchase?.userId),
      creatorId: toIdString(purchase?.creatorId),
      itemType: normalizeText(purchase?.itemType, 40).toLowerCase(),
      itemId: toIdString(purchase?.itemId),
      provider,
      providerReference,
      billingInterval: purchase?.billingInterval || "one_time",
    },
  };
};

const recordPurchaseAuthorized = async ({
  purchase,
  actorUserId = "",
  actorRole = "",
  actorType = "user",
} = {}) => {
  if (!purchase?._id) {
    return { createdCount: 0, skipped: true, reason: "missing_purchase" };
  }

  const base = buildPurchaseLedgerBase({ purchase, actorUserId, actorRole, actorType });
  const result = await recordRevenueLedgerEntry({
    ...base,
    ledgerEventType: "purchase_authorized",
    accountType: "buyer",
    accountId: purchase.userId,
    direction: "none",
    balanceScope: "none",
    dedupeKey: `purchase_authorized:${base.purchaseId}`,
    occurredAt: purchase.createdAt || new Date(),
  });

  return {
    createdCount: result.created ? 1 : 0,
    skipped: false,
  };
};

const recordPurchaseSettlementLedgerEntries = async ({
  purchase,
  actorUserId = "",
  actorRole = "",
  actorType = "provider",
} = {}) => {
  if (!purchase?._id) {
    return { createdCount: 0, skipped: true, reason: "missing_purchase" };
  }

  const base = buildPurchaseLedgerBase({ purchase, actorUserId, actorRole, actorType });
  const creatorAmount = computeCreatorShare(base.amount);
  const platformAmount = computePlatformShare(base.amount);
  const occurredAt = purchase.paidAt || purchase.updatedAt || new Date();

  return recordMany([
    {
      ...base,
      ledgerEventType: "payment_settled",
      accountType: "buyer",
      accountId: purchase.userId,
      direction: "none",
      balanceScope: "none",
      dedupeKey: `payment_settled:${base.purchaseId}`,
      occurredAt,
    },
    {
      ...base,
      ledgerEventType: "platform_commission_reserved",
      accountType: "platform",
      accountId: null,
      amount: platformAmount,
      direction: "credit",
      balanceScope: "commission",
      dedupeKey: `platform_commission_reserved:${base.purchaseId}`,
      occurredAt,
      auditMetadata: {
        ...base.auditMetadata,
        grossAmount: base.amount,
        creatorAmount,
        platformAmount,
      },
    },
    {
      ...base,
      ledgerEventType: "creator_earning_credited",
      accountType: "creator",
      accountId: purchase.creatorId,
      amount: creatorAmount,
      direction: "credit",
      balanceScope: "available",
      dedupeKey: `creator_earning_credited:${base.purchaseId}`,
      occurredAt,
      auditMetadata: {
        ...base.auditMetadata,
        grossAmount: base.amount,
        creatorAmount,
        platformAmount,
      },
    },
  ]);
};

const recordRefundInitiated = async ({
  purchase,
  actorUserId = "",
  actorRole = "",
  reason = "",
} = {}) => {
  if (!purchase?._id) {
    return { createdCount: 0, skipped: true, reason: "missing_purchase" };
  }

  const base = buildPurchaseLedgerBase({
    purchase,
    actorUserId,
    actorRole,
    actorType: actorUserId ? "admin" : "system",
  });
  const result = await recordRevenueLedgerEntry({
    ...base,
    ledgerEventType: "refund_initiated",
    accountType: "system",
    accountId: null,
    direction: "none",
    balanceScope: "none",
    sourceType: "refund",
    dedupeKey: `refund_initiated:${base.purchaseId}`,
    occurredAt: new Date(),
    auditMetadata: {
      ...base.auditMetadata,
      reason: normalizeText(reason, 240),
    },
  });

  return {
    createdCount: result.created ? 1 : 0,
    skipped: false,
  };
};

const recordRefundSettledLedgerEntries = async ({
  purchase,
  actorUserId = "",
  actorRole = "",
  reason = "",
} = {}) => {
  if (!purchase?._id) {
    return { createdCount: 0, skipped: true, reason: "missing_purchase" };
  }

  const base = buildPurchaseLedgerBase({
    purchase,
    actorUserId,
    actorRole,
    actorType: actorUserId ? "admin" : "system",
  });
  const creatorAmount = computeCreatorShare(base.amount);
  const platformAmount = computePlatformShare(base.amount);
  const occurredAt = purchase.refundedAt || purchase.updatedAt || new Date();
  const auditMetadata = {
    ...base.auditMetadata,
    grossAmount: base.amount,
    creatorAmount,
    platformAmount,
    reason: normalizeText(reason || purchase.refundReason || "", 240),
  };

  return recordMany([
    {
      ...base,
      ledgerEventType: "refund_settled",
      accountType: "creator",
      accountId: purchase.creatorId,
      amount: creatorAmount,
      direction: "debit",
      balanceScope: "available",
      sourceType: "refund",
      dedupeKey: `refund_settled_creator:${base.purchaseId}`,
      occurredAt,
      auditMetadata,
    },
    {
      ...base,
      ledgerEventType: "refund_settled",
      accountType: "platform",
      accountId: null,
      amount: platformAmount,
      direction: "debit",
      balanceScope: "commission",
      sourceType: "refund",
      dedupeKey: `refund_settled_platform:${base.purchaseId}`,
      occurredAt,
      auditMetadata,
    },
  ]);
};

const recordMarketplaceOrderLedgerEntries = async ({
  order,
  actorType = "provider",
  actorUserId = "",
  actorRole = "",
} = {}) => {
  if (!order?._id) {
    return { createdCount: 0, skipped: true, reason: "missing_order" };
  }

  const orderId = toIdString(order._id);
  const currency = normalizeCurrency(order.currency);
  const grossAmount = clampMoney(order.totalPrice);
  const platformAmount = clampMoney(order.platformFee);
  const sellerAmount = clampMoney(order.sellerReceivable);
  const provider = normalizeText(order.paymentProvider || "paystack", 40).toLowerCase();
  const providerReference = normalizeText(order.paymentReference || "", 160);
  const base = {
    currency,
    actorType,
    actorId: actorUserId || null,
    actorRole,
    sourceType: "marketplace_order",
    sourceId: order._id,
    sourceRef: providerReference,
    provider,
    providerReference,
    occurredAt: order.updatedAt || order.createdAt || new Date(),
    auditMetadata: {
      orderId,
      buyerId: toIdString(order.buyer),
      sellerId: toIdString(order.seller),
      productId: toIdString(order.product),
      grossAmount,
      platformAmount,
      sellerAmount,
      provider,
      providerReference,
    },
  };

  return recordMany([
    {
      ...base,
      ledgerEventType: "payment_settled",
      accountType: "buyer",
      accountId: order.buyer,
      amount: grossAmount,
      direction: "none",
      balanceScope: "none",
      dedupeKey: `marketplace_payment_settled:${orderId}`,
    },
    {
      ...base,
      ledgerEventType: "platform_commission_reserved",
      accountType: "platform",
      accountId: null,
      amount: platformAmount,
      direction: "credit",
      balanceScope: "commission",
      dedupeKey: `marketplace_platform_commission:${orderId}`,
    },
    {
      ...base,
      ledgerEventType: "creator_earning_credited",
      accountType: "marketplace_seller",
      accountId: order.seller,
      amount: sellerAmount,
      direction: "credit",
      balanceScope: "available",
      dedupeKey: `marketplace_seller_earning:${orderId}`,
    },
  ]);
};

const recordMarketplacePayoutRequested = async ({
  payout,
  actorType = "system",
  actorUserId = "",
  actorRole = "",
} = {}) => {
  if (!payout?._id) {
    return { createdCount: 0, skipped: true, reason: "missing_payout" };
  }

  const payoutId = toIdString(payout._id);
  const result = await recordRevenueLedgerEntry({
    ledgerEventType: "payout_requested",
    accountType: "marketplace_seller",
    accountId: payout.seller,
    currency: "NGN",
    amount: clampMoney(payout.netAmount),
    direction: "none",
    balanceScope: "none",
    actorType,
    actorId: actorUserId || null,
    actorRole,
    sourceType: "marketplace_payout",
    sourceId: payout._id,
    sourceRef: payout.payoutReference || "",
    providerReference: payout.payoutReference || "",
    dedupeKey: `marketplace_payout_requested:${payoutId}`,
    occurredAt: payout.createdAt || new Date(),
    auditMetadata: {
      payoutId,
      sellerId: toIdString(payout.seller),
      orderId: toIdString(payout.order),
      grossAmount: clampMoney(payout.grossAmount),
      platformFee: clampMoney(payout.platformFee),
      netAmount: clampMoney(payout.netAmount),
      payoutStatus: payout.payoutStatus || "pending",
    },
  });

  return {
    createdCount: result.created ? 1 : 0,
    skipped: false,
  };
};

const PAYOUT_STATUS_TO_LEDGER_EVENT = {
  approved: "payout_approved",
  queued: "payout_approved",
  processing: "payout_approved",
  paid: "payout_sent",
  paid_out: "payout_sent",
  failed: "payout_failed",
  reversed: "payout_reversed",
};

const recordMarketplacePayoutStatusLedgerEntry = async ({
  payout,
  status = "",
  actorUserId = "",
  actorRole = "",
  actorType = "admin",
  reason = "",
} = {}) => {
  if (!payout?._id) {
    return { createdCount: 0, skipped: true, reason: "missing_payout" };
  }

  const normalizedStatus = normalizeText(status || payout.payoutStatus, 40).toLowerCase();
  const ledgerEventType = PAYOUT_STATUS_TO_LEDGER_EVENT[normalizedStatus];
  if (!ledgerEventType) {
    return { createdCount: 0, skipped: true, reason: "unsupported_payout_status" };
  }

  const direction = ["payout_sent", "payout_reversed"].includes(ledgerEventType)
    ? ledgerEventType === "payout_sent" ? "debit" : "credit"
    : "none";
  const balanceScope = direction === "none" ? "none" : "available";
  const payoutId = toIdString(payout._id);
  const result = await recordRevenueLedgerEntry({
    ledgerEventType,
    accountType: "marketplace_seller",
    accountId: payout.seller,
    currency: "NGN",
    amount: clampMoney(payout.netAmount),
    direction,
    balanceScope,
    actorType,
    actorId: actorUserId || null,
    actorRole,
    sourceType: "marketplace_payout",
    sourceId: payout._id,
    sourceRef: payout.payoutReference || "",
    providerReference: payout.payoutReference || "",
    dedupeKey: `marketplace_${ledgerEventType}:${payoutId}`,
    occurredAt: ledgerEventType === "payout_sent" ? payout.paidAt || new Date() : new Date(),
    auditMetadata: {
      payoutId,
      sellerId: toIdString(payout.seller),
      orderId: toIdString(payout.order),
      grossAmount: clampMoney(payout.grossAmount),
      platformFee: clampMoney(payout.platformFee),
      netAmount: clampMoney(payout.netAmount),
      payoutStatus: normalizedStatus,
      reason: normalizeText(reason, 240),
    },
  });

  return {
    createdCount: result.created ? 1 : 0,
    skipped: false,
  };
};

const serializeLedgerEntry = (entry = {}) => ({
  id: toIdString(entry._id),
  ledgerEventType: entry.ledgerEventType || "",
  accountType: entry.accountType || "",
  accountId: toIdString(entry.accountId),
  currency: normalizeCurrency(entry.currency),
  amount: clampMoney(entry.amount),
  direction: entry.direction || "none",
  balanceScope: entry.balanceScope || "none",
  previousBalance: roundMoney(entry.previousBalance),
  resultingBalance: roundMoney(entry.resultingBalance),
  actorType: entry.actorType || "system",
  actorId: toIdString(entry.actorId),
  actorRole: entry.actorRole || "",
  sourceType: entry.sourceType || "",
  sourceId: toIdString(entry.sourceId),
  sourceRef: entry.sourceRef || "",
  provider: entry.provider || "",
  providerReference: entry.providerReference || "",
  occurredAt: entry.occurredAt || entry.createdAt || null,
  auditMetadata: entry.auditMetadata || {},
});

const buildRevenueLedgerSummary = async ({
  range = "30d",
  startDate = "",
  endDate = "",
  limit = DEFAULT_RECENT_LIMIT,
} = {}) => {
  const dates = buildDateRange({ range, startDate, endDate });
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || DEFAULT_RECENT_LIMIT));
  const match = {
    occurredAt: { $gte: dates.start, $lte: dates.end },
  };

  const [
    eventRows,
    amountRows,
    balanceRows,
    recentEntries,
    totalEntries,
  ] = await Promise.all([
    RevenueLedgerEntry.aggregate([
      { $match: match },
      { $group: { _id: "$ledgerEventType", count: { $sum: 1 } } },
    ]).catch(() => []),
    RevenueLedgerEntry.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$ledgerEventType",
          amount: { $sum: "$amount" },
        },
      },
    ]).catch(() => []),
    RevenueLedgerEntry.aggregate([
      {
        $match: {
          occurredAt: { $lte: dates.end },
          balanceScope: { $ne: "none" },
        },
      },
      { $sort: { occurredAt: -1, createdAt: -1, _id: -1 } },
      {
        $group: {
          _id: {
            accountType: "$accountType",
            accountId: "$accountId",
            currency: "$currency",
            balanceScope: "$balanceScope",
          },
          resultingBalance: { $first: "$resultingBalance" },
        },
      },
      {
        $group: {
          _id: {
            accountType: "$_id.accountType",
            currency: "$_id.currency",
            balanceScope: "$_id.balanceScope",
          },
          accountCount: { $sum: 1 },
          balance: { $sum: "$resultingBalance" },
        },
      },
      { $sort: { "_id.accountType": 1, "_id.balanceScope": 1 } },
    ]).catch(() => []),
    RevenueLedgerEntry.find(match)
      .sort({ occurredAt: -1, createdAt: -1, _id: -1 })
      .limit(safeLimit)
      .lean(),
    RevenueLedgerEntry.countDocuments(match),
  ]);

  const eventCounts = eventRows.reduce((acc, row) => {
    acc[String(row?._id || "")] = Number(row?.count || 0);
    return acc;
  }, {});
  const eventAmounts = amountRows.reduce((acc, row) => {
    acc[String(row?._id || "")] = roundMoney(row?.amount || 0);
    return acc;
  }, {});
  const balances = balanceRows.map((row) => ({
    accountType: row?._id?.accountType || "",
    currency: row?._id?.currency || "NGN",
    balanceScope: row?._id?.balanceScope || "",
    accountCount: Number(row?.accountCount || 0),
    balance: roundMoney(row?.balance || 0),
  }));

  return {
    filters: {
      range: dates.range,
      startDate: dates.start.toISOString(),
      endDate: dates.end.toISOString(),
    },
    summary: {
      totalEntries,
      purchaseAuthorized: Number(eventCounts.purchase_authorized || 0),
      paymentSettled: Number(eventCounts.payment_settled || 0),
      platformCommissionReserved: roundMoney(eventAmounts.platform_commission_reserved || 0),
      creatorEarningCredited: roundMoney(eventAmounts.creator_earning_credited || 0),
      refundSettled: roundMoney(eventAmounts.refund_settled || 0),
      payoutRequested: roundMoney(eventAmounts.payout_requested || 0),
      payoutSent: roundMoney(eventAmounts.payout_sent || 0),
      payoutFailed: Number(eventCounts.payout_failed || 0),
      payoutReversed: roundMoney(eventAmounts.payout_reversed || 0),
    },
    eventCounts,
    eventAmounts,
    balances,
    recentEntries: recentEntries.map(serializeLedgerEntry),
  };
};

module.exports = {
  CREATOR_SHARE_RATE,
  PLATFORM_SHARE_RATE,
  recordRevenueLedgerEntry,
  recordPurchaseAuthorized,
  recordPurchaseSettlementLedgerEntries,
  recordRefundInitiated,
  recordRefundSettledLedgerEntries,
  recordMarketplaceOrderLedgerEntries,
  recordMarketplacePayoutRequested,
  recordMarketplacePayoutStatusLedgerEntry,
  buildRevenueLedgerSummary,
};
