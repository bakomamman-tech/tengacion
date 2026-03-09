const User = require("../models/User");
const Post = require("../models/Post");
const {
  buildDateRange,
  normalizeInterval,
  fetchDailyRows,
  buildOverview,
  buildSystemAlerts,
} = require("./analyticsService");

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const APPROVED_USER_SEEDS = [
  {
    id: "lorietta-billy",
    name: "Lorietta Billy",
    descriptor: "Community Lead",
    followersCount: 98364,
    engagementCount: 12398,
    growthPercent: 8.2,
  },
  {
    id: "stephen-daniel-kurah",
    name: "Stephen Daniel Kurah",
    descriptor: "Creator Program",
    followersCount: 65281,
    engagementCount: 11782,
    growthPercent: 7.9,
  },
  {
    id: "demo-friend-user",
    name: "Demo Friend User",
    descriptor: "Member Network",
    followersCount: 54392,
    engagementCount: 9983,
    growthPercent: 6.8,
  },
  {
    id: "admin-user",
    name: "Admin User",
    descriptor: "Platform Admin",
    followersCount: 48975,
    engagementCount: 9149,
    growthPercent: 5.4,
  },
  {
    id: "demo-uiux-user",
    name: "Demo UIUX User",
    descriptor: "Design Circle",
    followersCount: 41286,
    engagementCount: 7429,
    growthPercent: 4.6,
  },
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
  const previous = rows.slice(0, midpoint);
  const current = rows.slice(midpoint);
  const previousAvg = averageOfRange(previous, field);
  const currentAvg = averageOfRange(current, field);
  if (!previousAvg) {
    return currentAvg > 0 ? 100 : 0;
  }
  return round(((currentAvg - previousAvg) / previousAvg) * 100, 1);
};

const sumField = (rows = [], field) =>
  rows.reduce((sum, row) => sum + (Number(row[field]) || 0), 0);

const latestValue = (rows = [], field) => Number(rows[rows.length - 1]?.[field] || 0);

const isMeaningfulSeries = (rows = [], fields = []) =>
  rows.some((row) => fields.some((field) => Number(row[field] || 0) > 0));

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

const buildSeedSeries = (dailyRows = [], interval = "daily") => {
  const seededDaily = dailyRows.map((row, index) => {
    const activeUsers = Math.max(
      7800,
      Math.round(14800 + Math.sin(index / 1.8) * 3600 + Math.cos(index / 4.5) * 1400 + index * 240)
    );
    const reach = Math.max(
      16200,
      Math.round(22800 + Math.sin(index / 2.4 + 0.8) * 5200 + Math.cos(index / 3.2) * 2300 + index * 330)
    );
    const shares = Math.max(
      2100,
      Math.round(3650 + Math.sin(index / 1.7 + 1.4) * 920 + Math.cos(index / 3.8) * 420 + index * 66)
    );
    const likes = Math.max(
      4200,
      Math.round(6250 + Math.sin(index / 1.9 + 0.5) * 1350 + Math.cos(index / 5.2) * 560 + index * 90)
    );
    const comments = Math.max(
      1600,
      Math.round(2380 + Math.sin(index / 2.3 + 2.1) * 540 + Math.cos(index / 4.6) * 210 + index * 38)
    );
    const saves = Math.max(
      980,
      Math.round(1540 + Math.sin(index / 2.2 + 1.2) * 360 + Math.cos(index / 4.2) * 150 + index * 28)
    );
    const clicks = Math.max(
      2300,
      Math.round(3480 + Math.sin(index / 1.5 + 0.9) * 760 + Math.cos(index / 3.5) * 330 + index * 54)
    );
    const profileVisits = Math.max(
      1800,
      Math.round(2740 + Math.sin(index / 2.1 + 0.3) * 690 + Math.cos(index / 4.7) * 250 + index * 46)
    );

    return {
      date: row.date,
      activeUsers,
      reach,
      impressions: Math.round(reach * 1.27),
      likes,
      comments,
      shares,
      clicks,
      saves,
      profileVisits,
      engagement: likes + comments * 2 + shares * 3,
      contentInteractions: likes + comments + shares + saves,
    };
  });

  return groupRowsByInterval(seededDaily, interval);
};

const buildSeedRecentPosts = () => {
  const now = Date.now();
  return [
    {
      id: "seed-post-1",
      authorName: "Lorietta Billy",
      authorDescriptor: "Community Lead",
      createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      excerpt: "Shared a new community update for Tengacion creators.",
      previewImage: "",
      metrics: { likes: 342, comments: 87, shares: 11 },
    },
    {
      id: "seed-post-2",
      authorName: "Stephen Daniel Kurah",
      authorDescriptor: "Creator Program",
      createdAt: new Date(now - 8 * 60 * 60 * 1000).toISOString(),
      excerpt: "Published a growth snapshot for creator onboarding performance.",
      previewImage: "",
      metrics: { likes: 251, comments: 66, shares: 11 },
    },
    {
      id: "seed-post-3",
      authorName: "Demo UIUX User",
      authorDescriptor: "Design Circle",
      createdAt: new Date(now - 22 * 60 * 60 * 1000).toISOString(),
      excerpt: "Posted a product polish note for the Tengacion admin flow.",
      previewImage: "",
      metrics: { likes: 194, comments: 41, shares: 8 },
    },
  ];
};

const buildSeedTopUsers = () =>
  APPROVED_USER_SEEDS.map((entry) => ({
    id: entry.id,
    displayName: entry.name,
    descriptor: entry.descriptor,
    followersCount: entry.followersCount,
    engagementCount: entry.engagementCount,
    growthPercent: entry.growthPercent,
    avatarUrl: "",
  }));

const buildSeedAudienceAge = () => [
  { label: "13-17", value: 184 },
  { label: "18-24", value: 292 },
  { label: "25-34", value: 318 },
  { label: "35-44", value: 244 },
  { label: "45-54", value: 136 },
  { label: "55+", value: 62 },
];

const buildSeedDevices = () => {
  const primary = [
    { label: "Android", value: 46, color: DEVICE_COLORS.Android },
    { label: "iOS", value: 38, color: DEVICE_COLORS.iOS },
    { label: "Other", value: 16, color: DEVICE_COLORS.Other },
  ];
  const secondary = [
    { label: "Desktop", value: 54, color: DEVICE_COLORS.Desktop },
    { label: "Mobile Web", value: 30, color: DEVICE_COLORS["Mobile Web"] },
    { label: "Other", value: 16, color: DEVICE_COLORS.Other },
  ];
  const legend = [
    { label: "Android", value: 46, percent: 46, color: DEVICE_COLORS.Android },
    { label: "Desktop", value: 54, percent: 54, color: DEVICE_COLORS.Desktop },
    { label: "Mobile Web", value: 30, percent: 30, color: DEVICE_COLORS["Mobile Web"] },
    { label: "iOS", value: 38, percent: 38, color: DEVICE_COLORS.iOS },
    { label: "Other", value: 16, percent: 16, color: DEVICE_COLORS.Other },
  ];

  return {
    primaryTitle: "Mobile OS",
    secondaryTitle: "Access Mix",
    primary,
    secondary,
    legend,
    source: "seeded",
  };
};

const buildSeedOverviewCards = (seedSeries) => {
  const recentWindow = seedSeries.slice(-Math.min(7, seedSeries.length));
  const recentReach = sumField(recentWindow, "reach");
  const recentInteractions = sumField(recentWindow, "contentInteractions");
  return [
    {
      id: "total-users",
      label: "Total Users",
      value: 85396,
      unit: "number",
      helper: "Registered accounts",
      change: 2.3,
      sparkline: seedSeries.slice(-10).map((row) => Number(row.activeUsers || 0)),
    },
    {
      id: "active-users",
      label: "Active Users",
      value: 23987,
      unit: "number",
      helper: "Current active audience",
      change: 3.8,
      sparkline: seedSeries.slice(-10).map((row) => Number(row.activeUsers || 0)),
    },
    {
      id: "engagement",
      label: "Engagement",
      value: recentReach ? round((recentInteractions / recentReach) * 100, 1) : 31.5,
      unit: "percent",
      helper: "Interactions over reach",
      change: 31.5,
      sparkline: seedSeries.slice(-10).map((row) => Number(row.engagement || 0)),
    },
    {
      id: "reach",
      label: "Reach",
      value: Math.max(154763, sumField(recentWindow, "impressions")),
      unit: "number",
      helper: "Impressions in range",
      change: 6.1,
      sparkline: seedSeries.slice(-10).map((row) => Number(row.reach || 0)),
    },
  ];
};

const buildSeedKpis = (seedSeries) => {
  const totals = {
    likes: Math.max(2840, Math.round(averageOfRange(seedSeries, "likes"))),
    comments: Math.max(1310, Math.round(averageOfRange(seedSeries, "comments"))),
    shares: Math.max(870, Math.round(averageOfRange(seedSeries, "shares"))),
    saves: Math.max(620, Math.round(averageOfRange(seedSeries, "saves"))),
    profileVisits: Math.max(1980, Math.round(averageOfRange(seedSeries, "profileVisits"))),
  };
  totals.contentInteractions =
    totals.likes + totals.comments + totals.shares + totals.saves;

  return KPI_ITEMS.map((item) => ({
    ...item,
    value: Number(totals[item.id] || 0),
  }));
};

const buildOverviewCards = ({ summary, series, fallbackCards }) => {
  const totalUsersValue = Number(summary?.totalUsers || 0);
  const recentWindow = series.slice(-Math.min(7, series.length));
  const reachValue = sumField(recentWindow, "reach");
  const impressionsValue = sumField(recentWindow, "impressions");
  const engagementValue = reachValue
    ? round((sumField(recentWindow, "contentInteractions") / reachValue) * 100, 1)
    : 0;

  const liveCards = [
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
      value: latestValue(series, "activeUsers"),
      unit: "number",
      helper: "Current active audience",
      change: computeChange(series, "activeUsers"),
      sparkline: series.slice(-10).map((row) => Number(row.activeUsers || 0)),
    },
    {
      id: "engagement",
      label: "Engagement",
      value: engagementValue,
      unit: "percent",
      helper: "Interactions over reach",
      change: computeChange(series, "engagement"),
      sparkline: series.slice(-10).map((row) => Number(row.engagement || 0)),
    },
    {
      id: "reach",
      label: "Reach",
      value: impressionsValue,
      unit: "number",
      helper: "Impressions in range",
      change: computeChange(series, "reach"),
      sparkline: series.slice(-10).map((row) => Number(row.reach || 0)),
    },
  ];

  const liveReady =
    totalUsersValue >= 5 &&
    isMeaningfulSeries(series, ["activeUsers", "reach", "engagement", "contentInteractions"]);

  return {
    cards: liveReady ? liveCards : fallbackCards,
    source: liveReady ? "live" : "seeded",
  };
};

const buildKpis = (series = [], fallbackItems = []) => {
  const totals = {
    likes: Math.round(averageOfRange(series, "likes")),
    comments: Math.round(averageOfRange(series, "comments")),
    shares: Math.round(averageOfRange(series, "shares")),
    saves: Math.round(averageOfRange(series, "saves")),
    profileVisits: Math.round(averageOfRange(series, "profileVisits")),
  };
  totals.contentInteractions =
    totals.likes + totals.comments + totals.shares + totals.saves;

  const liveReady =
    totals.likes + totals.comments + totals.shares + totals.profileVisits >= 50;

  return {
    items: liveReady
      ? KPI_ITEMS.map((item) => ({
          ...item,
          value: Number(totals[item.id] || 0),
        }))
      : fallbackItems,
    source: liveReady ? "live" : "seeded",
  };
};

const buildLiveSeries = (dailyRows = [], postMetricsMap = new Map(), interval = "daily") => {
  const mergedDaily = dailyRows.map((row) => {
    const postMetrics = postMetricsMap.get(row.date) || {};
    const likes = Number(postMetrics.likes || 0);
    const comments = Number(postMetrics.comments || 0);
    const shares = Number(postMetrics.shares || 0);
    const saves = Math.max(0, Math.round(likes * 0.22 + shares * 0.58));
    const reach = Math.max(
      0,
      Math.round(
        Number(row.activeUsers || row.dau || 0) * 7.2 +
        Number(row.streams || 0) * 1.8 +
        Number(row.downloads || 0) * 2.4 +
        Number(postMetrics.postsCount || row.postsCount || 0) * 12 +
        Number(row.messagesSent || 0) * 0.55
      )
    );
    const profileVisits = Math.max(
      0,
      Math.round(
        Number(row.totalLogins || 0) * 0.7 +
        Number(row.friendRequestsSent || 0) * 2.1 +
        likes * 0.12 +
        comments * 0.26
      )
    );
    const clicks = Math.max(
      0,
      Math.round(
        Number(row.downloads || 0) +
        Number(row.friendRequestsSent || 0) +
        Number(row.successfulPurchases || 0) * 2 +
        profileVisits * 0.42
      )
    );

    return {
      date: row.date,
      activeUsers: Number(row.activeUsers || row.dau || 0),
      reach,
      impressions: Math.round(reach * 1.24),
      likes,
      comments,
      shares,
      clicks,
      saves,
      profileVisits,
      engagement: likes + comments * 2 + shares * 3 + Number(row.messagesSent || 0),
      contentInteractions: likes + comments + shares + saves,
    };
  });

  return groupRowsByInterval(mergedDaily, interval);
};

const loadApprovedUsers = async () => {
  const users = await User.find({
    isDeleted: { $ne: true },
    $or: APPROVED_USER_SEEDS.map((entry) => ({
      name: { $regex: `^${escapeRegex(entry.name)}$`, $options: "i" },
    })),
  })
    .select("_id name role avatar followers friends dob achievementsStats")
    .lean();

  const byName = new Map(users.map((user) => [normalizeName(user.name), user]));

  return APPROVED_USER_SEEDS.map((seed) => ({
    ...seed,
    user: byName.get(normalizeName(seed.name)) || null,
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
          $cond: [
            { $gt: ["$reactionsCount", 0] },
            "$reactionsCount",
            { $size: { $ifNull: ["$likes", []] } },
          ],
        },
        commentsCount: {
          $cond: [
            { $gt: ["$commentsCount", 0] },
            "$commentsCount",
            { $size: { $ifNull: ["$comments", []] } },
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
          $cond: [
            { $gt: ["$reactionsCount", 0] },
            "$reactionsCount",
            { $size: { $ifNull: ["$likes", []] } },
          ],
        },
        commentsCount: {
          $cond: [
            { $gt: ["$commentsCount", 0] },
            "$commentsCount",
            { $size: { $ifNull: ["$comments", []] } },
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
      likes: Number(row.reactionsCount || safeArrayLength(row.likes) || 0),
      comments: Number(row.commentsCount || safeArrayLength(row.comments) || 0),
      shares: Number(row.shareCount || 0),
    },
  }));
};

const getTopUsers = async (approvedUsers = []) => {
  const liveUsers = approvedUsers.filter((entry) => entry.user);
  const userIds = liveUsers.map((entry) => entry.user._id);
  const postMetrics = await getAuthorPostMetrics(userIds);

  const items = approvedUsers.map((entry) => {
    const userId = entry.user?._id ? String(entry.user._id) : "";
    const liveMetrics = postMetrics.get(userId) || {};
    const liveFollowers = safeArrayLength(entry.user?.followers);
    const liveFriends = safeArrayLength(entry.user?.friends);
    const engagementCount = Number(liveMetrics.engagementCount || 0);
    const followersCount =
      liveFollowers > 0
        ? liveFollowers
        : liveFriends > 0
          ? liveFriends
          : 0;
    const useLive = Boolean(entry.user) && (engagementCount > 0 || followersCount > 0);
    const growthPercent = useLive
      ? round(
          Math.max(1.2, Math.min(18.4, ((engagementCount || 1) / Math.max(followersCount || 18, 18)) * 100)),
          1
        )
      : entry.growthPercent;

    return {
      id: entry.id,
      displayName: entry.name,
      descriptor: entry.descriptor,
      followersCount: useLive ? followersCount : entry.followersCount,
      engagementCount: useLive ? engagementCount : entry.engagementCount,
      growthPercent,
      avatarUrl: getAvatarUrl(entry.user),
      source: useLive ? "live" : "seeded",
    };
  });

  const liveCount = items.filter((entry) => entry.source === "live").length;

  return {
    items: items.sort((a, b) => Number(b.engagementCount || 0) - Number(a.engagementCount || 0)),
    source: liveCount >= 3 ? "live" : liveCount > 0 ? "hybrid" : "seeded",
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
  let total = 0;

  users.forEach((user) => {
    const age = computeAge(user.dob);
    if (!age) return;
    const index = AGE_GROUPS.findIndex((group) => age >= group.min && age <= group.max);
    if (index === -1) return;
    counts[index].value += 1;
    total += 1;
  });

  return {
    items: total >= 5 ? counts : buildSeedAudienceAge(),
    source: total >= 5 ? "live" : "seeded",
  };
};

const getDevicesUsage = async () => {
  const users = await User.find({ "sessions.0": { $exists: true } })
    .select("sessions")
    .lean();

  const primaryCounts = { Android: 0, iOS: 0, Other: 0 };
  const secondaryCounts = { Desktop: 0, "Mobile Web": 0, Other: 0 };
  const legendCounts = { Android: 0, Desktop: 0, "Mobile Web": 0, iOS: 0, Other: 0 };
  let totalPrimary = 0;
  let totalSecondary = 0;

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
      totalSecondary += 1;
    }
    if (Object.prototype.hasOwnProperty.call(legendCounts, primaryLabel)) {
      legendCounts[primaryLabel] += 1;
    } else if (Object.prototype.hasOwnProperty.call(legendCounts, secondaryLabel)) {
      legendCounts[secondaryLabel] += 1;
    } else {
      legendCounts.Other += 1;
    }
  });

  if (totalPrimary < 4 || totalSecondary < 4) {
    return buildSeedDevices();
  }

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
      percent: percent(value, Object.values(legendCounts).reduce((sum, item) => sum + item, 0) || 1),
      color: DEVICE_COLORS[label],
    })),
    source: "live",
  };
};

const mergeRecentPosts = (liveItems = []) => {
  const approvedLive = liveItems.filter((entry) =>
    APPROVED_USER_SEEDS.some((seed) => normalizeName(seed.name) === normalizeName(entry.authorName))
  );

  if (approvedLive.length >= 3) {
    return { items: approvedLive.slice(0, 3), source: "live" };
  }

  const filled = [...approvedLive];
  buildSeedRecentPosts().forEach((entry) => {
    if (filled.length >= 3) return;
    if (filled.some((item) => normalizeName(item.authorName) === normalizeName(entry.authorName))) return;
    filled.push(entry);
  });

  return {
    items: filled.slice(0, 3),
    source: approvedLive.length ? "hybrid" : "seeded",
  };
};

const buildAdminDashboard = async ({ range = "30d", startDate = "", endDate = "", interval = "daily" } = {}) => {
  const normalizedInterval = normalizeInterval(interval);
  const dates = buildDateRange({ range, startDate, endDate });

  const [
    overview,
    systemAlerts,
    approvedUsers,
    rawDailyRows,
    dailyPostMetrics,
    devicesUsage,
    audienceAge,
  ] = await Promise.all([
    buildOverview({ range, startDate, endDate, interval: normalizedInterval }),
    buildSystemAlerts({ range, startDate, endDate }),
    loadApprovedUsers(),
    fetchDailyRows({ start: dates.start, end: dates.end, interval: "daily" }),
    getDailyPostMetrics({ start: dates.start, end: dates.end }),
    getDevicesUsage(),
    getAudienceBreakdown(),
  ]);

  const liveSeries = buildLiveSeries(rawDailyRows, dailyPostMetrics, normalizedInterval);
  const seedSeries = buildSeedSeries(rawDailyRows, normalizedInterval);
  const seriesIsLive = isMeaningfulSeries(liveSeries, [
    "activeUsers",
    "reach",
    "likes",
    "comments",
    "shares",
    "clicks",
  ]);
  const chartSeries = seriesIsLive ? liveSeries : seedSeries;
  const overviewCards = buildOverviewCards({
    summary: overview.summary,
    series: chartSeries,
    fallbackCards: buildSeedOverviewCards(seedSeries),
  });
  const kpis = buildKpis(chartSeries, buildSeedKpis(seedSeries));
  const recentPosts = mergeRecentPosts(
    await getRecentApprovedPosts(
      approvedUsers.filter((entry) => entry.user?._id).map((entry) => entry.user._id)
    )
  );
  const topUsers = await getTopUsers(approvedUsers);

  const sectionSources = [
    overviewCards.source,
    seriesIsLive ? "live" : "seeded",
    devicesUsage.source,
    recentPosts.source,
    topUsers.source,
    kpis.source,
    audienceAge.source,
  ];
  const liveSectionCount = sectionSources.filter((entry) => entry === "live").length;
  const seededSectionCount = sectionSources.filter((entry) => entry === "seeded").length;
  const dataMode =
    seededSectionCount === sectionSources.length
      ? "seeded"
      : liveSectionCount === sectionSources.length
        ? "live"
        : "hybrid";

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
      notificationCount: Math.max(1, Number(systemAlerts.alerts?.length || 0)),
    },
    overview: {
      cards: overviewCards.cards,
    },
    chart: {
      tabs: chartTabs,
      rangeOptions,
      activeTab: "activity",
      series: chartSeries,
      source: seriesIsLive ? "live" : "seeded",
    },
    devicesUsage,
    recentPosts,
    topUsers: topUsers.source === "seeded" ? { ...topUsers, items: buildSeedTopUsers() } : topUsers,
    kpis,
    audienceAge,
    navDots: {
      analytics: Boolean(systemAlerts.alerts?.length),
      messages: recentPosts.items.length > 0,
      campaigns: false,
      settings: false,
    },
  };
};

module.exports = {
  APPROVED_USER_SEEDS,
  buildAdminDashboard,
};
