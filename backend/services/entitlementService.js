const mongoose = require("mongoose");
const Purchase = require("../models/Purchase");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const hasEntitlement = async ({ userId, itemType, itemId }) => {
  if (!userId || !itemType || !itemId) {
    return false;
  }

  if (!isValidObjectId(userId) || !isValidObjectId(itemId)) {
    return false;
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

  const purchases = await Purchase.find({
    userId,
    status: "paid",
  })
    .sort({ paidAt: -1, createdAt: -1 })
    .lean();

  return purchases;
};

module.exports = {
  hasEntitlement,
  getUserPaidPurchases,
};
