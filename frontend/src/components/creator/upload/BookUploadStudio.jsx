import { useState } from "react";
import toast from "react-hot-toast";

import { createCreatorBook } from "../../../api";
import { useUnsavedChangesPrompt } from "../../../hooks/useUnsavedChangesPrompt";
import { useCreatorWorkspace } from "../useCreatorWorkspace";
import BookUploadForm from "./BookUploadForm";

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

export default function BookUploadStudio({ showNotice = true }) {
  const { refreshWorkspace } = useCreatorWorkspace();
  const [bookForm, setBookForm] = useState(EMPTY_BOOK_FORM);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

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

  return (
    <div className="creator-upload-studio-shell">
      {showNotice ? (
        <section className="creator-upload-notice card">
          <strong>Copyright screening</strong>
          <p>
            Book uploads are screened with file hashing, duplicate checks, and metadata similarity so suspicious items
            can be held for review.
          </p>
        </section>
      ) : null}

      <BookUploadForm
        value={bookForm}
        onChange={(key, nextValue) => setBookForm((current) => ({ ...current, [key]: nextValue }))}
        busy={busy}
        progress={progress}
        onSaveDraft={() => submitBook("draft")}
        onPublish={() => submitBook("published")}
      />
    </div>
  );
}
