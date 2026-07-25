import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Link, useLocation, useNavigate } from "react-router-dom";

import {
  getMillionaireStatus,
  register as registerAccount,
  registerMillionaireParticipant,
  uploadAvatar,
  uploadCover,
} from "../api";
import AuthPasswordField from "../components/AuthPasswordField";
import PublicNav from "../components/PublicNav";
import SeoHead from "../components/seo/SeoHead";
import { COUNTRY_OPTIONS, getRegionsForCountry } from "../constants/countries";
import { useAuth } from "../context/AuthContext";
import {
  isValidInternationalPhoneNumber,
  normalizePhoneNumber,
} from "../utils/phone";

import "./millionaire-register.css";

const FLYER_PATH = "/assets/campaigns/tengacion-millionaire-2026.png";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const formatDate = (value) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString([], {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const isAtLeastThirteen = (value) => {
  const birthDate = new Date(value);
  if (Number.isNaN(birthDate.getTime())) {
    return false;
  }
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age >= 13;
};

const validateImage = (file, label) => {
  if (!file) {
    return `${label} is required.`;
  }
  if (!String(file.type || "").startsWith("image/")) {
    return `${label} must be an image file.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `${label} must be 10 MB or smaller.`;
  }
  return "";
};

function RegistrationRequirements({ game, username }) {
  const requirements = game?.eligibility?.requirements || [];
  return (
    <div className="millionaire-reg-requirements">
      {requirements.map((requirement) => (
        <div
          key={requirement.id}
          className={requirement.complete ? "is-complete" : "is-pending"}
        >
          <span aria-hidden="true">{requirement.complete ? "✓" : "!"}</span>
          <div>
            <strong>{requirement.label}</strong>
            <small>{requirement.complete ? "Ready" : "Required before play"}</small>
          </div>
          {!requirement.complete && requirement.id !== "registration" ? (
            <Link to={`/profile/${username || ""}`}>Complete</Link>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function RegisteredAccountPanel({ game, user, loading, onRegister, registering }) {
  const navigate = useNavigate();
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [prizeTermsAccepted, setPrizeTermsAccepted] = useState(false);
  const registered = Boolean(game?.registration?.registered);
  const eligible = Boolean(game?.eligibility?.eligible);

  if (loading) {
    return <div className="millionaire-reg-status">Checking your game registration…</div>;
  }

  if (!registered) {
    return (
      <section className="millionaire-account-card">
        <span className="millionaire-account-card__icon" aria-hidden="true">T</span>
        <p className="millionaire-kicker">Existing Tengacion member</p>
        <h2>You are already registered on Tengacion.</h2>
        <p>
          Do not create another account. Register <strong>@{user?.username}</strong> for the
          Millionaire Game, then complete any missing profile details before play.
        </p>
        <label className="millionaire-check">
          <input
            type="checkbox"
            checked={rulesAccepted}
            onChange={(event) => setRulesAccepted(event.target.checked)}
          />
          <span>I accept the 15-question game rules and six-month play limit.</span>
        </label>
        <label className="millionaire-check">
          <input
            type="checkbox"
            checked={prizeTermsAccepted}
            onChange={(event) => setPrizeTermsAccepted(event.target.checked)}
          />
          <span>I accept prize verification and the maximum ₦5,000 award.</span>
        </label>
        <button
          type="button"
          className="millionaire-primary-action"
          disabled={registering || !rulesAccepted || !prizeTermsAccepted}
          onClick={() => onRegister({ rulesAccepted, prizeTermsAccepted })}
        >
          {registering ? "Registering…" : "Register this account for the game"}
        </button>
      </section>
    );
  }

  return (
    <section className="millionaire-account-card is-registered">
      <span className="millionaire-account-card__icon" aria-hidden="true">✓</span>
      <p className="millionaire-kicker">Game registration confirmed</p>
      <h2>{eligible ? "Your seat is ready." : "One final setup before you play."}</h2>
      <p>
        {eligible
          ? "Your account, profile information, profile picture and cover photo are complete."
          : "Every player must have complete profile information plus a profile picture and cover photo."}
      </p>
      <RegistrationRequirements game={game} username={user?.username} />
      <div className="millionaire-account-actions">
        <button
          type="button"
          className="millionaire-primary-action"
          onClick={() =>
            navigate(eligible ? "/millionaire" : `/profile/${user?.username || ""}`)
          }
        >
          {eligible ? "Enter the game lobby" : "Complete my profile"}
        </button>
        <Link to="/home">Return home</Link>
      </div>
      {game?.cooldown?.active ? (
        <p className="millionaire-cooldown-note">
          Your next game opens {formatDate(game.cooldown.nextEligibleAt)}.
        </p>
      ) : null}
    </section>
  );
}

export default function MillionaireRegisterPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, login, updateUser } = useAuth();
  const [game, setGame] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(Boolean(user));
  const [registeringExisting, setRegisteringExisting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [existingAccount, setExistingAccount] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    gender: "",
    country: "Nigeria",
    stateOfOrigin: "",
    password: "",
    avatar: null,
    cover: null,
    rulesAccepted: false,
    prizeTermsAccepted: false,
  });

  const source =
    new URLSearchParams(location.search).get("source") === "sidebar"
      ? "right_sidebar"
      : "landing_page";
  const regions = useMemo(() => getRegionsForCountry(form.country), [form.country]);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setLoadingStatus(false);
      setGame(null);
      return undefined;
    }
    setLoadingStatus(true);
    getMillionaireStatus()
      .then((payload) => {
        if (!cancelled) {
          setGame(payload);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error?.message || "Could not check game registration.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingStatus(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const setValue = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setExistingAccount(false);
  };

  const handleExistingRegistration = async ({
    rulesAccepted,
    prizeTermsAccepted,
  }) => {
    setRegisteringExisting(true);
    try {
      const payload = await registerMillionaireParticipant({
        rulesAccepted,
        prizeTermsAccepted,
        source,
      });
      setGame(payload?.game || null);
      toast.success("You are registered for Tengacion Millionaire.");
    } catch (error) {
      toast.error(error?.message || "Game registration failed.");
    } finally {
      setRegisteringExisting(false);
    }
  };

  const validateForm = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      return "Enter your first name and surname.";
    }
    if (!/^[a-z0-9_]{3,30}$/i.test(form.username.trim())) {
      return "Username must be 3–30 letters, numbers or underscores.";
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      return "Enter a valid email address.";
    }
    const phone = normalizePhoneNumber(form.phone);
    if (!isValidInternationalPhoneNumber(phone)) {
      return "Enter a valid mobile number with its country code.";
    }
    if (!form.dateOfBirth || !isAtLeastThirteen(form.dateOfBirth)) {
      return "Players must be at least 13 years old.";
    }
    if (!form.gender || !form.country || !form.stateOfOrigin) {
      return "Complete your gender, country and state or region.";
    }
    if (form.password.length < 8) {
      return "Password must contain at least 8 characters.";
    }
    const avatarError = validateImage(form.avatar, "Profile picture");
    if (avatarError) {
      return avatarError;
    }
    const coverError = validateImage(form.cover, "Cover photo");
    if (coverError) {
      return coverError;
    }
    if (!form.rulesAccepted || !form.prizeTermsAccepted) {
      return "Accept the game rules and prize terms.";
    }
    return "";
  };

  const handleCreateAccount = async (event) => {
    event.preventDefault();
    if (submitting) {
      return;
    }
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSubmitting(true);
    setExistingAccount(false);
    try {
      const account = await registerAccount({
        name: `${form.firstName.trim()} ${form.lastName.trim()}`,
        username: form.username.trim().toLowerCase(),
        email: form.email.trim().toLowerCase(),
        phone: normalizePhoneNumber(form.phone),
        dob: new Date(form.dateOfBirth).toISOString(),
        gender: form.gender,
        country: form.country,
        stateOfOrigin: form.stateOfOrigin,
        password: form.password,
      });
      if (!account?.token || !account?.user) {
        throw new Error("Your Tengacion account could not be created.");
      }

      login(account.token, account.user, account.sessionId);
      const registration = await registerMillionaireParticipant({
        rulesAccepted: true,
        prizeTermsAccepted: true,
        source: "account_creation",
      });

      let latestUser = account.user;
      try {
        latestUser = await uploadAvatar(form.avatar);
        updateUser(latestUser);
        latestUser = await uploadCover(form.cover);
        updateUser(latestUser);
      } catch (uploadError) {
        toast.error(
          uploadError?.message ||
            "Your account and game registration are ready, but a photo still needs attention."
        );
      }

      const latestGame = await getMillionaireStatus().catch(() => registration?.game);
      setGame(latestGame || registration?.game || null);
      toast.success("Account created and Millionaire registration confirmed.");
      navigate("/millionaire/register?registered=1", { replace: true });
    } catch (error) {
      const message = String(error?.message || "Registration failed.");
      if (/(already|exists|in use|registered)/i.test(message)) {
        setExistingAccount(true);
        toast.error("This email or username already belongs to a Tengacion account.");
      } else {
        toast.error(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="millionaire-reg-page">
      <SeoHead
        title="Tengacion Millionaire Registration | Quiz Challenge"
        description="Register for Tengacion Millionaire, a three-stage general knowledge challenge with 15 questions and prizes from ₦100 to ₦5,000."
        canonical="/millionaire/register"
        ogImage={FLYER_PATH}
        ogImageAlt="Tengacion Millionaire quiz challenge flyer"
      />

      <header className="millionaire-reg-header">
        <PublicNav theme="dark" />
      </header>

      <main>
        <section className="millionaire-reg-hero">
          <div className="millionaire-reg-hero__copy">
            <p className="millionaire-kicker">Think · Answer · Win</p>
            <h1>
              Your mind is the <em>real</em> jackpot.
            </h1>
            <p>
              Face 15 questions across three increasingly difficult stages, drawn
              from science, arts, history, technology, language, society and more.
            </p>
            <div className="millionaire-reg-badges">
              <span>3 stages</span>
              <span>5 questions each</span>
              <span>₦100–₦5,000</span>
              <span>One Ask AI lifeline</span>
            </div>
            <a href="#millionaire-registration">Claim your seat <span aria-hidden="true">↓</span></a>
          </div>
          <figure className="millionaire-reg-flyer">
            <span>2026 app edition</span>
            <b className="millionaire-reg-flyer__cap">
              ₦5,000 <small>maximum prize</small>
            </b>
            <img
              src={FLYER_PATH}
              alt="Tengacion Millionaire quiz challenge flyer"
              width="1024"
              height="1536"
            />
          </figure>
        </section>

        <section className="millionaire-stage-strip" aria-label="Game stages">
          <article><span>01</span><strong>The Spark</strong><small>Foundation · 45 seconds</small></article>
          <article><span>02</span><strong>The Climb</strong><small>Advanced · 35 seconds</small></article>
          <article><span>03</span><strong>The Summit</strong><small>Master · 30 seconds</small></article>
        </section>

        <section id="millionaire-registration" className="millionaire-reg-workspace">
          <div className="millionaire-reg-intro">
            <p className="millionaire-kicker">Participation is free</p>
            <h2>{user ? "Use your existing account." : "Create your game identity."}</h2>
            <p>
              A complete Tengacion profile, profile picture and cover photo are
              mandatory. Every account can play once in a six-month period.
            </p>
          </div>

          {user ? (
            <RegisteredAccountPanel
              game={game}
              user={user}
              loading={loadingStatus}
              registering={registeringExisting}
              onRegister={handleExistingRegistration}
            />
          ) : (
            <form className="millionaire-reg-form" onSubmit={handleCreateAccount}>
              {existingAccount ? (
                <div className="millionaire-existing-account" role="alert">
                  <strong>You already have a Tengacion account.</strong>
                  <p>
                    Sign in instead of creating another account. After login, this
                    page will register that account for the game.
                  </p>
                  <Link to="/login?returnTo=/millionaire/register">Log in and continue</Link>
                </div>
              ) : null}

              <fieldset className="millionaire-form-section is-coral">
                <legend><span>01</span> Your identity</legend>
                <div className="millionaire-form-grid two">
                  <label>First name *<input value={form.firstName} onChange={(event) => setValue("firstName", event.target.value)} autoComplete="given-name" /></label>
                  <label>Surname *<input value={form.lastName} onChange={(event) => setValue("lastName", event.target.value)} autoComplete="family-name" /></label>
                  <label>Tengacion username *<input value={form.username} onChange={(event) => setValue("username", event.target.value)} autoComplete="username" placeholder="brightmind" /></label>
                  <label>Email address *<input type="email" value={form.email} onChange={(event) => setValue("email", event.target.value)} autoComplete="email" /></label>
                  <label>Mobile number *<input type="tel" value={form.phone} onChange={(event) => setValue("phone", event.target.value)} autoComplete="tel" placeholder="+234 800 000 0000" /></label>
                  <label>Date of birth *<input type="date" value={form.dateOfBirth} onChange={(event) => setValue("dateOfBirth", event.target.value)} autoComplete="bday" /></label>
                  <label>Gender *<select value={form.gender} onChange={(event) => setValue("gender", event.target.value)}><option value="">Select gender</option><option value="female">Female</option><option value="male">Male</option><option value="custom">Custom</option><option value="prefer_not_to_say">Prefer not to say</option></select></label>
                  <label>Password *<AuthPasswordField value={form.password} onChange={(event) => setValue("password", event.target.value)} autoComplete="new-password" placeholder="At least 8 characters" /></label>
                </div>
              </fieldset>

              <fieldset className="millionaire-form-section is-blue">
                <legend><span>02</span> Your location</legend>
                <div className="millionaire-form-grid two">
                  <label>Country *<select value={form.country} onChange={(event) => setForm((current) => ({ ...current, country: event.target.value, stateOfOrigin: "" }))}><option value="">Select country</option>{COUNTRY_OPTIONS.map((country) => <option key={country} value={country}>{country}</option>)}</select></label>
                  <label>State / region of origin *<select value={form.stateOfOrigin} onChange={(event) => setValue("stateOfOrigin", event.target.value)} disabled={!form.country}><option value="">Select state or region</option>{(regions.length ? regions : ["Other / Not listed"]).map((region) => <option key={region} value={region}>{region}</option>)}</select></label>
                </div>
              </fieldset>

              <fieldset className="millionaire-form-section is-violet">
                <legend><span>03</span> Game profile photos</legend>
                <p className="millionaire-section-note">Use clear, authentic images. Uploads pass through Tengacion&apos;s normal moderation checks.</p>
                <div className="millionaire-photo-grid">
                  <label className="millionaire-photo-field">
                    <span className="millionaire-photo-icon" aria-hidden="true">◎</span>
                    <strong>Profile picture *</strong>
                    <small>{form.avatar?.name || "JPG, PNG or WebP · max 10 MB"}</small>
                    <input type="file" accept="image/*" onChange={(event) => setValue("avatar", event.target.files?.[0] || null)} />
                  </label>
                  <label className="millionaire-photo-field is-cover">
                    <span className="millionaire-photo-icon" aria-hidden="true">▭</span>
                    <strong>Cover photo *</strong>
                    <small>{form.cover?.name || "A wide image works best · max 10 MB"}</small>
                    <input type="file" accept="image/*" onChange={(event) => setValue("cover", event.target.files?.[0] || null)} />
                  </label>
                </div>
              </fieldset>

              <fieldset className="millionaire-form-section is-gold">
                <legend><span>04</span> Rules and consent</legend>
                <label className="millionaire-check">
                  <input type="checkbox" checked={form.rulesAccepted} onChange={(event) => setValue("rulesAccepted", event.target.checked)} />
                  <span>I understand there are 15 timed questions, one Ask AI lifeline and one play every six months.</span>
                </label>
                <label className="millionaire-check">
                  <input type="checkbox" checked={form.prizeTermsAccepted} onChange={(event) => setValue("prizeTermsAccepted", event.target.checked)} />
                  <span>I accept winner verification, Tengacion&apos;s rules and the maximum cash award of ₦5,000.</span>
                </label>
                <p className="millionaire-legal">By registering, you also accept Tengacion&apos;s <Link to="/terms">Terms</Link>, <Link to="/privacy">Privacy Policy</Link> and <Link to="/community-guidelines">Community Guidelines</Link>.</p>
              </fieldset>

              <button className="millionaire-submit" type="submit" disabled={submitting}>
                {submitting ? "Creating your account and game profile…" : "Create account & register for the game"}
              </button>
              <p className="millionaire-login-note">
                Already use Tengacion? <Link to="/login?returnTo=/millionaire/register">Log in and continue</Link>.
              </p>
            </form>
          )}
        </section>
      </main>

      <footer className="millionaire-reg-footer">
        <strong>Tengacion Millionaire</strong>
        <span>Think for yourself. Trust your intelligence.</span>
      </footer>
    </div>
  );
}
