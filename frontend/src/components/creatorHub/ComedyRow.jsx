import styles from "./CreatorHub.module.css";

const priceText = (item, mode) => {
  const amount = mode === "GLOBAL" ? Number(item.priceUSD || 0) : Number(item.priceNGN || 0);
  if (amount <= 0 || item.isFree) return "Free stream";
  return mode === "GLOBAL" ? `$${amount.toFixed(2)}` : `NGN ${amount.toLocaleString()}`;
};

export default function ComedyRow({ items = [], onPlay, onViewAll, currencyMode = "NG", onCheckout, onMenu }) {
  return (
    <article className={styles.sectionCard}>
      <div className={styles.sectionHead}>
        <h4>Latest Comedy Videos</h4>
        <button type="button" className={styles.viewAll} onClick={onViewAll}>View All</button>
      </div>
      <div className={styles.rowScroller}>
        {items.slice(0, 6).map((video) => (
          <div key={video.id} className={styles.itemCard}>
            <img className={styles.itemThumb} src={video.coverUrl || "/avatar.png"} alt={video.title} />
            <p className={styles.itemTitle}>{video.title}</p>
            <p className={styles.itemMeta}>{Number(video.viewsCount || 0).toLocaleString()} views · {priceText(video, currencyMode)}</p>
            <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.45rem" }}>
              <button type="button" className={styles.playBtn} onClick={() => onPlay(video, items)}>Play</button>
              {!video.isFree ? (
                <button type="button" className={styles.buyBtn} onClick={() => onCheckout("video", video.id)}>Unlock</button>
              ) : null}
              <button type="button" className={styles.menuBtn} onClick={() => onMenu(video)}>...</button>
            </div>
          </div>
        ))}
      </div>
      {!items.length ? <p className={styles.mutedText}>No comedy videos yet.</p> : null}
    </article>
  );
}
