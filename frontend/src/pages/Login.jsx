import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { login as loginApi } from "../api";
import AuthPasswordField from "../components/AuthPasswordField";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const returnToRaw = new URLSearchParams(location.search).get("returnTo") || "";
  const returnTo = returnToRaw.startsWith("/") ? returnToRaw : "/home";

  // 🔐 Already logged in → go home
  const token = localStorage.getItem("token");
  if (token) {
    return <Navigate to={returnTo} replace />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Email and password are required");
      return;
    }

    setLoading(true);

    try {
      const res = await loginApi(email, password);

      if (res?.token && res?.user) {
        toast.success("Welcome back 👋");
        login(res.token, res.user);
        // Navigate immediately after login succeeds
        navigate(returnTo, { replace: true });
      } else {
        toast.error(res?.error || "Invalid credentials");
        setLoading(false);
      }
    } catch {
      toast.error("Server connection failed");
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* LEFT SIDE - BRANDING */}
      <div className="login-left">
        <div className="login-logo-section">
          <div className="login-logo">
            <img 
              src="/tengacion_logo_512.png" 
              alt="Tengacion" 
              style={{ width: 60, height: 60 }}
            />
          </div>
          <h1 className="login-title">Tengacion</h1>
          <p className="login-subtitle">Connect with friends and family members</p>
        </div>

        <div className="login-features">
          <div className="feature-item">
            <span className="feature-icon">📱</span>
            <p>Share moments with your friends</p>
          </div>
          <div className="feature-item">
            <span className="feature-icon">💬</span>
            <p>Chat and stay connected</p>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🌍</span>
            <p>Build your community</p>
          </div>
          <div className="feature-item">
            <span className="feature-icon">✨</span>
            <p>Discover amazing stories</p>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - FORM */}
      <div className="login-right">
        <form className="login-box" onSubmit={handleLogin}>
          <h2>Log In</h2>

          <div className="form-group">
            <input
              type="email"
              placeholder="Email or username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
              className="login-input"
            />
          </div>

          <div className="form-group">
            <AuthPasswordField
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
              className="login-input"
              autoComplete="current-password"
              name="password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="login-btn"
          >
            {loading ? (
              <>
                <span className="spinner-mini"></span>
                Logging in...
              </>
            ) : (
              "Log In"
            )}
          </button>

          <div className="login-divider">
            <span>or</span>
          </div>

          <button
            type="button"
            onClick={() => navigate("/register")}
            className="signup-btn"
            disabled={loading}
          >
            Create new account
          </button>

          <Link to="/forgot-password" className="forgot-password">Forgot password?</Link>
          <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/community-guidelines">Guidelines</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
