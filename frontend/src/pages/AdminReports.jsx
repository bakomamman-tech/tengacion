import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";
import AdminShell from "../components/AdminShell";
import {
  applyModerationCaseAction,
  banUser,
  fetchModerationCase,
  fetchModerationCases,
  fetchModerationReviewUrl,
  fetchModerationStats,
  fetchModerationUploader,
  forceLogoutUser,
  scanRecentMedia,
  scanSearchMatches,
  suspendUser,
  unbanUser,
  unsuspendUser,
} from "../services/adminModerationService";

const CATEGORIES = [
  ["", "All"],
  ["upload_moderation", "Inspection Failures"],
  ["suspected_child_exploitation", "CSAM / Child Exploitation"],
  ["explicit_pornography", "Explicit Porn"],
  ["graphic_gore", "Graphic Gore"],
  ["animal_cruelty", "Animal Cruelty"],
  ["user_reported_sensitive_content", "Reported Content"],
];
const ADMIN_SCAN_BATCH_LIMIT = 20;

const STAT_CARDS = [
  ["pendingReview", "Pending Review", "Cases waiting for a decision"],
  ["blockedExplicit", "Blocked Explicit Inventory", "Explicit content kept blocked, including completed decisions"],
  ["suspectedCsam", "CSAM Block Inventory", "Child-exploitation content kept blocked or escalated"],
  ["restrictedGore", "Restricted Gore Inventory", "Graphic media currently kept blurred or restricted"],
  ["animalCruelty", "Animal Cruelty Inventory", "Animal-cruelty content currently kept blocked"],
  ["repeatViolators", "Repeat Violators", "Users above the strike threshold"],
];

const STATUS_OPTIONS = [
  ["", "All statuses"],
  ["pending", "Pending"],
  ["quarantined", "Quarantined"],
  ["HOLD_FOR_REVIEW", "Hold for Review"],
  ["RESTRICTED_BLURRED", "Restricted Blur"],
  ["BLOCK_EXPLICIT_ADULT", "Blocked Explicit"],
  ["BLOCK_SUSPECTED_CHILD_EXPLOITATION", "Suspected CSAM"],
  ["BLOCK_EXTREME_GORE", "Blocked Gore"],
  ["BLOCK_ANIMAL_CRUELTY", "Blocked Animal Cruelty"],
  ["BLOCK_REPEAT_VIOLATOR", "Repeat Violator"],
  ["ALLOW", "Allowed"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
];
const WORKFLOW_OPTIONS = [
  ["ACTIVE", "Active work"],
  ["", "All workflow states"],
  ["RESOLVED", "Resolved history"],
  ["OPEN", "Open"],
  ["UNDER_REVIEW", "Under review"],
  ["ESCALATED", "Escalated"],
];

const ACTION_LABELS = {
  approve: "Approve",
  restore_content: "Restore Content",
  hold_for_review: "Hold for Review",
  reject: "Reject",
  delete_media: "Remove Content",
  restrict_with_warning: "Restrict With Blur",
  blur_preview: "Blur Preview",
  preserve_evidence: "Preserve Evidence",
  escalate_case: "Escalate",
  suspend_user: "Suspend User",
  ban_user: "Ban User",
};

const QUICK_ACTIONS = ["approve", "reject", "delete_media", "escalate_case", "suspend_user", "ban_user"];
const DETAIL_ACTIONS = [
  "approve",
  "restore_content",
  "hold_for_review",
  "reject",
  "delete_media",
  "restrict_with_warning",
  "blur_preview",
  "preserve_evidence",
  "escalate_case",
  "suspend_user",
  "ban_user",
];

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};
const formatNumber = (value) => Number(value || 0).toLocaleString();
const formatScore = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? `${Math.round(num)}` : "-";
};
const normalizeText = (value) => String(value || "").trim();
const titleCase = (value = "") =>
  String(value || "")
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
const getLabel = (value = "") => {
  const entry = CATEGORIES.find(([key]) => key === value);
  return entry?.[1] || titleCase(value || "unknown");
};
const getStatusLabel = (status = "") => {
  const value = String(status || "").trim();
  if (!value) {
    return "unknown";
  }
  if (value === "ALLOW") {
    return "allowed";
  }
  return value.replace(/_/g, " ").replace(/\b[a-z]/g, (m) => m.toUpperCase());
};
const getMediaKind = (item = {}) => {
  const mediaType = normalizeText(item?.subject?.mediaType || item?.media?.[0]?.mediaType || "").toLowerCase();
  const mimeType = normalizeText(item?.media?.[0]?.mimeType || "").toLowerCase();
  if (mediaType === "video" || mimeType.startsWith("video/")) {
    return "video";
  }
  if (mediaType === "image" || mimeType.startsWith("image/")) {
    return "image";
  }
  return mediaType || "file";
};
const getUploaderLabel = (uploader = {}) => normalizeText(uploader.displayName || uploader.name || uploader.username || uploader.email || "unknown");
const getActionLabel = (action = "") => ACTION_LABELS[action] || titleCase(action);
const getActionReason = (item = {}, note = "") =>
  normalizeText(note) || normalizeText(item?.reviewerNote || item?.latestDecisionSummary?.reason || item?.reason || "") || "Moderation review";
const canUseAction = (item = {}, action = "") => Array.isArray(item?.availableActions) && item.availableActions.includes(action);
const getQueueSummary = (payload = {}) => ({
  page: Number(payload?.page || 1),
  limit: Number(payload?.limit || 20),
  total: Number(payload?.total || 0),
  cases: Array.isArray(payload?.cases) ? payload.cases : [],
});
const getScanConcernCount = (payload = {}) =>
  Number(payload?.blockedCount || 0)
  + Number(payload?.reviewCount || 0)
  + Number(payload?.restrictedCount || 0)
  + Number(payload?.inspectionFailureCount || 0)
  + Number(payload?.skippedAssetCount || 0)
  + Number(payload?.processingFailureCount || 0)
  + Number(payload?.sourceQueryFailureCount || 0)
  + (payload?.scanDeadlineReached ? 1 : 0);
const getScanCompletedLabel = (payload = {}) =>
  formatDateTime(payload?.completedAt || payload?.startedAt || "");
const buildScanToastMessage = (payload = {}, scopeLabel = "recent items") => {
  const scanned = formatNumber(payload?.processedCount ?? payload?.scannedCount);
  const approved = formatNumber(payload?.approvedCount);
  const blocked = formatNumber(payload?.blockedCount);
  const review = formatNumber(payload?.reviewCount);
  const restricted = formatNumber(payload?.restrictedCount);
  const failures = formatNumber(payload?.inspectionFailureCount);
  const preserved = formatNumber(payload?.preservedResolutionCount);
  const processingFailures = formatNumber(payload?.processingFailureCount);
  const sourceFailures = formatNumber(payload?.sourceQueryFailureCount);
  return `Checked ${scanned} ${scopeLabel}: ${approved} cleared, ${blocked} newly blocked, ${review} held for review, ${restricted} restricted, ${preserved} prior resolutions preserved, ${failures} inspection failures, ${processingFailures} processing errors, ${sourceFailures} source errors.`;
};

function Badge({ status, workflowState }) {
  const isResolved = String(workflowState || "").toUpperCase() === "RESOLVED";
  const toneClass = isResolved ? "adminx-case-badge--resolved" : "adminx-case-badge--pending";

  return (
    <span className={`adminx-badge adminx-case-badge ${toneClass}`}>
      {getStatusLabel(status)}
    </span>
  );
}

function StatSkeleton() {
  return <article className="adminx-stat-card" aria-hidden="true"><div style={{ width: "58%", height: 16, borderRadius: 999, background: "rgba(255,255,255,0.06)" }} /><div style={{ marginTop: 10, width: "40%", height: 30, borderRadius: 999, background: "rgba(255,255,255,0.06)" }} /><div style={{ marginTop: 12, width: "78%", height: 14, borderRadius: 999, background: "rgba(255,255,255,0.05)" }} /></article>;
}

function QueueSkeleton() {
  return <article className="adminx-panel" aria-hidden="true" style={{ display: "grid", gap: 12 }}><div className="adminx-row"><div style={{ width: 72, height: 72, borderRadius: 18, background: "rgba(255,255,255,0.06)" }} /><div style={{ flex: 1, display: "grid", gap: 8 }}><div style={{ width: "72%", height: 16, borderRadius: 999, background: "rgba(255,255,255,0.06)" }} /><div style={{ width: "48%", height: 12, borderRadius: 999, background: "rgba(255,255,255,0.05)" }} /><div style={{ width: "88%", height: 12, borderRadius: 999, background: "rgba(255,255,255,0.05)" }} /></div></div><div style={{ height: 42, borderRadius: 14, background: "rgba(255,255,255,0.05)" }} /><div className="adminx-row" style={{ gap: 8, flexWrap: "wrap" }}><div style={{ width: 72, height: 34, borderRadius: 999, background: "rgba(255,255,255,0.05)" }} /><div style={{ width: 88, height: 34, borderRadius: 999, background: "rgba(255,255,255,0.05)" }} /><div style={{ width: 92, height: 34, borderRadius: 999, background: "rgba(255,255,255,0.05)" }} /></div></article>;
}

function PreviewCard({ item, onView, loading }) {
  const previewUrl = normalizeText(item?.media?.[0]?.restrictedPreviewUrl || "");
  const kind = getMediaKind(item);
  return (
    <div className="adminx-panel" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ minHeight: 240, display: "grid", placeItems: "center", background: "radial-gradient(circle at top right, rgba(63,218,122,0.14), transparent 30%), linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))" }}>
        {previewUrl && kind === "image" ? (
          <img src={previewUrl} alt={normalizeText(item?.subject?.title || "Moderation preview")} style={{ width: "100%", height: 240, objectFit: "cover" }} />
        ) : (
          <div style={{ padding: 24, textAlign: "center" }}>
            <div style={{ fontWeight: 800 }}>{kind === "video" ? "Video preview protected" : "Protected preview"}</div>
            <div className="adminx-muted" style={{ marginTop: 8 }}>Use View to open the signed review URL.</div>
            <button type="button" className="adminx-btn adminx-btn--primary" style={{ marginTop: 14 }} onClick={onView} disabled={loading}>{loading ? "Opening..." : "View"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function CaseCard({ item, active, busyKey, onSelect, onView, onAction }) {
  const title = normalizeText(item?.subject?.title || item?.subject?.description || "Untitled moderation case");
  const uploader = item?.uploader || {};
  const quickActions = QUICK_ACTIONS.filter((action) => canUseAction(item, action));
  return (
    <article className="adminx-panel" style={{ display: "grid", gap: 12, border: active ? "1px solid rgba(63,218,122,0.44)" : undefined }}>
      <button type="button" onClick={() => onSelect(item)} className="adminx-row" style={{ width: "100%", padding: 0, border: 0, background: "transparent", textAlign: "left", alignItems: "flex-start" }}>
        <div style={{ width: 72, minWidth: 72, height: 72, borderRadius: 18, overflow: "hidden", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          {item?.media?.[0]?.restrictedPreviewUrl ? <img src={item.media[0].restrictedPreviewUrl} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ec4ad" }}>{getMediaKind(item)}</div>}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 8 }}>
          <div className="adminx-row" style={{ alignItems: "flex-start" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, lineHeight: 1.3 }}>{title}</div>
              <div className="adminx-muted" style={{ marginTop: 4 }}>{getLabel(item?.queue)} | {titleCase(item?.subject?.targetType || "upload")} | {getMediaKind(item)}</div>
            </div>
            <Badge status={item?.status} workflowState={item?.workflowState} />
          </div>
          <div className="adminx-row" style={{ flexWrap: "wrap", gap: 8, justifyContent: "flex-start" }}>
            <span className="adminx-badge">uploader: {getUploaderLabel(uploader)}</span>
            <span className="adminx-badge">score: {formatScore(item?.priorityScore)}</span>
            <span className="adminx-badge">created: {formatDateTime(item?.createdAt)}</span>
          </div>
          <div className="adminx-row" style={{ flexWrap: "wrap", gap: 8, justifyContent: "flex-start" }}>
            {(item?.riskLabels || []).slice(0, 3).map((label) => <span key={label} className="adminx-badge">{label}</span>)}
            {Array.isArray(item?.riskLabels) && item.riskLabels.length > 3 ? <span className="adminx-muted">+{item.riskLabels.length - 3} more</span> : null}
          </div>
        </div>
      </button>
      <div className="adminx-action-row" style={{ flexWrap: "wrap", gap: 8 }}>
        <button type="button" className="adminx-btn" onClick={() => onView(item)} disabled={Boolean(busyKey)}>{busyKey === `view:${item._id}` ? "Opening..." : "View"}</button>
        {quickActions.map((action) => <button key={action} type="button" className={`adminx-btn ${action === "approve" ? "adminx-btn--primary" : action === "reject" || action === "delete_media" || action === "ban_user" ? "adminx-btn--danger" : ""}`} onClick={() => onAction(item, action)} disabled={Boolean(busyKey)}>{busyKey === `${action}:${item._id}` ? "Working..." : getActionLabel(action)}</button>)}
      </div>
    </article>
  );
}

function ActionRow({ item, busyKey, actions, onAction }) {
  const visibleActions = actions.filter((action) => canUseAction(item, action));
  if (!item || visibleActions.length === 0) {
    return <div className="adminx-empty">No moderation actions available for this case.</div>;
  }
  return (
    <div className="adminx-action-row" style={{ flexWrap: "wrap", gap: 8 }}>
      {visibleActions.map((action) => (
        <button
          key={action}
          type="button"
          className={`adminx-btn ${action === "approve" ? "adminx-btn--primary" : action === "reject" || action === "delete_media" || action === "ban_user" ? "adminx-btn--danger" : ""}`}
          onClick={() => onAction(item, action)}
          disabled={Boolean(busyKey)}
        >
          {busyKey === `${action}:${item._id}` ? "Working..." : getActionLabel(action)}
        </button>
      ))}
    </div>
  );
}

export default function AdminReportsPage({ user }) {
  const { caseId: routeCaseId } = useParams();
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [workflowState, setWorkflowState] = useState("ACTIVE");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");
  const [queue, setQueue] = useState({ page: 1, limit: 12, total: 0, cases: [] });
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState(routeCaseId || "");
  const [selectedCase, setSelectedCase] = useState(null);
  const [selectedUploader, setSelectedUploader] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [note, setNote] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [lastScan, setLastScan] = useState(null);
  const statsRequestRef = useRef(0);
  const queueRequestRef = useRef(0);
  const detailRequestRef = useRef(0);

  const queueCases = useMemo(() => getQueueSummary(queue).cases, [queue]);
  const totalPages = useMemo(() => Math.max(1, Math.ceil((Number(queue?.total) || 0) / Number(limit || 1))), [limit, queue?.total]);
  const selectedQueueCase = useMemo(() => queueCases.find((entry) => String(entry?._id) === String(selectedCaseId)) || null, [queueCases, selectedCaseId]);
  const visibleCase = selectedCase || selectedQueueCase || null;
  const detailActions = useMemo(() => DETAIL_ACTIONS.filter((action) => canUseAction(visibleCase, action)), [visibleCase]);
  const selectedUploaderUser = selectedUploader?.user || null;
  const hasActiveFilters = Boolean(category || status || workflowState !== "ACTIVE" || normalizeText(search) || page !== 1 || Number(limit) !== 12);
  const selectionIsOutsideCurrentQueue = Boolean(selectedCaseId && visibleCase && !selectedQueueCase && !routeCaseId);

  const resetFilters = useCallback(() => {
    setCategory("");
    setStatus("");
    setWorkflowState("ACTIVE");
    setSearch("");
    setPage(1);
    setLimit(12);
    setDetailError("");
  }, []);

  const loadStats = useCallback(async () => {
    const requestId = statsRequestRef.current + 1;
    statsRequestRef.current = requestId;
    setStatsLoading(true);
    setStatsError("");
    try {
      const payload = await fetchModerationStats();
      if (statsRequestRef.current === requestId) {
        setStats(payload);
      }
    } catch (error) {
      if (statsRequestRef.current !== requestId) {
        return;
      }
      const message = error?.message || "Failed to load moderation stats";
      setStatsError(message);
      toast.error(message);
    } finally {
      if (statsRequestRef.current === requestId) {
        setStatsLoading(false);
      }
    }
  }, []);

  const loadQueue = useCallback(async () => {
    const requestId = queueRequestRef.current + 1;
    queueRequestRef.current = requestId;
    setQueueLoading(true);
    setQueueError("");
    try {
      const payload = await fetchModerationCases({ page, limit, queue: category, status, workflowState, search: deferredSearch });
      if (queueRequestRef.current === requestId) {
        setQueue(getQueueSummary(payload));
      }
    } catch (error) {
      if (queueRequestRef.current !== requestId) {
        return;
      }
      const message = error?.message || "Failed to load moderation queue";
      setQueueError(message);
      toast.error(message);
    } finally {
      if (queueRequestRef.current === requestId) {
        setQueueLoading(false);
      }
    }
  }, [category, deferredSearch, limit, page, status, workflowState]);

  const loadCase = useCallback(async (caseId) => {
    if (!caseId) {
      detailRequestRef.current += 1;
      setSelectedCase(null);
      setSelectedUploader(null);
      setDetailError("");
      setNote("");
      setDetailLoading(false);
      return;
    }
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    setDetailLoading(true);
    setDetailError("");
    try {
      const [casePayload, uploaderPayload] = await Promise.all([fetchModerationCase(caseId), fetchModerationUploader(caseId)]);
      if (detailRequestRef.current === requestId) {
        setSelectedCase(casePayload || null);
        setSelectedUploader(uploaderPayload || null);
        setNote(normalizeText(casePayload?.reviewerNote || casePayload?.latestDecisionSummary?.reason || casePayload?.reason || ""));
      }
    } catch (error) {
      if (detailRequestRef.current !== requestId) {
        return;
      }
      const message = error?.message || "Failed to load moderation case";
      setDetailError(message);
      toast.error(message);
    } finally {
      if (detailRequestRef.current === requestId) {
        setDetailLoading(false);
      }
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setBusyKey("refresh");
    try {
      await Promise.all([loadStats(), loadQueue(), selectedCaseId ? loadCase(selectedCaseId) : Promise.resolve()]);
      toast.success("Moderation dashboard refreshed");
    } finally {
      setBusyKey("");
    }
  }, [loadCase, loadQueue, loadStats, selectedCaseId]);

  const selectCase = useCallback((item) => {
    if (!item?._id) {
      return;
    }
    setSelectedCaseId(item._id);
    setSelectedCase(item);
    setSelectedUploader(null);
    setDetailError("");
    setNote(normalizeText(item?.reviewerNote || item?.latestDecisionSummary?.reason || item?.reason || ""));
  }, []);

  const handleView = useCallback(async (item) => {
    if (!item?._id) {
      return;
    }
    setBusyKey(`view:${item._id}`);
    try {
      selectCase(item);
      const response = await fetchModerationReviewUrl(item._id, { mediaRole: item?.media?.[0]?.role || "", mediaIndex: 0 });
      if (response?.url) {
        window.open(response.url, "_blank", "noopener,noreferrer");
      } else {
        toast.error("Review URL unavailable for this case");
      }
    } catch (error) {
      toast.error(error?.message || "Failed to open review media");
    } finally {
      setBusyKey("");
    }
  }, [selectCase]);

  const runCaseAction = useCallback(async (item, action) => {
    if (!item?._id) {
      return;
    }
    const reason = getActionReason(item, note);
    setBusyKey(`${action}:${item._id}`);
    try {
      await applyModerationCaseAction(item._id, action, { reason });
      toast.success(`${getActionLabel(action)} completed`);
      setNote("");
      await Promise.all([loadStats(), loadQueue(), loadCase(item._id)]);
    } catch (error) {
      toast.error(error?.message || `Failed to ${getActionLabel(action).toLowerCase()}`);
    } finally {
      setBusyKey("");
    }
  }, [loadCase, loadQueue, loadStats, note]);

  const runRecentScan = useCallback(async (cursor = []) => {
    setBusyKey("scan_recent");
    try {
      const response = await scanRecentMedia({
        limit: ADMIN_SCAN_BATCH_LIMIT,
        cursor: Array.isArray(cursor) ? cursor : [],
      });
      setLastScan(response || null);
      const accountsFlagged = Number(response?.accountsFlagged || 0);
      const accountNote = accountsFlagged > 0
        ? ` ${formatNumber(accountsFlagged)} accounts flagged.`
        : "";
      const message = `${buildScanToastMessage(response, "recent candidates")}${accountNote}`;
      if (getScanConcernCount(response) > 0) {
        toast.error(message);
      } else {
        toast.success(message);
      }
      const firstFlaggedCase = Array.isArray(response?.cases) ? response.cases[0] : null;
      if (firstFlaggedCase?._id) {
        selectCase(firstFlaggedCase);
      }
      await Promise.all([
        loadStats(),
        loadQueue(),
        firstFlaggedCase?._id
          ? loadCase(firstFlaggedCase._id)
          : selectedCaseId ? loadCase(selectedCaseId) : Promise.resolve(),
      ]);
    } catch (error) {
      toast.error(error?.message || "Failed to scan recent media");
    } finally {
      setBusyKey("");
    }
  }, [loadCase, loadQueue, loadStats, selectCase, selectedCaseId]);
  const handleScanRecent = useCallback(() => runRecentScan([]), [runRecentScan]);

  const runSearchScan = useCallback(async (searchTerm, cursor = []) => {
    setBusyKey("scan_search");
    try {
      const response = await scanSearchMatches({
        search: searchTerm,
        limit: ADMIN_SCAN_BATCH_LIMIT,
        cursor: Array.isArray(cursor) ? cursor : [],
      });
      setLastScan(response || null);
      const accountsFlagged = Number(response?.accountsFlagged || 0);
      const accountNote = accountsFlagged > 0
        ? ` ${formatNumber(accountsFlagged)} accounts flagged.`
        : "";
      const message = `${buildScanToastMessage(response, "matching candidates")}${accountNote}`;
      if (getScanConcernCount(response) > 0) {
        toast.error(message);
      } else {
        toast.success(message);
      }
      const firstFlaggedCase = Array.isArray(response?.cases) ? response.cases[0] : null;
      if (firstFlaggedCase?._id) {
        selectCase(firstFlaggedCase);
      }
      await Promise.all([
        loadStats(),
        loadQueue(),
        firstFlaggedCase?._id
          ? loadCase(firstFlaggedCase._id)
          : selectedCaseId ? loadCase(selectedCaseId) : Promise.resolve(),
      ]);
    } catch (error) {
      toast.error(error?.message || "Failed to scan search matches");
    } finally {
      setBusyKey("");
    }
  }, [loadCase, loadQueue, loadStats, selectCase, selectedCaseId]);

  const handleScanSearch = useCallback(() => {
    const searchTerm = normalizeText(search);
    if (!searchTerm) {
      toast.error("Enter a search term before scanning matches");
      return;
    }
    runSearchScan(searchTerm, []);
  }, [runSearchScan, search]);

  const handleScanNextBatch = useCallback(() => {
    if (!Array.isArray(lastScan?.nextCursor)) {
      return;
    }
    if (lastScan?.scanScope === "search_matches") {
      runSearchScan(normalizeText(lastScan?.scanQuery), lastScan.nextCursor);
      return;
    }
    runRecentScan(lastScan.nextCursor);
  }, [lastScan, runRecentScan, runSearchScan]);

  const handleUserAction = useCallback(async (action) => {
    const uploaderId = selectedUploaderUser?._id || visibleCase?.uploader?.userId || "";
    if (!uploaderId) {
      toast.error("Uploader profile is unavailable");
      return;
    }
    const reason = getActionReason(visibleCase, note);
    const runners = { ban: banUser, suspend: suspendUser, unban: unbanUser, unsuspend: unsuspendUser, "force-logout": forceLogoutUser };
    const runner = runners[action];
    if (!runner) {
      toast.error("Unsupported user action");
      return;
    }
    setBusyKey(`${action}:${uploaderId}`);
    try {
      await runner(uploaderId, reason);
      toast.success(`${getActionLabel(action)} completed`);
      await Promise.all([loadStats(), loadQueue(), loadCase(selectedCaseId || visibleCase?._id || uploaderId)]);
    } catch (error) {
      toast.error(error?.message || `Failed to ${getActionLabel(action).toLowerCase()}`);
    } finally {
      setBusyKey("");
    }
  }, [loadCase, loadQueue, loadStats, note, selectedCaseId, selectedUploaderUser, visibleCase]);

  useEffect(() => { setSelectedCaseId(routeCaseId || ""); }, [routeCaseId]);
  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadQueue(); }, [loadQueue]);
  useEffect(() => {
    if (!selectedCaseId && queueCases.length > 0) {
      const first = queueCases[0];
      setSelectedCaseId(first._id);
      setSelectedCase(first);
      setNote(normalizeText(first?.reviewerNote || first?.latestDecisionSummary?.reason || first?.reason || ""));
    }
  }, [queueCases, selectedCaseId]);
  useEffect(() => {
    if (selectedCaseId) {
      loadCase(selectedCaseId);
    } else {
      setSelectedCase(null);
      setSelectedUploader(null);
      setDetailError("");
    }
  }, [loadCase, selectedCaseId]);

  return (
    <AdminShell
      title="Moderation"
      subtitle="Review sexual content blocking, CSAM escalation, violent media restriction, animal cruelty review, and repeat-violator enforcement from the Tengacion console."
      user={user}
      actions={(
        <>
          <button type="button" className="adminx-btn" onClick={refreshAll} disabled={Boolean(busyKey) || statsLoading || queueLoading || detailLoading}>
            {busyKey === "refresh" ? "Refreshing..." : "Refresh"}
          </button>
          <button type="button" className="adminx-btn" onClick={handleScanRecent} disabled={Boolean(busyKey) || statsLoading || queueLoading || detailLoading}>
            {busyKey === "scan_recent" ? "Scanning..." : "Scan Recent Media"}
          </button>
          <button type="button" className="adminx-btn" onClick={handleScanSearch} disabled={Boolean(busyKey) || !normalizeText(search) || statsLoading || queueLoading || detailLoading}>
            {busyKey === "scan_search" ? "Scanning..." : "Scan Search Matches"}
          </button>
        </>
      )}
    >
      <section className="adminx-stats-grid">
        {statsLoading && !stats ? STAT_CARDS.map(([key]) => <StatSkeleton key={key} />) : STAT_CARDS.map(([key, label, helper]) => (
          <article key={key} className="adminx-stat-card">
            <div className="adminx-kpi-label">{label}</div>
            <div className="adminx-kpi-value">{formatNumber(stats?.[key])}</div>
            <div className="adminx-kpi-trend">{helper}</div>
          </article>
        ))}
      </section>

      <section className="adminx-panel adminx-panel--span-12" style={{ display: "grid", gap: 14 }}>
        <div className="adminx-panel-head" style={{ marginBottom: 0 }}>
          <div>
            <h2 className="adminx-panel-title">Queue Filters</h2>
            <span className="adminx-section-meta">Keep the existing moderation layout, but drive it from real queue data and search.</span>
          </div>
          <div className="adminx-row" style={{ gap: 10, flexWrap: "wrap" }}>
            <span className="adminx-badge">Total {formatNumber(queue?.total)}</span>
            <span className="adminx-badge">Page {page} / {totalPages}</span>
            {stats?.repeatViolatorThreshold ? <span className="adminx-badge">Repeat threshold {formatNumber(stats.repeatViolatorThreshold)}</span> : null}
            {selectionIsOutsideCurrentQueue ? <span className="adminx-badge adminx-badge--warn">Selected case is outside the current page</span> : null}
          </div>
        </div>

        <div className="adminx-filter-row" style={{ flexWrap: "wrap", gap: 10 }}>
          {CATEGORIES.map(([value, label]) => (
            <button
              key={value || "all"}
              type="button"
              className={`adminx-tab ${category === value ? "is-active" : ""}`}
              onClick={() => { setCategory(value); setPage(1); }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="adminx-filter-row" style={{ flexWrap: "wrap", gap: 10 }}>
          <input
            className="adminx-input"
            style={{ minWidth: 280, flex: "1 1 320px" }}
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="Search uploads, uploader, filename, or moderation reason"
          />
          <select className="adminx-select" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            {STATUS_OPTIONS.map(([value, label]) => <option key={value || "all-statuses"} value={value}>{label}</option>)}
          </select>
          <select className="adminx-select" value={workflowState} onChange={(event) => { setWorkflowState(event.target.value); setPage(1); }}>
            {WORKFLOW_OPTIONS.map(([value, label]) => <option key={value || "all-workflows"} value={value}>{label}</option>)}
          </select>
          <select className="adminx-select" value={limit} onChange={(event) => { setLimit(Number(event.target.value) || 12); setPage(1); }}>
            {[8, 12, 20, 40].map((value) => <option key={value} value={value}>{value} per page</option>)}
          </select>
          <button type="button" className="adminx-link-btn" onClick={resetFilters} disabled={!hasActiveFilters || Boolean(busyKey)}>
            Reset Filters
          </button>
        </div>

        <div className="adminx-row" style={{ flexWrap: "wrap", gap: 8 }}>
          <span className="adminx-muted">Search updates the queue in real time.</span>
          <span className="adminx-muted">Scan Search Matches uses the exact text in the search box.</span>
        </div>

        {lastScan ? (
          <div className="adminx-panel" role="status" style={{ display: "grid", gap: 10, padding: 14 }}>
            <div className="adminx-row" style={{ flexWrap: "wrap", gap: 8, justifyContent: "flex-start" }}>
              <strong>Latest manual scan</strong>
              <span className={`adminx-badge ${getScanConcernCount(lastScan) > 0 ? "adminx-badge--warn" : "adminx-badge--good"}`}>
                {getScanConcernCount(lastScan) > 0 ? "Attention required" : "Batch completed"}
              </span>
              <span className="adminx-muted">Completed {getScanCompletedLabel(lastScan)}</span>
            </div>
            <div className="adminx-row" style={{ flexWrap: "wrap", gap: 8, justifyContent: "flex-start" }}>
              <span className="adminx-badge">Checked {formatNumber(lastScan?.processedCount ?? lastScan?.scannedCount)}</span>
              <span className="adminx-badge adminx-badge--good">Cleared {formatNumber(lastScan?.approvedCount)}</span>
              <span className="adminx-badge adminx-badge--danger">Blocked {formatNumber(lastScan?.blockedCount)}</span>
              <span className="adminx-badge adminx-badge--warn">Review {formatNumber(lastScan?.reviewCount)}</span>
              <span className="adminx-badge adminx-badge--warn">Restricted {formatNumber(lastScan?.restrictedCount)}</span>
              <span className="adminx-badge adminx-badge--good">Prior resolutions kept {formatNumber(lastScan?.preservedResolutionCount)}</span>
              <span className="adminx-badge adminx-badge--warn">Inspection failures {formatNumber(lastScan?.inspectionFailureCount)}</span>
              <span className="adminx-badge adminx-badge--warn">Processing errors {formatNumber(lastScan?.processingFailureCount)}</span>
              <span className="adminx-badge adminx-badge--warn">Source errors {formatNumber(lastScan?.sourceQueryFailureCount)}</span>
              <span className="adminx-badge">Visual items inspected {formatNumber(lastScan?.visualInspectedCount)} / {formatNumber(lastScan?.visualItemCount)}</span>
            </div>
            <span className="adminx-muted">
              This result covers only the listed batch as of {getScanCompletedLabel(lastScan)}. Content uploaded afterward was not included.
            </span>
            {lastScan?.truncated ? (
              <span className="adminx-muted">
                This page checked {formatNumber(lastScan?.processedCount ?? lastScan?.scannedCount)} candidates starting at offset {formatNumber(lastScan?.scanOffset)}. At least {formatNumber(lastScan?.candidateCountLowerBound ?? lastScan?.availableCandidateCount)} candidates are available; use the next batch or Scan Search Matches for a specific item.
              </span>
            ) : null}
            {lastScan?.scanDeadlineReached ? (
              <span className="adminx-muted">
                The bounded scan window was reached. The current item was held for review and the remaining items are available in the next batch.
              </span>
            ) : null}
            {Array.isArray(lastScan?.nextCursor) ? (
              <button
                type="button"
                className="adminx-link-btn"
                style={{ justifySelf: "start" }}
                onClick={handleScanNextBatch}
                disabled={Boolean(busyKey)}
              >
                {busyKey === "scan_recent" || busyKey === "scan_search" ? "Scanning next batch..." : "Scan next batch"}
              </button>
            ) : null}
            {lastScan?.cursorLimitReached ? (
              <span className="adminx-muted">
                This scan reached the continuation limit. Narrow the queue search and use Scan Search Matches to continue safely.
              </span>
            ) : null}
            {Array.isArray(lastScan?.processingFailures) && lastScan.processingFailures.length > 0 ? (
              <div className="adminx-error" style={{ display: "grid", gap: 4 }}>
                <strong>Some items could not be completed</strong>
                {lastScan.processingFailures.slice(0, 3).map((failure) => (
                  <span key={`${failure?.targetType || "item"}:${failure?.targetId || failure?.message || "error"}`}>
                    {getStatusLabel(failure?.targetType || "item")}: {normalizeText(failure?.message || "Processing failed")}
                  </span>
                ))}
              </div>
            ) : null}
            {Array.isArray(lastScan?.sourceQueryFailures) && lastScan.sourceQueryFailures.length > 0 ? (
              <div className="adminx-error" style={{ display: "grid", gap: 4 }}>
                <strong>Some content sources could not be queried</strong>
                {lastScan.sourceQueryFailures.slice(0, 3).map((failure) => (
                  <span key={`${failure?.source || "source"}:${failure?.message || "error"}`}>
                    {getStatusLabel(failure?.source || "source")}: {normalizeText(failure?.message || "Query failed")}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {hasActiveFilters ? (
          <div className="adminx-row" style={{ flexWrap: "wrap", gap: 8 }}>
            <span className="adminx-muted">Active filters:</span>
            {category ? <span className="adminx-badge">Category: {getLabel(category)}</span> : null}
            {status ? <span className="adminx-badge">Status: {getStatusLabel(status)}</span> : null}
            {workflowState !== "ACTIVE" ? <span className="adminx-badge">Workflow: {workflowState ? getStatusLabel(workflowState) : "All"}</span> : null}
            {normalizeText(search) ? <span className="adminx-badge">Search: {normalizeText(search)}</span> : null}
            {page !== 1 ? <span className="adminx-badge">Page: {page}</span> : null}
            {Number(limit) !== 12 ? <span className="adminx-badge">Per page: {formatNumber(limit)}</span> : null}
          </div>
        ) : null}

        {statsError ? <div className="adminx-error">{statsError}</div> : null}
        {queueError ? <div className="adminx-error">{queueError}</div> : null}
      </section>

      <section className="adminx-analytics-grid">
        <section className="adminx-panel adminx-panel--span-7" style={{ display: "grid", gap: 14 }}>
          <div className="adminx-panel-head" style={{ marginBottom: 0 }}>
            <div>
              <h2 className="adminx-panel-title">Moderation Queue</h2>
              <span className="adminx-section-meta">{queueLoading ? "Refreshing cases..." : `${formatNumber(queueCases.length)} results on this page`}</span>
            </div>
            {busyKey === "refresh" ? <span className="adminx-badge">Refreshing</span> : null}
          </div>

          {queueLoading && queueCases.length === 0 ? (
            <div className="adminx-list-grid">{[0, 1, 2].map((entry) => <QueueSkeleton key={entry} />)}</div>
          ) : (
            <div className="adminx-list-grid">
              {queueCases.map((item) => <CaseCard key={item._id} item={item} active={String(item._id) === String(selectedCaseId)} busyKey={busyKey} onSelect={selectCase} onView={handleView} onAction={runCaseAction} />)}
              {!queueLoading && queueCases.length === 0 ? <div className="adminx-empty">No moderation cases found for the current filters.</div> : null}
            </div>
          )}

          <div className="adminx-row" style={{ justifyContent: "space-between", gap: 8 }}>
            <button type="button" className="adminx-btn" disabled={page <= 1 || Boolean(busyKey)} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
            <span className="adminx-muted">Page {page} of {totalPages}</span>
            <button type="button" className="adminx-btn" disabled={page >= totalPages || Boolean(busyKey)} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</button>
          </div>
        </section>

        <section className="adminx-panel adminx-panel--span-5" style={{ display: "grid", gap: 14 }}>
          <div className="adminx-panel-head" style={{ marginBottom: 0 }}>
            <div>
              <h2 className="adminx-panel-title">{normalizeText(visibleCase?.subject?.title || "Moderation detail")}</h2>
              <span className="adminx-section-meta">{normalizeText(visibleCase?.subject?.targetType || "upload")} | {getLabel(visibleCase?.queue)} | {getMediaKind(visibleCase)}</span>
            </div>
            <Badge status={visibleCase?.status} workflowState={visibleCase?.workflowState} />
          </div>

          {detailLoading && !visibleCase ? <div className="adminx-loading">Loading moderation case...</div> : null}
          {detailError ? <div className="adminx-error">{detailError}</div> : null}
          {!detailLoading && !visibleCase ? <div className="adminx-empty">Select a moderation case to review the media, warnings, and enforcement controls.</div> : null}
          {selectionIsOutsideCurrentQueue ? (
            <div className="adminx-panel" style={{ padding: 14 }}>
              <div className="adminx-row" style={{ flexWrap: "wrap", gap: 8 }}>
                <span className="adminx-badge adminx-badge--warn">Current case is not in the filtered queue</span>
                <button type="button" className="adminx-link-btn" onClick={resetFilters} disabled={Boolean(busyKey)}>Clear filters to bring it back</button>
              </div>
            </div>
          ) : null}

          {visibleCase ? (
            <>
              <PreviewCard item={visibleCase} onView={() => handleView(visibleCase)} loading={busyKey === `view:${visibleCase._id}`} />

              <div className="adminx-panel" style={{ display: "grid", gap: 12 }}>
                <div className="adminx-row" style={{ flexWrap: "wrap", gap: 10 }}>
                  <span className="adminx-badge">Uploader: {getUploaderLabel(visibleCase?.uploader)}</span>
                  <span className="adminx-badge">Priority: {formatScore(visibleCase?.priorityScore)}</span>
                  <span className="adminx-badge">Created: {formatDateTime(visibleCase?.createdAt)}</span>
                  <span className="adminx-badge">Updated: {formatDateTime(visibleCase?.updatedAt)}</span>
                </div>
                <div className="adminx-row" style={{ flexWrap: "wrap", gap: 10 }}>
                  <span className="adminx-muted">Workflow: {getStatusLabel(visibleCase?.workflowState)}</span>
                  <span className="adminx-muted">Severity: {getStatusLabel(visibleCase?.severity)}</span>
                  <span className="adminx-muted">Source: {normalizeText(visibleCase?.detectionSource || "automated_upload_scan")}</span>
                </div>
                <div className="adminx-muted">{normalizeText(visibleCase?.subject?.description || visibleCase?.reason || "No case summary provided.")}</div>
                {visibleCase?.publicWarningLabel ? <span className="adminx-badge adminx-badge--warn" style={{ alignSelf: "flex-start" }}>{visibleCase.publicWarningLabel}</span> : null}
              </div>

              <div>
                <strong>Risk labels</strong>
                <div className="adminx-action-row" style={{ flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {(visibleCase?.riskLabels || []).map((label) => <span key={label} className="adminx-badge">{label}</span>)}
                  {Array.isArray(visibleCase?.riskLabels) && visibleCase.riskLabels.length === 0 ? <span className="adminx-muted">No labels</span> : null}
                </div>
              </div>

              <div>
                <strong>Moderation note</strong>
                <div className="adminx-muted" style={{ marginTop: 4, marginBottom: 8 }}>This note is stored in the audit trail and sent to the uploader in Messenger with the moderation warning.</div>
                <textarea className="adminx-textarea" rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Write the warning or review note the uploader should receive" />
              </div>

              <div>
                <strong>Case actions</strong>
                <div style={{ marginTop: 10 }}>
                  <ActionRow item={visibleCase} busyKey={busyKey} actions={detailActions} onAction={runCaseAction} />
                </div>
              </div>

              <div className="adminx-panel" style={{ display: "grid", gap: 12 }}>
                <div className="adminx-row" style={{ flexWrap: "wrap", gap: 10 }}>
                  <span className="adminx-muted">Target ID: {normalizeText(visibleCase?.subject?.targetId || "-")}</span>
                  <span className="adminx-muted">Linked reports: {formatNumber(visibleCase?.linkedReportsCount)}</span>
                  <span className="adminx-muted">Reviewed at: {formatDateTime(visibleCase?.reviewedAt)}</span>
                </div>
                <div className="adminx-muted">Reviewed by: {getUploaderLabel(visibleCase?.reviewedBy || {}) || "Unreviewed"}</div>
                <div className="adminx-muted">{normalizeText(visibleCase?.reviewerNote || "No reviewer note stored yet.")}</div>
              </div>

              <div className="adminx-panel" style={{ display: "grid", gap: 12 }}>
                <div className="adminx-panel-head" style={{ marginBottom: 0 }}>
                  <div>
                    <h3 className="adminx-panel-title">Uploader enforcement</h3>
                    <span className="adminx-section-meta">Real user account controls pulled from the admin backend.</span>
                  </div>
                </div>

                {selectedUploaderUser ? (
                  <>
                    <div className="adminx-row" style={{ flexWrap: "wrap", gap: 8, justifyContent: "flex-start" }}>
                      <span className="adminx-badge">State: {selectedUploaderUser.isBanned ? "Banned" : selectedUploaderUser.isSuspended ? "Suspended" : "Active"}</span>
                      <span className="adminx-badge">Strikes: {formatNumber(selectedUploader?.strike?.count)}</span>
                      <span className="adminx-badge">Cases: {formatNumber(selectedUploader?.moderationCaseCount)}</span>
                    </div>
                    <div className="adminx-row" style={{ flexWrap: "wrap", gap: 8, justifyContent: "flex-start" }}>
                      {!selectedUploaderUser.isBanned ? <button type="button" className="adminx-btn adminx-btn--danger" onClick={() => handleUserAction("ban")} disabled={Boolean(busyKey)}>{busyKey === `ban:${selectedUploaderUser._id}` ? "Banning..." : "Ban User"}</button> : <button type="button" className="adminx-btn" onClick={() => handleUserAction("unban")} disabled={Boolean(busyKey)}>{busyKey === `unban:${selectedUploaderUser._id}` ? "Unbanning..." : "Unban User"}</button>}
                      {!selectedUploaderUser.isSuspended ? <button type="button" className="adminx-btn" onClick={() => handleUserAction("suspend")} disabled={Boolean(busyKey)}>{busyKey === `suspend:${selectedUploaderUser._id}` ? "Suspending..." : "Suspend User"}</button> : <button type="button" className="adminx-btn" onClick={() => handleUserAction("unsuspend")} disabled={Boolean(busyKey)}>{busyKey === `unsuspend:${selectedUploaderUser._id}` ? "Unsuspending..." : "Unsuspend User"}</button>}
                      <button type="button" className="adminx-btn" onClick={() => handleUserAction("force-logout")} disabled={Boolean(busyKey)}>{busyKey === `force-logout:${selectedUploaderUser._id}` ? "Logging out..." : "Force Logout"}</button>
                    </div>
                  </>
                ) : (
                  <div className="adminx-empty">No uploader profile is attached to this case.</div>
                )}
              </div>
            </>
          ) : null}
        </section>
      </section>
    </AdminShell>
  );
}
