import { useEffect, useState } from "react";
import { getNotificationPreferences, updateNotificationPreferences } from "../api";

const KEYS = ["likes", "comments", "follows", "mentions", "messages", "reports", "system"];

export default function NotificationSettingsPage() {
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
    <div className="app-shell">
      <main className="feed" style={{ maxWidth: 760, margin: "0 auto", padding: 20 }}>
        <section className="card" style={{ padding: 14 }}>
          <h2 style={{ marginTop: 0 }}>Notification settings</h2>
          <div style={{ display: "grid", gap: 8 }}>
            {KEYS.map((key) => (
              <label key={key} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={Boolean(prefs[key])}
                  onChange={() => toggle(key)}
                />
                <span>{key}</span>
              </label>
            ))}
          </div>
          <button type="button" onClick={save} style={{ marginTop: 10 }}>
            Save
          </button>
          {message ? <p>{message}</p> : null}
        </section>
      </main>
    </div>
  );
}
