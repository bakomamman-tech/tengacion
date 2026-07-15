const mongoose = require("mongoose");
const CreatorProfile = require("../models/CreatorProfile");
const Purchase = require("../models/Purchase");
const WalletAccount = require("../models/WalletAccount");
const WalletEntry = require("../models/WalletEntry");
const { config } = require("../config/env");
const {
  recordPurchaseSettlementLedgerEntries,
  recordRefundSettledLedgerEntries,
  recordDisputeOpenedLedgerEntries,
  recordDisputeReleasedLedgerEntries,
  recordChargebackSettledLedgerEntries,
} = require("./revenueLedgerService");
const {
  computePurchaseRevenueShare,
} = require("./creatorRevenueSharePolicy");

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
  dispute_hold: "Dispute reserve",
  dispute_release: "Dispute reserve released",
  chargeback_debit: "Chargeback",
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

const computePurchaseDisputeAllocation = ({
  purchase,
  lossAmount = 0,
  priorLossAmount = 0,
} = {}) => {
  const original = computePurchaseRevenueShare(purchase || {});
  const shareBaseAmount = clampMoney(original.shareBaseAmount);
  const normalizedPriorLoss = Math.min(shareBaseAmount, clampMoney(priorLossAmount));
  const requestedLossAmount = clampMoney(lossAmount);
  const beforeBaseAmount = clampMoney(shareBaseAmount - normalizedPriorLoss);
  const deductibleLossAmount = Math.min(beforeBaseAmount, requestedLossAmount);
  const afterBaseAmount = clampMoney(beforeBaseAmount - deductibleLossAmount);

  // Re-run the stored policy against each remaining share base. This preserves
  // the policy-specific rounding rule and makes each debit the exact delta
  // between the pre- and post-dispute allocations.
  const beforeShare = computePurchaseRevenueShare({
    ...(purchase?.toObject ? purchase.toObject() : purchase || {}),
    amount: beforeBaseAmount,
    processingFeeAmount: 0,
    taxAmount: 0,
  });
  const afterShare = computePurchaseRevenueShare({
    ...(purchase?.toObject ? purchase.toObject() : purchase || {}),
    amount: afterBaseAmount,
    processingFeeAmount: 0,
    taxAmount: 0,
  });
  const creatorDebitAmount = clampMoney(
    beforeShare.creatorAmount - afterShare.creatorAmount
  );
  const platformDebitAmount = clampMoney(
    beforeShare.platformAmount - afterShare.platformAmount
  );

  return {
    shareBaseAmount,
    requestedLossAmount,
    priorLossAmount: normalizedPriorLoss,
    cumulativeLossAmount: clampMoney(normalizedPriorLoss + deductibleLossAmount),
    beforeBaseAmount,
    afterBaseAmount,
    deductibleLossAmount: clampMoney(creatorDebitAmount + platformDebitAmount),
    creatorDebitAmount,
    platformDebitAmount,
    unallocatedLossAmount: clampMoney(requestedLossAmount - deductibleLossAmount),
  };
};

const normalizeCurrency = (value = "NGN") => String(value || "NGN").trim().toUpperCase() || "NGN";

const getPlatformSettlementAccount = () => ({
  accountName: String(
    process.env.PLATFORM_SETTLEMENT_ACCOUNT_NAME ||
      config.platformSettlementAccount?.accountName ||
      config.PLATFORM_SETTLEMENT_ACCOUNT_NAME ||
      ""
  ).trim(),
  bankName: String(
    process.env.PLATFORM_SETTLEMENT_BANK_NAME ||
      config.platformSettlementAccount?.bankName ||
      config.PLATFORM_SETTLEMENT_BANK_NAME ||
      ""
  ).trim(),
  accountNumber: String(
    process.env.PLATFORM_SETTLEMENT_ACCOUNT_NUMBER ||
      config.platformSettlementAccount?.accountNumber ||
      config.PLATFORM_SETTLEMENT_ACCOUNT_NUMBER ||
      ""
  ).trim(),
});

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
    const settlement = getPlatformSettlementAccount();
    const holder = settlement.accountName || "Tengacion platform";
    const bank = settlement.bankName ? ` - ${settlement.bankName}` : "";
    return `${holder}${bank} platform wallet (${normalizedCurrency})`;
  }
  return `Creator wallet ${toIdString(ownerId)} (${normalizedCurrency})`;
};

const ensureWalletAccount = async ({ ownerType, ownerId = null, currency = "NGN", label = "" } = {}) => {
  const normalizedCurrency = normalizeCurrency(currency);
  const slug =
    ownerType === "platform"
      ? getPlatformWalletSlug(normalizedCurrency)
      : getCreatorWalletSlug(ownerId, normalizedCurrency);

  const update = {
    $setOnInsert: {
      slug,
      ownerType,
      ownerId: ownerType === "platform" ? null : ownerId || null,
      currency: normalizedCurrency,
      status: "active",
    },
  };

  if (ownerType === "platform") {
    update.$set = {
      label: label || buildWalletLabel({ ownerType, ownerId, currency: normalizedCurrency }),
      settlementAccount: getPlatformSettlementAccount(),
    };
  } else {
    update.$setOnInsert.label =
      label || buildWalletLabel({ ownerType, ownerId, currency: normalizedCurrency });
  }

  const account = await WalletAccount.findOneAndUpdate(
    { slug },
    update,
    {
      returnDocument: "after",
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

const buildAvailableOnlySummary = ({
  grossRevenue = 0,
  processingFees = 0,
  taxes = 0,
  chargebacks = 0,
  netRevenue = null,
  totalEarnings = 0,
  platformRevenue = 0,
  currency = "NGN",
  walletBacked = false,
} = {}) => {
  const normalizedGrossRevenue = clampMoney(grossRevenue);
  const normalizedProcessingFees = clampMoney(processingFees);
  const normalizedTaxes = clampMoney(taxes);
  const normalizedNetRevenue = clampMoney(
    netRevenue == null
      ? normalizedGrossRevenue - normalizedProcessingFees - normalizedTaxes
      : netRevenue
  );
  const normalizedTotalEarnings = clampMoney(totalEarnings);

  return {
    currency: normalizeCurrency(currency),
    grossRevenue: normalizedGrossRevenue,
    processingFees: normalizedProcessingFees,
    taxes: normalizedTaxes,
    chargebacks: clampMoney(chargebacks),
    netRevenue: normalizedNetRevenue,
    totalEarnings: normalizedTotalEarnings,
    platformRevenue: clampMoney(platformRevenue),
    availableBalance: normalizedTotalEarnings,
    spendableBalance: normalizedTotalEarnings,
    recoverableBalance: 0,
    debtBalance: 0,
    pendingBalance: 0,
    withdrawn: 0,
    walletBacked,
  };
};

const buildPurchaseSettlementEntryPayloads = async (purchase) => {
  if (!purchase?.creatorId) {
    return [];
  }

  const {
    grossAmount,
    processingFeeAmount,
    taxAmount,
    netRevenueAmount,
    creatorAmount,
    platformAmount,
    creatorShareRate,
    platformShareRate,
    revenueCategory,
    revenueSharePolicy,
  } = computePurchaseRevenueShare(purchase);
  if (grossAmount <= 0) {
    return [];
  }

  const currency = normalizeCurrency(purchase.currency);
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
    processingFeeAmount,
    taxAmount,
    listedPriceAmount:
      purchase.listedPriceAmount == null
        ? grossAmount
        : clampMoney(purchase.listedPriceAmount),
    taxableBaseAmount:
      purchase.taxableBaseAmount == null
        ? clampMoney(grossAmount - taxAmount)
        : clampMoney(purchase.taxableBaseAmount),
    taxRateBps: purchase.taxRateBps == null ? null : Number(purchase.taxRateBps),
    taxPriceMode: purchase.taxPriceMode || null,
    taxSource: purchase.taxSource || "none",
    taxPolicy: purchase.taxPolicy || "",
    taxJurisdiction: purchase.taxJurisdiction || "",
    taxProviderReported: Boolean(purchase.taxProviderReported),
    netRevenueAmount,
    creatorShareRate,
    platformShareRate,
    revenueCategory,
    revenueSharePolicy,
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

const buildPurchaseRefundEntryPayloads = async (purchase) => {
  if (!purchase?.creatorId) {
    return [];
  }

  const {
    grossAmount,
    processingFeeAmount,
    taxAmount,
    netRevenueAmount,
    creatorAmount,
    platformAmount,
    creatorShareRate,
    platformShareRate,
    revenueCategory,
    revenueSharePolicy,
  } = computePurchaseRevenueShare(purchase);
  if (grossAmount <= 0) {
    return [];
  }

  const currency = normalizeCurrency(purchase.currency);
  const [creatorWallet, platformWallet] = await Promise.all([
    ensureCreatorWalletAccount(purchase.creatorId, currency),
    ensurePlatformWalletAccount(currency),
  ]);

  const creatorId = toIdString(purchase.creatorId);
  const purchaseId = toIdString(purchase._id);
  const itemId = toIdString(purchase.itemId);
  const refundedAt = purchase.refundedAt || purchase.updatedAt || new Date();
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
    processingFeeAmount,
    taxAmount,
    listedPriceAmount:
      purchase.listedPriceAmount == null
        ? grossAmount
        : clampMoney(purchase.listedPriceAmount),
    taxableBaseAmount:
      purchase.taxableBaseAmount == null
        ? clampMoney(grossAmount - taxAmount)
        : clampMoney(purchase.taxableBaseAmount),
    taxRateBps: purchase.taxRateBps == null ? null : Number(purchase.taxRateBps),
    taxPriceMode: purchase.taxPriceMode || null,
    taxSource: purchase.taxSource || "none",
    taxPolicy: purchase.taxPolicy || "",
    taxJurisdiction: purchase.taxJurisdiction || "",
    taxProviderReported: Boolean(purchase.taxProviderReported),
    netRevenueAmount,
    creatorShareRate,
    platformShareRate,
    revenueCategory,
    revenueSharePolicy,
    refundReason: String(purchase.refundReason || "").trim(),
  };

  return [
    {
      walletAccountId: creatorWallet._id,
      ownerType: "creator",
      ownerId: purchase.creatorId,
      currency,
      direction: "debit",
      bucket: "available",
      entryType: "refund_debit",
      amount: creatorAmount,
      grossAmount,
      sourceType: "refund",
      sourceId: purchase._id,
      sourceRef: purchase.providerRef || "",
      dedupeKey: `purchase_refund_creator:${purchaseId}`,
      effectiveAt: refundedAt,
      metadata: sharedMetadata,
    },
    {
      walletAccountId: platformWallet._id,
      ownerType: "platform",
      ownerId: null,
      currency,
      direction: "debit",
      bucket: "available",
      entryType: "refund_debit",
      amount: platformAmount,
      grossAmount,
      sourceType: "refund",
      sourceId: purchase._id,
      sourceRef: purchase.providerRef || "",
      dedupeKey: `purchase_refund_platform:${purchaseId}`,
      effectiveAt: refundedAt,
      metadata: sharedMetadata,
    },
  ];
};

const getDisputeIdentity = (dispute = {}) => ({
  disputeObjectId: dispute?._id || null,
  disputeId: toIdString(dispute?._id),
  providerDisputeId: String(dispute?.providerDisputeId || dispute?.id || "").trim(),
});

const buildPurchaseDisputeEntryPayloads = async ({
  purchase,
  dispute,
  allocation,
  entryType,
  direction,
  effectiveAt,
} = {}) => {
  if (!purchase?.creatorId) {
    return [];
  }

  const { disputeObjectId, disputeId, providerDisputeId } = getDisputeIdentity(dispute);
  if (!disputeObjectId || !providerDisputeId) {
    return [];
  }

  const currency = normalizeCurrency(dispute?.currency || purchase.currency);
  const [creatorWallet, platformWallet] = await Promise.all([
    ensureCreatorWalletAccount(purchase.creatorId, currency),
    ensurePlatformWalletAccount(currency),
  ]);
  const purchaseId = toIdString(purchase._id);
  const providerLossAmount = clampMoney(
    allocation?.requestedLossAmount ??
      (entryType === "dispute_hold"
        ? dispute?.disputedAmount || dispute?.refundAmount
        : dispute?.refundAmount || dispute?.disputedAmount)
  );
  const sharedMetadata = {
    disputeId,
    providerDisputeId,
    purchaseId,
    creatorId: toIdString(purchase.creatorId),
    itemType: String(purchase.itemType || "").trim().toLowerCase(),
    itemId: toIdString(purchase.itemId),
    provider: dispute?.provider || purchase.provider || "paystack",
    providerRef: purchase.providerRef || dispute?.providerRef || "",
    disputeStatus: String(dispute?.status || "").trim().toLowerCase(),
    disputeResolution: String(dispute?.resolution || "").trim().toLowerCase(),
    providerLossAmount,
    priorChargebackAmount: clampMoney(allocation?.priorLossAmount),
    chargebackAmount: clampMoney(allocation?.deductibleLossAmount),
    netRevenueAmount: clampMoney(allocation?.deductibleLossAmount),
    creatorAmount: clampMoney(allocation?.creatorDebitAmount),
    platformAmount: clampMoney(allocation?.platformDebitAmount),
    shareBaseAmount: clampMoney(allocation?.shareBaseAmount),
    unallocatedLossAmount: clampMoney(allocation?.unallocatedLossAmount),
  };
  const action =
    entryType === "dispute_hold"
      ? "hold"
      : entryType === "dispute_release"
        ? "release"
        : "chargeback";

  return [
    {
      walletAccountId: creatorWallet._id,
      ownerType: "creator",
      ownerId: purchase.creatorId,
      currency,
      direction,
      bucket: "available",
      entryType,
      amount: clampMoney(allocation?.creatorDebitAmount),
      grossAmount: providerLossAmount,
      sourceType: "dispute",
      sourceId: disputeObjectId,
      sourceRef: providerDisputeId,
      dedupeKey: `purchase_dispute_${action}_creator:${purchaseId}:${providerDisputeId}`,
      effectiveAt,
      metadata: sharedMetadata,
    },
    {
      walletAccountId: platformWallet._id,
      ownerType: "platform",
      ownerId: null,
      currency,
      direction,
      bucket: "available",
      entryType,
      amount: clampMoney(allocation?.platformDebitAmount),
      grossAmount: providerLossAmount,
      sourceType: "dispute",
      sourceId: disputeObjectId,
      sourceRef: providerDisputeId,
      dedupeKey: `purchase_dispute_${action}_platform:${purchaseId}:${providerDisputeId}`,
      effectiveAt,
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

const upsertWalletEntries = async (payloads = []) => {
  let createdCount = 0;
  for (const payload of payloads) {
    const result = await upsertWalletEntry(payload);
    if (result.created) {
      createdCount += 1;
    }
  }
  return createdCount;
};

const buildDisputeEntryResult = ({
  purchase,
  dispute,
  allocation,
  createdCount = 0,
  revenueLedgerResult = {},
  releaseResult = null,
} = {}) => ({
  createdCount,
  revenueLedgerCreatedCount: Number(revenueLedgerResult?.createdCount || 0),
  revenueLedgerFailed: Boolean(revenueLedgerResult?.failed),
  skipped: false,
  purchaseId: toIdString(purchase?._id),
  disputeId: toIdString(dispute?._id),
  providerDisputeId: String(dispute?.providerDisputeId || "").trim(),
  chargebackAmount: clampMoney(allocation?.deductibleLossAmount),
  creatorChargebackAmount: clampMoney(allocation?.creatorDebitAmount),
  platformChargebackAmount: clampMoney(allocation?.platformDebitAmount),
  unallocatedLossAmount: clampMoney(allocation?.unallocatedLossAmount),
  ...(releaseResult ? { releaseResult } : {}),
});

const recordPurchaseDisputeHoldEntries = async ({
  purchase,
  dispute,
  priorLossAmount = 0,
  logger = console,
} = {}) => {
  if (!purchase?._id || !dispute?._id || !dispute?.providerDisputeId) {
    return { createdCount: 0, skipped: true, reason: "missing_dispute_identity" };
  }

  const existingAllocation = await loadDisputeEntryAllocation({
    dispute,
    entryType: "dispute_hold",
  });
  const allocation =
    existingAllocation ||
    computePurchaseDisputeAllocation({
      purchase,
      lossAmount: dispute.disputedAmount || dispute.refundAmount,
      priorLossAmount,
    });
  if (allocation.deductibleLossAmount <= 0) {
    return {
      createdCount: 0,
      skipped: true,
      reason: "non_positive_dispute_amount",
      allocation,
    };
  }

  const settlementResult = await recordPurchaseSettlementEntries({
    purchase,
    logger: null,
  });
  if (settlementResult.skipped || settlementResult.revenueLedgerFailed) {
    return {
      createdCount: 0,
      skipped: true,
      reason: settlementResult.revenueLedgerFailed
        ? "purchase_settlement_ledger_failed"
        : settlementResult.reason || "purchase_settlement_unavailable",
      revenueLedgerFailed: Boolean(settlementResult.revenueLedgerFailed),
      settlementResult,
      allocation,
    };
  }
  const payloads = await buildPurchaseDisputeEntryPayloads({
    purchase,
    dispute,
    allocation,
    entryType: "dispute_hold",
    direction: "debit",
    effectiveAt: dispute.openedAt || dispute.lastEventAt || new Date(),
  });
  const createdCount = await upsertWalletEntries(payloads);
  const revenueLedgerResult = await recordDisputeOpenedLedgerEntries({
    purchase,
    dispute,
    allocation,
  }).catch((error) => ({
    createdCount: 0,
    failed: true,
    reason: error?.message || "Revenue ledger dispute hold failed",
  }));

  if (createdCount > 0 && logger?.info) {
    logger.info("[wallet] dispute reserve recorded", {
      purchaseId: toIdString(purchase._id),
      providerDisputeId: dispute.providerDisputeId,
      chargebackAmount: allocation.deductibleLossAmount,
    });
  }

  return buildDisputeEntryResult({
    purchase,
    dispute,
    allocation,
    createdCount,
    revenueLedgerResult,
  });
};

const loadDisputeEntryAllocation = async ({ dispute, entryType } = {}) => {
  if (!dispute?._id) {
    return null;
  }
  const entries = await WalletEntry.find({
    sourceType: "dispute",
    sourceId: dispute._id,
    entryType,
  })
    .select("ownerType amount metadata")
    .lean();
  if (!entries.length) {
    return null;
  }

  const creatorEntry = entries.find((entry) => entry.ownerType === "creator");
  const platformEntry = entries.find((entry) => entry.ownerType === "platform");
  const metadata = creatorEntry?.metadata || platformEntry?.metadata || {};
  const creatorDebitAmount = clampMoney(
    metadata.creatorAmount ?? creatorEntry?.amount
  );
  const platformDebitAmount = clampMoney(
    metadata.platformAmount ?? platformEntry?.amount
  );
  return {
    shareBaseAmount: clampMoney(metadata.shareBaseAmount),
    requestedLossAmount: clampMoney(metadata.providerLossAmount),
    priorLossAmount: clampMoney(metadata.priorChargebackAmount),
    deductibleLossAmount: clampMoney(creatorDebitAmount + platformDebitAmount),
    creatorDebitAmount,
    platformDebitAmount,
    unallocatedLossAmount: clampMoney(metadata.unallocatedLossAmount),
  };
};

const loadDisputeHoldAllocation = async (dispute) =>
  loadDisputeEntryAllocation({ dispute, entryType: "dispute_hold" });

const recordPurchaseDisputeReleaseEntries = async ({
  purchase,
  dispute,
  logger = console,
} = {}) => {
  if (!purchase?._id || !dispute?._id || !dispute?.providerDisputeId) {
    return { createdCount: 0, skipped: true, reason: "missing_dispute_identity" };
  }

  const allocation = await loadDisputeHoldAllocation(dispute);
  if (!allocation) {
    return { createdCount: 0, skipped: true, reason: "no_dispute_hold" };
  }

  const payloads = await buildPurchaseDisputeEntryPayloads({
    purchase,
    dispute,
    allocation,
    entryType: "dispute_release",
    direction: "credit",
    effectiveAt: dispute.resolvedAt || dispute.lastEventAt || new Date(),
  });
  const createdCount = await upsertWalletEntries(payloads);
  const revenueLedgerResult = await recordDisputeReleasedLedgerEntries({
    purchase,
    dispute,
    allocation,
  }).catch((error) => ({
    createdCount: 0,
    failed: true,
    reason: error?.message || "Revenue ledger dispute release failed",
  }));

  if (createdCount > 0 && logger?.info) {
    logger.info("[wallet] dispute reserve released", {
      purchaseId: toIdString(purchase._id),
      providerDisputeId: dispute.providerDisputeId,
    });
  }

  return buildDisputeEntryResult({
    purchase,
    dispute,
    allocation,
    createdCount,
    revenueLedgerResult,
  });
};

const recordPurchaseChargebackEntries = async ({
  purchase,
  dispute,
  priorLossAmount = 0,
  logger = console,
} = {}) => {
  if (!purchase?._id || !dispute?._id || !dispute?.providerDisputeId) {
    return { createdCount: 0, skipped: true, reason: "missing_dispute_identity" };
  }

  const existingAllocation = await loadDisputeEntryAllocation({
    dispute,
    entryType: "chargeback_debit",
  });
  const allocation =
    existingAllocation ||
    computePurchaseDisputeAllocation({
      purchase,
      lossAmount: dispute.refundAmount,
      priorLossAmount,
    });
  if (allocation.deductibleLossAmount <= 0) {
    return {
      createdCount: 0,
      skipped: true,
      reason: "non_positive_chargeback_amount",
      allocation,
    };
  }

  const settlementResult = await recordPurchaseSettlementEntries({
    purchase,
    logger: null,
  });
  if (settlementResult.skipped || settlementResult.revenueLedgerFailed) {
    return {
      createdCount: 0,
      skipped: true,
      reason: settlementResult.revenueLedgerFailed
        ? "purchase_settlement_ledger_failed"
        : settlementResult.reason || "purchase_settlement_unavailable",
      revenueLedgerFailed: Boolean(settlementResult.revenueLedgerFailed),
      settlementResult,
      allocation,
    };
  }
  const releaseResult = await recordPurchaseDisputeReleaseEntries({
    purchase,
    dispute,
    logger,
  });
  const payloads = await buildPurchaseDisputeEntryPayloads({
    purchase,
    dispute,
    allocation,
    entryType: "chargeback_debit",
    direction: "debit",
    effectiveAt: dispute.resolvedAt || dispute.lastEventAt || new Date(),
  });
  const createdCount = await upsertWalletEntries(payloads);
  const revenueLedgerResult = await recordChargebackSettledLedgerEntries({
    purchase,
    dispute,
    allocation,
  }).catch((error) => ({
    createdCount: 0,
    failed: true,
    reason: error?.message || "Revenue ledger chargeback failed",
  }));

  if (createdCount > 0 && logger?.info) {
    logger.info("[wallet] chargeback recorded", {
      purchaseId: toIdString(purchase._id),
      providerDisputeId: dispute.providerDisputeId,
      chargebackAmount: allocation.deductibleLossAmount,
    });
  }

  return buildDisputeEntryResult({
    purchase,
    dispute,
    allocation,
    createdCount,
    revenueLedgerResult,
    releaseResult,
  });
};

const recordPurchaseSettlementEntries = async ({
  purchase,
  logger = console,
  actorUserId = "",
  actorRole = "",
  actorType = "provider",
} = {}) => {
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

  const revenueLedgerResult = await recordPurchaseSettlementLedgerEntries({
    purchase,
    actorUserId,
    actorRole,
    actorType,
  }).catch((error) => ({
    createdCount: 0,
    failed: true,
    reason: error?.message || "Revenue ledger settlement failed",
  }));

  if (createdCount > 0 && logger?.info) {
    logger.info("[wallet] purchase settlement recorded", {
      purchaseId: toIdString(purchase._id),
      createdCount,
      revenueLedgerCreatedCount: Number(revenueLedgerResult?.createdCount || 0),
      providerRef: purchase.providerRef || "",
    });
  }

  return {
    createdCount,
    revenueLedgerCreatedCount: Number(revenueLedgerResult?.createdCount || 0),
    revenueLedgerFailed: Boolean(revenueLedgerResult?.failed),
    skipped: false,
    purchaseId: toIdString(purchase._id),
  };
};

const recordPurchaseRefundEntries = async ({
  purchase,
  logger = console,
  actorUserId = "",
  actorRole = "",
  reason = "",
} = {}) => {
  if (!purchase?._id) {
    return {
      createdCount: 0,
      skipped: true,
      reason: "missing_purchase",
    };
  }

  const entryPayloads = await buildPurchaseRefundEntryPayloads(purchase);
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

  const revenueLedgerResult = await recordRefundSettledLedgerEntries({
    purchase,
    actorUserId,
    actorRole,
    reason,
  }).catch((error) => ({
    createdCount: 0,
    failed: true,
    reason: error?.message || "Revenue ledger refund failed",
  }));

  if (createdCount > 0 && logger?.info) {
    logger.info("[wallet] purchase refund recorded", {
      purchaseId: toIdString(purchase._id),
      createdCount,
      revenueLedgerCreatedCount: Number(revenueLedgerResult?.createdCount || 0),
      providerRef: purchase.providerRef || "",
    });
  }

  return {
    createdCount,
    revenueLedgerCreatedCount: Number(revenueLedgerResult?.createdCount || 0),
    revenueLedgerFailed: Boolean(revenueLedgerResult?.failed),
    skipped: false,
    purchaseId: toIdString(purchase._id),
  };
};

const buildCreatorWalletSummary = async ({ creatorId, fallbackGrossRevenue = 0, currency = "NGN" } = {}) => {
  if (!creatorId) {
    return {
      currency: normalizeCurrency(currency),
      grossRevenue: clampMoney(fallbackGrossRevenue),
      processingFees: 0,
      taxes: 0,
      chargebacks: 0,
      netRevenue: clampMoney(fallbackGrossRevenue),
      totalEarnings: 0,
      platformRevenue: 0,
      availableBalance: 0,
      spendableBalance: 0,
      recoverableBalance: 0,
      debtBalance: 0,
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
      processingFees: 0,
      taxes: 0,
      chargebacks: 0,
      netRevenue: clampMoney(fallbackGrossRevenue),
      totalEarnings: 0,
      platformRevenue: 0,
      availableBalance: 0,
      spendableBalance: 0,
      recoverableBalance: 0,
      debtBalance: 0,
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
        processingFees: {
          $sum: {
            $cond: [
              { $eq: ["$entryType", "sale_credit"] },
              { $ifNull: ["$metadata.processingFeeAmount", 0] },
              0,
            ],
          },
        },
        taxes: {
          $sum: {
            $cond: [
              { $eq: ["$entryType", "sale_credit"] },
              { $ifNull: ["$metadata.taxAmount", 0] },
              0,
            ],
          },
        },
        saleNetRevenue: {
          $sum: {
            $cond: [
              { $eq: ["$entryType", "sale_credit"] },
              { $ifNull: ["$metadata.netRevenueAmount", "$grossAmount"] },
              0,
            ],
          },
        },
        refundedNetRevenue: {
          $sum: {
            $cond: [
              { $eq: ["$entryType", "refund_debit"] },
              { $ifNull: ["$metadata.netRevenueAmount", "$grossAmount"] },
              0,
            ],
          },
        },
        chargebackNetRevenue: {
          $sum: {
            $cond: [
              { $eq: ["$entryType", "chargeback_debit"] },
              { $ifNull: ["$metadata.netRevenueAmount", "$amount"] },
              0,
            ],
          },
        },
        platformRevenue: {
          $sum: {
            $cond: [
              { $eq: ["$entryType", "sale_credit"] },
              { $ifNull: ["$metadata.platformAmount", 0] },
              0,
            ],
          },
        },
        refundedPlatformRevenue: {
          $sum: {
            $cond: [
              { $eq: ["$entryType", "refund_debit"] },
              { $ifNull: ["$metadata.platformAmount", 0] },
              0,
            ],
          },
        },
        chargebackPlatformRevenue: {
          $sum: {
            $cond: [
              { $eq: ["$entryType", "chargeback_debit"] },
              { $ifNull: ["$metadata.platformAmount", 0] },
              0,
            ],
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
        chargebackDebits: {
          $sum: {
            $cond: [{ $eq: ["$entryType", "chargeback_debit"] }, "$amount", 0],
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

  const totalEarnings = roundMoney(
    Number(aggregate?.saleCredits || 0)
      + Number(aggregate?.adjustmentCredits || 0)
      - Number(aggregate?.adjustmentDebits || 0)
      - Number(aggregate?.refundDebits || 0)
      - Number(aggregate?.chargebackDebits || 0)
  );
  const availableBalance = roundMoney(
    Number(aggregate?.availableCredits || 0) - Number(aggregate?.availableDebits || 0)
  );
  const pendingBalance = roundMoney(
    Number(aggregate?.pendingCredits || 0) - Number(aggregate?.pendingDebits || 0)
  );
  const hasLedgerEntries = Number(aggregate?.entryCount || 0) > 0;

  return {
    currency: normalizedCurrency,
    grossRevenue: clampMoney(
      Number(aggregate?.grossRevenue || 0) || Number(fallbackGrossRevenue || 0)
    ),
    processingFees: clampMoney(aggregate?.processingFees),
    taxes: clampMoney(aggregate?.taxes),
    chargebacks: clampMoney(aggregate?.chargebackNetRevenue),
    netRevenue: roundMoney(
      Number(aggregate?.saleNetRevenue || 0)
        - Number(aggregate?.refundedNetRevenue || 0)
        - Number(aggregate?.chargebackNetRevenue || 0)
    ),
    totalEarnings,
    platformRevenue: roundMoney(
      Number(aggregate?.platformRevenue || 0)
        - Number(aggregate?.refundedPlatformRevenue || 0)
        - Number(aggregate?.chargebackPlatformRevenue || 0)
    ),
    availableBalance,
    spendableBalance: clampMoney(availableBalance),
    recoverableBalance: Math.min(0, availableBalance),
    debtBalance: clampMoney(-availableBalance),
    pendingBalance,
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
    disputeId: toIdString(metadata?.disputeId),
    providerDisputeId: metadata?.providerDisputeId || "",
    creatorAmount: clampMoney(metadata?.creatorAmount || 0),
    platformAmount: clampMoney(metadata?.platformAmount || 0),
    processingFeeAmount: clampMoney(metadata?.processingFeeAmount || 0),
    taxAmount: clampMoney(metadata?.taxAmount || 0),
    netRevenueAmount: clampMoney(metadata?.netRevenueAmount ?? entry?.grossAmount),
    effectiveAt: entry?.effectiveAt || entry?.createdAt || null,
  };
};

const buildWalletRecentEntryFromPurchase = (purchase = {}) => {
  const {
    grossAmount,
    processingFeeAmount,
    taxAmount,
    netRevenueAmount,
    creatorAmount,
    platformAmount,
  } = computePurchaseRevenueShare(purchase);
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
    processingFeeAmount,
    taxAmount,
    netRevenueAmount,
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
            entryType: { $in: ["sale_credit", "chargeback_debit"] },
          },
        },
        {
          $group: {
            _id: "$metadata.itemType",
            grossRevenue: {
              $sum: {
                $cond: [{ $eq: ["$entryType", "sale_credit"] }, "$grossAmount", 0],
              },
            },
            processingFees: {
              $sum: {
                $cond: [
                  { $eq: ["$entryType", "sale_credit"] },
                  { $ifNull: ["$metadata.processingFeeAmount", 0] },
                  0,
                ],
              },
            },
            taxes: {
              $sum: {
                $cond: [
                  { $eq: ["$entryType", "sale_credit"] },
                  { $ifNull: ["$metadata.taxAmount", 0] },
                  0,
                ],
              },
            },
            netRevenue: {
              $sum: {
                $cond: [
                  { $eq: ["$entryType", "chargeback_debit"] },
                  {
                    $multiply: [
                      -1,
                      { $ifNull: ["$metadata.netRevenueAmount", "$amount"] },
                    ],
                  },
                  { $ifNull: ["$metadata.netRevenueAmount", "$grossAmount"] },
                ],
              },
            },
            chargebacks: {
              $sum: {
                $cond: [
                  { $eq: ["$entryType", "chargeback_debit"] },
                  { $ifNull: ["$metadata.netRevenueAmount", "$amount"] },
                  0,
                ],
              },
            },
            creatorEarnings: {
              $sum: {
                $cond: [
                  { $eq: ["$entryType", "chargeback_debit"] },
                  { $multiply: [-1, "$amount"] },
                  "$amount",
                ],
              },
            },
            transactions: {
              $sum: { $cond: [{ $eq: ["$entryType", "sale_credit"] }, 1, 0] },
            },
          },
        },
      ]),
      WalletEntry.aggregate([
        {
          $match: {
            walletAccountId: walletObjectId,
            entryType: { $in: ["sale_credit", "chargeback_debit"] },
          },
        },
        {
          $group: {
            _id: {
              itemType: "$metadata.itemType",
              itemId: "$metadata.itemId",
            },
            creatorEarnings: {
              $sum: {
                $cond: [
                  { $eq: ["$entryType", "chargeback_debit"] },
                  { $multiply: [-1, "$amount"] },
                  "$amount",
                ],
              },
            },
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
        itemEarningsMap.set(`${itemType}:${itemId}`, roundMoney(row?.creatorEarnings));
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
              processingFees: clampMoney(row?.processingFees),
              taxes: clampMoney(row?.taxes),
              chargebacks: clampMoney(row?.chargebacks),
              netRevenue: roundMoney(row?.netRevenue),
              creatorEarnings: roundMoney(row?.creatorEarnings),
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
        .select(
          "_id itemType itemId amount currency provider providerRef paidAt createdAt updatedAt revenueCategory revenueSharePolicy creatorShareRate platformShareRate processingFeeAmount taxAmount"
        )
        .lean()
    : [];

  const grossRevenue = purchases.reduce((sum, row) => sum + clampMoney(row?.amount), 0);
  const processingFees = purchases.reduce(
    (sum, row) => sum + computePurchaseRevenueShare(row).processingFeeAmount,
    0
  );
  const taxes = purchases.reduce(
    (sum, row) => sum + computePurchaseRevenueShare(row).taxAmount,
    0
  );
  const netRevenue = purchases.reduce(
    (sum, row) => sum + computePurchaseRevenueShare(row).netRevenueAmount,
    0
  );
  const totalEarnings = purchases.reduce(
    (sum, row) => sum + computePurchaseRevenueShare(row).creatorAmount,
    0
  );
  const summary = buildAvailableOnlySummary({
    grossRevenue,
    processingFees,
    taxes,
    netRevenue,
    totalEarnings,
    platformRevenue: purchases.reduce(
      (sum, row) => sum + computePurchaseRevenueShare(row).platformAmount,
      0
    ),
    currency: normalizedCurrency,
    walletBacked: false,
  });

  const itemEarningsMap = new Map();
  const breakdownMap = new Map();

  purchases.forEach((purchase) => {
    const itemType = normalizeItemType(purchase?.itemType || "");
    const itemId = toIdString(purchase?.itemId);
    const {
      creatorAmount,
      grossAmount,
      processingFeeAmount,
      taxAmount,
      netRevenueAmount,
    } = computePurchaseRevenueShare(purchase);

    if (itemId) {
      const itemKey = `${itemType}:${itemId}`;
      itemEarningsMap.set(itemKey, clampMoney((itemEarningsMap.get(itemKey) || 0) + creatorAmount));
    }

    const bucket = breakdownMap.get(itemType) || {
      key: itemType,
      label: buildBreakdownLabel(itemType),
      grossRevenue: 0,
      processingFees: 0,
      taxes: 0,
      netRevenue: 0,
      creatorEarnings: 0,
      transactions: 0,
    };

    bucket.grossRevenue += grossAmount;
    bucket.processingFees += processingFeeAmount;
    bucket.taxes += taxAmount;
    bucket.netRevenue += netRevenueAmount;
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
        processingFees: clampMoney(row.processingFees),
        taxes: clampMoney(row.taxes),
        netRevenue: clampMoney(row.netRevenue),
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
      "_id creatorId itemType itemId amount currency provider providerRef billingInterval paidAt createdAt updatedAt revenueCategory revenueSharePolicy creatorShareRate platformShareRate processingFeeAmount taxAmount"
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
  DEFAULT_WALLET_RECONCILIATION_INTERVAL_MS,
  getPlatformSettlementAccount,
  getPlatformWalletSlug,
  getCreatorWalletSlug,
  ensureCreatorWalletAccount,
  ensurePlatformWalletAccount,
  recordPurchaseRefundEntries,
  recordPurchaseSettlementEntries,
  computePurchaseDisputeAllocation,
  recordPurchaseDisputeHoldEntries,
  recordPurchaseDisputeReleaseEntries,
  recordPurchaseChargebackEntries,
  buildCreatorWalletSummary,
  buildCreatorWalletSnapshot,
  reconcilePaidPurchaseWalletEntries,
  startWalletMaintenance,
};
