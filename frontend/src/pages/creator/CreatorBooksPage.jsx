import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import { updateBookWithUploadProgress } from "../../api";
import CopyrightStatusBadge from "../../components/creator/CopyrightStatusBadge";
import CreatorStatsCard from "../../components/creator/CreatorStatsCard";
import { useCreatorWorkspace } from "../../components/creator/useCreatorWorkspace";
import { formatCurrency, formatShortDate } from "../../components/creator/creatorConfig";

const normalizePublishStatus = (value) => String(value || "draft").trim().toLowerCase();

const approvalToast = (book, fallback = "Book updated") => {
  const status = normalizePublishStatus(book?.publishedStatus);
  if (status === "under_review" || book?.approvalRequired) {
    return "Book submitted for Admin approval";
  }
  if (status === "draft") {
    return "Book draft saved";
  }
  return fallback;
};

function BookEditPanel({ item, onCancel, onSave }) {
  const isPublishedBook = String(item.publishedStatus || "").toLowerCase() === "published";
  const [values, setValues] = useState({
    title: item.title || "",
    description: item.description || "",
    genre: item.genre || "",
    language: item.language || "",
    tags: Array.isArray(item.tags) ? item.tags.join(", ") : "",
    price: String(item.price ?? ""),
    chapterCount: item.chapterCount || item.chapterCount === 0 ? String(item.chapterCount) : "",
    fileFormat: item.fileFormat || "pdf",
    previewExcerptText: item.previewExcerptText || "",
    publishedStatus: item.publishedStatus === "draft" ? "draft" : "published",
    cover: null,
    content: null,
    preview: null,
  });

  const update = (key, value) => setValues((current) => ({ ...current, [key]: value }));

  return (
    <section className="creator-editor-card card">
      <div className="creator-panel-head">
        <div>
          <h3>{isPublishedBook ? "Edit Published Book" : "Edit book metadata"}</h3>
          <p>Update cover, file, pricing, chapter count, and publish mode without leaving the books workspace.</p>
        </div>
      </div>
      <div className="creator-form-grid">
        <label>
          <span>Book title</span>
          <input value={values.title} onChange={(event) => update("title", event.target.value)} />
        </label>
        <label>
          <span>Genre</span>
          <input value={values.genre} onChange={(event) => update("genre", event.target.value)} />
        </label>
        <label>
          <span>Language</span>
          <input value={values.language} onChange={(event) => update("language", event.target.value)} />
        </label>
        <label>
          <span>Tags</span>
          <input value={values.tags} onChange={(event) => update("tags", event.target.value)} />
        </label>
        <label>
          <span>Price</span>
          <input value={values.price} inputMode="numeric" onChange={(event) => update("price", event.target.value)} />
        </label>
        <label>
          <span>Number of Chapters</span>
          <input
            type="number"
            min="0"
            value={values.chapterCount}
            inputMode="numeric"
            onChange={(event) => update("chapterCount", event.target.value)}
          />
        </label>
        <label>
          <span>File format</span>
          <select value={values.fileFormat} onChange={(event) => update("fileFormat", event.target.value)}>
            <option value="pdf">PDF</option>
            <option value="epub">EPUB</option>
            <option value="mobi">MOBI</option>
            <option value="txt">TXT</option>
          </select>
        </label>
        <label>
          <span>Publishing mode</span>
          <select value={values.publishedStatus} onChange={(event) => update("publishedStatus", event.target.value)}>
            <option value="published">Publish</option>
            <option value="draft">Save as draft</option>
          </select>
        </label>
        <label>
          <span>Cover image</span>
          <input type="file" accept="image/*" onChange={(event) => update("cover", event.target.files?.[0] || null)} />
        </label>
        <label>
          <span>Replace book file</span>
          <input type="file" accept=".pdf,.epub,.mobi,.txt" onChange={(event) => update("content", event.target.files?.[0] || null)} />
        </label>
        <label>
          <span>Replace preview file</span>
          <input type="file" accept=".pdf,.epub,.mobi,.txt" onChange={(event) => update("preview", event.target.files?.[0] || null)} />
        </label>
        <label className="creator-form-full">
          <span>Description</span>
          <textarea rows={4} value={values.description} onChange={(event) => update("description", event.target.value)} />
        </label>
        <label className="creator-form-full">
          <span>Preview excerpt</span>
          <textarea rows={4} value={values.previewExcerptText} onChange={(event) => update("previewExcerptText", event.target.value)} />
        </label>
      </div>
      <div className="creator-publish-approval-note" role="note" aria-label="Admin approval required">
        <strong>Admin approval required</strong>
        <span>Publishing submits this manuscript for review. It remains private until an Admin approves it.</span>
      </div>
      <div className="creator-form-actions">
        <button type="button" className="creator-ghost-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="creator-primary-btn" onClick={() => onSave(values)}>
          {values.publishedStatus === "draft" ? "Save changes" : "Submit for Admin Approval"}
        </button>
      </div>
    </section>
  );
}

export default function CreatorBooksPage() {
  const { dashboard, refreshWorkspace } = useCreatorWorkspace();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [editingItem, setEditingItem] = useState(null);

  const books = useMemo(() => dashboard.content?.books?.items || [], [dashboard.content?.books?.items]);
  const analytics = dashboard.content?.books?.analytics || {};

  const sortedBooks = useMemo(
    () => [...books].sort((left, right) => new Date(right.updatedAt || right.createdAt) - new Date(left.updatedAt || left.createdAt)),
    [books]
  );

  const saveEdit = async (values) => {
    if (!editingItem) {
      return;
    }
    try {
      setBusy(true);
      const formData = new FormData();
      formData.append("title", values.title.trim());
      formData.append("description", values.description.trim());
      formData.append("genre", values.genre.trim());
      formData.append("language", values.language.trim());
      formData.append("tags", values.tags.trim());
      formData.append("price", values.price || "0");
      formData.append("chapterCount", values.chapterCount === "" ? "" : String(values.chapterCount));
      formData.append("fileFormat", values.fileFormat || "pdf");
      formData.append("previewExcerptText", values.previewExcerptText.trim());
      formData.append("publishedStatus", values.publishedStatus);
      if (values.cover) {
        formData.append("cover", values.cover);
      }
      if (values.content) {
        formData.append("content", values.content);
      }
      if (values.preview) {
        formData.append("preview", values.preview);
      }

      const updatedBook = await updateBookWithUploadProgress(editingItem._id, formData, { onProgress: setProgress });
      await refreshWorkspace();
      toast.success(approvalToast(updatedBook));
      setEditingItem(null);
    } catch (err) {
      toast.error(err?.message || "Could not update this book");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const submitForApproval = async (book) => {
    try {
      setBusy(true);
      const formData = new FormData();
      formData.append("publishedStatus", "published");
      const updatedBook = await updateBookWithUploadProgress(book._id, formData, { onProgress: setProgress });
      await refreshWorkspace();
      toast.success(approvalToast(updatedBook, "Book submitted for Admin approval"));
    } catch (err) {
      toast.error(err?.message || "Could not submit this book for approval");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  return (
    <div className="creator-page-stack">
      <section className="creator-metric-grid">
        <CreatorStatsCard
          label="Published books"
          value={analytics.activeBooks || 0}
          helper="Titles currently live on your public creator page."
          tone="success"
        />
        <CreatorStatsCard
          label="Downloads"
          value={analytics.totalDownloads || 0}
          helper="Combined reads and paid book retrievals."
        />
        <CreatorStatsCard
          label="Book earnings"
          value={formatCurrency(dashboard.categories?.bookPublishing?.earnings || dashboard.categories?.books?.earnings || 0)}
          helper="Creator share from book purchases."
        />
      </section>

      <section className="creator-inline-notice">
        <div>
          <strong>Dedicated upload page</strong>
          <span>Open the Book Publishing Uploads page for the dedicated manuscript publishing flow. This dashboard now stays focused on your catalog and metadata updates.</span>
        </div>
        <Link className="creator-secondary-btn" to="/creator/books/upload">
          Upload Book
        </Link>
      </section>

      {editingItem ? <BookEditPanel item={editingItem} onCancel={() => setEditingItem(null)} onSave={saveEdit} /> : null}

      <section className="creator-panel card">
        <div className="creator-panel-head">
          <div>
            <h2>Published and draft books</h2>
            <p>Track verification status, update metadata, and keep your book catalog clean.</p>
          </div>
        </div>

        <div className="creator-activity-list">
          {sortedBooks.length ? (
            sortedBooks.map((book) => (
              <article key={book._id} className="creator-release-card">
                <div>
                  <div className="creator-inline-row">
                    <strong>{book.title}</strong>
                    <CopyrightStatusBadge status={book.publishedStatus} />
                  </div>
                  <p>{book.genre || "Book publishing"}</p>
                </div>
                <div className="creator-release-meta">
                  <span>{formatCurrency(book.price || 0)}</span>
                  <span>{Number(book.chapterCount || 0) > 0 ? `${Number(book.chapterCount)} chapters` : "Chapters not set"}</span>
                  <span>{formatShortDate(book.updatedAt || book.createdAt)}</span>
                  <CopyrightStatusBadge status={book.copyrightScanStatus} />
                </div>
                <div className="creator-inline-row">
                  <button type="button" className="creator-ghost-btn" disabled={busy} onClick={() => setEditingItem(book)}>
                    {normalizePublishStatus(book.publishedStatus) === "published" ? "Edit Published Book" : "Edit Book"}
                  </button>
                  {normalizePublishStatus(book.publishedStatus) === "draft" ? (
                    <button
                      type="button"
                      className="creator-primary-btn"
                      disabled={busy}
                      onClick={() => submitForApproval(book)}
                    >
                      Publish for Admin Approval
                    </button>
                  ) : null}
                </div>
              </article>
            ))
          ) : (
            <div className="creator-empty-card">Your books will appear here after your first upload.</div>
          )}
        </div>
      </section>

      {busy ? <div className="creator-upload-progress">Updating book... {progress}%</div> : null}
    </div>
  );
}
