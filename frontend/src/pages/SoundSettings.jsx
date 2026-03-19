import { useEffect, useState } from "react";

import QuickAccessLayout from "../components/QuickAccessLayout";
import { getAudioPreferences, updateAudioPreferences } from "../api";
import { useAuth } from "../context/AuthContext";
import {
  MAX_WELCOME_VOICE_VOLUME,
  buildWelcomeVoiceText,
  normalizeWelcomeVoicePrefs,
  resolveOfficialRegisteredName,
  speakAmbientWelcome,
  supportsSpeechSynthesis,
} from "../services/welcomeVoice";

function SectionCard({ title, children }) {
  return (
    <section className="card quick-section-card">
      <div className="quick-section-head">
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function SoundSettingsPage({ user: currentUser }) {
  const { user: authUser, updateUser } = useAuth();
  const user = currentUser || authUser;
  const [prefs, setPrefs] = useState(() => normalizeWelcomeVoicePrefs(user?.audioPrefs));
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [message, setMessage] = useState("");

  const officialName = resolveOfficialRegisteredName(user);
  const spokenLine = buildWelcomeVoiceText(user);
  const volumePercent = Math.round(prefs.welcomeVoiceVolume * 100);
  const maxVolumePercent = Math.round(MAX_WELCOME_VOICE_VOLUME * 100);
  const speechSupported = supportsSpeechSynthesis();

  useEffect(() => {
    setPrefs(normalizeWelcomeVoicePrefs(user?.audioPrefs));
  }, [user?.audioPrefs]);

  useEffect(() => {
    let active = true;

    getAudioPreferences()
      .then((payload) => {
        if (!active) {
          return;
        }
        setPrefs(normalizeWelcomeVoicePrefs(payload?.audioPrefs));
      })
      .catch(() => null);

    return () => {
      active = false;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage("");

    try {
      const payload = await updateAudioPreferences(prefs);
      const nextPrefs = normalizeWelcomeVoicePrefs(payload?.audioPrefs);
      setPrefs(nextPrefs);
      updateUser({ audioPrefs: nextPrefs });
      setMessage("Welcome voice settings saved.");
    } catch (err) {
      setMessage(err?.message || "Failed to save welcome voice settings");
    } finally {
      setSaving(false);
    }
  };

  const preview = async () => {
    setPreviewing(true);
    setMessage("");

    try {
      const result = await speakAmbientWelcome({
        text: spokenLine,
        volume: prefs.welcomeVoiceVolume,
      });

      if (result?.ok && result.started) {
        setMessage(
          result.voiceName
            ? `Preview playing with ${result.voiceName}.`
            : "Preview playing."
        );
      } else if (result?.reason === "unsupported") {
        setMessage("Voice playback is not available in this browser.");
      } else {
        setMessage("Preview could not start just now. Try again from a direct click.");
      }
    } catch (err) {
      setMessage(err?.message || "Preview could not start just now.");
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <QuickAccessLayout
      user={user}
      title="Sound & Welcome Voice"
      subtitle="Shape Tengacion's ambient spoken greeting so it stays refined, audible, and softly in the background."
    >
      <SectionCard title="Ambient welcome">
        <div className="account-toggle-list">
          <label className="account-toggle-row">
            <div>
              <strong>Play welcome voice on app entry</strong>
              <span>
                Speaks once per authenticated session, then stays silent while you move around the
                app.
              </span>
            </div>
            <input
              type="checkbox"
              checked={Boolean(prefs.welcomeVoiceEnabled)}
              onChange={(event) =>
                setPrefs((current) => ({
                  ...current,
                  welcomeVoiceEnabled: event.target.checked,
                }))
              }
            />
          </label>
        </div>

        <div className="account-note-card" style={{ marginTop: 12 }}>
          <strong>Spoken line</strong>
          <p>{spokenLine}</p>
          <span className="account-inline-message">
            {officialName
              ? "Uses the official registered account name from your profile."
              : "Falls back to a simple Tengacion greeting when no registered name is available."}
          </span>
        </div>
      </SectionCard>

      <SectionCard title="Background volume">
        <div className="account-slider-group">
          <label htmlFor="welcome-voice-volume">
            Welcome voice volume
            <input
              id="welcome-voice-volume"
              className="account-range"
              type="range"
              min="0"
              max={String(MAX_WELCOME_VOICE_VOLUME)}
              step="0.01"
              value={prefs.welcomeVoiceVolume}
              disabled={!prefs.welcomeVoiceEnabled}
              onChange={(event) =>
                setPrefs((current) => ({
                  ...current,
                  welcomeVoiceVolume: Number(event.target.value || 0),
                }))
              }
            />
          </label>

          <div className="account-slider-meta">
            <span>Current level: {volumePercent}%</span>
            <span>Soft cap: {maxVolumePercent}%</span>
          </div>

          <p className="account-slider-note">
            Tengacion keeps the welcome voice intentionally soft so it feels premium and present,
            not loud or assistant-like.
          </p>
        </div>
      </SectionCard>

      <SectionCard title="Preview & browser support">
        <div className="account-note-card">
          <strong>{speechSupported ? "Speech synthesis available" : "Speech synthesis unavailable"}</strong>
          <p>
            {speechSupported
              ? "Tengacion will choose the best available calm English voice on this device and defer playback when the browser requires interaction first."
              : "This browser cannot play the ambient welcome voice, so Tengacion will quietly fall back without interrupting the app."}
          </p>
        </div>

        <div className="account-button-row" style={{ marginTop: 12 }}>
          <button type="button" onClick={preview} disabled={previewing || !speechSupported}>
            {previewing ? "Playing preview..." : "Preview welcome voice"}
          </button>
          <button type="button" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save sound settings"}
          </button>
          {message ? <span className="account-inline-message">{message}</span> : null}
        </div>
      </SectionCard>
    </QuickAccessLayout>
  );
}
