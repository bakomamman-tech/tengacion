import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import {
  login as loginApi,
  register as registerApi,
  requestRegistrationOtp,
  updateMe,
  verifyRegistrationOtp,
} from "../api";
import AuthPasswordField from "../components/AuthPasswordField";
import { useAuth } from "../context/AuthContext";
import {
  isValidInternationalPhoneNumber,
  normalizePhoneNumber,
} from "../utils/phone";
import "./AIProfessionalsKadunaPage.css";

const DIRECTORY_PATH = "/AI-Professionals-In-Kaduna-State";

const PROFESSIONALS = [
  {
    name: "Hajiya Asmau Abbass",
    role: "AI Ethics & Compliance Officer",
    company: "Asmau Computer Tech",
    image: "/ai-professionals-kaduna/portraits/asmau-abbass.jpg",
  },
  {
    name: "Dr. Abdulrahman Abdullahi",
    role: "AI Software Enterprise Architect",
    company: "Bayero Computer Solutions",
    image: "/ai-professionals-kaduna/portraits/abdulrahman-abdullahi.jpg",
  },
  {
    name: "Sheik Nazir Bashir Hassan",
    role: "Chief AI Officer (CAIO) & Head of AI",
    company: "Nazir AI Solutions",
    image: "/ai-professionals-kaduna/portraits/nazir-bashir-hassan.jpg",
  },
  {
    name: "Musab Ibrahim",
    role: "Computer Vision Specialist",
    company: "Musab Technologies Limited",
    image: "/ai-professionals-kaduna/portraits/musab-ibrahim.jpg",
  },
  {
    name: "Engr. David Caleb",
    role: "Director of AI Governance & Risk",
    company: "BOB-TECH Limited",
    image: "/ai-professionals-kaduna/portraits/david-caleb.jpg",
  },
  {
    name: "Hajiya Afnan Ibrahim",
    role: "Director of AI Product Management",
    company: "Afnan Communications Limited",
    image: "/ai-professionals-kaduna/portraits/afnan-ibrahim.jpg",
  },
  {
    name: "Dr. Abdulwahab Ibrahim",
    role: "Senior Lead AI Engineer",
    company: "Aldulwahab & Sons Tech Solutions",
    image: "/ai-professionals-kaduna/portraits/abdulwahab-ibrahim.jpg",
  },
  {
    name: "Alhaji Hassan Suleiman",
    role: "Senior AI Research Scientist",
    company: "Hassan Enterprise Solutions",
    image: "/ai-professionals-kaduna/portraits/hassan-suleiman.jpg",
  },
  {
    name: "Dr. Hanif Abdulsalam",
    role: "Senior Full Stack Developer",
    company: "Hanif Technologies Limited",
    image: "/ai-professionals-kaduna/portraits/hanif-abdulsalam.jpg",
  },
  {
    name: "Dr. Ittai Samuel",
    role: "Senior LLM & Natural Language Processing (NLP) Engineer",
    company: "Ittai Communications Limited",
    image: "/ai-professionals-kaduna/portraits/ittai-samuel.jpg",
  },
  {
    name: "Miss. Adele Samuel",
    role: "Senior MLOps & AI Reliability Engineer",
    company: "Adele And Sons Computer Enterprises",
    image: "/ai-professionals-kaduna/portraits/adele-samuel.jpg",
  },
];

const initialRegistration = {
  name: "",
  username: "",
  email: "",
  phone: "",
  dob: "",
  country: "Nigeria",
  stateOfOrigin: "Kaduna State",
  password: "",
  acceptedTerms: false,
};

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M14 7l5 5-5 5" />
    </svg>
  );
}

function Brand({ light = false }) {
  return (
    <Link className={`aik-brand${light ? " aik-brand--light" : ""}`} to="/">
      <img src="/tengacion_logo_512.png" alt="" />
      <span>
        <strong>Tengacion</strong>
        <small>Kaduna AI Directory</small>
      </span>
    </Link>
  );
}

const getAge = (dateValue) => {
  const birthDate = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) {
    return Number.NaN;
  }
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();
  if (
    monthDifference < 0
    || (monthDifference === 0 && today.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }
  return age;
};

const toDateInputValue = (value) => {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString().slice(0, 10);
};

const getMaximumDob = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 13);
  return date.toISOString().slice(0, 10);
};

function PrivacyNote() {
  return (
    <div className="aik-privacy-note">
      <LockIcon />
      <p>
        <strong>Your details stay private.</strong> Your phone number and date of birth help
        secure your Tengacion account and are never shown in this directory.
      </p>
    </div>
  );
}

function AccessPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [mode, setMode] = useState("register");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registration, setRegistration] = useState(initialRegistration);
  const [otp, setOtp] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setError("");
    setOtp("");
    setOtpRequested(false);
  };

  const updateRegistration = (field, value) => {
    setRegistration((current) => ({ ...current, [field]: value }));
  };

  const validateRegistration = () => {
    if (registration.name.trim().length < 3) {
      return "Enter your full name.";
    }
    if (!/^[a-zA-Z0-9._]{3,30}$/.test(registration.username.trim())) {
      return "Username must be 3–30 characters using letters, numbers, dots, or underscores.";
    }
    if (!/^\S+@\S+\.\S+$/.test(registration.email.trim())) {
      return "Enter a valid email address.";
    }
    if (!isValidInternationalPhoneNumber(registration.phone)) {
      return "Enter a valid international phone number, such as +234 800 000 0000.";
    }
    if (!registration.dob || !Number.isFinite(getAge(registration.dob))) {
      return "Enter a valid date of birth.";
    }
    if (getAge(registration.dob) < 13) {
      return "You must be at least 13 years old to create an account.";
    }
    if (!registration.country.trim() || !registration.stateOfOrigin.trim()) {
      return "Enter your country and state or region of origin.";
    }
    if (registration.password.length < 8) {
      return "Password must be at least 8 characters.";
    }
    if (!registration.acceptedTerms) {
      return "Accept the Terms and Privacy Policy to continue.";
    }
    return "";
  };

  const handleRequestOtp = async (event) => {
    event.preventDefault();
    const validationError = validateRegistration();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError("");
    try {
      await requestRegistrationOtp(registration.email);
      setOtpRequested(true);
      toast.success("Verification code sent");
    } catch (requestError) {
      setError(requestError?.message || "We could not send the verification code.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Enter the 6-digit verification code sent to your email.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await verifyRegistrationOtp({ email: registration.email, otp });
      const payload = await registerApi({
        name: registration.name.trim(),
        username: registration.username.trim().toLowerCase(),
        email: registration.email.trim().toLowerCase(),
        phone: normalizePhoneNumber(registration.phone),
        dob: registration.dob,
        password: registration.password,
        country: registration.country.trim(),
        stateOfOrigin: registration.stateOfOrigin.trim(),
      });
      if (!payload?.token || !payload?.user) {
        throw new Error("Account creation did not complete. Please try again.");
      }
      login(payload.token, payload.user, payload.sessionId || "");
      toast.success("Account created. Welcome to the directory.");
    } catch (registerError) {
      setError(registerError?.message || "Account creation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    if (!loginForm.email.trim() || !loginForm.password) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const payload = await loginApi(loginForm.email, loginForm.password);
      if (payload?.challengeRequired) {
        toast("Complete the secure sign-in check to continue.");
        navigate(`/login?returnTo=${encodeURIComponent(DIRECTORY_PATH)}`);
        return;
      }
      if (!payload?.token || !payload?.user) {
        throw new Error("Sign in failed. Check your details and try again.");
      }
      login(payload.token, payload.user, payload.sessionId || "");
      toast.success("Welcome back");
    } catch (loginError) {
      setError(loginError?.message || "Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="aik-access-shell">
      <section className="aik-access-story">
        <Brand light />
        <div className="aik-access-copy">
          <div className="aik-eyebrow aik-eyebrow--light">
            <LocationIcon />
            Kaduna State, Nigeria
          </div>
          <h1>Meet the people shaping Kaduna&apos;s AI future.</h1>
          <p>
            A focused directory of researchers, engineers, architects, and technology leaders
            building the next chapter of artificial intelligence in Kaduna State.
          </p>
          <div className="aik-access-metrics" aria-label="Directory highlights">
            <div><strong>11</strong><span>professionals</span></div>
            <div><strong>11</strong><span>specialist roles</span></div>
            <div><strong>1</strong><span>connected ecosystem</span></div>
          </div>
        </div>
        <div className="aik-network-art" aria-hidden="true">
          <span className="aik-network-art__core">AI</span>
          <i className="aik-network-art__node aik-network-art__node--one" />
          <i className="aik-network-art__node aik-network-art__node--two" />
          <i className="aik-network-art__node aik-network-art__node--three" />
          <i className="aik-network-art__node aik-network-art__node--four" />
        </div>
      </section>

      <section className="aik-auth-panel" aria-label="Directory account access">
        <div className="aik-mobile-brand"><Brand /></div>
        <div className="aik-auth-card">
          <div className="aik-auth-heading">
            <span className="aik-auth-heading__icon"><LockIcon /></span>
            <div>
              <p>Private directory access</p>
              <h2>{mode === "register" ? "Create your account" : "Welcome back"}</h2>
            </div>
          </div>

          <div className="aik-auth-tabs" role="tablist" aria-label="Choose access method">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              className={mode === "register" ? "is-active" : ""}
              onClick={() => changeMode("register")}
            >
              Create account
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              className={mode === "login" ? "is-active" : ""}
              onClick={() => changeMode("login")}
            >
              Sign in
            </button>
          </div>

          {error ? <div className="aik-form-error" role="alert">{error}</div> : null}

          {mode === "login" ? (
            <form className="aik-auth-form" onSubmit={handleLogin}>
              <label>
                <span>Email address</span>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={loginForm.email}
                  onChange={(event) => setLoginForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))}
                  required
                />
              </label>
              <label>
                <span>Password</span>
                <AuthPasswordField
                  value={loginForm.password}
                  onChange={(event) => setLoginForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))}
                  className="aik-input"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
                />
              </label>
              <div className="aik-form-meta">
                <span>Secure Tengacion account access</span>
                <Link to="/forgot-password">Forgot password?</Link>
              </div>
              <button className="aik-primary-button" type="submit" disabled={loading}>
                {loading ? "Signing in…" : "Sign in to the directory"}
                {!loading ? <ArrowIcon /> : null}
              </button>
            </form>
          ) : otpRequested ? (
            <form className="aik-auth-form" onSubmit={handleRegister}>
              <div className="aik-verification-intro">
                <span>Check your inbox</span>
                <h3>Verify your email</h3>
                <p>Enter the 6-digit code sent to <strong>{registration.email}</strong>.</p>
              </div>
              <label>
                <span>Verification code</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
                  className="aik-otp-input"
                  required
                />
              </label>
              <button className="aik-primary-button" type="submit" disabled={loading}>
                {loading ? "Verifying…" : "Verify and enter directory"}
                {!loading ? <ArrowIcon /> : null}
              </button>
              <button
                className="aik-text-button"
                type="button"
                disabled={loading}
                onClick={() => {
                  setOtpRequested(false);
                  setOtp("");
                  setError("");
                }}
              >
                Use a different email
              </button>
            </form>
          ) : (
            <form className="aik-auth-form" onSubmit={handleRequestOtp}>
              <div className="aik-form-row">
                <label>
                  <span>Full name</span>
                  <input
                    type="text"
                    autoComplete="name"
                    placeholder="Your full name"
                    value={registration.name}
                    onChange={(event) => updateRegistration("name", event.target.value)}
                    required
                  />
                </label>
                <label>
                  <span>Username</span>
                  <input
                    type="text"
                    autoComplete="username"
                    placeholder="e.g. amina.ai"
                    value={registration.username}
                    onChange={(event) => updateRegistration("username", event.target.value)}
                    required
                  />
                </label>
              </div>
              <label>
                <span>Email address</span>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={registration.email}
                  onChange={(event) => updateRegistration("email", event.target.value)}
                  required
                />
              </label>
              <div className="aik-form-row">
                <label>
                  <span>Phone number</span>
                  <input
                    type="tel"
                    autoComplete="tel"
                    placeholder="+234 800 000 0000"
                    value={registration.phone}
                    onChange={(event) => updateRegistration("phone", event.target.value)}
                    required
                  />
                </label>
                <label>
                  <span>Date of birth</span>
                  <input
                    type="date"
                    autoComplete="bday"
                    max={getMaximumDob()}
                    value={registration.dob}
                    onChange={(event) => updateRegistration("dob", event.target.value)}
                    required
                  />
                </label>
              </div>
              <div className="aik-form-row">
                <label>
                  <span>Country</span>
                  <input
                    type="text"
                    autoComplete="country-name"
                    placeholder="Country"
                    value={registration.country}
                    onChange={(event) => updateRegistration("country", event.target.value)}
                    required
                  />
                </label>
                <label>
                  <span>State / region of origin</span>
                  <input
                    type="text"
                    autoComplete="address-level1"
                    placeholder="State or region"
                    value={registration.stateOfOrigin}
                    onChange={(event) => updateRegistration("stateOfOrigin", event.target.value)}
                    required
                  />
                </label>
              </div>
              <label>
                <span>Password</span>
                <AuthPasswordField
                  value={registration.password}
                  onChange={(event) => updateRegistration("password", event.target.value)}
                  className="aik-input"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  required
                />
              </label>
              <label className="aik-consent">
                <input
                  type="checkbox"
                  checked={registration.acceptedTerms}
                  onChange={(event) => updateRegistration("acceptedTerms", event.target.checked)}
                />
                <span>
                  I agree to Tengacion&apos;s <Link to="/terms">Terms</Link> and{" "}
                  <Link to="/privacy">Privacy Policy</Link>.
                </span>
              </label>
              <button className="aik-primary-button" type="submit" disabled={loading}>
                {loading ? "Sending code…" : "Create account and continue"}
                {!loading ? <ArrowIcon /> : null}
              </button>
            </form>
          )}

          <PrivacyNote />
        </div>
        <p className="aik-auth-footer">
          © {new Date().getFullYear()} Tengacion · <Link to="/contact">Support</Link>
        </p>
      </section>
    </main>
  );
}

function CompleteProfilePage({ user }) {
  const { updateUser, logout } = useAuth();
  const [phone, setPhone] = useState(user?.phone || "");
  const [dob, setDob] = useState(toDateInputValue(user?.dob));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isValidInternationalPhoneNumber(phone)) {
      setError("Enter a valid international phone number.");
      return;
    }
    if (!dob || getAge(dob) < 13) {
      setError("Enter a valid date of birth. Account holders must be at least 13.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const updatedUser = await updateMe({ phone: normalizePhoneNumber(phone), dob });
      updateUser(updatedUser);
      toast.success("Access details saved");
    } catch (updateError) {
      setError(updateError?.message || "We could not save your details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="aik-completion-page">
      <header><Brand light /></header>
      <section className="aik-completion-card">
        <div className="aik-auth-heading">
          <span className="aik-auth-heading__icon"><LockIcon /></span>
          <div>
            <p>One last step</p>
            <h1>Complete your access details</h1>
          </div>
        </div>
        <p className="aik-completion-copy">
          Welcome, {user?.name || user?.username}. This private directory requires a phone number
          and date of birth for every account.
        </p>
        {error ? <div className="aik-form-error" role="alert">{error}</div> : null}
        <form className="aik-auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Phone number</span>
            <input
              type="tel"
              autoComplete="tel"
              placeholder="+234 800 000 0000"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
            />
          </label>
          <label>
            <span>Date of birth</span>
            <input
              type="date"
              autoComplete="bday"
              max={getMaximumDob()}
              value={dob}
              onChange={(event) => setDob(event.target.value)}
              required
            />
          </label>
          <button className="aik-primary-button" type="submit" disabled={loading}>
            {loading ? "Saving…" : "Save and open directory"}
            {!loading ? <ArrowIcon /> : null}
          </button>
        </form>
        <PrivacyNote />
        <button className="aik-text-button" type="button" onClick={() => logout({ remote: true })}>
          Sign out of this account
        </button>
      </section>
    </main>
  );
}

function DirectoryPage({ user }) {
  const { logout } = useAuth();
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const filteredProfessionals = useMemo(
    () => PROFESSIONALS.filter((professional) => (
      `${professional.name} ${professional.role} ${professional.company}`
        .toLowerCase()
        .includes(normalizedSearch)
    )),
    [normalizedSearch]
  );

  return (
    <main className="aik-directory-page">
      <header className="aik-directory-header">
        <Brand />
        <div className="aik-header-actions">
          <span className="aik-access-status"><LockIcon /> Protected access</span>
          <button type="button" onClick={() => logout({ remote: true })}>Sign out</button>
        </div>
      </header>

      <section className="aik-directory-hero">
        <div className="aik-directory-hero__copy">
          <div className="aik-eyebrow"><LocationIcon /> Kaduna State, Nigeria</div>
          <h1>AI Professionals in Kaduna State</h1>
          <p>
            Discover the people advancing responsible AI, machine learning, product innovation,
            research, and enterprise technology across Kaduna.
          </p>
        </div>
        <aside className="aik-hero-stat" aria-label="Directory size">
          <strong>{PROFESSIONALS.length}</strong>
          <span>featured professionals</span>
          <small>Across research, engineering, governance, and product</small>
        </aside>
      </section>

      <section className="aik-directory-content">
        <div className="aik-directory-toolbar">
          <div>
            <p>Curated directory</p>
            <h2>Meet Kaduna&apos;s AI community</h2>
          </div>
          <label className="aik-search-field">
            <SearchIcon />
            <span className="sr-only">Search professionals</span>
            <input
              type="search"
              placeholder="Search name, role, or company"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>

        <div className="aik-result-line" aria-live="polite">
          Showing {filteredProfessionals.length} of {PROFESSIONALS.length} professionals
        </div>

        {filteredProfessionals.length ? (
          <div className="aik-professional-grid">
            {filteredProfessionals.map((professional, index) => (
              <article className="aik-professional-card" key={professional.name}>
                <div className="aik-professional-card__image">
                  <img
                    src={professional.image}
                    alt={`Studio portrait of ${professional.name}`}
                    loading={index < 3 ? "eager" : "lazy"}
                    decoding="async"
                  />
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </div>
                <div className="aik-professional-card__body">
                  <p className="aik-professional-card__role">{professional.role}</p>
                  <h3>{professional.name}</h3>
                  <p className="aik-professional-card__company">{professional.company}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="aik-empty-state">
            <SearchIcon />
            <h3>No matching professionals</h3>
            <p>Try a different name, role, or company.</p>
            <button type="button" onClick={() => setSearch("")}>Clear search</button>
          </div>
        )}
      </section>

      <footer className="aik-directory-footer">
        <div>
          <Brand light />
          <p>Connecting talent, ideas, and opportunity across Kaduna&apos;s technology ecosystem.</p>
        </div>
        <div className="aik-directory-footer__note">
          <p>Profile names, roles, and organizations were supplied for this directory.</p>
          <span>Signed in as {user?.email}</span>
        </div>
        <nav aria-label="Legal links">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/contact">Contact</Link>
        </nav>
      </footer>
    </main>
  );
}

export default function AIProfessionalsKadunaPage() {
  const { user } = useAuth();
  const hasRequiredAccessDetails = Boolean(user?.email && user?.phone && user?.dob);

  if (!user) {
    return <AccessPage />;
  }
  if (!hasRequiredAccessDetails) {
    return <CompleteProfilePage user={user} />;
  }
  return <DirectoryPage user={user} />;
}

export { PROFESSIONALS };
