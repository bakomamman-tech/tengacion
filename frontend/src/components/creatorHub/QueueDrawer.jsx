import styles from "./CreatorHub.module.css";

export default function QueueDrawer({
  open,
  queue = [],
  currentIndex = 0,
  onClose,
  onPlay,
  onMove,
  onRemove,
}) {
  if (!open) return null;

  return (
    <aside className={styles.queueDrawer}>
      <div className={styles.sectionHead}>
        <h4>Up Next Queue</h4>
        <button type="button" className={styles.queueBtnSmall} onClick={onClose}>Close</button>
      </div>
      {queue.map((item, index) => (
        <div key={`${item.id}-${index}`} className={styles.queueItem}>
          <p className={styles.itemTitle}>
            {index === currentIndex ? "Now Playing: " : ""}
            {item.title}
          </p>
          <p className={styles.itemMeta}>{item.creatorName || "Creator"}</p>
          <div style={{ marginTop: "0.4rem" }}>
            <button type="button" className={styles.queueBtnSmall} onClick={() => onPlay(index)}>Play</button>
            <button type="button" className={styles.queueBtnSmall} onClick={() => onMove(index, index - 1)} disabled={index === 0}>Up</button>
            <button type="button" className={styles.queueBtnSmall} onClick={() => onMove(index, index + 1)} disabled={index === queue.length - 1}>Down</button>
            <button type="button" className={styles.queueBtnSmall} onClick={() => onRemove(index)}>Remove</button>
          </div>
        </div>
      ))}
      {!queue.length ? <p className={styles.mutedText}>Queue is empty.</p> : null}
    </aside>
  );
}
