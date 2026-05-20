const crypto = require("crypto");
const mongoose = require("mongoose");

const CreatorPayoutRequest = require("../models/CreatorPayoutRequest");
const CreatorProfile = require("../models/CreatorProfile");
const WalletEntry = require("../models/WalletEntry");
const {
  buildPayoutReadiness,
} = require("./payoutReadinessService");
const {
  buildCreatorWalletSnapshot,
  ensureCreatorWalletAccount,
} = require("./walletService");
const {
  recordRevenueLedgerEntry,
} = require("./revenueLedgerService");

const OPEN_PAYOUT_STATUSES = [
  "pending_review",
  "needs_creator_action",
  "approved",
  "processing",
];
const FINAL_PAYOUT_STATUSES = ["paid", "failed", "rejected"];
const MIN_CREATOR_PAYOUT_AMOUNT = 1000;
const DEFAULT_PAGE_LIMIT = 20;

const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const clampMoney = (value) => Math.max(0, roundMoney(value));
const normalizeCurrency = (value = "NGN") =>
  String(value || "NGN").trim().toUpperCase() || "NGN";

const normalizeText = (value = "", maxLength = 500) =>
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

const normalizeStatus = (value = "") => String(value || "").trim().toLowerCase();

const getCreatorDisplayName = (profile = {}) =>
  profile?.displayName || profile?.fullName || profile?.userId?.name || "Creator";

const buildRequestReference = () => {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `CPR_${stamp}_${suffix}`;
};

const buildPagination = ({ page = 1, limit = DEFAULT_PAGE_LIMIT } = {}) => {
  const safePage = Math.max(1, Number(page || 1));
  const safeLimit = Math.min(100, Math.max(1, Number(limit || DEFAULT_PAGE_LIMIT)));
  return {
    page: safePage,
    limit: safeLimit,
    skip: (safePage - 1) * safeLimit,
  };
};

const serializeStatusHistoryEntry = (entry = {}) => ({
  status: entry.status || "",
  at: entry.at || null,
  actorId: toIdString(entry.actorId),
  actorRole: entry.actorRole || "",
  note: entry.note || "",
  creatorMessage: entry.creatorMessage || "",
  payoutReference: entry.payoutReference || "",
  attemptCount: Number(entry.attemptCount || 0),
});

const serializePayoutRequest = (request = {}) => {
  const creatorProfile = request.creatorProfile || {};
  const creatorUser = request.creatorUser || creatorProfile.userId || {};

  return {
    id: toIdString(request._id),
    creatorProfileId: toIdString(creatorProfile._id || request.creatorProfile),
    creatorUserId: toIdString(creatorUser._id || request.creatorUser),
    creatorDisplayName: getCreatorDisplayName(creatorProfile),
    creatorUsername: creatorUser.username || "",
    creatorEmail: creatorUser.email || "",
    amount: clampMoney(request.amount),
    currency: normalizeCurrency(request.currency),
    status: request.status || "pending_review",
    requestReference: request.requestReference || "",
    payoutReference: request.payoutReference || "",
    creatorNote: request.creatorNote || "",
    adminNote: request.adminNote || "",
    creatorVisibleMessage: request.creatorVisibleMessage || "",
    requestedAt: request.requestedAt || request.createdAt || null,
    reviewedAt: request.reviewedAt || null,
    paidAt: request.paidAt || null,
    failedAt: request.failedAt || null,
    attemptCount: Number(request.attemptCount || 0),
    balanceSnapshot: request.balanceSnapshot || {},
    readinessSnapshot: request.readinessSnapshot || {},
    statusHistory: Array.isArray(request.statusHistory)
      ? request.statusHistory.map(serializeStatusHistoryEntry)
      : [],
    createdAt: request.createdAt || null,
    updatedAt: request.updatedAt || null,
  };
};

const findCreatorProfileForUser = async (userId) => {
  if (!isValidObjectId(userId)) {
    throw buildHttpError("Creator profile not found", 404);
  }

  const profile = await CreatorProfile.findOne({ userId });
  if (!profile) {
    throw buildHttpError("Creator profile not found", 404);
  }
  return profile;
};

const getOpenRequestAmount = async ({ creatorProfileId, currency = "NGN", excludeRequestId = null } = {}) => {
  if (!creatorProfileId) {
    return 0;
  }

  const match = {
    creatorProfile: new mongoose.Types.ObjectId(toIdString(creatorProfileId)),
    currency: normalizeCurrency(currency),
    status: { $in: OPEN_PAYOUT_STATUSES },
  };

  if (excludeRequestId && isValidObjectId(excludeRequestId)) {
    match._id = { $ne: new mongoose.Types.ObjectId(toIdString(excludeRequestId)) };
  }

  const [row] = await CreatorPayoutRequest.aggregate([
    { $match: match },
    { $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);

  return {
    amount: clampMoney(row?.amount || 0),
    count: Number(row?.count || 0),
  };
};

const buildCreatorPayoutAvailability = async ({ profile, currency = "NGN", excludeRequestId = null } = {}) => {
  const normalizedCurrency = normalizeCurrency(currency);
  const [wallet, openRequests] = await Promise.all([
    buildCreatorWalletSnapshot({
      creatorId: profile?._id,
      currency: normalizedCurrency,
      recentLimit: 5,
    }),
    getOpenRequestAmount({
      creatorProfileId: profile?._id,
      currency: normalizedCurrency,
      excludeRequestId,
    }),
  ]);
  const availableBalance = clampMoney(wallet?.summary?.availableBalance || 0);
  const openRequestAmount = clampMoney(openRequests.amount || 0);

  return {
    currency: normalizedCurrency,
    walletBacked: Boolean(wallet?.walletBacked),
    totalEarnings: clampMoney(wallet?.summary?.totalEarnings || 0),
    availableBalance,
    withdrawn: clampMoney(wallet?.summary?.withdrawn || 0),
    openRequestAmount,
    openRequestCount: Number(openRequests.count || 0),
    availableForRequest: clampMoney(availableBalance - openRequestAmount),
  };
};

const recordCreatorPayoutLedger = async ({
  request,
  ledgerEventType,
  actorType = "system",
  actorUserId = null,
  actorRole = "",
  dedupeSuffix = "",
  reason = "",
} = {}) => {
  if (!request?._id || !ledgerEventType) {
    return { createdCount: 0, skipped: true };
  }

  const requestId = toIdString(request._id);
  const direction = ledgerEventType === "payout_sent" ? "debit" : "none";
  const balanceScope = direction === "debit" ? "available" : "none";
  const result = await recordRevenueLedgerEntry({
    ledgerEventType,
    accountType: "creator",
    accountId: request.creatorProfile,
    currency: request.currency,
    amount: clampMoney(request.amount),
    direction,
    balanceScope,
    actorType,
    actorId: actorUserId || null,
    actorRole,
    sourceType: "creator_payout",
    sourceId: request._id,
    sourceRef: request.requestReference || "",
    providerReference: request.payoutReference || request.requestReference || "",
    dedupeKey: `creator_${ledgerEventType}:${requestId}${dedupeSuffix ? `:${dedupeSuffix}` : ""}`,
    occurredAt: ledgerEventType === "payout_sent" ? request.paidAt || new Date() : new Date(),
    auditMetadata: {
      creatorProfileId: toIdString(request.creatorProfile),
      creatorUserId: toIdString(request.creatorUser),
      requestId,
      requestReference: request.requestReference || "",
      payoutReference: request.payoutReference || "",
      status: request.status || "",
      attemptCount: Number(request.attemptCount || 0),
      reason: normalizeText(reason, 240),
    },
  });

  return {
    createdCount: result.created ? 1 : 0,
    skipped: false,
  };
};

const appendStatusHistory = ({
  request,
  status,
  actorId = null,
  actorRole = "",
  note = "",
  creatorMessage = "",
  payoutReference = "",
} = {}) => {
  request.statusHistory.push({
    status,
    at: new Date(),
    actorId,
    actorRole,
    note: normalizeText(note, 500),
    creatorMessage: normalizeText(creatorMessage, 500),
    payoutReference,
    attemptCount: Number(request.attemptCount || 0),
  });
};

const createPayoutDebitEntry = async ({ request, actorUserId = null, actorRole = "" } = {}) => {
  const wallet = await ensureCreatorWalletAccount(request.creatorProfile, request.currency);
  const requestId = toIdString(request._id);
  const result = await WalletEntry.updateOne(
    { dedupeKey: `creator_payout_debit:${requestId}` },
    {
      $setOnInsert: {
        walletAccountId: wallet._id,
        ownerType: "creator",
        ownerId: request.creatorProfile,
        currency: normalizeCurrency(request.currency),
        direction: "debit",
        bucket: "available",
        entryType: "payout_debit",
        amount: clampMoney(request.amount),
        grossAmount: clampMoney(request.amount),
        sourceType: "payout",
        sourceId: request._id,
        sourceRef: request.payoutReference || request.requestReference || "",
        dedupeKey: `creator_payout_debit:${requestId}`,
        effectiveAt: request.paidAt || new Date(),
        metadata: {
          creatorProfileId: toIdString(request.creatorProfile),
          creatorUserId: toIdString(request.creatorUser),
          payoutRequestId: requestId,
          requestReference: request.requestReference || "",
          payoutReference: request.payoutReference || "",
          actorUserId: toIdString(actorUserId),
          actorRole: normalizeText(actorRole, 60).toLowerCase(),
          attemptCount: Number(request.attemptCount || 0),
        },
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  return {
    created: Boolean(result?.upsertedCount),
  };
};

const createCreatorPayoutRequest = async ({
  userId,
  amount,
  currency = "NGN",
  creatorNote = "",
} = {}) => {
  const profile = await findCreatorProfileForUser(userId);
  const readiness = buildPayoutReadiness(profile);
  if (!readiness.ready || !readiness.canRequestPayout) {
    throw buildHttpError("Complete payout readiness before requesting a payout", 400, {
      readiness,
    });
  }

  const normalizedCurrency = normalizeCurrency(currency);
  const requestedAmount = clampMoney(amount);
  if (requestedAmount < MIN_CREATOR_PAYOUT_AMOUNT) {
    throw buildHttpError(
      `Minimum payout request is ${MIN_CREATOR_PAYOUT_AMOUNT} ${normalizedCurrency}`,
      400,
      { minimumAmount: MIN_CREATOR_PAYOUT_AMOUNT }
    );
  }

  const availability = await buildCreatorPayoutAvailability({
    profile,
    currency: normalizedCurrency,
  });
  if (requestedAmount > availability.availableForRequest) {
    throw buildHttpError("Requested amount exceeds available payout balance", 400, {
      availability,
    });
  }

  const request = await CreatorPayoutRequest.create({
    creatorProfile: profile._id,
    creatorUser: profile.userId,
    amount: requestedAmount,
    currency: normalizedCurrency,
    status: "pending_review",
    requestReference: buildRequestReference(),
    creatorNote: normalizeText(creatorNote, 500),
    requestedAt: new Date(),
    balanceSnapshot: availability,
    readinessSnapshot: readiness,
    statusHistory: [
      {
        status: "pending_review",
        at: new Date(),
        actorId: profile.userId,
        actorRole: "creator",
        note: "Creator requested payout review",
        creatorMessage: "",
        payoutReference: "",
        attemptCount: 0,
      },
    ],
  });

  await recordCreatorPayoutLedger({
    request,
    ledgerEventType: "payout_requested",
    actorType: "user",
    actorUserId: profile.userId,
    actorRole: "creator",
    reason: "creator_request",
  }).catch(() => null);

  return {
    request: serializePayoutRequest(request.toObject()),
    summary: await buildCreatorPayoutAvailability({
      profile,
      currency: normalizedCurrency,
    }),
  };
};

const listCreatorPayoutRequests = async ({
  userId,
  page = 1,
  limit = DEFAULT_PAGE_LIMIT,
} = {}) => {
  const profile = await findCreatorProfileForUser(userId);
  const pagination = buildPagination({ page, limit });

  const [rows, total, summary] = await Promise.all([
    CreatorPayoutRequest.find({ creatorProfile: profile._id })
      .sort({ requestedAt: -1, createdAt: -1, _id: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    CreatorPayoutRequest.countDocuments({ creatorProfile: profile._id }),
    buildCreatorPayoutAvailability({ profile }),
  ]);

  return {
    page: pagination.page,
    limit: pagination.limit,
    total,
    summary,
    requests: rows.map(serializePayoutRequest),
  };
};

const listAdminCreatorPayoutRequests = async ({
  status = "",
  page = 1,
  limit = DEFAULT_PAGE_LIMIT,
} = {}) => {
  const pagination = buildPagination({ page, limit });
  const normalizedStatus = normalizeStatus(status);
  const query = CreatorPayoutRequest.CREATOR_PAYOUT_REQUEST_STATUSES?.includes(normalizedStatus)
    ? { status: normalizedStatus }
    : {};

  const [rows, total, statusRows, amountRows] = await Promise.all([
    CreatorPayoutRequest.find(query)
      .sort({ requestedAt: -1, createdAt: -1, _id: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate({
        path: "creatorProfile",
        select: "displayName fullName accountNumber country countryOfResidence userId status",
        populate: {
          path: "userId",
          select: "name username email",
        },
      })
      .populate("creatorUser", "name username email")
      .lean(),
    CreatorPayoutRequest.countDocuments(query),
    CreatorPayoutRequest.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$amount" } } },
    ]),
    CreatorPayoutRequest.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          requestedAmount: { $sum: "$amount" },
          paidAmount: {
            $sum: {
              $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0],
            },
          },
          openAmount: {
            $sum: {
              $cond: [{ $in: ["$status", OPEN_PAYOUT_STATUSES] }, "$amount", 0],
            },
          },
        },
      },
    ]),
  ]);

  const statusCounts = {};
  const statusAmounts = {};
  statusRows.forEach((row) => {
    statusCounts[row._id || "unknown"] = Number(row.count || 0);
    statusAmounts[row._id || "unknown"] = clampMoney(row.amount || 0);
  });

  return {
    page: pagination.page,
    limit: pagination.limit,
    total,
    summary: {
      requestedAmount: clampMoney(amountRows[0]?.requestedAmount || 0),
      paidAmount: clampMoney(amountRows[0]?.paidAmount || 0),
      openAmount: clampMoney(amountRows[0]?.openAmount || 0),
      statusCounts,
      statusAmounts,
    },
    requests: rows.map(serializePayoutRequest),
  };
};

const updateCreatorPayoutRequestStatus = async ({
  requestId,
  status,
  adminUserId,
  adminRole = "admin",
  adminNote = "",
  creatorMessage = "",
  payoutReference = "",
} = {}) => {
  const normalizedStatus = normalizeStatus(status);
  if (!CreatorPayoutRequest.CREATOR_PAYOUT_REQUEST_STATUSES.includes(normalizedStatus)) {
    throw buildHttpError("Unsupported payout request status", 400);
  }
  if (!isValidObjectId(requestId)) {
    throw buildHttpError("Invalid payout request id", 400);
  }

  const request = await CreatorPayoutRequest.findById(requestId);
  if (!request) {
    throw buildHttpError("Payout request not found", 404);
  }
  if (request.status === "paid" && normalizedStatus !== "paid") {
    throw buildHttpError("Paid payout requests cannot be moved back", 409);
  }

  const previousStatus = request.status;
  const note = normalizeText(adminNote, 800);
  const message = normalizeText(creatorMessage, 800);
  const nextPayoutReference = normalizeText(payoutReference || request.payoutReference, 160);
  let walletEntryCreated = false;
  let revenueLedgerCreatedCount = 0;
  let processingAttemptIncremented = false;
  const now = new Date();

  if (normalizedStatus === "processing" && previousStatus !== "processing") {
    request.attemptCount = Number(request.attemptCount || 0) + 1;
    processingAttemptIncremented = true;
  }

  if (normalizedStatus === "paid" && previousStatus !== "paid") {
    const profile = await CreatorProfile.findById(request.creatorProfile);
    const availability = await buildCreatorPayoutAvailability({
      profile,
      currency: request.currency,
      excludeRequestId: request._id,
    });
    if (request.amount > availability.availableForRequest) {
      throw buildHttpError("Payout request no longer has enough available balance", 409, {
        availability,
      });
    }

    request.paidAt = now;
    request.payoutReference = nextPayoutReference || request.requestReference;
    const walletResult = await createPayoutDebitEntry({
      request,
      actorUserId: adminUserId,
      actorRole: adminRole,
    });
    walletEntryCreated = Boolean(walletResult.created);
    const ledgerResult = await recordCreatorPayoutLedger({
      request,
      ledgerEventType: "payout_sent",
      actorType: "admin",
      actorUserId: adminUserId,
      actorRole: adminRole,
      reason: note || "admin_paid",
    }).catch(() => ({ createdCount: 0 }));
    revenueLedgerCreatedCount += Number(ledgerResult.createdCount || 0);
  }

  if (normalizedStatus === "approved" && previousStatus !== "approved") {
    const ledgerResult = await recordCreatorPayoutLedger({
      request,
      ledgerEventType: "payout_approved",
      actorType: "admin",
      actorUserId: adminUserId,
      actorRole: adminRole,
      reason: note || "admin_approved",
    }).catch(() => ({ createdCount: 0 }));
    revenueLedgerCreatedCount += Number(ledgerResult.createdCount || 0);
  }

  if (normalizedStatus === "failed" && previousStatus !== "failed") {
    request.failedAt = now;
    const attempt = Number(request.attemptCount || 0) || 1;
    const ledgerResult = await recordCreatorPayoutLedger({
      request,
      ledgerEventType: "payout_failed",
      actorType: "admin",
      actorUserId: adminUserId,
      actorRole: adminRole,
      dedupeSuffix: `attempt_${attempt}`,
      reason: note || "admin_failed",
    }).catch(() => ({ createdCount: 0 }));
    revenueLedgerCreatedCount += Number(ledgerResult.createdCount || 0);
  }

  request.status = normalizedStatus;
  request.reviewedAt = now;
  request.reviewedBy = adminUserId || null;
  if (note) {
    request.adminNote = note;
  }
  if (message) {
    request.creatorVisibleMessage = message;
  }
  if (nextPayoutReference) {
    request.payoutReference = nextPayoutReference;
  }
  appendStatusHistory({
    request,
    status: normalizedStatus,
    actorId: adminUserId || null,
    actorRole: adminRole,
    note: note || (processingAttemptIncremented ? "Payout attempt started" : ""),
    creatorMessage: message,
    payoutReference: request.payoutReference || "",
  });

  await request.save();

  return {
    request: serializePayoutRequest(request.toObject()),
    previousStatus,
    walletEntryCreated,
    revenueLedgerCreatedCount,
  };
};

module.exports = {
  OPEN_PAYOUT_STATUSES,
  FINAL_PAYOUT_STATUSES,
  MIN_CREATOR_PAYOUT_AMOUNT,
  buildCreatorPayoutAvailability,
  createCreatorPayoutRequest,
  listCreatorPayoutRequests,
  listAdminCreatorPayoutRequests,
  updateCreatorPayoutRequestStatus,
  serializePayoutRequest,
};
