import { useState } from "react";

import QuickAccessLayout from "../components/QuickAccessLayout";
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

export default function PrivacySettings({ user }) {
  const [form, setForm] = useState({
    profileVisibility: user?.privacy?.profileVisibility || "public",
    defaultPostAudience: user?.privacy?.defaultPostAudience || "friends",
    allowMessagesFrom: user?.privacy?.allowMessagesFrom || "everyone",
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
    <QuickAccessLayout
      user={user}
      title="Privacy Settings"
      subtitle="Choose who can find you, who can message you, and which accounts you want to limit or block."
    >
      <SectionCard title="Core privacy controls">
        <div className="account-form-grid">
          <label>
            Profile visibility
            <select
              className="account-select"
              value={form.profileVisibility}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  profileVisibility: event.target.value,
                }))
              }
            >
              <option value="public">Public</option>
              <option value="friends">Friends</option>
              <option value="private">Private</option>
            </select>
          </label>

          <label>
            Default post audience
            <select
              className="account-select"
              value={form.defaultPostAudience}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  defaultPostAudience: event.target.value,
                }))
              }
            >
              <option value="public">Public</option>
              <option value="friends">Friends</option>
              <option value="close_friends">Close friends</option>
            </select>
          </label>

          <label>
            Allow messages from
            <select
              className="account-select"
              value={form.allowMessagesFrom}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  allowMessagesFrom: event.target.value,
                }))
              }
            >
              <option value="everyone">Everyone</option>
              <option value="friends">Friends</option>
              <option value="no_one">No one</option>
            </select>
          </label>

          <div className="account-button-row">
            <button type="button" onClick={save}>
              Save privacy
            </button>
            {message ? <span className="account-inline-message">{message}</span> : null}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Block, mute, and restrict">
        <div className="account-form-grid">
          <label>
            Target user id
            <input
              className="account-input"
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              placeholder="Enter a user id"
            />
          </label>

          <div className="account-chip-row">
            <button type="button" className="account-chip" onClick={() => runListAction(blockUser)}>
              Block
            </button>
            <button
              type="button"
              className="account-chip"
              onClick={() => runListAction(unblockUser)}
            >
              Unblock
            </button>
            <button type="button" className="account-chip" onClick={() => runListAction(muteUser)}>
              Mute
            </button>
            <button
              type="button"
              className="account-chip"
              onClick={() => runListAction(unmuteUser)}
            >
              Unmute
            </button>
            <button
              type="button"
              className="account-chip"
              onClick={() => runListAction(restrictUser)}
            >
              Restrict
            </button>
            <button
              type="button"
              className="account-chip"
              onClick={() => runListAction(unrestrictUser)}
            >
              Unrestrict
            </button>
            <button
              type="button"
              className="account-chip"
              onClick={() => runListAction(hideStoriesFromUser)}
            >
              Hide stories
            </button>
            <button
              type="button"
              className="account-chip"
              onClick={() => runListAction(unhideStoriesFromUser)}
            >
              Unhide stories
            </button>
          </div>
        </div>
      </SectionCard>
    </QuickAccessLayout>
  );
}
