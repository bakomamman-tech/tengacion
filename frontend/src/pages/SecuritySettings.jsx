import { useEffect, useState } from "react";

import QuickAccessLayout from "../components/QuickAccessLayout";
import {
  changePassword,
  confirmMfaSetup,
  disableMfa,
  getMfaStatus,
  listSessions,
  logoutAllSessions,
  requestVerifyEmail,
  revokeSession,
  startMfaSetup,
  verifyStepUp,
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
  const [mfa, setMfa] = useState({ enabled: false, method: "none", adminRequired: false });
  const [setupState, setSetupState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ oldPassword: "", newPassword: "" });
  const [stepUpCode, setStepUpCode] = useState("");
  const [disableState, setDisableState] = useState({ password: "", code: "" });
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

  const loadMfa = async () => {
    const payload = await getMfaStatus();
    setMfa(payload || { enabled: false, method: "none", adminRequired: false });
  };

  useEffect(() => {
    loadSessions().catch(() => setSessions([]));
    loadMfa().catch(() => setMfa({ enabled: false, method: "none", adminRequired: false }));
  }, []);

  const verifyCurrentStepUp = async () => {
    if (!stepUpCode.trim()) {
      setMessage("Enter the authenticator code to re-verify this session.");
      return false;
    }
    try {
      await verifyStepUp(stepUpCode.trim());
      setMessage("Security verification refreshed.");
      setStepUpCode("");
      return true;
    } catch (err) {
      setMessage(err?.message || "Step-up verification failed");
      return false;
    }
  };

  const submitPasswordChange = async (event) => {
    event.preventDefault();
    setMessage("");
    try {
      if (mfa?.enabled && stepUpCode.trim()) {
        const ok = await verifyCurrentStepUp();
        if (!ok) {
          return;
        }
      }
      await changePassword(form);
      setMessage("Password changed. Please sign in again.");
      setForm({ oldPassword: "", newPassword: "" });
      await loadSessions();
    } catch (err) {
      setMessage(err?.message || "Failed to change password");
    }
  };

  const startSetup = async () => {
    setMessage("");
    try {
      const payload = await startMfaSetup();
      setSetupState(payload);
      setMessage("Authenticator setup started. Add the key below, then verify a code.");
    } catch (err) {
      setMessage(err?.message || "Failed to start MFA setup");
    }
  };

  const verifySetup = async () => {
    setMessage("");
    try {
      await confirmMfaSetup(setupState?.code || "");
      setSetupState(null);
      await loadMfa();
      setMessage("Two-factor authentication is now enabled.");
    } catch (err) {
      setMessage(err?.message || "Failed to verify MFA setup");
    }
  };

  const disableCurrentMfa = async () => {
    setMessage("");
    try {
      await disableMfa(disableState);
      setDisableState({ password: "", code: "" });
      await loadMfa();
      setMessage("Two-factor authentication was disabled.");
    } catch (err) {
      setMessage(err?.message || "Failed to disable MFA");
    }
  };

  return (
    <QuickAccessLayout
      user={user}
      title="Security Settings"
      subtitle="Manage password changes, verified email status, two-factor protection, and active sessions."
    >
      <SectionCard title="Verification & password">
        {!user?.emailVerified ? (
          <div className="account-note-card">
            <strong>Your email is not verified.</strong>
            <p>Verify it to strengthen account recovery and suspicious-login protection.</p>
            <button
              type="button"
              onClick={() =>
                requestVerifyEmail().then(() => setMessage("Verification email sent."))
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

        {mfa?.enabled ? (
          <div className="account-note-card">
            <strong>Authenticator app enabled</strong>
            <p>
              Your account requires a TOTP code for sensitive actions and risky logins.
            </p>
          </div>
        ) : (
          <div className="account-note-card">
            <strong>Two-factor authentication is off</strong>
            <p>
              Turn it on to protect new-device logins and administrative actions.
            </p>
            <button type="button" onClick={startSetup}>
              Set up authenticator app
            </button>
          </div>
        )}

        {setupState ? (
          <div className="account-form-grid" style={{ marginBottom: 18 }}>
            <label>
              Manual key
              <input className="account-input" value={setupState.secret || ""} readOnly />
            </label>
            <label>
              Authenticator code
              <input
                className="account-input"
                value={setupState.code || ""}
                onChange={(event) =>
                  setSetupState((current) => ({ ...(current || {}), code: event.target.value }))
                }
                placeholder="Enter 6-digit code"
                inputMode="numeric"
              />
            </label>
            <div className="account-button-row">
              <button type="button" onClick={verifySetup}>
                Verify and enable
              </button>
            </div>
          </div>
        ) : null}

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

          {mfa?.enabled ? (
            <label>
              Re-verify this session
              <input
                className="account-input"
                type="text"
                value={stepUpCode}
                onChange={(event) => setStepUpCode(event.target.value)}
                placeholder="Authenticator code"
                inputMode="numeric"
              />
            </label>
          ) : null}

          <div className="account-button-row">
            <button type="submit">Update password</button>
            {mfa?.enabled ? (
              <button type="button" onClick={verifyCurrentStepUp}>
                Verify session
              </button>
            ) : null}
            {message ? <span className="account-inline-message">{message}</span> : null}
          </div>
        </form>

        {mfa?.enabled ? (
          <div className="account-form-grid" style={{ marginTop: 18 }}>
            <label>
              Current password
              <input
                className="account-input"
                type="password"
                value={disableState.password}
                onChange={(event) =>
                  setDisableState((prev) => ({ ...prev, password: event.target.value }))
                }
                placeholder="Current password"
              />
            </label>
            <label>
              Authenticator code
              <input
                className="account-input"
                type="text"
                value={disableState.code}
                onChange={(event) =>
                  setDisableState((prev) => ({ ...prev, code: event.target.value }))
                }
                placeholder="Authenticator code"
                inputMode="numeric"
              />
            </label>
            <div className="account-button-row">
              <button type="button" onClick={disableCurrentMfa}>
                Disable authenticator app
              </button>
            </div>
          </div>
        ) : null}
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
              <span>
                {entry.city || entry.country
                  ? `${entry.city || "Unknown city"}, ${entry.country || "Unknown country"}`
                  : `IP: ${entry.ip || "-"}`
                }
              </span>
              <span>
                Last seen:{" "}
                {entry.lastSeenAt ? new Date(entry.lastSeenAt).toLocaleString() : "-"}
              </span>
              <button
                type="button"
                onClick={() => revokeSession(entry.sessionId).then(loadSessions)}
              >
                Revoke session
              </button>
            </article>
          ))}
          {sessions.length === 0 ? <p className="quick-empty">No active sessions.</p> : null}
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
