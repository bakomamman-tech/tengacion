const mongoose = require("mongoose");
const Purchase = require("../models/Purchase");
const Entitlement = require("../models/Entitlement");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const hasCreatorSubscriptionAccess = async ({ userId, creatorId, at = new Date() }) => {
  if (!userId || !creatorId) {
    return false;
  }

  if (!isValidObjectId(userId) || !isValidObjectId(creatorId)) {
    return false;
  }

  const exists = await Purchase.exists({
    userId,
    creatorId,
    itemType: "subscription",
    status: "paid",
    $or: [
      { accessExpiresAt: null },
      { accessExpiresAt: { $gt: at } },
    ],
  });

  return Boolean(exists);
};

const hasEntitlement = async ({ userId, itemType, itemId, creatorId = "" }) => {
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

  const normalizedItemType = String(itemType || "").trim().toLowerCase();
  const exists = await Purchase.exists({
    userId,
    itemType,
    itemId,
    status: "paid",
    ...(normalizedItemType === "subscription"
      ? {
          $or: [
            { accessExpiresAt: null },
            { accessExpiresAt: { $gt: new Date() } },
          ],
        }
      : {}),
  });

  if (exists) {
    return true;
  }

  return hasCreatorSubscriptionAccess({ userId, creatorId });
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

  const now = new Date();
  const activePurchases = purchases.filter((row) => (
    String(row?.itemType || "").trim().toLowerCase() !== "subscription"
      || !row?.accessExpiresAt
      || new Date(row.accessExpiresAt) > now
  ));

  if (!directEntitlements.length) {
    return activePurchases;
  }

  const existingKeys = new Set(
    activePurchases.map((row) => `${row.itemType}:${String(row.itemId || "")}`)
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

  return [...activePurchases, ...synthesized];
};

module.exports = {
  hasEntitlement,
  hasCreatorSubscriptionAccess,
  getUserPaidPurchases,
};
