import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminShell from "../components/AdminShell";
import {
  adminGetAnalyticsOverview,
  adminGetAnalyticsRevenue,
  adminGetAnalyticsTopCreators,
  adminGetAnalyticsTopContent,
} from "../api";

const RANGE_OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "year", label: "This year" },
];

const number = (value) => Number(value || 0).toLocaleString();
const currency = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

export default function AdminCampaignsPage({ user }) {
  const navigate = useNavigate();
  const [range, setRange] = useState("30d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState({ summary: {} });
  const [revenue, setRevenue] = useState({ series: [] });
  const [topCreators, setTopCreators] = useState({ items: [] });
  const [topContent, setTopContent] = useState({ items: [] });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [overviewPayload, revenuePayload, creatorsPayload, contentPayload] = await Promise.all([
        adminGetAnalyticsOverview({ range }),
        adminGetAnalyticsRevenue({ range, interval: "daily" }),
        adminGetAnalyticsTopCreators({ range, mode: "revenue" }),
        adminGetAnalyticsTopContent({ category: "all", limit: 5 }),
      ]);
      setOverview(overviewPayload || { summary: {} });
      setRevenue(revenuePayload || { series: [] });
      setTopCreators(creatorsPayload || { items: [] });
      setTopContent(contentPayload || { items: [] });
    } catch (err) {
      setError(err?.message || "Failed to load campaign metrics");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const series = revenue.series || [];
    return {
      purchases: series.reduce((sum, row) => sum + Number(row.successfulPurchases || 0), 0),
      revenue: series.reduce((sum, row) => sum + Number(row.revenue || 0), 0),
    };
  }, [revenue.series]);

  const headlineCards = [
    ["Revenue in Range", currency(totals.revenue)],
    ["Successful Purchases", number(totals.purchases)],
    ["Creator Accounts", number(overview.summary?.totalCreatorAccounts)],
    ["Total Posts", number(overview.summary?.totalPosts)],
  ];

  return (
    <AdminShell
      title="Campaigns"
      subtitle="Growth and monetization signals for creator performance, purchases, and content reach."
      user={user}
      actions={<button type="button" className="adminx-btn" onClick={load}>Refresh</button>}
    >
      <section className="adminx-panel adminx-panel--span-12">
        <div className="adminx-filter-row">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`adminx-tab ${range === option.value ? "is-active" : ""}`}
              onClick={() => setRange(option.value)}
            >
              {option.label}
            </button>
          ))}
          <button type="button" className="adminx-btn" onClick={() => navigate("/admin/transactions")}>Open Transactions</button>
          <button type="button" className="adminx-btn" onClick={() => navigate("/admin/analytics")}>Open Analytics</button>
        </div>
      </section>

      {error ? <div className="adminx-error">{error}</div> : null}
      {loading ? <div className="adminx-loading">Loading campaign insights...</div> : null}

      {!loading ? (
        <>
          <div className="adminx-stats-grid">
            {headlineCards.map(([label, value]) => (
              <article key={label} className="adminx-stat-card">
                <div className="adminx-kpi-label">{label}</div>
                <div className="adminx-kpi-value">{value}</div>
              </article>
            ))}
          </div>

          <div className="adminx-analytics-grid">
            <section className="adminx-panel adminx-panel--span-6">
              <div className="adminx-panel-head">
                <h2 className="adminx-panel-title">Top Revenue Creators</h2>
                <span className="adminx-section-meta">Current leaders by paid conversions</span>
              </div>
              <div className="adminx-leaderboard">
                {(topCreators.items || []).slice(0, 5).map((entry) => (
                  <button
                    key={entry.creatorId}
                    type="button"
                    className="adminx-leaderboard-item"
                    onClick={() => navigate(`/admin/creators/${entry.creatorId}`)}
                  >
                    <div className="adminx-row">
                      <strong>{entry.displayName}</strong>
                      <span className="adminx-badge">{currency(entry.totalRevenue)}</span>
                    </div>
                    <div className="adminx-row">
                      <span>Purchases: {number(entry.purchases)}</span>
                      <span>Uploads: {number(entry.uploadsCount)}</span>
                    </div>
                  </button>
                ))}
                {!(topCreators.items || []).length ? <div className="adminx-empty">No creator revenue data yet.</div> : null}
              </div>
            </section>

            <section className="adminx-panel adminx-panel--span-6">
              <div className="adminx-panel-head">
                <h2 className="adminx-panel-title">Top Performing Content</h2>
                <button type="button" className="adminx-link-btn" onClick={() => navigate("/admin/content")}>Open Content</button>
              </div>
              <div className="adminx-leaderboard">
                {(topContent.items || []).slice(0, 5).map((entry) => (
                  <button
                    key={`${entry.type}-${entry.id}`}
                    type="button"
                    className="adminx-leaderboard-item"
                    onClick={() => navigate("/admin/content")}
                  >
                    <div className="adminx-row">
                      <strong>{entry.title}</strong>
                      <span className="adminx-badge">{entry.type}</span>
                    </div>
                    <div className="adminx-row">
                      <span>Performance: {number(entry.metricValue)}</span>
                      <span>Purchases: {number(entry.purchases)}</span>
                    </div>
                  </button>
                ))}
                {!(topContent.items || []).length ? <div className="adminx-empty">No content performance data yet.</div> : null}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </AdminShell>
  );
}
