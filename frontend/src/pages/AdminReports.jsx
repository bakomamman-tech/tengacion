import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AdminShell from "../components/AdminShell";
import {
  adminApplyModerationAction,
  adminGetModerationCase,
  adminGetModerationReviewUrl,
  adminGetModerationStats,
  adminListModerationCases,
  adminRunModerationScan,
} from "../api";

const QUEUE_TABS = [
  { value: "", label: "All" },
  { value: "suspected_child_exploitation", label: "CSAM / Child Exploitation" },
  { value: "explicit_pornography", label: "Explicit Porn" },
  { value: "graphic_gore", label: "Graphic Gore" },
  { value: "animal_cruelty", label: "Animal Cruelty" },
  { value: "user_reported_sensitive_content", label: "Reported Content" },
];

const STATUS_OPTIONS = [
  "",
  "HOLD_FOR_REVIEW",
  "RESTRICTED_BLURRED",
  "BLOCK_EXPLICIT_ADULT",
  "BLOCK_SUSPECTED_CHILD_EXPLOITATION",
  "BLOCK_EXTREME_GORE",
  "BLOCK_ANIMAL_CRUELTY",
  "BLOCK_REPEAT_VIOLATOR",
  "ALLOW",
];

const ACTIONS = [
  { action: "approve", label: "Approve" },
  { action: "reject", label: "Reject" },
  { action: "restrict_with_warning", label: "Restrict With Blur" },
  { action: "preserve_evidence", label: "Preserve Evidence" },
  { action: "escalate_case", label: "Escalate" },
  { action: "suspend_user", label: "Suspend User" },
  { action: "ban_user", label: "Ban User" },
];

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

const SummaryCard = ({ label, value, tone = "" }) => (
  <article className={`adminx-panel adminx-panel--span-3 ${tone ? `adminx-panel--${tone}` : ""}`}>
    <div className="adminx-muted">{label}</div>
    <div style={{ fontSize: 28, fontWeight: 700 }}>{Number(value || 0).toLocaleString()}</div>
  </article>
);

export default function AdminReportsPage({ user }) {
  const navigate = useNavigate();
  const { caseId } = useParams();
  const [queue, setQueue] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [listPayload, setListPayload] = useState({ cases: [], total: 0, page: 1, limit: 20 });
  const [stats, setStats] = useState({ queues: {}, statuses: {}, workflowStates: {}, criticalCount: 0, repeatViolators: 0 });
  const [selectedCase, setSelectedCase] = useState(null);
  const [selectedCaseId, setSelectedCaseId] = useState(caseId || "");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [reviewLoading, setReviewLoading] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryPayload, queuePayload] = await Promise.all([
        adminGetModerationStats(),
        adminListModerationCases({
          queue,
          status,
          search,
          critical: criticalOnly,
        }),
      ]);
      setStats(summaryPayload || { queues: {}, statuses: {}, workflowStates: {}, criticalCount: 0, repeatViolators: 0 });
      setListPayload(queuePayload || { cases: [], total: 0, page: 1, limit: 20 });

      const cases = Array.isArray(queuePayload?.cases) ? queuePayload.cases : [];
      const preferredCaseId = caseId || selectedCaseId || cases[0]?._id || "";
      if (preferredCaseId) {
        setSelectedCaseId(preferredCaseId);
      } else {
        setSelectedCase(null);
      }
    } catch (error) {
      setMessage(error?.message || "Failed to load moderation queue");
      setListPayload({ cases: [], total: 0, page: 1, limit: 20 });
    } finally {
      setLoading(false);
    }
  }, [queue, status, search, criticalOnly, caseId, selectedCaseId]);

  const loadCaseDetail = useCallback(async (nextCaseId) => {
    if (!nextCaseId) {
      setSelectedCase(null);
      return;
    }

    setDetailLoading(true);
    try {
      const payload = await adminGetModerationCase(nextCaseId);
      setSelectedCase(payload || null);
      setSelectedCaseId(nextCaseId);
    } catch (error) {
      setMessage(error?.message || "Failed to load moderation case");
      setSelectedCase(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (selectedCaseId) {
      loadCaseDetail(selectedCaseId);
    }
  }, [selectedCaseId, loadCaseDetail]);

  const queueCounts = stats?.queues || {};
  const statusCounts = stats?.statuses || {};

  const selectedCaseActions = useMemo(
    () => new Set(Array.isArray(selectedCase?.availableActions) ? selectedCase.availableActions : []),
    [selectedCase]
  );

  const onSelectCase = (entry) => {
    setSelectedCaseId(entry?._id || "");
    navigate(entry?._id ? `/admin/moderation/cases/${entry._id}` : "/admin/moderation");
  };

  const handleAction = async (action) => {
    if (!selectedCase?._id) return;
    try {
      setActionLoading(action);
      const payload = await adminApplyModerationAction(selectedCase._id, action, {
        reason,
      });
      setMessage(`Action "${action}" applied.`);
      setReason("");
      const nextCaseId = payload?.case?._id || selectedCase._id;
      await Promise.all([loadQueue(), loadCaseDetail(nextCaseId)]);
    } catch (error) {
      setMessage(error?.message || "Moderation action failed");
    } finally {
      setActionLoading("");
    }
  };

  const handleReviewAsset = async (mediaIndex = 0) => {
    if (!selectedCase?._id) return;
    let reviewTab = null;
    try {
      setReviewLoading(String(mediaIndex));
      reviewTab = window.open("", "_blank", "noopener,noreferrer");
      const payload = await adminGetModerationReviewUrl(selectedCase._id, { mediaIndex });
      if (payload?.url) {
        if (reviewTab) {
          reviewTab.location.href = payload.url;
        } else {
          window.location.assign(payload.url);
        }
      }
    } catch (error) {
      if (reviewTab) {
        reviewTab.close();
      }
      setMessage(error?.message || "Failed to open review asset");
    } finally {
      setReviewLoading("");
    }
  };

  const handleScan = async ({ searchOnly = false } = {}) => {
    try {
      setScanLoading(true);
      const payload = await adminRunModerationScan({
        search: searchOnly ? search : "",
        limit: 20,
        includeManualReview: true,
      });
      const scanned = Number(payload?.scannedCount || 0);
      const flagged = Number(payload?.flaggedCount || 0);
      const firstCaseId = payload?.cases?.[0]?._id || "";
      setMessage(
        flagged > 0
          ? `Scan completed. ${flagged} item(s) queued for moderation from ${scanned} scanned.`
          : `Scan completed. No flagged items found across ${scanned} scanned item(s).`
      );
      await loadQueue();
      if (firstCaseId) {
        setSelectedCaseId(firstCaseId);
        navigate(`/admin/moderation/cases/${firstCaseId}`);
      }
    } catch (error) {
      setMessage(error?.message || "Moderation scan failed");
    } finally {
      setScanLoading(false);
    }
  };

  return (
    <AdminShell
      title="Moderation"
      subtitle="Trust and safety queue for sexual content blocking, CSAM escalation, violent media restriction, and animal cruelty review."
      user={user}
      actions={(
        <>
          <button type="button" className="adminx-btn" onClick={loadQueue} disabled={loading || scanLoading}>
            Refresh
          </button>
          <button type="button" className="adminx-btn" onClick={() => handleScan()} disabled={scanLoading}>
            {scanLoading ? "Scanning..." : "Scan Recent Media"}
          </button>
          <button
            type="button"
            className="adminx-btn adminx-btn--primary"
            onClick={() => handleScan({ searchOnly: true })}
            disabled={scanLoading || !search.trim()}
          >
            {scanLoading ? "Scanning..." : "Scan Search Matches"}
          </button>
        </>
      )}
    >
      <section className="adminx-panel adminx-panel--span-12">
        <div className="adminx-filter-row" style={{ gap: 12, flexWrap: "wrap" }}>
          {QUEUE_TABS.map((tab) => (
            <button
              key={tab.value || "all"}
              type="button"
              className={`adminx-btn ${queue === tab.value ? "adminx-btn--primary" : ""}`}
              onClick={() => setQueue(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="adminx-filter-row" style={{ marginTop: 12, gap: 12 }}>
          <select className="adminx-select" value={status} onChange={(event) => setStatus(event.target.value)}>
            {STATUS_OPTIONS.map((entry) => (
              <option key={entry || "all"} value={entry}>
                {entry || "All statuses"}
              </option>
            ))}
          </select>
          <input
            className="adminx-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search uploader, title, risk label"
          />
          <label className="adminx-muted" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={criticalOnly}
              onChange={(event) => setCriticalOnly(event.target.checked)}
            />
            Critical only
          </label>
        </div>
      </section>

      <SummaryCard label="Pending Review" value={statusCounts.HOLD_FOR_REVIEW} />
      <SummaryCard label="Blocked Explicit" value={statusCounts.BLOCK_EXPLICIT_ADULT} tone="danger" />
      <SummaryCard label="Suspected CSAM" value={statusCounts.BLOCK_SUSPECTED_CHILD_EXPLOITATION} tone="danger" />
      <SummaryCard label="Restricted Gore" value={statusCounts.RESTRICTED_BLURRED} />
      <SummaryCard label="Animal Cruelty" value={queueCounts.animal_cruelty} />
      <SummaryCard label="Repeat Violators" value={stats.repeatViolators} tone="danger" />
      <SummaryCard label="Critical Cases" value={stats.criticalCount} tone="danger" />

      {message ? <section className="adminx-panel adminx-panel--span-12">{message}</section> : null}

      <section className="adminx-panel adminx-panel--span-5">
        <h2 className="adminx-panel-title">Queue</h2>
        {loading ? <div className="adminx-loading">Loading moderation queue...</div> : null}
        {!loading ? (
          <div style={{ display: "grid", gap: 12 }}>
            {(listPayload.cases || []).map((entry) => (
              <button
                key={entry._id}
                type="button"
                className={`adminx-panel ${selectedCaseId === entry._id ? "is-active" : ""}`}
                style={{ textAlign: "left" }}
                onClick={() => onSelectCase(entry)}
              >
                <div className="adminx-row">
                  <strong>{entry.subject?.title || entry.queue}</strong>
                  <span className={`adminx-badge ${entry.severity === "CRITICAL" ? "adminx-badge--danger" : ""}`}>
                    {entry.severity}
                  </span>
                </div>
                <div className="adminx-muted">
                  {entry.queue} | {entry.status}
                </div>
                <div className="adminx-muted">
                  uploader: {entry.uploader?.email || `@${entry.uploader?.username || "unknown"}`}
                </div>
                <div className="adminx-muted">
                  {formatDateTime(entry.createdAt)}
                </div>
              </button>
            ))}
            {!(listPayload.cases || []).length ? <div className="adminx-empty">No moderation cases found.</div> : null}
          </div>
        ) : null}
      </section>

      <section className="adminx-panel adminx-panel--span-7">
        <h2 className="adminx-panel-title">Case Detail</h2>
        {detailLoading ? <div className="adminx-loading">Loading case detail...</div> : null}
        {!detailLoading && !selectedCase ? <div className="adminx-empty">Select a moderation case to review.</div> : null}
        {!detailLoading && selectedCase ? (
          <div style={{ display: "grid", gap: 14 }}>
            <div className="adminx-row">
              <div>
                <div style={{ fontWeight: 700 }}>{selectedCase.subject?.title || "Untitled case"}</div>
                <div className="adminx-muted">
                  {selectedCase.queue} | {selectedCase.status} | {selectedCase.workflowState}
                </div>
              </div>
              <span className={`adminx-badge ${selectedCase.severity === "CRITICAL" ? "adminx-badge--danger" : ""}`}>
                {selectedCase.severity}
              </span>
            </div>

            <div className="adminx-muted">
              uploader: {selectedCase.uploader?.displayName || selectedCase.uploader?.username || "Unknown"} | {selectedCase.uploader?.email || "No email"}
            </div>
            <div className="adminx-muted">
              source: {selectedCase.subject?.targetType} / {selectedCase.subject?.mediaType} | created {formatDateTime(selectedCase.subject?.createdAt)}
            </div>
            <div className="adminx-muted">
              warning: {selectedCase.publicWarningLabel || "None"}
            </div>

            <div>
              <strong>Risk Labels</strong>
              <div className="adminx-action-row" style={{ marginTop: 8, flexWrap: "wrap" }}>
                {(selectedCase.riskLabels || []).map((label) => (
                  <span key={label} className="adminx-badge">{label}</span>
                ))}
                {!(selectedCase.riskLabels || []).length ? <span className="adminx-muted">No labels</span> : null}
              </div>
            </div>

            <div>
              <strong>Media</strong>
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                {(selectedCase.media || []).map((asset, index) => (
                  <div key={`${asset.role}-${index}`} className="adminx-row">
                    <div className="adminx-muted">
                      {asset.role} | {asset.mediaType} | {asset.originalFilename || "stored asset"}
                    </div>
                    <button type="button" className="adminx-btn" onClick={() => handleReviewAsset(index)}>
                      {reviewLoading === String(index) ? "Opening..." : "Review Asset"}
                    </button>
                  </div>
                ))}
                {!(selectedCase.media || []).length ? <div className="adminx-muted">No media attached.</div> : null}
              </div>
            </div>

            <div>
              <strong>Moderation Note</strong>
              <textarea
                className="adminx-textarea"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Document the reason for your action"
                rows={4}
              />
            </div>

            <div className="adminx-action-row" style={{ flexWrap: "wrap" }}>
              {ACTIONS.map((entry) => (
                <button
                  key={entry.action}
                  type="button"
                  className={`adminx-btn ${entry.action === "ban_user" || entry.action === "reject" ? "adminx-btn--danger" : ""}`}
                  onClick={() => handleAction(entry.action)}
                  disabled={!selectedCaseActions.has(entry.action) || Boolean(actionLoading)}
                >
                  {actionLoading === entry.action ? "Working..." : entry.label}
                </button>
              ))}
            </div>

            <div>
              <strong>Enforcement History</strong>
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                {(selectedCase.history || []).map((entry, index) => (
                  <div key={`${entry.actionType}-${index}`} className="adminx-panel">
                    <div className="adminx-row">
                      <strong>{entry.actionType}</strong>
                      <span className="adminx-muted">{formatDateTime(entry.createdAt)}</span>
                    </div>
                    <div className="adminx-muted">
                      {`${entry.previousStatus} -> ${entry.newStatus}`}
                    </div>
                    <div className="adminx-muted">
                      {entry.adminEmail || "Unknown admin"} | {entry.reason || "No reason provided"}
                    </div>
                  </div>
                ))}
                {!(selectedCase.history || []).length ? <div className="adminx-muted">No audit history yet.</div> : null}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </AdminShell>
  );
}
