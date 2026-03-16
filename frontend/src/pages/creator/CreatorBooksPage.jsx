import { useMemo, useState } from "react";
import toast from "react-hot-toast";

import {
  createCreatorBook,
  updateBookWithUploadProgress,
} from "../../api";
import CopyrightStatusBadge from "../../components/creator/CopyrightStatusBadge";
import CreatorStatsCard from "../../components/creator/CreatorStatsCard";
import BookUploadForm from "../../components/creator/upload/BookUploadForm";
import { useCreatorWorkspace } from "../../components/creator/useCreatorWorkspace";
import { formatCurrency, formatShortDate } from "../../components/creator/creatorConfig";
import { useUnsavedChangesPrompt } from "../../hooks/useUnsavedChangesPrompt";

const EMPTY_BOOK_FORM = {
  bookTitle: "",
  description: "",
  genre: "",
  language: "",
  tags: "",
  price: "",
  fileFormat: "pdf",
  previewExcerptText: "",
  coverImageFile: null,
  fullBookFile: null,
  previewSampleFile: null,
};

function BookEditPanel({ item, onCancel, onSave }) {
  const [values, setValues] = useState({
    title: item.title || "",
    description: item.description || "",
    genre: item.genre || "",
    language: item.language || "",
    tags: Array.isArray(item.tags) ? item.tags.join(", ") : "",
    price: String(item.price ?? ""),
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
          <h3>Edit book metadata</h3>
          <p>Update cover, file, pricing, and publish mode without leaving the books workspace.</p>
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
      <div className="creator-form-actions">
        <button type="button" className="creator-ghost-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="creator-primary-btn" onClick={() => onSave(values)}>
          Save changes
        </button>
      </div>
    </section>
  );
}

export default function CreatorBooksPage() {
  const { dashboard, refreshWorkspace } = useCreatorWorkspace();
  const [bookForm, setBookForm] = useState(EMPTY_BOOK_FORM);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [editingItem, setEditingItem] = useState(null);

  const books = useMemo(() => dashboard.content?.books?.items || [], [dashboard.content?.books?.items]);
  const analytics = dashboard.content?.books?.analytics || {};

  const sortedBooks = useMemo(
    () => [...books].sort((left, right) => new Date(right.updatedAt || right.createdAt) - new Date(left.updatedAt || left.createdAt)),
    [books]
  );

  const dirty = Boolean(
    bookForm.bookTitle ||
      bookForm.description ||
      bookForm.genre ||
      bookForm.language ||
      bookForm.tags ||
      bookForm.price ||
      bookForm.previewExcerptText ||
      bookForm.coverImageFile ||
      bookForm.fullBookFile ||
      bookForm.previewSampleFile
  );

  useUnsavedChangesPrompt(dirty);

  const resetForm = () => setBookForm(EMPTY_BOOK_FORM);

  const submitBook = async (publishedStatus) => {
    if (!bookForm.bookTitle.trim()) {
      toast.error("Book title is required");
      return;
    }
    if (!bookForm.fullBookFile) {
      toast.error("Choose a book file");
      return;
    }
    const formData = new FormData();
    formData.append("title", bookForm.bookTitle.trim());
    formData.append("description", bookForm.description.trim());
    formData.append("genre", bookForm.genre.trim());
    formData.append("language", bookForm.language.trim());
    formData.append("tags", bookForm.tags.trim());
    formData.append("price", bookForm.price || "0");
    formData.append("fileFormat", bookForm.fileFormat);
    formData.append("previewExcerptText", bookForm.previewExcerptText.trim());
    formData.append("publishedStatus", publishedStatus);
    formData.append("content", bookForm.fullBookFile);
    if (bookForm.coverImageFile) {
      formData.append("cover", bookForm.coverImageFile);
    }
    if (bookForm.previewSampleFile) {
      formData.append("preview", bookForm.previewSampleFile);
    }

    try {
      setBusy(true);
      setProgress(0);
      await createCreatorBook(formData, { onProgress: setProgress });
      await refreshWorkspace();
      toast.success(publishedStatus === "draft" ? "Book draft saved" : "Book uploaded");
      resetForm();
    } catch (err) {
      toast.error(err?.message || "Could not upload book");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

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

      await updateBookWithUploadProgress(editingItem._id, formData, { onProgress: setProgress });
      await refreshWorkspace();
      toast.success("Book updated");
      setEditingItem(null);
    } catch (err) {
      toast.error(err?.message || "Could not update this book");
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

      <section className="creator-upload-notice card">
        <strong>Copyright screening</strong>
        <p>
          Book uploads are screened with file hashing, duplicate checks, and metadata similarity so suspicious items can
          be held for review.
        </p>
      </section>

      <BookUploadForm
        value={bookForm}
        onChange={(key, nextValue) => setBookForm((current) => ({ ...current, [key]: nextValue }))}
        busy={busy}
        progress={progress}
        onSaveDraft={() => submitBook("draft")}
        onPublish={() => submitBook("published")}
      />

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
                  <span>{formatShortDate(book.updatedAt || book.createdAt)}</span>
                  <CopyrightStatusBadge status={book.copyrightScanStatus} />
                </div>
                <button type="button" className="creator-ghost-btn" onClick={() => setEditingItem(book)}>
                  Edit metadata
                </button>
              </article>
            ))
          ) : (
            <div className="creator-empty-card">Your books will appear here after your first upload.</div>
          )}
        </div>
      </section>
    </div>
  );
}
