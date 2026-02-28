import { resolveImage } from "../../api";

const compactNumber = (value) =>
  new Intl.NumberFormat("en", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(Number(value) || 0);

export default function CreatorSongsHeader({
  styles,
  creator,
  audienceCount,
  onPlayTopTrack,
  onToggleFollow,
  isFollowing,
  canPlay,
}) {
  const avatarUrl =
    resolveImage(
      creator?.profilePhoto ||
        creator?.user?.avatar ||
        creator?.coverImageUrl ||
        ""
    ) || "/tengacion_logo_128.png";

  return (
    <header className={styles.hero}>
      <div className={styles.heroOverlay} />
      <div className={styles.heroContent}>
        <img
          src={avatarUrl}
          alt={creator?.displayName || "Creator avatar"}
          className={styles.avatar}
        />

        <div className={styles.identity}>
          <p className={styles.kicker}>Artist</p>
          <h1>{creator?.displayName || "Creator"}</h1>
          <p className={styles.meta}>
            {compactNumber(audienceCount)} monthly listeners
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.playBtn}
              onClick={onPlayTopTrack}
              disabled={!canPlay}
            >
              Play
            </button>
            <button
              type="button"
              className={styles.followBtn}
              onClick={onToggleFollow}
            >
              {isFollowing ? "Following" : "Follow"}
            </button>
            <button
              type="button"
              className={styles.moreBtn}
              aria-label="More options"
            >
              ...
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
