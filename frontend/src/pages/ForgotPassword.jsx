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
    <div className="login-container">
      <div className="login-right" style={{ width: "100%" }}>
        <form className="login-box" onSubmit={submit}>
          <h2>Forgot password</h2>
          <input
            type="email"
            className="login-input"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button type="submit" className="login-btn">Send reset link</button>
          {message ? <p>{message}</p> : null}
          <Link to="/login">Back to login</Link>
        </form>
      </div>
    </div>
  );
}
