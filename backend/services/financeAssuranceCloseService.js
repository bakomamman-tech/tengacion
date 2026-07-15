const mongoose = require("mongoose");

const CreatorPayoutRequest = require("../models/CreatorPayoutRequest");
const Entitlement = require("../models/Entitlement");
const PaymentDispute = require("../models/PaymentDispute");
const PaymentWebhookEvent = require("../models/PaymentWebhookEvent");
const Purchase = require("../models/Purchase");
const WalletEntry = require("../models/WalletEntry");
const { buildDateRange } = require("./analyticsService");
const {
  computePurchaseRevenueShare,
} = require("./creatorRevenueSharePolicy");

const ENTITLEMENT_ITEM_TYPES = ["track", "book", "album", "video"];
const OPEN_PAYOUT_STATUSES = [
  "pending_review",
  "needs_creator_action",
  "approved",
  "processing",
];

const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const clampMoney = (value) => Math.max(0, roundMoney(value));

const normalizeCurrency = (value = "NGN") =>
  String(value || "NGN").trim().toUpperCase() || "NGN";

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

const toObjectId = (value) => {
  const id = toIdString(value);
  return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;
};

const createDateMatch = (field, dates) => ({
  [field]: { $gte: dates.start, $lte: dates.end },
});

const toValidDate = (value) => {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

const isDateWithin = (value, dates) => {
  const date = toValidDate(value);
  return Boolean(date && date >= dates.start && date <= dates.end);
};

const latestDate = (values = []) => {
  const dates = values.map(toValidDate).filter(Boolean);
  if (!dates.length) {
    return null;
  }
  return new Date(Math.max(...dates.map((date) => date.getTime())));
};

const sumBy = (rows = [], selector = () => 0) =>
  clampMoney(rows.reduce((sum, row) => sum + Number(selector(row) || 0), 0));

const uniqueIds = (values = []) =>
  Array.from(new Set(values.map(toIdString).filter(Boolean)));

const resolveCloseCurrency = (rows = []) => {
  const currencies = uniqueIds(rows.map((row) => normalizeCurrency(row?.currency)));
  if (currencies.length === 1) {
    return currencies[0];
  }
  if (currencies.length > 1) {
    return "MIXED";
  }
  return "NGN";
};

const addMapAmount = (map, key, value) => {
  if (!key) {
    return;
  }
  map.set(key, clampMoney(Number(map.get(key) || 0) + Number(value || 0)));
};

const countBy = (rows = [], selector = () => "") =>
  rows.reduce((acc, row) => {
    const key = String(selector(row) || "unknown");
    acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, {});

const createVariance = ({
  key,
  area,
  label,
  severity,
  expected = 0,
  actual = 0,
  unit = "count",
  owner = "Finance and operations",
  readinessImpact,
  remediation,
} = {}) => ({
  key,
  area,
  label,
  severity,
  expected: unit === "money" ? clampMoney(expected) : Number(expected || 0),
  actual: unit === "money" ? clampMoney(actual) : Number(actual || 0),
  variance:
    unit === "money"
      ? clampMoney(Math.abs(Number(expected || 0) - Number(actual || 0)))
      : Math.abs(Number(expected || 0) - Number(actual || 0)),
  unit,
  owner,
  readinessImpact,
  remediation,
});

const deriveReadinessState = (exceptions = []) => {
  if (exceptions.some((entry) => entry.severity === "critical")) {
    return "blocked";
  }
  if (exceptions.some((entry) => entry.severity === "high")) {
    return "needs_review";
  }
  if (exceptions.some((entry) => ["medium", "low"].includes(entry.severity))) {
    return "watch";
  }
  return "ready";
};

const deriveApprovalStatus = (readinessState) => {
  if (readinessState === "ready") {
    return "ready_for_finance_approval";
  }
  if (readinessState === "watch") {
    return "approval_with_conditions";
  }
  if (readinessState === "needs_review") {
    return "finance_review_required";
  }
  return "blocked_pending_reconciliation";
};

const addDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const loadPurchaseStatusSummary = async (dates) => {
  const rows = await Purchase.aggregate([
    { $match: createDateMatch("createdAt", dates) },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        amount: { $sum: "$amount" },
      },
    },
  ]);

  const counts = {};
  const amounts = {};
  rows.forEach((row) => {
    const key = String(row?._id || "unknown");
    counts[key] = Number(row?.count || 0);
    amounts[key] = clampMoney(row?.amount || 0);
  });

  return {
    counts,
    amounts,
    purchaseAttempts: rows.reduce((sum, row) => sum + Number(row?.count || 0), 0),
  };
};

const loadEntitlementCoverage = async (eligiblePurchases = []) => {
  if (!eligiblePurchases.length) {
    return {
      grants: 0,
      missing: 0,
      missingPurchases: [],
    };
  }

  const entitlementQuery = eligiblePurchases.map((purchase) => ({
    buyerId: purchase.userId,
    itemType: purchase.itemType,
    itemId: purchase.itemId,
  }));
  const entitlements = await Entitlement.find({ $or: entitlementQuery })
    .select("buyerId itemType itemId")
    .lean();
  const entitlementKeys = new Set(
    entitlements.map((row) => `${toIdString(row.buyerId)}:${row.itemType}:${toIdString(row.itemId)}`)
  );
  const missingPurchases = eligiblePurchases.filter(
    (purchase) =>
      !entitlementKeys.has(`${toIdString(purchase.userId)}:${purchase.itemType}:${toIdString(purchase.itemId)}`)
  );

  return {
    grants: eligiblePurchases.length - missingPurchases.length,
    missing: missingPurchases.length,
    missingPurchases: missingPurchases.slice(0, 8).map((purchase) => ({
      purchaseId: toIdString(purchase._id),
      providerRef: purchase.providerRef || "",
      buyerId: toIdString(purchase.userId),
      itemType: purchase.itemType || "",
      itemId: toIdString(purchase.itemId),
    })),
  };
};

const loadWalletEntries = async ({
  sourceType,
  sourceIds,
  entryTypes,
  effectiveDates = null,
}) => {
  const ids = sourceIds.map(toObjectId).filter(Boolean);
  if (!ids.length) {
    return [];
  }

  return WalletEntry.find({
    sourceType,
    sourceId: { $in: ids },
    entryType: { $in: entryTypes },
    ...(effectiveDates ? createDateMatch("effectiveAt", effectiveDates) : {}),
  })
    .select("_id ownerType ownerId entryType amount grossAmount currency sourceType sourceId sourceRef direction bucket effectiveAt")
    .lean();
};

const loadPayoutDebitEntries = async (payoutIds = []) => {
  const ids = payoutIds.map(toObjectId).filter(Boolean);
  if (!ids.length) {
    return [];
  }

  return WalletEntry.find({
    sourceType: "payout",
    sourceId: { $in: ids },
    entryType: "payout_debit",
  })
    .select("_id ownerType ownerId entryType amount currency sourceId sourceRef direction bucket")
    .lean();
};

const loadPayoutRows = async (dates) => {
  const rows = await CreatorPayoutRequest.find({
    $or: [
      createDateMatch("requestedAt", dates),
      createDateMatch("paidAt", dates),
      createDateMatch("failedAt", dates),
    ],
  })
    .select("_id creatorProfile creatorUser amount currency status requestedAt paidAt failedAt requestReference payoutReference")
    .lean();

  return rows;
};

const loadWebhookSummary = async (dates) => {
  const rows = await PaymentWebhookEvent.find(createDateMatch("createdAt", dates))
    .select("provider eventType providerRef status duplicateCount createdAt")
    .lean();
  const statusCounts = countBy(rows, (row) => row.status || "unknown");
  const providerCounts = countBy(rows, (row) => row.provider || "unknown");
  const eventTypeCounts = countBy(rows, (row) => row.eventType || "unknown");
  const paystackRows = rows.filter(
    (row) => normalizeDisputeValue(row.provider) === "paystack"
  );
  const disputeRows = paystackRows.filter((row) =>
    normalizeDisputeValue(row.eventType).startsWith("charge.dispute.")
  );
  const latestPaystackEventAt = latestDate(paystackRows.map((row) => row.createdAt));
  const latestDisputeEventAt = latestDate(disputeRows.map((row) => row.createdAt));

  return {
    total: rows.length,
    statusCounts,
    providerCounts,
    eventTypeCounts,
    failed: Number(statusCounts.failed || 0),
    processed: Number(statusCounts.processed || 0),
    duplicates: rows.reduce((sum, row) => sum + Number(row?.duplicateCount || 0), 0),
    paystackEvents: paystackRows.length,
    disputeEvents: disputeRows.length,
    disputeEventTypeCounts: countBy(
      disputeRows,
      (row) => row.eventType || "unknown"
    ),
    latestPaystackEventAt: latestPaystackEventAt?.toISOString() || null,
    latestDisputeEventAt: latestDisputeEventAt?.toISOString() || null,
  };
};

const loadDisputeRows = async (dates) =>
  PaymentDispute.find({
    $or: [
      createDateMatch("openedAt", dates),
      createDateMatch("resolvedAt", dates),
      createDateMatch("lastEventAt", dates),
      createDateMatch("createdAt", dates),
      {
        $and: [
          {
            $or: [
              { openedAt: { $lte: dates.end } },
              { openedAt: null, createdAt: { $lte: dates.end } },
            ],
          },
          {
            $or: [
              { resolvedAt: null },
              { resolvedAt: { $gt: dates.end } },
            ],
          },
        ],
      },
    ],
  })
    .select(
      "_id provider providerDisputeId purchaseId providerRef providerTransactionId status resolution currency disputedAmount refundAmount financialState chargebackAmount creatorChargebackAmount platformChargebackAmount manualReviewReason openedAt resolvedAt lastEventAt lastEventType createdAt updatedAt"
    )
    .lean();

const normalizeDisputeValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");

const hasAcceptedDisputeResolution = (row) => {
  const resolution = normalizeDisputeValue(row?.resolution);
  return resolution === "merchant-accepted" || resolution === "accepted";
};

const isConfirmedDebitedDispute = (row) =>
  normalizeDisputeValue(row?.financialState) === "debited";

const getDisputeFinancialEffectiveAt = (row) =>
  toValidDate(row?.resolvedAt || row?.lastEventAt || row?.updatedAt || row?.createdAt);

const isDisputeDebitWithin = (row, dates) =>
  isConfirmedDebitedDispute(row) &&
  isDateWithin(getDisputeFinancialEffectiveAt(row), dates);

const hasDisputeActivityWithin = (row, dates) =>
  [row?.openedAt, row?.resolvedAt, row?.lastEventAt, row?.createdAt].some((value) =>
    isDateWithin(value, dates)
  );

const isDisputeOpenAsOf = (row, endDate) => {
  const end = toValidDate(endDate);
  const openedAt = toValidDate(row?.openedAt || row?.createdAt);
  const resolvedAt = toValidDate(row?.resolvedAt);
  const financialState = normalizeDisputeValue(row?.financialState);
  if (!end || !openedAt || openedAt > end) {
    return false;
  }
  if (resolvedAt) {
    return resolvedAt > end;
  }
  return !["debited", "released"].includes(financialState);
};

const buildDisputeSummary = ({
  disputeRows = [],
  walletEntries = [],
  webhookSummary = {},
  dates,
} = {}) => {
  const periodDisputes = disputeRows.filter((row) =>
    hasDisputeActivityWithin(row, dates)
  );
  const openedDisputes = disputeRows.filter((row) => isDateWithin(row?.openedAt, dates));
  const resolvedDisputes = disputeRows.filter((row) =>
    isDateWithin(row?.resolvedAt, dates)
  );
  const debitedDisputes = disputeRows.filter(
    (row) => isDisputeDebitWithin(row, dates)
  );
  const openDisputes = disputeRows.filter((row) =>
    isDisputeOpenAsOf(row, dates.end)
  );
  const manualReviewDisputes = disputeRows.filter((row) => {
    const financialEffectiveAt = getDisputeFinancialEffectiveAt(row);
    return Boolean(
      financialEffectiveAt &&
        financialEffectiveAt <= dates.end &&
        (normalizeDisputeValue(row?.financialState) === "manual-review" ||
          String(row?.manualReviewReason || "").trim())
    );
  });
  const acceptedLosses = resolvedDisputes.filter(hasAcceptedDisputeResolution);
  const missingFinancialDisputes = acceptedLosses.filter(
    (row) => !isDisputeDebitWithin(row, dates)
  );
  const allocationMismatchDisputes = debitedDisputes.filter(
    (row) =>
      Math.abs(
        Number(row?.chargebackAmount || 0) -
          Number(row?.creatorChargebackAmount || 0) -
          Number(row?.platformChargebackAmount || 0)
      ) > 0.009
  );
  const creatorDebitEntries = walletEntries.filter(
    (entry) =>
      entry.entryType === "chargeback_debit" &&
      entry.ownerType === "creator" &&
      Number(entry.amount || 0) > 0
  );
  const platformDebitEntries = walletEntries.filter(
    (entry) =>
      entry.entryType === "chargeback_debit" &&
      entry.ownerType === "platform" &&
      Number(entry.amount || 0) > 0
  );
  const ignoredZeroAmountWalletEntries = walletEntries.filter(
    (entry) =>
      entry.entryType === "chargeback_debit" && Number(entry.amount || 0) <= 0
  ).length;
  const expectedCreatorChargebacks = sumBy(
    debitedDisputes,
    (row) => row.creatorChargebackAmount
  );
  const expectedPlatformChargebacks = sumBy(
    debitedDisputes,
    (row) => row.platformChargebackAmount
  );
  const actualCreatorChargebacks = sumBy(creatorDebitEntries, (entry) => entry.amount);
  const actualPlatformChargebacks = sumBy(platformDebitEntries, (entry) => entry.amount);
  const expectedWalletEntries = debitedDisputes.reduce(
    (count, row) =>
      count +
      (Number(row?.creatorChargebackAmount || 0) > 0 ? 1 : 0) +
      (Number(row?.platformChargebackAmount || 0) > 0 ? 1 : 0),
    0
  );
  const actualWalletEntries = creatorDebitEntries.length + platformDebitEntries.length;
  const hasModelActivity = periodDisputes.length > 0;
  const hasPaystackWebhookActivity = Number(webhookSummary.paystackEvents || 0) > 0;
  const hasDisputeWebhookActivity = Number(webhookSummary.disputeEvents || 0) > 0;
  const sourceFreshness =
    hasModelActivity || hasPaystackWebhookActivity ? "current" : "delayed";
  let sourceStatus = "unobserved";
  if (hasDisputeWebhookActivity) {
    sourceStatus = "current";
  } else if (hasModelActivity) {
    sourceStatus = "current_model_evidence";
  } else if (openDisputes.length > 0) {
    sourceStatus = "tracked_open_disputes";
  } else if (hasPaystackWebhookActivity) {
    sourceStatus = "configured_no_dispute_activity";
  }
  const latestModelEventAt = latestDate(
    [...periodDisputes, ...openDisputes].flatMap((row) => [
      row.lastEventAt,
      row.resolvedAt,
      row.openedAt,
      row.createdAt,
    ])
  );
  const latestProviderEventAt = latestDate([
    webhookSummary.latestDisputeEventAt,
    latestModelEventAt,
  ]);

  return {
    sourceStatus,
    sourceFreshness,
    latestProviderEventAt: latestProviderEventAt?.toISOString() || null,
    reconciliationStatus:
      manualReviewDisputes.length > 0 ||
      openDisputes.length > 0 ||
      missingFinancialDisputes.length > 0 ||
      allocationMismatchDisputes.length > 0 ||
      expectedWalletEntries !== actualWalletEntries ||
      expectedCreatorChargebacks !== actualCreatorChargebacks ||
      expectedPlatformChargebacks !== actualPlatformChargebacks
        ? "attention_required"
        : "reconciled",
    disputeEvents: Number(webhookSummary.disputeEvents || 0),
    disputeEventTypeCounts: webhookSummary.disputeEventTypeCounts || {},
    disputeCount: periodDisputes.length,
    trackedDisputeCount: disputeRows.length,
    statusCounts: countBy(periodDisputes, (row) =>
      isDisputeOpenAsOf(row, dates.end) ? "open" : row.status || "unknown"
    ),
    resolutionCounts: countBy(
      resolvedDisputes,
      (row) => row.resolution || "unresolved"
    ),
    financialStateCounts: countBy(
      periodDisputes,
      (row) =>
        isDisputeOpenAsOf(row, dates.end)
          ? "held"
          : row.financialState || "none"
    ),
    openedCount: openedDisputes.length,
    resolvedCount: resolvedDisputes.length,
    openCount: openDisputes.length,
    openDisputedAmount: sumBy(openDisputes, (row) => row.disputedAmount),
    acceptedLossCount: acceptedLosses.length,
    debitedCount: debitedDisputes.length,
    missingFinancialCount: missingFinancialDisputes.length,
    manualReviewCount: manualReviewDisputes.length,
    allocationMismatchCount: allocationMismatchDisputes.length,
    disputedAmount: sumBy(openedDisputes, (row) => row.disputedAmount),
    reportedProviderRefundAmount: sumBy(
      resolvedDisputes,
      (row) => row.refundAmount
    ),
    providerRefundAmount: sumBy(debitedDisputes, (row) => row.refundAmount),
    chargebackAmount: sumBy(debitedDisputes, (row) => row.chargebackAmount),
    expectedCreatorChargebacks,
    actualCreatorChargebacks,
    expectedPlatformChargebacks,
    actualPlatformChargebacks,
    expectedWalletEntries,
    actualWalletEntries,
    ignoredZeroAmountWalletEntries,
    missingWalletEntries: Math.max(0, expectedWalletEntries - actualWalletEntries),
    manualReviewDisputes: manualReviewDisputes.slice(0, 8).map((row) => ({
      disputeId: toIdString(row._id),
      provider: row.provider || "",
      providerDisputeId: row.providerDisputeId || "",
      providerRef: row.providerRef || "",
      purchaseId: toIdString(row.purchaseId),
      status: row.status || "",
      resolution: row.resolution || "",
      financialState: row.financialState || "",
      reason: row.manualReviewReason || "",
    })),
    missingFinancialDisputes: missingFinancialDisputes.slice(0, 8).map((row) => ({
      disputeId: toIdString(row._id),
      provider: row.provider || "",
      providerDisputeId: row.providerDisputeId || "",
      providerRef: row.providerRef || "",
      purchaseId: toIdString(row.purchaseId),
      resolution: row.resolution || "",
      financialState: row.financialState || "",
      chargebackAmount: clampMoney(row.chargebackAmount || 0),
    })),
    openDisputes: openDisputes.slice(0, 8).map((row) => ({
      disputeId: toIdString(row._id),
      provider: row.provider || "",
      providerDisputeId: row.providerDisputeId || "",
      providerRef: row.providerRef || "",
      purchaseId: toIdString(row.purchaseId),
      status: row.status || "",
      financialState: row.financialState || "",
      disputedAmount: clampMoney(row.disputedAmount || 0),
      openedAt: row.openedAt || null,
      lastEventAt: row.lastEventAt || null,
    })),
  };
};

const buildCreatorBalanceConfidence = ({
  creators,
  paidPurchases,
  refundedPurchases,
  payoutRows,
  walletEntries,
  refundEntries,
  payoutDebitEntries,
  disputeRows,
  disputePurchases,
  disputeWalletEntries,
  dates,
} = {}) => {
  const expectedSaleCreditsByCreator = new Map();
  const actualSaleCreditsByCreator = new Map();
  const expectedRefundDebitsByCreator = new Map();
  const actualRefundDebitsByCreator = new Map();
  const expectedPayoutDebitsByCreator = new Map();
  const actualPayoutDebitsByCreator = new Map();
  const expectedChargebackDebitsByCreator = new Map();
  const actualChargebackDebitsByCreator = new Map();

  paidPurchases.forEach((purchase) => {
    addMapAmount(
      expectedSaleCreditsByCreator,
      toIdString(purchase.creatorId),
      computePurchaseRevenueShare(purchase).creatorAmount
    );
  });
  walletEntries
    .filter((entry) => entry.entryType === "sale_credit" && entry.ownerType === "creator")
    .forEach((entry) => {
      addMapAmount(actualSaleCreditsByCreator, toIdString(entry.ownerId), entry.amount);
    });

  refundedPurchases.forEach((purchase) => {
    addMapAmount(
      expectedRefundDebitsByCreator,
      toIdString(purchase.creatorId),
      computePurchaseRevenueShare(purchase).creatorAmount
    );
  });
  refundEntries
    .filter((entry) => entry.entryType === "refund_debit" && entry.ownerType === "creator")
    .forEach((entry) => {
      addMapAmount(actualRefundDebitsByCreator, toIdString(entry.ownerId), entry.amount);
    });

  payoutRows
    .filter((row) => row.status === "paid")
    .forEach((row) => {
      addMapAmount(expectedPayoutDebitsByCreator, toIdString(row.creatorProfile), row.amount);
    });
  payoutDebitEntries.forEach((entry) => {
    addMapAmount(actualPayoutDebitsByCreator, toIdString(entry.ownerId), entry.amount);
  });

  const disputeCreatorByPurchaseId = new Map(
    (disputePurchases || []).map((purchase) => [
      toIdString(purchase._id),
      toIdString(purchase.creatorId),
    ])
  );
  (disputeRows || [])
    .filter((row) => isDisputeDebitWithin(row, dates))
    .forEach((row) => {
      addMapAmount(
        expectedChargebackDebitsByCreator,
        disputeCreatorByPurchaseId.get(toIdString(row.purchaseId)),
        row.creatorChargebackAmount
      );
    });
  (disputeWalletEntries || [])
    .filter(
      (entry) =>
        entry.entryType === "chargeback_debit" &&
        entry.ownerType === "creator" &&
        Number(entry.amount || 0) > 0
    )
    .forEach((entry) => {
      addMapAmount(actualChargebackDebitsByCreator, toIdString(entry.ownerId), entry.amount);
    });

  const rows = uniqueIds(creators).map((creatorId) => {
    const saleVariance = clampMoney(
      Math.abs(
        Number(expectedSaleCreditsByCreator.get(creatorId) || 0) -
          Number(actualSaleCreditsByCreator.get(creatorId) || 0)
      )
    );
    const refundVariance = clampMoney(
      Math.abs(
        Number(expectedRefundDebitsByCreator.get(creatorId) || 0) -
          Number(actualRefundDebitsByCreator.get(creatorId) || 0)
      )
    );
    const payoutVariance = clampMoney(
      Math.abs(
        Number(expectedPayoutDebitsByCreator.get(creatorId) || 0) -
          Number(actualPayoutDebitsByCreator.get(creatorId) || 0)
      )
    );
    const chargebackVariance = clampMoney(
      Math.abs(
        Number(expectedChargebackDebitsByCreator.get(creatorId) || 0) -
          Number(actualChargebackDebitsByCreator.get(creatorId) || 0)
      )
    );
    const issues = [
      saleVariance > 0 ? "sale_credit_variance" : "",
      refundVariance > 0 ? "refund_debit_variance" : "",
      payoutVariance > 0 ? "payout_debit_variance" : "",
      chargebackVariance > 0 ? "chargeback_debit_variance" : "",
    ].filter(Boolean);

    return {
      creatorId,
      confidenceState: issues.length ? "degraded" : "current",
      expectedSaleCredits: clampMoney(expectedSaleCreditsByCreator.get(creatorId) || 0),
      actualSaleCredits: clampMoney(actualSaleCreditsByCreator.get(creatorId) || 0),
      expectedRefundDebits: clampMoney(expectedRefundDebitsByCreator.get(creatorId) || 0),
      actualRefundDebits: clampMoney(actualRefundDebitsByCreator.get(creatorId) || 0),
      expectedPayoutDebits: clampMoney(expectedPayoutDebitsByCreator.get(creatorId) || 0),
      actualPayoutDebits: clampMoney(actualPayoutDebitsByCreator.get(creatorId) || 0),
      expectedChargebackDebits: clampMoney(
        expectedChargebackDebitsByCreator.get(creatorId) || 0
      ),
      actualChargebackDebits: clampMoney(
        actualChargebackDebitsByCreator.get(creatorId) || 0
      ),
      variance: clampMoney(
        saleVariance + refundVariance + payoutVariance + chargebackVariance
      ),
      issues,
    };
  });

  const currentCount = rows.filter((row) => row.confidenceState === "current").length;
  const confidenceRate = rows.length ? Number((currentCount / rows.length).toFixed(4)) : 1;

  return {
    confidenceState: rows.some((row) => row.confidenceState === "degraded") ? "degraded" : "current",
    creatorsReviewed: rows.length,
    currentCreators: currentCount,
    degradedCreators: rows.length - currentCount,
    confidenceRate,
    rows: rows.slice(0, 20),
  };
};

const buildFinanceAssuranceClose = async ({
  range = "30d",
  startDate = "",
  endDate = "",
} = {}) => {
  const dates = buildDateRange({ range, startDate, endDate });
  const [
    purchaseStatusSummary,
    paidPurchases,
    refundedPurchases,
    payoutRows,
    webhookSummary,
    disputeRows,
  ] = await Promise.all([
    loadPurchaseStatusSummary(dates),
    Purchase.find({
      status: { $in: ["paid", "refunded"] },
      paidAt: { $gte: dates.start, $lte: dates.end },
    })
      .select(
        "_id userId creatorId itemType itemId amount currency provider providerRef status paidAt createdAt revenueCategory revenueSharePolicy creatorShareRate platformShareRate processingFeeAmount taxAmount"
      )
      .lean(),
    Purchase.find({
      status: "refunded",
      refundedAt: { $gte: dates.start, $lte: dates.end },
    })
      .select(
        "_id userId creatorId itemType itemId amount currency provider providerRef status refundedAt refundReason revenueCategory revenueSharePolicy creatorShareRate platformShareRate processingFeeAmount taxAmount"
      )
      .lean(),
    loadPayoutRows(dates),
    loadWebhookSummary(dates),
    loadDisputeRows(dates),
  ]);

  const settlementPurchases = paidPurchases.filter(
    (purchase) => purchase.creatorId && Number(purchase.amount || 0) > 0
  );
  const chargebackPurchaseIds = new Set(
    disputeRows
      .filter(isConfirmedDebitedDispute)
      .map((row) => toIdString(row.purchaseId))
      .filter(Boolean)
  );
  const standardRefundedPurchases = refundedPurchases.filter(
    (purchase) => !chargebackPurchaseIds.has(toIdString(purchase._id))
  );
  const entitlementEligiblePurchases = paidPurchases.filter(
    (purchase) =>
      purchase.status === "paid" && ENTITLEMENT_ITEM_TYPES.includes(String(purchase.itemType || ""))
  );
  const refundSettlementPurchases = standardRefundedPurchases.filter(
    (purchase) => purchase.creatorId && Number(purchase.amount || 0) > 0
  );

  const [
    entitlementCoverage,
    walletEntries,
    refundEntries,
    payoutDebitEntries,
    disputeWalletEntries,
    disputePurchases,
  ] = await Promise.all([
    loadEntitlementCoverage(entitlementEligiblePurchases),
    loadWalletEntries({
      sourceType: "purchase",
      sourceIds: settlementPurchases.map((purchase) => purchase._id),
      entryTypes: ["sale_credit", "platform_fee"],
    }),
    loadWalletEntries({
      sourceType: "refund",
      sourceIds: refundSettlementPurchases.map((purchase) => purchase._id),
      entryTypes: ["refund_debit"],
    }),
    loadPayoutDebitEntries(
      payoutRows.filter((row) => row.status === "paid").map((row) => row._id)
    ),
    loadWalletEntries({
      sourceType: "dispute",
      sourceIds: disputeRows.map((row) => row._id),
      entryTypes: ["chargeback_debit"],
      effectiveDates: dates,
    }),
    Purchase.find({
      _id: {
        $in: disputeRows.map((row) => toObjectId(row.purchaseId)).filter(Boolean),
      },
    })
      .select("_id creatorId")
      .lean(),
  ]);

  const disputeSummary = buildDisputeSummary({
    disputeRows,
    walletEntries: disputeWalletEntries,
    webhookSummary,
    dates,
  });

  const saleCreditEntries = walletEntries.filter((entry) => entry.entryType === "sale_credit");
  const platformFeeEntries = walletEntries.filter((entry) => entry.entryType === "platform_fee");
  const creatorRefundEntries = refundEntries.filter(
    (entry) => entry.entryType === "refund_debit" && entry.ownerType === "creator"
  );
  const platformRefundEntries = refundEntries.filter(
    (entry) => entry.entryType === "refund_debit" && entry.ownerType === "platform"
  );
  const expectedWalletEntries = settlementPurchases.length * 2;
  const actualWalletEntries = saleCreditEntries.length + platformFeeEntries.length;
  const expectedRefundEntries = refundSettlementPurchases.length * 2;
  const actualRefundEntries = creatorRefundEntries.length + platformRefundEntries.length;

  const expectedCreatorCredits = sumBy(
    settlementPurchases,
    (purchase) => computePurchaseRevenueShare(purchase).creatorAmount
  );
  const actualCreatorCredits = sumBy(saleCreditEntries, (entry) => entry.amount);
  const expectedPlatformFees = sumBy(
    settlementPurchases,
    (purchase) => computePurchaseRevenueShare(purchase).platformAmount
  );
  const actualPlatformFees = sumBy(platformFeeEntries, (entry) => entry.amount);
  const expectedCreatorRefunds = sumBy(
    refundSettlementPurchases,
    (purchase) => computePurchaseRevenueShare(purchase).creatorAmount
  );
  const actualCreatorRefunds = sumBy(creatorRefundEntries, (entry) => entry.amount);
  const expectedPlatformRefunds = sumBy(
    refundSettlementPurchases,
    (purchase) => computePurchaseRevenueShare(purchase).platformAmount
  );
  const actualPlatformRefunds = sumBy(platformRefundEntries, (entry) => entry.amount);

  const requestedPayouts = payoutRows.filter(
    (row) => row.requestedAt && row.requestedAt >= dates.start && row.requestedAt <= dates.end
  );
  const paidPayouts = payoutRows.filter(
    (row) => row.status === "paid" && row.paidAt && row.paidAt >= dates.start && row.paidAt <= dates.end
  );
  const failedPayouts = payoutRows.filter(
    (row) => row.status === "failed" && row.failedAt && row.failedAt >= dates.start && row.failedAt <= dates.end
  );
  const openPayouts = payoutRows.filter((row) => OPEN_PAYOUT_STATUSES.includes(row.status));
  const expectedPayoutDebits = sumBy(paidPayouts, (row) => row.amount);
  const actualPayoutDebits = sumBy(payoutDebitEntries, (entry) => entry.amount);

  const creatorsReviewed = uniqueIds([
    ...settlementPurchases.map((purchase) => purchase.creatorId),
    ...refundSettlementPurchases.map((purchase) => purchase.creatorId),
    ...payoutRows.map((row) => row.creatorProfile),
    ...disputePurchases.map((purchase) => purchase.creatorId),
  ]);
  const creatorBalanceConfidence = buildCreatorBalanceConfidence({
    creators: creatorsReviewed,
    paidPurchases: settlementPurchases,
    refundedPurchases: refundSettlementPurchases,
    payoutRows: paidPayouts,
    walletEntries,
    refundEntries,
    payoutDebitEntries,
    disputeRows,
    disputePurchases,
    disputeWalletEntries,
    dates,
  });

  const exceptions = [];
  if (entitlementCoverage.missing > 0) {
    exceptions.push(
      createVariance({
        key: "entitlement_gap",
        area: "entitlements",
        label: "Paid purchases missing entitlement evidence",
        severity: "critical",
        expected: entitlementEligiblePurchases.length,
        actual: entitlementCoverage.grants,
        readinessImpact: "Blocks finance close approval for purchase-to-access continuity.",
        remediation: "Run entitlement reconciliation and review the missing purchase samples.",
      })
    );
  }
  if (actualWalletEntries !== expectedWalletEntries) {
    exceptions.push(
      createVariance({
        key: "wallet_settlement_gap",
        area: "wallet",
        label: "Purchase settlement wallet entries do not match paid purchases",
        severity: "critical",
        expected: expectedWalletEntries,
        actual: actualWalletEntries,
        readinessImpact: "Blocks creator balance confidence and revenue assurance claims.",
        remediation: "Run wallet purchase reconciliation and inspect duplicate or missing provider references.",
      })
    );
  }
  if (expectedCreatorCredits !== actualCreatorCredits) {
    exceptions.push(
      createVariance({
        key: "creator_credit_variance",
        area: "wallet",
        label: "Creator wallet credits differ from expected creator share",
        severity: "high",
        expected: expectedCreatorCredits,
        actual: actualCreatorCredits,
        unit: "money",
        readinessImpact: "Requires finance review before approving creator-facing balance claims.",
        remediation: "Compare paid purchases against sale_credit wallet entries by source id.",
      })
    );
  }
  if (expectedPlatformFees !== actualPlatformFees) {
    exceptions.push(
      createVariance({
        key: "platform_fee_variance",
        area: "wallet",
        label: "Platform fee wallet entries differ from expected commission",
        severity: "high",
        expected: expectedPlatformFees,
        actual: actualPlatformFees,
        unit: "money",
        readinessImpact: "Requires finance review before approving revenue repository totals.",
        remediation: "Compare paid purchases against platform_fee wallet entries by source id.",
      })
    );
  }
  if (actualRefundEntries !== expectedRefundEntries) {
    exceptions.push(
      createVariance({
        key: "refund_wallet_gap",
        area: "refunds",
        label: "Refund reversal wallet entries do not match refund events",
        severity: "high",
        expected: expectedRefundEntries,
        actual: actualRefundEntries,
        readinessImpact: "Requires refund review before approving net creator balance.",
        remediation: "Run refund settlement reversal and inspect refunded purchases without refund_debit entries.",
      })
    );
  }
  if (expectedCreatorRefunds !== actualCreatorRefunds || expectedPlatformRefunds !== actualPlatformRefunds) {
    exceptions.push(
      createVariance({
        key: "refund_amount_variance",
        area: "refunds",
        label: "Refund debit amounts differ from expected creator and platform reversals",
        severity: "high",
        expected: expectedCreatorRefunds + expectedPlatformRefunds,
        actual: actualCreatorRefunds + actualPlatformRefunds,
        unit: "money",
        readinessImpact: "Requires finance review before approving net revenue and balance confidence.",
        remediation: "Compare refund_debit entries against refunded purchase amounts and share rates.",
      })
    );
  }
  if (expectedPayoutDebits !== actualPayoutDebits) {
    exceptions.push(
      createVariance({
        key: "payout_debit_variance",
        area: "payouts",
        label: "Paid payout outcomes do not match creator wallet debits",
        severity: "high",
        expected: expectedPayoutDebits,
        actual: actualPayoutDebits,
        unit: "money",
        readinessImpact: "Requires payout review before approving creator balance confidence.",
        remediation: "Inspect paid payout requests and missing payout_debit wallet entries.",
      })
    );
  }
  if (webhookSummary.failed > 0) {
    exceptions.push(
      createVariance({
        key: "webhook_failures",
        area: "payments",
        label: "Payment webhook failures occurred during the close window",
        severity: "high",
        expected: 0,
        actual: webhookSummary.failed,
        readinessImpact: "Requires provider event review before approving payment completeness.",
        remediation: "Review failed webhook events and replay safe provider notifications.",
      })
    );
  }
  if (disputeSummary.openCount > 0) {
    exceptions.push(
      createVariance({
        key: "dispute_open_exposure",
        area: "disputes",
        label: "Provider disputes remain open at finance close",
        severity: "medium",
        expected: 0,
        actual: disputeSummary.openCount,
        readinessImpact: "Keeps finance assurance in watch while disputed funds remain exposed to a provider decision.",
        remediation: "Track provider response deadlines and retain the disputed amount until each dispute is released or debited.",
      })
    );
  }
  if (disputeSummary.missingFinancialCount > 0) {
    exceptions.push(
      createVariance({
        key: "dispute_financial_gap",
        area: "disputes",
        label: "Accepted dispute losses are missing financial reversal evidence",
        severity: "critical",
        expected: 0,
        actual: disputeSummary.missingFinancialCount,
        readinessImpact: "Blocks finance close because confirmed chargebacks are not reflected in creator and platform balances.",
        remediation: "Review the listed disputes, resolve purchase matching, and post idempotent chargeback debit entries.",
      })
    );
  }
  if (disputeSummary.manualReviewCount > 0) {
    exceptions.push(
      createVariance({
        key: "dispute_manual_review",
        area: "disputes",
        label: "Provider disputes require manual finance review",
        severity: "high",
        expected: 0,
        actual: disputeSummary.manualReviewCount,
        readinessImpact: "Requires finance review before chargeback exposure and creator balances can be approved.",
        remediation: "Resolve each dispute's purchase reference, currency, amount, or provider outcome and replay the safe financial action.",
      })
    );
  }
  if (disputeSummary.allocationMismatchCount > 0) {
    exceptions.push(
      createVariance({
        key: "dispute_allocation_variance",
        area: "disputes",
        label: "Chargeback allocations do not equal the recorded net-revenue loss",
        severity: "high",
        expected: disputeSummary.chargebackAmount,
        actual:
          disputeSummary.expectedCreatorChargebacks +
          disputeSummary.expectedPlatformChargebacks,
        unit: "money",
        readinessImpact: "Requires finance review because creator and platform chargeback allocations are incomplete or overstated.",
        remediation: "Recalculate each debited dispute from its purchase revenue-share snapshot and correct the allocation evidence.",
      })
    );
  }
  if (disputeSummary.expectedWalletEntries !== disputeSummary.actualWalletEntries) {
    exceptions.push(
      createVariance({
        key: "dispute_wallet_gap",
        area: "disputes",
        label: "Chargeback wallet entries do not match debited disputes",
        severity: "critical",
        expected: disputeSummary.expectedWalletEntries,
        actual: disputeSummary.actualWalletEntries,
        readinessImpact: "Blocks balance confidence because recorded chargeback outcomes are missing creator or platform ledger evidence.",
        remediation: "Replay idempotent chargeback accounting and inspect duplicate or missing dispute source ids.",
      })
    );
  }
  if (
    disputeSummary.expectedCreatorChargebacks !== disputeSummary.actualCreatorChargebacks ||
    disputeSummary.expectedPlatformChargebacks !== disputeSummary.actualPlatformChargebacks
  ) {
    exceptions.push(
      createVariance({
        key: "dispute_wallet_amount_variance",
        area: "disputes",
        label: "Chargeback wallet debit amounts differ from recorded allocations",
        severity: "high",
        expected:
          disputeSummary.expectedCreatorChargebacks +
          disputeSummary.expectedPlatformChargebacks,
        actual:
          disputeSummary.actualCreatorChargebacks +
          disputeSummary.actualPlatformChargebacks,
        unit: "money",
        readinessImpact: "Requires finance review before approving net revenue and creator balance confidence.",
        remediation: "Compare chargeback_debit entries against creator and platform allocations on each dispute.",
      })
    );
  }
  if (failedPayouts.length > 0) {
    exceptions.push(
      createVariance({
        key: "payout_failures",
        area: "payouts",
        label: "Creator payout failures occurred during the close window",
        severity: "medium",
        expected: 0,
        actual: failedPayouts.length,
        readinessImpact: "Keeps payout assurance in watch until failed payout owners close the retry path.",
        remediation: "Assign payout follow-up owners and capture retry or creator-message evidence.",
      })
    );
  }

  const readinessState = deriveReadinessState(exceptions);
  const closeCurrency = resolveCloseCurrency([
    ...paidPurchases,
    ...standardRefundedPurchases,
    ...payoutRows,
    ...disputeRows,
  ]);
  const grossPaidAmount = sumBy(paidPurchases, (purchase) => purchase.amount);
  const processingFeeAmount = sumBy(
    paidPurchases,
    (purchase) => computePurchaseRevenueShare(purchase).processingFeeAmount
  );
  const taxAmount = sumBy(
    paidPurchases,
    (purchase) => computePurchaseRevenueShare(purchase).taxAmount
  );
  const netRevenueAmount = sumBy(
    paidPurchases,
    (purchase) => computePurchaseRevenueShare(purchase).netRevenueAmount
  );
  const refundedAmount = sumBy(standardRefundedPurchases, (purchase) => purchase.amount);
  const refundedNetRevenueAmount = sumBy(
    standardRefundedPurchases,
    (purchase) => computePurchaseRevenueShare(purchase).netRevenueAmount
  );
  const chargebackNetRevenueAmount = disputeSummary.chargebackAmount;

  return {
    filters: {
      range: dates.range,
      startDate: dates.start.toISOString(),
      endDate: dates.end.toISOString(),
    },
    generatedAt: new Date().toISOString(),
    close: {
      key: "finance_revenue_assurance_close",
      title: "Finance and Revenue Assurance Close",
      owner: "Finance and operations",
      reviewer: "Product leadership",
      readinessState,
      approvalStatus: deriveApprovalStatus(readinessState),
      evidenceFreshness: "current",
      nextReviewDate: addDays(dates.end, 7).toISOString(),
    },
    summary: {
      currency: closeCurrency,
      purchaseAttempts: purchaseStatusSummary.purchaseAttempts,
      successfulPayments: paidPurchases.length,
      failedPayments: Number(purchaseStatusSummary.counts.failed || 0),
      pendingPayments: Number(purchaseStatusSummary.counts.pending || 0),
      abandonedPayments: Number(purchaseStatusSummary.counts.abandoned || 0),
      refundedPayments: standardRefundedPurchases.length,
      grossPaidAmount,
      processingFeeAmount,
      taxAmount,
      netRevenueAmount,
      refundedAmount,
      refundedNetRevenueAmount,
      chargebackProviderAmount: disputeSummary.providerRefundAmount,
      chargebackNetRevenueAmount,
      netSettledAmount: roundMoney(
        netRevenueAmount - refundedNetRevenueAmount - chargebackNetRevenueAmount
      ),
      entitlementEligiblePurchases: entitlementEligiblePurchases.length,
      entitlementGrants: entitlementCoverage.grants,
      entitlementMissing: entitlementCoverage.missing,
      walletExpectedEntries: expectedWalletEntries,
      walletActualEntries: actualWalletEntries,
      walletMissingEntries: Math.max(0, expectedWalletEntries - actualWalletEntries),
      refundWalletExpectedEntries: expectedRefundEntries,
      refundWalletActualEntries: actualRefundEntries,
      refundWalletMissingEntries: Math.max(0, expectedRefundEntries - actualRefundEntries),
      payoutRequests: requestedPayouts.length,
      payoutOpenAmount: sumBy(openPayouts, (row) => row.amount),
      payoutPaidAmount: sumBy(paidPayouts, (row) => row.amount),
      payoutFailedCount: failedPayouts.length,
      disputeCount: disputeSummary.disputeCount,
      disputeOpenCount: disputeSummary.openCount,
      disputeOpenAmount: disputeSummary.openDisputedAmount,
      disputeManualReviewCount: disputeSummary.manualReviewCount,
      disputeMissingFinancialCount: disputeSummary.missingFinancialCount,
      creatorBalanceConfidenceRate: creatorBalanceConfidence.confidenceRate,
      creatorBalanceConfidenceState: creatorBalanceConfidence.confidenceState,
      exceptionCount: exceptions.length,
    },
    reconciliation: {
      purchases: {
        statusCounts: purchaseStatusSummary.counts,
        statusAmounts: purchaseStatusSummary.amounts,
        grossPaidAmount,
        processingFeeAmount,
        taxAmount,
        netRevenueAmount,
        refundedAmount,
        refundedNetRevenueAmount,
        chargebackProviderAmount: disputeSummary.providerRefundAmount,
        chargebackNetRevenueAmount,
      },
      webhooks: webhookSummary,
      entitlements: {
        eligible: entitlementEligiblePurchases.length,
        grants: entitlementCoverage.grants,
        missing: entitlementCoverage.missing,
        missingPurchases: entitlementCoverage.missingPurchases,
      },
      wallet: {
        expectedEntries: expectedWalletEntries,
        actualEntries: actualWalletEntries,
        expectedCreatorCredits,
        actualCreatorCredits,
        expectedPlatformFees,
        actualPlatformFees,
      },
      refunds: {
        events: standardRefundedPurchases.length,
        expectedEntries: expectedRefundEntries,
        actualEntries: actualRefundEntries,
        expectedCreatorRefunds,
        actualCreatorRefunds,
        expectedPlatformRefunds,
        actualPlatformRefunds,
      },
      payouts: {
        requestedCount: requestedPayouts.length,
        paidCount: paidPayouts.length,
        failedCount: failedPayouts.length,
        openCount: openPayouts.length,
        requestedAmount: sumBy(requestedPayouts, (row) => row.amount),
        paidAmount: sumBy(paidPayouts, (row) => row.amount),
        failedAmount: sumBy(failedPayouts, (row) => row.amount),
        openAmount: sumBy(openPayouts, (row) => row.amount),
        expectedWalletDebits: expectedPayoutDebits,
        actualWalletDebits: actualPayoutDebits,
      },
      creatorBalances: creatorBalanceConfidence,
      disputes: disputeSummary,
    },
    sourceSystems: [
      { key: "purchases", label: "Purchase records", freshness: "current" },
      { key: "payment_webhook_events", label: "Payment webhook events", freshness: "current" },
      { key: "entitlements", label: "Entitlement grants", freshness: "current" },
      { key: "wallet_entries", label: "Wallet ledger entries", freshness: "current" },
      { key: "creator_payout_requests", label: "Creator payout requests", freshness: "current" },
      {
        key: "disputes",
        label: "Provider dispute feed",
        freshness: disputeSummary.sourceFreshness,
        latestEventAt: disputeSummary.latestProviderEventAt,
      },
    ],
    evidenceGaps: [],
    exceptions,
  };
};

module.exports = {
  buildFinanceAssuranceClose,
};
