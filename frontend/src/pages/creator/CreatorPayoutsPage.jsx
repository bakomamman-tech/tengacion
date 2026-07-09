import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";

import { useCreatorWorkspace } from "../../components/creator/useCreatorWorkspace";
import {
  formatCurrency,
  formatShortDate,
} from "../../components/creator/creatorConfig";
import {
  createCreatorWithdrawal,
  getCreatorWithdrawals,
} from "../../api";
import { getWithdrawalProviderIssue } from "../../utils/withdrawalErrors";

const payoutStatusLabel = (value = "") =>
  String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");

export default function CreatorPayoutsPage() {
  const { creatorProfile, dashboard } = useCreatorWorkspace();
  const [payoutPayload, setPayoutPayload] = useState({ withdrawals: [], summary: {} });
  const [payoutsLoading, setPayoutsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState("");
  const [providerIssue, setProviderIssue] = useState(null);
  const wallet = dashboard.wallet || {};
  const summary = wallet.summary || dashboard.summary || {};
  const payoutReadiness = wallet.payoutReadiness || { ready: false, checks: [] };
  const readinessStatusLabel =
    payoutReadiness.label || (payoutReadiness.ready ? "Ready" : "Needs attention");
  const payoutAction = payoutReadiness.primaryAction || {};
  const payoutActionPath = payoutAction.path || "/creator/settings";
  const payoutActionLabel = payoutAction.label || "Update payout details";
  const blockingReasons = Array.isArray(payoutReadiness.blockingReasons)
    ? payoutReadiness.blockingReasons
    : [];
  const canRequestPayout = typeof payoutReadiness.canRequestPayout === "boolean"
    ? payoutReadiness.canRequestPayout
    : Boolean(payoutReadiness.ready);
  const recentEntries = Array.isArray(wallet.recentEntries)
    ? wallet.recentEntries.slice(0, 8)
    : [];
  const withdrawals = Array.isArray(payoutPayload.withdrawals)
    ? payoutPayload.withdrawals.slice(0, 8)
    : [];
  const payoutSummary = payoutPayload.summary || {};
  const withdrawableAmount = Number.isFinite(Number(payoutSummary.withdrawableAmount))
    ? Number(payoutSummary.withdrawableAmount)
    : Number(summary.availableBalance || 0);
  const openWithdrawalAmount = Number(payoutSummary.openWithdrawalAmount || 0);
  const reserveAmount = Number(payoutSummary.reserveAmount || 1000);
  const canSubmitPayoutRequest =
    canRequestPayout && withdrawableAmount > 0 && !submitting;
  const requestHelpText = useMemo(() => {
    if (!canRequestPayout) {
      return payoutReadiness.nextStep || "Complete payout readiness before withdrawing.";
    }
    if (withdrawableAmount <= 0) {
      return `A reserve of ${formatCurrency(reserveAmount)} must remain in your account.`;
    }
    return `${formatCurrency(openWithdrawalAmount)} is already reserved in open withdrawals.`;
  }, [canRequestPayout, openWithdrawalAmount, payoutReadiness.nextStep, reserveAmount, withdrawableAmount]);

  const loadPayoutRequests = useCallback(async () => {
    setPayoutsLoading(true);
    try {
      const next = await getCreatorWithdrawals({ limit: 8 });
      setPayoutPayload(next || { withdrawals: [], summary: {} });
    } catch (err) {
      toast.error(err?.message || "Could not load withdrawals.");
    } finally {
      setPayoutsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayoutRequests();
  }, [loadPayoutRequests]);

  const handleSubmitPayoutRequest = async (event) => {
    event.preventDefault();
    const requestedAmount = Number(amount);
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      toast.error("Enter a payout amount.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await createCreatorWithdrawal({
        amount: requestedAmount,
        currency: summary.currency || wallet.currency || "NGN",
      });
      setAmount("");
      setProviderIssue(null);
      const status = response?.withdrawal?.status;
      toast.success(status === "succeeded" ? "Withdrawal sent." : "Withdrawal started.");
      await loadPayoutRequests();
    } catch (err) {
      const issue = getWithdrawalProviderIssue(err);
      setProviderIssue(issue);
      toast.error(issue?.message || err?.message || "Could not start withdrawal.");
      await loadPayoutRequests();
    } finally {
      setSubmitting(false);
    }
  };

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
            <span>Bank</span>
            <strong>{payoutReadiness.bankName || creatorProfile.bankName || "Not set"}</strong>
          </div>
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
            <strong>{readinessStatusLabel}</strong>
          </div>
          <div className="creator-stack-row">
            <span>Withdrawals</span>
            <strong>{canRequestPayout ? "Available" : "Blocked"}</strong>
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
          {blockingReasons.map((entry) => (
            <div key={`blocker-${entry.key}`} className="creator-stack-row">
              <span>{entry.label}</span>
              <strong>{entry.nextStep || "Complete this item before payout review."}</strong>
            </div>
          ))}
        </div>

        <Link className="creator-secondary-btn" to={payoutActionPath}>
          {payoutActionLabel}
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
            <h2>Withdraw now</h2>
            <p>Withdraw eligible creator earnings directly to your verified Nigerian bank account.</p>
          </div>
          <button type="button" className="creator-secondary-btn" onClick={loadPayoutRequests}>
            Refresh
          </button>
        </div>

        {providerIssue ? (
          <div className="creator-inline-notice warning" role="alert">
            <div>
              <strong>{providerIssue.title}</strong>
              <span>{providerIssue.message}</span>
            </div>
            {providerIssue.action ? <span>{providerIssue.action}</span> : null}
          </div>
        ) : null}

        <div className="creator-stack-list">
          <div className="creator-stack-row">
            <span>Available to withdraw</span>
            <strong>{formatCurrency(withdrawableAmount)}</strong>
          </div>
          <div className="creator-stack-row">
            <span>Required reserve</span>
            <strong>{formatCurrency(reserveAmount)}</strong>
          </div>
          <div className="creator-stack-row">
            <span>Open withdrawals</span>
            <strong>{formatCurrency(openWithdrawalAmount)}</strong>
          </div>
        </div>

        <form className="creator-form-grid" onSubmit={handleSubmitPayoutRequest}>
          <label>
            <span>Amount</span>
            <input
              type="number"
              min="100"
              step="100"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="1000"
              disabled={!canSubmitPayoutRequest}
            />
          </label>
          <div className="creator-form-actions creator-form-full">
            <small className="creator-field-hint">{requestHelpText}</small>
            <button type="submit" className="creator-primary-btn" disabled={!canSubmitPayoutRequest}>
              {submitting ? "Withdrawing..." : "Withdraw now"}
            </button>
          </div>
        </form>
      </section>

      <section className="creator-panel card">
        <div className="creator-panel-head">
          <div>
            <h2>Withdrawals</h2>
            <p>Automatic payout attempts, provider state, and bank transfer references.</p>
          </div>
        </div>

        <div className="creator-activity-list">
          {payoutsLoading ? <div className="creator-empty-card">Loading withdrawals...</div> : null}
          {!payoutsLoading && withdrawals.length ? (
            withdrawals.map((entry) => (
              <article key={entry.id} className="creator-activity-item">
                <div>
                  <strong>{formatCurrency(entry.amount || 0)}</strong>
                  <p>
                    {entry.reference || "Withdrawal"}
                    {entry.providerTransferCode ? ` - Ref ${entry.providerTransferCode}` : ""}
                  </p>
                  {entry.failureReason ? <p>{entry.failureReason}</p> : null}
                </div>

                <div className="creator-activity-meta">
                  <span
                    className={`creator-status-badge ${
                      entry.status === "paid"
                      || entry.status === "succeeded"
                        ? "success"
                        : entry.status === "failed" || entry.status === "rejected" || entry.status === "reversed"
                          ? "warning"
                          : "neutral"
                    }`}
                  >
                    {payoutStatusLabel(entry.status)}
                  </span>
                  <span>{formatShortDate(entry.requestedAt)}</span>
                </div>
              </article>
            ))
          ) : null}
          {!payoutsLoading && !withdrawals.length ? (
            <div className="creator-empty-card">
              No withdrawals yet. Eligible withdrawals will appear here after submission.
            </div>
          ) : null}
        </div>
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
