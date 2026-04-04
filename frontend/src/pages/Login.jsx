import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import QRCode from "qrcode";

import { login as loginApi, verifyLoginChallenge } from "../api";
import AuthPasswordField from "../components/AuthPasswordField";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [qrError, setQrError] = useState("");
  const returnToRaw = new URLSearchParams(location.search).get("returnTo") || "";
  const returnTo = returnToRaw.startsWith("/") ? returnToRaw : "/home";

  useEffect(() => {
    let cancelled = false;

    const generateQr = async () => {
      if (challenge?.purpose !== "mfa_setup" || !challenge?.setup?.otpauthUrl) {
        setQrCodeUrl("");
        setQrError("");
        return;
      }

      try {
        const dataUrl = await QRCode.toDataURL(challenge.setup.otpauthUrl, {
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
  }, [challenge]);

  if (user) {
    return <Navigate to={returnTo} replace />;
  }

  const handleLogin = async (event) => {
    event.preventDefault();
    if (!email || !password) {
      toast.error("Email and password are required");
      return;
    }

    setLoading(true);
    try {
      const payload = await loginApi(email, password);
      if (payload?.challengeRequired && payload?.challenge) {
        setChallenge(payload.challenge);
        setVerificationCode("");
        toast.success(
          payload.challenge.method === "email"
            ? "We sent a verification code to your email."
            : "Enter the code from your authenticator app."
        );
        return;
      }

      if (payload?.token && payload?.user) {
        login(payload.token, payload.user, payload.sessionId);
        toast.success("Welcome back");
        navigate(returnTo, { replace: true });
        return;
      }

      toast.error(payload?.error || "Invalid credentials");
    } catch (err) {
      toast.error(err?.message || "Server connection failed");
    } finally {
      setLoading(false);
    }
  };

  const handleChallengeSubmit = async (event) => {
    event.preventDefault();
    if (!challenge?.token || !verificationCode.trim()) {
      toast.error("Enter your authentication code");
      return;
    }

    setLoading(true);
    try {
      const payload = await verifyLoginChallenge({
        challengeToken: challenge.token,
        code: verificationCode.trim(),
      });
      if (payload?.token && payload?.user) {
        login(payload.token, payload.user, payload.sessionId);
        toast.success("Login verified");
        navigate(returnTo, { replace: true });
        return;
      }
      toast.error("Verification failed");
    } catch (err) {
      toast.error(err?.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container login-container--welcome">
      <div className="login-left login-left--welcome">
        <div className="login-left-content">
          <div className="login-logo-section login-logo-section--welcome">
            <div className="login-logo">
              <img
                src="/tengacion_logo_512.png"
                alt="Tengacion"
                style={{ width: 60, height: 60 }}
              />
            </div>
            <div className="login-hero-copy">
              <h1 className="login-title">Tengacion</h1>
              <p className="login-subtitle">Connect with friends and family members</p>
            </div>
          </div>

          <div className="login-features login-features--welcome">
            <div className="feature-item">
              <span className="feature-item-accent" aria-hidden="true"></span>
              <div className="feature-item-copy">
                <p>Share moments with your friends</p>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-item-accent" aria-hidden="true"></span>
              <div className="feature-item-copy">
                <p>Chat and stay connected</p>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-item-accent" aria-hidden="true"></span>
              <div className="feature-item-copy">
                <p>Build your community</p>
              </div>
            </div>
            <div className="feature-item">
              <span className="feature-item-accent" aria-hidden="true"></span>
              <div className="feature-item-copy">
                <p>Discover amazing stories</p>
              </div>
            </div>
          </div>

          <div className="login-hero-orbit" aria-hidden="true">
            <span className="login-hero-orbit__core"></span>
            <span className="login-hero-orbit__ring login-hero-orbit__ring--one"></span>
            <span className="login-hero-orbit__ring login-hero-orbit__ring--two"></span>
          </div>
        </div>
      </div>

      <div className="login-right login-right--welcome">
        <form
          className="login-box login-box--welcome"
          onSubmit={challenge ? handleChallengeSubmit : handleLogin}
        >
          <h2>Log In</h2>

          {challenge ? (
            <div className="account-note-card login-challenge-card">
              <strong>
                {challenge.purpose === "mfa_setup"
                  ? "Set up your authenticator app"
                  : "Finish sign-in"}
              </strong>
              <p>
                {challenge.purpose === "mfa_setup"
                  ? "Admin accounts must enable two-factor authentication before login completes."
                  : challenge.method === "email"
                    ? `Enter the code sent to ${challenge.maskedEmail || "your email"}.`
                    : "Open your authenticator app and enter the current 6-digit code."}
              </p>
              {challenge.purpose === "mfa_setup" ? (
                <div className="auth-qr-wrap">
                  {qrCodeUrl ? (
                    <img
                      src={qrCodeUrl}
                      alt="Scan this QR code with your authenticator app"
                      className="auth-qr-image"
                    />
                  ) : (
                    <div className="auth-qr-placeholder">
                      {qrError || "Generating QR code..."}
                    </div>
                  )}
                </div>
              ) : null}
              {challenge.setup?.secret ? (
                <p className="account-inline-message">
                  Manual key: {challenge.setup.secret}
                </p>
              ) : null}
              {challenge.purpose === "mfa_setup" ? (
                <p className="account-inline-message">
                  In Google Authenticator, tap <strong>Scan a QR code</strong>. If scanning does
                  not work, choose <strong>Enter a setup key</strong> and paste the manual key.
                </p>
              ) : null}
              {Array.isArray(challenge.riskReasons) && challenge.riskReasons.length > 0 ? (
                <p className="account-inline-message">
                  Risk checks: {challenge.riskReasons.join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}

          {!challenge ? (
            <>
              <div className="form-group">
                <input
                  type="email"
                  placeholder="Email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={loading}
                  required
                  className="login-input"
                />
              </div>

              <div className="form-group">
                <AuthPasswordField
                  placeholder="Password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={loading}
                  required
                  className="login-input"
                  autoComplete="current-password"
                  name="password"
                />
              </div>
            </>
          ) : (
            <div className="form-group">
              <input
                type="text"
                placeholder="6-digit code"
                value={verificationCode}
                onChange={(event) => setVerificationCode(event.target.value)}
                disabled={loading}
                required
                className="login-input"
                inputMode="numeric"
                autoComplete="one-time-code"
              />
            </div>
          )}

          <button type="submit" disabled={loading} className="login-btn">
            {loading ? (
              <>
                <span className="spinner-mini"></span>
                {challenge ? "Verifying..." : "Logging in..."}
              </>
            ) : challenge ? (
              "Verify and continue"
            ) : (
              "Log In"
            )}
          </button>

          {challenge ? (
            <button
              type="button"
              onClick={() => {
                setChallenge(null);
                setVerificationCode("");
              }}
              className="signup-btn"
              disabled={loading}
            >
              Back to password login
            </button>
          ) : (
            <>
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
            </>
          )}

          <Link to="/forgot-password" className="forgot-password">
            Forgot password?
          </Link>
          <div className="login-footer-links">
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/community-guidelines">Guidelines</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
