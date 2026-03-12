import { useEffect, useState } from "react";
import QRCode from "qrcode";

import QuickAccessLayout from "../components/QuickAccessLayout";
import {
  changePassword,
  confirmMfaSetup,
  enableEmailMfa,
  disableMfa,
  getMfaStatus,
  listSessions,
  logoutAllSessions,
  requestStepUpChallenge,
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

const maskEmail = (value = "") => {
  const [local, domain] = String(value || "").trim().split("@");
  if (!local || !domain) {
    return value;
  }
  return `${local.slice(0, 2)}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;
};

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
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [qrError, setQrError] = useState("");
  const [stepUpChallenge, setStepUpChallenge] = useState(null);

  const isEmailMfa = Boolean(mfa?.enabled && mfa?.method === "email");
  const isTotpMfa = Boolean(mfa?.enabled && mfa?.method === "totp");

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

  useEffect(() => {
    let cancelled = false;

    const generateQr = async () => {
      if (!setupState?.otpauthUrl) {
        setQrCodeUrl("");
        setQrError("");
        return;
      }

      try {
        const dataUrl = await QRCode.toDataURL(setupState.otpauthUrl, {
          width: 220,
          margin: 1,
          color: {
            dark: "#111827",
            light: "#FFFFFFFF",
          },
        });
        if (!cancelled) {
          setQrCodeUrl(dataUrl);
          setQrError("");
        }
      } catch {
        if (!cancelled) {
          setQrCodeUrl("");
          setQrError("We could not generate the QR code. Use the manual key below instead.");
        }
      }
    };

    generateQr();

    return () => {
      cancelled = true;
    };
  }, [setupState?.otpauthUrl]);

  const verifyCurrentStepUp = async () => {
    if (isEmailMfa) {
      if (!stepUpChallenge?.token) {
        setMessage("Send the email verification code first.");
        return false;
      }
      if (!stepUpCode.trim()) {
        setMessage("Enter the 6-digit code we sent to your email.");
        return false;
      }
      try {
        await verifyStepUp({
          challengeToken: stepUpChallenge.token,
          code: stepUpCode.trim(),
        });
        setMessage("Security verification refreshed.");
        setStepUpCode("");
        setStepUpChallenge(null);
        return true;
      } catch (err) {
        setMessage(err?.message || "Step-up verification failed");
        return false;
      }
    }

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

  const requestEmailStepUpCode = async () => {
    setMessage("");
    try {
      const payload = await requestStepUpChallenge();
      if (payload?.challengeRequired && payload?.challenge) {
        setStepUpChallenge(payload.challenge);
        setStepUpCode("");
        setMessage(
          `We sent a 6-digit security code to ${payload.challenge.maskedEmail || "your email"}.`
        );
        return;
      }
      setMessage("A verification code was requested.");
    } catch (err) {
      setMessage(err?.message || "Failed to send the email verification code");
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
      setMessage("Scan the QR code with your authenticator app, then enter the 6-digit code.");
    } catch (err) {
      setMessage(err?.message || "Failed to start MFA setup");
    }
  };

  const enableEmailCodeMfa = async () => {
    setMessage("");
    try {
      const payload = await enableEmailMfa();
      setSetupState(null);
      setStepUpChallenge(null);
      setStepUpCode("");
      await loadMfa();
      setMessage(payload?.message || "Email-code authentication is now enabled.");
    } catch (err) {
      setMessage(err?.message || "Failed to enable email-code authentication");
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
            <strong>
              {isEmailMfa ? "Email-code verification enabled" : "Authenticator app enabled"}
            </strong>
            <p>
              {isEmailMfa
                ? `Your account now sends a 6-digit verification code to ${maskEmail(
                    mfa?.email || user?.email || ""
                  )} for sign-in and sensitive actions.`
                : "Your account requires a TOTP code for sensitive actions and risky logins."}
            </p>
          </div>
        ) : (
          <div className="account-note-card">
            <strong>Two-factor authentication is off</strong>
            <p>
              Turn it on to protect new-device logins and sensitive actions.
            </p>
            <div className="account-button-row">
              <button type="button" onClick={startSetup}>
                Set up authenticator app
              </button>
              {!mfa?.adminRequired ? (
                <button
                  type="button"
                  onClick={enableEmailCodeMfa}
                  disabled={!user?.emailVerified}
                >
                  Use email code instead
                </button>
              ) : null}
            </div>
            {mfa?.adminRequired ? (
              <p className="account-inline-message">
                Admin accounts must use an authenticator app.
              </p>
            ) : !user?.emailVerified ? (
              <p className="account-inline-message">
                Verify your email first if you want to use email codes instead of an authenticator
                app.
              </p>
            ) : null}
          </div>
        )}

        {setupState ? (
          <div className="account-form-grid" style={{ marginBottom: 18 }}>
            <div className="account-note-card">
              <strong>Set up your authenticator app</strong>
              <p>
                Open Google Authenticator, Microsoft Authenticator, Authy, or
                another TOTP app, tap <strong>Add account</strong>, then scan this code.
              </p>
              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                {qrCodeUrl ? (
                  <img
                    src={qrCodeUrl}
                    alt="Scan this QR code with your authenticator app"
                    style={{
                      width: 220,
                      height: 220,
                      background: "#fff",
                      padding: 10,
                      borderRadius: 18,
                      border: "1px solid rgba(15, 23, 42, 0.08)",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 220,
                      minHeight: 220,
                      display: "grid",
                      placeItems: "center",
                      background: "#f8fafc",
                      borderRadius: 18,
                      border: "1px solid rgba(15, 23, 42, 0.08)",
                      padding: 18,
                      textAlign: "center",
                      color: "#475569",
                    }}
                  >
                    {qrError || "Generating QR code..."}
                  </div>
                )}
              </div>
            </div>

            <label>
              Manual key
              <input className="account-input" value={setupState.secret || ""} readOnly />
            </label>

            <p className="account-inline-message" style={{ marginTop: -4 }}>
              If scanning does not work, choose <strong>Enter setup key</strong> in the app and
              paste the manual key.
            </p>

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
                autoComplete="one-time-code"
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
                placeholder={isEmailMfa ? "Email verification code" : "Authenticator code"}
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
            {isEmailMfa ? (
              <button type="button" onClick={requestEmailStepUpCode}>
                Send email code
              </button>
            ) : null}
            {message ? <span className="account-inline-message">{message}</span> : null}
          </div>
          {isEmailMfa && stepUpChallenge?.maskedEmail ? (
            <p className="account-inline-message">
              Enter the code sent to {stepUpChallenge.maskedEmail}.
            </p>
          ) : null}
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
            {isTotpMfa ? (
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
            ) : (
              <div className="account-note-card">
                <strong>Email-code protection</strong>
                <p>
                  If this session is no longer recently verified, use the email-code
                  verification above before disabling two-factor authentication.
                </p>
              </div>
            )}
            <div className="account-button-row">
              <button type="button" onClick={disableCurrentMfa}>
                {isEmailMfa ? "Disable email-code verification" : "Disable authenticator app"}
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
