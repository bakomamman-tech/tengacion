const mongoose = require("mongoose");
const asyncHandler = require("../middleware/asyncHandler");
const Purchase = require("../models/Purchase");
const CreatorProfile = require("../models/CreatorProfile");
const { resolvePurchasableItem } = require("../services/catalogService");
const { hasEntitlement } = require("../services/entitlementService");
const {
  buildCreatorWalletSnapshot,
} = require("../services/walletService");
const {
  computePurchaseRevenueShare,
} = require("../services/creatorRevenueSharePolicy");
const {
  buildTimelineEntryFromEvent,
  cancelSubscriptionPurchase,
  loadPurchaseOperationalArtifacts,
  resumeSubscriptionRenewal,
  toPurchasePayload,
} = require("../services/paymentOpsService");

const ITEM_ROUTE_BY_TYPE = {
  track: "tracks",
  book: "books",
  album: "albums",
  video: "videos",
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

const roundMoney = (value = 0) => Math.max(0, Math.round(Number(value || 0)));

const buildItemRoute = ({ itemType = "", itemId = "", creatorId = "" } = {}) => {
  if (itemType === "subscription" && creatorId) {
    return `/creators/${creatorId}`;
  }
  const segment = ITEM_ROUTE_BY_TYPE[itemType];
  return segment && itemId ? `/${segment}/${itemId}` : "/purchases";
};

const buildFeeSummary = (purchase = {}) => {
  const {
    grossAmount,
    processingFeeAmount,
    taxAmount,
    netRevenueAmount,
    platformAmount,
    creatorAmount,
    platformShareRate,
    creatorShareRate,
  } = computePurchaseRevenueShare(purchase);

  return {
    buyerTotal: grossAmount,
    processingFeeDeducted: processingFeeAmount,
    taxDeducted: taxAmount,
    netRevenue: netRevenueAmount,
    platformFeeIncluded: platformAmount,
    tengacionReceives: platformAmount,
    creatorReceives: creatorAmount,
    platformSharePercent: roundMoney(platformShareRate * 100),
    creatorSharePercent: roundMoney(creatorShareRate * 100),
    currency: purchase.currency || "NGN",
    explanation:
      "The buyer total is unchanged. Processing charges and applicable taxes are deducted from settlement before the stored artist revenue share is applied.",
  };
};

const getPurchaseItemSummary = async (purchase = {}) => {
  const item = await resolvePurchasableItem(purchase.itemType, purchase.itemId).catch(() => null);
  const itemId = toIdString(purchase.itemId);
  const creatorId = toIdString(purchase.creatorId);
  const title =
    item?.title ||
    (purchase.itemType === "subscription" ? "Creator membership" : "Creator content");

  return {
    item,
    itemSummary: {
      title,
      itemType: purchase.itemType || "",
      itemId,
      route: buildItemRoute({
        itemType: purchase.itemType,
        itemId,
        creatorId,
      }),
    },
  };
};

const enrichPurchaseForBuyer = async (purchase = {}, { includeTimeline = false } = {}) => {
  const base = toPurchasePayload(purchase);
  const { itemSummary } = await getPurchaseItemSummary(purchase);
  const creator = purchase.creatorId
    ? await CreatorProfile.findById(purchase.creatorId)
      .select("_id displayName fullName userId")
      .lean()
      .catch(() => null)
    : null;
  const artifacts = includeTimeline
    ? await loadPurchaseOperationalArtifacts(purchase).catch(() => ({
        events: [],
        entitlements: [],
        walletEntries: [],
      }))
    : null;
  const timeline = includeTimeline
    ? (artifacts?.events || []).map(buildTimelineEntryFromEvent)
    : [];

  return {
    ...base,
    reference: base.providerRef,
    itemTitle: itemSummary.title,
    productTitle: itemSummary.title,
    title: itemSummary.title,
    itemRoute: itemSummary.route,
    route: itemSummary.route,
    receiptPath: `/purchases/${base._id}`,
    orderStatus: base.status,
    paymentStatus: base.status,
    feeSummary: buildFeeSummary(purchase),
    creator: creator
      ? {
          _id: toIdString(creator._id),
          displayName: creator.displayName || creator.fullName || "",
          userId: toIdString(creator.userId),
        }
      : null,
    ...(includeTimeline
      ? {
          timeline,
          walletEntries: (artifacts?.walletEntries || []).map((entry) => ({
            id: toIdString(entry._id),
            entryType: entry.entryType || "",
            amount: Number(entry.amount || 0),
            grossAmount: Number(entry.grossAmount || 0),
            currency: entry.currency || base.currency || "NGN",
            createdAt: entry.createdAt || entry.effectiveAt || null,
          })),
        }
      : {}),
  };
};

exports.getMyPurchases = asyncHandler(async (req, res) => {
  const purchases = await Purchase.find({ userId: req.user.id })
    .sort({ createdAt: -1 })
    .lean();
  const items = await Promise.all(
    purchases.map((purchase) => enrichPurchaseForBuyer(purchase))
  );

  return res.json(items);
});

exports.getMyPurchaseReceipt = asyncHandler(async (req, res) => {
  const purchaseId = String(req.params?.id || "").trim();
  if (!purchaseId || !mongoose.Types.ObjectId.isValid(purchaseId)) {
    return res.status(400).json({ error: "Valid purchase id is required" });
  }

  const purchase = await Purchase.findOne({
    _id: purchaseId,
    userId: req.user.id,
  });
  if (!purchase) {
    return res.status(404).json({ error: "Purchase not found" });
  }

  const receipt = await enrichPurchaseForBuyer(purchase, { includeTimeline: true });
  return res.json({ receipt });
});

exports.cancelMySubscription = asyncHandler(async (req, res) => {
  const purchaseId = String(req.params?.id || "").trim();
  if (!purchaseId || !mongoose.Types.ObjectId.isValid(purchaseId)) {
    return res.status(400).json({ error: "Valid purchase id is required" });
  }

  const purchase = await Purchase.findOne({
    _id: purchaseId,
    userId: req.user.id,
  });
  if (!purchase) {
    return res.status(404).json({ error: "Purchase not found" });
  }

  const result = await cancelSubscriptionPurchase({
    purchase,
    actorUserId: req.user.id,
    actorRole: req.user?.role || "user",
    reason: "user_cancelled_subscription",
  });

  return res.json({
    success: true,
    alreadyCancelled: Boolean(result?.alreadyCancelled),
    purchase: toPurchasePayload(result.purchase),
  });
});

exports.resumeMySubscriptionRenewal = asyncHandler(async (req, res) => {
  const purchaseId = String(req.params?.id || "").trim();
  if (!purchaseId || !mongoose.Types.ObjectId.isValid(purchaseId)) {
    return res.status(400).json({ error: "Valid purchase id is required" });
  }

  const purchase = await Purchase.findOne({
    _id: purchaseId,
    userId: req.user.id,
  });
  if (!purchase) {
    return res.status(404).json({ error: "Purchase not found" });
  }

  const result = await resumeSubscriptionRenewal({
    purchase,
    actorUserId: req.user.id,
    actorRole: req.user?.role || "user",
    reason: "user_resumed_subscription",
  });

  return res.json({
    success: true,
    alreadyResumed: Boolean(result?.alreadyResumed),
    purchase: toPurchasePayload(result.purchase),
  });
});

exports.checkEntitlement = asyncHandler(async (req, res) => {
  const itemType = String(req.query?.itemType || "").trim().toLowerCase();
  const itemId = String(req.query?.itemId || "").trim();

  if (!itemType || !itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
    return res.status(400).json({ error: "itemType and valid itemId are required" });
  }

  const item = await resolvePurchasableItem(itemType, itemId);
  const entitled = await hasEntitlement({
    userId: req.user.id,
    itemType,
    itemId,
    creatorId: item?.creatorId || "",
  });

  return res.json({
    entitled,
    itemType,
    itemId,
  });
});

exports.getCreatorSales = asyncHandler(async (req, res) => {
  const creatorId = req.creatorProfile._id;
  const walletSnapshot = await buildCreatorWalletSnapshot({
    creatorId,
    recentLimit: 30,
  });
  const totalSalesCount = walletSnapshot.breakdown.reduce(
    (sum, row) => sum + Number(row.transactions || 0),
    0
  );

  const seededBreakdown = {
    track: { count: 0, revenue: 0, processingFees: 0, taxes: 0, chargebacks: 0, netRevenue: 0, creatorAmount: 0 },
    book: { count: 0, revenue: 0, processingFees: 0, taxes: 0, chargebacks: 0, netRevenue: 0, creatorAmount: 0 },
    album: { count: 0, revenue: 0, processingFees: 0, taxes: 0, chargebacks: 0, netRevenue: 0, creatorAmount: 0 },
    video: { count: 0, revenue: 0, processingFees: 0, taxes: 0, chargebacks: 0, netRevenue: 0, creatorAmount: 0 },
    subscription: { count: 0, revenue: 0, processingFees: 0, taxes: 0, chargebacks: 0, netRevenue: 0, creatorAmount: 0 },
  };

  const breakdown = walletSnapshot.breakdown.reduce((acc, row) => {
    const key = String(row?.key || "").trim().toLowerCase();
    if (!acc[key]) {
      acc[key] = {
        count: 0,
        revenue: 0,
        processingFees: 0,
        taxes: 0,
        chargebacks: 0,
        netRevenue: 0,
        creatorAmount: 0,
      };
    }

    acc[key] = {
      count: Number(row?.transactions || 0),
      revenue: Number(row?.grossRevenue || 0),
      processingFees: Number(row?.processingFees || 0),
      taxes: Number(row?.taxes || 0),
      chargebacks: Number(row?.chargebacks || 0),
      netRevenue: Number(row?.netRevenue ?? row?.grossRevenue ?? 0),
      creatorAmount: Number(row?.creatorEarnings || 0),
    };
    return acc;
  }, seededBreakdown);

  return res.json({
    totalSalesCount,
    totalRevenue: Number(walletSnapshot.summary?.grossRevenue || 0),
    processingFees: Number(walletSnapshot.summary?.processingFees || 0),
    taxes: Number(walletSnapshot.summary?.taxes || 0),
    chargebacks: Number(walletSnapshot.summary?.chargebacks || 0),
    netRevenue: Number(
      walletSnapshot.summary?.netRevenue ?? walletSnapshot.summary?.grossRevenue ?? 0
    ),
    totalCreatorEarnings: Number(walletSnapshot.summary?.totalEarnings || 0),
    platformRevenue: Number(walletSnapshot.summary?.platformRevenue || 0),
    availableBalance: Number(walletSnapshot.summary?.availableBalance || 0),
    spendableBalance: Number(walletSnapshot.summary?.spendableBalance || 0),
    recoverableBalance: Number(walletSnapshot.summary?.recoverableBalance || 0),
    debtBalance: Number(walletSnapshot.summary?.debtBalance || 0),
    pendingBalance: Number(walletSnapshot.summary?.pendingBalance || 0),
    withdrawn: Number(walletSnapshot.summary?.withdrawn || 0),
    currency: walletSnapshot.currency || "NGN",
    walletBacked: Boolean(walletSnapshot.walletBacked),
    settlementSource: walletSnapshot.settlementSource || "purchase_fallback",
    breakdown,
    recentSales: walletSnapshot.recentEntries,
    recentEntries: walletSnapshot.recentEntries,
  });
});
