import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { getUsers, updateMe, updateOnboarding } from "../api";
import { useAuth } from "../context/AuthContext";

import "./onboarding.css";

const PATH_OPTIONS = [
  {
    key: "discover",
    label: "Discover creators",
    description: "Find music, books, podcasts, marketplace drops, and public creator activity.",
    route: "/creators",
    actionLabel: "Find creators",
    interests: ["music", "books", "podcasts", "marketplace"],
    creatorLanes: [],
  },
  {
    key: "music_creator",
    label: "I am a musician",
    description: "Prepare your creator profile for songs, albums, videos, and paid releases.",
    route: "/creator/register",
    actionLabel: "Open creator setup",
    interests: ["music", "afrobeats", "live", "creator tools"],
    creatorLanes: ["music"],
  },
  {
    key: "author",
    label: "I am an author",
    description: "Build an author profile for digital books, previews, and supporter access.",
    route: "/creator/register",
    actionLabel: "Start author setup",
    interests: ["books", "writing", "education", "creator tools"],
    creatorLanes: ["bookPublishing"],
  },
  {
    key: "podcaster",
    label: "I am a podcaster",
    description: "Set up for episodes, spoken word, interviews, and subscriber-only audio.",
    route: "/creator/register",
    actionLabel: "Start podcast setup",
    interests: ["podcasts", "spoken word", "interviews", "creator tools"],
    creatorLanes: ["podcast"],
  },
  {
    key: "seller",
    label: "I want to sell products",
    description: "Move toward seller onboarding, verified storefronts, orders, and payouts.",
    route: "/marketplace/register",
    actionLabel: "Register seller profile",
    interests: ["marketplace", "shopping", "local sellers", "delivery"],
    creatorLanes: [],
  },
  {
    key: "social",
    label: "Connect with friends",
    description: "Start with people, posts, conversations, public activity, and communities.",
    route: "/home",
    actionLabel: "Open home feed",
    interests: ["community", "news", "friends", "events"],
    creatorLanes: [],
  },
];

const BASE_INTEREST_OPTIONS = [
  "music",
  "afrobeats",
  "books",
  "podcasts",
  "spoken word",
  "marketplace",
  "gaming",
  "news",
  "technology",
  "education",
  "comedy",
  "movies",
  "sports",
  "travel",
  "community",
  "creator tools",
];

const STEP_LABELS = ["Path", "Profile", "Interests", "Launch"];

const hasAvatar = (user) => {
  const avatar = user?.avatar;
  return Boolean(
    typeof avatar === "string" ? avatar : avatar?.url || avatar?.secureUrl
  );
};

const mergeUnique = (...lists) => {
  const seen = new Set();
  return lists
    .flat()
    .map((entry) => String(entry || "").trim().toLowerCase())
    .filter(Boolean)
    .filter((entry) => {
      if (seen.has(entry)) {
        return false;
      }
      seen.add(entry);
      return true;
    });
};

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedPath, setSelectedPath] = useState(user?.onboarding?.intent || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [interests, setInterests] = useState(() => mergeUnique(user?.interests || []));
  const [suggested, setSuggested] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    getUsers("")
      .then((rows) => {
        if (mounted) {
          setSuggested(Array.isArray(rows) ? rows.slice(0, 6) : []);
        }
      })
      .catch(() => {
        if (mounted) {
          setSuggested([]);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const selectedPathConfig = useMemo(
    () => PATH_OPTIONS.find((entry) => entry.key === selectedPath) || PATH_OPTIONS[0],
    [selectedPath]
  );
  const profileEditorPath = user?.username
    ? `/profile/${encodeURIComponent(user.username)}`
    : "/home";

  const interestOptions = useMemo(
    () => mergeUnique(selectedPathConfig.interests, BASE_INTEREST_OPTIONS),
    [selectedPathConfig]
  );

  const progress = useMemo(() => Math.round((step / STEP_LABELS.length) * 100), [step]);

  const toggleInterest = (item) => {
    setInterests((current) =>
      current.includes(item)
        ? current.filter((entry) => entry !== item)
        : mergeUnique(current, [item]).slice(0, 20)
    );
  };

  const applyOnboardingPayload = (payload) => {
    updateUser({
      onboarding: payload?.onboarding || user?.onboarding || {},
      interests: payload?.interests || interests,
      bio,
    });
  };

  const savePathStep = async () => {
    if (!selectedPath) {
      setMessage("Choose the path that best matches why you are here.");
      return false;
    }

    const nextInterests = mergeUnique(interests, selectedPathConfig.interests).slice(0, 20);
    const payload = await updateOnboarding({
      intent: selectedPathConfig.key,
      creatorLanes: selectedPathConfig.creatorLanes,
      interests: nextInterests,
      steps: {
        intent: true,
        interests: nextInterests.length > 0,
      },
    });

    setInterests(nextInterests);
    applyOnboardingPayload(payload);
    return true;
  };

  const saveProfileStep = async () => {
    const trimmedBio = bio.trim();
    if (trimmedBio) {
      await updateMe({ bio: trimmedBio });
    }
    const payload = await updateOnboarding({
      steps: {
        avatar: hasAvatar(user),
        bio: Boolean(trimmedBio),
      },
    });
    applyOnboardingPayload(payload);
    return true;
  };

  const saveInterestsStep = async () => {
    if (!interests.length) {
      setMessage("Pick at least one interest so Tengacion can shape your discovery feed.");
      return false;
    }
    const payload = await updateOnboarding({
      interests,
      steps: {
        interests: true,
      },
    });
    applyOnboardingPayload(payload);
    return true;
  };

  const finishOnboarding = async () => {
    const payload = await updateOnboarding({
      completed: true,
      intent: selectedPathConfig.key,
      creatorLanes: selectedPathConfig.creatorLanes,
      interests,
      steps: {
        intent: true,
        avatar: hasAvatar(user),
        bio: Boolean(bio.trim()),
        interests: interests.length > 0,
        followSuggestions: true,
      },
    });
    applyOnboardingPayload(payload);
    navigate(selectedPathConfig.route, { replace: true });
    return true;
  };

  const finishStep = async () => {
    if (saving) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const saved =
        step === 1
          ? await savePathStep()
          : step === 2
            ? await saveProfileStep()
            : step === 3
              ? await saveInterestsStep()
              : await finishOnboarding();

      if (!saved) {
        return;
      }

      if (step < STEP_LABELS.length) {
        setStep((current) => Math.min(STEP_LABELS.length, current + 1));
      }
    } catch (err) {
      setMessage(err?.message || "Failed to save onboarding step.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-shell onboarding-page">
      <main className="onboarding-shell">
        <section className="onboarding-card" aria-labelledby="onboarding-title">
          <div className="onboarding-card__header">
            <div>
              <p className="onboarding-eyebrow">Tengacion setup</p>
              <h1 id="onboarding-title">Shape your first Tengacion experience</h1>
              <p>
                Choose your path once, and Tengacion will save the intent, seed your interests,
                and point you toward the right next action.
              </p>
            </div>
            <Link className="onboarding-skip" to="/home">
              Skip
            </Link>
          </div>

          <div className="onboarding-progress" aria-label="Onboarding progress">
            <div className="onboarding-progress__bar">
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className="onboarding-progress__steps">
              {STEP_LABELS.map((label, index) => (
                <span key={label} className={index + 1 <= step ? "is-active" : ""}>
                  {label}
                </span>
              ))}
            </div>
          </div>

          {step === 1 ? (
            <section className="onboarding-step" aria-labelledby="onboarding-path-title">
              <div className="onboarding-step__head">
                <h2 id="onboarding-path-title">What are you here to do first?</h2>
                <p>This becomes your saved onboarding intent and helps discovery start warmer.</p>
              </div>
              <div className="onboarding-path-grid">
                {PATH_OPTIONS.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    className={`onboarding-path-card${selectedPath === entry.key ? " is-selected" : ""}`}
                    onClick={() => setSelectedPath(entry.key)}
                  >
                    <strong>{entry.label}</strong>
                    <span>{entry.description}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="onboarding-step" aria-labelledby="onboarding-profile-title">
              <div className="onboarding-step__head">
                <h2 id="onboarding-profile-title">Give people a quick sense of you</h2>
                <p>A short bio helps creators, buyers, and friends understand the account behind the activity.</p>
              </div>
              <div className="onboarding-profile-grid">
                <label className="onboarding-field">
                  <span>Bio</span>
                  <textarea
                    value={bio}
                    onChange={(event) => setBio(event.target.value)}
                    maxLength={280}
                    placeholder="Creator, listener, seller, reader, community builder..."
                  />
                  <small>{bio.trim().length}/280</small>
                </label>
                <div className="onboarding-profile-card">
                  <strong>Avatar status</strong>
                  <p>
                    {hasAvatar(user)
                      ? "Your avatar is ready for public and social surfaces."
                      : "Add an avatar from your profile editor when you want a more complete identity."}
                  </p>
                  <Link to={profileEditorPath} className="onboarding-inline-link">
                    Open profile editor
                  </Link>
                </div>
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="onboarding-step" aria-labelledby="onboarding-interest-title">
              <div className="onboarding-step__head">
                <h2 id="onboarding-interest-title">Tune your discovery signals</h2>
                <p>
                  Your selected path suggests a starting set. Add or remove topics before saving.
                </p>
              </div>
              <div className="onboarding-interest-grid">
                {interestOptions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`onboarding-interest${interests.includes(item) ? " is-selected" : ""}`}
                    onClick={() => toggleInterest(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {step === 4 ? (
            <section className="onboarding-step" aria-labelledby="onboarding-launch-title">
              <div className="onboarding-step__head">
                <h2 id="onboarding-launch-title">Ready to launch</h2>
                <p>
                  Tengacion will finish setup and open the best next surface for your saved path.
                </p>
              </div>
              <div className="onboarding-launch-grid">
                <article className="onboarding-launch-card">
                  <span>Saved path</span>
                  <strong>{selectedPathConfig.label}</strong>
                  <p>{selectedPathConfig.description}</p>
                  <Link to={selectedPathConfig.route}>{selectedPathConfig.actionLabel}</Link>
                </article>
                <article className="onboarding-launch-card">
                  <span>Discovery interests</span>
                  <strong>{interests.length} selected</strong>
                  <p>{interests.slice(0, 8).join(", ") || "No interests selected yet."}</p>
                </article>
              </div>

              <div className="onboarding-suggestions">
                <h3>People to start with</h3>
                <div className="onboarding-suggestion-list">
                  {suggested.length ? (
                    suggested.map((entry) => (
                      <Link
                        key={entry._id}
                        className="onboarding-suggestion"
                        to={`/profile/${entry.username || entry._id}`}
                      >
                        <strong>{entry.name || entry.username}</strong>
                        <span>@{entry.username || "member"}</span>
                      </Link>
                    ))
                  ) : (
                    <p>Suggestions will appear as Tengacion finds active public profiles.</p>
                  )}
                </div>
              </div>
            </section>
          ) : null}

          <div className="onboarding-actions">
            {step > 1 ? (
              <button type="button" className="onboarding-secondary" onClick={() => setStep((current) => current - 1)}>
                Back
              </button>
            ) : null}
            <button type="button" className="onboarding-primary" onClick={finishStep} disabled={saving}>
              {saving
                ? "Saving..."
                : step === STEP_LABELS.length
                  ? `Finish and open ${selectedPathConfig.actionLabel.toLowerCase()}`
                  : "Continue"}
            </button>
          </div>

          {message ? <p className="onboarding-message" role="status">{message}</p> : null}
          {user?.onboarding?.completed ? <p className="onboarding-complete">Profile setup is complete.</p> : null}
        </section>
      </main>
    </div>
  );
}
