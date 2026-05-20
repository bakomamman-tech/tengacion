import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminShell from "../components/AdminShell";
import { adminGetCreatorEarningsRepository, adminGetRevenueLedger } from "../api";

const RANGE_OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "year", label: "This year" },
];

const number = (value) => Number(value || 0).toLocaleString();
const currency = (value) => `NGN ${Number(value || 0).toLocaleString()}`;
const eventLabel = (value = "") =>
  String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");

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
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [next, ledgerPayload] = await Promise.all([
        adminGetCreatorEarningsRepository({ range }),
        adminGetRevenueLedger({ range, limit: 12 }),
      ]);
      setPayload(next || null);
      setLedger(ledgerPayload || null);
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
  const settlementAccount = repository.settlementAccount || {};
  const breakdownItems = payload?.breakdown?.items || [];
  const topCreators = payload?.topCreators || [];
  const recentEntries = payload?.recentEntries || [];
  const ledgerSummary = ledger?.summary || {};
  const ledgerBalances = ledger?.balances || [];
  const ledgerRecentEntries = ledger?.recentEntries || [];

  const headlineCards = useMemo(
    () => [
      ["Earnings From Creators", currency(repository.repositoryAmount)],
      ["Gross Creator Revenue", currency(repository.grossRevenue)],
      ["Creator Share Liability", currency(repository.creatorAmount)],
      ["Ledger Entries", number(ledgerSummary.totalEntries || repository.paidTransactions)],
    ],
    [
      ledgerSummary.totalEntries,
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
              <div className="adminx-finance-meta">
                <span>Settlement: {settlementAccount.accountName || "Not set"}</span>
                <span>{settlementAccount.bankName || "Bank not set"}</span>
                <span>{settlementAccount.accountNumber || "Account not set"}</span>
              </div>
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

          <div className="adminx-analytics-grid">
            <section className="adminx-panel adminx-panel--span-5">
              <div className="adminx-panel-head">
                <h2 className="adminx-panel-title">Revenue Ledger</h2>
                <span className="adminx-section-meta">Finance event trail</span>
              </div>
              <div className="adminx-ops-grid">
                {[
                  ["Payment settled", number(ledgerSummary.paymentSettled)],
                  ["Commission reserved", currency(ledgerSummary.platformCommissionReserved)],
                  ["Creator credited", currency(ledgerSummary.creatorEarningCredited)],
                  ["Refund settled", currency(ledgerSummary.refundSettled)],
                  ["Payout requested", currency(ledgerSummary.payoutRequested)],
                  ["Payout sent", currency(ledgerSummary.payoutSent)],
                ].map(([label, value]) => (
                  <div key={label} className="adminx-ops-metric">
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="adminx-panel adminx-panel--span-7">
              <div className="adminx-panel-head">
                <h2 className="adminx-panel-title">Ledger Balances</h2>
                <span className="adminx-section-meta">Latest resulting balances by account scope</span>
              </div>
              <div className="adminx-leaderboard">
                {ledgerBalances.map((entry) => (
                  <article key={`${entry.accountType}-${entry.balanceScope}-${entry.currency}`} className="adminx-leaderboard-item">
                    <div className="adminx-row">
                      <strong>{eventLabel(entry.accountType)} - {eventLabel(entry.balanceScope)}</strong>
                      <span className="adminx-badge adminx-badge--good">{currency(entry.balance)}</span>
                    </div>
                    <div className="adminx-finance-meta">
                      <span>{number(entry.accountCount)} account{Number(entry.accountCount || 0) === 1 ? "" : "s"}</span>
                      <span>{entry.currency || "NGN"}</span>
                    </div>
                  </article>
                ))}
                {!ledgerBalances.length ? <div className="adminx-empty">No balance-bearing ledger entries yet.</div> : null}
              </div>
            </section>
          </div>

          <section className="adminx-panel adminx-panel--span-12">
            <div className="adminx-panel-head">
              <h2 className="adminx-panel-title">Recent Ledger Entries</h2>
              <span className="adminx-section-meta">Actor, source, amount, and resulting balance</span>
            </div>
            <div className="adminx-table-wrap adminx-table-wrap--flush">
              <table className="adminx-table">
                <thead>
                  <tr>
                    <th>Occurred</th>
                    <th>Event</th>
                    <th>Account</th>
                    <th>Source</th>
                    <th>Amount</th>
                    <th>Balance</th>
                    <th>Actor</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerRecentEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{dateTime(entry.occurredAt)}</td>
                      <td>{eventLabel(entry.ledgerEventType)}</td>
                      <td>{eventLabel(entry.accountType)} {entry.balanceScope !== "none" ? `- ${eventLabel(entry.balanceScope)}` : ""}</td>
                      <td>{eventLabel(entry.sourceType)} {entry.providerReference ? `- ${entry.providerReference}` : ""}</td>
                      <td>{entry.direction === "debit" ? "-" : ""}{currency(entry.amount)}</td>
                      <td>{currency(entry.resultingBalance)}</td>
                      <td>{eventLabel(entry.actorType)} {entry.actorRole ? `(${entry.actorRole})` : ""}</td>
                    </tr>
                  ))}
                  {!ledgerRecentEntries.length ? (
                    <tr>
                      <td colSpan={7} className="adminx-table-empty">
                        No revenue ledger entries found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </AdminShell>
  );
}
