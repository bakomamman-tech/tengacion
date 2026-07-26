import { useCallback, useEffect, useState } from "react";

import AdminShell from "../components/AdminShell";
import {
  adminGetMillionaireLaunchCampaign,
  adminGetMillionaireParticipants,
  adminSendMillionaireLaunchCampaign,
  adminUpdateMillionaireParticipantStatus,
  adminUpdateMillionairePayout,
} from "../api";

import "./admin-millionaire.css";

const emptyPayload = {
  stats: {},
  participants: [],
  total: 0,
  page: 1,
  pages: 1,
};

const emptyLaunchCampaign = {
  status: "not_started",
  audienceCount: 0,
  sentCount: 0,
  failedCount: 0,
  pendingCount: 0,
  emailConfigured: true,
  flyerUrl: "/assets/campaigns/tengacion-millionaire-2026.png?v=20260726-daily-prizes",
};

const formatNumber = (value) => Number(value || 0).toLocaleString();
const formatNaira = (value) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export default function AdminMillionaireGame({ user }) {
  const [filters, setFilters] = useState({
    search: "",
    participantStatus: "",
    attemptStatus: "",
    payoutStatus: "",
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [payload, setPayload] = useState(emptyPayload);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [launchCampaign, setLaunchCampaign] = useState(emptyLaunchCampaign);
  const [launchLoading, setLaunchLoading] = useState(true);
  const [launchSending, setLaunchSending] = useState(false);
  const [payoutTarget, setPayoutTarget] = useState(null);
  const [payoutForm, setPayoutForm] = useState({
    status: "approved",
    reference: "",
    note: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await adminGetMillionaireParticipants({
        ...appliedFilters,
        page,
        limit: 50,
      });
      setPayload(response || emptyPayload);
    } catch (requestError) {
      setError(requestError?.message || "Failed to load Millionaire participants.");
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page]);

  useEffect(() => {
    load();
  }, [load]);

  const loadLaunchCampaign = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) {
      setLaunchLoading(true);
    }
    try {
      const response = await adminGetMillionaireLaunchCampaign();
      setLaunchCampaign(response?.campaign || emptyLaunchCampaign);
    } catch (requestError) {
      if (!quiet) {
        setError(requestError?.message || "Failed to load the launch email campaign.");
      }
    } finally {
      if (!quiet) {
        setLaunchLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadLaunchCampaign();
  }, [loadLaunchCampaign]);

  useEffect(() => {
    if (!["queued", "sending"].includes(launchCampaign.status)) {
      return undefined;
    }
    const interval = window.setInterval(() => {
      loadLaunchCampaign({ quiet: true });
    }, 4000);
    return () => window.clearInterval(interval);
  }, [launchCampaign.status, loadLaunchCampaign]);

  const sendLaunchCampaign = async () => {
    const retrying = ["partial", "failed"].includes(launchCampaign.status);
    const message = retrying
      ? `Retry the ${formatNumber(launchCampaign.failedCount)} failed Millionaire launch emails? Successful recipients will not receive a duplicate.`
      : `Send the July 26 Tengacion Millionaire launch email and flyer to ${formatNumber(launchCampaign.audienceCount)} active users now?`;
    if (!window.confirm(message)) {
      return;
    }

    setLaunchSending(true);
    setError("");
    setNotice("");
    try {
      const response = await adminSendMillionaireLaunchCampaign();
      setLaunchCampaign(response?.campaign || launchCampaign);
      setNotice(
        response?.alreadyRunningOrSent
          ? "The Millionaire launch campaign is already running or completed."
          : "The Millionaire launch email campaign has started. Delivery counts will update here."
      );
    } catch (requestError) {
      setError(requestError?.message || "The Millionaire launch email could not be started.");
    } finally {
      setLaunchSending(false);
    }
  };

  const applyFilters = (event) => {
    event.preventDefault();
    setPage(1);
    setAppliedFilters(filters);
  };

  const openPayout = (participant) => {
    const attempt = participant.latestAttempt;
    setPayoutTarget(participant);
    setPayoutForm({
      status: attempt?.payoutStatus === "pending" ? "approved" : attempt?.payoutStatus || "approved",
      reference: attempt?.payoutReference || "",
      note: "",
    });
    setNotice("");
  };

  const savePayout = async (event) => {
    event.preventDefault();
    if (!payoutTarget?.latestAttempt?.id) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      await adminUpdateMillionairePayout(payoutTarget.latestAttempt.id, payoutForm);
      setNotice(
        `${payoutTarget.user?.name || "Participant"} payout marked ${payoutForm.status}.`
      );
      setPayoutTarget(null);
      await load();
    } catch (requestError) {
      setError(requestError?.message || "Payout status could not be updated.");
    } finally {
      setSaving(false);
    }
  };

  const toggleParticipantStatus = async (participant) => {
    const nextStatus = participant.status === "registered" ? "suspended" : "registered";
    setSaving(true);
    setError("");
    try {
      await adminUpdateMillionaireParticipantStatus(participant.id, nextStatus);
      setNotice(
        `${participant.user?.name || "Participant"} is now ${nextStatus}.`
      );
      await load();
    } catch (requestError) {
      setError(requestError?.message || "Participant status could not be updated.");
    } finally {
      setSaving(false);
    }
  };

  const stats = payload?.stats || {};

  return (
    <AdminShell
      title="Tengacion Millionaire"
      subtitle="Monitor basic-profile readiness, QA tests, daily random prize assignment, scores and verified payouts."
      user={user}
      actions={<button type="button" className="adminx-btn" onClick={load}>Refresh</button>}
    >
      {error ? <div className="adminx-error" role="alert">{error}</div> : null}
      {notice ? <div className="adminx-loading">{notice}</div> : null}

      <div className="adminx-stats-grid millionaire-admin-stats">
        <article className="adminx-stat-card"><div className="adminx-kpi-label">Registered players</div><div className="adminx-kpi-value">{formatNumber(stats.registrations)}</div></article>
        <article className="adminx-stat-card"><div className="adminx-kpi-label">Games started</div><div className="adminx-kpi-value">{formatNumber(stats.playCount)}</div></article>
        <article className="adminx-stat-card"><div className="adminx-kpi-label">Prize liability</div><div className="adminx-kpi-value">{formatNaira(stats.pendingAmount)}</div></article>
        <article className="adminx-stat-card"><div className="adminx-kpi-label">Paid to winners</div><div className="adminx-kpi-value">{formatNaira(stats.paidAmount)}</div></article>
        <article className="adminx-stat-card"><div className="adminx-kpi-label">QA test attempts</div><div className="adminx-kpi-value">{formatNumber(stats.qaTestAttempts)}</div></article>
        <article className="adminx-stat-card"><div className="adminx-kpi-label">Daily premium attempts</div><div className="adminx-kpi-value">{formatNumber(stats.dailyPremiumAttempts)}</div></article>
      </div>

      <section className="adminx-panel millionaire-prize-policy">
        <div className="adminx-panel-head">
          <div>
            <h2 className="adminx-panel-title">Daily prize policy</h2>
            <span className="adminx-section-meta">
              One eligible non-admin, non-QA account is selected randomly per WAT calendar day
            </span>
          </div>
          <span className="adminx-badge">20 seconds per question</span>
        </div>
        <div className="millionaire-prize-policy__grid">
          <article>
            <span>Standard ladder</span>
            <strong>₦100–₦400</strong>
            <small>All other eligible players stay below ₦500.</small>
          </article>
          <article>
            <span>Daily premium ladder</span>
            <strong>Up to ₦1,000</strong>
            <small>Limited to one randomly assigned eligible account each day.</small>
          </article>
          <article>
            <span>Today&apos;s selected account</span>
            <strong>
              {stats.dailyPrizeSlot?.selectedUser
                ? `@${stats.dailyPrizeSlot.selectedUser.username || stats.dailyPrizeSlot.selectedUser.name}`
                : "Not assigned yet"}
            </strong>
            <small>
              {stats.dailyPrizeSlot?.selectedUser
                ? `${stats.dailyPrizeSlot.selectedUser.email} · pool of ${formatNumber(stats.dailyPrizeSlot.selectionPoolSize)}`
                : "The slot is locked when today’s first eligible game starts."}
            </small>
          </article>
        </div>
      </section>

      <section className="adminx-panel millionaire-launch-campaign">
        <div className="adminx-panel-head">
          <div>
            <h2 className="adminx-panel-title">July 26 launch email</h2>
            <span className="adminx-section-meta">
              Official announcement, guiding rules, prizes and flyer for all active users
            </span>
          </div>
          <span className={`adminx-badge millionaire-campaign-status is-${launchCampaign.status}`}>
            {String(launchCampaign.status || "not_started").replace("_", " ")}
          </span>
        </div>

        <div className="millionaire-launch-campaign__grid">
          <img
            src={launchCampaign.flyerUrl || emptyLaunchCampaign.flyerUrl}
            alt="Tengacion Millionaire launch flyer"
          />
          <div className="millionaire-launch-campaign__copy">
            <p>
              <strong>Sunday, 26 July 2026 · 10:00 AM WAT</strong><br />
              Virtual game · Free participation
            </p>
            <ul>
              <li>15 difficult questions, 20 seconds each, with one Ask AI hint.</li>
              <li>One wrong answer or timeout ends the attempt and banks earned cash.</li>
              <li>Standard prizes are ₦100–₦400; one random daily tier reaches ₦1,000.</li>
              <li>Existing basic information and both photos are reused without re-entry.</li>
            </ul>
            <div className="millionaire-launch-campaign__counts" aria-label="Email delivery counts">
              <span><strong>{formatNumber(launchCampaign.audienceCount)}</strong> audience</span>
              <span><strong>{formatNumber(launchCampaign.sentCount)}</strong> sent</span>
              <span><strong>{formatNumber(launchCampaign.failedCount)}</strong> failed</span>
              <span><strong>{formatNumber(launchCampaign.pendingCount)}</strong> pending</span>
            </div>
            {!launchCampaign.emailConfigured ? (
              <div className="adminx-error" role="alert">
                Configure Tengacion SMTP before sending this campaign.
              </div>
            ) : null}
            {launchCampaign.lastError ? (
              <p className="millionaire-launch-campaign__error">{launchCampaign.lastError}</p>
            ) : null}
            <button
              type="button"
              className="adminx-btn adminx-btn--primary"
              onClick={sendLaunchCampaign}
              disabled={
                launchLoading ||
                launchSending ||
                !launchCampaign.emailConfigured ||
                ["queued", "sending", "completed"].includes(launchCampaign.status)
              }
            >
              {launchSending || ["queued", "sending"].includes(launchCampaign.status)
                ? "Sending launch emails…"
                : launchCampaign.status === "completed"
                  ? "Launch email sent"
                  : ["partial", "failed"].includes(launchCampaign.status)
                    ? "Retry failed emails"
                    : "Send launch email now"}
            </button>
            {launchCampaign.completedAt ? (
              <small>Last completed {formatDate(launchCampaign.completedAt)}</small>
            ) : null}
          </div>
        </div>
      </section>

      <section className="adminx-panel millionaire-admin-panel">
        <div className="adminx-panel-head">
          <div>
            <h2 className="adminx-panel-title">Participants & prizes</h2>
            <span className="adminx-section-meta">
              {formatNumber(payload.total)} matching registrations · {formatNumber(stats.inProgress)} currently playing
            </span>
          </div>
        </div>

        <form className="millionaire-admin-filters" onSubmit={applyFilters}>
          <input
            className="adminx-input"
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            placeholder="Search name, username, email or phone"
          />
          <select
            className="adminx-select"
            value={filters.participantStatus}
            onChange={(event) => setFilters((current) => ({ ...current, participantStatus: event.target.value }))}
          >
            <option value="">All registrations</option>
            <option value="registered">Registered</option>
            <option value="suspended">Suspended</option>
            <option value="withdrawn">Withdrawn</option>
          </select>
          <select
            className="adminx-select"
            value={filters.attemptStatus}
            onChange={(event) => setFilters((current) => ({ ...current, attemptStatus: event.target.value }))}
          >
            <option value="">All game states</option>
            <option value="in_progress">In progress</option>
            <option value="completed">All 15 correct</option>
            <option value="lost">Wrong answer</option>
            <option value="expired">Timed out</option>
          </select>
          <select
            className="adminx-select"
            value={filters.payoutStatus}
            onChange={(event) => setFilters((current) => ({ ...current, payoutStatus: event.target.value }))}
          >
            <option value="">All payouts</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
            <option value="rejected">Rejected</option>
            <option value="not_applicable">No prize</option>
          </select>
          <button type="submit" className="adminx-btn adminx-btn--primary">Apply</button>
        </form>

        {loading ? <div className="adminx-loading">Loading Millionaire registrations…</div> : null}
        {!loading ? (
          <div className="adminx-table-wrap adminx-table-wrap--flush">
            <table className="adminx-table millionaire-admin-table">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Profile</th>
                  <th>Registered</th>
                  <th>Latest game</th>
                  <th>Prize</th>
                  <th>Payout</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(payload.participants || []).map((participant) => {
                  const attempt = participant.latestAttempt;
                  return (
                    <tr key={participant.id}>
                      <td>
                        <div className="millionaire-admin-player">
                          <span>
                            {participant.user?.avatarUrl ? (
                              <img src={participant.user.avatarUrl} alt="" />
                            ) : (
                              String(participant.user?.name || "P").slice(0, 1).toUpperCase()
                            )}
                          </span>
                          <div>
                            <strong>{participant.user?.name || "Unknown player"}</strong>
                            <small>@{participant.user?.username || "unknown"}</small>
                            <small>{participant.user?.email || "—"}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`adminx-badge ${participant.profileComplete ? "is-success" : ""}`}>
                          {participant.profileComplete ? "Complete" : "Incomplete"}
                        </span>
                        <small className="millionaire-admin-subline">
                          Basic identity · {participant.user?.avatarUrl ? "profile photo" : "photo missing"} ·{" "}
                          {participant.user?.coverUrl ? "cover photo" : "cover missing"}
                        </small>
                      </td>
                      <td>
                        <span className="adminx-badge">{participant.status}</span>
                        <small className="millionaire-admin-subline">{formatDate(participant.registeredAt)}</small>
                      </td>
                      <td>
                        {attempt ? (
                          <>
                            <strong>{attempt.correctAnswers}/15 correct</strong>
                            <small className="millionaire-admin-subline">
                              {String(attempt.status || "").replace("_", " ")} · {formatDate(attempt.startedAt)}
                            </small>
                            <span className={`adminx-badge tier-${attempt.prizeTier || "standard"}`}>
                              {attempt.prizeTier === "daily_premium"
                                ? "daily premium"
                                : attempt.prizeTier === "qa"
                                  ? "QA · no payout"
                                  : "standard"}
                            </span>
                          </>
                        ) : (
                          "Not played"
                        )}
                      </td>
                      <td><strong>{formatNaira(attempt?.finalPrize)}</strong></td>
                      <td>
                        <span className={`adminx-badge payout-${attempt?.payoutStatus || "none"}`}>
                          {String(attempt?.payoutStatus || "not played").replace("_", " ")}
                        </span>
                      </td>
                      <td>
                        <div className="millionaire-admin-actions">
                          {attempt?.payoutEligible !== false && Number(attempt?.finalPrize || 0) > 0 ? (
                            <button type="button" disabled={saving} onClick={() => openPayout(participant)}>
                              Process prize
                            </button>
                          ) : null}
                          <button type="button" disabled={saving} onClick={() => toggleParticipantStatus(participant)}>
                            {participant.status === "registered" ? "Suspend" : "Restore"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!(payload.participants || []).length ? (
              <div className="adminx-empty">No Millionaire registrations match these filters.</div>
            ) : null}
          </div>
        ) : null}

        <div className="millionaire-admin-pagination">
          <button type="button" className="adminx-btn" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
          <span>Page {payload.page || page} of {payload.pages || 1}</span>
          <button type="button" className="adminx-btn" disabled={page >= Number(payload.pages || 1)} onClick={() => setPage((current) => current + 1)}>Next</button>
        </div>
      </section>

      {payoutTarget ? (
        <div className="millionaire-admin-modal-backdrop" role="presentation">
          <section className="millionaire-admin-modal" role="dialog" aria-modal="true" aria-labelledby="millionaire-payout-title">
            <p className="millionaire-admin-eyebrow">Prize control</p>
            <h2 id="millionaire-payout-title">
              {payoutTarget.user?.name} · {formatNaira(payoutTarget.latestAttempt?.finalPrize)}
            </h2>
            <p>Record finance verification before changing a winning attempt to paid.</p>
            <form onSubmit={savePayout}>
              <label>Status<select className="adminx-select" value={payoutForm.status} onChange={(event) => setPayoutForm((current) => ({ ...current, status: event.target.value }))}><option value="pending">Pending</option><option value="approved">Approved</option><option value="paid">Paid</option><option value="rejected">Rejected</option></select></label>
              <label>Payment reference<input className="adminx-input" value={payoutForm.reference} onChange={(event) => setPayoutForm((current) => ({ ...current, reference: event.target.value }))} placeholder="Transfer or ledger reference" /></label>
              <label>Admin note<textarea className="adminx-textarea" rows="4" value={payoutForm.note} onChange={(event) => setPayoutForm((current) => ({ ...current, note: event.target.value }))} placeholder="Verification or rejection note" /></label>
              <div className="millionaire-admin-modal-actions">
                <button type="button" className="adminx-btn" onClick={() => setPayoutTarget(null)}>Cancel</button>
                <button type="submit" className="adminx-btn adminx-btn--primary" disabled={saving}>{saving ? "Saving…" : "Save payout status"}</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </AdminShell>
  );
}
