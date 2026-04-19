const mongoose = require("mongoose");

const MarketplaceOrder = require("../models/MarketplaceOrder");
const MarketplacePayout = require("../models/MarketplacePayout");

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

const serializePayout = (payout = {}, order = null) => ({
  _id: toIdString(payout._id),
  sellerId: toIdString(payout.seller),
  orderId: toIdString(payout.order),
  orderReference: order?.paymentReference || "",
  grossAmount: Number(payout.grossAmount || 0),
  platformFee: Number(payout.platformFee || 0),
  netAmount: Number(payout.netAmount || 0),
  payoutStatus: payout.payoutStatus || "pending",
  payoutReference: payout.payoutReference || "",
  paidAt: payout.paidAt || null,
  notes: payout.notes || "",
  createdAt: payout.createdAt || null,
});

const createPayoutForPaidOrder = async ({ order } = {}) => {
  if (!order?._id) {
    throw new Error("Marketplace order is required");
  }

  return MarketplacePayout.findOneAndUpdate(
    { order: order._id },
    {
      $setOnInsert: {
        seller: order.seller,
        order: order._id,
        grossAmount: Number(order.totalPrice || 0),
        platformFee: Number(order.platformFee || 0),
        netAmount: Number(order.sellerReceivable || 0),
        payoutStatus: "pending",
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
};

const getSellerPayoutSummary = async (sellerId) => {
  const objectId = new mongoose.Types.ObjectId(sellerId);
  const [summary] = await MarketplacePayout.aggregate([
    { $match: { seller: objectId } },
    {
      $group: {
        _id: null,
        totalSales: { $sum: "$grossAmount" },
        totalPlatformFees: { $sum: "$platformFee" },
        totalNetReceivable: { $sum: "$netAmount" },
        totalCompletedOrders: { $sum: 1 },
      },
    },
  ]);

  return {
    totalSales: Number(summary?.totalSales || 0),
    totalPlatformFees: Number(summary?.totalPlatformFees || 0),
    totalNetReceivable: Number(summary?.totalNetReceivable || 0),
    totalCompletedOrders: Number(summary?.totalCompletedOrders || 0),
  };
};

const listSellerPayouts = async (sellerId, { page = 1, limit = 20 } = {}) => {
  const safePage = Math.max(1, Number(page || 1));
  const safeLimit = Math.min(50, Math.max(1, Number(limit || 20)));
  const skip = (safePage - 1) * safeLimit;

  const [rows, total] = await Promise.all([
    MarketplacePayout.find({ seller: sellerId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate("order", "paymentReference")
      .lean(),
    MarketplacePayout.countDocuments({ seller: sellerId }),
  ]);

  return {
    page: safePage,
    limit: safeLimit,
    total,
    payouts: rows.map((row) => serializePayout(row, row.order)),
  };
};

const getAdminPayoutOverview = async ({ page = 1, limit = 20, status = "" } = {}) => {
  const safePage = Math.max(1, Number(page || 1));
  const safeLimit = Math.min(50, Math.max(1, Number(limit || 20)));
  const skip = (safePage - 1) * safeLimit;
  const query = status ? { payoutStatus: status } : {};

  const [rows, total, summary] = await Promise.all([
    MarketplacePayout.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate("seller", "storeName slug")
      .populate("order", "paymentReference")
      .lean(),
    MarketplacePayout.countDocuments(query),
    MarketplacePayout.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalGross: { $sum: "$grossAmount" },
          totalFees: { $sum: "$platformFee" },
          totalNet: { $sum: "$netAmount" },
        },
      },
    ]),
  ]);

  return {
    page: safePage,
    limit: safeLimit,
    total,
    summary: {
      totalGross: Number(summary[0]?.totalGross || 0),
      totalFees: Number(summary[0]?.totalFees || 0),
      totalNet: Number(summary[0]?.totalNet || 0),
    },
    payouts: rows.map((row) => ({
      ...serializePayout(row, row.order),
      seller: row.seller
        ? {
            _id: toIdString(row.seller._id),
            storeName: row.seller.storeName || "",
            slug: row.seller.slug || "",
          }
        : null,
    })),
  };
};

const listSellerPaidOrders = (sellerId, { page = 1, limit = 20 } = {}) =>
  MarketplaceOrder.find({
    seller: sellerId,
    paymentStatus: "paid",
  })
    .sort({ createdAt: -1 })
    .skip((Math.max(1, Number(page || 1)) - 1) * Math.min(50, Math.max(1, Number(limit || 20))))
    .limit(Math.min(50, Math.max(1, Number(limit || 20))))
    .lean();

module.exports = {
  createPayoutForPaidOrder,
  getAdminPayoutOverview,
  getSellerPayoutSummary,
  listSellerPaidOrders,
  listSellerPayouts,
  serializePayout,
};
