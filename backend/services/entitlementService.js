const mongoose = require("mongoose");
const Purchase = require("../models/Purchase");
const Entitlement = require("../models/Entitlement");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const hasEntitlement = async ({ userId, itemType, itemId }) => {
  if (!userId || !itemType || !itemId) {
    return false;
  }

  if (!isValidObjectId(userId) || !isValidObjectId(itemId)) {
    return false;
  }

  const entitlement = await Entitlement.exists({
    buyerId: userId,
    itemType,
    itemId,
  });
  if (entitlement) {
    return true;
  }

  const exists = await Purchase.exists({
    userId,
    itemType,
    itemId,
    status: "paid",
  });

  return Boolean(exists);
};

const getUserPaidPurchases = async (userId) => {
  if (!isValidObjectId(userId)) {
    return [];
  }

  const [purchases, directEntitlements] = await Promise.all([
    Purchase.find({
      userId,
      status: "paid",
    })
    .sort({ paidAt: -1, createdAt: -1 })
    .lean(),
    Entitlement.find({ buyerId: userId }).sort({ grantedAt: -1 }).lean(),
  ]);

  if (!directEntitlements.length) {
    return purchases;
  }

  const existingKeys = new Set(
    purchases.map((row) => `${row.itemType}:${String(row.itemId || "")}`)
  );
  const synthesized = directEntitlements
    .filter((row) => !existingKeys.has(`${row.itemType}:${String(row.itemId || "")}`))
    .map((row) => ({
      _id: row._id,
      userId: row.buyerId,
      itemType: row.itemType,
      itemId: row.itemId,
      status: "paid",
      amount: 0,
      currency: "NGN",
      provider: "manual",
      providerRef: `entitlement-${row._id}`,
      paidAt: row.grantedAt || row.createdAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

  return [...purchases, ...synthesized];
};

module.exports = {
  hasEntitlement,
  getUserPaidPurchases,
};
