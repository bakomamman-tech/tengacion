import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import toast from "react-hot-toast";

import {
  joinKadahive,
  login as loginApi,
  register as registerApi,
  verifyLoginChallenge,
} from "../../api";
import AuthPasswordField from "../../components/AuthPasswordField";
import { useAuth } from "../../context/AuthContext";
import KadahiveBrand from "./KadahiveBrand";
import "./kadahive.css";

const fieldError = (error, fallback) => error?.message || error?.payload?.error || fallback;

export default function KadahiveAuthPage({ mode = "login" }) {
  const isRegister = mode === "register";
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    phone: "+234",
    dob: "",
    password: "",
    confirmPassword: "",
  });
  const returnToRaw = new URLSearchParams(location.search).get("returnTo") || "";
  const returnTo = returnToRaw.startsWith("/kadahive") ? returnToRaw : "/kadahive/portal";

  useEffect(() => {
    let cancelled = false;
    if (challenge?.purpose !== "mfa_setup" || !challenge?.setup?.otpauthUrl) {
      setQrCodeUrl("");
      return undefined;
    }
    QRCode.toDataURL(challenge.setup.otpauthUrl, {
      width: 196,
      margin: 1,
      color: { dark: "#051d37", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) {
          setQrCodeUrl(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrCodeUrl("");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [challenge]);

  const title = useMemo(() => {
    if (challenge) {
      return "Secure your sign-in";
    }
    return isRegister ? "Create your member account" : "Welcome back to the hive";
  }, [challenge, isRegister]);

  if (user) {
    return <Navigate to={returnTo} replace />;
  }

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const finishAuthentication = async (payload, successMessage) => {
    if (!payload?.token || !payload?.user) {
      throw new Error("Authentication did not return an active session");
    }
    try {
      await joinKadahive();
    } catch (error) {
      if (Number(error?.status) !== 409) {
        throw error;
      }
    }
    login(payload.token, payload.user, payload.sessionId);
    toast.success(successMessage);
    navigate(returnTo, { replace: true });
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    if (!form.email || !form.password) {
      toast.error("Enter your email address and password");
      return;
    }
    setLoading(true);
    try {
      const payload = await loginApi(form.email, form.password);
      if (payload?.challengeRequired && payload?.challenge) {
        setChallenge(payload.challenge);
        setVerificationCode("");
        toast.success(
          payload.challenge.method === "email"
            ? "A verification code was sent to your email."
            : "Enter the code from your authenticator app."
        );
      } else {
        await finishAuthentication(payload, "Welcome back to Kadahive");
      }
    } catch (error) {
      toast.error(fieldError(error, "Unable to sign in"));
    } finally {
      setLoading(false);
    }
  };

  const handleChallenge = async (event) => {
    event.preventDefault();
    if (!verificationCode.trim()) {
      toast.error("Enter your verification code");
      return;
    }
    setLoading(true);
    try {
      const payload = await verifyLoginChallenge({
        challengeToken: challenge?.token,
        code: verificationCode.trim(),
      });
      await finishAuthentication(payload, "Your Kadahive session is ready");
    } catch (error) {
      toast.error(fieldError(error, "Verification failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (form.password.length < 8) {
      toast.error("Use at least 8 characters for your password");
      return;
    }
    setLoading(true);
    try {
      const payload = await registerApi({
        name: form.name,
        username: form.username,
        email: form.email,
        phone: form.phone,
        country: "Nigeria",
        stateOfOrigin: "Kaduna",
        dob: form.dob,
        password: form.password,
        institutionSlug: "kadahive",
      });
      await finishAuthentication(payload, "Your Kadahive membership is ready");
    } catch (error) {
      toast.error(fieldError(error, "Unable to create your account"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="kh-auth">
      <section className="kh-auth__story">
        <img
          src="/assets/kadahive/kadahive-community-coworking.png"
          alt="Kadahive members building together"
          decoding="async"
        />
        <div className="kh-auth__story-veil" />
        <div className="kh-auth__story-content">
          <KadahiveBrand />
          <div>
            <span className="kh-auth__eyebrow">One account. One growing community.</span>
            <h1>Make room for the idea you cannot stop thinking about.</h1>
            <p>
              Join founders, developers, creatives and learners building from Kaduna to the
              world.
            </p>
          </div>
          <div className="kh-auth__story-proof">
            <span>
              <strong>500+</strong>
              Active community
            </span>
            <span>
              <strong>120+</strong>
              Ventures supported
            </span>
          </div>
        </div>
      </section>

      <section className="kh-auth__panel">
        <div className="kh-auth__mobile-brand">
          <KadahiveBrand />
        </div>
        <Link className="kh-auth__back" to="/kadahive">
          ← Back to Kadahive
        </Link>
        <div className="kh-auth__form-wrap">
          <span className="kh-auth__label">
            {challenge ? "Identity check" : isRegister ? "Member registration" : "Member access"}
          </span>
          <h2>{title}</h2>
          <p className="kh-auth__intro">
            {challenge
              ? "Complete this security step to continue."
              : isRegister
                ? "Your Kadahive profile also works across Tengacion."
                : "Use your Kadahive or Tengacion account details."}
          </p>

          {challenge ? (
            <form className="kh-auth-form" onSubmit={handleChallenge}>
              {challenge.purpose === "mfa_setup" ? (
                <div className="kh-auth-challenge">
                  <strong>Set up two-factor authentication</strong>
                  <p>Scan this code with your authenticator app, then enter the 6-digit code.</p>
                  {qrCodeUrl ? <img src={qrCodeUrl} alt="Authenticator setup QR code" /> : null}
                  {challenge.setup?.secret ? (
                    <code>Manual key: {challenge.setup.secret}</code>
                  ) : null}
                </div>
              ) : (
                <div className="kh-auth-challenge">
                  <strong>Confirm it&apos;s you</strong>
                  <p>
                    {challenge.method === "email"
                      ? `Enter the code sent to ${challenge.maskedEmail || "your email"}.`
                      : "Enter the current code from your authenticator app."}
                  </p>
                </div>
              )}
              <label>
                Verification code
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value)}
                  placeholder="6-digit code"
                  required
                />
              </label>
              <button className="kh-auth__submit" type="submit" disabled={loading}>
                {loading ? "Verifying…" : "Verify and continue"}
              </button>
              <button
                className="kh-auth__secondary"
                type="button"
                onClick={() => {
                  setChallenge(null);
                  setVerificationCode("");
                }}
              >
                Back to password
              </button>
            </form>
          ) : (
            <form
              className="kh-auth-form"
              onSubmit={isRegister ? handleRegister : handleLogin}
            >
              {isRegister ? (
                <div className="kh-auth-form__row">
                  <label>
                    Full name
                    <input
                      name="name"
                      value={form.name}
                      onChange={updateField}
                      autoComplete="name"
                      placeholder="Your full name"
                      required
                    />
                  </label>
                  <label>
                    Username
                    <input
                      name="username"
                      value={form.username}
                      onChange={updateField}
                      autoComplete="username"
                      placeholder="e.g. amina.builds"
                      minLength={3}
                      required
                    />
                  </label>
                </div>
              ) : null}

              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={updateField}
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
              </label>

              {isRegister ? (
                <div className="kh-auth-form__row">
                  <label>
                    Mobile number
                    <input
                      name="phone"
                      type="tel"
                      value={form.phone}
                      onChange={updateField}
                      autoComplete="tel"
                      placeholder="+234 800 000 0000"
                      required
                    />
                  </label>
                  <label>
                    Date of birth
                    <input
                      name="dob"
                      type="date"
                      value={form.dob}
                      onChange={updateField}
                      autoComplete="bday"
                      required
                    />
                  </label>
                </div>
              ) : null}

              <label>
                Password
                <AuthPasswordField
                  name="password"
                  value={form.password}
                  onChange={updateField}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  placeholder={isRegister ? "At least 8 characters" : "Your password"}
                  required
                />
              </label>

              {isRegister ? (
                <label>
                  Confirm password
                  <AuthPasswordField
                    name="confirmPassword"
                    value={form.confirmPassword}
                    onChange={updateField}
                    autoComplete="new-password"
                    placeholder="Repeat your password"
                    required
                  />
                </label>
              ) : null}

              {!isRegister ? (
                <Link className="kh-auth__forgot" to="/forgot-password">
                  Forgot your password?
                </Link>
              ) : null}

              <button className="kh-auth__submit" type="submit" disabled={loading}>
                {loading
                  ? isRegister
                    ? "Creating your account…"
                    : "Signing you in…"
                  : isRegister
                    ? "Create member account"
                    : "Sign in to Kadahive"}
              </button>
            </form>
          )}

          {!challenge ? (
            <p className="kh-auth__switch">
              {isRegister ? "Already part of Kadahive?" : "New to the community?"}{" "}
              <Link to={isRegister ? "/kadahive/login" : "/kadahive/register"}>
                {isRegister ? "Sign in" : "Create an account"}
              </Link>
            </p>
          ) : null}
          <p className="kh-auth__legal">
            By continuing, you agree to Tengacion&apos;s <Link to="/terms">Terms</Link> and{" "}
            <Link to="/privacy">Privacy Policy</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
