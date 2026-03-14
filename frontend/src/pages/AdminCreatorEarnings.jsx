import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminShell from "../components/AdminShell";
import { adminGetCreatorEarningsRepository } from "../api";

const RANGE_OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "year", label: "This year" },
];

const number = (value) => Number(value || 0).toLocaleString();
const currency = (value) => `NGN ${Number(value || 0).toLocaleString()}`;

const dateTime = (value) => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

export default function AdminCreatorEarningsPage({ user }) {
  const navigate = useNavigate();
  const [range, setRange] = useState("30d");
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await adminGetCreatorEarningsRepository({ range });
      setPayload(next || null);
    } catch (err) {
      setError(err?.message || "Failed to load creator earnings repository");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const repository = payload?.repository || {};
  const breakdownItems = payload?.breakdown?.items || [];
  const topCreators = payload?.topCreators || [];
  const recentEntries = payload?.recentEntries || [];

  const headlineCards = useMemo(
    () => [
      ["Earnings From Creators", currency(repository.repositoryAmount)],
      ["Gross Creator Revenue", currency(repository.grossRevenue)],
      ["Creator Share Liability", currency(repository.creatorAmount)],
      ["Paid Transactions", number(repository.paidTransactions)],
    ],
    [
      repository.creatorAmount,
      repository.grossRevenue,
      repository.paidTransactions,
      repository.repositoryAmount,
    ]
  );

  return (
    <AdminShell
      title="Earnings From Creators"
      subtitle="Admin-side finance repository for Tengacion's 60% share of paid creator earnings across music, podcast, book, video, album, and related creator sales."
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
          <button type="button" className="adminx-btn" onClick={() => navigate("/admin/transactions")}>
            Open Transactions
          </button>
        </div>
      </section>

      {error ? <div className="adminx-error">{error}</div> : null}
      {loading ? <div className="adminx-loading">Loading creator earnings repository...</div> : null}

      {!loading && payload ? (
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
            <section className="adminx-panel adminx-panel--span-5">
              <div className="adminx-panel-head">
                <h2 className="adminx-panel-title">Repository Mandate</h2>
                <span className="adminx-section-meta">{number(repository.activeCreators)} active creators</span>
              </div>
              <div className="adminx-repository-hero">
                <div className="adminx-repository-name">{repository.name || "Earnings From Creators"}</div>
                <div className="adminx-repository-total">{currency(repository.repositoryAmount)}</div>
              </div>
              <div className="adminx-pill-row">
                <span className="adminx-badge adminx-badge--good">
                  {number(repository.platformSharePercent)}% Tengacion repository
                </span>
                <span className="adminx-badge">
                  {number(repository.creatorSharePercent)}% creator share
                </span>
                <span className="adminx-badge">
                  {dateTime(payload.filters?.startDate)} to {dateTime(payload.filters?.endDate)}
                </span>
              </div>
              <p className="adminx-repository-copy">{repository.purpose}</p>
              <p className="adminx-muted">{repository.accountingNote}</p>
            </section>

            <section className="adminx-panel adminx-panel--span-7">
              <div className="adminx-panel-head">
                <h2 className="adminx-panel-title">Revenue Sources</h2>
                <span className="adminx-section-meta">Paid creator income feeding the repository</span>
              </div>
              <div className="adminx-leaderboard">
                {breakdownItems.map((entry) => (
                  <article key={entry.key} className="adminx-leaderboard-item adminx-finance-row">
                    <div className="adminx-row">
                      <strong>{entry.label}</strong>
                      <span className="adminx-badge adminx-badge--good">{currency(entry.repositoryAmount)}</span>
                    </div>
                    <div className="adminx-finance-meta">
                      <span>Gross: {currency(entry.grossRevenue)}</span>
                      <span>Creator Share: {currency(entry.creatorAmount)}</span>
                      <span>Transactions: {number(entry.transactions)}</span>
                    </div>
                  </article>
                ))}
                {!breakdownItems.length ? <div className="adminx-empty">No paid creator earnings recorded in this range.</div> : null}
              </div>
            </section>
          </div>

          <div className="adminx-analytics-grid">
            <section className="adminx-panel adminx-panel--span-5">
              <div className="adminx-panel-head">
                <h2 className="adminx-panel-title">Top Contributing Creators</h2>
                <span className="adminx-section-meta">Ranked by repository contribution</span>
              </div>
              <div className="adminx-leaderboard">
                {topCreators.map((entry) => (
                  <button
                    key={entry.creatorId}
                    type="button"
                    className="adminx-leaderboard-item"
                    onClick={() => navigate(`/admin/creators/${entry.creatorId}`)}
                  >
                    <div className="adminx-row">
                      <strong>{entry.displayName}</strong>
                      <span className="adminx-badge adminx-badge--good">{currency(entry.repositoryAmount)}</span>
                    </div>
                    <div className="adminx-finance-meta">
                      <span>Gross: {currency(entry.grossRevenue)}</span>
                      <span>Creator Share: {currency(entry.creatorAmount)}</span>
                      <span>Transactions: {number(entry.transactions)}</span>
                    </div>
                  </button>
                ))}
                {!topCreators.length ? <div className="adminx-empty">No creator contributions available yet.</div> : null}
              </div>
            </section>

            <section className="adminx-panel adminx-panel--span-7">
              <div className="adminx-panel-head">
                <h2 className="adminx-panel-title">Recent Repository Entries</h2>
                <span className="adminx-section-meta">Latest paid creator transactions</span>
              </div>
              <div className="adminx-table-wrap adminx-table-wrap--flush">
                <table className="adminx-table">
                  <thead>
                    <tr>
                      <th>Paid At</th>
                      <th>Creator</th>
                      <th>Item</th>
                      <th>Source</th>
                      <th>Gross</th>
                      <th>Repository</th>
                      <th>Creator</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td>{dateTime(entry.paidAt)}</td>
                        <td>
                          <button
                            type="button"
                            className="adminx-link-btn adminx-link-btn--inline"
                            onClick={() => navigate(`/admin/creators/${entry.creatorId}`)}
                          >
                            {entry.creatorDisplayName}
                          </button>
                        </td>
                        <td>{entry.itemTitle}</td>
                        <td>{entry.sourceLabel}</td>
                        <td>{currency(entry.grossAmount)}</td>
                        <td>{currency(entry.repositoryAmount)}</td>
                        <td>{currency(entry.creatorAmount)}</td>
                      </tr>
                    ))}
                    {!recentEntries.length ? (
                      <tr>
                        <td colSpan={7} className="adminx-table-empty">
                          No repository entries found.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      ) : null}
    </AdminShell>
  );
}
