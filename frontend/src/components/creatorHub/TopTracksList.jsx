import styles from "./CreatorHub.module.css";

const formatPrice = (item, mode) => {
  const value = mode === "GLOBAL" ? Number(item.priceUSD || 0) : Number(item.priceNGN || 0);
  if (value <= 0 || item.isFree) return "Free";
  return mode === "GLOBAL" ? `$${value.toFixed(2)}` : `NGN ${value.toLocaleString()}`;
};

export function TopTracksList({ tracks = [], currencyMode = "NG", creatorName = "", onPlay, onViewAll, onCheckout, onTrackMenu }) {
  return (
    <article className={styles.sectionCard}>
      <div className={styles.sectionHead}>
        <h3>Top Tracks</h3>
        <div>
          <button type="button" className={styles.shuffleBtn} onClick={() => onPlay(tracks[0], tracks)}>Shuffle</button>
          <button type="button" className={styles.viewAll} onClick={onViewAll}>View All</button>
        </div>
      </div>
      {tracks.length ? (
        tracks.map((track, index) => (
          <div key={track.id} className={styles.trackRow}>
            <span>{index + 1}</span>
            <img className={styles.trackCover} src={track.coverUrl || "/avatar.png"} alt={track.title} />
            <div>
              <span className={styles.trackName}>{track.title}</span>
              <span className={styles.trackCreator}>{creatorName}</span>
            </div>
            <button type="button" className={styles.playBtn} onClick={() => onPlay(track, tracks)}>Play</button>
            <button type="button" className={styles.menuBtn} onClick={() => onTrackMenu(track)}>...</button>
            <span className={styles.mutedText}>{Number(track.playsCount || 0).toLocaleString()} plays</span>
            <span className={styles.mutedText}>{formatPrice(track, currencyMode)}</span>
            {!track.isFree ? (
              <button type="button" className={styles.buyBtn} onClick={() => onCheckout("song", track.id)}>Buy</button>
            ) : null}
          </div>
        ))
      ) : (
        <p className={styles.mutedText}>No tracks uploaded yet.</p>
      )}
    </article>
  );
}

export function TopTracksWidget({ tracks = [] }) {
  return (
    <aside className={`${styles.sectionCard} ${styles.topWidget}`}>
      <div className={styles.sectionHead}><h4>Top Tracks</h4></div>
      {tracks.length ? (
        <ul>
          {tracks.slice(0, 6).map((track) => (
            <li key={track.id}>{track.title}</li>
          ))}
        </ul>
      ) : (
        <p className={styles.mutedText}>No top tracks yet.</p>
      )}
    </aside>
  );
}
