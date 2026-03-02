const DailyAnalytics = require("../models/DailyAnalytics");
const User = require("../models/User");

const formatDateKey = (date = new Date()) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const incrementDailyMetric = async (field, amount = 1) => {
  if (!field) return null;
  const date = formatDateKey();
  return DailyAnalytics.findOneAndUpdate(
    { date },
    { $inc: { [field]: Number(amount) || 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

const recomputeUserStats = async ({ date = new Date() } = {}) => {
  const dateKey = formatDateKey(date);
  const startOfDay = new Date(`${dateKey}T00:00:00.000Z`);
  const endOfDay = new Date(`${dateKey}T23:59:59.999Z`);
  const monthAgo = new Date(endOfDay.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [dau, mau, newUsers] = await Promise.all([
    User.countDocuments({ lastLogin: { $gte: startOfDay, $lte: endOfDay } }),
    User.countDocuments({ lastLogin: { $gte: monthAgo, $lte: endOfDay } }),
    User.countDocuments({ createdAt: { $gte: startOfDay, $lte: endOfDay } }),
  ]);

  return DailyAnalytics.findOneAndUpdate(
    { date: dateKey },
    { $set: { dau, mau, newUsers } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

module.exports = {
  formatDateKey,
  incrementDailyMetric,
  recomputeUserStats,
};
