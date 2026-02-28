import { resolveImage } from "../../api";

const formatDuration = (seconds) => {
  const total = Number(seconds) || 0;
  const mins = Math.floor(total / 60);
  const secs = Math.floor(total % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
};

export default function PopularSongsList({
  styles,
  tracks,
  currentTrackId,
  isPlaying,
  onPlayTrack,
  onOpenTrack,
}) {
  return (
    <section className={styles.section}>
      <h2>Popular</h2>
      {!tracks.length ? (
        <p className={styles.empty}>No songs uploaded yet.</p>
      ) : (
        <div className={styles.popularList} role="list">
          {tracks.map((track, index) => {
            const isCurrent = currentTrackId === track._id;
            const coverUrl =
              resolveImage(track.coverImageUrl || "") || "/tengacion_logo_64.png";

            return (
              <article
                key={track._id}
                className={`${styles.popularRow} ${isCurrent ? styles.active : ""}`}
                onClick={() => onPlayTrack(track)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onPlayTrack(track);
                  }
                }}
                role="listitem"
                tabIndex={0}
              >
                <span className={styles.popularIndex}>
                  {isCurrent && isPlaying ? "||" : index + 1}
                </span>
                <img
                  src={coverUrl}
                  alt={`${track.title} cover`}
                  className={styles.popularCover}
                />
                <span className={styles.popularTitle}>{track.title}</span>
                <span className={styles.popularDuration}>
                  {formatDuration(track.durationSec)}
                </span>
                <span className={styles.popularPrice}>
                  NGN {Number(track.price || 0).toLocaleString()}
                </span>
                <button
                  type="button"
                  className={styles.rowMore}
                  aria-label={`Open ${track.title}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenTrack(track);
                  }}
                >
                  ...
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
