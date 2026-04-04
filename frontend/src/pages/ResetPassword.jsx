import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resetPassword } from "../api";
import AuthPasswordField from "../components/AuthPasswordField";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get("token") || "", [params]);
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    try {
      await resetPassword({ token, newPassword });
      setMessage("Password reset successful. You can now log in.");
    } catch (err) {
      setMessage(err?.message || "Failed to reset password");
    }
  };

  return (
    <div className="login-container login-container--compact">
      <div className="login-compact-shell">
        <div className="login-compact-brand">
          <div className="login-logo">
            <img
              src="/tengacion_logo_512.png"
              alt="Tengacion"
              style={{ width: 60, height: 60 }}
            />
          </div>
          <div className="login-logo-section">
            <h1 className="login-title">Tengacion</h1>
            <p className="login-subtitle">Connect with friends and family members</p>
          </div>
        </div>

        <div className="login-right login-right--full">
          <form className="login-box login-box--compact" onSubmit={submit}>
          <h2>Reset password</h2>
          <AuthPasswordField
            className="login-input"
            placeholder="New password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            name="new-password"
          />
          <button type="submit" className="login-btn">Reset password</button>
            {message ? <p className="login-status-message">{message}</p> : null}
            <Link to="/login" className="register-login-link">Back to login</Link>
          </form>
        </div>
      </div>
    </div>
  );
}
