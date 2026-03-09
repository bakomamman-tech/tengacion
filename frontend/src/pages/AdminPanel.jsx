import { useCallback, useEffect, useMemo, useState } from "react";
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

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

const statusLabel = (entry) => {
  if (entry?.isDeleted) return "Deleted";
  if (entry?.isBanned) return "Banned";
  return "Active";
};

function UserActionModal({ open, user, loading, onClose, onBan, onUnban, onForceLogout, onSoftDelete, onRefresh }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  if (!open || !user) return null;

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
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal-card" style={{ width: "min(680px, calc(100vw - 32px))" }}>
        <div className="adminx-row"><h3 style={{ margin: 0 }}>Manage User</h3><button type="button" className="adminx-btn" onClick={onClose}>Close</button></div>
        <div className="adminx-list-grid" style={{ marginTop: 12 }}>
          <div><strong>{user.displayName || user.username}</strong> @{user.username}</div>
          <div>{user.email || "-"}</div>
          <div>Role: {user.role}</div>
          <div>Status: {statusLabel(user)}</div>
          <div>Joined: {formatDate(user.createdAt)}</div>
          <div>Last login: {formatDate(user.lastLoginAt)}</div>
        </div>
        <input className="adminx-input" style={{ width: "100%", marginTop: 12 }} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for audit log" />
        {error ? <div className="adminx-error" style={{ marginTop: 12 }}>{error}</div> : null}
        <div className="adminx-action-row" style={{ marginTop: 12 }}>
          {user.isBanned ? <button type="button" className="adminx-btn" disabled={loading} onClick={() => run(onUnban)}>Unban</button> : <button type="button" className="adminx-btn adminx-btn--danger" disabled={loading} onClick={() => run(onBan)}>Ban</button>}
          <button type="button" className="adminx-btn" disabled={loading} onClick={() => run(onForceLogout)}>Force Logout</button>
          <button type="button" className="adminx-btn" disabled={loading} onClick={() => run(onSoftDelete)}>Soft Delete</button>
        </div>
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
    if (isLogsView) loadLogs();
    else loadUsers();
  }, [isLogsView, loadLogs, loadUsers]);

  const refresh = () => (isLogsView ? loadLogs() : loadUsers());
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / 20)), [total]);
  const logsPages = useMemo(() => Math.max(1, Math.ceil(logsTotal / 20)), [logsTotal]);

  const runUserAction = async (runner, reason) => {
    if (!selectedUserId) return;
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
        onClose={() => { setSelectedUserId(""); setSelectedUser(null); }}
        onRefresh={refresh}
        onBan={(reason) => runUserAction((id, r) => adminBanUser(id, r || "Policy violation"), reason)}
        onUnban={(reason) => runUserAction((id, r) => adminUnbanUser(id, r || "Lifted by admin"), reason)}
        onForceLogout={(reason) => runUserAction((id, r) => adminForceLogoutUser(id, r || "Security review"), reason)}
        onSoftDelete={(reason) => runUserAction((id, r) => adminSoftDeleteUser(id, r || "Admin action"), reason)}
      />
    </>
  );
}
