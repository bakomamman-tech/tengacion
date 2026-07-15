import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminShell from "../components/AdminShell";
import "./admin-creator-earnings.css";
import {
  adminCreateCreatorPayoutBatch,
  adminExportCreatorPayoutBatch,
  adminGetCreatorEarningsRepository,
  adminGetFinanceAssuranceClose,
  adminGetRevenueLedger,
  adminListCreatorPayoutBatches,
  adminListCreatorPayoutRequests,
  adminListWithdrawals,
  adminReconcileCreatorPayoutBatch,
  adminRetryWithdrawal,
  adminUpdateCreatorPayoutRequestStatus,
} from "../api";

const RANGE_OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "year", label: "This year" },
];

const number = (value) => Number(value || 0).toLocaleString();
const currency = (value, currencyCode = "NGN") =>
  `${currencyCode === "MIXED" ? "Mixed" : currencyCode} ${Number(value || 0).toLocaleString()}`;
const percent = (value) => `${Math.round(Number(value || 0) * 100)}%`;
const payoutStatusOptions = [
  { value: "", label: "All requests" },
  { value: "pending_review", label: "Pending" },
  { value: "needs_creator_action", label: "Needs action" },
  { value: "approved", label: "Approved" },
  { value: "processing", label: "Processing" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
  { value: "rejected", label: "Rejected" },
];
const eventLabel = (value = "") =>
  String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");

const readinessBadge = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "ready") {return "adminx-badge adminx-badge--good";}
  if (normalized === "watch") {return "adminx-badge adminx-badge--warn";}
  if (["needs_review", "blocked"].includes(normalized)) {return "adminx-badge adminx-badge--danger";}
  return "adminx-badge";
};

const dateTime = (value) => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

const downloadTextFile = ({ filename, text, type = "text/csv;charset=utf-8" }) => {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    return;
  }
  const blob = new Blob([text || ""], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "payout-batch.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export default function AdminCreatorEarningsPage({ user }) {
  const navigate = useNavigate();
  const [range, setRange] = useState("30d");
  const [payoutStatus, setPayoutStatus] = useState("");
  const [payload, setPayload] = useState(null);
  const [assuranceClose, setAssuranceClose] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [payoutRequests, setPayoutRequests] = useState(null);
  const [payoutBatches, setPayoutBatches] = useState(null);
  const [withdrawals, setWithdrawals] = useState(null);
  const [selectedPayoutRequestIds, setSelectedPayoutRequestIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payoutActionBusy, setPayoutActionBusy] = useState("");
  const [batchActionBusy, setBatchActionBusy] = useState("");
  const [withdrawalActionBusy, setWithdrawalActionBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [next, closePayload, ledgerPayload, payoutPayload, batchPayload, withdrawalPayload] = await Promise.all([
        adminGetCreatorEarningsRepository({ range }),
        adminGetFinanceAssuranceClose({ range }),
        adminGetRevenueLedger({ range, limit: 12 }),
        adminListCreatorPayoutRequests({ status: payoutStatus, limit: 8 }),
        adminListCreatorPayoutBatches({ limit: 8 }),
        adminListWithdrawals({ limit: 8 }),
      ]);
      setPayload(next || null);
      setAssuranceClose(closePayload || null);
      setLedger(ledgerPayload || null);
      setPayoutRequests(payoutPayload || null);
      setPayoutBatches(batchPayload || null);
      setWithdrawals(withdrawalPayload || null);
    } catch (err) {
      setError(err?.message || "Failed to load creator earnings repository");
    } finally {
      setLoading(false);
    }
  }, [payoutStatus, range]);

  useEffect(() => {
    load();
  }, [load]);

  const repository = payload?.repository || {};
  const songAlbumPlatformSharePercent =
    repository.songAlbumPlatformSharePercent ?? 25;
  const songAlbumCreatorSharePercent =
    repository.songAlbumCreatorSharePercent ?? 75;
  const settlementAccount = repository.settlementAccount || {};
  const breakdownItems = payload?.breakdown?.items || [];
  const topCreators = payload?.topCreators || [];
  const recentEntries = payload?.recentEntries || [];
  const close = assuranceClose?.close || {};
  const closeSummary = assuranceClose?.summary || {};
  const closeExceptions = assuranceClose?.exceptions || [];
  const closeEvidenceGaps = assuranceClose?.evidenceGaps || [];
  const ledgerSummary = ledger?.summary || {};
  const ledgerBalances = ledger?.balances || [];
  const ledgerRecentEntries = ledger?.recentEntries || [];
  const payoutRequestRows = payoutRequests?.requests || [];
  const payoutRequestSummary = payoutRequests?.summary || {};
  const payoutBatchRows = payoutBatches?.batches || [];
  const payoutBatchSummary = payoutBatches?.summary || {};
  const withdrawalRows = withdrawals?.withdrawals || [];
  const withdrawalSummary = withdrawals?.summary || {};
  const selectedApprovedRequests = payoutRequestRows.filter((entry) =>
    selectedPayoutRequestIds.includes(entry.id)
      && entry.status === "approved"
      && !entry.payoutBatchId
  );

  const togglePayoutRequestSelection = (entry) => {
    if (entry.status !== "approved" || entry.payoutBatchId) {
      return;
    }
    setSelectedPayoutRequestIds((current) =>
      current.includes(entry.id)
        ? current.filter((id) => id !== entry.id)
        : [...current, entry.id]
    );
  };

  const createPayoutBatch = async () => {
    if (!selectedApprovedRequests.length) {
      setError("Select at least one approved, unbatched payout request.");
      return;
    }
    const note = window.prompt("Batch note:", "Finance payout batch");
    if (note === null) {
      return;
    }

    setBatchActionBusy("create");
    setError("");
    try {
      await adminCreateCreatorPayoutBatch({
        requestIds: selectedApprovedRequests.map((entry) => entry.id),
        note,
      });
      setSelectedPayoutRequestIds([]);
      await load();
    } catch (err) {
      setError(err?.message || "Failed to create payout batch");
    } finally {
      setBatchActionBusy("");
    }
  };

  const exportPayoutBatch = async (batch) => {
    const note = window.prompt("Export note:", `Export ${batch.batchReference}`);
    if (note === null) {
      return;
    }

    setBatchActionBusy(`${batch.id}:export`);
    setError("");
    try {
      const result = await adminExportCreatorPayoutBatch(batch.id, { note });
      if (result?.providerExport?.csv) {
        downloadTextFile({
          filename: result.providerExport.filename || `${batch.batchReference}.csv`,
          text: result.providerExport.csv,
        });
      }
      await load();
    } catch (err) {
      setError(err?.message || "Failed to export payout batch");
    } finally {
      setBatchActionBusy("");
    }
  };

  const reconcilePayoutBatch = async (batch, status) => {
    const targetItems = (batch.items || []).filter((item) =>
      status === "paid"
        ? item.outcomeStatus !== "paid"
        : item.outcomeStatus === "pending"
    );
    if (!targetItems.length) {
      setError("No batch items are available for that reconciliation action.");
      return;
    }

    const note = window.prompt(
      `Reconciliation note for ${eventLabel(status)}:`,
      status === "paid" ? "Provider confirmed transfer" : "Provider reported failed transfer"
    );
    if (note === null) {
      return;
    }

    let payoutReferencePrefix = "";
    if (status === "paid") {
      payoutReferencePrefix = window.prompt(
        "Payout reference prefix:",
        batch.batchReference || ""
      );
      if (payoutReferencePrefix === null) {
        return;
      }
    }

    const creatorMessage = status === "failed"
      ? window.prompt("Creator-visible failure message:", "Your payout attempt failed and finance will review it.")
      : "";
    if (creatorMessage === null) {
      return;
    }

    setBatchActionBusy(`${batch.id}:${status}`);
    setError("");
    try {
      await adminReconcileCreatorPayoutBatch(batch.id, {
        note,
        outcomes: targetItems.map((item, index) => ({
          requestId: item.requestId,
          status,
          payoutReference: status === "paid"
            ? `${payoutReferencePrefix || batch.batchReference}-${index + 1}`
            : "",
          adminNote: note,
          creatorMessage: creatorMessage || "",
        })),
      });
      await load();
    } catch (err) {
      setError(err?.message || "Failed to reconcile payout batch");
    } finally {
      setBatchActionBusy("");
    }
  };

  const reviewPayoutRequest = async (entry, nextStatus) => {
    const adminNote = window.prompt(
      `Admin note for ${eventLabel(nextStatus)}:`,
      entry.adminNote || ""
    );
    if (adminNote === null) {
      return;
    }

    let creatorMessage = "";
    if (["needs_creator_action", "rejected", "failed", "paid"].includes(nextStatus)) {
      creatorMessage = window.prompt(
        "Creator-visible message:",
        entry.creatorVisibleMessage || ""
      );
      if (creatorMessage === null) {
        return;
      }
    }

    let payoutReference = entry.payoutReference || "";
    if (nextStatus === "paid") {
      payoutReference = window.prompt(
        "Payout reference:",
        entry.payoutReference || entry.requestReference || ""
      );
      if (payoutReference === null) {
        return;
      }
    }

    setPayoutActionBusy(`${entry.id}:${nextStatus}`);
    setError("");
    try {
      await adminUpdateCreatorPayoutRequestStatus(entry.id, {
        status: nextStatus,
        adminNote,
        creatorMessage,
        payoutReference,
      });
      await load();
    } catch (err) {
      setError(err?.message || "Failed to update payout request");
    } finally {
      setPayoutActionBusy("");
    }
  };

  const retryWithdrawal = async (entry) => {
    const note = window.prompt(
      "Retry note:",
      "Paystack business transfer activation reviewed; retry queued withdrawal."
    );
    if (note === null) {
      return;
    }

    setWithdrawalActionBusy(`${entry.id}:retry`);
    setError("");
    try {
      await adminRetryWithdrawal(entry.id, { note });
      await load();
    } catch (err) {
      setError(err?.message || "Failed to retry withdrawal");
    } finally {
      setWithdrawalActionBusy("");
    }
  };

  const headlineCards = useMemo(
    () => [
      { label: "Tengacion allocations", value: currency(repository.repositoryAmount), icon: "₦", tone: "emerald", note: "Recorded transaction allocations" },
      { label: "Gross creator sales", value: currency(repository.grossRevenue), icon: "↗", tone: "blue", note: `${number(repository.paidTransactions)} paid / ${currency(repository.reversalGrossRevenue)} reversed` },
      { label: "Recorded net revenue", value: currency(repository.netRevenue), icon: "−", tone: "blue", note: `${currency(Number(repository.processingFees || 0) + Number(repository.taxes || 0))} processing fees and taxes` },
      { label: "Creator allocations", value: currency(repository.creatorAmount), icon: "◎", tone: "amber", note: "Recorded creator liability" },
      { label: "Ledger entries", value: number(ledgerSummary.totalEntries || repository.paidTransactions), icon: "≡", tone: "violet", note: "Auditable finance events" },
    ],
    [
      ledgerSummary.totalEntries,
      repository.creatorAmount,
      repository.grossRevenue,
      repository.netRevenue,
      repository.paidTransactions,
      repository.processingFees,
      repository.repositoryAmount,
      repository.reversalGrossRevenue,
      repository.taxes,
    ]
  );

  return (
    <AdminShell
      title="Creator Earnings"
      subtitle="Monitor creator revenue, payout health, liabilities, and settlement activity from one finance workspace."
      user={user}
      actions={<button type="button" className="adminx-btn earnings-refresh" onClick={load} disabled={loading}><span>↻</span>{loading ? "Refreshing…" : "Refresh data"}</button>}
    >
      <div className="earnings-page">
        <section className="earnings-command-bar" aria-label="Earnings filters">
          <div className="earnings-range-group">
            <span className="earnings-range-label">Reporting period</span>
            <div className="earnings-range-tabs">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`earnings-range-tab ${range === option.value ? "is-active" : ""}`}
                  onClick={() => setRange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="adminx-btn earnings-transactions-btn" onClick={() => navigate("/admin/transactions")}>
            View all transactions <span aria-hidden="true">→</span>
          </button>
        </section>

      {error ? <div className="adminx-error">{error}</div> : null}
      {loading ? <div className="adminx-loading">Loading creator earnings repository...</div> : null}

      {!loading && payload ? (
        <>
          <div className="adminx-stats-grid earnings-stats-grid">
            {headlineCards.map((card) => (
              <article key={card.label} className={`adminx-stat-card earnings-stat-card earnings-stat-card--${card.tone}`}>
                <div className="earnings-stat-top">
                  <div className="adminx-kpi-label">{card.label}</div>
                  <span className="earnings-stat-icon" aria-hidden="true">{card.icon}</span>
                </div>
                <div className="adminx-kpi-value">{card.value}</div>
                <div className="earnings-stat-note">{card.note}</div>
              </article>
            ))}
          </div>

          {assuranceClose ? (
            <section className="adminx-panel adminx-panel--span-12">
              <div className="adminx-panel-head">
                <div>
                  <h2 className="adminx-panel-title">Finance Assurance Close</h2>
                  <span className="adminx-section-meta">{dateTime(assuranceClose.filters?.startDate)} to {dateTime(assuranceClose.filters?.endDate)}</span>
                </div>
                <span className={readinessBadge(close.readinessState)}>
                  {eventLabel(close.readinessState || "not_ready")}
                </span>
              </div>

              <div className="adminx-ops-grid">
                {[
                  ["Successful payments", number(closeSummary.successfulPayments)],
                  ["Net settled", currency(closeSummary.netSettledAmount, closeSummary.currency || "NGN")],
                  ["Missing access", number(closeSummary.entitlementMissing)],
                  ["Wallet gaps", number(Number(closeSummary.walletMissingEntries || 0) + Number(closeSummary.refundWalletMissingEntries || 0))],
                  ["Payout paid", currency(closeSummary.payoutPaidAmount, closeSummary.currency || "NGN")],
                  ["Balance confidence", percent(closeSummary.creatorBalanceConfidenceRate)],
                ].map(([label, value]) => (
                  <div key={label} className="adminx-ops-metric">
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>

              <div className="adminx-table-wrap adminx-table-wrap--flush">
                <table className="adminx-table">
                  <thead>
                    <tr>
                      <th>Exception</th>
                      <th>Severity</th>
                      <th>Expected</th>
                      <th>Actual</th>
                      <th>Owner</th>
                      <th>Remediation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closeExceptions.map((entry) => (
                      <tr key={entry.key}>
                        <td>{entry.label}</td>
                        <td><span className={readinessBadge(entry.severity === "critical" ? "blocked" : entry.severity === "high" ? "needs_review" : "watch")}>{eventLabel(entry.severity)}</span></td>
                        <td>{entry.unit === "money" ? currency(entry.expected, closeSummary.currency || "NGN") : number(entry.expected)}</td>
                        <td>{entry.unit === "money" ? currency(entry.actual, closeSummary.currency || "NGN") : number(entry.actual)}</td>
                        <td>{entry.owner}</td>
                        <td>{entry.remediation}</td>
                      </tr>
                    ))}
                    {!closeExceptions.length ? (
                      <tr>
                        <td colSpan={6} className="adminx-table-empty">
                          No finance assurance exceptions in this close window.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              {closeEvidenceGaps.length ? (
                <div className="adminx-pill-row">
                  {closeEvidenceGaps.map((gap) => (
                    <span key={gap.key} className="adminx-badge adminx-badge--warn">
                      {eventLabel(gap.key)}: {eventLabel(gap.status)}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="adminx-panel adminx-panel--span-12">
            <div className="adminx-panel-head">
              <div>
                <h2 className="adminx-panel-title">Creator Payout Review</h2>
                <span className="adminx-section-meta">Requests validated against creator readiness and available wallet balance</span>
              </div>
              <div className="adminx-filter-row">
                <button
                  type="button"
                  className="adminx-btn adminx-btn--primary"
                  disabled={!selectedApprovedRequests.length || Boolean(batchActionBusy)}
                  onClick={createPayoutBatch}
                >
                  Create batch ({selectedApprovedRequests.length})
                </button>
                {payoutStatusOptions.map((option) => (
                  <button
                    key={option.value || "all"}
                    type="button"
                    className={`adminx-tab ${payoutStatus === option.value ? "is-active" : ""}`}
                    onClick={() => setPayoutStatus(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="adminx-ops-grid">
              {[
                ["Requested", currency(payoutRequestSummary.requestedAmount)],
                ["Open", currency(payoutRequestSummary.openAmount)],
                ["Paid", currency(payoutRequestSummary.paidAmount)],
                ["Pending", number(payoutRequestSummary.statusCounts?.pending_review)],
              ].map(([label, value]) => (
                <div key={label} className="adminx-ops-metric">
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>

            <div className="adminx-table-wrap adminx-table-wrap--flush">
              <table className="adminx-table">
                <thead>
                  <tr>
                    <th>Batch</th>
                    <th>Requested</th>
                    <th>Creator</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Batch Ref</th>
                    <th>Reference</th>
                    <th>Message</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {payoutRequestRows.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        {entry.status === "approved" && !entry.payoutBatchId ? (
                          <input
                            type="checkbox"
                            checked={selectedPayoutRequestIds.includes(entry.id)}
                            onChange={() => togglePayoutRequestSelection(entry)}
                            aria-label={`Select payout request ${entry.requestReference || entry.id}`}
                          />
                        ) : (
                          <span className="adminx-muted">-</span>
                        )}
                      </td>
                      <td>{dateTime(entry.requestedAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="adminx-link-btn adminx-link-btn--inline"
                          onClick={() => navigate(`/admin/creators/${entry.creatorProfileId}`)}
                        >
                          {entry.creatorDisplayName}
                        </button>
                      </td>
                      <td>{currency(entry.amount)}</td>
                      <td>{eventLabel(entry.status)}</td>
                      <td>{entry.payoutBatchReference || "-"}</td>
                      <td>{entry.payoutReference || entry.requestReference || "-"}</td>
                      <td>{entry.creatorVisibleMessage || entry.adminNote || "-"}</td>
                      <td>
                        <div className="adminx-action-row">
                          {["pending_review", "needs_creator_action"].includes(entry.status) ? (
                            <>
                              <button
                                type="button"
                                className="adminx-btn"
                                disabled={Boolean(payoutActionBusy)}
                                onClick={() => reviewPayoutRequest(entry, "approved")}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="adminx-btn"
                                disabled={Boolean(payoutActionBusy)}
                                onClick={() => reviewPayoutRequest(entry, "needs_creator_action")}
                              >
                                Need action
                              </button>
                            </>
                          ) : null}
                          {["approved", "failed"].includes(entry.status) ? (
                            <button
                              type="button"
                              className="adminx-btn"
                              disabled={Boolean(payoutActionBusy)}
                              onClick={() => reviewPayoutRequest(entry, "processing")}
                            >
                              Process
                            </button>
                          ) : null}
                          {entry.status === "processing" ? (
                            <>
                              <button
                                type="button"
                                className="adminx-btn adminx-btn--primary"
                                disabled={Boolean(payoutActionBusy)}
                                onClick={() => reviewPayoutRequest(entry, "paid")}
                              >
                                Paid
                              </button>
                              <button
                                type="button"
                                className="adminx-btn adminx-btn--danger"
                                disabled={Boolean(payoutActionBusy)}
                                onClick={() => reviewPayoutRequest(entry, "failed")}
                              >
                                Failed
                              </button>
                            </>
                          ) : null}
                          {["pending_review", "needs_creator_action", "approved"].includes(entry.status) ? (
                            <button
                              type="button"
                              className="adminx-btn adminx-btn--danger"
                              disabled={Boolean(payoutActionBusy)}
                              onClick={() => reviewPayoutRequest(entry, "rejected")}
                            >
                              Reject
                            </button>
                          ) : null}
                          {["paid", "rejected"].includes(entry.status) ? <span className="adminx-muted">Final</span> : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!payoutRequestRows.length ? (
                    <tr>
                      <td colSpan={9} className="adminx-table-empty">
                        No creator payout requests found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="adminx-panel adminx-panel--span-12">
            <div className="adminx-panel-head">
              <div>
                <h2 className="adminx-panel-title">Automatic Withdrawal Queue</h2>
                <span className="adminx-section-meta">Paystack transfer attempts, setup blockers, and retry controls</span>
              </div>
              <span className="adminx-badge">
                {number(withdrawals?.total)} withdrawal{Number(withdrawals?.total || 0) === 1 ? "" : "s"}
              </span>
            </div>

            <div className="adminx-ops-grid">
              {[
                ["Open", currency(withdrawalSummary.openAmount)],
                ["Provider setup", currency(withdrawalSummary.providerSetupRequiredAmount)],
                ["Queued", number(withdrawalSummary.statusCounts?.provider_setup_required)],
                ["Succeeded", currency(withdrawalSummary.statusAmounts?.succeeded)],
              ].map(([label, value]) => (
                <div key={label} className="adminx-ops-metric">
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>

            <div className="adminx-table-wrap adminx-table-wrap--flush">
              <table className="adminx-table">
                <thead>
                  <tr>
                    <th>Requested</th>
                    <th>Owner</th>
                    <th>User</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Reference</th>
                    <th>Provider</th>
                    <th>Message</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawalRows.map((entry) => (
                    <tr key={entry.id}>
                      <td>{dateTime(entry.requestedAt)}</td>
                      <td>{eventLabel(entry.ownerType)}</td>
                      <td>{entry.user?.email || entry.user?.username || entry.userId || "-"}</td>
                      <td>{currency(entry.amount, entry.currency)}</td>
                      <td>{eventLabel(entry.status)}</td>
                      <td>{entry.reference || "-"}</td>
                      <td>{entry.providerTransferCode || entry.providerStatus || entry.provider || "-"}</td>
                      <td>{entry.failureReason || entry.providerIssue?.message || "-"}</td>
                      <td>
                        <div className="adminx-action-row">
                          {entry.status === "provider_setup_required" ? (
                            <button
                              type="button"
                              className="adminx-btn adminx-btn--primary"
                              disabled={Boolean(withdrawalActionBusy)}
                              onClick={() => retryWithdrawal(entry)}
                            >
                              Retry Paystack
                            </button>
                          ) : (
                            <span className="adminx-muted">-</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!withdrawalRows.length ? (
                    <tr>
                      <td colSpan={9} className="adminx-table-empty">
                        No automatic withdrawal records found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="adminx-panel adminx-panel--span-12">
            <div className="adminx-panel-head">
              <div>
                <h2 className="adminx-panel-title">Payout Batches</h2>
                <span className="adminx-section-meta">Export-ready groups, provider outcomes, and payout SLA evidence</span>
              </div>
              <span className="adminx-badge">
                {number(payoutBatches?.total)} batch{Number(payoutBatches?.total || 0) === 1 ? "" : "es"}
              </span>
            </div>

            <div className="adminx-ops-grid">
              {[
                ["Ready", number(payoutBatchSummary.statusCounts?.ready_for_export)],
                ["Exported", number(payoutBatchSummary.statusCounts?.exported)],
                ["Partial", number(payoutBatchSummary.statusCounts?.partially_paid)],
                ["Paid", currency(payoutBatchSummary.statusAmounts?.paid)],
              ].map(([label, value]) => (
                <div key={label} className="adminx-ops-metric">
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>

            <div className="adminx-table-wrap adminx-table-wrap--flush">
              <table className="adminx-table">
                <thead>
                  <tr>
                    <th>Created</th>
                    <th>Batch</th>
                    <th>Items</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Outcomes</th>
                    <th>SLA</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payoutBatchRows.map((batch) => {
                    const summary = batch.reconciliationSummary || {};
                    const sla = batch.slaSummary || {};
                    const paidCount = Number(summary.paidCount || 0);
                    const pendingCount = Number(summary.pendingCount || 0);
                    const canReconcileOpenBatch = ["exported", "partially_paid"].includes(batch.status);
                    return (
                      <tr key={batch.id}>
                        <td>{dateTime(batch.createdAt)}</td>
                        <td>
                          <div>{batch.batchReference}</div>
                          <span className="adminx-muted">{eventLabel(batch.provider)}</span>
                        </td>
                        <td>{number(batch.itemCount)}</td>
                        <td>{currency(batch.totalAmount, batch.currency)}</td>
                        <td>{eventLabel(batch.status)}</td>
                        <td>
                          Paid {number(summary.paidCount)} / Failed {number(summary.failedCount)} / Pending {number(summary.pendingCount)}
                        </td>
                        <td>
                          Review {sla.avgRequestedToReviewedHours ?? "-"}h / Paid {sla.avgReviewedToPaidHours ?? "-"}h
                        </td>
                        <td>
                          <div className="adminx-action-row">
                            {batch.status === "ready_for_export" ? (
                              <button
                                type="button"
                                className="adminx-btn"
                                disabled={Boolean(batchActionBusy)}
                                onClick={() => exportPayoutBatch(batch)}
                              >
                                Export
                              </button>
                            ) : null}
                            {canReconcileOpenBatch && paidCount < Number(batch.itemCount || 0) ? (
                              <button
                                type="button"
                                className="adminx-btn adminx-btn--primary"
                                disabled={Boolean(batchActionBusy)}
                                onClick={() => reconcilePayoutBatch(batch, "paid")}
                              >
                                Mark paid
                              </button>
                            ) : null}
                            {canReconcileOpenBatch && pendingCount > 0 ? (
                                <button
                                  type="button"
                                  className="adminx-btn adminx-btn--danger"
                                  disabled={Boolean(batchActionBusy)}
                                  onClick={() => reconcilePayoutBatch(batch, "failed")}
                                >
                                  Mark failed
                                </button>
                            ) : null}
                            {["paid", "failed"].includes(batch.status) ? <span className="adminx-muted">Final</span> : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!payoutBatchRows.length ? (
                    <tr>
                      <td colSpan={8} className="adminx-table-empty">
                        No payout batches created yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

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
                  Song/album policy: {number(songAlbumPlatformSharePercent)}% Tengacion of Net Revenue
                </span>
                <span className="adminx-badge">
                  Song/album policy: {number(songAlbumCreatorSharePercent)}% artist of Net Revenue
                </span>
                <span className="adminx-badge">
                  {dateTime(payload.filters?.startDate)} to {dateTime(payload.filters?.endDate)}
                </span>
              </div>
              <p className="adminx-repository-copy">{repository.purpose}</p>
              <p className="adminx-muted">{repository.netRevenueNote}</p>
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
                <span className="adminx-section-meta">Recorded paid-sale allocations by content type</span>
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
                      <span>Net: {currency(entry.netRevenue)}</span>
                      <span>Creator allocation: {currency(entry.creatorAmount)}</span>
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
                <span className="adminx-section-meta">Ranked by recorded Tengacion allocation</span>
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
                      <span>Net: {currency(entry.netRevenue)}</span>
                      <span>Creator allocation: {currency(entry.creatorAmount)}</span>
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
                <span className="adminx-section-meta">Latest sales, refunds, and chargebacks</span>
              </div>
              <div className="adminx-table-wrap adminx-table-wrap--flush">
                <table className="adminx-table">
                  <thead>
                    <tr>
                      <th>Effective At</th>
                      <th>Creator</th>
                      <th>Item</th>
                      <th>Source</th>
                      <th>Gross</th>
                      <th>Net</th>
                      <th>Tengacion allocation</th>
                      <th>Creator allocation</th>
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
                        <td>{currency(entry.netRevenueAmount)}</td>
                        <td>{currency(entry.repositoryAmount)}</td>
                        <td>{currency(entry.creatorAmount)}</td>
                      </tr>
                    ))}
                    {!recentEntries.length ? (
                      <tr>
                        <td colSpan={8} className="adminx-table-empty">
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
      </div>
    </AdminShell>
  );
}
