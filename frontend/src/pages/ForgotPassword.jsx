import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    try {
      const res = await forgotPassword(email);
      setMessage(res?.message || "If the email exists, a reset link has been sent.");
    } catch (err) {
      setMessage(err?.message || "Failed to send reset link");
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
          <h2>Forgot password</h2>
          <input
            type="email"
            className="login-input"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button type="submit" className="login-btn">Send reset link</button>
            {message ? <p className="login-status-message">{message}</p> : null}
            <Link to="/login" className="register-login-link">Back to login</Link>
          </form>
        </div>
      </div>
    </div>
  );
}
