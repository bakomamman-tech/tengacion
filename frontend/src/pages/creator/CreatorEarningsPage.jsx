import { useCreatorWorkspace } from "../../components/creator/useCreatorWorkspace";
import {
  formatCurrency,
  formatShortDate,
} from "../../components/creator/creatorConfig";

export default function CreatorEarningsPage() {
  const { dashboard } = useCreatorWorkspace();
  const wallet = dashboard.wallet || {};
  const summary = wallet.summary || dashboard.summary || {};
  const walletBreakdown = Array.isArray(wallet.breakdown) ? wallet.breakdown : [];
  const recentEntries = Array.isArray(wallet.recentEntries)
    ? wallet.recentEntries.slice(0, 6)
    : [];

  return (
    <div className="creator-page-stack">
      <section className="creator-metric-grid">
        <article className="creator-metric-card card">
          <span>Gross revenue</span>
          <strong>{formatCurrency(summary.grossRevenue || 0)}</strong>
        </article>
        <article className="creator-metric-card card">
          <span>Total earnings</span>
          <strong>{formatCurrency(summary.totalEarnings || 0)}</strong>
        </article>
        <article className="creator-metric-card card">
          <span>Available balance</span>
          <strong>{formatCurrency(summary.availableBalance || 0)}</strong>
        </article>
        <article className="creator-metric-card card">
          <span>Pending balance</span>
          <strong>{formatCurrency(summary.pendingBalance || 0)}</strong>
        </article>
      </section>

      <section className="creator-panel card">
        <div className="creator-panel-head">
          <div>
            <h2>Category earnings</h2>
            <p>See which creator lanes are contributing to your credited earnings.</p>
          </div>
        </div>

        <div className="creator-stack-list">
          {Object.entries(dashboard.categories || {}).map(([key, value]) => (
            <div key={key} className="creator-stack-row">
              <span>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
              <strong>{formatCurrency(value?.earnings || 0)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="creator-panel card">
        <div className="creator-panel-head">
          <div>
            <h2>Wallet settlement breakdown</h2>
            <p>
              Creator-share credits grouped by paid content type.
              {wallet.walletBacked
                ? " Live wallet ledger is active."
                : " Showing purchase-backed fallback totals until ledger entries are available."}
            </p>
          </div>
        </div>

        <div className="creator-stack-list">
          {walletBreakdown.length ? (
            walletBreakdown.map((entry) => (
              <div key={entry.key} className="creator-stack-row">
                <span>
                  {entry.label}
                  <small>
                    {Number(entry.transactions || 0)} sale
                    {Number(entry.transactions || 0) === 1 ? "" : "s"}
                  </small>
                </span>
                <strong>{formatCurrency(entry.creatorEarnings || 0)}</strong>
              </div>
            ))
          ) : (
            <div className="creator-empty-card">
              Paid creator sales will appear here once Tengacion confirms a purchase.
            </div>
          )}
        </div>
      </section>

      <section className="creator-panel card">
        <div className="creator-panel-head">
          <div>
            <h2>Recent wallet activity</h2>
            <p>Confirmed sale settlements that affected your creator balance.</p>
          </div>
        </div>

        <div className="creator-activity-list">
          {recentEntries.length ? (
            recentEntries.map((entry) => (
              <article key={entry.id} className="creator-activity-item">
                <div>
                  <strong>{entry.label}</strong>
                  <p>
                    {entry.itemLabel || "Creator sale"} • Gross{" "}
                    {formatCurrency(entry.grossAmount || 0)} • Your share{" "}
                    {formatCurrency(entry.amount || 0)}
                  </p>
                </div>

                <div className="creator-activity-meta">
                  <span
                    className={`creator-status-badge ${
                      entry.direction === "debit" ? "warning" : "success"
                    }`}
                  >
                    {entry.bucket || "available"}
                  </span>
                  <span>{formatShortDate(entry.effectiveAt)}</span>
                </div>
              </article>
            ))
          ) : (
            <div className="creator-empty-card">
              No wallet activity yet. Once a fan completes a paid checkout, the credit
              will show here.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
