import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";

import { useCreatorWorkspace } from "../../components/creator/useCreatorWorkspace";
import {
  formatCurrency,
  formatShortDate,
} from "../../components/creator/creatorConfig";
import {
  createCreatorPayoutRequest,
  getCreatorPayoutRequests,
} from "../../api";

const payoutStatusLabel = (value = "") =>
  String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");

export default function CreatorPayoutsPage() {
  const { creatorProfile, dashboard } = useCreatorWorkspace();
  const [payoutPayload, setPayoutPayload] = useState({ requests: [], summary: {} });
  const [payoutsLoading, setPayoutsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState("");
  const [creatorNote, setCreatorNote] = useState("");
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
  const payoutRequests = Array.isArray(payoutPayload.requests)
    ? payoutPayload.requests.slice(0, 8)
    : [];
  const payoutSummary = payoutPayload.summary || {};
  const availableForRequest = Number.isFinite(Number(payoutSummary.availableForRequest))
    ? Number(payoutSummary.availableForRequest)
    : Number(summary.availableBalance || 0);
  const openRequestAmount = Number(payoutSummary.openRequestAmount || 0);
  const minimumPayoutAmount = 1000;
  const canSubmitPayoutRequest =
    canRequestPayout && availableForRequest >= minimumPayoutAmount && !submitting;
  const requestHelpText = useMemo(() => {
    if (!canRequestPayout) {
      return payoutReadiness.nextStep || "Complete payout readiness before requesting review.";
    }
    if (availableForRequest < minimumPayoutAmount) {
      return `Minimum payout request is ${formatCurrency(minimumPayoutAmount)}.`;
    }
    return `${formatCurrency(openRequestAmount)} is already reserved in open payout requests.`;
  }, [availableForRequest, canRequestPayout, openRequestAmount, payoutReadiness.nextStep]);

  const loadPayoutRequests = useCallback(async () => {
    setPayoutsLoading(true);
    try {
      const next = await getCreatorPayoutRequests({ limit: 8 });
      setPayoutPayload(next || { requests: [], summary: {} });
    } catch (err) {
      toast.error(err?.message || "Could not load payout requests.");
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
      await createCreatorPayoutRequest({
        amount: requestedAmount,
        currency: summary.currency || wallet.currency || "NGN",
        creatorNote,
      });
      setAmount("");
      setCreatorNote("");
      toast.success("Payout request submitted for review.");
      await loadPayoutRequests();
    } catch (err) {
      toast.error(err?.message || "Could not submit payout request.");
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
            <span>Payout request</span>
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
            <h2>Request payout review</h2>
            <p>Submit an eligible available balance for admin review and settlement tracking.</p>
          </div>
          <button type="button" className="creator-secondary-btn" onClick={loadPayoutRequests}>
            Refresh
          </button>
        </div>

        <div className="creator-stack-list">
          <div className="creator-stack-row">
            <span>Available for request</span>
            <strong>{formatCurrency(availableForRequest)}</strong>
          </div>
          <div className="creator-stack-row">
            <span>Open requests</span>
            <strong>{formatCurrency(openRequestAmount)}</strong>
          </div>
        </div>

        <form className="creator-form-grid" onSubmit={handleSubmitPayoutRequest}>
          <label>
            <span>Amount</span>
            <input
              type="number"
              min={minimumPayoutAmount}
              step="100"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="1000"
              disabled={!canSubmitPayoutRequest}
            />
          </label>
          <label className="creator-form-full">
            <span>Note for finance review</span>
            <textarea
              value={creatorNote}
              onChange={(event) => setCreatorNote(event.target.value)}
              placeholder="Optional payout context"
              disabled={!canSubmitPayoutRequest}
            />
          </label>
          <div className="creator-form-actions creator-form-full">
            <small className="creator-field-hint">{requestHelpText}</small>
            <button type="submit" className="creator-primary-btn" disabled={!canSubmitPayoutRequest}>
              {submitting ? "Submitting..." : "Submit request"}
            </button>
          </div>
        </form>
      </section>

      <section className="creator-panel card">
        <div className="creator-panel-head">
          <div>
            <h2>Payout requests</h2>
            <p>Admin review state, support messages, and payout references for each request.</p>
          </div>
        </div>

        <div className="creator-activity-list">
          {payoutsLoading ? <div className="creator-empty-card">Loading payout requests...</div> : null}
          {!payoutsLoading && payoutRequests.length ? (
            payoutRequests.map((entry) => (
              <article key={entry.id} className="creator-activity-item">
                <div>
                  <strong>{formatCurrency(entry.amount || 0)}</strong>
                  <p>
                    {entry.requestReference || "Payout request"}
                    {entry.payoutReference ? ` - Ref ${entry.payoutReference}` : ""}
                  </p>
                  {entry.creatorVisibleMessage ? <p>{entry.creatorVisibleMessage}</p> : null}
                </div>

                <div className="creator-activity-meta">
                  <span
                    className={`creator-status-badge ${
                      entry.status === "paid"
                        ? "success"
                        : entry.status === "failed" || entry.status === "rejected"
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
          {!payoutsLoading && !payoutRequests.length ? (
            <div className="creator-empty-card">
              No payout requests yet. Eligible requests will appear here after submission.
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
