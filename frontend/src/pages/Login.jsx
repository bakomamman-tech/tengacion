import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { login as loginApi } from "../api";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔐 Already logged in → go home
  if (user) {
    return <Navigate to="/home" replace />;
  }

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await loginApi(email, password);

      if (res?.token && res?.user) {
        // ✅ Centralized auth handling
        login(res.token, res.user);

        // ✅ SPA navigation (no reload)
        navigate("/home", { replace: true });
      } else {
        setError(res?.error || "Invalid credentials");
      }
    } catch (err) {
      setError("Unable to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "40px auto" }}>
      <h2>Login to Tengacion</h2>

      {error && (
        <p style={{ color: "red", marginBottom: 10 }}>
          {error}
        </p>
      )}

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: "100%", marginBottom: 10 }}
        disabled={loading}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ width: "100%", marginBottom: 10 }}
        disabled={loading}
      />

      <button
        onClick={handleLogin}
        disabled={loading}
        style={{ width: "100%" }}
      >
        {loading ? "Logging in…" : "Login"}
      </button>

      <p style={{ marginTop: 12 }}>
        No account?{" "}
        <a href="/register">Register</a>
      </p>
    </div>
  );
}
