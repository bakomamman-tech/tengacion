import { useEffect, useState } from "react";
import { changePassword, listSessions, logoutAllSessions, requestVerifyEmail, revokeSession } from "../api";
import { useAuth } from "../context/AuthContext";

export default function SecuritySettings() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ oldPassword: "", newPassword: "" });
  const [message, setMessage] = useState("");

  const loadSessions = async () => {
    try {
      setLoading(true);
      const payload = await listSessions();
      setSessions(Array.isArray(payload?.data) ? payload.data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions().catch(() => setSessions([]));
  }, []);

  const submitPasswordChange = async (event) => {
    event.preventDefault();
    setMessage("");
    try {
      await changePassword(form);
      setMessage("Password changed. Please log in again on other devices.");
      setForm({ oldPassword: "", newPassword: "" });
      await loadSessions();
    } catch (err) {
      setMessage(err?.message || "Failed to change password");
    }
  };

  return (
    <div className="app-shell">
      <main className="feed" style={{ maxWidth: 820, margin: "0 auto", padding: 20, display: "grid", gap: 14 }}>
        <section className="card" style={{ padding: 14 }}>
          <h2 style={{ marginTop: 0 }}>Security</h2>
          {!user?.emailVerified ? (
            <div className="card" style={{ padding: 10, marginBottom: 10 }}>
              <p style={{ marginTop: 0 }}>Your email is not verified.</p>
              <button type="button" onClick={() => requestVerifyEmail().then(() => setMessage("Verification email sent."))}>
                Send verification email
              </button>
            </div>
          ) : (
            <p>Email verified.</p>
          )}

          <form onSubmit={submitPasswordChange} style={{ display: "grid", gap: 8 }}>
            <h3 style={{ marginBottom: 0 }}>Change password</h3>
            <input
              type="password"
              placeholder="Current password"
              value={form.oldPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, oldPassword: event.target.value }))}
            />
            <input
              type="password"
              placeholder="New password"
              value={form.newPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, newPassword: event.target.value }))}
            />
            <button type="submit">Update password</button>
          </form>
          {message ? <p>{message}</p> : null}
        </section>

        <section className="card" style={{ padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>Active sessions</h3>
            <button type="button" onClick={() => loadSessions()} disabled={loading}>
              Refresh
            </button>
          </div>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {sessions.map((entry) => (
              <article key={entry.sessionId} className="card" style={{ padding: 10 }}>
                <div><b>{entry.deviceName || "Device"}</b></div>
                <div>{entry.userAgent || "Unknown browser"}</div>
                <div>IP: {entry.ip || "-"}</div>
                <div>Last seen: {entry.lastSeenAt ? new Date(entry.lastSeenAt).toLocaleString() : "-"}</div>
                <button type="button" onClick={() => revokeSession(entry.sessionId).then(loadSessions)}>
                  Revoke
                </button>
              </article>
            ))}
            {sessions.length === 0 ? <p>No active sessions.</p> : null}
          </div>
          <button type="button" onClick={() => logoutAllSessions().then(loadSessions)} style={{ marginTop: 10 }}>
            Log out all other devices
          </button>
        </section>
      </main>
    </div>
  );
}
