import { buildPdfViewerSrc } from "../../utils/pdfViewer";
import "./BookPdfSurface.css";

export default function BookPdfSurface({
  src = "",
  title = "Book PDF",
  mode = "preview",
  className = "",
  caption = "",
}) {
  const viewerSrc = buildPdfViewerSrc(src);
  const label = mode === "full" ? "Full book reader" : "Book preview reader";

  return (
    <div
      className={`book-pdf-surface${className ? ` ${className}` : ""}`}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="book-pdf-surface__head">
        <span>{label}</span>
        {caption ? <small>{caption}</small> : null}
      </div>
      {viewerSrc ? (
        <iframe
          className="book-pdf-surface__frame"
          src={viewerSrc}
          title={title}
          loading="lazy"
          referrerPolicy="same-origin"
        />
      ) : (
        <div className="book-pdf-surface__empty">
          PDF reader unavailable for this book.
        </div>
      )}
    </div>
  );
}
