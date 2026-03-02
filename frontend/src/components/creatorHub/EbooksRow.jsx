import styles from "./CreatorHub.module.css";

const fmtPrice = (book, mode) => {
  const amount = mode === "GLOBAL" ? Number(book.priceUSD || 0) : Number(book.priceNGN || 0);
  if (amount <= 0 || !book.purchaseRequired) return "Free";
  return mode === "GLOBAL" ? `$${amount.toFixed(2)}` : `NGN ${amount.toLocaleString()}`;
};

export default function EbooksRow({ books = [], onViewAll, onCheckout, onDownload, currencyMode = "NG", onMenu }) {
  return (
    <article className={styles.sectionCard}>
      <div className={styles.sectionHead}>
        <h4>My eBooks</h4>
        <button type="button" className={styles.viewAll} onClick={onViewAll}>View All</button>
      </div>
      <div className={styles.rowScroller}>
        {books.slice(0, 8).map((book) => (
          <div key={book.id} className={styles.itemCard}>
            <img className={styles.itemThumb} src={book.coverUrl || "/avatar.png"} alt={book.title} />
            <p className={styles.itemTitle}>{book.title}</p>
            <p className={styles.itemMeta}>{fmtPrice(book, currencyMode)}</p>
            <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.45rem" }}>
              {book.purchaseRequired ? (
                <button type="button" className={styles.buyBtn} onClick={() => onCheckout("ebook", book.id)}>Buy</button>
              ) : null}
              <button type="button" className={styles.ctaBtn} onClick={() => onDownload(book)}>Download</button>
              <button type="button" className={styles.menuBtn} onClick={() => onMenu(book)}>...</button>
            </div>
          </div>
        ))}
      </div>
      {!books.length ? <p className={styles.mutedText}>No books uploaded yet.</p> : null}
    </article>
  );
}
