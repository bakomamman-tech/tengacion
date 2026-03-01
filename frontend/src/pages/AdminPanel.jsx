import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminBanUser,
  adminForceLogoutUser,
  adminGetAuditLogs,
  adminGetUser,
  adminListUsers,
  adminResetPasswordUser,
  adminSoftDeleteUser,
  adminUnbanUser,
  adminUpdateUser,
} from "../api";

const ROLE_OPTIONS = ["user", "artist", "moderator", "admin", "super_admin"];

export default function AdminPanel({ user }) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [bannedFilter, setBannedFilter] = useState("");
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [reasonByUser, setReasonByUser] = useState({});
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");

  const isSuperAdmin = useMemo(
    () => String(user?.role || "").toLowerCase() === "super_admin",
    [user?.role]
  );

  const userReason = (entry) => String(reasonByUser[entry._id] || "").trim();

  const loadUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      setError("");
      const res = await adminListUsers({
        search: query,
        role: roleFilter,
        banned: bannedFilter,
        page: 1,
        limit: 50,
      });
      const rows = Array.isArray(res?.users) ? res.users : [];
      setUsers(rows);
      if (!rows.some((entry) => entry._id === selectedUserId)) {
        setSelectedUserId(rows[0]?._id || "");
      }
    } catch (err) {
      setError(err?.message || "Failed to load users");
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, [bannedFilter, query, roleFilter, selectedUserId]);

  const loadLogs = useCallback(async () => {
    try {
      setLoadingLogs(true);
      const res = await adminGetAuditLogs({ page: 1, limit: 40 });
      setLogs(Array.isArray(res?.logs) ? res.logs : []);
    } catch {
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  const loadUserDetail = useCallback(async () => {
    if (!selectedUserId) {
      setSelectedUser(null);
      return;
    }
    try {
      setLoadingDetail(true);
      const res = await adminGetUser(selectedUserId);
      setSelectedUser(res || null);
    } catch {
      setSelectedUser(null);
    } finally {
      setLoadingDetail(false);
    }
  }, [selectedUserId]);

  useEffect(() => {
    loadUsers();
    loadLogs();
  }, [loadLogs, loadUsers]);

  useEffect(() => {
    loadUserDetail();
  }, [loadUserDetail]);

  const runAction = async (key, fn) => {
    setBusyKey(key);
    setError("");
    try {
      await fn();
      await Promise.all([loadUsers(), loadLogs(), loadUserDetail()]);
    } catch (err) {
      setError(err?.message || "Action failed");
    } finally {
      setBusyKey("");
    }
  };

  return (
    <div className="app-shell">
      <main className="feed" style={{ maxWidth: 1280, margin: "0 auto", padding: 20 }}>
        <section className="card" style={{ padding: 16, marginBottom: 14 }}>
          <h2 style={{ marginBottom: 10 }}>Admin Panel</h2>
          <p style={{ marginBottom: 8 }}>
            Signed in as <b>{user?.name || user?.username}</b> ({user?.role})
          </p>
          <p style={{ margin: 0, opacity: 0.8 }}>
            2FA scaffold is available in account data (`twoFactor.enabled`, `twoFactor.method`).
          </p>
        </section>

        {error ? (
          <section className="card" style={{ padding: 12, marginBottom: 14, color: "#b91c1c" }}>
            {error}
          </section>
        ) : null}

        <section style={{ display: "grid", gap: 14, gridTemplateColumns: "2fr 1fr", marginBottom: 14 }}>
          <article className="card" style={{ padding: 16 }}>
            <h3 style={{ marginBottom: 10 }}>Users</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name / username / email"
                style={{ minWidth: 260 }}
              />
              <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                <option value="">All roles</option>
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <select value={bannedFilter} onChange={(event) => setBannedFilter(event.target.value)}>
                <option value="">Any ban state</option>
                <option value="true">Banned</option>
                <option value="false">Not banned</option>
              </select>
              <button type="button" onClick={loadUsers}>
                Search
              </button>
            </div>

            {loadingUsers ? <p>Loading users...</p> : null}
            {!loadingUsers && (
              <div style={{ display: "grid", gap: 10 }}>
                {users.map((entry) => {
                  const keyPrefix = entry._id;
                  const reason = userReason(entry);
                  const selected = selectedUserId === entry._id;
                  return (
                    <article
                      key={entry._id}
                      className="card"
                      style={{
                        padding: 12,
                        border: selected ? "1px solid rgba(184,122,58,0.6)" : undefined,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                        <button
                          type="button"
                          onClick={() => setSelectedUserId(entry._id)}
                          style={{
                            background: "transparent",
                            border: 0,
                            textAlign: "left",
                            color: "inherit",
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          <b>{entry.name || entry.username}</b> @{entry.username}
                          <div>{entry.email}</div>
                          <div style={{ opacity: 0.78 }}>
                            role={entry.role} | banned={String(entry.isBanned)} | deleted={String(entry.isDeleted)}
                          </div>
                        </button>

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          <input
                            placeholder="Reason"
                            value={reasonByUser[entry._id] || ""}
                            onChange={(event) =>
                              setReasonByUser((prev) => ({ ...prev, [entry._id]: event.target.value }))
                            }
                            style={{ minWidth: 150 }}
                          />
                          {entry.isBanned ? (
                            <button
                              type="button"
                              onClick={() =>
                                runAction(`unban:${keyPrefix}`, () => adminUnbanUser(entry._id, reason))
                              }
                              disabled={busyKey === `unban:${keyPrefix}`}
                            >
                              Unban
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                runAction(`ban:${keyPrefix}`, () =>
                                  adminBanUser(entry._id, reason || "Policy violation")
                                )
                              }
                              disabled={busyKey === `ban:${keyPrefix}`}
                            >
                              Ban
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              runAction(`logout:${keyPrefix}`, () => adminForceLogoutUser(entry._id, reason))
                            }
                            disabled={busyKey === `logout:${keyPrefix}`}
                          >
                            Force logout
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              runAction(`reset:${keyPrefix}`, () => adminResetPasswordUser(entry._id, reason))
                            }
                            disabled={busyKey === `reset:${keyPrefix}`}
                          >
                            Force reset
                          </button>
                          {isSuperAdmin ? (
                            <select
                              value={entry.role}
                              onChange={(event) =>
                                runAction(`role:${keyPrefix}`, () =>
                                  adminUpdateUser(entry._id, { role: event.target.value, reason })
                                )
                              }
                              disabled={busyKey === `role:${keyPrefix}`}
                            >
                              {ROLE_OPTIONS.map((role) => (
                                <option key={role} value={role}>
                                  {role}
                                </option>
                              ))}
                            </select>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              if (!window.confirm(`Soft delete @${entry.username}?`)) {
                                return;
                              }
                              runAction(`delete:${keyPrefix}`, () => adminSoftDeleteUser(entry._id, reason));
                            }}
                            disabled={busyKey === `delete:${keyPrefix}`}
                          >
                            Soft delete
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
                {users.length === 0 ? <p>No users matched your filters.</p> : null}
              </div>
            )}
          </article>

          <article className="card" style={{ padding: 16 }}>
            <h3 style={{ marginBottom: 10 }}>User Detail</h3>
            {loadingDetail ? <p>Loading details...</p> : null}
            {!loadingDetail && !selectedUser ? <p>Select a user to inspect.</p> : null}
            {!loadingDetail && selectedUser ? (
              <div style={{ display: "grid", gap: 8 }}>
                <div>
                  <b>{selectedUser.name || selectedUser.username}</b> @{selectedUser.username}
                </div>
                <div>{selectedUser.email}</div>
                <div>Role: {selectedUser.role}</div>
                <div>Active: {String(selectedUser.isActive)}</div>
                <div>Banned: {String(selectedUser.isBanned)}</div>
                <div>Deleted: {String(selectedUser.isDeleted)}</div>
                <div>2FA: {selectedUser?.twoFactor?.enabled ? selectedUser?.twoFactor?.method : "disabled"}</div>
                <div>Created: {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleString() : "-"}</div>
                <div>Updated: {selectedUser.updatedAt ? new Date(selectedUser.updatedAt).toLocaleString() : "-"}</div>
              </div>
            ) : null}
          </article>
        </section>

        <section className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>Audit Logs</h3>
            <button type="button" onClick={loadLogs}>
              Refresh logs
            </button>
          </div>
          {loadingLogs ? <p style={{ marginTop: 10 }}>Loading audit logs...</p> : null}
          {!loadingLogs && (
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              {logs.map((entry) => (
                <article key={entry._id} className="card" style={{ padding: 10 }}>
                  <b>{entry.action}</b> - {entry.targetType} {entry.targetId}
                  <div>
                    by @{entry.actor?.username || "unknown"} - {new Date(entry.createdAt).toLocaleString()}
                  </div>
                  {entry.reason ? <div>reason: {entry.reason}</div> : null}
                </article>
              ))}
              {logs.length === 0 ? <p>No logs yet.</p> : null}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
