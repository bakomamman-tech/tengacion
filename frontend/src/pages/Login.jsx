import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { login as loginApi } from "../api";

export default function Login({ setUser }) {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔐 Already logged in → go home
  const token = localStorage.getItem("token");
  if (token) {
    return <Navigate to="/home" replace />;
  }

  const handleLogin = async () => {
    if (!email || !password) {
      toast.error("Email and password are required");
      return;
    }

    setLoading(true);

    try {
      const res = await loginApi(email, password);

      if (res?.token && res?.user) {
        toast.success("Welcome back 👋");

        localStorage.setItem("token", res.token);
        setUser(res.user);

        navigate("/home", { replace: true });
      } else {
        toast.error(res?.error || "Invalid credentials");
      }
    } catch {
      toast.error("Server connection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "40px auto" }}>
      <h2>Login to Tengacion</h2>

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
