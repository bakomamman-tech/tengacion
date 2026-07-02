import { useMemo, useState } from "react";
import FilterPanel from "./FilterPanel";
import EmojiPanel from "./EmojiPanel";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "🎉"];

const ControlIcon = ({ name }) => {
  const paths = {
    mic: (
      <>
        <path d="M12 3.5A3.5 3.5 0 0 0 8.5 7v5a3.5 3.5 0 0 0 7 0V7A3.5 3.5 0 0 0 12 3.5Z" />
        <path d="M6.5 11.5a5.5 5.5 0 1 0 11 0M12 17v3.5" />
      </>
    ),
    camera: (
      <>
        <rect x="3.5" y="6" width="12.5" height="12" rx="2.5" />
        <path d="m16 10 4.5-2.5v9L16 14" />
      </>
    ),
    effects: <path d="M12 3.5 13.7 8l4.8 1.2-4 2.8.3 4.9-3.8-3-4.6 1.8 1.7-4.5-3.1-3.7 4.9.2Z" />,
    reaction: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M9 10h.01M15 10h.01M8.7 14c1 1.05 2.1 1.55 3.3 1.55S14.3 15.05 15.3 14" />
      </>
    ),
    screen: (
      <>
        <rect x="3" y="4.5" width="18" height="13" rx="2" />
        <path d="M8 21h8M12 17.5V21M9 11l3-3 3 3M12 8v6" />
      </>
    ),
    chat: <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-5 4v-4.8A2.5 2.5 0 0 1 4 13ZM8 8h8M8 12h5" />,
    people: <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.5 19c.4-4 2.2-6 5.5-6s5.1 2 5.5 6M15.5 5.5a3 3 0 0 1 0 5.5M16.5 13c2.5.5 3.8 2.5 4 5" />,
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
      </>
    ),
    end: <path d="M5 15.5c4.7-3.6 9.3-3.6 14 0l-2.3 3-3.1-2v-2.1a11 11 0 0 0-3.2 0v2.1l-3.1 2Z" />,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
};

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
  quotaRemainingSec,
  micEnabled,
  cameraEnabled,
  onToggleMic,
  onToggleCamera,
  screenShareEnabled,
  onToggleScreenShare,
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
          {Number.isFinite(quotaRemainingSec) && (
            <span className="live-controls-limit">
              {formatElapsed(quotaRemainingSec)} left today
            </span>
          )}
        </div>
      </div>

      <div className="live-toolbar-wrap">
        <div className="live-toolbar">
          <button
            type="button"
            className={`live-tool-btn ${!micEnabled ? "off" : ""}`}
            onClick={onToggleMic}
            aria-label={micEnabled ? "Mute microphone" : "Unmute microphone"}
            title={micEnabled ? "Mute microphone" : "Unmute microphone"}
          >
            <ControlIcon name="mic" />
            <span>{micEnabled ? "Mic" : "Mic off"}</span>
          </button>
          <button
            type="button"
            className={`live-tool-btn ${!cameraEnabled ? "off" : ""}`}
            onClick={onToggleCamera}
            aria-label={cameraEnabled ? "Turn off camera" : "Turn on camera"}
            title={cameraEnabled ? "Turn off camera" : "Turn on camera"}
          >
            <ControlIcon name="camera" />
            <span>{cameraEnabled ? "Camera" : "Camera off"}</span>
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
            <ControlIcon name="effects" />
            <span>Effects</span>
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
            <ControlIcon name="reaction" />
            <span>React</span>
          </button>
          <button
            type="button"
            className={`live-tool-btn ${screenShareEnabled ? "active" : ""}`}
            onClick={onToggleScreenShare}
            aria-label={screenShareEnabled ? "Stop sharing screen" : "Share screen"}
            title={screenShareEnabled ? "Stop sharing screen" : "Share screen"}
          >
            <ControlIcon name="screen" />
            <span>{screenShareEnabled ? "Stop share" : "Present"}</span>
          </button>
          <button
            type="button"
            className={`live-tool-btn ${isChatOpen ? "active" : ""}`}
            onClick={onToggleChat}
          >
            <ControlIcon name="chat" />
            <span>Chat</span>
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
            <ControlIcon name="people" />
            <span>People</span>
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
            <ControlIcon name="settings" />
            <span>Settings</span>
          </button>
          <button type="button" className="live-tool-btn live-end-btn" onClick={() => setConfirmEnd(true)}>
            <ControlIcon name="end" />
            <span>End</span>
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
