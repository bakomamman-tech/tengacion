import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  LineChart,
  Line,
} from "recharts";
import AdminShell from "../components/AdminShell";
import {
  adminGetAnalyticsOverview,
  adminGetAnalyticsUserGrowth,
  adminGetAnalyticsContentUploads,
  adminGetAnalyticsRevenue,
  adminGetAnalyticsEngagement,
  adminGetAnalyticsTopCreators,
  adminGetAnalyticsTopContent,
  adminGetAnalyticsRecentActivity,
  adminGetAnalyticsSystemAlerts,
  adminGetAnalyticsReportsSummary,
} from "../api";

const RANGE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "year", label: "This Year" },
  { value: "custom", label: "Custom" },
];

const CATEGORY_OPTIONS = [
  { value: "all", label: "All Content" },
  { value: "music", label: "Music" },
  { value: "albums", label: "Albums" },
  { value: "books", label: "Books" },
  { value: "podcasts", label: "Podcasts" },
  { value: "videos", label: "Videos" },
];

const currency = (value) => `NGN ${Number(value || 0).toLocaleString()}`;
const number = (value) => Number(value || 0).toLocaleString();
const todayInput = () => new Date().toISOString().slice(0, 10);
const dateTime = (value) => {
  if (!value) {return "-";}
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {return String(value);}
  return date.toLocaleString();
};

const eventLabel = (type = "") =>
  String(type || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");

const downloadBlob = ({ filename, content, type }) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

function SummaryCards({ summary, interactions }) {
  const items = [
    ["Total Users", number(summary.totalUsers)],
    ["New Users Today", number(summary.newUsersToday)],
    ["Active Users Today", number(summary.activeUsersToday)],
    ["Creator Accounts", number(summary.totalCreatorAccounts)],
    ["Total Posts", number(summary.totalPosts)],
    ["Total Songs", number(summary.totalSongs)],
    ["Total Albums", number(summary.totalAlbums)],
    ["Total Videos", number(summary.totalVideos)],
    ["Total Podcasts", number(summary.totalPodcasts)],
    ["Total Books", number(summary.totalBooks)],
    ["Revenue This Month", currency(summary.revenueThisMonth)],
    ["Downloads Today", number(summary.downloadsToday)],
    ["Streams Today", number(summary.streamsToday)],
    ["Post Likes", number(interactions.likes)],
    ["Post Comments", number(interactions.comments)],
    ["Post Shares", number(interactions.shares)],
  ];

  return (
    <div className="adminx-stats-grid">
      {items.map(([label, value]) => (
        <article key={label} className="adminx-stat-card">
          <div className="adminx-kpi-label">{label}</div>
          <div className="adminx-kpi-value">{value}</div>
        </article>
      ))}
    </div>
  );
}

export default function AdminAnalyticsPage({ user }) {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ range: "30d", category: "all", interval: "daily", startDate: "", endDate: "" });
  const [creatorMode, setCreatorMode] = useState("revenue");
  const [activityPage, setActivityPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState({ summary: {}, series: [] });
  const [userGrowth, setUserGrowth] = useState({ series: [] });
  const [contentUploads, setContentUploads] = useState({ series: [] });
  const [revenue, setRevenue] = useState({ series: [] });
  const [engagement, setEngagement] = useState({ series: [] });
  const [topCreators, setTopCreators] = useState({ items: [] });
  const [topContent, setTopContent] = useState({ items: [] });
  const [recentActivity, setRecentActivity] = useState({ items: [], total: 0, page: 1, limit: 10 });
  const [systemAlerts, setSystemAlerts] = useState({ alerts: [], metrics: {} });
  const [reportsSummary, setReportsSummary] = useState({ summary: {}, series: [] });

  const filterParams = useMemo(() => ({
    range: filters.range,
    category: filters.category,
    interval: filters.interval,
    ...(filters.range === "custom" ? { startDate: filters.startDate, endDate: filters.endDate } : {}),
  }), [filters]);

  const postInteractions = useMemo(
    () =>
      (engagement.series || []).reduce(
        (accumulator, row) => ({
          posts: accumulator.posts + Number(row.postsCount || 0),
          likes: accumulator.likes + Number(row.likes || 0),
          comments: accumulator.comments + Number(row.comments || 0),
          shares: accumulator.shares + Number(row.shares || 0),
        }),
        { posts: 0, likes: 0, comments: 0, shares: 0 }
      ),
    [engagement.series]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [
        overviewPayload,
        growthPayload,
        uploadsPayload,
        revenuePayload,
        engagementPayload,
        topCreatorsPayload,
        topContentPayload,
        activityPayload,
        alertsPayload,
        reportsPayload,
      ] = await Promise.all([
        adminGetAnalyticsOverview(filterParams),
        adminGetAnalyticsUserGrowth(filterParams),
        adminGetAnalyticsContentUploads(filterParams),
        adminGetAnalyticsRevenue(filterParams),
        adminGetAnalyticsEngagement(filterParams),
        adminGetAnalyticsTopCreators({ ...filterParams, mode: creatorMode }),
        adminGetAnalyticsTopContent(filterParams),
        adminGetAnalyticsRecentActivity({ ...filterParams, page: activityPage, limit: 10 }),
        adminGetAnalyticsSystemAlerts(filterParams),
        adminGetAnalyticsReportsSummary(filterParams),
      ]);
      setOverview(overviewPayload || { summary: {}, series: [] });
      setUserGrowth(growthPayload || { series: [] });
      setContentUploads(uploadsPayload || { series: [] });
      setRevenue(revenuePayload || { series: [] });
      setEngagement(engagementPayload || { series: [] });
      setTopCreators(topCreatorsPayload || { items: [] });
      setTopContent(topContentPayload || { items: [] });
      setRecentActivity((prev) => {
        const next = activityPayload || { items: [] };
        if (activityPage > 1) {
          return {
            ...next,
            items: [...(prev.items || []), ...(next.items || [])],
          };
        }
        return next;
      });
      setSystemAlerts(alertsPayload || { alerts: [], metrics: {} });
      setReportsSummary(reportsPayload || { summary: {}, series: [] });
    } catch (err) {
      setError(err?.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [activityPage, creatorMode, filterParams]);

  useEffect(() => {
    load();
  }, [load]);

  const exportJson = () => {
    downloadBlob({
      filename: `tengacion-admin-analytics-${filters.range}.json`,
      content: JSON.stringify({ filters, overview, userGrowth, contentUploads, revenue, engagement, topCreators, topContent, recentActivity, systemAlerts, reportsSummary }, null, 2),
      type: "application/json",
    });
  };

  const exportCsv = () => {
    const rows = (overview.series || []).map((row) => [
      row.date,
      row.newUsers || 0,
      row.activeUsers || row.dau || 0,
      row.songsUploaded || 0,
      row.albumsUploaded || 0,
      row.booksUploaded || 0,
      row.podcastsUploaded || 0,
      row.videosUploaded || 0,
      row.revenueAmount || 0,
      row.downloads || 0,
      row.streams || 0,
    ]);
    const header = ["date", "newUsers", "activeUsers", "songsUploaded", "albumsUploaded", "booksUploaded", "podcastsUploaded", "videosUploaded", "revenueAmount", "downloads", "streams"];
    const csv = [header, ...rows].map((row) => row.join(",")).join("\n");
    downloadBlob({ filename: `tengacion-admin-analytics-${filters.range}.csv`, content: csv, type: "text/csv;charset=utf-8" });
  };

  return (
    <AdminShell
      title="Admin Analytics"
      subtitle="Real-time platform analytics across user growth, uploads, purchases, engagement, reports, and operational health."
      user={user}
      actions={(
        <div className="adminx-action-row">
          <button type="button" className="adminx-btn" onClick={load}>Refresh</button>
          <button type="button" className="adminx-btn" onClick={exportCsv}>Export CSV</button>
          <button type="button" className="adminx-btn adminx-btn--primary" onClick={exportJson}>Export JSON</button>
        </div>
      )}
    >
      <section className="adminx-panel adminx-panel--span-12">
        <div className="adminx-filter-row">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`adminx-tab ${filters.range === option.value ? "is-active" : ""}`}
              onClick={() => {
                setFilters((prev) => ({
                  ...prev,
                  range: option.value,
                  ...(option.value === "custom"
                    ? {
                        startDate: prev.startDate || todayInput(),
                        endDate: prev.endDate || todayInput(),
                      }
                    : {}),
                }));
                setActivityPage(1);
              }}
            >
              {option.label}
            </button>
          ))}
          <select className="adminx-select" value={filters.category} onChange={(e) => { setFilters((prev) => ({ ...prev, category: e.target.value })); setActivityPage(1); }}>
            {CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select className="adminx-select" value={filters.interval} onChange={(e) => { setFilters((prev) => ({ ...prev, interval: e.target.value })); setActivityPage(1); }}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          {filters.range === "custom" ? (
            <>
              <input className="adminx-input" type="date" value={filters.startDate} onChange={(e) => { setFilters((prev) => ({ ...prev, startDate: e.target.value })); setActivityPage(1); }} />
              <input className="adminx-input" type="date" value={filters.endDate} onChange={(e) => { setFilters((prev) => ({ ...prev, endDate: e.target.value })); setActivityPage(1); }} />
            </>
          ) : null}
        </div>
      </section>

      {error ? (
        <div className="adminx-error">
          <div>{error}</div>
          <button type="button" className="adminx-btn" onClick={load}>Retry</button>
        </div>
      ) : null}

      {loading ? <div className="adminx-loading">Loading analytics...</div> : null}

      {!loading ? <SummaryCards summary={overview.summary || {}} interactions={postInteractions} /> : null}

      {!loading ? (
        <div className="adminx-analytics-grid">
          <section className="adminx-panel adminx-panel--span-6">
            <div className="adminx-panel-head"><h2 className="adminx-panel-title">User Growth</h2><span className="adminx-section-meta">New and active users</span></div>
            <div className="adminx-chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={userGrowth.series || []}>
                  <defs>
                    <linearGradient id="userGrowthFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4de586" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#4de586" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="date" stroke="#9ec4ad" />
                  <YAxis stroke="#9ec4ad" />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="newUsers" stroke="#4de586" fill="url(#userGrowthFill)" />
                  <Area type="monotone" dataKey="activeUsers" stroke="#9ef4be" fill="rgba(158,244,190,0.16)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="adminx-panel adminx-panel--span-6">
            <div className="adminx-panel-head"><h2 className="adminx-panel-title">Content Uploads</h2><span className="adminx-section-meta">Songs, albums, books, podcasts, videos</span></div>
            <div className="adminx-chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={contentUploads.series || []}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="date" stroke="#9ec4ad" />
                  <YAxis stroke="#9ec4ad" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="songs" fill="#4de586" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="albums" fill="#33b96a" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="books" fill="#a7f7c6" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="podcasts" fill="#77d998" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="videos" fill="#1f8b4b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="adminx-panel adminx-panel--span-6">
            <div className="adminx-panel-head"><h2 className="adminx-panel-title">Revenue & Purchases</h2><span className="adminx-section-meta">Successful and failed payments</span></div>
            <div className="adminx-chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenue.series || []}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="date" stroke="#9ec4ad" />
                  <YAxis stroke="#9ec4ad" />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#4de586" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="successfulPurchases" stroke="#9ef4be" dot={false} />
                  <Line type="monotone" dataKey="failedPurchases" stroke="#ff8f8f" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="adminx-panel adminx-panel--span-6">
            <div className="adminx-panel-head"><h2 className="adminx-panel-title">Engagement</h2><span className="adminx-section-meta">Downloads, streams, messages, friend activity</span></div>
            <div className="adminx-chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={engagement.series || []}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="date" stroke="#9ec4ad" />
                  <YAxis stroke="#9ec4ad" />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="downloads" stroke="#a7f7c6" fill="rgba(167,247,198,0.22)" />
                  <Area type="monotone" dataKey="streams" stroke="#4de586" fill="rgba(77,229,134,0.22)" />
                  <Area type="monotone" dataKey="messagesSent" stroke="#77d998" fill="rgba(119,217,152,0.16)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="adminx-panel adminx-panel--span-6">
            <div className="adminx-panel-head"><h2 className="adminx-panel-title">Post Interactions</h2><span className="adminx-section-meta">Live likes, comments, shares, and post creation volume</span></div>
            <div className="adminx-chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={engagement.series || []}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="date" stroke="#9ec4ad" />
                  <YAxis stroke="#9ec4ad" />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="likes" stroke="#4de586" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="comments" stroke="#9ef4be" dot={false} />
                  <Line type="monotone" dataKey="shares" stroke="#77d998" dot={false} />
                  <Line type="monotone" dataKey="postsCount" stroke="#ffd166" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="adminx-panel adminx-panel--span-5">
            <div className="adminx-panel-head">
              <h2 className="adminx-panel-title">Top Creators</h2>
              <div className="adminx-pill-row">
                {[
                  ["revenue", "Revenue"],
                  ["streams", "Streams"],
                  ["downloads", "Downloads"],
                ].map(([value, label]) => (
                  <button key={value} type="button" className={`adminx-tab ${creatorMode === value ? "is-active" : ""}`} onClick={() => setCreatorMode(value)}>{label}</button>
                ))}
              </div>
            </div>
            <div className="adminx-leaderboard">
              {(topCreators.items || []).map((entry) => (
                <button key={entry.creatorId} type="button" className="adminx-leaderboard-item" onClick={() => navigate(`/admin/creators/${entry.creatorId}`)}>
                  <div className="adminx-row"><strong>{entry.displayName}</strong><span className="adminx-badge">@{entry.username || "creator"}</span></div>
                  <div className="adminx-row">
                    <span>Revenue: {currency(entry.totalRevenue)}</span>
                    <span>Streams: {number(entry.totalStreams)}</span>
                  </div>
                  <div className="adminx-row">
                    <span>Downloads: {number(entry.totalDownloads)}</span>
                    <span>Uploads: {number(entry.uploadsCount)}</span>
                  </div>
                </button>
              ))}
              {!(topCreators.items || []).length ? <div className="adminx-empty">No creator performance data yet.</div> : null}
            </div>
          </section>

          <section className="adminx-panel adminx-panel--span-7">
            <div className="adminx-panel-head"><h2 className="adminx-panel-title">Top Performing Content</h2><button type="button" className="adminx-link-btn" onClick={() => navigate("/admin/content")}>View All</button></div>
            <div className="adminx-leaderboard">
              {(topContent.items || []).map((entry) => (
                <button key={`${entry.type}-${entry.id}`} type="button" className="adminx-leaderboard-item" onClick={() => navigate("/admin/content")}> 
                  <div className="adminx-row"><strong>{entry.title}</strong><span className="adminx-badge">{entry.type}</span></div>
                  <div className="adminx-row"><span>Performance: {number(entry.metricValue)}</span><span>Purchases: {number(entry.purchases)}</span></div>
                </button>
              ))}
              {!(topContent.items || []).length ? <div className="adminx-empty">No content performance data yet.</div> : null}
            </div>
          </section>

          <section className="adminx-panel adminx-panel--span-7">
            <div className="adminx-panel-head"><h2 className="adminx-panel-title">Recent Activity</h2><button type="button" className="adminx-link-btn" onClick={() => setActivityPage((prev) => prev + 1)}>View More</button></div>
            <div className="adminx-activity-list">
              {(recentActivity.items || []).map((entry) => (
                <button key={entry._id} type="button" className="adminx-activity-item" onClick={() => {
                  if (entry.type === "content_reported" || entry.targetType === "report") {navigate("/admin/reports");}
                  else if (entry.targetType === "purchase") {navigate("/admin/transactions");}
                  else if (["track", "album", "book", "podcast", "video"].includes(entry.contentType || entry.targetType)) {navigate("/admin/content");}
                  else {navigate("/admin/analytics");}
                }}>
                  <div className="adminx-row"><strong>{eventLabel(entry.type)}</strong><span className="adminx-activity-time">{dateTime(entry.createdAt)}</span></div>
                  <div className="adminx-muted">{entry.contentType || entry.targetType || "platform"}</div>
                </button>
              ))}
              {!(recentActivity.items || []).length ? <div className="adminx-empty">No tracked activity in this range.</div> : null}
            </div>
          </section>

          <section className="adminx-panel adminx-panel--span-5">
            <div className="adminx-panel-head"><h2 className="adminx-panel-title">System Alerts</h2><button type="button" className="adminx-link-btn" onClick={load}>Retry Checks</button></div>
            <div className="adminx-alert-list">
              {(systemAlerts.alerts || []).map((alert) => (
                <button key={alert.key} type="button" className="adminx-alert-item" onClick={() => navigate(alert.actionPath || "/admin/analytics")}> 
                  <div className="adminx-row"><strong>{alert.title}</strong><span className={`adminx-badge ${alert.severity === "high" ? "adminx-badge--danger" : "adminx-badge--warn"}`}>{alert.severity}</span></div>
                  <div className="adminx-muted">Current value: {number(alert.value)}</div>
                </button>
              ))}
              {!(systemAlerts.alerts || []).length ? <div className="adminx-empty">No active system alerts.</div> : null}
            </div>
          </section>

          <section className="adminx-panel adminx-panel--span-6">
            <div className="adminx-panel-head"><h2 className="adminx-panel-title">Reports Summary</h2><button type="button" className="adminx-link-btn" onClick={() => navigate("/admin/reports")}>Open Reports</button></div>
            <div className="adminx-mobile-stack">
              <span className="adminx-badge">Open {number(reportsSummary.summary?.open)}</span>
              <span className="adminx-badge">Reviewing {number(reportsSummary.summary?.reviewing)}</span>
              <span className="adminx-badge">Actioned {number(reportsSummary.summary?.actioned)}</span>
              <span className="adminx-badge">Dismissed {number(reportsSummary.summary?.dismissed)}</span>
            </div>
            <div className="adminx-chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportsSummary.series || []}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="date" stroke="#9ec4ad" />
                  <YAxis stroke="#9ec4ad" />
                  <Tooltip />
                  <Bar dataKey="reportsFiled" fill="#77d998" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="adminx-panel adminx-panel--span-6">
            <div className="adminx-panel-head"><h2 className="adminx-panel-title">Operational Metrics</h2><button type="button" className="adminx-link-btn" onClick={() => navigate("/admin/transactions")}>Open Transactions</button></div>
            <div className="adminx-leaderboard">
              <div className="adminx-leaderboard-item"><div className="adminx-row"><strong>Failed Payments</strong><span>{number(systemAlerts.metrics?.failedPayments)}</span></div></div>
              <div className="adminx-leaderboard-item"><div className="adminx-row"><strong>Upload Failures</strong><span>{number(systemAlerts.metrics?.uploadFailures)}</span></div></div>
              <div className="adminx-leaderboard-item"><div className="adminx-row"><strong>Login Warnings</strong><span>{number(systemAlerts.metrics?.loginWarnings)}</span></div></div>
              <div className="adminx-leaderboard-item"><div className="adminx-row"><strong>Unresolved Reports</strong><span>{number(systemAlerts.metrics?.unresolvedReports)}</span></div></div>
              <div className="adminx-leaderboard-item"><div className="adminx-row"><strong>Repeat Upload Failures</strong><span>{number(systemAlerts.metrics?.repeatFailedUploads)}</span></div></div>
            </div>
          </section>
        </div>
      ) : null}
    </AdminShell>
  );
}
