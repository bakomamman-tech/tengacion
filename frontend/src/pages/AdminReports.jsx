import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import AdminShell from "../components/AdminShell";
import { getSessionAccessToken } from "../authSession";
import {
  adminApproveModerationItem,
  adminBanUser,
  adminGetModerationItem,
  adminListModerationItems,
  adminQuarantineModerationItem,
  adminRejectModerationItem,
  adminRemoveModerationItem,
  adminSuspendUser,
} from "../api";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "quarantined", label: "Quarantined" },
  { value: "rejected", label: "Rejected" },
  { value: "approved", label: "Approved" },
];

const STATUS_STYLE = {
  pending: { background: "rgba(210, 162, 77, 0.18)", color: "#f0c78a" },
  quarantined: { background: "rgba(71, 129, 176, 0.18)", color: "#a8d3ff" },
  rejected: { background: "rgba(172, 78, 78, 0.2)", color: "#f0b3b3" },
  approved: { background: "rgba(79, 141, 101, 0.18)", color: "#bfe9cf" },
  blocked: { background: "rgba(172, 78, 78, 0.2)", color: "#f0b3b3" },
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

const formatConfidence = (value) => {
  const confidence = Number(value);
  if (!Number.isFinite(confidence)) {
    return "-";
  }
  return `${Math.round(confidence * 100)}%`;
};

const normalizeText = (value) => String(value || "").trim();

const getMediaKind = (item = {}) => {
  const mimeType = normalizeText(item.mimeType || item.media?.[0]?.mimeType || "").toLowerCase();
  if (mimeType.startsWith("video/")) {
    return "video";
  }
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  return item.previewKind || "file";
};

const getStatusStyle = (status = "") => STATUS_STYLE[String(status || "").toLowerCase()] || STATUS_STYLE.pending;

const StatusBadge = ({ status = "" }) => {
  const style = getStatusStyle(status);
  return (
    <span
      className="adminx-badge"
      style={{
        background: style.background,
        color: style.color,
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {String(status || "unknown").replace(/_/g, " ")}
    </span>
  );
};

const MediaPreview = ({ item }) => {
  const [imageSrc, setImageSrc] = useState("");
  const kind = getMediaKind(item);
  const previewUrl = normalizeText(item?.previewUrl || item?.fileUrl || item?.media?.[0]?.previewUrl || "");
  const needsAuthPreview = previewUrl.startsWith("/api/admin/moderation/items/");

  useEffect(() => {
    let active = true;
    let objectUrl = "";

    if (!previewUrl || kind !== "image") {
      setImageSrc("");
      return () => {};
    }

    if (!needsAuthPreview) {
      setImageSrc(previewUrl);
      return () => {};
    }

    const controller = new AbortController();
    (async () => {
      try {
        const token = getSessionAccessToken();
        const response = await fetch(previewUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("Preview unavailable");
        }
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (active) {
          setImageSrc(objectUrl);
        }
      } catch {
        if (active) {
          setImageSrc("");
        }
      }
    })();

    return () => {
      active = false;
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [kind, needsAuthPreview, previewUrl]);

  if (kind === "image" && (imageSrc || (previewUrl && !needsAuthPreview))) {
    return (
      <div
        className="adminx-panel"
        style={{
          padding: 0,
          overflow: "hidden",
          background: "linear-gradient(180deg, rgba(24, 26, 32, 0.9), rgba(13, 15, 19, 0.96))",
          minHeight: 220,
        }}
      >
        <img
          src={imageSrc || previewUrl}
          alt={normalizeText(item?.subject?.title || "Moderation preview")}
          style={{
            width: "100%",
            height: 220,
            objectFit: "cover",
            display: "block",
            background: "#111",
          }}
        />
      </div>
    );
  }

  if (kind === "image" && needsAuthPreview) {
    return (
      <div
        className="adminx-panel"
        style={{
          minHeight: 220,
          padding: 16,
          display: "grid",
          placeItems: "center",
          background: "linear-gradient(135deg, rgba(13, 16, 22, 0.96), rgba(34, 39, 48, 0.98))",
          border: "1px dashed rgba(255,255,255,0.12)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 700, color: "#efe5d7" }}>Private image preview</div>
          <div className="adminx-muted">Fetching the quarantined asset with your admin session.</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="adminx-panel"
      style={{
        minHeight: 220,
        padding: 16,
        overflow: "hidden",
        background:
          "linear-gradient(135deg, rgba(13, 16, 22, 0.96), rgba(34, 39, 48, 0.98)), radial-gradient(circle at top right, rgba(191, 120, 60, 0.35), transparent 35%)",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, minHeight: 120 }}>
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            style={{
              borderRadius: 14,
              background: index === 1
                ? "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.04))"
                : "linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,255,255,0.03))",
              border: "1px solid rgba(255,255,255,0.08)",
              minHeight: 120,
            }}
          />
        ))}
      </div>
      <div
        style={{
          marginTop: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          color: "#efe5d7",
        }}
      >
        <div>
          <div style={{ fontWeight: 700 }}>Video preview</div>
          <div className="adminx-muted">Frame strip placeholder while the private source stays isolated.</div>
        </div>
        <span className="adminx-badge">private review</span>
      </div>
    </div>
  );
};

const ModerationListItem = ({ item, active, onSelect }) => {
  const labels = Array.isArray(item?.labels) ? item.labels : [];
  const uploader = item?.uploader || {};
  const mediaKind = getMediaKind(item);
  const createdAt = formatDateTime(item?.createdAt);

  return (
    <button
      type="button"
      className={`adminx-panel ${active ? "is-active" : ""}`}
      style={{
        textAlign: "left",
        width: "100%",
        display: "grid",
        gap: 10,
        border: active ? "1px solid rgba(188, 131, 63, 0.8)" : undefined,
      }}
      onClick={() => onSelect(item)}
    >
      <div className="adminx-row" style={{ alignItems: "flex-start", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.3 }}>
            {normalizeText(item?.subject?.title || item?.subject?.description || "Untitled upload")}
          </div>
          <div className="adminx-muted" style={{ marginTop: 4 }}>
            {normalizeText(item?.subject?.targetType || item?.targetType || "upload")} | {mediaKind} | {normalizeText(item?.mimeType || "unknown")}
          </div>
        </div>
        <StatusBadge status={item?.status} />
      </div>
      <div className="adminx-row" style={{ flexWrap: "wrap", gap: 8 }}>
        {labels.slice(0, 3).map((label) => (
          <span key={label} className="adminx-badge">
            {label}
          </span>
        ))}
        {labels.length > 3 ? <span className="adminx-muted">+{labels.length - 3} more</span> : null}
      </div>
      <div className="adminx-row" style={{ flexWrap: "wrap", gap: 10 }}>
        <span className="adminx-muted">
          uploader: {uploader.displayName || uploader.username || uploader.email || "unknown"}
        </span>
        <span className="adminx-muted">confidence: {formatConfidence(item?.confidence)}</span>
        <span className="adminx-muted">{createdAt}</span>
      </div>
    </button>
  );
};

export default function AdminReportsPage({ user }) {
  const navigate = useNavigate();
  const { caseId } = useParams();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(caseId || "");
  const [selectedItem, setSelectedItem] = useState(null);
  const [reason, setReason] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const totalPages = useMemo(() => Math.max(1, Math.ceil((Number(total) || 0) / limit)), [total, limit]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const payload = await adminListModerationItems({
        status,
        page,
        limit,
        search: deferredSearch,
      });
      const nextItems = Array.isArray(payload?.items) ? payload.items : [];
      setItems(nextItems);
      setTotal(Number(payload?.total || 0));

      const nextSelectedId = selectedId || caseId || nextItems[0]?._id || "";
      if (nextSelectedId && nextSelectedId !== selectedId) {
        setSelectedId(nextSelectedId);
      } else if (!nextSelectedId) {
        setSelectedItem(null);
      }
    } catch (error) {
      const message = error?.message || "Failed to load moderation items";
      setErrorMessage(message);
      toast.error(message);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [caseId, deferredSearch, limit, page, selectedId, status]);

  const loadDetail = useCallback(async (itemId) => {
    if (!itemId) {
      setSelectedItem(null);
      return;
    }

    setDetailLoading(true);
    try {
      const payload = await adminGetModerationItem(itemId);
      setSelectedItem(payload || null);
    } catch (error) {
      const message = error?.message || "Failed to load moderation item";
      toast.error(message);
      setErrorMessage(message);
      setSelectedItem(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    setSelectedId(caseId || "");
  }, [caseId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    loadDetail(selectedId);
  }, [loadDetail, selectedId]);

  useEffect(() => {
    if (!selectedId && items.length > 0) {
      setSelectedId(items[0]._id);
    }
  }, [items, selectedId]);

  const selectedItemInList = useMemo(
    () => items.find((entry) => String(entry._id) === String(selectedId)) || null,
    [items, selectedId]
  );

  const selected = selectedItem || selectedItemInList || null;
  const uploaderId = selected?.uploader?.userId || "";
  const canSuspendUploader = Boolean(uploaderId);

  const refresh = useCallback(async () => {
    await loadItems();
    if (selectedId) {
      await loadDetail(selectedId);
    }
  }, [loadDetail, loadItems, selectedId]);

  const handleSelect = (item) => {
    const nextId = item?._id || "";
    setSelectedId(nextId);
    navigate(nextId ? `/admin/moderation/cases/${nextId}` : "/admin/moderation");
  };

  const applyAction = useCallback(
    async (actionName, handler) => {
      if (!selected?._id) {
        return;
      }

      try {
        setActionLoading(actionName);
        const payload = await handler(selected._id, { reason });
        toast.success(payload?.message || `${actionName} completed`);
        setReason("");
        await refresh();
      } catch (error) {
        const message = error?.message || `Failed to ${actionName}`;
        toast.error(message);
      } finally {
        setActionLoading("");
      }
    },
    [reason, refresh, selected?._id]
  );

  const handleSuspendUploader = useCallback(async () => {
    if (!uploaderId) {
      return;
    }

    try {
      setActionLoading("suspend");
      const payload = await adminSuspendUser(uploaderId, reason);
      toast.success(payload?.message || "Uploader suspended");
      setReason("");
      await refresh();
    } catch (error) {
      toast.error(error?.message || "Failed to suspend uploader");
    } finally {
      setActionLoading("");
    }
  }, [refresh, reason, uploaderId]);

  const handleBanUploader = useCallback(async () => {
    if (!uploaderId) {
      return;
    }

    try {
      setActionLoading("ban");
      const payload = await adminBanUser(uploaderId, reason);
      toast.success(payload?.message || "Uploader banned");
      setReason("");
      await refresh();
    } catch (error) {
      toast.error(error?.message || "Failed to ban uploader");
    } finally {
      setActionLoading("");
    }
  }, [reason, refresh, uploaderId]);

  const actionButtons = useMemo(
    () => [
      {
        key: "approve",
        label: "Approve",
        className: "adminx-btn--primary",
        onClick: () => applyAction("approve", adminApproveModerationItem),
      },
      {
        key: "reject",
        label: "Reject",
        className: "adminx-btn--danger",
        onClick: () => applyAction("reject", adminRejectModerationItem),
      },
      {
        key: "remove",
        label: "Delete Media",
        className: "",
        onClick: () => applyAction("remove", adminRemoveModerationItem),
      },
      {
        key: "quarantine",
        label: "Hold for Review",
        className: "",
        onClick: () => applyAction("quarantine", adminQuarantineModerationItem),
      },
    ],
    [applyAction]
  );

  return (
    <AdminShell
      title="Moderation"
      subtitle="Review uploads before they go public. Explicit sexual content, CSAM, violent gore, and animal cruelty can be blocked or quarantined from this console."
      user={user}
      actions={(
        <>
          <button type="button" className="adminx-btn" onClick={refresh} disabled={loading}>
            Refresh
          </button>
        </>
      )}
    >
      <section className="adminx-panel adminx-panel--span-12" style={{ display: "grid", gap: 14 }}>
        <div className="adminx-filter-row" style={{ flexWrap: "wrap", gap: 10 }}>
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value || "all"}
              type="button"
              className={`adminx-btn ${status === tab.value ? "adminx-btn--primary" : ""}`}
              onClick={() => {
                setStatus(tab.value);
                setPage(1);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="adminx-filter-row" style={{ gap: 12, flexWrap: "wrap" }}>
          <input
            className="adminx-input"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search uploader, labels, title, file type"
            style={{ minWidth: 280, flex: "1 1 280px" }}
          />
          <select
            className="adminx-select"
            value={limit}
            onChange={(event) => {
              setLimit(Number(event.target.value) || 12);
              setPage(1);
            }}
          >
            {[8, 12, 20, 40].map((entry) => (
              <option key={entry} value={entry}>
                {entry} per page
              </option>
            ))}
          </select>
        </div>

        <div className="adminx-row" style={{ flexWrap: "wrap", gap: 10 }}>
          <span className="adminx-muted">Total items: {Number(total || 0).toLocaleString()}</span>
          <span className="adminx-muted">Page {page} of {totalPages}</span>
          <span className="adminx-muted">Selected: {selected?._id || "none"}</span>
        </div>

        {errorMessage ? (
          <div className="adminx-panel" style={{ borderColor: "rgba(172, 78, 78, 0.55)" }}>
            {errorMessage}
          </div>
        ) : null}
      </section>

      <section className="adminx-panel adminx-panel--span-5" style={{ display: "grid", gap: 12 }}>
        <div className="adminx-row">
          <h2 className="adminx-panel-title" style={{ margin: 0 }}>Queue</h2>
          {loading ? <span className="adminx-muted">Loading...</span> : null}
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {items.map((item) => (
            <ModerationListItem
              key={item._id}
              item={item}
              active={String(item._id) === String(selectedId)}
              onSelect={handleSelect}
            />
          ))}
          {!loading && items.length === 0 ? (
            <div className="adminx-empty">No moderation items found for the current filters.</div>
          ) : null}
        </div>

        <div className="adminx-row" style={{ justifyContent: "space-between", gap: 8 }}>
          <button
            type="button"
            className="adminx-btn"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </button>
          <button
            type="button"
            className="adminx-btn"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          >
            Next
          </button>
        </div>
      </section>

      <section className="adminx-panel adminx-panel--span-7" style={{ display: "grid", gap: 16 }}>
        <div className="adminx-row" style={{ alignItems: "flex-start" }}>
          <div>
            <h2 className="adminx-panel-title" style={{ margin: 0 }}>
              {normalizeText(selected?.subject?.title || "Moderation detail")}
            </h2>
            <div className="adminx-muted" style={{ marginTop: 4 }}>
              {normalizeText(selected?.subject?.targetType || "upload")} | {normalizeText(selected?.subject?.mediaType || getMediaKind(selected))}
            </div>
          </div>
          <StatusBadge status={selected?.status} />
        </div>

        {detailLoading ? <div className="adminx-loading">Loading moderation item...</div> : null}
        {!detailLoading && !selected ? (
          <div className="adminx-empty">Select an item from the queue to review its details and take action.</div>
        ) : null}

        {!detailLoading && selected ? (
          <div style={{ display: "grid", gap: 16 }}>
            <MediaPreview item={selected} />

            <div className="adminx-panel" style={{ display: "grid", gap: 10 }}>
              <div className="adminx-row" style={{ flexWrap: "wrap", gap: 10 }}>
                <div className="adminx-muted">Uploader: {selected?.uploader?.displayName || selected?.uploader?.username || selected?.uploader?.email || "unknown"}</div>
                <div className="adminx-muted">File type: {normalizeText(selected?.mimeType || getMediaKind(selected))}</div>
                <div className="adminx-muted">Confidence: {formatConfidence(selected?.confidence)}</div>
              </div>
              <div className="adminx-row" style={{ flexWrap: "wrap", gap: 10 }}>
                <div className="adminx-muted">Created: {formatDateTime(selected?.createdAt)}</div>
                <div className="adminx-muted">Updated: {formatDateTime(selected?.updatedAt)}</div>
                <div className="adminx-muted">Visibility: {normalizeText(selected?.visibility || "private")}</div>
                <div className="adminx-muted">Storage stage: {normalizeText(selected?.storageStage || "temporary")}</div>
              </div>
              <div className="adminx-muted">
                Reason: {normalizeText(selected?.reason || "No moderation reason provided")}
              </div>
            </div>

            <div>
              <strong>Labels</strong>
              <div className="adminx-action-row" style={{ flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {(selected?.labels || []).map((label) => (
                  <span key={label} className="adminx-badge">
                    {label}
                  </span>
                ))}
                {(selected?.labels || []).length === 0 ? <span className="adminx-muted">No labels</span> : null}
              </div>
            </div>

            <div>
              <strong>Moderation note</strong>
              <div className="adminx-muted" style={{ marginTop: 4, marginBottom: 8 }}>
                This note is stored in the audit trail and sent to the uploader in Messenger with the moderation warning.
              </div>
              <textarea
                className="adminx-textarea"
                rows={4}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Write the warning you want the uploader to see"
              />
            </div>

            <div className="adminx-action-row" style={{ flexWrap: "wrap", gap: 10 }}>
              {actionButtons.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  className={`adminx-btn ${entry.className || ""}`}
                  onClick={entry.onClick}
                  disabled={Boolean(actionLoading)}
                >
                  {actionLoading === entry.key ? "Working..." : entry.label}
                </button>
              ))}
              <button
                type="button"
                className="adminx-btn"
                onClick={handleSuspendUploader}
                disabled={Boolean(actionLoading) || !canSuspendUploader}
              >
                {actionLoading === "suspend" ? "Suspending..." : "Suspend User"}
              </button>
              <button
                type="button"
                className="adminx-btn adminx-btn--danger"
                onClick={handleBanUploader}
                disabled={Boolean(actionLoading) || !canSuspendUploader}
              >
                {actionLoading === "ban" ? "Banning..." : "Ban User"}
              </button>
            </div>

            <div className="adminx-panel" style={{ display: "grid", gap: 8 }}>
              <div className="adminx-row" style={{ flexWrap: "wrap", gap: 10 }}>
                <span className="adminx-muted">Target ID: {normalizeText(selected?.targetId || selected?.subject?.targetId || "-")}</span>
                <span className="adminx-muted">Reviewed at: {formatDateTime(selected?.reviewedAt)}</span>
              </div>
              <div className="adminx-muted">
                Reviewed by: {selected?.reviewedBy?.name || selected?.reviewedBy?.username || selected?.reviewedBy?.email || "Unreviewed"}
              </div>
              <div className="adminx-muted">
                Preview URL stays private unless a public target has already been approved.
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </AdminShell>
  );
}
