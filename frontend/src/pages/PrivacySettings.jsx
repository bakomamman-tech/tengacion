import { useState } from "react";
import {
  blockUser,
  hideStoriesFromUser,
  muteUser,
  restrictUser,
  unblockUser,
  unhideStoriesFromUser,
  unmuteUser,
  unrestrictUser,
  updatePrivacy,
} from "../api";

export default function PrivacySettings() {
  const [form, setForm] = useState({
    profileVisibility: "public",
    defaultPostAudience: "friends",
    allowMessagesFrom: "everyone",
  });
  const [targetId, setTargetId] = useState("");
  const [message, setMessage] = useState("");

  const save = async () => {
    try {
      await updatePrivacy(form);
      setMessage("Privacy settings saved.");
    } catch (err) {
      setMessage(err?.message || "Failed to save privacy settings");
    }
  };

  const runListAction = async (runner) => {
    if (!targetId.trim()) {
      setMessage("Enter a user id first");
      return;
    }
    try {
      await runner(targetId.trim());
      setMessage("Action completed");
      setTargetId("");
    } catch (err) {
      setMessage(err?.message || "Action failed");
    }
  };

  return (
    <div className="app-shell">
      <main className="feed" style={{ maxWidth: 820, margin: "0 auto", padding: 20, display: "grid", gap: 14 }}>
        <section className="card" style={{ padding: 14, display: "grid", gap: 8 }}>
          <h2 style={{ marginTop: 0 }}>Privacy settings</h2>
          <label>
            Profile visibility
            <select
              value={form.profileVisibility}
              onChange={(event) => setForm((prev) => ({ ...prev, profileVisibility: event.target.value }))}
            >
              <option value="public">Public</option>
              <option value="friends">Friends</option>
              <option value="private">Private</option>
            </select>
          </label>
          <label>
            Default post audience
            <select
              value={form.defaultPostAudience}
              onChange={(event) => setForm((prev) => ({ ...prev, defaultPostAudience: event.target.value }))}
            >
              <option value="public">Public</option>
              <option value="friends">Friends</option>
              <option value="close_friends">Close friends</option>
            </select>
          </label>
          <label>
            Allow messages from
            <select
              value={form.allowMessagesFrom}
              onChange={(event) => setForm((prev) => ({ ...prev, allowMessagesFrom: event.target.value }))}
            >
              <option value="everyone">Everyone</option>
              <option value="friends">Friends</option>
              <option value="no_one">No one</option>
            </select>
          </label>
          <button type="button" onClick={save}>Save privacy</button>
        </section>

        <section className="card" style={{ padding: 14, display: "grid", gap: 8 }}>
          <h3 style={{ marginTop: 0 }}>Manage block / mute / restrict</h3>
          <input
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
            placeholder="Target user id"
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => runListAction(blockUser)}>Block</button>
            <button type="button" onClick={() => runListAction(unblockUser)}>Unblock</button>
            <button type="button" onClick={() => runListAction(muteUser)}>Mute</button>
            <button type="button" onClick={() => runListAction(unmuteUser)}>Unmute</button>
            <button type="button" onClick={() => runListAction(restrictUser)}>Restrict</button>
            <button type="button" onClick={() => runListAction(unrestrictUser)}>Unrestrict</button>
            <button type="button" onClick={() => runListAction(hideStoriesFromUser)}>Hide stories</button>
            <button type="button" onClick={() => runListAction(unhideStoriesFromUser)}>Unhide stories</button>
          </div>
        </section>

        {message ? <p>{message}</p> : null}
      </main>
    </div>
  );
}
