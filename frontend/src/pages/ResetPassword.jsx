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
    <div className="login-container">
      <div className="login-right" style={{ width: "100%" }}>
        <form className="login-box" onSubmit={submit}>
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
          {message ? <p>{message}</p> : null}
          <Link to="/login">Back to login</Link>
        </form>
      </div>
    </div>
  );
}
