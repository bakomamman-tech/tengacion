import { useState } from "react";

import QuickAccessLayout from "../components/QuickAccessLayout";
import {
  blockUser,
  exportAccountData,
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
  const [exportMessage, setExportMessage] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportPassword, setExportPassword] = useState("");

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

  const downloadAccountData = async () => {
    if (!exportPassword) {
      setExportMessage("Enter your current password to export account data.");
      return;
    }
    setExporting(true);
    setExportMessage("");
    try {
      const payload = await exportAccountData(exportPassword);
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = payload?.fileName || "tengacion-account-data.json";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
      setExportPassword("");
      setExportMessage(
        payload?.manifest?.complete
          ? "Your account data download is ready."
          : "Your bounded account snapshot downloaded. Its manifest explains which section needs a complete privacy-support export."
      );
    } catch (err) {
      setExportMessage(err?.message || "Failed to export account data");
    } finally {
      setExporting(false);
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

      <SectionCard title="Download your data">
        <div className="account-form-grid">
          <p>
            Download a portable JSON snapshot of your profile, preferences, relationship lists,
            creator profile, authored posts and stories, sent messages, and purchase history.
            Passwords, token material, multi-factor secrets, provider recipient identifiers, and
            other people's reactions or private replies are excluded.
          </p>
          <p className="account-inline-message">
            Each activity section is capped at 5,000 records for an on-demand download. The file
            manifest identifies any capped section and directs you to privacy support for a
            complete archive.
          </p>
          <label>
            Current password
            <input
              className="account-input"
              type="password"
              autoComplete="current-password"
              value={exportPassword}
              onChange={(event) => setExportPassword(event.target.value)}
              placeholder="Confirm your password"
            />
          </label>
          <div className="account-button-row">
            <button type="button" onClick={downloadAccountData} disabled={exporting}>
              {exporting ? "Preparing download..." : "Download account data"}
            </button>
            {exportMessage ? (
              <span className="account-inline-message" role="status" aria-live="polite">
                {exportMessage}
              </span>
            ) : null}
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
