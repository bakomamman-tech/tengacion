import styles from "./CreatorHub.module.css";

const formatTime = (seconds) => {
  const value = Math.max(0, Number(seconds || 0));
  const mins = Math.floor(value / 60);
  const secs = Math.floor(value % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
};

export default function MiniPlayer({
  currentItem,
  isPlaying,
  position,
  duration,
  volume,
  unlockRequired,
  onTogglePlay,
  onPrev,
  onNext,
  onSeek,
  onVolume,
  onToggleQueue,
  onFlow,
  onUnlock,
}) {
  if (!currentItem) return null;

  return (
    <div className={styles.playerDock}>
      <div className={styles.playerInner}>
        <div className={styles.playerTrack}>
          <img className={styles.playerCover} src={currentItem.coverUrl || "/avatar.png"} alt={currentItem.title || "Now playing"} />
          <div>
            <p className={styles.itemTitle} style={{ margin: 0 }}>{currentItem.title}</p>
            <p className={styles.itemMeta} style={{ margin: 0 }}>{currentItem.creatorName || "Creator"}</p>
          </div>
        </div>

        <div>
          <div className={styles.playerControls}>
            <button type="button" className={styles.roundBtn} onClick={onPrev} aria-label="Previous">&#9664;</button>
            <button type="button" className={styles.roundBtn} onClick={onTogglePlay} aria-label="Play or pause">
              {isPlaying ? "||" : ">"}
            </button>
            <button type="button" className={styles.roundBtn} onClick={onNext} aria-label="Next">&#9654;</button>
          </div>
          <div className={styles.playerProgress}>
            <span>{formatTime(position)}</span>
            <input
              type="range"
              min="0"
              max={Math.max(1, Number(duration || 0))}
              value={Math.min(Number(position || 0), Math.max(1, Number(duration || 0)))}
              className={styles.progressInput}
              onChange={(event) => onSeek(Number(event.target.value || 0))}
            />
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className={styles.playerControls} style={{ justifyContent: "flex-end" }}>
          <button type="button" className={styles.queueBtn} onClick={onToggleQueue}>Queue</button>
          <button type="button" className={styles.flowBtn} onClick={onFlow}>Tengacion Flow</button>
          <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => onVolume(Number(event.target.value || 0.8))} />
        </div>
      </div>
      {unlockRequired ? (
        <div className={styles.unlockHint}>
          Preview ended. Unlock to continue full stream.
          <button type="button" className={styles.buyBtn} onClick={onUnlock} style={{ marginLeft: "0.5rem" }}>Unlock</button>
        </div>
      ) : null}
    </div>
  );
}
