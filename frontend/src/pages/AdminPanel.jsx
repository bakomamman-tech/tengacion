import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import AdminShell from "../components/AdminShell";
import {
  adminBanUser,
  adminForceLogoutUser,
  adminGetAuditLogs,
  adminGetUser,
  adminListUsers,
  adminSoftDeleteUser,
  adminUnbanUser,
} from "../api";

import "./admin-users.css";

const formatDate = (value) => {
  if (!value) {return "-";}
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

const statusLabel = (entry) => {
  if (entry?.isDeleted) {return "Deleted";}
  if (entry?.isBanned) {return "Banned";}
  return "Active";
};

const copyToClipboard = async (value) => {
  const text = String(value || "");
  if (!text) {
    throw new Error("Nothing to copy");
  }

  let clipboardError = null;
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (err) {
      clipboardError = err;
    }
  }

  if (typeof document !== "undefined" && typeof document.execCommand === "function") {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (copied) {
      return;
    }
  }

  throw clipboardError || new Error("Copy is not available");
};

function UserActionModal({
  open,
  user,
  loading,
  onClose,
  onBan,
  onUnban,
  onForceLogout,
  onSoftDelete,
  onRefresh,
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [copyFeedback, setCopyFeedback] = useState({ message: "", isError: false });
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const activeUserId = user?._id || "";

  useEffect(() => {
    if (!open || !activeUserId) {
      return undefined;
    }

    const previousActiveElement = document.activeElement;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (!focusableElements.length) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      previousActiveElement?.focus?.();
    };
  }, [activeUserId, onClose, open]);

  useEffect(() => {
    if (open) {
      setReason("");
      setError("");
      setCopyFeedback({ message: "", isError: false });
    }
  }, [activeUserId, open]);

  if (!open || !user) {return null;}

  const displayName = String(user.displayName || user.username || "Unknown user").trim();
  const username = String(user.username || "").trim();
  const email = String(user.email || "").trim();
  const phone = String(user.phone || "").trim();
  const status = statusLabel(user);
  const phoneHrefValue = phone.replace(/[^\d+*#,;]/g, "");
  const allUserDetails = [
    `Name: ${displayName}`,
    `Username: ${username ? `@${username}` : "Not supplied"}`,
    `Phone: ${phone || "Not supplied"}`,
    `Email: ${email || "Not supplied"}`,
    `User ID: ${user._id || "Not supplied"}`,
    `Role: ${user.role || "user"}`,
    `Status: ${status}`,
    `Joined: ${formatDate(user.createdAt)}`,
    `Last login: ${formatDate(user.lastLoginAt)}`,
  ].join("\n");

  const handleCopy = async (label, value) => {
    try {
      await copyToClipboard(value);
      setCopyFeedback({ message: `${label} copied.`, isError: false });
    } catch {
      setCopyFeedback({
        message: `Could not copy ${label.toLowerCase()}. Select the value and copy it manually.`,
        isError: true,
      });
    }
  };

  const run = async (fn) => {
    try {
      setError("");
      await fn(reason);
      setReason("");
      await onRefresh();
      onClose();
    } catch (err) {
      setError(err?.message || "Action failed");
    }
  };

  return (
    <div
      className="adminx-modal adminx-user-modal"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) {onClose();} }}
    >
      <div
        ref={dialogRef}
        className="adminx-modal__dialog adminx-user-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="adminx-user-modal-title"
        aria-describedby="adminx-user-modal-description"
        aria-busy={loading}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="adminx-modal__head adminx-user-modal__header">
          <div>
            <div className="adminx-user-modal__eyebrow">User response record</div>
            <h2 id="adminx-user-modal-title">Manage user</h2>
            <p id="adminx-user-modal-description">
              Review stored contact information before taking an administrative action.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="adminx-modal__close adminx-user-modal__close"
            onClick={onClose}
            aria-label="Close user details"
          >
            X
          </button>
        </header>

        <section className="adminx-user-modal__identity" aria-label="Selected user">
          <div className="adminx-user-modal__avatar" aria-hidden="true">
            {displayName.slice(0, 1).toUpperCase()}
          </div>
          <div className="adminx-user-modal__identity-copy">
            <strong>{displayName}</strong>
            <span>{username ? `@${username}` : "Username not supplied"}</span>
          </div>
          <span className={`adminx-user-modal__status is-${status.toLowerCase()}`}>{status}</span>
        </section>

        <section className="adminx-user-modal__contact" aria-labelledby="adminx-emergency-contact-title">
          <div className="adminx-user-modal__section-head">
            <div>
              <span>Priority information</span>
              <h3 id="adminx-emergency-contact-title">Emergency contact</h3>
              <p>Copy the stored details exactly as shown or start a call on a supported device.</p>
            </div>
            <button
              type="button"
              className="adminx-user-modal__copy-all"
              onClick={() => handleCopy("All user details", allUserDetails)}
            >
              Copy all details
            </button>
          </div>

          <div className="adminx-user-modal__contact-list">
            <div className="adminx-user-modal__contact-row">
              <div className="adminx-user-modal__contact-value">
                <span>Mobile phone</span>
                {phone ? (
                  <a className="is-phone" href={phoneHrefValue ? `tel:${phoneHrefValue}` : undefined}>
                    {phone}
                  </a>
                ) : (
                  <strong className="is-missing">Not supplied</strong>
                )}
              </div>
              <div className="adminx-user-modal__contact-actions">
                {phoneHrefValue ? (
                  <a className="adminx-user-modal__contact-link" href={`tel:${phoneHrefValue}`}>
                    Call
                  </a>
                ) : null}
                <button
                  type="button"
                  className="adminx-user-modal__contact-button"
                  disabled={!phone}
                  onClick={() => handleCopy("Phone", phone)}
                >
                  Copy phone
                </button>
              </div>
            </div>

            <div className="adminx-user-modal__contact-row">
              <div className="adminx-user-modal__contact-value">
                <span>Email address</span>
                {email ? (
                  <a href={`mailto:${email}`}>{email}</a>
                ) : (
                  <strong className="is-missing">Not supplied</strong>
                )}
              </div>
              <div className="adminx-user-modal__contact-actions">
                <button
                  type="button"
                  className="adminx-user-modal__contact-button"
                  disabled={!email}
                  onClick={() => handleCopy("Email", email)}
                >
                  Copy email
                </button>
              </div>
            </div>
          </div>

          <p
            className={`adminx-user-modal__copy-feedback${copyFeedback.isError ? " is-error" : ""}`}
            role={copyFeedback.isError ? "alert" : "status"}
            aria-live="polite"
          >
            {copyFeedback.message}
          </p>
        </section>

        <section className="adminx-user-modal__details" aria-labelledby="adminx-account-details-title">
          <div className="adminx-user-modal__section-title">
            <h3 id="adminx-account-details-title">Account details</h3>
            <p>Use these fields to confirm the correct account before making contact.</p>
          </div>
          <dl className="adminx-user-modal__details-grid">
            <div>
              <dt>Role</dt>
              <dd>{user.role || "user"}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{status}</dd>
            </div>
            <div>
              <dt>Joined</dt>
              <dd>{formatDate(user.createdAt)}</dd>
            </div>
            <div>
              <dt>Last login</dt>
              <dd>{formatDate(user.lastLoginAt)}</dd>
            </div>
            <div className="adminx-user-modal__detail-wide">
              <dt>User ID</dt>
              <dd>{user._id || "Not supplied"}</dd>
            </div>
          </dl>
        </section>

        <section className="adminx-user-modal__admin-actions" aria-labelledby="adminx-user-actions-title">
          <div className="adminx-user-modal__section-title">
            <h3 id="adminx-user-actions-title">Administrative actions</h3>
            <p>These controls affect account access and are recorded in the audit log.</p>
          </div>

          <label className="adminx-user-modal__audit-field" htmlFor="adminx-user-audit-reason">
            <span>Reason for audit log</span>
            <input
              id="adminx-user-audit-reason"
              className="adminx-input"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Describe why this action is required"
              maxLength={300}
            />
          </label>

          {error ? <div className="adminx-error adminx-user-modal__action-error" role="alert">{error}</div> : null}

          <div className="adminx-user-modal__action-groups">
            <div className="adminx-user-modal__action-group">
              <div>
                <strong>Session control</strong>
                <span>End all current sessions for a security review.</span>
              </div>
              <button type="button" className="adminx-btn" disabled={loading} onClick={() => run(onForceLogout)}>
                Force logout
              </button>
            </div>

            <div className="adminx-user-modal__action-group adminx-user-modal__action-group--danger">
              <div>
                <strong>Restricted actions</strong>
                <span>Limit or remove account access only after confirming the user.</span>
              </div>
              <div className="adminx-user-modal__danger-buttons">
                {user.isBanned ? (
                  <button type="button" className="adminx-btn" disabled={loading} onClick={() => run(onUnban)}>
                    Unban user
                  </button>
                ) : (
                  <button type="button" className="adminx-btn adminx-btn--danger" disabled={loading} onClick={() => run(onBan)}>
                    Ban user
                  </button>
                )}
                <button type="button" className="adminx-btn adminx-btn--danger" disabled={loading} onClick={() => run(onSoftDelete)}>
                  Soft delete
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function AdminPanel({ user }) {
  const location = useLocation();
  const isLogsView = location.pathname === "/admin/audit-logs";
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [logs, setLogs] = useState([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [busy, setBusy] = useState(false);
  const closeUserModal = useCallback(() => {
    setSelectedUserId("");
    setSelectedUser(null);
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await adminListUsers({ search: query.trim(), page, limit: 20 });
      setUsers(Array.isArray(response?.users) ? response.users : []);
      setTotal(Number(response?.total) || 0);
    } catch (err) {
      setError(err?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await adminGetAuditLogs({ page: logsPage, limit: 20 });
      setLogs(Array.isArray(response?.logs) ? response.logs : []);
      setLogsTotal(Number(response?.total) || 0);
    } catch (err) {
      setError(err?.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [logsPage]);

  useEffect(() => {
    if (isLogsView) {loadLogs();}
    else {loadUsers();}
  }, [isLogsView, loadLogs, loadUsers]);

  const refresh = () => (isLogsView ? loadLogs() : loadUsers());
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / 20)), [total]);
  const logsPages = useMemo(() => Math.max(1, Math.ceil(logsTotal / 20)), [logsTotal]);

  const runUserAction = async (runner, reason) => {
    if (!selectedUserId) {return;}
    setBusy(true);
    try {
      await runner(selectedUserId, reason);
      await Promise.all([loadUsers(), loadLogs()]);
      if (selectedUserId) {
        const detail = await adminGetUser(selectedUserId);
        setSelectedUser(detail || null);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AdminShell
        title={isLogsView ? "Audit Logs" : "User Management"}
        subtitle={isLogsView ? "Administrative actions recorded across the platform." : "Manage platform users without affecting the analytics replacement."}
        user={user}
        actions={<button type="button" className="adminx-btn" onClick={refresh}>Refresh</button>}
      >
        {!isLogsView ? (
          <section className="adminx-panel adminx-panel--span-12">
            <div className="adminx-filter-row">
              <input className="adminx-input" style={{ minWidth: 320 }} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, username, email" />
              <button type="button" className="adminx-btn" onClick={() => { setPage(1); loadUsers(); }}>Search</button>
            </div>
          </section>
        ) : null}

        {error ? <div className="adminx-error">{error}</div> : null}
        {loading ? <div className="adminx-loading">Loading...</div> : null}

        {!loading && !isLogsView ? (
          <section className="adminx-table-wrap">
            <table className="adminx-table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
              <tbody>
                {users.map((entry) => (
                  <tr key={entry._id}>
                    <td>{entry.displayName || entry.username}</td>
                    <td>{entry.email || "-"}</td>
                    <td>{entry.role}</td>
                    <td>{statusLabel(entry)}</td>
                    <td>{formatDate(entry.createdAt)}</td>
                    <td><button type="button" className="adminx-btn" onClick={async () => { setSelectedUserId(entry._id); setSelectedUser(await adminGetUser(entry._id)); }}>Manage</button></td>
                  </tr>
                ))}
                {users.length === 0 ? <tr><td colSpan={6} className="adminx-table-empty">No users found.</td></tr> : null}
              </tbody>
            </table>
            <div className="adminx-row" style={{ padding: 12 }}>
              <span className="adminx-muted">Page {page} of {totalPages}</span>
              <div className="adminx-action-row">
                <button type="button" className="adminx-btn" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1}>Prev</button>
                <button type="button" className="adminx-btn" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page >= totalPages}>Next</button>
              </div>
            </div>
          </section>
        ) : null}

        {!loading && isLogsView ? (
          <section className="adminx-list-grid">
            {logs.map((entry) => (
              <article key={entry._id} className="adminx-panel adminx-panel--span-12">
                <div><strong>{entry.action}</strong> - {entry.targetType} {entry.targetId}</div>
                <div className="adminx-muted">by @{entry.actor?.username || "unknown"} - {formatDate(entry.createdAt)}</div>
                {entry.reason ? <div className="adminx-muted">Reason: {entry.reason}</div> : null}
              </article>
            ))}
            {logs.length === 0 ? <div className="adminx-empty">No logs available.</div> : null}
            <div className="adminx-row">
              <span className="adminx-muted">Page {logsPage} of {logsPages}</span>
              <div className="adminx-action-row">
                <button type="button" className="adminx-btn" onClick={() => setLogsPage((prev) => Math.max(1, prev - 1))} disabled={logsPage <= 1}>Prev</button>
                <button type="button" className="adminx-btn" onClick={() => setLogsPage((prev) => Math.min(logsPages, prev + 1))} disabled={logsPage >= logsPages}>Next</button>
              </div>
            </div>
          </section>
        ) : null}
      </AdminShell>

      <UserActionModal
        open={Boolean(selectedUserId)}
        user={selectedUser}
        loading={busy}
        onClose={closeUserModal}
        onRefresh={refresh}
        onBan={(reason) => runUserAction((id, r) => adminBanUser(id, r || "Policy violation"), reason)}
        onUnban={(reason) => runUserAction((id, r) => adminUnbanUser(id, r || "Lifted by admin"), reason)}
        onForceLogout={(reason) => runUserAction((id, r) => adminForceLogoutUser(id, r || "Security review"), reason)}
        onSoftDelete={(reason) => runUserAction((id, r) => adminSoftDeleteUser(id, r || "Admin action"), reason)}
      />
    </>
  );
}
