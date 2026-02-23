const mongoose = require("mongoose");
const asyncHandler = require("../middleware/asyncHandler");
const Purchase = require("../models/Purchase");
const Track = require("../models/Track");
const Book = require("../models/Book");
const { hasEntitlement } = require("../services/entitlementService");

// TODO(phase2): apply marketplace commission and referral reward splits here.

const toPurchasePayload = (purchase) => ({
  _id: purchase._id.toString(),
  itemType: purchase.itemType,
  itemId: purchase.itemId?.toString?.() || String(purchase.itemId || ""),
  amount: Number(purchase.amount) || 0,
  currency: purchase.currency || "NGN",
  status: purchase.status || "pending",
  provider: purchase.provider || "paystack",
  providerRef: purchase.providerRef || "",
  paidAt: purchase.paidAt || null,
  createdAt: purchase.createdAt,
});

exports.getMyPurchases = asyncHandler(async (req, res) => {
  const purchases = await Purchase.find({ userId: req.user.id })
    .sort({ createdAt: -1 })
    .lean();

  return res.json(purchases.map(toPurchasePayload));
});

exports.checkEntitlement = asyncHandler(async (req, res) => {
  const itemType = String(req.query?.itemType || "").trim().toLowerCase();
  const itemId = String(req.query?.itemId || "").trim();

  if (!itemType || !itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
    return res.status(400).json({ error: "itemType and valid itemId are required" });
  }

  const entitled = await hasEntitlement({
    userId: req.user.id,
    itemType,
    itemId,
  });

  return res.json({
    entitled,
    itemType,
    itemId,
  });
});

exports.getCreatorSales = asyncHandler(async (req, res) => {
  const creatorId = req.creatorProfile._id;

  const [tracks, books] = await Promise.all([
    Track.find({ creatorId }).select("_id").lean(),
    Book.find({ creatorId }).select("_id").lean(),
  ]);

  const trackIds = tracks.map((entry) => entry._id);
  const bookIds = books.map((entry) => entry._id);

  const paidQuery = {
    status: "paid",
    $or: [
      { itemType: "track", itemId: { $in: trackIds } },
      { itemType: "book", itemId: { $in: bookIds } },
    ],
  };

  const [summaryRows, recentSales] = await Promise.all([
    Purchase.aggregate([
      { $match: paidQuery },
      {
        $group: {
          _id: "$itemType",
          count: { $sum: 1 },
          revenue: { $sum: "$amount" },
        },
      },
    ]),
    Purchase.find(paidQuery)
      .sort({ paidAt: -1, createdAt: -1 })
      .limit(30)
      .lean(),
  ]);

  let totalSalesCount = 0;
  let totalRevenue = 0;
  const breakdown = {
    track: { count: 0, revenue: 0 },
    book: { count: 0, revenue: 0 },
  };

  for (const row of summaryRows) {
    const key = row._id === "book" ? "book" : "track";
    const count = Number(row.count) || 0;
    const revenue = Number(row.revenue) || 0;
    breakdown[key] = { count, revenue };
    totalSalesCount += count;
    totalRevenue += revenue;
  }

  return res.json({
    totalSalesCount,
    totalRevenue,
    currency: "NGN",
    breakdown,
    recentSales: recentSales.map(toPurchasePayload),
  });
});
