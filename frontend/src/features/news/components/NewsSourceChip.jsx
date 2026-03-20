import { Link } from "react-router-dom";

export default function NewsSourceChip({ source, compact = false }) {
  if (!source) {
    return null;
  }

  return (
    <Link
      to={`/news/source/${source.slug}`}
      className={`news-source-chip ${compact ? "compact" : ""}`}
    >
      {source.logoUrl ? (
        <img src={source.logoUrl} alt={source.displayName || source.publisherName || "Source"} />
      ) : (
        <span className="news-source-chip-mark" aria-hidden="true">
          {String(source.displayName || source.publisherName || "S").slice(0, 1)}
        </span>
      )}
      <span>{source.displayName || source.publisherName || "Source"}</span>
    </Link>
  );
}
