import { useEffect, useState } from "react";

import QuickAccessLayout from "../components/QuickAccessLayout";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../api";

const KEYS = [
  "likes",
  "comments",
  "follows",
  "mentions",
  "messages",
  "reports",
  "system",
];

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

export default function NotificationSettingsPage({ user }) {
  const [prefs, setPrefs] = useState({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    getNotificationPreferences()
      .then((payload) => setPrefs(payload?.notificationPrefs || {}))
      .catch(() => setPrefs({}));
  }, []);

  const toggle = (key) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const save = async () => {
    try {
      await updateNotificationPreferences(prefs);
      setMessage("Notification preferences saved.");
    } catch (err) {
      setMessage(err?.message || "Failed to save preferences");
    }
  };

  return (
    <QuickAccessLayout
      user={user}
      title="Notification Settings"
      subtitle="Choose which types of activity should trigger alerts, from likes and comments to reports and system updates."
    >
      <SectionCard title="Notification types">
        <div className="account-toggle-list">
          {KEYS.map((key) => (
            <label key={key} className="account-toggle-row">
              <div>
                <strong>{key.charAt(0).toUpperCase() + key.slice(1)}</strong>
                <span>Turn {key} notifications on or off.</span>
              </div>
              <input
                type="checkbox"
                checked={Boolean(prefs[key])}
                onChange={() => toggle(key)}
              />
            </label>
          ))}
        </div>

        <div className="account-button-row">
          <button type="button" onClick={save}>
            Save preferences
          </button>
          {message ? <span className="account-inline-message">{message}</span> : null}
        </div>
      </SectionCard>
    </QuickAccessLayout>
  );
}
