const mongoose = require("mongoose");
const asyncHandler = require("../middleware/asyncHandler");
const Purchase = require("../models/Purchase");
const { resolvePurchasableItem } = require("../services/catalogService");
const { hasEntitlement } = require("../services/entitlementService");
const { buildCreatorWalletSnapshot } = require("../services/walletService");
const {
  cancelSubscriptionPurchase,
  toPurchasePayload,
} = require("../services/paymentOpsService");

exports.getMyPurchases = asyncHandler(async (req, res) => {
  const purchases = await Purchase.find({ userId: req.user.id })
    .sort({ createdAt: -1 })
    .lean();

  return res.json(purchases.map(toPurchasePayload));
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
    track: { count: 0, revenue: 0, creatorAmount: 0 },
    book: { count: 0, revenue: 0, creatorAmount: 0 },
    album: { count: 0, revenue: 0, creatorAmount: 0 },
    video: { count: 0, revenue: 0, creatorAmount: 0 },
    subscription: { count: 0, revenue: 0, creatorAmount: 0 },
  };

  const breakdown = walletSnapshot.breakdown.reduce((acc, row) => {
    const key = String(row?.key || "").trim().toLowerCase();
    if (!acc[key]) {
      acc[key] = { count: 0, revenue: 0, creatorAmount: 0 };
    }

    acc[key] = {
      count: Number(row?.transactions || 0),
      revenue: Number(row?.grossRevenue || 0),
      creatorAmount: Number(row?.creatorEarnings || 0),
    };
    return acc;
  }, seededBreakdown);

  return res.json({
    totalSalesCount,
    totalRevenue: Number(walletSnapshot.summary?.grossRevenue || 0),
    totalCreatorEarnings: Number(walletSnapshot.summary?.totalEarnings || 0),
    availableBalance: Number(walletSnapshot.summary?.availableBalance || 0),
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
