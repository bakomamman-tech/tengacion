import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  adminBanUser,
  adminForceLogoutUser,
  adminGetAuditLogs,
  adminGetUser,
  adminListUsers,
  adminSoftDeleteUser,
  adminUnbanUser,
} from "../api";

const ADMIN_NAV = [
  { id: "overview", label: "Overview", path: "/admin" },
  { id: "users", label: "Users", path: "/admin/users" },
  { id: "logs", label: "Audit Logs", path: "/admin/audit-logs" },
];

const statusLabel = (entry) => {
  if (entry?.isDeleted) return "Deleted";
  if (entry?.isBanned) return "Banned";
  return "Active";
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

function UserActionModal({
  open,
  user,
  loading,
  onClose,
  onRefresh,
  onBan,
  onUnban,
  onForceLogout,
  onSoftDelete,
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setReason("");
      setError("");
    }
  }, [open]);

  if (!open || !user) return null;

  const submitAction = async (runner) => {
    try {
      setError("");
      await runner(reason.trim());
      setReason("");
      await onRefresh?.();
      onClose?.();
    } catch (err) {
      setError(err?.message || "Action failed");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div className="modal-card" style={{ width: "min(680px, calc(100vw - 32px))" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Manage User</h3>
          <button type="button" onClick={onClose} className="messenger-close-btn" aria-label="Close">
            X
          </button>
        </div>

        <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
          <div>
            <b>{user.displayName || user.username}</b> @{user.username}
          </div>
          <div>{user.email || "-"}</div>
          <div>Role: {user.role}</div>
          <div>Status: {statusLabel(user)}</div>
          <div>Joined: {formatDate(user.createdAt)}</div>
          <div>Last login: {formatDate(user.lastLoginAt)}</div>
          <div>
            Stats: posts {user?.stats?.postsCount || 0} | followers {user?.stats?.followersCount || 0} | following{" "}
            {user?.stats?.followingCount || 0}
          </div>
        </div>

        <label style={{ display: "grid", gap: 6, marginBottom: 12 }}>
          <span>Reason</span>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Add reason for audit log"
          />
        </label>

        {error ? (
          <div className="card" style={{ padding: 10, color: "#b91c1c", marginBottom: 12 }}>
            {error}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {user.isBanned ? (
            <button type="button" disabled={loading} onClick={() => submitAction(onUnban)}>
              Unban
            </button>
          ) : (
            <button type="button" disabled={loading} onClick={() => submitAction(onBan)}>
              Ban
            </button>
          )}
          <button type="button" disabled={loading} onClick={() => submitAction(onForceLogout)}>
            Force logout
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              if (!window.confirm(`Soft delete @${user.username}?`)) return;
              submitAction(onSoftDelete);
            }}
          >
            Soft delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPanel({ user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isUsersView = location.pathname === "/admin/users";
  const isLogsView = location.pathname === "/admin/audit-logs";
  const isOverviewView = !isUsersView && !isLogsView;

  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState("");

  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [logs, setLogs] = useState([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsError, setLogsError] = useState("");

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);
  const logsPages = useMemo(() => Math.max(1, Math.ceil(logsTotal / 20)), [logsTotal]);

  const loadUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      setUsersError("");
      const response = await adminListUsers({
        search: query.trim(),
        page,
        limit,
      });
      setUsers(Array.isArray(response?.users) ? response.users : []);
      setTotal(Number(response?.total) || 0);
    } catch (err) {
      setUsers([]);
      setTotal(0);
      setUsersError(err?.message || "Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  }, [limit, page, query]);

  const loadLogs = useCallback(async () => {
    try {
      setLoadingLogs(true);
      setLogsError("");
      const response = await adminGetAuditLogs({ page: logsPage, limit: 20 });
      setLogs(Array.isArray(response?.logs) ? response.logs : []);
      setLogsTotal(Number(response?.total) || 0);
    } catch (err) {
      setLogs([]);
      setLogsTotal(0);
      setLogsError(err?.message || "Failed to load audit logs");
    } finally {
      setLoadingLogs(false);
    }
  }, [logsPage]);

  const loadUserDetail = useCallback(async (targetUserId) => {
    if (!targetUserId) return;
    try {
      setLoadingDetail(true);
      setDetailError("");
      const response = await adminGetUser(targetUserId);
      setSelectedUser(response || null);
    } catch (err) {
      setSelectedUser(null);
      setDetailError(err?.message || "Failed to load user details");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (isUsersView) loadUsers();
  }, [isUsersView, loadUsers]);

  useEffect(() => {
    if (isLogsView) loadLogs();
  }, [isLogsView, loadLogs]);

  const runUserAction = async (fn, reason = "") => {
    if (!selectedUserId) return;
    setDetailBusy(true);
    try {
      await fn(selectedUserId, reason);
    } finally {
      setDetailBusy(false);
    }
  };

  const refreshAfterAction = async () => {
    await Promise.all([loadUsers(), loadLogs()]);
  };

  const usersCount = Number(total) || users.length;

  return (
    <div className="app-shell">
      <main className="feed" style={{ maxWidth: 1320, margin: "0 auto", padding: 20 }}>
        <section style={{ display: "grid", gap: 16, gridTemplateColumns: "280px 1fr" }}>
          <aside className="card" style={{ padding: 14, alignSelf: "start", position: "sticky", top: 86 }}>
            <h3 style={{ marginTop: 0 }}>Admin</h3>
            <div style={{ opacity: 0.82, marginBottom: 12 }}>
              Signed in as <b>{user?.name || user?.username}</b> ({user?.role})
            </div>
            <nav style={{ display: "grid", gap: 8 }}>
              {ADMIN_NAV.map((item) => {
                const active =
                  (item.path === "/admin" && isOverviewView) || location.pathname === item.path;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.path)}
                    style={{
                      textAlign: "left",
                      border: active ? "1px solid rgba(184,122,58,0.75)" : "1px solid transparent",
                      background: active ? "rgba(184,122,58,0.22)" : "transparent",
                      borderRadius: 12,
                      padding: "10px 12px",
                      color: "inherit",
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          <section className="card" style={{ padding: 16 }}>
            {isOverviewView ? (
              <div style={{ display: "grid", gap: 12 }}>
                <h2 style={{ margin: 0 }}>Overview</h2>
                <div className="card" style={{ padding: 12 }}>
                  <div>Total users</div>
                  <strong style={{ fontSize: 26 }}>{usersCount}</strong>
                  <div style={{ marginTop: 8 }}>
                    <button type="button" onClick={() => navigate("/admin/users")}>
                      Open User Management
                    </button>
                  </div>
                </div>
                <div className="card" style={{ padding: 12 }}>
                  <div>Recent logs</div>
                  <button type="button" onClick={() => navigate("/admin/audit-logs")}>
                    View Audit Logs
                  </button>
                </div>
              </div>
            ) : null}

            {isUsersView ? (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <h2 style={{ margin: 0 }}>Users</h2>
                  <button type="button" onClick={loadUsers} disabled={loadingUsers}>
                    Refresh
                  </button>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by name, username, email"
                    style={{ minWidth: 320 }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPage(1);
                      loadUsers();
                    }}
                    disabled={loadingUsers}
                  >
                    Search
                  </button>
                </div>

                {usersError ? (
                  <div className="card" style={{ padding: 12, color: "#b91c1c" }}>
                    <div>{usersError}</div>
                    <button type="button" onClick={loadUsers} style={{ marginTop: 8 }}>
                      Retry
                    </button>
                  </div>
                ) : null}

                {loadingUsers ? <div>Loading users...</div> : null}

                {!loadingUsers ? (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 8px" }}>
                      <thead>
                        <tr>
                          <th align="left">Name</th>
                          <th align="left">Email</th>
                          <th align="left">Role</th>
                          <th align="left">Status</th>
                          <th align="left">Joined</th>
                          <th align="left">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((entry) => (
                          <tr key={entry._id} className="card">
                            <td style={{ padding: "8px 10px" }}>{entry.displayName || entry.username}</td>
                            <td style={{ padding: "8px 10px" }}>{entry.email || "-"}</td>
                            <td style={{ padding: "8px 10px" }}>{entry.role}</td>
                            <td style={{ padding: "8px 10px" }}>{statusLabel(entry)}</td>
                            <td style={{ padding: "8px 10px" }}>{formatDate(entry.createdAt)}</td>
                            <td style={{ padding: "8px 10px" }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedUserId(entry._id);
                                  setSelectedUser(entry);
                                  loadUserDetail(entry._id);
                                }}
                              >
                                Manage
                              </button>
                            </td>
                          </tr>
                        ))}
                        {users.length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ padding: "12px 0" }}>
                              No users found.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    Page {page} of {totalPages} - {usersCount} users
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1}>
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={page >= totalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {isLogsView ? (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h2 style={{ margin: 0 }}>Audit Logs</h2>
                  <button type="button" onClick={loadLogs} disabled={loadingLogs}>
                    Refresh
                  </button>
                </div>

                {logsError ? (
                  <div className="card" style={{ padding: 12, color: "#b91c1c" }}>
                    <div>{logsError}</div>
                    <button type="button" onClick={loadLogs} style={{ marginTop: 8 }}>
                      Retry
                    </button>
                  </div>
                ) : null}
                {loadingLogs ? <div>Loading audit logs...</div> : null}
                {!loadingLogs ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {logs.map((entry) => (
                      <article key={entry._id} className="card" style={{ padding: 10 }}>
                        <b>{entry.action}</b> - {entry.targetType} {entry.targetId}
                        <div>
                          by @{entry.actor?.username || "unknown"} - {formatDate(entry.createdAt)}
                        </div>
                        {entry.reason ? <div>Reason: {entry.reason}</div> : null}
                      </article>
                    ))}
                    {logs.length === 0 ? <div>No logs available.</div> : null}
                  </div>
                ) : null}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    Page {logsPage} of {logsPages}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setLogsPage((prev) => Math.max(1, prev - 1))}
                      disabled={logsPage <= 1}
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogsPage((prev) => Math.min(logsPages, prev + 1))}
                      disabled={logsPage >= logsPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </section>
      </main>

      {detailError ? <div className="messenger-error">{detailError}</div> : null}

      <UserActionModal
        open={Boolean(selectedUserId)}
        user={selectedUser}
        loading={detailBusy || loadingDetail}
        onClose={() => {
          setSelectedUserId("");
          setSelectedUser(null);
          setDetailError("");
        }}
        onRefresh={refreshAfterAction}
        onBan={(reason) => runUserAction((id, r) => adminBanUser(id, r || "Policy violation"), reason)}
        onUnban={(reason) => runUserAction((id, r) => adminUnbanUser(id, r || "Lifted by admin"), reason)}
        onForceLogout={(reason) => runUserAction((id, r) => adminForceLogoutUser(id, r || "Security review"), reason)}
        onSoftDelete={(reason) => runUserAction((id, r) => adminSoftDeleteUser(id, r || "Admin action"), reason)}
      />
    </div>
  );
}
