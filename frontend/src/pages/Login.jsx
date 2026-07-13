import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import QRCode from "qrcode";

import { login as loginApi, verifyLoginChallenge } from "../api";
import AuthPasswordField from "../components/AuthPasswordField";
import { useAuth } from "../context/AuthContext";
import "./login.css";

const LOGIN_FEATURES = [
  {
    icon: "moments",
    title: "Share moments with your friends",
    description: "Keep photos, updates, and everyday wins in one welcoming space.",
  },
  {
    icon: "message",
    title: "Chat and stay connected",
    description: "Continue conversations with the people who matter most.",
  },
  {
    icon: "community",
    title: "Build your community",
    description: "Find your people and grow spaces around shared interests.",
  },
  {
    icon: "discover",
    title: "Discover amazing stories",
    description: "Explore fresh voices, ideas, and stories selected for you.",
  },
];

function LoginIcon({ name }) {
  const commonProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    focusable: "false",
  };

  switch (name) {
    case "moments":
      return (
        <svg {...commonProps}>
          <path d="m12 3 1.2 3.4L16.5 8l-3.3 1.6L12 13l-1.2-3.4L7.5 8l3.3-1.6L12 3Z" />
          <path d="m18.5 13 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
          <path d="m5.5 14 .7 1.8 1.8.7-1.8.7L5.5 19l-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" />
        </svg>
      );
    case "message":
      return (
        <svg {...commonProps}>
          <path d="M20 14a4 4 0 0 1-4 4H9l-5 3v-7a4 4 0 0 1-1-2.6V8a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4v6Z" />
          <path d="M8 9h8M8 13h5" />
        </svg>
      );
    case "community":
      return (
        <svg {...commonProps}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 19v-1.5A4.5 4.5 0 0 1 8 13h2a4.5 4.5 0 0 1 4.5 4.5V19" />
          <path d="M15 5.2a3 3 0 0 1 0 5.6M16.5 13.3a4.5 4.5 0 0 1 4 4.5V19" />
        </svg>
      );
    case "discover":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="9" />
          <path d="m15.7 8.3-2.2 5.2-5.2 2.2 2.2-5.2 5.2-2.2Z" />
        </svg>
      );
    case "mail":
      return (
        <svg {...commonProps}>
          <rect x="3" y="5" width="18" height="14" rx="3" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      );
    case "lock":
      return (
        <svg {...commonProps}>
          <rect x="4" y="10" width="16" height="11" rx="3" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
        </svg>
      );
    case "key":
      return (
        <svg {...commonProps}>
          <circle cx="8" cy="15" r="4" />
          <path d="m11 12 8-8M15 8l2 2M17 6l2 2" />
        </svg>
      );
    case "shield":
      return (
        <svg {...commonProps}>
          <path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6l-7-3Z" />
          <path d="m9.2 12 1.8 1.8 3.8-4" />
        </svg>
      );
    case "help":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.7 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1.2.9-1.2 1.7M12 17h.01" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...commonProps}>
          <path d="M5 12h14M14 7l5 5-5 5" />
        </svg>
      );
    default:
      return null;
  }
}

const formatRetryDelay = (seconds = 0) => {
  const totalSeconds = Math.max(0, Number(seconds) || 0);
  if (!totalSeconds) {
    return "";
  }

  if (totalSeconds < 60) {
    return `${totalSeconds} second${totalSeconds === 1 ? "" : "s"}`;
  }

  const minutes = Math.ceil(totalSeconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
};

const getAuthErrorMessage = (error, fallbackMessage) => {
  const retryDelay = formatRetryDelay(error?.retryAfterSeconds);
  if (Number(error?.status) === 429 && retryDelay) {
    return `${error?.message || fallbackMessage} Try again in ${retryDelay}.`;
  }

  return error?.message || fallbackMessage;
};

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
      toast.error(getAuthErrorMessage(err, "Server connection failed"));
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
      toast.error(getAuthErrorMessage(err, "Verification failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-container login-container--luxury login-container--nature-green login-container--modern">
      <div className="login-modern-shell">
        <section className="login-left login-left--modern" aria-labelledby="login-welcome-title">
          <div className="login-hero-topline">
            <Link to="/" className="login-brand-link" aria-label="Tengacion home">
              <span className="login-brand-mark">
                <img src="/tengacion_logo_512.png" alt="" />
              </span>
              <span>Tengacion</span>
            </Link>
            <span className="login-privacy-badge">
              <LoginIcon name="shield" />
              Private &amp; secure
            </span>
          </div>

          <div className="login-hero-copy">
            <p className="login-hero-eyebrow">Welcome back to your world</p>
            <h1 id="login-welcome-title">Your people. Your stories. One familiar place.</h1>
            <p>
              Connect with friends and family members, share what matters, and keep every
              conversation close.
            </p>
          </div>

          <div className="login-features login-features--modern" aria-label="Tengacion highlights">
            {LOGIN_FEATURES.map((feature) => (
              <article className="login-feature-card" key={feature.title}>
                <span className="login-feature-icon">
                  <LoginIcon name={feature.icon} />
                </span>
                <div>
                  <h2>{feature.title}</h2>
                  <p>{feature.description}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="login-hero-footnote">
            <span className="login-hero-footnote__avatars" aria-hidden="true">
              <span>J</span>
              <span>A</span>
              <span>M</span>
            </span>
            <p>A thoughtful place to reconnect, discover, and belong.</p>
          </div>
        </section>

        <section className="login-right login-right--modern" aria-label="Sign in to Tengacion">
          <div className="login-right-stack">
            <form
              className="login-box login-box--modern"
              onSubmit={challenge ? handleChallengeSubmit : handleLogin}
              aria-labelledby="login-form-title"
              aria-describedby="login-form-description"
              aria-busy={loading}
            >
              <header className="login-card-header">
                <span className="login-card-mark">
                  <img src="/tengacion_logo_512.png" alt="" />
                </span>
                <div className="login-card-heading">
                  <p>{challenge ? "Security check" : "Welcome back"}</p>
                  <h2 id="login-form-title">
                    {challenge ? "Verify your sign-in" : "Log In"}
                  </h2>
                </div>
                <span className="login-card-secure">
                  <LoginIcon name="shield" />
                  Secure
                </span>
              </header>

              <p className="login-card-intro" id="login-form-description">
                {challenge
                  ? "Complete this quick check to continue to your account."
                  : "Enter your details to continue where you left off."}
              </p>

              {challenge ? (
                <div className="account-note-card login-challenge-card" role="status" aria-live="polite">
                  <span className="login-challenge-icon">
                    <LoginIcon name="shield" />
                  </span>
                  <div className="login-challenge-copy">
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
                      <p className="account-inline-message login-manual-key">
                        Manual key: <code>{challenge.setup.secret}</code>
                      </p>
                    ) : null}
                    {challenge.purpose === "mfa_setup" ? (
                      <p className="account-inline-message">
                        In Google Authenticator, tap <strong>Scan a QR code</strong>. If scanning
                        does not work, choose <strong>Enter a setup key</strong> and paste the
                        manual key.
                      </p>
                    ) : null}
                    {Array.isArray(challenge.riskReasons) && challenge.riskReasons.length > 0 ? (
                      <p className="account-inline-message">
                        Risk checks: {challenge.riskReasons.join(", ")}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {!challenge ? (
                <>
                  <div className="form-group login-form-group">
                    <label className="login-field-label" htmlFor="login-email">
                      Email
                    </label>
                    <div className="login-control">
                      <span className="login-control-icon">
                        <LoginIcon name="mail" />
                      </span>
                      <input
                        id="login-email"
                        type="email"
                        placeholder="you@example.com"
                        name="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        disabled={loading}
                        required
                        className="login-input login-input--with-icon"
                      />
                    </div>
                  </div>

                  <div className="form-group login-form-group">
                    <div className="login-field-heading">
                      <label className="login-field-label" htmlFor="login-password">
                        Password
                      </label>
                      <Link to="/forgot-password" className="login-field-action">
                        Forgot password?
                      </Link>
                    </div>
                    <div className="login-control login-control--password">
                      <span className="login-control-icon">
                        <LoginIcon name="lock" />
                      </span>
                      <AuthPasswordField
                        id="login-password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        disabled={loading}
                        required
                        className="login-input login-input--with-icon"
                        containerClassName="login-password-field"
                        autoComplete="current-password"
                        name="password"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="form-group login-form-group">
                  <label className="login-field-label" htmlFor="login-verification-code">
                    Verification code
                  </label>
                  <div className="login-control">
                    <span className="login-control-icon">
                      <LoginIcon name="key" />
                    </span>
                    <input
                      id="login-verification-code"
                      type="text"
                      placeholder="6-digit code"
                      name="verificationCode"
                      value={verificationCode}
                      onChange={(event) => setVerificationCode(event.target.value)}
                      disabled={loading}
                      required
                      className="login-input login-input--with-icon login-code-input"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                    />
                  </div>
                </div>
              )}

              <button type="submit" disabled={loading} className="login-btn login-primary-action">
                {loading ? (
                  <>
                    <span className="spinner-mini" />
                    {challenge ? "Verifying..." : "Logging in..."}
                  </>
                ) : (
                  <>
                    <span>{challenge ? "Verify and continue" : "Log In"}</span>
                    <LoginIcon name="arrow" />
                  </>
                )}
              </button>

              {challenge ? (
                <button
                  type="button"
                  onClick={() => {
                    setChallenge(null);
                    setVerificationCode("");
                  }}
                  className="signup-btn login-secondary-action"
                  disabled={loading}
                >
                  Back to password login
                </button>
              ) : (
                <>
                  <div className="login-divider login-divider--modern">
                    <span>New to Tengacion?</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate("/register")}
                    className="signup-btn login-secondary-action"
                    disabled={loading}
                  >
                    Create new account
                  </button>
                </>
              )}

              <nav className="login-footer-links login-footer-links--modern" aria-label="Tengacion policies">
                <Link to="/terms">Terms</Link>
                <Link to="/privacy">Privacy</Link>
                <Link to="/community-guidelines">Guidelines</Link>
              </nav>

              <p className="login-trust-note">
                <LoginIcon name="shield" />
                Your sign-in details are handled securely.
              </p>
            </form>

            <Link to="/developer-contact" className="developer-contact-cta login-support-cta">
              <span className="login-support-icon">
                <LoginIcon name="help" />
              </span>
              <span className="login-support-copy">
                <span className="login-support-kicker">Need help signing in?</span>
                <span className="developer-contact-cta__title">Contact Tengacion Support</span>
              </span>
              <span className="developer-contact-cta__arrow" aria-hidden="true">
                <LoginIcon name="arrow" />
              </span>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
