const mongoose = require("mongoose");
const CreatorProfile = require("../models/CreatorProfile");
const Purchase = require("../models/Purchase");
const { buildDateRange } = require("./analyticsService");
const { buildPurchaseLifecyclePayload } = require("./purchaseLifecycleService");

const CREATOR_SHARE_RATE = 0.4;

const toId = (value = "") => {
  if (!value) return "";
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (typeof value === "string") return value;
  if (value._id && value._id !== value) return toId(value._id);
  return String(value);
};

const toObjectId = (value = "") => {
  const normalized = toId(value);
  return mongoose.Types.ObjectId.isValid(normalized)
    ? new mongoose.Types.ObjectId(normalized)
    : null;
};

const toDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toNumber = (value = 0) => Math.max(0, Number(value || 0));
const toMoney = (value = 0) => Math.max(0, Math.round(Number(value || 0)));

const toPercent = (numerator = 0, denominator = 0) =>
  denominator > 0 ? Number(((toNumber(numerator) / toNumber(denominator)) * 100).toFixed(1)) : 0;

const isPaidSubscription = (purchase = {}) =>
  String(purchase?.itemType || "").trim().toLowerCase() === "subscription" &&
  String(purchase?.status || "").trim().toLowerCase() === "paid";

const getPurchaseDate = (purchase = {}) =>
  toDate(purchase.paidAt) || toDate(purchase.createdAt) || toDate(purchase.updatedAt);

const isWithin = (date, { start, end } = {}) => {
  const parsed = toDate(date);
  if (!parsed) return false;
  return parsed.getTime() >= start.getTime() && parsed.getTime() <= end.getTime();
};

const hasAccessAt = (purchase = {}, at = new Date()) => {
  if (!isPaidSubscription(purchase)) return false;

  const purchaseDate = getPurchaseDate(purchase);
  const target = new Date(at);
  if (purchaseDate && purchaseDate.getTime() > target.getTime()) {
    return false;
  }

  const expiresAt = toDate(purchase.accessExpiresAt);
  return !expiresAt || expiresAt.getTime() > target.getTime();
};

const getMonthKey = (date) => {
  const parsed = toDate(date);
  if (!parsed) return "unknown";
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}`;
};

const buildBuyerPayload = (user = null) => {
  if (!user || typeof user !== "object") return null;
  return {
    id: toId(user._id || user),
    name: user.name || user.username || "Fan",
    username: user.username || "",
    avatar: typeof user.avatar === "string" ? user.avatar : user.avatar?.url || "",
  };
};

const groupSubscriptionsByBuyer = (purchases = []) => {
  const grouped = new Map();

  for (const purchase of purchases) {
    const userId = toId(purchase?.userId?._id || purchase?.userId);
    if (!userId || !isPaidSubscription(purchase)) continue;

    const current = grouped.get(userId) || {
      userId,
      buyer: buildBuyerPayload(purchase.userId),
      purchases: [],
    };
    current.purchases.push(purchase);
    grouped.set(userId, current);
  }

  return Array.from(grouped.values()).map((entry) => ({
    ...entry,
    purchases: entry.purchases.sort(
      (left, right) => getPurchaseDate(left)?.getTime() - getPurchaseDate(right)?.getTime()
    ),
  }));
};

const buildCohortRevenue = ({ buyerGroups = [], dates, endDate }) => {
  const cohorts = new Map();

  for (const group of buyerGroups) {
    const firstPurchase = group.purchases[0];
    const firstPaidAt = getPurchaseDate(firstPurchase);
    const cohort = getMonthKey(firstPaidAt);
    const entry = cohorts.get(cohort) || {
      cohort,
      subscribers: 0,
      revenue: 0,
      creatorRevenue: 0,
      purchases: 0,
      repeatSubscribers: 0,
      retainedSubscribers: 0,
      churnedSubscribers: 0,
    };

    const purchasesInRange = group.purchases.filter((purchase) => isWithin(getPurchaseDate(purchase), dates));
    const totalRevenue = group.purchases.reduce((sum, purchase) => sum + toMoney(purchase.amount), 0);
    const activeAtEnd = group.purchases.some((purchase) => hasAccessAt(purchase, endDate));

    entry.subscribers += 1;
    entry.revenue += totalRevenue;
    entry.creatorRevenue += toMoney(totalRevenue * CREATOR_SHARE_RATE);
    entry.purchases += group.purchases.length;
    if (group.purchases.length > 1) {
      entry.repeatSubscribers += 1;
    }
    if (activeAtEnd) {
      entry.retainedSubscribers += 1;
    } else {
      entry.churnedSubscribers += 1;
    }
    entry.rangeRevenue = toMoney(toNumber(entry.rangeRevenue) + purchasesInRange.reduce((sum, purchase) => sum + toMoney(purchase.amount), 0));

    cohorts.set(cohort, entry);
  }

  return Array.from(cohorts.values())
    .map((entry) => ({
      ...entry,
      averageRevenuePerSubscriber: entry.subscribers
        ? toMoney(entry.revenue / entry.subscribers)
        : 0,
      repeatSubscriberRate: toPercent(entry.repeatSubscribers, entry.subscribers),
      retentionRate: toPercent(entry.retainedSubscribers, entry.subscribers),
      churnRate: toPercent(entry.churnedSubscribers, entry.subscribers),
    }))
    .sort((left, right) => String(right.cohort).localeCompare(String(left.cohort)));
};

const buildActionPrompts = ({ summary = {} } = {}) => {
  const prompts = [];

  if (!summary.totalSubscribers) {
    prompts.push({
      key: "subscription_no_subscribers",
      title: "Package a subscriber offer",
      description: "No paid memberships are visible yet. Make the benefit and monthly value obvious before promoting it.",
      actionLabel: "Edit subscription",
      actionTo: "/creator/settings",
      tone: "warning",
    });
    return prompts;
  }

  if (summary.churnRate >= 25) {
    prompts.push({
      key: "subscription_churn_attention",
      title: "Review subscriber retention",
      description: "Subscriber churn is elevated in this range. Check benefit cadence, renewal reminders, and exclusive drops.",
      actionLabel: "Review offer",
      actionTo: "/creator/settings",
      tone: "warning",
    });
  }

  if (summary.newSubscribers > 0) {
    prompts.push({
      key: "subscription_new_member_momentum",
      title: "Welcome new subscribers",
      description: "New supporters joined in this range. Follow up with a member-only update while intent is fresh.",
      actionLabel: "Open dashboard",
      actionTo: "/creator/dashboard",
      tone: "success",
    });
  }

  if (summary.repeatSubscriberRate >= 30) {
    prompts.push({
      key: "subscription_repeat_loyalty",
      title: "Reward repeat supporters",
      description: "Repeat subscriber activity is strong. Consider a loyalty perk or early access drop.",
      actionLabel: "Plan benefit",
      actionTo: "/creator/settings",
      tone: "success",
    });
  }

  if (summary.cancelScheduledSubscribers > 0) {
    prompts.push({
      key: "subscription_cancel_scheduled",
      title: "Win back cancelling subscribers",
      description: "Some active subscribers are scheduled to end at period close. Ship one clear value update before expiry.",
      actionLabel: "Review members",
      actionTo: "/creator/earnings",
      tone: "neutral",
    });
  }

  return prompts.slice(0, 4);
};

const buildCreatorSubscriptionAnalytics = async ({
  profile,
  range = "30d",
  startDate,
  endDate,
  at = new Date(),
} = {}) => {
  const creatorObjectId = toObjectId(profile?._id);
  if (!creatorObjectId) {
    return {
      filters: { range: "30d" },
      summary: {},
      cohortRevenue: [],
      repeatBuyerIndicators: {},
      recentSubscribers: [],
      actionPrompts: [],
    };
  }

  const dates = buildDateRange({ range, startDate, endDate });
  const statusDate = toDate(at) || new Date();
  const paidRows = await Purchase.find({
    creatorId: creatorObjectId,
    itemType: "subscription",
    status: "paid",
  })
    .populate("userId", "name username avatar")
    .sort({ paidAt: 1, createdAt: 1, _id: 1 })
    .lean();

  const buyerGroups = groupSubscriptionsByBuyer(paidRows);
  const rangeRows = paidRows.filter((purchase) => isWithin(getPurchaseDate(purchase), dates));
  const startingSubscribers = buyerGroups.filter((group) =>
    group.purchases.some((purchase) => hasAccessAt(purchase, dates.start))
  );
  const retainedSubscribers = startingSubscribers.filter((group) =>
    group.purchases.some((purchase) => hasAccessAt(purchase, dates.end))
  );
  const churnedSubscribers = startingSubscribers.filter((group) =>
    !group.purchases.some((purchase) => hasAccessAt(purchase, dates.end))
  );
  const activeSubscribers = buyerGroups.filter((group) =>
    group.purchases.some((purchase) => hasAccessAt(purchase, statusDate))
  );
  const newSubscriberGroups = buyerGroups.filter((group) =>
    isWithin(getPurchaseDate(group.purchases[0]), dates)
  );
  const repeatSubscriberGroups = buyerGroups.filter((group) => group.purchases.length > 1);
  const cancelScheduledSubscribers = activeSubscribers.filter((group) => {
    const latest = group.purchases[group.purchases.length - 1];
    const lifecycle = buildPurchaseLifecyclePayload(latest, { at: statusDate });
    return lifecycle.cancelAtPeriodEnd;
  });
  const expiredSubscribers = buyerGroups.filter((group) => {
    const latest = group.purchases[group.purchases.length - 1];
    const lifecycle = buildPurchaseLifecyclePayload(latest, { at: statusDate });
    return lifecycle.lifecycleStatus === "expired";
  });
  const gracePeriodSubscribers = activeSubscribers.filter((group) => {
    const latest = group.purchases[group.purchases.length - 1];
    const lifecycle = buildPurchaseLifecyclePayload(latest, { at: statusDate });
    return lifecycle.lifecycleStatus === "grace_period";
  });
  const revenueInRange = rangeRows.reduce((sum, purchase) => sum + toMoney(purchase.amount), 0);
  const renewalsInRange = rangeRows.filter((purchase) => {
    const buyerId = toId(purchase?.userId?._id || purchase?.userId);
    const group = buyerGroups.find((entry) => entry.userId === buyerId);
    return group && group.purchases[0]?._id?.toString?.() !== purchase._id?.toString?.();
  });

  const summary = {
    totalSubscribers: buyerGroups.length,
    activeSubscribers: activeSubscribers.length,
    startingSubscribers: startingSubscribers.length,
    newSubscribers: newSubscriberGroups.length,
    retainedSubscribers: retainedSubscribers.length,
    churnedSubscribers: churnedSubscribers.length,
    cancelScheduledSubscribers: cancelScheduledSubscribers.length,
    gracePeriodSubscribers: gracePeriodSubscribers.length,
    expiredSubscribers: expiredSubscribers.length,
    renewalPurchases: renewalsInRange.length,
    revenue: revenueInRange,
    creatorRevenue: toMoney(revenueInRange * CREATOR_SHARE_RATE),
    retentionRate: toPercent(retainedSubscribers.length, startingSubscribers.length),
    churnRate: toPercent(churnedSubscribers.length, startingSubscribers.length),
    newSubscriberRate: toPercent(newSubscriberGroups.length, buyerGroups.length),
    repeatSubscribers: repeatSubscriberGroups.length,
    repeatSubscriberRate: toPercent(repeatSubscriberGroups.length, buyerGroups.length),
    averageRevenuePerSubscriber: buyerGroups.length
      ? toMoney(paidRows.reduce((sum, purchase) => sum + toMoney(purchase.amount), 0) / buyerGroups.length)
      : 0,
  };

  const recentSubscribers = rangeRows
    .slice()
    .sort((left, right) => getPurchaseDate(right)?.getTime() - getPurchaseDate(left)?.getTime())
    .slice(0, 8)
    .map((purchase) => {
      const lifecycle = buildPurchaseLifecyclePayload(purchase, { at: statusDate });
      return {
        purchaseId: toId(purchase._id),
        buyer: buildBuyerPayload(purchase.userId),
        amount: toMoney(purchase.amount),
        creatorAmount: toMoney(toMoney(purchase.amount) * CREATOR_SHARE_RATE),
        currency: purchase.currency || "NGN",
        lifecycleStatus: lifecycle.lifecycleStatus,
        accessExpiresAt: lifecycle.expiresAt || purchase.accessExpiresAt || null,
        paidAt: getPurchaseDate(purchase),
      };
    });

  return {
    filters: {
      range: dates.range,
      startDate: dates.start,
      endDate: dates.end,
    },
    summary,
    cohortRevenue: buildCohortRevenue({
      buyerGroups,
      dates,
      endDate: dates.end,
    }),
    repeatBuyerIndicators: {
      repeatSubscribers: summary.repeatSubscribers,
      repeatSubscriberRate: summary.repeatSubscriberRate,
      renewalPurchases: summary.renewalPurchases,
      averageRevenuePerSubscriber: summary.averageRevenuePerSubscriber,
    },
    recentSubscribers,
    actionPrompts: buildActionPrompts({ summary }),
  };
};

const buildCreatorSubscriptionAnalyticsForUser = async ({
  userId,
  range = "30d",
  startDate,
  endDate,
  at = new Date(),
} = {}) => {
  const profile = await CreatorProfile.findOne({ userId }).lean();
  if (!profile) {
    const error = new Error("Creator profile not found");
    error.statusCode = 404;
    throw error;
  }

  return buildCreatorSubscriptionAnalytics({
    profile,
    range,
    startDate,
    endDate,
    at,
  });
};

module.exports = {
  buildCreatorSubscriptionAnalytics,
  buildCreatorSubscriptionAnalyticsForUser,
};
