import { useCallback, useEffect, useState } from "react";

import QuickAccessLayout from "../components/QuickAccessLayout";
import {
  blockUser,
  exportAccountData,
  getPrivacySafetyLists,
  getUsers,
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

const EMPTY_SAFETY_LISTS = {
  blocked: [],
  muted: [],
  restricted: [],
  hiddenStoriesFrom: [],
};

function SafetyList({ title, description, entries, actionLabel, onAction, busyKey }) {
  return (
    <div className="quick-list-item">
      <strong>{title}</strong>
      <span>{description}</span>
      {entries.map((entry) => (
        <div className="account-button-row" key={entry._id}>
          <span>
            {entry.name || entry.username || "Tengacion user"}
            {entry.username ? ` (@${entry.username})` : ""}
          </span>
          <button
            type="button"
            className="account-chip"
            disabled={busyKey === `${actionLabel}:${entry._id}`}
            onClick={() => onAction(entry)}
          >
            {busyKey === `${actionLabel}:${entry._id}` ? "Saving..." : `${actionLabel} @${entry.username || "user"}`}
          </button>
        </div>
      ))}
      {entries.length === 0 ? <span className="quick-empty">No accounts in this list.</span> : null}
    </div>
  );
}

export default function PrivacySettings({ user }) {
  const [form, setForm] = useState({
    profileVisibility: user?.privacy?.profileVisibility || "public",
    defaultPostAudience: user?.privacy?.defaultPostAudience || "friends",
    allowMessagesFrom: user?.privacy?.allowMessagesFrom || "everyone",
  });
  const [message, setMessage] = useState("");
  const [safetyMessage, setSafetyMessage] = useState("");
  const [safetyLists, setSafetyLists] = useState(EMPTY_SAFETY_LISTS);
  const [safetyLoading, setSafetyLoading] = useState(true);
  const [safetyBusyKey, setSafetyBusyKey] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [pendingBlock, setPendingBlock] = useState(null);
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

  const loadSafetyLists = useCallback(async () => {
    try {
      const payload = await getPrivacySafetyLists();
      setSafetyLists({
        blocked: Array.isArray(payload?.blocked) ? payload.blocked : [],
        muted: Array.isArray(payload?.muted) ? payload.muted : [],
        restricted: Array.isArray(payload?.restricted) ? payload.restricted : [],
        hiddenStoriesFrom: Array.isArray(payload?.hiddenStoriesFrom)
          ? payload.hiddenStoriesFrom
          : [],
      });
    } finally {
      setSafetyLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSafetyLists().catch((err) => {
      setSafetyMessage(err?.message || "Failed to load account safety controls");
    });
  }, [loadSafetyLists]);

  const runSafetyAction = async ({ runner, entry, actionLabel, successMessage }) => {
    const key = `${actionLabel}:${entry._id}`;
    setSafetyBusyKey(key);
    setSafetyMessage("");
    try {
      await runner(entry._id);
      await loadSafetyLists();
      setSafetyMessage(successMessage);
      if (runner === blockUser) {
        setSearchResults((current) => current.filter((candidate) => candidate._id !== entry._id));
      }
    } catch (err) {
      setSafetyMessage(err?.message || "Safety control could not be saved");
    } finally {
      setSafetyBusyKey("");
      if (runner === blockUser) {
        setPendingBlock(null);
      }
    }
  };

  const searchAccounts = async (event) => {
    event.preventDefault();
    const query = accountSearch.trim();
    if (query.length < 2) {
      setSafetyMessage("Enter at least two letters of a name or username.");
      return;
    }
    setSearching(true);
    setSafetyMessage("");
    try {
      const payload = await getUsers(query);
      setSearchResults(Array.isArray(payload) ? payload.slice(0, 10) : []);
    } catch (err) {
      setSafetyMessage(err?.message || "Account search failed");
      setSearchResults([]);
    } finally {
      setSearching(false);
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
          <p>
            Find accounts by name or username. Blocking removes existing friend, follow, and
            pending-request connections. Unblocking later does not restore them automatically.
          </p>
          <form className="account-button-row" onSubmit={searchAccounts}>
            <label>
              Find an account
              <input
                className="account-input"
                value={accountSearch}
                onChange={(event) => setAccountSearch(event.target.value)}
                placeholder="Name or @username"
              />
            </label>
            <button type="submit" disabled={searching}>
              {searching ? "Searching..." : "Search accounts"}
            </button>
          </form>

          {searchResults.length > 0 ? (
            <div className="quick-list-grid" aria-label="Account search results">
              {searchResults.map((entry) => (
                <article className="quick-list-item" key={entry._id}>
                  <strong>{entry.name || entry.username || "Tengacion user"}</strong>
                  <span>@{entry.username || "user"}</span>
                  <div className="account-chip-row">
                    <button type="button" className="account-chip" onClick={() => setPendingBlock(entry)}>
                      Block
                    </button>
                    <button
                      type="button"
                      className="account-chip"
                      onClick={() => runSafetyAction({
                        runner: muteUser,
                        entry,
                        actionLabel: "Mute",
                        successMessage: `Muted @${entry.username || "user"}.`,
                      })}
                    >
                      Mute
                    </button>
                    <button
                      type="button"
                      className="account-chip"
                      onClick={() => runSafetyAction({
                        runner: restrictUser,
                        entry,
                        actionLabel: "Restrict",
                        successMessage: `Restricted @${entry.username || "user"}.`,
                      })}
                    >
                      Restrict
                    </button>
                    <button
                      type="button"
                      className="account-chip"
                      onClick={() => runSafetyAction({
                        runner: hideStoriesFromUser,
                        entry,
                        actionLabel: "Hide stories from",
                        successMessage: `Stories are hidden from @${entry.username || "user"}.`,
                      })}
                    >
                      Hide stories
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {pendingBlock ? (
            <div className="quick-list-item" role="alertdialog" aria-label="Confirm block">
              <strong>Block @{pendingBlock.username || "this account"}?</strong>
              <span>
                You will no longer find each other in people search, profiles, feeds, friend
                suggestions, or direct-message contacts. Existing relationship links are removed.
              </span>
              <div className="account-button-row">
                <button
                  type="button"
                  onClick={() => runSafetyAction({
                    runner: blockUser,
                    entry: pendingBlock,
                    actionLabel: "Block",
                    successMessage: `Blocked @${pendingBlock.username || "user"}.`,
                  })}
                  disabled={safetyBusyKey === `Block:${pendingBlock._id}`}
                >
                  {safetyBusyKey === `Block:${pendingBlock._id}` ? "Blocking..." : "Confirm block"}
                </button>
                <button type="button" className="account-chip" onClick={() => setPendingBlock(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {safetyMessage ? <span className="account-inline-message" role="status">{safetyMessage}</span> : null}
        </div>
      </SectionCard>

      <SectionCard title="Your limited accounts">
        {safetyLoading ? <p className="quick-empty">Loading safety controls...</p> : (
          <div className="quick-list-grid">
            <SafetyList
              title="Blocked accounts"
              description="They cannot find your profile, send a friend request, follow you, or message you."
              entries={safetyLists.blocked}
              actionLabel="Unblock"
              busyKey={safetyBusyKey}
              onAction={(entry) => runSafetyAction({
                runner: unblockUser,
                entry,
                actionLabel: "Unblock",
                successMessage: `Unblocked @${entry.username || "user"}. Connections were not restored.`,
              })}
            />
            <SafetyList
              title="Muted accounts"
              description="Muted accounts remain connected but can be filtered from attention surfaces."
              entries={safetyLists.muted}
              actionLabel="Unmute"
              busyKey={safetyBusyKey}
              onAction={(entry) => runSafetyAction({
                runner: unmuteUser,
                entry,
                actionLabel: "Unmute",
                successMessage: `Unmuted @${entry.username || "user"}.`,
              })}
            />
            <SafetyList
              title="Restricted accounts"
              description="Restricted accounts keep only the limited interaction permissions you allow."
              entries={safetyLists.restricted}
              actionLabel="Unrestrict"
              busyKey={safetyBusyKey}
              onAction={(entry) => runSafetyAction({
                runner: unrestrictUser,
                entry,
                actionLabel: "Unrestrict",
                successMessage: `Unrestricted @${entry.username || "user"}.`,
              })}
            />
            <SafetyList
              title="Stories hidden from"
              description="These accounts cannot see stories you hide from them."
              entries={safetyLists.hiddenStoriesFrom}
              actionLabel="Unhide stories from"
              busyKey={safetyBusyKey}
              onAction={(entry) => runSafetyAction({
                runner: unhideStoriesFromUser,
                entry,
                actionLabel: "Unhide stories from",
                successMessage: `Stories are visible to @${entry.username || "user"} again.`,
              })}
            />
          </div>
        )}
      </SectionCard>
    </QuickAccessLayout>
  );
}
