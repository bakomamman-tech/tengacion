import { resolveImage } from "../../api";

const formatDuration = (seconds) => {
  const total = Number(seconds) || 0;
  const mins = Math.floor(total / 60);
  const secs = Math.floor(total % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
};

export default function NowPlayingSidebar({
  styles,
  creator,
  currentTrack,
  isPlaying,
  onPlayPause,
}) {
  if (!currentTrack) {
    return (
      <aside className={styles.sidebar}>
        <section className={styles.sideCard}>
          <h3>Now Playing</h3>
          <p className={styles.empty}>
            Select a song from Popular to start playback.
          </p>
        </section>

        <section className={styles.sideCard}>
          <h3>Credits</h3>
          <div className={styles.credits}>
            <p>{creator?.displayName || "Creator"} - Main Artist</p>
            <p>{creator?.displayName || "Creator"} - Producer</p>
          </div>
        </section>
      </aside>
    );
  }

  const coverUrl =
    resolveImage(currentTrack.coverImageUrl || "") || "/tengacion_logo_256.png";

  return (
    <aside className={styles.sidebar}>
      <section className={styles.sideCard}>
        <h3>Now Playing</h3>
        <img src={coverUrl} alt={`${currentTrack.title} cover`} className={styles.nowCover} />
        <h4>{currentTrack.title}</h4>
        <p>{creator?.displayName || "Creator"}</p>
        <p className={styles.nowDuration}>{formatDuration(currentTrack.durationSec)}</p>
        <button type="button" onClick={onPlayPause} className={styles.nowBtn}>
          {isPlaying ? "Pause" : "Play"}
        </button>
      </section>

      <section className={styles.sideCard}>
        <h3>Credits</h3>
        <div className={styles.credits}>
          <p>{creator?.displayName || "Creator"} - Main Artist</p>
          <p>{creator?.displayName || "Creator"} - Producer</p>
        </div>
      </section>
    </aside>
  );
}
