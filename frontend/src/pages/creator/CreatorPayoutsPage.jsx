import { Link } from "react-router-dom";

import { useCreatorWorkspace } from "../../components/creator/useCreatorWorkspace";
import {
  formatCurrency,
  formatShortDate,
} from "../../components/creator/creatorConfig";

export default function CreatorPayoutsPage() {
  const { creatorProfile, dashboard } = useCreatorWorkspace();
  const wallet = dashboard.wallet || {};
  const summary = wallet.summary || dashboard.summary || {};
  const payoutReadiness = wallet.payoutReadiness || { ready: false, checks: [] };
  const payoutStatusLabel =
    payoutReadiness.label || (payoutReadiness.ready ? "Ready" : "Needs attention");
  const recentEntries = Array.isArray(wallet.recentEntries)
    ? wallet.recentEntries.slice(0, 8)
    : [];

  return (
    <div className="creator-page-stack">
      <section className="creator-panel card">
        <div className="creator-panel-head">
          <div>
            <h2>Payout readiness</h2>
            <p>Your payout details and the balances Tengacion uses for creator settlements.</p>
          </div>
        </div>

        <div className="creator-stack-list">
          <div className="creator-stack-row">
            <span>Account number</span>
            <strong>{payoutReadiness.accountNumberMasked || "Not set"}</strong>
          </div>
          <div className="creator-stack-row">
            <span>Country</span>
            <strong>{creatorProfile.country || "Not set"}</strong>
          </div>
          <div className="creator-stack-row">
            <span>Country of residence</span>
            <strong>{creatorProfile.countryOfResidence || "Not set"}</strong>
          </div>
          <div className="creator-stack-row">
            <span>Settlement source</span>
            <strong>{wallet.walletBacked ? "Live wallet ledger" : "Purchase-backed fallback"}</strong>
          </div>
          <div className="creator-stack-row">
            <span>Payout status</span>
            <strong>{payoutStatusLabel}</strong>
          </div>
          {payoutReadiness.nextStep ? (
            <div className="creator-stack-row">
              <span>Next step</span>
              <strong>{payoutReadiness.nextStep}</strong>
            </div>
          ) : null}
        </div>

        <div className="creator-stack-list">
          {Array.isArray(payoutReadiness.checks) && payoutReadiness.checks.length ? (
            payoutReadiness.checks.map((entry) => (
              <div key={entry.key} className="creator-stack-row">
                <span>{entry.label}</span>
                <strong>{entry.complete ? "Complete" : "Missing"}</strong>
              </div>
            ))
          ) : null}
        </div>

        <Link className="creator-secondary-btn" to="/creator/settings">
          Update payout details
        </Link>
      </section>

      <section className="creator-metric-grid">
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
        <article className="creator-metric-card card">
          <span>Withdrawn</span>
          <strong>{formatCurrency(summary.withdrawn || 0)}</strong>
        </article>
      </section>

      <section className="creator-panel card">
        <div className="creator-panel-head">
          <div>
            <h2>Recent settlement activity</h2>
            <p>Confirmed sales and wallet movements tied to your creator balance.</p>
          </div>
        </div>

        <div className="creator-activity-list">
          {recentEntries.length ? (
            recentEntries.map((entry) => (
              <article key={entry.id} className="creator-activity-item">
                <div>
                  <strong>{entry.label}</strong>
                  <p>
                    {entry.itemLabel || "Creator item"} • {formatCurrency(entry.amount || 0)}
                    {entry.providerRef ? ` • Ref ${entry.providerRef}` : ""}
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
              No settled wallet activity yet. When a paid sale completes, the credit
              will appear here automatically.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
