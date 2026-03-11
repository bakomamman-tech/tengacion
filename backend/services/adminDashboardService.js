const User = require("../models/User");
const Post = require("../models/Post");
const Message = require("../models/Message");
const Purchase = require("../models/Purchase");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const {
  buildDateRange,
  normalizeInterval,
  buildSystemAlerts,
} = require("./analyticsService");

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const APPROVED_USERS = [
  { id: "lorietta-billy", name: "Lorietta Billy", descriptor: "Community Lead" },
  { id: "daniel-stephen-kurah", name: "Daniel Stephen Kurah", descriptor: "Creator Program" },
  { id: "admin-user", name: "Admin User", descriptor: "Platform Admin" },
];

const DEVICE_COLORS = {
  Android: "#63d7c5",
  iOS: "#7b86ff",
  Desktop: "#5aa3ff",
  "Mobile Web": "#b49cff",
  Other: "#8ea2c4",
};

const KPI_ITEMS = [
  { id: "likes", label: "Likes", icon: "heart" },
  { id: "comments", label: "Comments", icon: "comment" },
  { id: "shares", label: "Shares", icon: "share" },
  { id: "saves", label: "Saves", icon: "bookmark" },
  { id: "profileVisits", label: "Profile Visits", icon: "profile" },
  { id: "contentInteractions", label: "Content Interactions", icon: "spark" },
];

const AGE_GROUPS = [
  { label: "13-17", min: 13, max: 17 },
  { label: "18-24", min: 18, max: 24 },
  { label: "25-34", min: 25, max: 34 },
  { label: "35-44", min: 35, max: 44 },
  { label: "45-54", min: 45, max: 54 },
  { label: "55+", min: 55, max: 200 },
];

const rangeOptions = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "year", label: "This year" },
];

const chartTabs = [
  { id: "activity", label: "Activity" },
  { id: "reach", label: "Reach" },
  { id: "share", label: "Share" },
  { id: "shares", label: "Shares" },
  { id: "clicks", label: "Clicks" },
];

const normalizeName = (value = "") => String(value || "").trim().toLowerCase();

const escapeRegex = (value = "") =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getAvatarUrl = (user) => {
  if (!user) return "";
  if (typeof user.avatar === "string") return user.avatar;
  return user.avatar?.url || "";
};

const safeArrayLength = (value) => (Array.isArray(value) ? value.length : 0);

const round = (value, digits = 0) => {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
};

const percent = (value, total) => {
  if (!total) return 0;
  return round((Number(value || 0) / Number(total || 1)) * 100, 1);
};

const formatDateKey = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateKey = (dateKey) => new Date(`${dateKey}T00:00:00.000Z`);

const bucketDateKey = (dateKey, interval = "daily") => {
  const date = parseDateKey(dateKey);
  const normalized = normalizeInterval(interval);
  if (normalized === "daily") return formatDateKey(date);
  if (normalized === "weekly") {
    const day = date.getUTCDay() || 7;
    const weekStart = new Date(date.getTime() - (day - 1) * ONE_DAY_MS);
    return formatDateKey(weekStart);
  }
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

const groupRowsByInterval = (rows = [], interval = "daily") => {
  const normalized = normalizeInterval(interval);
  if (normalized === "daily") {
    return rows
      .map((row) => ({ ...row }))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }

  const grouped = new Map();
  for (const row of rows) {
    const key = bucketDateKey(row.date, normalized);
    const existing = grouped.get(key) || { date: key };
    Object.entries(row).forEach(([field, value]) => {
      if (field === "date") return;
      existing[field] = (Number(existing[field]) || 0) + (Number(value) || 0);
    });
    grouped.set(key, existing);
  }

  return Array.from(grouped.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
};

const averageOfRange = (rows = [], field) => {
  if (!rows.length) return 0;
  return rows.reduce((sum, row) => sum + (Number(row[field]) || 0), 0) / rows.length;
};

const computeChange = (rows = [], field) => {
  if (rows.length < 2) return 0;
  const midpoint = Math.max(1, Math.floor(rows.length / 2));
  const previousAvg = averageOfRange(rows.slice(0, midpoint), field);
  const currentAvg = averageOfRange(rows.slice(midpoint), field);
  if (!previousAvg) {
    return currentAvg > 0 ? 100 : 0;
  }
  return round(((currentAvg - previousAvg) / previousAvg) * 100, 1);
};

const sumField = (rows = [], field) =>
  rows.reduce((sum, row) => sum + (Number(row[field]) || 0), 0);

const latestValue = (rows = [], field) => Number(rows[rows.length - 1]?.[field] || 0);

const hasLiveSeriesData = (rows = []) =>
  rows.some((row) =>
    [
      "activeUsers",
      "postsCount",
      "likes",
      "comments",
      "shares",
      "downloads",
      "streams",
      "messagesSent",
      "contentInteractions",
    ].some((field) => Number(row[field] || 0) > 0)
  );

const computeAge = (dob) => {
  if (!dob) return null;
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - date.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - date.getUTCMonth();
  const dayDiff = today.getUTCDate() - date.getUTCDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }
  return age >= 0 ? age : null;
};

const classifyPrimaryDevice = (userAgent = "", deviceName = "") => {
  const source = `${userAgent} ${deviceName}`.toLowerCase();
  if (source.includes("android")) return "Android";
  if (source.includes("iphone") || source.includes("ipad") || source.includes("ios")) return "iOS";
  if (
    source.includes("windows") ||
    source.includes("macintosh") ||
    source.includes("mac os") ||
    source.includes("linux") ||
    source.includes("x11")
  ) {
    return "Desktop";
  }
  if (source.includes("mobile")) return "Mobile Web";
  return "Other";
};

const classifySecondaryDevice = (userAgent = "", deviceName = "") => {
  const source = `${userAgent} ${deviceName}`.toLowerCase();
  if (
    source.includes("windows") ||
    source.includes("macintosh") ||
    source.includes("mac os") ||
    source.includes("linux") ||
    source.includes("x11")
  ) {
    return "Desktop";
  }
  if (source.includes("mobile")) return "Mobile Web";
  if (source.includes("android")) return "Android";
  if (source.includes("iphone") || source.includes("ipad") || source.includes("ios")) return "iOS";
  return "Other";
};

const getLatestSession = (sessions = []) => {
  if (!Array.isArray(sessions) || !sessions.length) return null;
  return [...sessions]
    .filter((entry) => !entry?.revokedAt)
    .sort(
      (a, b) =>
        new Date(b?.lastSeenAt || b?.createdAt || 0).getTime() -
        new Date(a?.lastSeenAt || a?.createdAt || 0).getTime()
    )[0] || sessions[0];
};

const rangeSubtitle = (range = "30d") => {
  const match = rangeOptions.find((option) => option.value === range);
  return match ? match.label : "Last 30 days";
};

const buildZeroDevices = () => {
  const primary = [
    { label: "Android", value: 0, color: DEVICE_COLORS.Android },
    { label: "iOS", value: 0, color: DEVICE_COLORS.iOS },
    { label: "Other", value: 0, color: DEVICE_COLORS.Other },
  ];
  const secondary = [
    { label: "Desktop", value: 0, color: DEVICE_COLORS.Desktop },
    { label: "Mobile Web", value: 0, color: DEVICE_COLORS["Mobile Web"] },
    { label: "Other", value: 0, color: DEVICE_COLORS.Other },
  ];
  const legend = [
    { label: "Android", value: 0, percent: 0, color: DEVICE_COLORS.Android },
    { label: "Desktop", value: 0, percent: 0, color: DEVICE_COLORS.Desktop },
    { label: "Mobile Web", value: 0, percent: 0, color: DEVICE_COLORS["Mobile Web"] },
    { label: "iOS", value: 0, percent: 0, color: DEVICE_COLORS.iOS },
    { label: "Other", value: 0, percent: 0, color: DEVICE_COLORS.Other },
  ];

  return {
    primaryTitle: "Mobile OS",
    secondaryTitle: "Access Mix",
    primary,
    secondary,
    legend,
    source: "empty",
  };
};

const buildZeroAudienceAge = () =>
  AGE_GROUPS.map((group) => ({ label: group.label, value: 0 }));

const isDateWithinRange = (value, start, end) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return false;
  return date >= start && date <= end;
};

const createDashboardDateMap = ({ start, end }) => {
  const map = new Map();
  const startCursor = parseDateKey(formatDateKey(start));
  const endCursor = parseDateKey(formatDateKey(end));

  for (
    let cursor = new Date(startCursor);
    cursor <= endCursor;
    cursor = new Date(cursor.getTime() + ONE_DAY_MS)
  ) {
    const dateKey = formatDateKey(cursor);
    map.set(dateKey, {
      date: dateKey,
      newUsers: 0,
      postsCount: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      messagesSent: 0,
      streams: 0,
      downloads: 0,
      totalLogins: 0,
      friendRequestsSent: 0,
      friendRequestsAccepted: 0,
      successfulPurchases: 0,
      failedPurchases: 0,
      revenueAmount: 0,
      _actorIds: new Set(),
    });
  }

  return map;
};

const mergeActorIds = (bucket, actorIds = []) => {
  actorIds.forEach((actorId) => {
    if (!actorId) return;
    bucket._actorIds.add(String(actorId));
  });
};

const buildDashboardSeries = async ({ start, end, interval = "daily" } = {}) => {
  const rows = createDashboardDateMap({ start, end });

  const [
    userActivityRows,
    postRows,
    messageRows,
    eventRows,
    paidPurchaseRows,
    failedPurchaseRows,
  ] = await Promise.all([
    User.find({
      isDeleted: { $ne: true },
      $or: [
        { createdAt: { $gte: start, $lte: end } },
        { lastSeenAt: { $gte: start, $lte: end } },
        { lastLoginAt: { $gte: start, $lte: end } },
        { lastLogin: { $gte: start, $lte: end } },
      ],
    })
      .select("_id createdAt lastSeenAt lastLoginAt lastLogin")
      .lean(),
    Post.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $project: {
          date: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "UTC",
            },
          },
          author: 1,
          likesCount: {
            $max: [
              { $size: { $ifNull: ["$likes", []] } },
              { $ifNull: ["$reactionsCount", 0] },
            ],
          },
          commentsCount: {
            $max: [
              { $size: { $ifNull: ["$comments", []] } },
              { $ifNull: ["$commentsCount", 0] },
            ],
          },
          shareCount: { $ifNull: ["$shareCount", 0] },
        },
      },
      {
        $group: {
          _id: "$date",
          postsCount: { $sum: 1 },
          likes: { $sum: "$likesCount" },
          comments: { $sum: "$commentsCount" },
          shares: { $sum: "$shareCount" },
          actors: { $addToSet: "$author" },
        },
      },
    ]),
    Message.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $project: {
          date: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "UTC",
            },
          },
          senderId: 1,
        },
      },
      {
        $group: {
          _id: "$date",
          messagesSent: { $sum: 1 },
          actors: { $addToSet: "$senderId" },
        },
      },
    ]).catch(() => []),
    AnalyticsEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          type: {
            $in: [
              "user_login",
              "download_completed",
              "stream_started",
              "stream_completed",
              "friend_request_sent",
              "friend_request_accepted",
            ],
          },
        },
      },
      {
        $project: {
          date: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "UTC",
            },
          },
          userId: 1,
          totalLogins: { $cond: [{ $eq: ["$type", "user_login"] }, 1, 0] },
          downloads: { $cond: [{ $eq: ["$type", "download_completed"] }, 1, 0] },
          streams: {
            $cond: [
              { $in: ["$type", ["stream_started", "stream_completed"]] },
              1,
              0,
            ],
          },
          friendRequestsSent: {
            $cond: [{ $eq: ["$type", "friend_request_sent"] }, 1, 0],
          },
          friendRequestsAccepted: {
            $cond: [{ $eq: ["$type", "friend_request_accepted"] }, 1, 0],
          },
        },
      },
      {
        $group: {
          _id: "$date",
          totalLogins: { $sum: "$totalLogins" },
          downloads: { $sum: "$downloads" },
          streams: { $sum: "$streams" },
          friendRequestsSent: { $sum: "$friendRequestsSent" },
          friendRequestsAccepted: { $sum: "$friendRequestsAccepted" },
          actors: { $addToSet: "$userId" },
        },
      },
    ]),
    Purchase.aggregate([
      {
        $match: {
          status: "paid",
          paidAt: { $gte: start, $lte: end },
        },
      },
      {
        $project: {
          date: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$paidAt",
              timezone: "UTC",
            },
          },
          amount: { $ifNull: ["$amount", 0] },
        },
      },
      {
        $group: {
          _id: "$date",
          successfulPurchases: { $sum: 1 },
          revenueAmount: { $sum: "$amount" },
        },
      },
    ]),
    Purchase.aggregate([
      {
        $match: {
          status: "failed",
          updatedAt: { $gte: start, $lte: end },
        },
      },
      {
        $project: {
          date: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$updatedAt",
              timezone: "UTC",
            },
          },
        },
      },
      {
        $group: {
          _id: "$date",
          failedPurchases: { $sum: 1 },
        },
      },
    ]),
  ]);

  userActivityRows.forEach((user) => {
    if (isDateWithinRange(user.createdAt, start, end)) {
      const createdKey = formatDateKey(new Date(user.createdAt));
      const createdBucket = rows.get(createdKey);
      if (createdBucket) {
        createdBucket.newUsers += 1;
        mergeActorIds(createdBucket, [user._id]);
      }
    }

    const activityDates = [user.lastSeenAt, user.lastLoginAt, user.lastLogin]
      .filter((value, index, list) =>
        isDateWithinRange(value, start, end) &&
        list.findIndex((entry) => String(entry || "") === String(value || "")) === index
      );

    activityDates.forEach((value) => {
      const activityKey = formatDateKey(new Date(value));
      mergeActorIds(rows.get(activityKey), [user._id]);
    });
  });

  postRows.forEach((row) => {
    const bucket = rows.get(row._id);
    if (!bucket) return;
    bucket.postsCount += Number(row.postsCount || 0);
    bucket.likes += Number(row.likes || 0);
    bucket.comments += Number(row.comments || 0);
    bucket.shares += Number(row.shares || 0);
    mergeActorIds(bucket, row.actors || []);
  });

  messageRows.forEach((row) => {
    const bucket = rows.get(row._id);
    if (!bucket) return;
    bucket.messagesSent += Number(row.messagesSent || 0);
    mergeActorIds(bucket, row.actors || []);
  });

  eventRows.forEach((row) => {
    const bucket = rows.get(row._id);
    if (!bucket) return;
    bucket.totalLogins += Number(row.totalLogins || 0);
    bucket.downloads += Number(row.downloads || 0);
    bucket.streams += Number(row.streams || 0);
    bucket.friendRequestsSent += Number(row.friendRequestsSent || 0);
    bucket.friendRequestsAccepted += Number(row.friendRequestsAccepted || 0);
    mergeActorIds(bucket, row.actors || []);
  });

  paidPurchaseRows.forEach((row) => {
    const bucket = rows.get(row._id);
    if (!bucket) return;
    bucket.successfulPurchases += Number(row.successfulPurchases || 0);
    bucket.revenueAmount += Number(row.revenueAmount || 0);
  });

  failedPurchaseRows.forEach((row) => {
    const bucket = rows.get(row._id);
    if (!bucket) return;
    bucket.failedPurchases += Number(row.failedPurchases || 0);
  });

  const activeUsersInRange = new Set();
  const finalizedRows = Array.from(rows.values())
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((row) => {
      row._actorIds.forEach((actorId) => activeUsersInRange.add(actorId));
      const activeUsers = row._actorIds.size;
      const profileVisits =
        Number(row.friendRequestsSent || 0) +
        Number(row.friendRequestsAccepted || 0) +
        Number(row.totalLogins || 0);
      const saves = 0;
      const reach =
        Number(row.postsCount || 0) +
        Number(row.likes || 0) +
        Number(row.comments || 0) +
        Number(row.shares || 0) +
        Number(row.messagesSent || 0) +
        Number(row.streams || 0) +
        Number(row.downloads || 0) +
        Number(activeUsers || 0);
      const impressions =
        reach +
        Number(row.likes || 0) +
        Number(row.comments || 0) +
        Number(row.postsCount || 0);
      const clicks =
        Number(row.downloads || 0) +
        Number(row.successfulPurchases || 0) +
        Number(row.postsCount || 0) +
        Number(row.friendRequestsSent || 0);
      const contentInteractions =
        Number(row.likes || 0) +
        Number(row.comments || 0) +
        Number(row.shares || 0) +
        saves;
      const engagement =
        Number(row.likes || 0) +
        Number(row.comments || 0) * 2 +
        Number(row.shares || 0) * 3 +
        Number(row.messagesSent || 0);

      return {
        date: row.date,
        newUsers: Number(row.newUsers || 0),
        activeUsers,
        postsCount: Number(row.postsCount || 0),
        likes: Number(row.likes || 0),
        comments: Number(row.comments || 0),
        shares: Number(row.shares || 0),
        messagesSent: Number(row.messagesSent || 0),
        streams: Number(row.streams || 0),
        downloads: Number(row.downloads || 0),
        totalLogins: Number(row.totalLogins || 0),
        friendRequestsSent: Number(row.friendRequestsSent || 0),
        friendRequestsAccepted: Number(row.friendRequestsAccepted || 0),
        successfulPurchases: Number(row.successfulPurchases || 0),
        failedPurchases: Number(row.failedPurchases || 0),
        revenueAmount: Number(row.revenueAmount || 0),
        profileVisits,
        saves,
        reach,
        impressions,
        clicks,
        engagement,
        contentInteractions,
      };
    });

  return {
    series: groupRowsByInterval(finalizedRows, interval),
    activeUsersInRange: activeUsersInRange.size,
  };
};

const buildOverviewCards = ({ summary, series }) => {
  const totalUsersValue = Number(summary?.totalUsers || 0);
  const reachValue = Math.max(sumField(series, "reach"), sumField(series, "activeUsers"));
  const interactionsValue = sumField(series, "contentInteractions");
  const impressionsValue = sumField(series, "impressions");
  const engagementValue = reachValue ? round((interactionsValue / reachValue) * 100, 1) : 0;

  return {
    cards: [
      {
        id: "total-users",
        label: "Total Users",
        value: totalUsersValue,
        unit: "number",
        helper: "Registered accounts",
        change: computeChange(series, "activeUsers"),
        sparkline: series.slice(-10).map((row) => Number(row.activeUsers || 0)),
      },
      {
        id: "active-users",
        label: "Active Users",
        value: Number(summary?.activeUsersInRange || latestValue(series, "activeUsers")),
        unit: "number",
        helper: "Users active in selected range",
        change: computeChange(series, "activeUsers"),
        sparkline: series.slice(-10).map((row) => Number(row.activeUsers || 0)),
      },
      {
        id: "engagement",
        label: "Engagement",
        value: engagementValue,
        unit: "percent",
        helper: "Interactions over active reach",
        change: computeChange(series, "engagement"),
        sparkline: series.slice(-10).map((row) => Number(row.engagement || 0)),
      },
      {
        id: "reach",
        label: "Reach",
        value: impressionsValue,
        unit: "number",
        helper: "Derived exposure in range",
        change: computeChange(series, "reach"),
        sparkline: series.slice(-10).map((row) => Number(row.reach || 0)),
      },
    ],
    source: hasLiveSeriesData(series) || totalUsersValue > 0 ? "live" : "empty",
  };
};

const buildKpis = (series = []) => {
  const totals = {
    likes: sumField(series, "likes"),
    comments: sumField(series, "comments"),
    shares: sumField(series, "shares"),
    saves: sumField(series, "saves"),
    profileVisits: sumField(series, "profileVisits"),
  };
  totals.contentInteractions =
    totals.likes + totals.comments + totals.shares + totals.saves;

  return {
    items: KPI_ITEMS.map((item) => ({
      ...item,
      value: Number(totals[item.id] || 0),
    })),
    source: Object.values(totals).some((value) => Number(value || 0) > 0) ? "live" : "empty",
  };
};

const buildLiveSeries = (dailyRows = [], postMetricsMap = new Map(), interval = "daily") => {
  const mergedDaily = dailyRows.map((row) => {
    const postMetrics = postMetricsMap.get(row.date) || {};
    const postsCount = Number(postMetrics.postsCount || row.postsCount || 0);
    const likes = Number(postMetrics.likes || row.postLikesCount || 0);
    const comments = Number(postMetrics.comments || row.commentsCount || 0);
    const shares = Number(postMetrics.shares || row.postSharesCount || 0);
    const activeUsers = Number(row.activeUsers || row.dau || 0);
    const downloads = Number(row.downloads || 0);
    const streams = Number(row.streams || 0);
    const messagesSent = Number(row.messagesSent || 0);
    const profileVisits = Number(row.friendRequestsSent || 0) + Number(row.friendRequestsAccepted || 0);
    const clicks =
      downloads +
      Number(row.successfulPurchases || 0) +
      Number(row.friendRequestsSent || 0);
    const reach = activeUsers + downloads + streams + postsCount;
    const impressions = reach + likes + comments + messagesSent;
    const saves = 0;
    const contentInteractions = likes + comments + shares + saves;

    return {
      date: row.date,
      postsCount,
      activeUsers,
      reach,
      impressions,
      likes,
      comments,
      shares,
      clicks,
      saves,
      profileVisits,
      downloads,
      streams,
      messagesSent,
      engagement: likes + comments * 2 + shares * 3 + messagesSent,
      contentInteractions,
    };
  });

  return groupRowsByInterval(mergedDaily, interval);
};

const loadApprovedUsers = async () => {
  const users = await User.find({
    isDeleted: { $ne: true },
    $or: APPROVED_USERS.map((entry) => ({
      name: { $regex: `^${escapeRegex(entry.name)}$`, $options: "i" },
    })),
  })
    .select("_id name role avatar followers friends dob sessions")
    .lean();

  const byName = new Map(users.map((user) => [normalizeName(user.name), user]));

  return APPROVED_USERS.map((entry) => ({
    ...entry,
    user: byName.get(normalizeName(entry.name)) || null,
  }));
};

const getAuthorPostMetrics = async (userIds = []) => {
  if (!userIds.length) return new Map();

  const rows = await Post.aggregate([
    { $match: { author: { $in: userIds } } },
    {
      $project: {
        author: 1,
        likesCount: {
          $max: [
            { $size: { $ifNull: ["$likes", []] } },
            { $ifNull: ["$reactionsCount", 0] },
          ],
        },
        commentsCount: {
          $max: [
            { $size: { $ifNull: ["$comments", []] } },
            { $ifNull: ["$commentsCount", 0] },
          ],
        },
        shareCount: { $ifNull: ["$shareCount", 0] },
      },
    },
    {
      $group: {
        _id: "$author",
        postsCount: { $sum: 1 },
        likesCount: { $sum: "$likesCount" },
        commentsCount: { $sum: "$commentsCount" },
        shareCount: { $sum: "$shareCount" },
        engagementCount: {
          $sum: {
            $add: [
              "$likesCount",
              { $multiply: ["$commentsCount", 2] },
              { $multiply: ["$shareCount", 3] },
            ],
          },
        },
      },
    },
  ]);

  return new Map(
    rows.map((row) => [
      String(row._id),
      {
        postsCount: Number(row.postsCount || 0),
        likesCount: Number(row.likesCount || 0),
        commentsCount: Number(row.commentsCount || 0),
        shareCount: Number(row.shareCount || 0),
        engagementCount: Number(row.engagementCount || 0),
      },
    ])
  );
};

const getDailyPostMetrics = async ({ start, end }) => {
  const rows = await Post.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    {
      $project: {
        date: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$createdAt",
            timezone: "UTC",
          },
        },
        likesCount: {
          $max: [
            { $size: { $ifNull: ["$likes", []] } },
            { $ifNull: ["$reactionsCount", 0] },
          ],
        },
        commentsCount: {
          $max: [
            { $size: { $ifNull: ["$comments", []] } },
            { $ifNull: ["$commentsCount", 0] },
          ],
        },
        shareCount: { $ifNull: ["$shareCount", 0] },
      },
    },
    {
      $group: {
        _id: "$date",
        postsCount: { $sum: 1 },
        likes: { $sum: "$likesCount" },
        comments: { $sum: "$commentsCount" },
        shares: { $sum: "$shareCount" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return new Map(
    rows.map((row) => [
      row._id,
      {
        date: row._id,
        postsCount: Number(row.postsCount || 0),
        likes: Number(row.likes || 0),
        comments: Number(row.comments || 0),
        shares: Number(row.shares || 0),
      },
    ])
  );
};

const getRecentApprovedPosts = async (userIds = []) => {
  if (!userIds.length) return [];

  const rows = await Post.find({ author: { $in: userIds } })
    .sort({ createdAt: -1 })
    .limit(3)
    .select("author text feeling location media video audio reactionsCount likes commentsCount comments shareCount createdAt")
    .populate("author", "name avatar")
    .lean();

  return rows.map((row) => ({
    id: String(row._id),
    authorName: row.author?.name || "Admin User",
    authorDescriptor: "Recent activity",
    createdAt: row.createdAt,
    excerpt:
      String(row.text || "").trim() ||
      (row.feeling ? `Feeling ${row.feeling}` : "") ||
      (row.location ? `Checked in at ${row.location}` : "") ||
      "Shared a new Tengacion update.",
    previewImage:
      row.media?.[0]?.url ||
      row.video?.thumbnailUrl ||
      row.audio?.coverImageUrl ||
      "",
    metrics: {
      likes: Math.max(Number(row.reactionsCount || 0), safeArrayLength(row.likes)),
      comments: Math.max(Number(row.commentsCount || 0), safeArrayLength(row.comments)),
      shares: Number(row.shareCount || 0),
    },
  }));
};

const getTopUsers = async (approvedUsers = []) => {
  const liveUsers = approvedUsers.filter((entry) => entry.user);
  const userIds = liveUsers.map((entry) => entry.user._id);
  const postMetrics = await getAuthorPostMetrics(userIds);

  const items = liveUsers
    .map((entry) => {
      const userId = String(entry.user._id);
      const metrics = postMetrics.get(userId) || {};
      const followersCount = Math.max(
        safeArrayLength(entry.user?.followers),
        safeArrayLength(entry.user?.friends)
      );
      const engagementCount = Number(metrics.engagementCount || 0);
      const growthPercent = followersCount
        ? round((engagementCount / Math.max(followersCount, 1)) * 100, 1)
        : engagementCount > 0
          ? 100
          : 0;

      return {
        id: entry.id,
        displayName: entry.name,
        descriptor: entry.descriptor,
        followersCount,
        engagementCount,
        growthPercent,
        avatarUrl: getAvatarUrl(entry.user),
      };
    })
    .sort((a, b) => Number(b.engagementCount || 0) - Number(a.engagementCount || 0))
    .slice(0, 5);

  return {
    items,
    source: items.length ? "live" : "empty",
  };
};

const getAudienceBreakdown = async () => {
  const users = await User.find({
    isDeleted: { $ne: true },
    dob: { $ne: null },
  })
    .select("dob")
    .lean();

  const counts = AGE_GROUPS.map((group) => ({ label: group.label, value: 0 }));

  users.forEach((user) => {
    const age = computeAge(user.dob);
    if (!age) return;
    const index = AGE_GROUPS.findIndex((group) => age >= group.min && age <= group.max);
    if (index === -1) return;
    counts[index].value += 1;
  });

  return {
    items: counts,
    source: counts.some((item) => item.value > 0) ? "live" : "empty",
  };
};

const getDevicesUsage = async () => {
  const users = await User.find({ "sessions.0": { $exists: true } })
    .select("sessions")
    .lean();

  if (!users.length) {
    return buildZeroDevices();
  }

  const primaryCounts = { Android: 0, iOS: 0, Other: 0 };
  const secondaryCounts = { Desktop: 0, "Mobile Web": 0, Other: 0 };
  const legendCounts = { Android: 0, Desktop: 0, "Mobile Web": 0, iOS: 0, Other: 0 };
  let totalPrimary = 0;

  users.forEach((user) => {
    const session = getLatestSession(user.sessions);
    if (!session) return;
    const primaryLabel = classifyPrimaryDevice(session.userAgent, session.deviceName);
    const secondaryLabel = classifySecondaryDevice(session.userAgent, session.deviceName);

    if (Object.prototype.hasOwnProperty.call(primaryCounts, primaryLabel)) {
      primaryCounts[primaryLabel] += 1;
      totalPrimary += 1;
    }
    if (Object.prototype.hasOwnProperty.call(secondaryCounts, secondaryLabel)) {
      secondaryCounts[secondaryLabel] += 1;
    }
    if (Object.prototype.hasOwnProperty.call(legendCounts, primaryLabel)) {
      legendCounts[primaryLabel] += 1;
    } else if (Object.prototype.hasOwnProperty.call(legendCounts, secondaryLabel)) {
      legendCounts[secondaryLabel] += 1;
    } else {
      legendCounts.Other += 1;
    }
  });

  if (!totalPrimary) {
    return buildZeroDevices();
  }

  const legendTotal = Object.values(legendCounts).reduce((sum, value) => sum + Number(value || 0), 0);

  return {
    primaryTitle: "Mobile OS",
    secondaryTitle: "Access Mix",
    primary: Object.entries(primaryCounts).map(([label, value]) => ({
      label,
      value,
      color: DEVICE_COLORS[label],
    })),
    secondary: Object.entries(secondaryCounts).map(([label, value]) => ({
      label,
      value,
      color: DEVICE_COLORS[label],
    })),
    legend: Object.entries(legendCounts).map(([label, value]) => ({
      label,
      value,
      percent: percent(value, legendTotal || 1),
      color: DEVICE_COLORS[label],
    })),
    source: "live",
  };
};

const buildAdminDashboard = async ({ range = "30d", startDate = "", endDate = "", interval = "daily" } = {}) => {
  const normalizedInterval = normalizeInterval(interval);
  const dates = buildDateRange({ range, startDate, endDate });

  const [
    systemAlerts,
    approvedUsers,
    dashboardSeriesResult,
    devicesUsage,
    audienceAge,
    totalUsers,
    totalPosts,
    monthlyRevenueRows,
  ] = await Promise.all([
    buildSystemAlerts({ range, startDate, endDate }),
    loadApprovedUsers(),
    buildDashboardSeries({ start: dates.start, end: dates.end, interval: normalizedInterval }),
    getDevicesUsage(),
    getAudienceBreakdown(),
    User.countDocuments({ isDeleted: { $ne: true } }),
    Post.countDocuments({}).catch(() => 0),
    Purchase.aggregate([
      {
        $match: {
          status: "paid",
          paidAt: {
            $gte: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)),
            $lte: new Date(),
          },
        },
      },
      { $group: { _id: null, revenue: { $sum: "$amount" } } },
    ]),
  ]);

  const chartSeries = dashboardSeriesResult.series;
  const overviewSummary = {
    totalUsers: Number(totalUsers || 0),
    totalPosts: Number(totalPosts || 0),
    activeUsersInRange: Number(dashboardSeriesResult.activeUsersInRange || 0),
    revenueThisMonth: Number(monthlyRevenueRows[0]?.revenue || 0),
  };
  const overviewCards = buildOverviewCards({
    summary: overviewSummary,
    series: chartSeries,
  });
  const kpis = buildKpis(chartSeries);
  const recentPosts = {
    items: await getRecentApprovedPosts(
      approvedUsers.filter((entry) => entry.user?._id).map((entry) => entry.user._id)
    ),
    source: "live",
  };
  const topUsers = await getTopUsers(approvedUsers);

  const messageVolume = sumField(chartSeries, "messagesSent");
  const dataMode = hasLiveSeriesData(chartSeries) || Number(overviewSummary.totalUsers || 0) > 0
    ? "live"
    : "limited";

  return {
    dataMode,
    generatedAt: new Date().toISOString(),
    filter: {
      range: dates.range,
      interval: normalizedInterval,
      startDate: dates.start.toISOString(),
      endDate: dates.end.toISOString(),
      label: rangeSubtitle(dates.range),
    },
    header: {
      title: "Dashboard",
      adminName: "Admin User",
      roleLabel: "Admin",
      secondaryText: "Platform oversight",
      notificationCount: Number(systemAlerts.alerts?.length || 0),
      alerts: systemAlerts.alerts || [],
    },
    overview: {
      cards: overviewCards.cards,
      source: overviewCards.source,
    },
    chart: {
      tabs: chartTabs,
      rangeOptions,
      activeTab: "activity",
      series: chartSeries,
      source: hasLiveSeriesData(chartSeries) ? "live" : "empty",
    },
    devicesUsage,
    recentPosts: {
      items: recentPosts.items,
      source: recentPosts.items.length ? "live" : "empty",
    },
    topUsers,
    kpis,
    audienceAge,
    navDots: {
      analytics: Boolean(systemAlerts.alerts?.length),
      messages: messageVolume > 0,
      campaigns: Number(overviewSummary.revenueThisMonth || 0) > 0,
      settings: Boolean(systemAlerts.metrics?.loginWarnings || systemAlerts.metrics?.failedPayments),
    },
    diagnostics: {
      totalPosts: Number(overviewSummary.totalPosts || 0),
      totalMessages: messageVolume,
      approvedUserCount: topUsers.items.length,
      audienceTracked: audienceAge.items.reduce((sum, item) => sum + Number(item.value || 0), 0),
    },
  };
};

module.exports = {
  APPROVED_USERS,
  buildAdminDashboard,
};
