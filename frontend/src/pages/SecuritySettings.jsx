import { useEffect, useState } from "react";

import QuickAccessLayout from "../components/QuickAccessLayout";
import {
  changePassword,
  listSessions,
  logoutAllSessions,
  requestVerifyEmail,
  revokeSession,
} from "../api";
import { useAuth } from "../context/AuthContext";

function SectionCard({ title, action, children }) {
  return (
    <section className="card quick-section-card">
      <div className="quick-section-head">
        <h2>{title}</h2>
        {action || null}
      </div>
      {children}
    </section>
  );
}

export default function SecuritySettings({ user: currentUser }) {
  const { user: authUser } = useAuth();
  const user = currentUser || authUser;
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
    <QuickAccessLayout
      user={user}
      title="Security Settings"
      subtitle="Manage password changes, verified email status, and every device currently signed in to your account."
    >
      <SectionCard title="Verification & password">
        {!user?.emailVerified ? (
          <div className="account-note-card">
            <strong>Your email is not verified.</strong>
            <p>Verify it to strengthen account recovery and sign-in protection.</p>
            <button
              type="button"
              onClick={() =>
                requestVerifyEmail().then(() =>
                  setMessage("Verification email sent.")
                )
              }
            >
              Send verification email
            </button>
          </div>
        ) : (
          <div className="account-note-card">
            <strong>Email verified</strong>
            <p>Your account already has a verified email address.</p>
          </div>
        )}

        <form className="account-form-grid" onSubmit={submitPasswordChange}>
          <label>
            Current password
            <input
              className="account-input"
              type="password"
              value={form.oldPassword}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, oldPassword: event.target.value }))
              }
              placeholder="Enter current password"
            />
          </label>

          <label>
            New password
            <input
              className="account-input"
              type="password"
              value={form.newPassword}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, newPassword: event.target.value }))
              }
              placeholder="Enter new password"
            />
          </label>

          <div className="account-button-row">
            <button type="submit">Update password</button>
            {message ? <span className="account-inline-message">{message}</span> : null}
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Active sessions"
        action={
          <button type="button" onClick={() => loadSessions()} disabled={loading}>
            Refresh
          </button>
        }
      >
        <div className="quick-list-grid">
          {sessions.map((entry) => (
            <article key={entry.sessionId} className="quick-list-item">
              <strong>{entry.deviceName || "Device"}</strong>
              <span>{entry.userAgent || "Unknown browser"}</span>
              <span>IP: {entry.ip || "-"}</span>
              <span>
                Last seen:{" "}
                {entry.lastSeenAt
                  ? new Date(entry.lastSeenAt).toLocaleString()
                  : "-"}
              </span>
              <button
                type="button"
                onClick={() => revokeSession(entry.sessionId).then(loadSessions)}
              >
                Revoke session
              </button>
            </article>
          ))}
          {sessions.length === 0 ? (
            <p className="quick-empty">No active sessions.</p>
          ) : null}
        </div>

        <div className="account-button-row">
          <button type="button" onClick={() => logoutAllSessions().then(loadSessions)}>
            Log out all other devices
          </button>
        </div>
      </SectionCard>
    </QuickAccessLayout>
  );
}
