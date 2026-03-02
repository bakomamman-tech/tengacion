import { useEffect, useMemo, useState } from "react";
import { getUsers, updateMe, updateOnboarding } from "../api";
import { useAuth } from "../context/AuthContext";

const INTEREST_OPTIONS = [
  "music",
  "sports",
  "technology",
  "gaming",
  "education",
  "news",
  "movies",
  "travel",
];

export default function OnboardingPage() {
  const { user, updateUser } = useAuth();
  const [step, setStep] = useState(1);
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState([]);
  const [suggested, setSuggested] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getUsers("").then((rows) => setSuggested(Array.isArray(rows) ? rows.slice(0, 6) : []));
  }, []);

  const progress = useMemo(() => Math.round((step / 4) * 100), [step]);

  const toggleInterest = (item) => {
    setInterests((prev) => (prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]));
  };

  const finishStep = async () => {
    try {
      if (step === 1) {
        await updateOnboarding({ steps: { avatar: true } });
      }
      if (step === 2) {
        await updateMe({ bio });
        await updateOnboarding({ steps: { bio: Boolean(bio.trim()) } });
      }
      if (step === 3) {
        await updateOnboarding({ interests, steps: { interests: interests.length > 0 } });
      }
      if (step === 4) {
        await updateOnboarding({
          completed: true,
          steps: {
            avatar: true,
            bio: true,
            interests: true,
            followSuggestions: true,
          },
        });
        updateUser({ onboarding: { completed: true } });
        setMessage("Onboarding completed.");
        return;
      }
      setStep((prev) => Math.min(4, prev + 1));
    } catch (err) {
      setMessage(err?.message || "Failed to save onboarding step");
    }
  };

  return (
    <div className="app-shell">
      <main className="feed" style={{ maxWidth: 760, margin: "0 auto", padding: 20 }}>
        <section className="card" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Complete your profile</h2>
          <div style={{ height: 8, borderRadius: 999, background: "rgba(148,163,184,0.22)", overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "#b77a3b" }} />
          </div>

          {step === 1 ? (
            <div style={{ marginTop: 12 }}>
              <h3>Step 1: Add avatar</h3>
              <p>Upload your avatar from your profile page, then continue.</p>
            </div>
          ) : null}

          {step === 2 ? (
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              <h3>Step 2: Add bio</h3>
              <textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={280} />
            </div>
          ) : null}

          {step === 3 ? (
            <div style={{ marginTop: 12 }}>
              <h3>Step 3: Choose interests</h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {INTEREST_OPTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={interests.includes(item) ? "search-person-btn primary" : "search-person-btn"}
                    onClick={() => toggleInterest(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div style={{ marginTop: 12 }}>
              <h3>Step 4: Suggested friends</h3>
              <div style={{ display: "grid", gap: 8 }}>
                {suggested.map((entry) => (
                  <div key={entry._id} className="card" style={{ padding: 8 }}>
                    <b>{entry.name}</b> @{entry.username}
                  </div>
                ))}
                {suggested.length === 0 ? <p>No suggestions now.</p> : null}
              </div>
            </div>
          ) : null}

          <button type="button" onClick={finishStep} style={{ marginTop: 12 }}>
            {step === 4 ? "Finish onboarding" : "Continue"}
          </button>
          {message ? <p>{message}</p> : null}
          {user?.onboarding?.completed ? <p>Profile complete.</p> : null}
        </section>
      </main>
    </div>
  );
}
