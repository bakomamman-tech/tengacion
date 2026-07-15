const crypto = require("crypto");
const mongoose = require("mongoose");
const PaymentDispute = require("../models/PaymentDispute");
const Purchase = require("../models/Purchase");
const {
  recordPurchaseDisputeHoldEntries,
  recordPurchaseDisputeReleaseEntries,
  recordPurchaseChargebackEntries,
} = require("./walletService");

const DISPUTE_ACCOUNTING_LOCK_LEASE_MS = 2 * 60 * 1000;
const DISPUTE_ACCOUNTING_LOCK_WAIT_MS = 5 * 1000;
const DISPUTE_ACCOUNTING_LOCK_POLL_MS = 25;

const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const clampMoney = (value) => Math.max(0, roundMoney(value));
const toText = (value = "", maxLength = 500) =>
  String(value ?? "").trim().slice(0, maxLength);
const normalizeToken = (value = "", maxLength = 120) =>
  toText(value, maxLength)
    .toLowerCase()
    .replace(/[\s_]+/g, "-");

const toDateOrNull = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const acquirePurchaseDisputeAccountingLock = async (purchaseId) => {
  const normalizedPurchaseId = toObjectIdOrNull(purchaseId);
  if (!normalizedPurchaseId) {
    const error = new Error("Purchase dispute accounting lock requires a purchase id");
    error.code = "DISPUTE_ACCOUNTING_PURCHASE_MISSING";
    error.statusCode = 400;
    throw error;
  }

  const ownerToken = crypto.randomUUID();
  const deadline = Date.now() + DISPUTE_ACCOUNTING_LOCK_WAIT_MS;
  do {
    const now = new Date();
    const claimed = await Purchase.findOneAndUpdate(
      {
        _id: normalizedPurchaseId,
        $or: [
          { disputeAccountingLockUntil: null },
          { disputeAccountingLockUntil: { $exists: false } },
          { disputeAccountingLockUntil: { $lte: now } },
        ],
      },
      {
        $set: {
          disputeAccountingLockOwner: ownerToken,
          disputeAccountingLockUntil: new Date(
            now.getTime() + DISPUTE_ACCOUNTING_LOCK_LEASE_MS
          ),
        },
      },
      { returnDocument: "after", timestamps: false }
    ).select("_id +disputeAccountingLockOwner +disputeAccountingLockUntil");

    if (claimed) {
      return { purchaseId: normalizedPurchaseId, ownerToken };
    }
    if (Date.now() < deadline) {
      await wait(DISPUTE_ACCOUNTING_LOCK_POLL_MS);
    }
  } while (Date.now() < deadline);

  const error = new Error("Purchase dispute accounting is already in progress");
  error.code = "DISPUTE_ACCOUNTING_BUSY";
  error.statusCode = 503;
  throw error;
};

const releasePurchaseDisputeAccountingLock = async ({
  purchaseId,
  ownerToken,
} = {}) => {
  if (!purchaseId || !ownerToken) return;
  await Purchase.updateOne(
    {
      _id: purchaseId,
      disputeAccountingLockOwner: ownerToken,
    },
    {
      $set: {
        disputeAccountingLockOwner: "",
        disputeAccountingLockUntil: null,
      },
    },
    { timestamps: false }
  ).catch(() => null);
};

const withPurchaseDisputeAccountingLock = async (purchaseId, operation) => {
  const lock = await acquirePurchaseDisputeAccountingLock(purchaseId);
  try {
    return await operation();
  } finally {
    await releasePurchaseDisputeAccountingLock(lock);
  }
};

const fromPaystackMinorUnit = (value) => {
  if (value == null || value === "") return 0;
  const amount = Number(value);
  return Number.isFinite(amount) ? clampMoney(amount / 100) : 0;
};

const unwrapPaystackDispute = (input = {}) => {
  if (
    input?.data &&
    (normalizeToken(input?.event).startsWith("charge.dispute.") ||
      typeof input?.status === "boolean")
  ) {
    return input.data || {};
  }
  return input || {};
};

const normalizePaystackDispute = (input = {}, { eventType = "" } = {}) => {
  const data = unwrapPaystackDispute(input);
  const normalizedEventType = normalizeToken(eventType || input?.event, 120);
  const transaction = data?.transaction && typeof data.transaction === "object"
    ? data.transaction
    : {};
  const providerDisputeId = toText(data?.id || data?.dispute_code, 160);
  const providerRef = toText(
    transaction?.reference ||
      data?.transaction_reference ||
      data?.merchant_transaction_reference ||
      data?.reference,
    160
  );
  const providerTransactionId = toText(
    transaction?.id || data?.transaction_id,
    160
  );
  const status = normalizeToken(data?.status, 80);
  const resolution = normalizeToken(data?.resolution, 80);
  const disputedAmount = fromPaystackMinorUnit(
    data?.amount ?? transaction?.amount
  );
  const refundAmount = fromPaystackMinorUnit(data?.refund_amount);
  const openedAt = toDateOrNull(data?.created_at || data?.createdAt);
  const isResolvedEvent = normalizedEventType === "charge.dispute.resolve";
  const isResolvedStatus = status === "resolved" || Boolean(data?.resolved_at);
  const isResolved = isResolvedEvent || isResolvedStatus;
  const resolvedAt = isResolved
    ? toDateOrNull(data?.resolved_at || data?.updated_at || data?.updatedAt) || new Date()
    : null;
  const lastEventAt =
    resolvedAt ||
    toDateOrNull(data?.updated_at || data?.updatedAt || data?.created_at || data?.createdAt) ||
    new Date();
  const isAccepted = ["merchant-accepted", "accepted"].includes(resolution);
  const isDeclined = resolution === "declined";
  const outcome = isAccepted
    ? "accepted"
    : isDeclined
      ? "declined"
      : isResolved
        ? "manual_review"
        : "pending";

  let manualReviewReason = "";
  if (!providerDisputeId) {
    manualReviewReason = "missing_provider_dispute_id";
  } else if (!providerRef) {
    manualReviewReason = "missing_purchase_reference";
  } else if (isResolved && outcome === "manual_review") {
    manualReviewReason = "resolved_dispute_has_unknown_resolution";
  } else if (isAccepted && refundAmount <= 0) {
    manualReviewReason = "accepted_dispute_has_no_refund_amount";
  }

  return {
    provider: "paystack",
    providerDisputeId,
    providerRef,
    providerTransactionId,
    status,
    resolution,
    currency: toText(data?.currency || transaction?.currency || "NGN", 10).toUpperCase(),
    disputedAmount,
    refundAmount,
    category: normalizeToken(data?.category, 120),
    note: toText(data?.note || data?.message, 500),
    openedAt,
    resolvedAt,
    lastEventAt,
    lastEventType: normalizedEventType,
    isResolved,
    isAccepted,
    isDeclined,
    outcome,
    manualReviewReason,
    payloadSummary: {
      providerDisputeId,
      providerRef,
      providerTransactionId,
      status,
      resolution,
      disputedAmount,
      refundAmount,
      category: normalizeToken(data?.category, 120),
    },
  };
};

const shouldResolvePaystackDispute = ({ eventType = "", dispute = {} } = {}) => {
  const normalizedEventType = normalizeToken(eventType, 120);
  const resolution = normalizeToken(dispute?.resolution, 80);
  return Boolean(
    normalizedEventType === "charge.dispute.resolve" ||
      dispute?.isResolved ||
      normalizeToken(dispute?.status, 80) === "resolved" ||
      dispute?.resolvedAt ||
      ["merchant-accepted", "accepted", "declined"].includes(resolution)
  );
};

const toObjectIdOrNull = (value) => {
  if (!value) return null;
  const text = value?._id ? value._id.toString() : value.toString();
  return mongoose.Types.ObjectId.isValid(text)
    ? new mongoose.Types.ObjectId(text)
    : null;
};

const upsertPaystackDispute = async ({
  dispute,
  purchaseId = null,
  eventType = "",
} = {}) => {
  const normalized = dispute?.provider === "paystack" && dispute?.providerDisputeId
    ? { ...dispute }
    : normalizePaystackDispute(dispute, { eventType });
  if (!normalized.providerDisputeId) {
    const error = new Error("Paystack dispute is missing its provider dispute id");
    error.code = "PAYSTACK_DISPUTE_ID_MISSING";
    throw error;
  }

  const normalizedPurchaseId = toObjectIdOrNull(purchaseId);
  const manualReviewReason =
    normalized.manualReviewReason === "missing_purchase_reference" && normalizedPurchaseId
      ? ""
      : normalized.manualReviewReason || "";
  const set = {
    providerRef: normalized.providerRef || "",
    providerTransactionId: normalized.providerTransactionId || "",
    status: normalized.status || "",
    resolution: normalized.resolution || "",
    currency: normalized.currency || "NGN",
    disputedAmount: clampMoney(normalized.disputedAmount),
    refundAmount: clampMoney(normalized.refundAmount),
    category: normalized.category || "",
    note: normalized.note || "",
    lastEventAt: normalized.lastEventAt || new Date(),
    lastEventType: normalized.lastEventType || normalizeToken(eventType, 120),
    payloadSummary: normalized.payloadSummary || {},
    manualReviewReason,
    ...(normalized.openedAt ? { openedAt: normalized.openedAt } : {}),
    ...(normalized.resolvedAt ? { resolvedAt: normalized.resolvedAt } : {}),
    ...(normalizedPurchaseId ? { purchaseId: normalizedPurchaseId } : {}),
  };
  const updateResult = await PaymentDispute.updateOne(
    {
      provider: "paystack",
      providerDisputeId: normalized.providerDisputeId,
    },
    {
      $set: set,
      $setOnInsert: {
        provider: "paystack",
        providerDisputeId: normalized.providerDisputeId,
        financialState: manualReviewReason ? "manual_review" : "none",
        holdAmount: 0,
        creatorHoldAmount: 0,
        platformHoldAmount: 0,
        chargebackAmount: 0,
        creatorChargebackAmount: 0,
        platformChargebackAmount: 0,
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
  const storedDispute = await PaymentDispute.findOne({
    provider: "paystack",
    providerDisputeId: normalized.providerDisputeId,
  });

  return {
    created: Boolean(updateResult?.upsertedCount),
    dispute: storedDispute,
    normalized,
  };
};

const markPaymentDisputeFinancialState = async ({
  dispute,
  financialState,
  holdAmount,
  creatorHoldAmount,
  platformHoldAmount,
  chargebackAmount,
  creatorChargebackAmount,
  platformChargebackAmount,
  manualReviewReason = "",
} = {}) => {
  const disputeId = toObjectIdOrNull(dispute?._id || dispute);
  if (!disputeId || !financialState) return null;

  return PaymentDispute.findByIdAndUpdate(
    disputeId,
    {
      $set: {
        financialState,
        ...(holdAmount != null ? { holdAmount: clampMoney(holdAmount) } : {}),
        ...(creatorHoldAmount != null
          ? { creatorHoldAmount: clampMoney(creatorHoldAmount) }
          : {}),
        ...(platformHoldAmount != null
          ? { platformHoldAmount: clampMoney(platformHoldAmount) }
          : {}),
        ...(chargebackAmount != null
          ? { chargebackAmount: clampMoney(chargebackAmount) }
          : {}),
        ...(creatorChargebackAmount != null
          ? { creatorChargebackAmount: clampMoney(creatorChargebackAmount) }
          : {}),
        ...(platformChargebackAmount != null
          ? { platformChargebackAmount: clampMoney(platformChargebackAmount) }
          : {}),
        manualReviewReason: toText(manualReviewReason, 500),
      },
    },
    { returnDocument: "after" }
  );
};

const loadPriorChargebackAmount = async ({ purchaseId, disputeId } = {}) => {
  const normalizedPurchaseId = toObjectIdOrNull(purchaseId);
  if (!normalizedPurchaseId) return 0;
  const rows = await PaymentDispute.aggregate([
    {
      $match: {
        purchaseId: normalizedPurchaseId,
        financialState: "debited",
        ...(toObjectIdOrNull(disputeId)
          ? { _id: { $ne: toObjectIdOrNull(disputeId) } }
          : {}),
      },
    },
    { $group: { _id: null, amount: { $sum: "$chargebackAmount" } } },
  ]);
  return clampMoney(rows?.[0]?.amount);
};

const loadPriorDisputeExposureAmount = async ({ purchaseId, disputeId } = {}) => {
  const normalizedPurchaseId = toObjectIdOrNull(purchaseId);
  if (!normalizedPurchaseId) return 0;
  const rows = await PaymentDispute.aggregate([
    {
      $match: {
        purchaseId: normalizedPurchaseId,
        financialState: { $in: ["held", "debited"] },
        ...(toObjectIdOrNull(disputeId)
          ? { _id: { $ne: toObjectIdOrNull(disputeId) } }
          : {}),
      },
    },
    {
      $group: {
        _id: null,
        amount: {
          $sum: {
            $cond: [
              { $eq: ["$financialState", "held"] },
              "$holdAmount",
              "$chargebackAmount",
            ],
          },
        },
      },
    },
  ]);
  return clampMoney(rows?.[0]?.amount);
};

const recordDisputeOpenedEntriesUnlocked = async ({
  purchase,
  dispute,
  logger = console,
} = {}) => {
  if (!purchase?._id || !dispute?._id) {
    return { action: "hold", skipped: true, reason: "missing_purchase_or_dispute" };
  }
  if (["debited", "released"].includes(dispute.financialState)) {
    return {
      action: "hold",
      skipped: true,
      reason: "dispute_already_resolved",
      financialState: dispute.financialState,
    };
  }

  const priorLossAmount = await loadPriorDisputeExposureAmount({
    purchaseId: purchase._id,
    disputeId: dispute._id,
  });
  const walletResult = await recordPurchaseDisputeHoldEntries({
    purchase,
    dispute,
    priorLossAmount,
    logger,
  });
  if (walletResult.skipped) {
    const updatedDispute = await markPaymentDisputeFinancialState({
      dispute,
      financialState: "manual_review",
      manualReviewReason: walletResult.reason,
    });
    return {
      action: "hold",
      ...walletResult,
      financialState: "manual_review",
      dispute: updatedDispute,
    };
  }

  const updatedDispute = await markPaymentDisputeFinancialState({
    dispute,
    financialState: "held",
    holdAmount: walletResult.chargebackAmount,
    creatorHoldAmount: walletResult.creatorChargebackAmount,
    platformHoldAmount: walletResult.platformChargebackAmount,
  });
  return {
    action: "hold",
    ...walletResult,
    financialState: "held",
    dispute: updatedDispute,
  };
};

const recordDisputeResolvedEntriesUnlocked = async ({
  purchase,
  dispute,
  logger = console,
} = {}) => {
  if (!purchase?._id || !dispute?._id) {
    return { action: "resolve", skipped: true, reason: "missing_purchase_or_dispute" };
  }

  const resolution = normalizeToken(dispute.resolution, 80);
  if (resolution === "declined") {
    const walletResult = await recordPurchaseDisputeReleaseEntries({
      purchase,
      dispute,
      logger,
    });
    const updatedDispute = await markPaymentDisputeFinancialState({
      dispute,
      financialState: "released",
      holdAmount: 0,
      creatorHoldAmount: 0,
      platformHoldAmount: 0,
    });
    return {
      action: "release",
      ...walletResult,
      financialState: "released",
      dispute: updatedDispute,
    };
  }

  if (!["merchant-accepted", "accepted"].includes(resolution)) {
    const reason = "resolved_dispute_has_unknown_resolution";
    const updatedDispute = await markPaymentDisputeFinancialState({
      dispute,
      financialState: "manual_review",
      manualReviewReason: reason,
    });
    return {
      action: "manual_review",
      skipped: true,
      reason,
      financialState: "manual_review",
      dispute: updatedDispute,
    };
  }

  if (clampMoney(dispute.refundAmount) <= 0) {
    const reason = "accepted_dispute_has_no_refund_amount";
    const updatedDispute = await markPaymentDisputeFinancialState({
      dispute,
      financialState: "manual_review",
      manualReviewReason: reason,
    });
    return {
      action: "manual_review",
      skipped: true,
      reason,
      financialState: "manual_review",
      dispute: updatedDispute,
    };
  }

  const priorLossAmount = await loadPriorChargebackAmount({
    purchaseId: purchase._id,
    disputeId: dispute._id,
  });
  const walletResult = await recordPurchaseChargebackEntries({
    purchase,
    dispute,
    priorLossAmount,
    logger,
  });
  if (walletResult.skipped) {
    const updatedDispute = await markPaymentDisputeFinancialState({
      dispute,
      financialState: "manual_review",
      manualReviewReason: walletResult.reason,
    });
    return {
      action: "chargeback",
      ...walletResult,
      financialState: "manual_review",
      dispute: updatedDispute,
    };
  }

  const updatedDispute = await markPaymentDisputeFinancialState({
    dispute,
    financialState: "debited",
    holdAmount: 0,
    creatorHoldAmount: 0,
    platformHoldAmount: 0,
    chargebackAmount: walletResult.chargebackAmount,
    creatorChargebackAmount: walletResult.creatorChargebackAmount,
    platformChargebackAmount: walletResult.platformChargebackAmount,
  });
  return {
    action: "chargeback",
    ...walletResult,
    financialState: "debited",
    dispute: updatedDispute,
  };
};

const recordDisputeOpenedEntries = async (options = {}) => {
  if (!options?.purchase?._id) {
    return recordDisputeOpenedEntriesUnlocked(options);
  }
  return withPurchaseDisputeAccountingLock(options.purchase._id, () =>
    recordDisputeOpenedEntriesUnlocked(options)
  );
};

const recordDisputeResolvedEntries = async (options = {}) => {
  if (!options?.purchase?._id) {
    return recordDisputeResolvedEntriesUnlocked(options);
  }
  return withPurchaseDisputeAccountingLock(options.purchase._id, () =>
    recordDisputeResolvedEntriesUnlocked(options)
  );
};

module.exports = {
  fromPaystackMinorUnit,
  normalizePaystackDispute,
  shouldResolvePaystackDispute,
  upsertPaystackDispute,
  markPaymentDisputeFinancialState,
  recordDisputeOpenedEntries,
  recordDisputeResolvedEntries,
  recordPurchaseChargebackEntries,
};
