import styles from "./CreatorHub.module.css";
import { buttonStyles, cx } from "../ui/buttonStyles";

const fmtDuration = (sec) => {
  const total = Math.max(0, Number(sec || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

export default function LatestPodcastsWidget({ podcasts = [], onPlay, onViewAll, onCheckout, currencyMode = "NG" }) {
  const formatPrice = (item) => {
    const amount = currencyMode === "GLOBAL" ? Number(item.priceUSD || 0) : Number(item.priceNGN || 0);
    if (amount <= 0 || item.isFree) {
      return "Free";
    }
    return currencyMode === "GLOBAL" ? `$${amount.toFixed(2)}` : `NGN ${amount.toLocaleString()}`;
  };

  return (
    <article className={styles.sectionCard}>
      <div className={styles.sectionHead}>
        <h4>Latest Podcasts</h4>
        <button type="button" className={cx(buttonStyles({ variant: "ghost", size: "sm" }), styles.viewAll)} onClick={onViewAll}>View All</button>
      </div>
      {podcasts.length ? (
        podcasts.slice(0, 8).map((podcast) => (
          <div key={podcast.id} className={styles.trackRow}>
            <img className={styles.trackCover} src={podcast.coverUrl || "/avatar.png"} alt={podcast.title} />
            <div>
              <span className={styles.trackName}>{podcast.title}</span>
              <span className={styles.trackCreator}>{fmtDuration(podcast.durationSec)}</span>
            </div>
            <button type="button" className={cx(buttonStyles({ variant: "secondary", size: "sm" }), styles.playBtn)} onClick={() => onPlay(podcast, podcasts)}>Play</button>
            <span className={styles.mutedText}>{formatPrice(podcast)}</span>
            {!podcast.isFree ? (
              <button type="button" className={cx(buttonStyles({ variant: "primary", size: "sm" }), styles.buyBtn)} onClick={() => onCheckout("podcast", podcast.id)}>Buy</button>
            ) : null}
          </div>
        ))
      ) : (
        <p className={styles.mutedText}>No podcasts yet.</p>
      )}
    </article>
  );
}

