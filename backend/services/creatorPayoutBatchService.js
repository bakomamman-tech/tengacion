const crypto = require("crypto");
const mongoose = require("mongoose");

const CreatorPayoutBatch = require("../models/CreatorPayoutBatch");
const CreatorPayoutRequest = require("../models/CreatorPayoutRequest");
const {
  buildPayoutReadiness,
} = require("./payoutReadinessService");
const {
  buildCreatorPayoutAvailability,
  serializePayoutRequest,
  updateCreatorPayoutRequestStatus,
} = require("./creatorPayoutRequestService");

const DEFAULT_PAGE_LIMIT = 20;
const MAX_BATCH_SIZE = 100;
const EXPORT_COLUMNS = [
  "batch_reference",
  "request_reference",
  "creator_name",
  "creator_email",
  "amount",
  "currency",
  "bank_name",
  "bank_code",
  "account_name",
  "account_number",
  "country",
  "payout_reference",
];

const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const clampMoney = (value) => Math.max(0, roundMoney(value));

const normalizeCurrency = (value = "NGN") =>
  String(value || "NGN").trim().toUpperCase() || "NGN";

const normalizeText = (value = "", maxLength = 500) =>
  String(value || "").trim().slice(0, maxLength);

const normalizeStatus = (value = "") => String(value || "").trim().toLowerCase();

const toIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  return value.toString();
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(toIdString(value));

const buildHttpError = (message, status = 400, details = {}) =>
  Object.assign(new Error(message), { status, details });

const buildBatchReference = () => {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `CPB_${stamp}_${suffix}`;
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

const dedupeIds = (ids = []) => [...new Set(
  ids.map(toIdString).filter(Boolean)
)];

const getCreatorDisplayName = (profile = {}) =>
  profile?.displayName || profile?.fullName || profile?.userId?.name || "Creator";

const hoursBetween = (start, end) => {
  const startTime = new Date(start || 0).getTime();
  const endTime = new Date(end || 0).getTime();
  if (!startTime || !endTime || Number.isNaN(startTime) || Number.isNaN(endTime) || endTime < startTime) {
    return null;
  }
  return roundMoney((endTime - startTime) / (60 * 60 * 1000));
};

const average = (values = []) => {
  const clean = values.filter((value) => Number.isFinite(Number(value)));
  if (!clean.length) return null;
  return roundMoney(clean.reduce((sum, value) => sum + Number(value), 0) / clean.length);
};

const serializeStatusHistoryEntry = (entry = {}) => ({
  status: entry.status || "",
  at: entry.at || null,
  actorId: toIdString(entry.actorId),
  actorRole: entry.actorRole || "",
  note: entry.note || "",
});

const serializeBatchItem = (item = {}) => ({
  requestId: toIdString(item.requestId),
  requestReference: item.requestReference || "",
  creatorProfileId: toIdString(item.creatorProfile),
  creatorUserId: toIdString(item.creatorUser),
  creatorDisplayName: item.creatorDisplayName || "",
  amount: clampMoney(item.amount),
  currency: normalizeCurrency(item.currency),
  payoutMethod: item.payoutMethod || {},
  validation: item.validation || {},
  statusAtBatch: item.statusAtBatch || "",
  outcomeStatus: item.outcomeStatus || "pending",
  payoutReference: item.payoutReference || "",
  providerResponse: item.providerResponse || {},
  resolvedAt: item.resolvedAt || null,
});

const serializePayoutBatch = (batch = {}) => ({
  id: toIdString(batch._id),
  batchReference: batch.batchReference || "",
  status: batch.status || "ready_for_export",
  provider: batch.provider || "manual_bank_export",
  currency: normalizeCurrency(batch.currency),
  requestIds: Array.isArray(batch.requestIds) ? batch.requestIds.map(toIdString) : [],
  itemCount: Number(batch.itemCount || 0),
  totalAmount: clampMoney(batch.totalAmount),
  note: batch.note || "",
  reviewedBy: toIdString(batch.reviewedBy),
  approvedBy: toIdString(batch.approvedBy),
  processedBy: toIdString(batch.processedBy),
  reconciledBy: toIdString(batch.reconciledBy),
  exportedAt: batch.exportedAt || null,
  reconciledAt: batch.reconciledAt || null,
  providerResponse: batch.providerResponse || {},
  reconciliationSummary: batch.reconciliationSummary || {},
  slaSummary: batch.slaSummary || {},
  items: Array.isArray(batch.itemSnapshots) ? batch.itemSnapshots.map(serializeBatchItem) : [],
  statusHistory: Array.isArray(batch.statusHistory)
    ? batch.statusHistory.map(serializeStatusHistoryEntry)
    : [],
  createdAt: batch.createdAt || null,
  updatedAt: batch.updatedAt || null,
});

const buildPayoutMethodSnapshot = ({ profile, readiness } = {}) => ({
  bankName: readiness?.bankName || profile?.bankName || "",
  bankCode: readiness?.bankCode || profile?.bankCode || "",
  accountName: readiness?.accountName || profile?.accountName || "",
  accountNumberMasked: readiness?.accountNumberMasked || "",
  country: readiness?.country || profile?.country || "",
  countryOfResidence: readiness?.countryOfResidence || profile?.countryOfResidence || "",
  methodFreshness: profile?.updatedAt ? "verified" : "unknown",
  lastProfileUpdateAt: profile?.updatedAt || null,
});

const buildRequestValidation = async (request) => {
  const profile = request.creatorProfile || {};
  const readiness = buildPayoutReadiness(profile);
  const availability = await buildCreatorPayoutAvailability({
    profile,
    currency: request.currency,
    excludeRequestId: request._id,
  });
  const enoughBalance = clampMoney(request.amount) <= clampMoney(availability.availableForRequest);
  const errors = [];

  if (request.status !== "approved") {
    errors.push("request_not_approved");
  }
  if (request.payoutBatch) {
    errors.push("already_batched");
  }
  if (!readiness.ready || !readiness.canRequestPayout) {
    errors.push("payout_readiness_not_ready");
  }
  if (!enoughBalance) {
    errors.push("insufficient_available_balance");
  }

  return {
    ok: errors.length === 0,
    errors,
    readiness,
    availability,
    payoutMethod: buildPayoutMethodSnapshot({ profile, readiness }),
  };
};

const loadRequestsForBatch = async (requestIds = []) => {
  const ids = dedupeIds(requestIds);
  if (!ids.length) {
    throw buildHttpError("Select at least one payout request", 400);
  }
  if (ids.length > MAX_BATCH_SIZE) {
    throw buildHttpError(`Payout batches are limited to ${MAX_BATCH_SIZE} requests`, 400);
  }
  const invalidIds = ids.filter((id) => !isValidObjectId(id));
  if (invalidIds.length) {
    throw buildHttpError("One or more payout request ids are invalid", 400, { invalidIds });
  }

  const rows = await CreatorPayoutRequest.find({ _id: { $in: ids } })
    .populate({
      path: "creatorProfile",
      select: "displayName fullName accountNumber bankName bankCode accountName country countryOfResidence userId status onboardingCompleted onboardingComplete acceptedTerms acceptedCopyrightDeclaration updatedAt",
      populate: {
        path: "userId",
        select: "name username email",
      },
    })
    .populate("creatorUser", "name username email")
    .sort({ requestedAt: 1, createdAt: 1, _id: 1 });

  const found = new Set(rows.map((row) => toIdString(row._id)));
  const missingIds = ids.filter((id) => !found.has(id));
  if (missingIds.length) {
    throw buildHttpError("One or more payout requests were not found", 404, { missingIds });
  }

  return rows;
};

const validateRequestsForBatch = async (requests = []) => {
  const currencies = new Set(requests.map((request) => normalizeCurrency(request.currency)));
  if (currencies.size > 1) {
    throw buildHttpError("Payout batches cannot mix currencies", 400, {
      currencies: [...currencies],
    });
  }

  const itemSnapshots = [];
  const validationErrors = [];

  for (const request of requests) {
    const validation = await buildRequestValidation(request);
    if (!validation.ok) {
      validationErrors.push({
        requestId: toIdString(request._id),
        requestReference: request.requestReference || "",
        errors: validation.errors,
      });
    }

    itemSnapshots.push({
      requestId: request._id,
      requestReference: request.requestReference || "",
      creatorProfile: request.creatorProfile?._id || request.creatorProfile,
      creatorUser: request.creatorUser?._id || request.creatorUser,
      creatorDisplayName: getCreatorDisplayName(request.creatorProfile),
      amount: clampMoney(request.amount),
      currency: normalizeCurrency(request.currency),
      payoutMethod: validation.payoutMethod,
      validation: {
        ok: validation.ok,
        errors: validation.errors,
        readinessStatus: validation.readiness?.status || "",
        availableForRequest: clampMoney(validation.availability?.availableForRequest || 0),
        openRequestAmount: clampMoney(validation.availability?.openRequestAmount || 0),
        walletBacked: Boolean(validation.availability?.walletBacked),
      },
      statusAtBatch: request.status || "",
      outcomeStatus: "pending",
      payoutReference: request.payoutReference || "",
      providerResponse: {},
      resolvedAt: null,
    });
  }

  if (validationErrors.length) {
    throw buildHttpError("One or more payout requests are not batch-ready", 409, {
      validationErrors,
    });
  }

  return itemSnapshots;
};

const appendBatchHistory = ({
  batch,
  status,
  actorId = null,
  actorRole = "",
  note = "",
} = {}) => {
  batch.statusHistory.push({
    status,
    at: new Date(),
    actorId,
    actorRole: normalizeText(actorRole, 60).toLowerCase(),
    note: normalizeText(note, 500),
  });
};

const buildBatchSlaSummary = (requests = []) => {
  const requestedToReviewed = requests.map((request) =>
    hoursBetween(request.requestedAt || request.createdAt, request.reviewedAt)
  );
  const reviewedToPaid = requests
    .filter((request) => request.status === "paid")
    .map((request) => hoursBetween(request.reviewedAt || request.requestedAt, request.paidAt));
  const failedToResolved = requests
    .filter((request) => request.failedAt && request.status === "paid")
    .map((request) => hoursBetween(request.failedAt, request.paidAt));

  return {
    avgRequestedToReviewedHours: average(requestedToReviewed),
    avgReviewedToPaidHours: average(reviewedToPaid),
    avgFailedToResolvedHours: average(failedToResolved),
    paidAfterFailureCount: requests.filter((request) => request.failedAt && request.status === "paid").length,
    openFailureCount: requests.filter((request) => request.status === "failed").length,
  };
};

const refreshBatchOutcomeSummary = async (batch) => {
  const requests = await CreatorPayoutRequest.find({ _id: { $in: batch.requestIds } }).lean();
  const requestById = new Map(requests.map((request) => [toIdString(request._id), request]));
  const now = new Date();

  batch.itemSnapshots.forEach((item) => {
    const request = requestById.get(toIdString(item.requestId));
    if (!request) return;
    if (["paid", "failed"].includes(request.status)) {
      item.outcomeStatus = request.status;
      item.resolvedAt = request.status === "paid"
        ? request.paidAt || item.resolvedAt || now
        : request.failedAt || item.resolvedAt || now;
      item.payoutReference = request.payoutReference || item.payoutReference || "";
    } else {
      item.outcomeStatus = "pending";
    }
  });

  const counts = batch.itemSnapshots.reduce((acc, item) => {
    const outcome = item.outcomeStatus || "pending";
    acc[`${outcome}Count`] = Number(acc[`${outcome}Count`] || 0) + 1;
    acc[`${outcome}Amount`] = clampMoney(Number(acc[`${outcome}Amount`] || 0) + Number(item.amount || 0));
    return acc;
  }, {
    paidCount: 0,
    failedCount: 0,
    pendingCount: 0,
    paidAmount: 0,
    failedAmount: 0,
    pendingAmount: 0,
  });

  batch.reconciliationSummary = {
    ...counts,
    itemCount: Number(batch.itemSnapshots.length || 0),
    totalAmount: clampMoney(batch.totalAmount),
  };
  batch.slaSummary = buildBatchSlaSummary(requests);

  if (counts.pendingCount === 0 && counts.paidCount === batch.itemSnapshots.length) {
    batch.status = "paid";
  } else if (counts.pendingCount === 0 && counts.failedCount === batch.itemSnapshots.length) {
    batch.status = "failed";
  } else if (counts.paidCount || counts.failedCount) {
    batch.status = "partially_paid";
  }

  if (["paid", "partially_paid", "failed"].includes(batch.status)) {
    batch.reconciledAt = batch.reconciledAt || now;
  }

  return batch;
};

const createCreatorPayoutBatch = async ({
  requestIds = [],
  adminUserId,
  adminRole = "admin",
  note = "",
  provider = "manual_bank_export",
} = {}) => {
  const requests = await loadRequestsForBatch(requestIds);
  const itemSnapshots = await validateRequestsForBatch(requests);
  const normalizedCurrency = normalizeCurrency(requests[0]?.currency);
  const batchReference = buildBatchReference();
  const now = new Date();

  const batch = await CreatorPayoutBatch.create({
    batchReference,
    status: "ready_for_export",
    provider: normalizeText(provider || "manual_bank_export", 60).toLowerCase(),
    currency: normalizedCurrency,
    requestIds: requests.map((request) => request._id),
    itemSnapshots,
    note: normalizeText(note, 800),
    reviewedBy: adminUserId || null,
    approvedBy: adminUserId || null,
    statusHistory: [
      {
        status: "ready_for_export",
        at: now,
        actorId: adminUserId || null,
        actorRole: normalizeText(adminRole, 60).toLowerCase(),
        note: normalizeText(note || "Batch created from approved payout requests", 500),
      },
    ],
  });

  await CreatorPayoutRequest.updateMany(
    { _id: { $in: requests.map((request) => request._id) } },
    {
      $set: {
        payoutBatch: batch._id,
        payoutBatchReference: batch.batchReference,
        batchedAt: now,
      },
    }
  );

  const hydrated = await CreatorPayoutBatch.findById(batch._id).lean();
  return {
    batch: serializePayoutBatch(hydrated),
  };
};

const listCreatorPayoutBatches = async ({
  status = "",
  page = 1,
  limit = DEFAULT_PAGE_LIMIT,
} = {}) => {
  const pagination = buildPagination({ page, limit });
  const normalizedStatus = normalizeStatus(status);
  const query = CreatorPayoutBatch.CREATOR_PAYOUT_BATCH_STATUSES?.includes(normalizedStatus)
    ? { status: normalizedStatus }
    : {};

  const [rows, total, statusRows] = await Promise.all([
    CreatorPayoutBatch.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    CreatorPayoutBatch.countDocuments(query),
    CreatorPayoutBatch.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$totalAmount" } } },
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
      statusCounts,
      statusAmounts,
    },
    batches: rows.map(serializePayoutBatch),
  };
};

const buildProviderRows = async (batch) => {
  const requests = await CreatorPayoutRequest.find({ _id: { $in: batch.requestIds } })
    .populate({
      path: "creatorProfile",
      select: "displayName fullName accountNumber bankName bankCode accountName country countryOfResidence userId",
      populate: {
        path: "userId",
        select: "name username email",
      },
    })
    .populate("creatorUser", "name username email")
    .lean();
  const requestById = new Map(requests.map((request) => [toIdString(request._id), request]));

  return batch.requestIds.map((requestId) => {
    const request = requestById.get(toIdString(requestId)) || {};
    const profile = request.creatorProfile || {};
    const creatorUser = request.creatorUser || profile.userId || {};
    const readiness = buildPayoutReadiness(profile);
    return {
      batchReference: batch.batchReference,
      requestId: toIdString(request._id),
      requestReference: request.requestReference || "",
      creatorName: getCreatorDisplayName(profile),
      creatorEmail: creatorUser.email || "",
      amount: clampMoney(request.amount),
      currency: normalizeCurrency(request.currency || batch.currency),
      bankName: profile.bankName || "",
      bankCode: profile.bankCode || "",
      accountName: profile.accountName || "",
      accountNumber: profile.accountNumber || "",
      accountNumberMasked: readiness.accountNumberMasked || "",
      country: profile.countryOfResidence || profile.country || "",
      payoutReference: request.payoutReference || "",
    };
  });
};

const escapeCsvValue = (value) => {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, "\"\"")}"`;
};

const buildProviderCsv = (rows = []) => [
  EXPORT_COLUMNS.join(","),
  ...rows.map((row) => EXPORT_COLUMNS.map((column) => {
    const camelKey = column.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase());
    return escapeCsvValue(row[camelKey]);
  }).join(",")),
].join("\n");

const exportCreatorPayoutBatch = async ({
  batchId,
  adminUserId,
  adminRole = "admin",
  note = "",
  providerResponse = {},
} = {}) => {
  if (!isValidObjectId(batchId)) {
    throw buildHttpError("Invalid payout batch id", 400);
  }

  const batch = await CreatorPayoutBatch.findById(batchId);
  if (!batch) {
    throw buildHttpError("Payout batch not found", 404);
  }
  if (["paid", "partially_paid", "failed", "cancelled"].includes(batch.status)) {
    throw buildHttpError("Finalized payout batches cannot be exported again", 409);
  }

  const requests = await CreatorPayoutRequest.find({ _id: { $in: batch.requestIds } });
  const invalidStatuses = requests
    .filter((request) => !["approved", "processing"].includes(request.status))
    .map((request) => ({
      requestId: toIdString(request._id),
      status: request.status,
    }));
  if (invalidStatuses.length) {
    throw buildHttpError("Only approved or processing requests can be exported", 409, {
      invalidStatuses,
    });
  }

  for (const request of requests) {
    if (request.status === "approved") {
      await updateCreatorPayoutRequestStatus({
        requestId: request._id,
        status: "processing",
        adminUserId,
        adminRole,
        adminNote: note || `Exported in payout batch ${batch.batchReference}`,
      });
    }
  }

  batch.status = "exported";
  batch.processedBy = adminUserId || null;
  batch.exportedAt = batch.exportedAt || new Date();
  batch.providerResponse = providerResponse && typeof providerResponse === "object"
    ? providerResponse
    : {};
  appendBatchHistory({
    batch,
    status: "exported",
    actorId: adminUserId || null,
    actorRole: adminRole,
    note: note || "Provider-ready payout batch exported",
  });
  await refreshBatchOutcomeSummary(batch);
  await batch.save();

  const providerRows = await buildProviderRows(batch.toObject());
  return {
    batch: serializePayoutBatch(batch.toObject()),
    providerExport: {
      filename: `${batch.batchReference}.csv`,
      columns: EXPORT_COLUMNS,
      rows: providerRows,
      csv: buildProviderCsv(providerRows),
    },
  };
};

const normalizeOutcomeStatus = (status = "") => {
  const normalized = normalizeStatus(status);
  return ["paid", "failed"].includes(normalized) ? normalized : "";
};

const reconcileCreatorPayoutBatch = async ({
  batchId,
  outcomes = [],
  adminUserId,
  adminRole = "admin",
  note = "",
  providerResponse = {},
} = {}) => {
  if (!isValidObjectId(batchId)) {
    throw buildHttpError("Invalid payout batch id", 400);
  }
  if (!Array.isArray(outcomes) || !outcomes.length) {
    throw buildHttpError("Add at least one payout outcome", 400);
  }

  const batch = await CreatorPayoutBatch.findById(batchId);
  if (!batch) {
    throw buildHttpError("Payout batch not found", 404);
  }
  if (batch.status === "cancelled") {
    throw buildHttpError("Cancelled payout batches cannot be reconciled", 409);
  }

  const batchRequestIds = new Set((batch.requestIds || []).map(toIdString));
  const normalizedOutcomes = outcomes.map((outcome) => ({
    requestId: toIdString(outcome?.requestId),
    status: normalizeOutcomeStatus(outcome?.status),
    payoutReference: normalizeText(outcome?.payoutReference || "", 160),
    adminNote: normalizeText(outcome?.adminNote || note || "", 800),
    creatorMessage: normalizeText(outcome?.creatorMessage || "", 800),
    providerResponse: outcome?.providerResponse && typeof outcome.providerResponse === "object"
      ? outcome.providerResponse
      : {},
  }));

  const invalidOutcomes = normalizedOutcomes.filter((outcome) =>
    !isValidObjectId(outcome.requestId)
      || !batchRequestIds.has(outcome.requestId)
      || !outcome.status
  );
  if (invalidOutcomes.length) {
    throw buildHttpError("One or more payout outcomes are invalid", 400, {
      invalidOutcomes,
    });
  }

  const results = [];
  for (const outcome of normalizedOutcomes) {
    const request = await CreatorPayoutRequest.findById(outcome.requestId);
    if (!request) {
      throw buildHttpError("Payout request not found for reconciliation", 404, {
        requestId: outcome.requestId,
      });
    }
    if (request.status === "paid" && outcome.status === "paid") {
      results.push({
        request: serializePayoutRequest(request.toObject()),
        previousStatus: "paid",
        skipped: true,
      });
    } else {
      if (!["processing", "paid"].includes(request.status)) {
        await updateCreatorPayoutRequestStatus({
          requestId: request._id,
          status: "processing",
          adminUserId,
          adminRole,
          adminNote: outcome.adminNote || `Batch ${batch.batchReference} reconciliation started`,
        });
      }

      results.push(await updateCreatorPayoutRequestStatus({
        requestId: request._id,
        status: outcome.status,
        adminUserId,
        adminRole,
        adminNote: outcome.adminNote || `Batch ${batch.batchReference} ${outcome.status}`,
        creatorMessage: outcome.creatorMessage,
        payoutReference: outcome.payoutReference || request.payoutReference || `${batch.batchReference}-${request.requestReference || outcome.requestId}`,
      }));
    }

    const item = batch.itemSnapshots.find((entry) => toIdString(entry.requestId) === outcome.requestId);
    if (item) {
      item.outcomeStatus = outcome.status;
      item.payoutReference = outcome.payoutReference || item.payoutReference || "";
      item.providerResponse = outcome.providerResponse;
      item.resolvedAt = new Date();
    }
  }

  batch.providerResponse = providerResponse && typeof providerResponse === "object"
    ? providerResponse
    : batch.providerResponse || {};
  batch.reconciledBy = adminUserId || null;
  batch.reconciledAt = new Date();
  await refreshBatchOutcomeSummary(batch);
  appendBatchHistory({
    batch,
    status: batch.status,
    actorId: adminUserId || null,
    actorRole: adminRole,
    note: note || "Payout batch reconciled",
  });
  await batch.save();

  return {
    batch: serializePayoutBatch(batch.toObject()),
    results,
  };
};

module.exports = {
  MAX_BATCH_SIZE,
  createCreatorPayoutBatch,
  exportCreatorPayoutBatch,
  listCreatorPayoutBatches,
  reconcileCreatorPayoutBatch,
  serializePayoutBatch,
};
