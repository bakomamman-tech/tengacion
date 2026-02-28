import { useMemo, useState } from "react";
import FilterPanel from "./FilterPanel";
import EmojiPanel from "./EmojiPanel";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "🎉"];

const formatElapsed = (value) => {
  const total = Math.max(0, Number(value) || 0);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

export default function LiveControlsBar({
  session,
  viewerCount,
  hostName,
  elapsedSec,
  micEnabled,
  cameraEnabled,
  onToggleMic,
  onToggleCamera,
  filter,
  blurEnabled,
  onChangeFilter,
  onToggleBlur,
  onReact,
  onToggleChat,
  isChatOpen,
  onEndLive,
  participants,
}) {
  const [showFilters, setShowFilters] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [quality, setQuality] = useState("auto");
  const [confirmEnd, setConfirmEnd] = useState(false);

  const participantsList = useMemo(() => {
    if (Array.isArray(participants) && participants.length) {
      return participants;
    }
    return [hostName || "Host"];
  }, [hostName, participants]);

  const closePopovers = () => {
    setShowFilters(false);
    setShowEmojis(false);
    setShowParticipants(false);
    setShowSettings(false);
  };

  return (
    <div className="live-controls-shell">
      <div className="live-controls-top">
        <div>
          <strong>{session?.title || "Streaming now"}</strong>
          <p>Hosting as {hostName}</p>
        </div>
        <div className="live-controls-stats">
          <span>{viewerCount || 0} live viewers</span>
          <span className="live-controls-timer">{formatElapsed(elapsedSec)}</span>
        </div>
      </div>

      <div className="live-toolbar-wrap">
        <div className="live-toolbar">
          <button type="button" className={`live-tool-btn ${!micEnabled ? "off" : ""}`} onClick={onToggleMic}>
            {micEnabled ? "Mute mic" : "Unmute mic"}
          </button>
          <button
            type="button"
            className={`live-tool-btn ${!cameraEnabled ? "off" : ""}`}
            onClick={onToggleCamera}
          >
            {cameraEnabled ? "Stop video" : "Start video"}
          </button>
          <button
            type="button"
            className={`live-tool-btn ${showFilters ? "active" : ""}`}
            onClick={() => {
              setShowFilters((prev) => !prev);
              setShowEmojis(false);
              setShowParticipants(false);
              setShowSettings(false);
            }}
          >
            Filters
          </button>
          <button
            type="button"
            className={`live-tool-btn ${showEmojis ? "active" : ""}`}
            onClick={() => {
              setShowEmojis((prev) => !prev);
              setShowFilters(false);
              setShowParticipants(false);
              setShowSettings(false);
            }}
          >
            Reactions
          </button>
          <button type="button" className="live-tool-btn" disabled title="Coming soon">
            Screen share
          </button>
          <button
            type="button"
            className={`live-tool-btn ${isChatOpen ? "active" : ""}`}
            onClick={onToggleChat}
          >
            Chat
          </button>
          <button
            type="button"
            className={`live-tool-btn ${showParticipants ? "active" : ""}`}
            onClick={() => {
              setShowParticipants((prev) => !prev);
              setShowFilters(false);
              setShowEmojis(false);
              setShowSettings(false);
            }}
          >
            Participants
          </button>
          <button
            type="button"
            className={`live-tool-btn ${showSettings ? "active" : ""}`}
            onClick={() => {
              setShowSettings((prev) => !prev);
              setShowFilters(false);
              setShowEmojis(false);
              setShowParticipants(false);
            }}
          >
            Settings
          </button>
          <button type="button" className="live-tool-btn live-end-btn" onClick={() => setConfirmEnd(true)}>
            End live
          </button>
        </div>

        <FilterPanel
          open={showFilters}
          currentFilter={filter}
          blurEnabled={blurEnabled}
          onSelectFilter={(next) => {
            onChangeFilter(next);
            closePopovers();
          }}
          onToggleBlur={onToggleBlur}
        />

        <EmojiPanel
          open={showEmojis}
          onPick={(emoji) => {
            onReact(emoji);
          }}
        />

        {showParticipants && (
          <div className="live-popover">
            <p className="live-popover-title">Participants / viewers</p>
            <p className="live-participants-total">{viewerCount || 0} watching now</p>
            <ul className="live-participants-list">
              {participantsList.map((entry, index) => (
                <li key={`${entry}-${index}`}>{entry}</li>
              ))}
            </ul>
          </div>
        )}

        {showSettings && (
          <div className="live-popover">
            <p className="live-popover-title">Settings</p>
            <label className="live-settings-label">
              Stream quality
              <select value={quality} onChange={(event) => setQuality(event.target.value)}>
                <option value="auto">Auto</option>
                <option value="720p">720p</option>
                <option value="480p">480p</option>
              </select>
            </label>
            <p className="live-settings-note">
              Device switcher can be added next with available track devices.
            </p>
          </div>
        )}
      </div>

      <div className="live-quick-reactions">
        {QUICK_REACTIONS.map((emoji) => (
          <button key={emoji} type="button" className="live-quick-btn" onClick={() => onReact(emoji)}>
            {emoji}
          </button>
        ))}
      </div>

      {confirmEnd && (
        <div className="live-confirm-backdrop">
          <div className="live-confirm-card">
            <h4>End live stream?</h4>
            <p>Your stream will stop for all viewers.</p>
            <div className="live-confirm-actions">
              <button type="button" onClick={() => setConfirmEnd(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="live-end-btn"
                onClick={() => {
                  setConfirmEnd(false);
                  onEndLive();
                }}
              >
                End live
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
