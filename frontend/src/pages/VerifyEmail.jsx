import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { confirmVerifyEmail } from "../api";

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get("token") || "", [params]);
  const [message, setMessage] = useState("Verifying...");

  useEffect(() => {
    if (!token) {
      setMessage("Missing verification token.");
      return;
    }
    confirmVerifyEmail(token)
      .then(() => setMessage("Email verified successfully."))
      .catch((err) => setMessage(err?.message || "Verification failed."));
  }, [token]);

  return (
    <div className="login-container">
      <div className="login-right" style={{ width: "100%" }}>
        <div className="login-box">
          <h2>Verify email</h2>
          <p>{message}</p>
          <Link to="/login">Continue to login</Link>
        </div>
      </div>
    </div>
  );
}
