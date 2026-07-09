const crypto = require("crypto");
const mongoose = require("mongoose");

const CreatorPayoutRequest = require("../models/CreatorPayoutRequest");
const CreatorProfile = require("../models/CreatorProfile");
const MarketplacePayout = require("../models/MarketplacePayout");
const MarketplaceSeller = require("../models/MarketplaceSeller");
const User = require("../models/User");
const WalletEntry = require("../models/WalletEntry");
const Withdrawal = require("../models/Withdrawal");
const { createNotification } = require("./notificationService");
const { buildPayoutReadiness, maskAccountNumber } = require("./payoutReadinessService");
const {
  buildCreatorWalletSnapshot,
  ensureCreatorWalletAccount,
} = require("./walletService");
const {
  recordRevenueLedgerEntry,
} = require("./revenueLedgerService");
const {
  createTransferRecipient,
  initiateTransfer,
  mapTransferStatus,
  normalizeTransferResponse,
  verifyTransfer,
} = require("./paystackService");
const { getEmailSettings } = require("../utils/emailSettings");
const sendSecurityEmail = require("../utils/sendSecurityEmail");

const OPEN_LEGACY_CREATOR_PAYOUT_STATUSES = [
  "pending_review",
  "needs_creator_action",
  "approved",
  "processing",
];
const OPEN_WITHDRAWAL_STATUSES = Withdrawal.OPEN_WITHDRAWAL_STATUSES || [
  "requested",
  "processing",
  "otp_required",
];
const FINAL_WITHDRAWAL_STATUSES = ["succeeded", "failed", "reversed"];
const MIN_WITHDRAWAL_RESERVE_NGN = 1000;
const DEFAULT_PAGE_LIMIT = 20;

const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const clampMoney = (value) => Math.max(0, roundMoney(value));
const normalizeCurrency = (value = "NGN") =>
  String(value || "NGN").trim().toUpperCase() || "NGN";

const normalizeText = (value = "", maxLength = 300) =>
  String(value || "").trim().slice(0, maxLength);

const toIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  return value.toString();
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(toIdString(value));

const buildHttpError = (message, status = 400, details = {}) =>
  Object.assign(new Error(message), { status, details });

const buildPagination = ({ page = 1, limit = DEFAULT_PAGE_LIMIT } = {}) => {
  const safePage = Math.max(1, Number(page || 1));
  const safeLimit = Math.min(100, Math.max(1, Number(limit || DEFAULT_PAGE_LIMIT)));
  return {
    page: safePage,
    limit: safeLimit,
    skip: (safePage - 1) * safeLimit,
  };
};

const buildWithdrawalReference = () => {
  const stamp = Date.now().toString(36);
  const suffix = crypto.randomBytes(5).toString("hex");
  return `tgn_wd_${stamp}_${suffix}`.slice(0, 50);
};

const normalizeAmount = (amount) => {
  const normalized = roundMoney(amount);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw buildHttpError("Withdrawal amount must be greater than zero", 400);
  }
  return normalized;
};

const serializeWithdrawal = (withdrawal = {}) => ({
  id: toIdString(withdrawal._id),
  ownerType: withdrawal.ownerType || "",
  ownerId: toIdString(withdrawal.ownerId),
  userId: toIdString(withdrawal.userId),
  amount: clampMoney(withdrawal.amount),
  currency: normalizeCurrency(withdrawal.currency),
  status: withdrawal.status || "requested",
  reference: withdrawal.reference || "",
  provider: withdrawal.provider || "paystack",
  providerStatus: withdrawal.providerStatus || "",
  providerTransferCode: withdrawal.providerTransferCode || "",
  failureReason: withdrawal.failureReason || "",
  bank: withdrawal.bankSnapshot || {},
  balanceSnapshot: withdrawal.balanceSnapshot || {},
  requestedAt: withdrawal.requestedAt || withdrawal.createdAt || null,
  initiatedAt: withdrawal.initiatedAt || null,
  completedAt: withdrawal.completedAt || null,
  failedAt: withdrawal.failedAt || null,
  reversedAt: withdrawal.reversedAt || null,
  statusHistory: Array.isArray(withdrawal.statusHistory)
    ? withdrawal.statusHistory.map((entry) => ({
        status: entry.status || "",
        at: entry.at || null,
        note: entry.note || "",
        providerStatus: entry.providerStatus || "",
      }))
    : [],
  createdAt: withdrawal.createdAt || null,
  updatedAt: withdrawal.updatedAt || null,
});

const appendWithdrawalStatusHistory = ({
  withdrawal,
  status,
  note = "",
  providerStatus = "",
} = {}) => {
  withdrawal.statusHistory.push({
    status,
    at: new Date(),
    note: normalizeText(note, 300),
    providerStatus: normalizeText(providerStatus, 80),
  });
};

const getOpenWithdrawalAmount = async ({
  ownerType,
  ownerId,
  currency = "NGN",
  excludeWithdrawalId = null,
} = {}) => {
  if (!ownerType || !isValidObjectId(ownerId)) {
    return { amount: 0, count: 0 };
  }

  const match = {
    ownerType,
    ownerId: new mongoose.Types.ObjectId(toIdString(ownerId)),
    currency: normalizeCurrency(currency),
    status: { $in: OPEN_WITHDRAWAL_STATUSES },
  };

  if (excludeWithdrawalId && isValidObjectId(excludeWithdrawalId)) {
    match._id = { $ne: new mongoose.Types.ObjectId(toIdString(excludeWithdrawalId)) };
  }

  const [row] = await Withdrawal.aggregate([
    { $match: match },
    { $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);

  return {
    amount: clampMoney(row?.amount || 0),
    count: Number(row?.count || 0),
  };
};

const getSucceededWithdrawalAmount = async ({ ownerType, ownerId, currency = "NGN" } = {}) => {
  if (!ownerType || !isValidObjectId(ownerId)) {
    return { amount: 0, count: 0 };
  }

  const [row] = await Withdrawal.aggregate([
    {
      $match: {
        ownerType,
        ownerId: new mongoose.Types.ObjectId(toIdString(ownerId)),
        currency: normalizeCurrency(currency),
        status: "succeeded",
      },
    },
    { $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);

  return {
    amount: clampMoney(row?.amount || 0),
    count: Number(row?.count || 0),
  };
};

const getOpenLegacyCreatorPayoutAmount = async ({
  creatorProfileId,
  currency = "NGN",
} = {}) => {
  if (!isValidObjectId(creatorProfileId)) {
    return { amount: 0, count: 0 };
  }

  const [row] = await CreatorPayoutRequest.aggregate([
    {
      $match: {
        creatorProfile: new mongoose.Types.ObjectId(toIdString(creatorProfileId)),
        currency: normalizeCurrency(currency),
        status: { $in: OPEN_LEGACY_CREATOR_PAYOUT_STATUSES },
      },
    },
    { $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);

  return {
    amount: clampMoney(row?.amount || 0),
    count: Number(row?.count || 0),
  };
};

const buildCreatorWithdrawalAvailability = async ({
  profile,
  currency = "NGN",
} = {}) => {
  const normalizedCurrency = normalizeCurrency(currency);
  const [wallet, openWithdrawals, legacyOpenPayouts] = await Promise.all([
    buildCreatorWalletSnapshot({
      creatorId: profile?._id,
      currency: normalizedCurrency,
      recentLimit: 5,
    }),
    getOpenWithdrawalAmount({
      ownerType: "creator",
      ownerId: profile?._id,
      currency: normalizedCurrency,
    }),
    getOpenLegacyCreatorPayoutAmount({
      creatorProfileId: profile?._id,
      currency: normalizedCurrency,
    }),
  ]);

  const availableBalance = clampMoney(wallet?.summary?.availableBalance || 0);
  const openWithdrawalAmount = clampMoney(openWithdrawals.amount || 0);
  const legacyOpenPayoutAmount = clampMoney(legacyOpenPayouts.amount || 0);
  const reserveAmount = normalizedCurrency === "NGN" ? MIN_WITHDRAWAL_RESERVE_NGN : 0;

  return {
    currency: normalizedCurrency,
    walletBacked: Boolean(wallet?.walletBacked),
    totalEarnings: clampMoney(wallet?.summary?.totalEarnings || 0),
    availableBalance,
    withdrawn: clampMoney(wallet?.summary?.withdrawn || 0),
    openWithdrawalAmount,
    openWithdrawalCount: Number(openWithdrawals.count || 0),
    legacyOpenPayoutAmount,
    legacyOpenPayoutCount: Number(legacyOpenPayouts.count || 0),
    reserveAmount,
    withdrawableAmount: clampMoney(
      availableBalance - openWithdrawalAmount - legacyOpenPayoutAmount - reserveAmount
    ),
  };
};

const buildSellerWithdrawalAvailability = async ({
  sellerId,
  currency = "NGN",
} = {}) => {
  const normalizedCurrency = normalizeCurrency(currency);
  const [payoutRow, openWithdrawals, succeededWithdrawals] = await Promise.all([
    MarketplacePayout.aggregate([
      {
        $match: {
          seller: new mongoose.Types.ObjectId(toIdString(sellerId)),
          payoutStatus: { $in: ["pending", "failed"] },
        },
      },
      {
        $lookup: {
          from: "marketplaceorders",
          localField: "order",
          foreignField: "_id",
          as: "order",
        },
      },
      { $unwind: { path: "$order", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          buyerConfirmedHealthy: {
            $and: [
              { $eq: ["$order.paymentStatus", "paid"] },
              { $eq: ["$order.orderStatus", "completed"] },
              { $eq: ["$order.buyerDeliveryCondition", "healthy"] },
              { $ne: ["$order.buyerDeliveryConfirmedAt", null] },
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$grossAmount" },
          totalPlatformFees: { $sum: "$platformFee" },
          totalNetReceivable: { $sum: "$netAmount" },
          totalCompletedOrders: { $sum: 1 },
          confirmedSales: {
            $sum: {
              $cond: ["$buyerConfirmedHealthy", "$grossAmount", 0],
            },
          },
          confirmedPlatformFees: {
            $sum: {
              $cond: ["$buyerConfirmedHealthy", "$platformFee", 0],
            },
          },
          confirmedNetReceivable: {
            $sum: {
              $cond: ["$buyerConfirmedHealthy", "$netAmount", 0],
            },
          },
          confirmedOrderCount: {
            $sum: {
              $cond: ["$buyerConfirmedHealthy", 1, 0],
            },
          },
        },
      },
    ]),
    getOpenWithdrawalAmount({
      ownerType: "seller",
      ownerId: sellerId,
      currency: normalizedCurrency,
    }),
    getSucceededWithdrawalAmount({
      ownerType: "seller",
      ownerId: sellerId,
      currency: normalizedCurrency,
    }),
  ]);

  const payoutSummary = payoutRow[0] || {};
  const totalNetReceivable = clampMoney(payoutSummary.totalNetReceivable || 0);
  const confirmedNetReceivable = clampMoney(payoutSummary.confirmedNetReceivable || 0);
  const withdrawn = clampMoney(succeededWithdrawals.amount || 0);
  const openWithdrawalAmount = clampMoney(openWithdrawals.amount || 0);
  const availableBalance = clampMoney(confirmedNetReceivable - withdrawn - openWithdrawalAmount);
  const reserveAmount = normalizedCurrency === "NGN" ? MIN_WITHDRAWAL_RESERVE_NGN : 0;

  return {
    currency: normalizedCurrency,
    totalSales: clampMoney(payoutSummary.totalSales || 0),
    totalPlatformFees: clampMoney(payoutSummary.totalPlatformFees || 0),
    totalNetReceivable,
    totalCompletedOrders: Number(payoutSummary.totalCompletedOrders || 0),
    confirmedSales: clampMoney(payoutSummary.confirmedSales || 0),
    confirmedPlatformFees: clampMoney(payoutSummary.confirmedPlatformFees || 0),
    confirmedNetReceivable,
    confirmedOrderCount: Number(payoutSummary.confirmedOrderCount || 0),
    heldNetReceivable: clampMoney(totalNetReceivable - confirmedNetReceivable),
    withdrawn,
    openWithdrawalAmount,
    openWithdrawalCount: Number(openWithdrawals.count || 0),
    reserveAmount,
    availableBalance,
    withdrawableAmount: clampMoney(availableBalance - reserveAmount),
  };
};

const assertWithdrawalAmountAllowed = ({ amount, availability } = {}) => {
  if (amount > clampMoney(availability?.withdrawableAmount || 0)) {
    throw buildHttpError("Withdrawal amount exceeds your available balance after the reserve", 400, {
      availability,
      reserveAmount: MIN_WITHDRAWAL_RESERVE_NGN,
    });
  }
};

const assertCreatorBankReady = (profile = {}) => {
  const readiness = buildPayoutReadiness(profile);
  if (!readiness.ready || !readiness.canRequestPayout) {
    throw buildHttpError("Complete payout readiness before withdrawing", 400, {
      readiness,
    });
  }
  return readiness;
};

const assertBankDetailsReady = (owner = {}) => {
  const bankName = normalizeText(owner.bankName, 120);
  const bankCode = normalizeText(owner.bankCode, 30);
  const accountNumber = String(owner.accountNumber || "").replace(/\D/g, "").slice(0, 20);
  const accountName = normalizeText(owner.accountName || owner.fullName || owner.storeName, 140);

  if (!bankName || !bankCode || !accountNumber || !accountName) {
    throw buildHttpError("Add verified bank name, bank code, account number, and account name first", 400, {
      missingBankDetails: {
        bankName: !bankName,
        bankCode: !bankCode,
        accountNumber: !accountNumber,
        accountName: !accountName,
      },
    });
  }

  return {
    bankName,
    bankCode,
    accountNumber,
    accountName,
  };
};

const buildBankSnapshot = (owner = {}) => ({
  bankName: normalizeText(owner.bankName, 120),
  bankCode: normalizeText(owner.bankCode, 30),
  accountNumberMasked: maskAccountNumber(owner.accountNumber),
  accountName: normalizeText(owner.accountName || owner.fullName || owner.storeName, 140),
  recipientCode: normalizeText(owner.payoutRecipientCode, 120),
});

const ensurePaystackRecipientForOwner = async ({ ownerType, owner }) => {
  const bankDetails = assertBankDetailsReady(owner);
  if (owner.payoutRecipientCode) {
    return {
      recipientCode: owner.payoutRecipientCode,
      recipientId: owner.payoutRecipientId || "",
      bankDetails,
    };
  }

  const recipient = await createTransferRecipient({
    name: bankDetails.accountName,
    accountNumber: bankDetails.accountNumber,
    bankCode: bankDetails.bankCode,
    currency: "NGN",
    metadata: {
      ownerType,
      ownerId: toIdString(owner._id),
      userId: toIdString(owner.userId || owner.user),
    },
  });

  owner.payoutRecipientCode = recipient.recipientCode;
  owner.payoutRecipientId = String(recipient.id || "");
  owner.payoutRecipientVerifiedAt = new Date();
  await owner.save();

  return {
    recipientCode: recipient.recipientCode,
    recipientId: String(recipient.id || ""),
    bankDetails,
  };
};

const updateWithdrawalFromTransfer = ({ withdrawal, transfer }) => {
  withdrawal.providerResponse = transfer.raw || transfer;
  withdrawal.providerStatus = transfer.providerStatus || transfer.status || withdrawal.providerStatus || "";
  withdrawal.providerTransferCode = transfer.transferCode || withdrawal.providerTransferCode || "";
  withdrawal.providerTransferId = String(transfer.id || withdrawal.providerTransferId || "");
};

const recordWithdrawalLedgerEvent = async ({
  withdrawal,
  ledgerEventType,
  actorType = "system",
  actorUserId = null,
  actorRole = "",
  reason = "",
} = {}) => {
  if (!withdrawal?._id || !ledgerEventType) {
    return { createdCount: 0, skipped: true };
  }

  const withdrawalId = toIdString(withdrawal._id);
  const isCreator = withdrawal.ownerType === "creator";
  const direction = ledgerEventType === "payout_sent"
    ? "debit"
    : ledgerEventType === "payout_reversed"
      ? "credit"
      : "none";
  const balanceScope = direction === "none" ? "none" : "available";
  const result = await recordRevenueLedgerEntry({
    ledgerEventType,
    accountType: isCreator ? "creator" : "marketplace_seller",
    accountId: withdrawal.ownerId,
    currency: withdrawal.currency,
    amount: clampMoney(withdrawal.amount),
    direction,
    balanceScope,
    actorType,
    actorId: actorUserId || null,
    actorRole,
    sourceType: isCreator ? "creator_payout" : "marketplace_payout",
    sourceId: withdrawal._id,
    sourceRef: withdrawal.reference || "",
    provider: withdrawal.provider || "paystack",
    providerReference: withdrawal.providerTransferCode || withdrawal.reference || "",
    dedupeKey: `${withdrawal.ownerType}_${ledgerEventType}:${withdrawalId}`,
    occurredAt:
      ledgerEventType === "payout_sent"
        ? withdrawal.completedAt || new Date()
        : ledgerEventType === "payout_reversed"
          ? withdrawal.reversedAt || new Date()
          : new Date(),
    auditMetadata: {
      withdrawalId,
      ownerType: withdrawal.ownerType,
      ownerId: toIdString(withdrawal.ownerId),
      userId: toIdString(withdrawal.userId),
      reference: withdrawal.reference || "",
      providerTransferCode: withdrawal.providerTransferCode || "",
      providerStatus: withdrawal.providerStatus || "",
      status: withdrawal.status || "",
      reason: normalizeText(reason, 240),
    },
  });

  return {
    createdCount: result.created ? 1 : 0,
    skipped: false,
  };
};

const createCreatorPayoutDebitEntry = async ({ withdrawal } = {}) => {
  if (!withdrawal?._id || withdrawal.ownerType !== "creator") {
    return { created: false, skipped: true };
  }

  const wallet = await ensureCreatorWalletAccount(withdrawal.ownerId, withdrawal.currency);
  const withdrawalId = toIdString(withdrawal._id);
  const result = await WalletEntry.updateOne(
    { dedupeKey: `creator_withdrawal_debit:${withdrawalId}` },
    {
      $setOnInsert: {
        walletAccountId: wallet._id,
        ownerType: "creator",
        ownerId: withdrawal.ownerId,
        currency: normalizeCurrency(withdrawal.currency),
        direction: "debit",
        bucket: "available",
        entryType: "payout_debit",
        amount: clampMoney(withdrawal.amount),
        grossAmount: clampMoney(withdrawal.amount),
        sourceType: "payout",
        sourceId: withdrawal._id,
        sourceRef: withdrawal.providerTransferCode || withdrawal.reference || "",
        dedupeKey: `creator_withdrawal_debit:${withdrawalId}`,
        effectiveAt: withdrawal.completedAt || new Date(),
        metadata: {
          creatorProfileId: toIdString(withdrawal.ownerId),
          creatorUserId: toIdString(withdrawal.userId),
          withdrawalId,
          reference: withdrawal.reference || "",
          provider: withdrawal.provider || "paystack",
          providerTransferCode: withdrawal.providerTransferCode || "",
        },
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  return {
    created: Boolean(result?.upsertedCount),
  };
};

const createCreatorWithdrawalReversalEntry = async ({ withdrawal } = {}) => {
  if (!withdrawal?._id || withdrawal.ownerType !== "creator") {
    return { created: false, skipped: true };
  }

  const wallet = await ensureCreatorWalletAccount(withdrawal.ownerId, withdrawal.currency);
  const withdrawalId = toIdString(withdrawal._id);
  const result = await WalletEntry.updateOne(
    { dedupeKey: `creator_withdrawal_reversal:${withdrawalId}` },
    {
      $setOnInsert: {
        walletAccountId: wallet._id,
        ownerType: "creator",
        ownerId: withdrawal.ownerId,
        currency: normalizeCurrency(withdrawal.currency),
        direction: "credit",
        bucket: "available",
        entryType: "adjustment_credit",
        amount: clampMoney(withdrawal.amount),
        grossAmount: clampMoney(withdrawal.amount),
        sourceType: "payout",
        sourceId: withdrawal._id,
        sourceRef: withdrawal.providerTransferCode || withdrawal.reference || "",
        dedupeKey: `creator_withdrawal_reversal:${withdrawalId}`,
        effectiveAt: withdrawal.reversedAt || new Date(),
        metadata: {
          creatorProfileId: toIdString(withdrawal.ownerId),
          creatorUserId: toIdString(withdrawal.userId),
          withdrawalId,
          reference: withdrawal.reference || "",
          provider: withdrawal.provider || "paystack",
          providerTransferCode: withdrawal.providerTransferCode || "",
        },
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  return {
    created: Boolean(result?.upsertedCount),
  };
};

const buildAdminWithdrawalText = ({ withdrawal, eventLabel = "Withdrawal" } = {}) => {
  const amount = `${normalizeCurrency(withdrawal.currency)} ${clampMoney(withdrawal.amount).toLocaleString("en-NG")}`;
  const time = new Date(withdrawal.requestedAt || withdrawal.createdAt || Date.now()).toISOString();
  return `${eventLabel}: ${withdrawal.ownerType} withdrew ${amount} at ${time}. Ref: ${withdrawal.reference}`;
};

const notifyAdminsAboutWithdrawal = async ({ withdrawal, eventLabel = "Withdrawal made" } = {}) => {
  if (!withdrawal?._id) {
    return;
  }

  const admins = await User.find({
    role: { $in: ["admin", "super_admin", "trust_safety_admin"] },
    isActive: { $ne: false },
    isDeleted: { $ne: true },
  })
    .select("_id email")
    .lean()
    .catch(() => []);

  const text = buildAdminWithdrawalText({ withdrawal, eventLabel });
  const sender = withdrawal.userId;
  await Promise.all(
    admins.map((admin) =>
      createNotification({
        recipient: admin._id,
        sender,
        type: "system",
        text,
        entity: {
          id: withdrawal.userId,
          model: "User",
        },
        metadata: {
          dedupeKey: `withdrawal:${eventLabel}:${toIdString(withdrawal._id)}`,
          withdrawalId: toIdString(withdrawal._id),
          ownerType: withdrawal.ownerType,
          amount: clampMoney(withdrawal.amount),
          reference: withdrawal.reference,
        },
      })
    )
  ).catch(() => null);

  const settings = getEmailSettings();
  if (settings.configured && settings.adminNotificationEmail) {
    await sendSecurityEmail({
      to: settings.adminNotificationEmail,
      subject: `Tengacion ${eventLabel}`,
      html: `<p>${text}</p>`,
    }).catch(() => null);
  }
};

const markWithdrawalProcessing = async ({ withdrawal, transfer }) => {
  updateWithdrawalFromTransfer({ withdrawal, transfer });
  withdrawal.status = transfer.status === "otp" ? "otp_required" : "processing";
  withdrawal.initiatedAt = withdrawal.initiatedAt || new Date();
  appendWithdrawalStatusHistory({
    withdrawal,
    status: withdrawal.status,
    note: transfer.status === "otp"
      ? "Paystack requires transfer OTP finalization."
      : "Paystack transfer initiated.",
    providerStatus: transfer.providerStatus || transfer.status,
  });
  await withdrawal.save();
  await notifyAdminsAboutWithdrawal({
    withdrawal,
    eventLabel: withdrawal.status === "otp_required"
      ? "Withdrawal requires Paystack OTP"
      : "Withdrawal processing",
  });
  return withdrawal;
};

const markWithdrawalFailed = async ({
  withdrawal,
  reason = "",
  transfer = null,
  notify = true,
} = {}) => {
  if (!withdrawal?._id) {
    return withdrawal;
  }
  if (transfer) {
    updateWithdrawalFromTransfer({ withdrawal, transfer });
  }
  withdrawal.status = "failed";
  withdrawal.failedAt = withdrawal.failedAt || new Date();
  withdrawal.failureReason = normalizeText(reason || transfer?.reason || "Withdrawal failed", 500);
  appendWithdrawalStatusHistory({
    withdrawal,
    status: "failed",
    note: withdrawal.failureReason,
    providerStatus: transfer?.providerStatus || transfer?.status || withdrawal.providerStatus || "",
  });
  await withdrawal.save();
  await recordWithdrawalLedgerEvent({
    withdrawal,
    ledgerEventType: "payout_failed",
    actorType: "provider",
    reason: withdrawal.failureReason,
  }).catch(() => null);
  if (notify) {
    await notifyAdminsAboutWithdrawal({
      withdrawal,
      eventLabel: "Withdrawal failed",
    });
  }
  return withdrawal;
};

const markWithdrawalSucceeded = async ({ withdrawal, transfer = null } = {}) => {
  if (!withdrawal?._id) {
    return withdrawal;
  }
  if (transfer) {
    updateWithdrawalFromTransfer({ withdrawal, transfer });
  }
  const alreadySucceeded = withdrawal.status === "succeeded";
  withdrawal.status = "succeeded";
  withdrawal.completedAt = withdrawal.completedAt || transfer?.transferredAt || new Date();
  if (!alreadySucceeded) {
    appendWithdrawalStatusHistory({
      withdrawal,
      status: "succeeded",
      note: "Paystack transfer succeeded.",
      providerStatus: transfer?.providerStatus || transfer?.status || withdrawal.providerStatus || "",
    });
  }
  await withdrawal.save();

  if (withdrawal.ownerType === "creator") {
    await createCreatorPayoutDebitEntry({ withdrawal });
  }
  await recordWithdrawalLedgerEvent({
    withdrawal,
    ledgerEventType: "payout_sent",
    actorType: "provider",
  }).catch(() => null);

  if (!alreadySucceeded) {
    await notifyAdminsAboutWithdrawal({
      withdrawal,
      eventLabel: "Withdrawal completed",
    });
  }
  return withdrawal;
};

const markWithdrawalReversed = async ({ withdrawal, transfer = null, reason = "" } = {}) => {
  if (!withdrawal?._id) {
    return withdrawal;
  }
  if (transfer) {
    updateWithdrawalFromTransfer({ withdrawal, transfer });
  }
  const alreadyReversed = withdrawal.status === "reversed";
  withdrawal.status = "reversed";
  withdrawal.reversedAt = withdrawal.reversedAt || new Date();
  withdrawal.failureReason = normalizeText(reason || transfer?.reason || "Withdrawal reversed", 500);
  if (!alreadyReversed) {
    appendWithdrawalStatusHistory({
      withdrawal,
      status: "reversed",
      note: withdrawal.failureReason,
      providerStatus: transfer?.providerStatus || transfer?.status || withdrawal.providerStatus || "",
    });
  }
  await withdrawal.save();

  if (withdrawal.ownerType === "creator") {
    await createCreatorWithdrawalReversalEntry({ withdrawal });
  }
  await recordWithdrawalLedgerEvent({
    withdrawal,
    ledgerEventType: "payout_reversed",
    actorType: "provider",
    reason: withdrawal.failureReason,
  }).catch(() => null);

  if (!alreadyReversed) {
    await notifyAdminsAboutWithdrawal({
      withdrawal,
      eventLabel: "Withdrawal reversed",
    });
  }
  return withdrawal;
};

const applyTransferStatusToWithdrawal = async ({ withdrawal, transfer }) => {
  const normalizedStatus = mapTransferStatus(transfer?.status || transfer?.providerStatus || "");
  if (normalizedStatus === "success") {
    return markWithdrawalSucceeded({ withdrawal, transfer });
  }
  if (normalizedStatus === "failed") {
    return markWithdrawalFailed({
      withdrawal,
      reason: transfer?.reason || "Paystack transfer failed",
      transfer,
    });
  }
  if (normalizedStatus === "reversed") {
    return markWithdrawalReversed({
      withdrawal,
      transfer,
      reason: transfer?.reason || "Paystack transfer reversed",
    });
  }
  return markWithdrawalProcessing({ withdrawal, transfer });
};

const initiateWithdrawalTransfer = async ({
  withdrawal,
  owner,
  ownerType,
  reason,
} = {}) => {
  try {
    const recipient = await ensurePaystackRecipientForOwner({ ownerType, owner });
    withdrawal.providerRecipientCode = recipient.recipientCode;
    withdrawal.bankSnapshot = {
      ...buildBankSnapshot(owner),
      recipientCode: recipient.recipientCode,
    };
    await withdrawal.save();

    const transfer = await initiateTransfer({
      amountNgn: withdrawal.amount,
      recipient: recipient.recipientCode,
      reference: withdrawal.reference,
      reason,
      currency: withdrawal.currency,
    });

    return applyTransferStatusToWithdrawal({ withdrawal, transfer });
  } catch (error) {
    await markWithdrawalFailed({
      withdrawal,
      reason: error?.message || "Unable to initiate withdrawal",
    }).catch(() => null);
    throw error;
  }
};

const createCreatorWithdrawal = async ({
  userId,
  amount,
  currency = "NGN",
} = {}) => {
  if (!isValidObjectId(userId)) {
    throw buildHttpError("Creator profile not found", 404);
  }
  const profile = await CreatorProfile.findOne({ userId });
  if (!profile) {
    throw buildHttpError("Creator profile not found", 404);
  }

  const normalizedCurrency = normalizeCurrency(currency);
  if (normalizedCurrency !== "NGN") {
    throw buildHttpError("Creator withdrawals currently support NGN only", 400);
  }
  assertCreatorBankReady(profile);
  assertBankDetailsReady(profile);
  const requestedAmount = normalizeAmount(amount);
  const availability = await buildCreatorWithdrawalAvailability({
    profile,
    currency: normalizedCurrency,
  });
  assertWithdrawalAmountAllowed({ amount: requestedAmount, availability });

  const withdrawal = await Withdrawal.create({
    ownerType: "creator",
    ownerId: profile._id,
    userId,
    amount: requestedAmount,
    currency: normalizedCurrency,
    status: "requested",
    reference: buildWithdrawalReference(),
    provider: "paystack",
    bankSnapshot: buildBankSnapshot(profile),
    balanceSnapshot: availability,
    metadata: {
      displayName: profile.displayName || profile.fullName || "",
    },
  });

  await recordWithdrawalLedgerEvent({
    withdrawal,
    ledgerEventType: "payout_requested",
    actorType: "user",
    actorUserId: userId,
  }).catch(() => null);
  await notifyAdminsAboutWithdrawal({ withdrawal, eventLabel: "Withdrawal made" });

  const updatedWithdrawal = await initiateWithdrawalTransfer({
    withdrawal,
    owner: profile,
    ownerType: "creator",
    reason: "Tengacion creator withdrawal",
  });

  return {
    withdrawal: serializeWithdrawal(updatedWithdrawal.toObject?.() || updatedWithdrawal),
    summary: await buildCreatorWithdrawalAvailability({
      profile,
      currency: normalizedCurrency,
    }),
  };
};

const createSellerWithdrawal = async ({
  seller,
  sellerId,
  userId,
  amount,
  currency = "NGN",
} = {}) => {
  const marketplaceSeller = seller?._id
    ? seller
    : await MarketplaceSeller.findById(sellerId);
  if (!marketplaceSeller) {
    throw buildHttpError("Marketplace seller profile not found", 404);
  }
  if (marketplaceSeller.status !== "approved" || marketplaceSeller.isActive === false) {
    throw buildHttpError("Only approved marketplace sellers can withdraw payouts", 403);
  }

  const normalizedCurrency = normalizeCurrency(currency);
  if (normalizedCurrency !== "NGN") {
    throw buildHttpError("Marketplace withdrawals currently support NGN only", 400);
  }
  assertBankDetailsReady(marketplaceSeller);
  const requestedAmount = normalizeAmount(amount);
  const availability = await buildSellerWithdrawalAvailability({
    sellerId: marketplaceSeller._id,
    currency: normalizedCurrency,
  });
  assertWithdrawalAmountAllowed({ amount: requestedAmount, availability });

  const withdrawal = await Withdrawal.create({
    ownerType: "seller",
    ownerId: marketplaceSeller._id,
    userId: userId || marketplaceSeller.user,
    amount: requestedAmount,
    currency: normalizedCurrency,
    status: "requested",
    reference: buildWithdrawalReference(),
    provider: "paystack",
    bankSnapshot: buildBankSnapshot(marketplaceSeller),
    balanceSnapshot: availability,
    metadata: {
      storeName: marketplaceSeller.storeName || "",
    },
  });

  await recordWithdrawalLedgerEvent({
    withdrawal,
    ledgerEventType: "payout_requested",
    actorType: "user",
    actorUserId: userId || marketplaceSeller.user,
  }).catch(() => null);
  await notifyAdminsAboutWithdrawal({ withdrawal, eventLabel: "Withdrawal made" });

  const updatedWithdrawal = await initiateWithdrawalTransfer({
    withdrawal,
    owner: marketplaceSeller,
    ownerType: "seller",
    reason: "Tengacion marketplace seller withdrawal",
  });

  return {
    withdrawal: serializeWithdrawal(updatedWithdrawal.toObject?.() || updatedWithdrawal),
    summary: await buildSellerWithdrawalAvailability({
      sellerId: marketplaceSeller._id,
      currency: normalizedCurrency,
    }),
  };
};

const listCreatorWithdrawals = async ({
  userId,
  page = 1,
  limit = DEFAULT_PAGE_LIMIT,
  currency = "NGN",
} = {}) => {
  if (!isValidObjectId(userId)) {
    throw buildHttpError("Creator profile not found", 404);
  }
  const profile = await CreatorProfile.findOne({ userId });
  if (!profile) {
    throw buildHttpError("Creator profile not found", 404);
  }

  const pagination = buildPagination({ page, limit });
  const query = {
    ownerType: "creator",
    ownerId: profile._id,
  };
  const [rows, total, summary] = await Promise.all([
    Withdrawal.find(query)
      .sort({ requestedAt: -1, createdAt: -1, _id: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    Withdrawal.countDocuments(query),
    buildCreatorWithdrawalAvailability({ profile, currency }),
  ]);

  return {
    page: pagination.page,
    limit: pagination.limit,
    total,
    withdrawals: rows.map(serializeWithdrawal),
    summary,
    reserveAmount: MIN_WITHDRAWAL_RESERVE_NGN,
  };
};

const listSellerWithdrawals = async ({
  sellerId,
  page = 1,
  limit = DEFAULT_PAGE_LIMIT,
  currency = "NGN",
} = {}) => {
  if (!isValidObjectId(sellerId)) {
    throw buildHttpError("Marketplace seller profile not found", 404);
  }

  const pagination = buildPagination({ page, limit });
  const query = {
    ownerType: "seller",
    ownerId: sellerId,
  };
  const [rows, total, summary] = await Promise.all([
    Withdrawal.find(query)
      .sort({ requestedAt: -1, createdAt: -1, _id: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    Withdrawal.countDocuments(query),
    buildSellerWithdrawalAvailability({ sellerId, currency }),
  ]);

  return {
    page: pagination.page,
    limit: pagination.limit,
    total,
    withdrawals: rows.map(serializeWithdrawal),
    summary,
    reserveAmount: MIN_WITHDRAWAL_RESERVE_NGN,
  };
};

const findWithdrawalForTransfer = async (transferData = {}) => {
  const reference = String(transferData.reference || "").trim().toLowerCase();
  const transferCode = String(transferData.transfer_code || transferData.transferCode || "").trim();
  const clauses = [];
  if (reference) clauses.push({ reference });
  if (transferCode) clauses.push({ providerTransferCode: transferCode });
  if (!clauses.length) {
    return null;
  }
  return Withdrawal.findOne({ $or: clauses });
};

const handlePaystackTransferWebhookEvent = async ({ event = {} } = {}) => {
  const eventName = String(event?.event || "").trim().toLowerCase();
  if (!eventName.startsWith("transfer.")) {
    return {
      handled: false,
      skipped: true,
      reason: "not_transfer_event",
    };
  }

  const rawData = event?.data || {};
  const withdrawal = await findWithdrawalForTransfer(rawData);
  if (!withdrawal) {
    return {
      handled: false,
      skipped: true,
      reason: "withdrawal_not_found",
    };
  }

  const transfer = normalizeTransferResponse({
    data: {
      ...rawData,
      status: rawData.status || eventName.replace("transfer.", ""),
    },
  });

  if (eventName === "transfer.success") {
    transfer.status = "success";
  } else if (eventName === "transfer.failed") {
    transfer.status = "failed";
  } else if (eventName === "transfer.reversed") {
    transfer.status = "reversed";
  }

  const updatedWithdrawal = await applyTransferStatusToWithdrawal({
    withdrawal,
    transfer,
  });

  return {
    handled: true,
    withdrawal: serializeWithdrawal(updatedWithdrawal.toObject?.() || updatedWithdrawal),
  };
};

const verifyAndSyncWithdrawal = async (reference) => {
  const normalizedReference = String(reference || "").trim().toLowerCase();
  if (!normalizedReference) {
    throw buildHttpError("Withdrawal reference is required", 400);
  }
  const withdrawal = await Withdrawal.findOne({ reference: normalizedReference });
  if (!withdrawal) {
    throw buildHttpError("Withdrawal not found", 404);
  }
  if (FINAL_WITHDRAWAL_STATUSES.includes(withdrawal.status)) {
    return {
      withdrawal: serializeWithdrawal(withdrawal.toObject()),
      verified: false,
      skipped: true,
    };
  }

  const transfer = await verifyTransfer(withdrawal.providerTransferCode || withdrawal.reference);
  const updatedWithdrawal = await applyTransferStatusToWithdrawal({
    withdrawal,
    transfer,
  });
  return {
    withdrawal: serializeWithdrawal(updatedWithdrawal.toObject?.() || updatedWithdrawal),
    verified: true,
  };
};

module.exports = {
  MIN_WITHDRAWAL_RESERVE_NGN,
  OPEN_WITHDRAWAL_STATUSES,
  buildCreatorWithdrawalAvailability,
  buildSellerWithdrawalAvailability,
  createCreatorWithdrawal,
  createSellerWithdrawal,
  handlePaystackTransferWebhookEvent,
  listCreatorWithdrawals,
  listSellerWithdrawals,
  serializeWithdrawal,
  verifyAndSyncWithdrawal,
};
