import { useMemo, useState } from "react";
import toast from "react-hot-toast";

import {
  createBookWithUploadProgress,
  updateBookWithUploadProgress,
} from "../../api";
import CopyrightStatusBadge from "../../components/creator/CopyrightStatusBadge";
import { useCreatorWorkspace } from "../../components/creator/useCreatorWorkspace";
import { formatCurrency, formatShortDate } from "../../components/creator/creatorConfig";
import { useUnsavedChangesPrompt } from "../../hooks/useUnsavedChangesPrompt";

const EMPTY_BOOK_FORM = {
  title: "",
  description: "",
  genre: "",
  price: "",
  fileFormat: "pdf",
  previewExcerptText: "",
  cover: null,
  content: null,
  preview: null,
};

function BookEditPanel({ item, onCancel, onSave }) {
  const [values, setValues] = useState({
    title: item.title || "",
    description: item.description || "",
    genre: item.genre || "",
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

  const books = dashboard.content?.books?.items || [];
  const analytics = dashboard.content?.books?.analytics || {};

  const sortedBooks = useMemo(
    () => [...books].sort((left, right) => new Date(right.updatedAt || right.createdAt) - new Date(left.updatedAt || left.createdAt)),
    [books]
  );

  const dirty = Boolean(
    bookForm.title ||
      bookForm.description ||
      bookForm.genre ||
      bookForm.price ||
      bookForm.previewExcerptText ||
      bookForm.cover ||
      bookForm.content ||
      bookForm.preview
  );

  useUnsavedChangesPrompt(dirty);

  const resetForm = () => setBookForm(EMPTY_BOOK_FORM);

  const submitBook = async (publishedStatus) => {
    if (!bookForm.title.trim()) {
      toast.error("Book title is required");
      return;
    }
    if (!bookForm.content) {
      toast.error("Choose a book file");
      return;
    }
    const formData = new FormData();
    formData.append("title", bookForm.title.trim());
    formData.append("description", bookForm.description.trim());
    formData.append("genre", bookForm.genre.trim());
    formData.append("price", bookForm.price || "0");
    formData.append("fileFormat", bookForm.fileFormat);
    formData.append("previewExcerptText", bookForm.previewExcerptText.trim());
    formData.append("publishedStatus", publishedStatus);
    formData.append("content", bookForm.content);
    if (bookForm.cover) formData.append("cover", bookForm.cover);
    if (bookForm.preview) formData.append("preview", bookForm.preview);

    try {
      setBusy(true);
      setProgress(0);
      await createBookWithUploadProgress(formData, { onProgress: setProgress });
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
      formData.append("price", values.price || "0");
      formData.append("fileFormat", values.fileFormat || "pdf");
      formData.append("previewExcerptText", values.previewExcerptText.trim());
      formData.append("publishedStatus", values.publishedStatus);
      if (values.cover) formData.append("cover", values.cover);
      if (values.content) formData.append("content", values.content);
      if (values.preview) formData.append("preview", values.preview);

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
        <article className="creator-metric-card card">
          <span>Active books</span>
          <strong>{analytics.activeBooks || 0}</strong>
        </article>
        <article className="creator-metric-card card">
          <span>Total book purchases</span>
          <strong>{analytics.totalDownloads || 0}</strong>
        </article>
        <article className="creator-metric-card card">
          <span>Book earnings</span>
          <strong>{formatCurrency(dashboard.categories?.books?.earnings || 0)}</strong>
        </article>
      </section>

      <section className="creator-upload-notice card">
        <strong>Copyright screening</strong>
        <p>
          Book uploads are screened with file hashing, duplicate checks, and metadata similarity so suspicious items can
          be held for review.
        </p>
      </section>

      <section className="creator-panel card">
        <div className="creator-panel-head">
          <div>
            <h2>Upload Book</h2>
            <p>Publish ebooks, PDFs, EPUBs, MOBI files, and text releases without mixing them into music or podcast tools.</p>
          </div>
        </div>

        <div className="creator-form-grid">
          <label>
            <span>Book title</span>
            <input value={bookForm.title} onChange={(event) => setBookForm((current) => ({ ...current, title: event.target.value }))} />
          </label>
          <label>
            <span>Genre / category</span>
            <input value={bookForm.genre} onChange={(event) => setBookForm((current) => ({ ...current, genre: event.target.value }))} />
          </label>
          <label>
            <span>Price</span>
            <input value={bookForm.price} inputMode="numeric" onChange={(event) => setBookForm((current) => ({ ...current, price: event.target.value }))} />
          </label>
          <label>
            <span>File format</span>
            <select value={bookForm.fileFormat} onChange={(event) => setBookForm((current) => ({ ...current, fileFormat: event.target.value }))}>
              <option value="pdf">PDF</option>
              <option value="epub">EPUB</option>
              <option value="mobi">MOBI</option>
              <option value="txt">TXT</option>
            </select>
          </label>
          <label>
            <span>Cover image</span>
            <input type="file" accept="image/*" onChange={(event) => setBookForm((current) => ({ ...current, cover: event.target.files?.[0] || null }))} />
          </label>
          <label>
            <span>Book file</span>
            <input type="file" accept=".pdf,.epub,.mobi,.txt" onChange={(event) => setBookForm((current) => ({ ...current, content: event.target.files?.[0] || null }))} />
          </label>
          <label>
            <span>Preview file</span>
            <input type="file" accept=".pdf,.epub,.mobi,.txt" onChange={(event) => setBookForm((current) => ({ ...current, preview: event.target.files?.[0] || null }))} />
          </label>
          <label className="creator-form-full">
            <span>Description</span>
            <textarea rows={4} value={bookForm.description} onChange={(event) => setBookForm((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <label className="creator-form-full">
            <span>Preview excerpt</span>
            <textarea rows={4} value={bookForm.previewExcerptText} onChange={(event) => setBookForm((current) => ({ ...current, previewExcerptText: event.target.value }))} />
          </label>
        </div>

        {busy ? <div className="creator-upload-progress">Uploading... {progress}%</div> : null}

        <div className="creator-form-actions">
          <button type="button" className="creator-ghost-btn" disabled={busy} onClick={() => submitBook("draft")}>
            Save draft
          </button>
          <button type="button" className="creator-primary-btn" disabled={busy} onClick={() => submitBook("published")}>
            Publish book
          </button>
        </div>
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
