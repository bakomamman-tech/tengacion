import styles from "./CreatorHub.module.css";

export default function ContinueListeningRow({ items = [], onPlay }) {
  if (!items.length) {
    return (
      <article className={styles.sectionCard}>
        <div className={styles.sectionHead}><h3>Continue Listening</h3></div>
        <p className={styles.mutedText}>No listening history yet.</p>
      </article>
    );
  }

  return (
    <article className={styles.sectionCard}>
      <div className={styles.sectionHead}><h3>Continue Listening</h3></div>
      <div className={styles.rowScroller}>
        {items.map((item) => (
          <div key={`${item.type}-${item.itemId}`} className={styles.itemCard}>
            <img className={styles.itemThumb} src={item.coverUrl || "/avatar.png"} alt={item.title} />
            <p className={styles.itemTitle}>{item.title}</p>
            <p className={styles.itemMeta}>{item.type === "podcast" ? "Podcast" : "Song"} · {Math.floor(Number(item.progressSec || 0))}s</p>
            <button type="button" className={styles.playBtn} onClick={() => onPlay(item)}>Play</button>
          </div>
        ))}
      </div>
    </article>
  );
}
