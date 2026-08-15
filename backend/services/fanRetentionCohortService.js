const AnalyticsEvent = require("../models/AnalyticsEvent");
const Purchase = require("../models/Purchase");
const User = require("../models/User");

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ANALYTICS_ROWS = 100000;

const COHORT_DEFINITIONS = Object.freeze([
  { key: "first_follow", label: "New fan after first follow" },
  { key: "first_purchase", label: "New buyer after first purchase" },
  { key: "first_subscription_renewal", label: "Subscriber after first renewal cycle" },
  { key: "first_live_join", label: "Live viewer after first live join" },
  { key: "first_completion", label: "Reader or listener after first completion" },
]);

const toId = (value) => {
  if (!value) return "";
  if (value._id && value._id !== value) return toId(value._id);
  return String(value);
};

const toDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const roundRate = (value) => Number(Math.max(0, Math.min(1, Number(value || 0))).toFixed(4));

const buildDateRange = ({ range = "30d", startDate = "", endDate = "", now = new Date() } = {}) => {
  const end = range === "custom" ? toDate(endDate) : new Date(now);
  if (!end) throw new Error("Invalid analytics end date");
  if (range === "custom") end.setHours(23, 59, 59, 999);

  let start;
  if (range === "custom") {
    start = toDate(startDate);
    if (!start) throw new Error("Invalid analytics start date");
    start.setHours(0, 0, 0, 0);
  } else if (range === "today") {
    start = new Date(end);
    start.setHours(0, 0, 0, 0);
  } else if (range === "year") {
    start = new Date(end.getFullYear(), 0, 1);
  } else {
    const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
    start = new Date(end.getTime() - (days - 1) * DAY_MS);
    start.setHours(0, 0, 0, 0);
  }
  if (start > end) throw new Error("Invalid analytics date range");
  return { range, start, end };
};

const groupRowsByUser = (rows = [], dateReader = (row) => row.createdAt) => {
  const byUser = new Map();
  for (const row of rows) {
    const userId = toId(row?.userId);
    const occurredAt = toDate(dateReader(row));
    if (!userId || !occurredAt) continue;
    const entries = byUser.get(userId) || [];
    entries.push({ ...row, occurredAt });
    byUser.set(userId, entries);
  }
  for (const entries of byUser.values()) {
    entries.sort((left, right) => left.occurredAt - right.occurredAt);
  }
  return byUser;
};

const firstEventByUser = (eventRows = [], acceptedTypes = []) => {
  const typeSet = new Set(acceptedTypes);
  const earliest = new Map();
  for (const event of eventRows) {
    if (!typeSet.has(String(event?.type || ""))) continue;
    const userId = toId(event?.userId);
    const occurredAt = toDate(event?.createdAt);
    if (!userId || !occurredAt) continue;
    if (!earliest.has(userId) || occurredAt < earliest.get(userId)) earliest.set(userId, occurredAt);
  }
  return earliest;
};

const buildCohortEntries = ({ eventRows = [], purchaseRows = [], start, end } = {}) => {
  const purchasesByUser = groupRowsByUser(
    purchaseRows.filter((purchase) => String(purchase?.status || "") === "paid"),
    (purchase) => purchase.paidAt || purchase.createdAt
  );
  const firstPurchase = new Map();
  const firstRenewal = new Map();
  for (const [userId, purchases] of purchasesByUser.entries()) {
    if (purchases[0]) firstPurchase.set(userId, purchases[0].occurredAt);
    const subscriptions = purchases.filter(
      (purchase) => String(purchase?.itemType || "").toLowerCase() === "subscription"
    );
    const subscriptionsByPlan = new Map();
    for (const subscription of subscriptions) {
      const planKey = toId(subscription.creatorId || subscription.itemId) || "unknown";
      const planPurchases = subscriptionsByPlan.get(planKey) || [];
      planPurchases.push(subscription);
      subscriptionsByPlan.set(planKey, planPurchases);
    }
    const renewalDates = Array.from(subscriptionsByPlan.values())
      .map((planPurchases) => planPurchases[1]?.occurredAt)
      .filter(Boolean)
      .sort((left, right) => left - right);
    if (renewalDates[0]) firstRenewal.set(userId, renewalDates[0]);
  }

  const maps = {
    first_follow: firstEventByUser(eventRows, ["creator_followed"]),
    first_purchase: firstPurchase,
    first_subscription_renewal: firstRenewal,
    first_live_join: firstEventByUser(eventRows, ["live_joined"]),
    first_completion: firstEventByUser(eventRows, ["track_stream_completed", "book_downloaded"]),
  };

  return Object.fromEntries(
    Object.entries(maps).map(([key, entries]) => [
      key,
      Array.from(entries.entries())
        .filter(([, entryAt]) => entryAt >= start && entryAt <= end)
        .map(([userId, entryAt]) => ({ userId, entryAt })),
    ])
  );
};

const hasActivityInWindow = (timestamps = [], startMs, endMs) =>
  timestamps.some((timestamp) => timestamp >= startMs && timestamp < endMs);

const notificationOptedOut = (prefs = {}) => {
  const values = Object.values(prefs && typeof prefs === "object" ? prefs : {});
  return values.length > 0 && values.some((value) => value === false);
};

const buildFanRetentionCohortsFromRows = ({
  eventRows = [],
  purchaseRows = [],
  users = [],
  start,
  end,
  observedThrough = new Date(),
} = {}) => {
  const rangeStart = toDate(start);
  const rangeEnd = toDate(end);
  if (!rangeStart || !rangeEnd) throw new Error("Invalid retention cohort range");
  const requestedObservationEnd = toDate(observedThrough) || rangeEnd;
  const observationEnd = new Date(Math.max(requestedObservationEnd.getTime(), rangeEnd.getTime()));
  const observableEventRows = eventRows.filter(
    (event) => (toDate(event?.createdAt)?.getTime() || 0) <= observationEnd.getTime()
  );
  const observablePurchaseRows = purchaseRows.filter(
    (purchase) => (toDate(purchase?.paidAt || purchase?.createdAt)?.getTime() || 0) <= observationEnd.getTime()
  );

  const entriesByCohort = buildCohortEntries({
    eventRows: observableEventRows,
    purchaseRows: observablePurchaseRows,
    start: rangeStart,
    end: rangeEnd,
  });
  const eventActivityByUser = groupRowsByUser(observableEventRows).entries();
  const activityMap = new Map(
    Array.from(eventActivityByUser).map(([userId, rows]) => [
      userId,
      rows.map((row) => row.occurredAt.getTime()),
    ])
  );
  const purchasesByUser = groupRowsByUser(
    observablePurchaseRows.filter((purchase) => String(purchase?.status || "") === "paid"),
    (purchase) => purchase.paidAt || purchase.createdAt
  );
  const prefsByUser = new Map(users.map((user) => [toId(user?._id || user?.id), user?.notificationPrefs || {}]));

  const cohorts = COHORT_DEFINITIONS.map((definition) => {
    const members = entriesByCohort[definition.key] || [];
    const retention = {};
    for (const day of [1, 7, 30]) {
      const matureMembers = members.filter(
        (member) => member.entryAt.getTime() + day * DAY_MS <= observationEnd.getTime()
      );
      const returned = matureMembers.filter((member) => {
        const activity = activityMap.get(member.userId) || [];
        const windowStart = member.entryAt.getTime() + day * DAY_MS;
        return hasActivityInWindow(activity, windowStart, windowStart + DAY_MS);
      }).length;
      retention[`d${day}`] = {
        eligible: matureMembers.length,
        returned,
        rate: roundRate(matureMembers.length ? returned / matureMembers.length : 0),
        mature: matureMembers.length > 0,
      };
    }

    let repeatPurchasers = 0;
    let subscriptionConversions = 0;
    let followConversions = 0;
    let notificationOptOuts = 0;
    for (const member of members) {
      const laterPurchases = (purchasesByUser.get(member.userId) || []).filter(
        (purchase) => purchase.occurredAt > member.entryAt
      );
      if (laterPurchases.length) repeatPurchasers += 1;
      if (laterPurchases.some((purchase) => String(purchase.itemType || "").toLowerCase() === "subscription")) {
        subscriptionConversions += 1;
      }
      if (observableEventRows.some((event) =>
        toId(event?.userId) === member.userId &&
        String(event?.type || "") === "creator_followed" &&
        toDate(event?.createdAt) > member.entryAt
      )) {
        followConversions += 1;
      }
      if (notificationOptedOut(prefsByUser.get(member.userId))) notificationOptOuts += 1;
    }

    return {
      ...definition,
      entrants: members.length,
      retention,
      repeatPurchaseRate: roundRate(members.length ? repeatPurchasers / members.length : 0),
      subscriptionConversionRate: roundRate(members.length ? subscriptionConversions / members.length : 0),
      creatorFollowConversionRate: roundRate(members.length ? followConversions / members.length : 0),
      notificationOptOutRate: roundRate(members.length ? notificationOptOuts / members.length : 0),
    };
  });

  const entrants = cohorts.reduce((sum, cohort) => sum + cohort.entrants, 0);
  const weighted = (reader) => roundRate(
    entrants
      ? cohorts.reduce((sum, cohort) => sum + reader(cohort) * cohort.entrants, 0) / entrants
      : 0
  );
  const summarizeRetention = (day) => {
    const totals = cohorts.reduce(
      (summary, cohort) => ({
        eligible: summary.eligible + Number(cohort.retention[day]?.eligible || 0),
        returned: summary.returned + Number(cohort.retention[day]?.returned || 0),
      }),
      { eligible: 0, returned: 0 }
    );
    return {
      ...totals,
      rate: roundRate(totals.eligible ? totals.returned / totals.eligible : 0),
    };
  };
  const d1 = summarizeRetention("d1");
  const d7 = summarizeRetention("d7");
  const d30 = summarizeRetention("d30");
  const matureD7 = cohorts.filter((cohort) => cohort.retention.d7.mature);
  const weakestD7 = [...matureD7].sort(
    (left, right) => left.retention.d7.rate - right.retention.d7.rate
  )[0] || null;
  const highestOptOut = [...cohorts]
    .filter((cohort) => cohort.entrants > 0)
    .sort((left, right) => right.notificationOptOutRate - left.notificationOptOutRate)[0] || null;

  return {
    window: {
      startDate: rangeStart.toISOString(),
      endDate: rangeEnd.toISOString(),
      observedThrough: observationEnd.toISOString(),
      maturityRule: "D1, D7, and D30 use the 24-hour activity window beginning on that cohort day.",
    },
    summary: {
      entrants,
      d1Eligible: d1.eligible,
      d1Returned: d1.returned,
      d1RetentionRate: d1.rate,
      d7Eligible: d7.eligible,
      d7Returned: d7.returned,
      d7RetentionRate: d7.rate,
      d30Eligible: d30.eligible,
      d30Returned: d30.returned,
      d30RetentionRate: d30.rate,
      repeatPurchaseRate: weighted((cohort) => cohort.repeatPurchaseRate),
      subscriptionConversionRate: weighted((cohort) => cohort.subscriptionConversionRate),
      creatorFollowConversionRate: weighted((cohort) => cohort.creatorFollowConversionRate),
      notificationOptOutRate: weighted((cohort) => cohort.notificationOptOutRate),
    },
    cohorts,
    priorities: [
      weakestD7
        ? {
            key: "weakest_d7_cohort",
            title: `Improve ${weakestD7.label.toLowerCase()} return paths`,
            detail: `D7 retention is ${(weakestD7.retention.d7.rate * 100).toFixed(1)}% across ${weakestD7.retention.d7.eligible} mature entrants.`,
            actionPath: "/admin/analytics",
          }
        : null,
      highestOptOut && highestOptOut.notificationOptOutRate > 0
        ? {
            key: "notification_opt_out",
            title: `Review notification pressure for ${highestOptOut.label.toLowerCase()}`,
            detail: `${(highestOptOut.notificationOptOutRate * 100).toFixed(1)}% have at least one notification category disabled.`,
            actionPath: "/admin/analytics",
          }
        : null,
    ].filter(Boolean),
  };
};

const buildFanRetentionCohorts = async ({ range, startDate, endDate, observedThrough } = {}) => {
  const dates = buildDateRange({ range, startDate, endDate });
  const observationEnd = toDate(observedThrough) || dates.end;
  const [rawEventRows, rawPurchaseRows] = await Promise.all([
    AnalyticsEvent.find({
      userId: { $ne: null },
      createdAt: { $lte: observationEnd },
    })
      .select("userId type createdAt targetId targetType contentType metadata")
      .sort({ createdAt: 1 })
      .limit(MAX_ANALYTICS_ROWS + 1)
      .lean(),
    Purchase.find({
      userId: { $ne: null },
      status: "paid",
      createdAt: { $lte: observationEnd },
    })
      .select("userId itemType itemId status paidAt createdAt creatorId")
      .sort({ paidAt: 1, createdAt: 1 })
      .limit(MAX_ANALYTICS_ROWS + 1)
      .lean(),
  ]);
  const eventRowsTruncated = rawEventRows.length > MAX_ANALYTICS_ROWS;
  const purchaseRowsTruncated = rawPurchaseRows.length > MAX_ANALYTICS_ROWS;
  const eventRows = rawEventRows.slice(0, MAX_ANALYTICS_ROWS);
  const purchaseRows = rawPurchaseRows.slice(0, MAX_ANALYTICS_ROWS);
  const cohortEntries = buildCohortEntries({
    eventRows,
    purchaseRows,
    start: dates.start,
    end: dates.end,
  });
  const userIds = Array.from(
    new Set(Object.values(cohortEntries).flat().map((entry) => entry.userId))
  );
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select("notificationPrefs").lean()
    : [];

  return {
    filters: {
      range: dates.range,
      startDate: dates.start.toISOString(),
      endDate: dates.end.toISOString(),
    },
    ...buildFanRetentionCohortsFromRows({
      eventRows,
      purchaseRows,
      users,
      start: dates.start,
      end: dates.end,
      observedThrough: observationEnd,
    }),
    dataQuality: {
      complete: !eventRowsTruncated && !purchaseRowsTruncated,
      eventRows: eventRows.length,
      purchaseRows: purchaseRows.length,
      eventRowsTruncated,
      purchaseRowsTruncated,
      rowLimit: MAX_ANALYTICS_ROWS,
    },
  };
};

module.exports = {
  COHORT_DEFINITIONS,
  buildDateRange,
  buildFanRetentionCohorts,
  buildFanRetentionCohortsFromRows,
};
