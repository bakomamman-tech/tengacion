import { adminGetDashboard, resolveImage } from "../api";

const APPROVED_USER_NAMES = [
  "Lorietta Billy",
  "Daniel Stephen Kurah",
  "Admin User",
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

const KPI_ITEMS = [
  { id: "likes", label: "Likes", icon: "heart", value: 0 },
  { id: "comments", label: "Comments", icon: "comment", value: 0 },
  { id: "shares", label: "Shares", icon: "share", value: 0 },
  { id: "saves", label: "Saves", icon: "bookmark", value: 0 },
  { id: "profileVisits", label: "Profile Visits", icon: "profile", value: 0 },
  { id: "contentInteractions", label: "Content Interactions", icon: "spark", value: 0 },
];

const AGE_ITEMS = [
  { label: "13-17", value: 0 },
  { label: "18-24", value: 0 },
  { label: "25-34", value: 0 },
  { label: "35-44", value: 0 },
  { label: "45-54", value: 0 },
  { label: "55+", value: 0 },
];

const DEVICE_ITEMS = {
  primary: [
    { label: "Android", value: 0, color: "#63d7c5" },
    { label: "iOS", value: 0, color: "#7b86ff" },
    { label: "Other", value: 0, color: "#8ea2c4" },
  ],
  secondary: [
    { label: "Desktop", value: 0, color: "#5aa3ff" },
    { label: "Mobile Web", value: 0, color: "#b49cff" },
    { label: "Other", value: 0, color: "#8ea2c4" },
  ],
  legend: [
    { label: "Android", value: 0, percent: 0, color: "#63d7c5" },
    { label: "Desktop", value: 0, percent: 0, color: "#5aa3ff" },
    { label: "Mobile Web", value: 0, percent: 0, color: "#b49cff" },
    { label: "iOS", value: 0, percent: 0, color: "#7b86ff" },
    { label: "Other", value: 0, percent: 0, color: "#8ea2c4" },
  ],
};

const baseCards = [
  { id: "total-users", label: "Total Users", value: 0, unit: "number", helper: "Registered accounts", change: 0, sparkline: [0, 0, 0, 0] },
  { id: "active-users", label: "Active Users", value: 0, unit: "number", helper: "Current active audience", change: 0, sparkline: [0, 0, 0, 0] },
  { id: "engagement", label: "Engagement", value: 0, unit: "percent", helper: "Interactions over active reach", change: 0, sparkline: [0, 0, 0, 0] },
  { id: "reach", label: "Reach", value: 0, unit: "number", helper: "Derived exposure in range", change: 0, sparkline: [0, 0, 0, 0] },
];

const isApprovedName = (value = "") => APPROVED_NAME_SET.has(String(value || "").toLowerCase());

const createEmptyDashboard = (range = "30d") => ({
  dataMode: "limited",
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
    notificationCount: 0,
    alerts: [],
  },
  overview: {
    cards: baseCards,
    source: "empty",
  },
  chart: {
    tabs: CHART_TABS,
    rangeOptions: RANGE_OPTIONS,
    activeTab: "activity",
    series: [],
    source: "empty",
  },
  devicesUsage: {
    primaryTitle: "Mobile OS",
    secondaryTitle: "Access Mix",
    primary: DEVICE_ITEMS.primary,
    secondary: DEVICE_ITEMS.secondary,
    legend: DEVICE_ITEMS.legend,
    source: "empty",
  },
  recentPosts: {
    items: [],
    source: "empty",
  },
  topUsers: {
    items: [],
    source: "empty",
  },
  kpis: {
    items: KPI_ITEMS,
    source: "empty",
  },
  audienceAge: {
    items: AGE_ITEMS,
    source: "empty",
  },
  navDots: {
    analytics: false,
    messages: false,
    campaigns: false,
    settings: false,
  },
});

const normalizeDashboard = (payload, range = "30d") => {
  const base = createEmptyDashboard(range);
  const recentItems = (payload?.recentPosts?.items || [])
    .filter((item) => isApprovedName(item?.authorName))
    .map((item) => ({
      ...item,
      previewImage: resolveImage(item?.previewImage || ""),
    }));

  const topUsers = (payload?.topUsers?.items || [])
    .filter((item) => isApprovedName(item?.displayName))
    .map((item) => ({
      ...item,
      avatarUrl: resolveImage(item?.avatarUrl || ""),
    }));

  return {
    ...base,
    ...payload,
    header: { ...base.header, ...(payload?.header || {}) },
    filter: { ...base.filter, ...(payload?.filter || {}) },
    overview: {
      ...(payload?.overview || {}),
      cards: Array.isArray(payload?.overview?.cards) && payload.overview.cards.length
        ? payload.overview.cards
        : base.overview.cards,
    },
    chart: {
      ...base.chart,
      ...(payload?.chart || {}),
      tabs: Array.isArray(payload?.chart?.tabs) && payload.chart.tabs.length ? payload.chart.tabs : CHART_TABS,
      rangeOptions: Array.isArray(payload?.chart?.rangeOptions) && payload.chart.rangeOptions.length ? payload.chart.rangeOptions : RANGE_OPTIONS,
      series: Array.isArray(payload?.chart?.series) ? payload.chart.series : base.chart.series,
    },
    devicesUsage: {
      ...base.devicesUsage,
      ...(payload?.devicesUsage || {}),
      primary: Array.isArray(payload?.devicesUsage?.primary) ? payload.devicesUsage.primary : base.devicesUsage.primary,
      secondary: Array.isArray(payload?.devicesUsage?.secondary) ? payload.devicesUsage.secondary : base.devicesUsage.secondary,
      legend: Array.isArray(payload?.devicesUsage?.legend) ? payload.devicesUsage.legend : base.devicesUsage.legend,
    },
    recentPosts: {
      ...(payload?.recentPosts || {}),
      items: recentItems,
    },
    topUsers: {
      ...(payload?.topUsers || {}),
      items: topUsers,
    },
    kpis: {
      ...(payload?.kpis || {}),
      items: Array.isArray(payload?.kpis?.items) && payload.kpis.items.length ? payload.kpis.items : base.kpis.items,
    },
    audienceAge: {
      ...(payload?.audienceAge || {}),
      items: Array.isArray(payload?.audienceAge?.items) && payload.audienceAge.items.length ? payload.audienceAge.items : base.audienceAge.items,
    },
    navDots: { ...base.navDots, ...(payload?.navDots || {}) },
  };
};

export async function loadAdminDashboard(params = {}) {
  const range = params?.range || "30d";
  try {
    const payload = await adminGetDashboard(params);
    return normalizeDashboard(payload, range);
  } catch (error) {
    return {
      ...createEmptyDashboard(range),
      error: error?.message || "Failed to load dashboard data.",
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
