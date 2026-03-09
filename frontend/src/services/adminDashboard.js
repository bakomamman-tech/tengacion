import { adminGetDashboard, resolveImage } from "../api";

const APPROVED_USER_NAMES = [
  "Lorietta Billy",
  "Stephen Daniel Kurah",
  "Demo Friend User",
  "Admin User",
  "Demo UIUX User",
];

const APPROVED_NAME_SET = new Set(APPROVED_USER_NAMES.map((name) => name.toLowerCase()));

const RANGE_OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "year", label: "This year" },
];

const CHART_TABS = [
  { id: "activity", label: "Activity" },
  { id: "reach", label: "Reach" },
  { id: "share", label: "Share" },
  { id: "shares", label: "Shares" },
  { id: "clicks", label: "Clicks" },
];

const createSeedSeries = () => {
  const today = new Date();
  return Array.from({ length: 10 }, (_, index) => {
    const pointDate = new Date(today);
    pointDate.setDate(today.getDate() - (9 - index) * 3);
    const activeUsers = Math.round(14200 + Math.sin(index / 1.6) * 3200 + index * 380);
    const reach = Math.round(22400 + Math.cos(index / 2.1) * 5100 + index * 460);
    const likes = Math.round(6120 + Math.sin(index / 1.8 + 0.3) * 1020);
    const comments = Math.round(2380 + Math.cos(index / 2.3 + 0.8) * 420);
    const shares = Math.round(3510 + Math.sin(index / 1.7 + 0.9) * 660);
    const saves = Math.round(1580 + Math.cos(index / 2.1 + 0.2) * 260);
    const profileVisits = Math.round(2640 + Math.sin(index / 2.2 + 0.6) * 420);
    return {
      date: pointDate.toISOString(),
      activeUsers,
      reach,
      impressions: Math.round(reach * 1.22),
      likes,
      comments,
      shares,
      clicks: Math.round(3280 + Math.sin(index / 1.4) * 520 + index * 40),
      saves,
      profileVisits,
      engagement: likes + comments * 2 + shares * 3,
      contentInteractions: likes + comments + shares + saves,
    };
  });
};

const createSeedDashboard = (range = "30d") => {
  const series = createSeedSeries();
  return {
    dataMode: "seeded",
    filter: {
      range,
      interval: "daily",
      label: RANGE_OPTIONS.find((option) => option.value === range)?.label || "Last 30 days",
    },
    header: {
      title: "Dashboard",
      adminName: "Admin User",
      roleLabel: "Admin",
      secondaryText: "Platform oversight",
      notificationCount: 2,
    },
    overview: {
      cards: [
        { id: "total-users", label: "Total Users", value: 85396, unit: "number", helper: "Registered accounts", change: 2.3, sparkline: series.map((point) => point.activeUsers) },
        { id: "active-users", label: "Active Users", value: 23987, unit: "number", helper: "Current active audience", change: 3.8, sparkline: series.map((point) => point.activeUsers) },
        { id: "engagement", label: "Engagement", value: 31.5, unit: "percent", helper: "Interactions over reach", change: 31.5, sparkline: series.map((point) => point.engagement) },
        { id: "reach", label: "Reach", value: 154763, unit: "number", helper: "Impressions in range", change: 6.1, sparkline: series.map((point) => point.reach) },
      ],
    },
    chart: {
      tabs: CHART_TABS,
      rangeOptions: RANGE_OPTIONS,
      activeTab: "activity",
      series,
      source: "seeded",
    },
    devicesUsage: {
      primaryTitle: "Mobile OS",
      secondaryTitle: "Access Mix",
      primary: [
        { label: "Android", value: 46, color: "#63d7c5" },
        { label: "iOS", value: 38, color: "#7b86ff" },
        { label: "Other", value: 16, color: "#8ea2c4" },
      ],
      secondary: [
        { label: "Desktop", value: 54, color: "#5aa3ff" },
        { label: "Mobile Web", value: 30, color: "#b49cff" },
        { label: "Other", value: 16, color: "#8ea2c4" },
      ],
      legend: [
        { label: "Android", value: 46, percent: 46, color: "#63d7c5" },
        { label: "Desktop", value: 54, percent: 54, color: "#5aa3ff" },
        { label: "Mobile Web", value: 30, percent: 30, color: "#b49cff" },
        { label: "iOS", value: 38, percent: 38, color: "#7b86ff" },
        { label: "Other", value: 16, percent: 16, color: "#8ea2c4" },
      ],
      source: "seeded",
    },
    recentPosts: {
      items: [
        { id: "seed-post-1", authorName: "Lorietta Billy", authorDescriptor: "Community Lead", createdAt: new Date().toISOString(), excerpt: "Shared a new community update for Tengacion creators.", previewImage: "", metrics: { likes: 342, comments: 87, shares: 11 } },
        { id: "seed-post-2", authorName: "Stephen Daniel Kurah", authorDescriptor: "Creator Program", createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), excerpt: "Published a growth snapshot for creator onboarding performance.", previewImage: "", metrics: { likes: 251, comments: 66, shares: 11 } },
        { id: "seed-post-3", authorName: "Demo UIUX User", authorDescriptor: "Design Circle", createdAt: new Date(Date.now() - 21 * 60 * 60 * 1000).toISOString(), excerpt: "Posted a product polish note for the Tengacion admin flow.", previewImage: "", metrics: { likes: 194, comments: 41, shares: 8 } },
      ],
      source: "seeded",
    },
    topUsers: {
      items: [
        { id: "lorietta-billy", displayName: "Lorietta Billy", descriptor: "Community Lead", followersCount: 98364, engagementCount: 12398, growthPercent: 8.2, avatarUrl: "" },
        { id: "stephen-daniel-kurah", displayName: "Stephen Daniel Kurah", descriptor: "Creator Program", followersCount: 65281, engagementCount: 11782, growthPercent: 7.9, avatarUrl: "" },
        { id: "demo-friend-user", displayName: "Demo Friend User", descriptor: "Member Network", followersCount: 54392, engagementCount: 9983, growthPercent: 6.8, avatarUrl: "" },
        { id: "admin-user", displayName: "Admin User", descriptor: "Platform Admin", followersCount: 48975, engagementCount: 9149, growthPercent: 5.4, avatarUrl: "" },
        { id: "demo-uiux-user", displayName: "Demo UIUX User", descriptor: "Design Circle", followersCount: 41286, engagementCount: 7429, growthPercent: 4.6, avatarUrl: "" },
      ],
      source: "seeded",
    },
    kpis: {
      items: [
        { id: "likes", label: "Likes", icon: "heart", value: 2840 },
        { id: "comments", label: "Comments", icon: "comment", value: 1310 },
        { id: "shares", label: "Shares", icon: "share", value: 870 },
        { id: "saves", label: "Saves", icon: "bookmark", value: 620 },
        { id: "profileVisits", label: "Profile Visits", icon: "profile", value: 1980 },
        { id: "contentInteractions", label: "Content Interactions", icon: "spark", value: 5640 },
      ],
      source: "seeded",
    },
    audienceAge: {
      items: [
        { label: "13-17", value: 184 },
        { label: "18-24", value: 292 },
        { label: "25-34", value: 318 },
        { label: "35-44", value: 244 },
        { label: "45-54", value: 136 },
        { label: "55+", value: 62 },
      ],
      source: "seeded",
    },
    navDots: {
      analytics: true,
      messages: true,
      campaigns: false,
      settings: false,
    },
  };
};

const isApprovedName = (value = "") => APPROVED_NAME_SET.has(String(value || "").toLowerCase());

const fillWithFallbacks = (items, fallbackItems, desiredCount, getName) => {
  const next = Array.isArray(items) ? [...items] : [];
  fallbackItems.forEach((item) => {
    if (next.length >= desiredCount) {
      return;
    }
    if (next.some((entry) => getName(entry) === getName(item))) {
      return;
    }
    next.push(item);
  });
  return next.slice(0, desiredCount);
};

const normalizeDashboard = (payload, range = "30d") => {
  const fallback = createSeedDashboard(range);
  const recentItems = fillWithFallbacks(
    (payload?.recentPosts?.items || []).filter((item) => isApprovedName(item?.authorName)).map((item) => ({
      ...item,
      previewImage: resolveImage(item?.previewImage || ""),
    })),
    fallback.recentPosts.items,
    3,
    (item) => String(item?.authorName || "").toLowerCase()
  );

  const topUsers = fillWithFallbacks(
    (payload?.topUsers?.items || []).filter((item) => isApprovedName(item?.displayName)).map((item) => ({
      ...item,
      avatarUrl: resolveImage(item?.avatarUrl || ""),
    })),
    fallback.topUsers.items,
    5,
    (item) => String(item?.displayName || "").toLowerCase()
  );

  return {
    ...fallback,
    ...payload,
    header: { ...fallback.header, ...(payload?.header || {}) },
    filter: { ...fallback.filter, ...(payload?.filter || {}) },
    overview: {
      cards: Array.isArray(payload?.overview?.cards) && payload.overview.cards.length
        ? payload.overview.cards
        : fallback.overview.cards,
    },
    chart: {
      ...fallback.chart,
      ...(payload?.chart || {}),
      tabs: Array.isArray(payload?.chart?.tabs) && payload.chart.tabs.length ? payload.chart.tabs : CHART_TABS,
      rangeOptions: Array.isArray(payload?.chart?.rangeOptions) && payload.chart.rangeOptions.length ? payload.chart.rangeOptions : RANGE_OPTIONS,
      series: Array.isArray(payload?.chart?.series) && payload.chart.series.length ? payload.chart.series : fallback.chart.series,
    },
    devicesUsage: {
      ...fallback.devicesUsage,
      ...(payload?.devicesUsage || {}),
      primary: Array.isArray(payload?.devicesUsage?.primary) && payload.devicesUsage.primary.length ? payload.devicesUsage.primary : fallback.devicesUsage.primary,
      secondary: Array.isArray(payload?.devicesUsage?.secondary) && payload.devicesUsage.secondary.length ? payload.devicesUsage.secondary : fallback.devicesUsage.secondary,
      legend: Array.isArray(payload?.devicesUsage?.legend) && payload.devicesUsage.legend.length ? payload.devicesUsage.legend : fallback.devicesUsage.legend,
    },
    recentPosts: {
      ...(payload?.recentPosts || {}),
      items: recentItems,
      source: payload?.recentPosts?.source || fallback.recentPosts.source,
    },
    topUsers: {
      ...(payload?.topUsers || {}),
      items: topUsers,
      source: payload?.topUsers?.source || fallback.topUsers.source,
    },
    kpis: {
      ...(payload?.kpis || {}),
      items: Array.isArray(payload?.kpis?.items) && payload.kpis.items.length ? payload.kpis.items : fallback.kpis.items,
    },
    audienceAge: {
      ...(payload?.audienceAge || {}),
      items: Array.isArray(payload?.audienceAge?.items) && payload.audienceAge.items.length ? payload.audienceAge.items : fallback.audienceAge.items,
    },
    navDots: { ...fallback.navDots, ...(payload?.navDots || {}) },
  };
};

export async function loadAdminDashboard(params = {}) {
  const range = params?.range || "30d";
  try {
    const payload = await adminGetDashboard(params);
    return normalizeDashboard(payload, range);
  } catch (error) {
    return {
      ...createSeedDashboard(range),
      error: error?.message || "Failed to load live dashboard data.",
    };
  }
}

export async function getDashboardOverview(params = {}) {
  return (await loadAdminDashboard(params)).overview;
}

export async function getUserStats(params = {}) {
  return (await loadAdminDashboard(params)).topUsers;
}

export async function getRecentPosts(params = {}) {
  return (await loadAdminDashboard(params)).recentPosts;
}

export async function getDeviceUsage(params = {}) {
  return (await loadAdminDashboard(params)).devicesUsage;
}

export async function getEngagementSeries(params = {}) {
  return (await loadAdminDashboard(params)).chart;
}

export async function getAudienceBreakdown(params = {}) {
  return (await loadAdminDashboard(params)).audienceAge;
}
