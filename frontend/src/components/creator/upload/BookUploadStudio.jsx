import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

import { createCreatorBook } from "../../../api";
import { useUnsavedChangesPrompt } from "../../../hooks/useUnsavedChangesPrompt";
import { formatCurrency } from "../creatorConfig";
import { useCreatorWorkspace } from "../useCreatorWorkspace";
import CreatorFileDropzone from "./CreatorFileDropzone";
import CreatorPublishOutcomeCard from "./CreatorPublishOutcomeCard";
import {
  BOOK_ACCEPT,
  IMAGE_ACCEPT,
  bookUploadSchema,
} from "./uploadSchemas";
import { buildUploadOutcome } from "./uploadAudienceUtils";

const buildDefaultValues = (creatorProfile) => ({
  bookTitle: "",
  authorName:
    creatorProfile?.booksProfile?.penName ||
    creatorProfile?.displayName ||
    creatorProfile?.fullName ||
    "",
  subtitle: "",
  synopsis: "",
  genre: "",
  language: "",
  price: 0,
  pageCount: "",
  isbn: "",
  edition: "",
  audience: "",
  readingAge: "",
  tableOfContents: "",
  copyrightDeclaration: false,
  coverImageFile: null,
  manuscriptFile: null,
});

const inferFileFormat = (file) => {
  const name = String(file?.name || "");
  const dotIndex = name.lastIndexOf(".");
  return dotIndex >= 0 ? name.slice(dotIndex + 1).toLowerCase() : "";
};

export default function BookUploadStudio({ showNotice = true }) {
  const { creatorProfile, refreshWorkspace } = useCreatorWorkspace();
  const [busyMode, setBusyMode] = useState("");
  const [progress, setProgress] = useState(0);
  const [outcome, setOutcome] = useState(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(bookUploadSchema),
    defaultValues: buildDefaultValues(creatorProfile),
  });

  useEffect(() => {
    reset(buildDefaultValues(creatorProfile));
  }, [creatorProfile, reset]);

  useUnsavedChangesPrompt(isDirty);

  const coverImageFile = watch("coverImageFile");
  const manuscriptFile = watch("manuscriptFile");
  const bookTitle = watch("bookTitle");
  const authorName = watch("authorName");
  const genre = watch("genre");
  const language = watch("language");
  const price = Number(watch("price") || 0);
  const pageCount = watch("pageCount");
  const copyrightDeclaration = watch("copyrightDeclaration");
  const fileFormat = inferFileFormat(manuscriptFile);

  const submitUpload = async (values, publishMode) => {
    try {
      setBusyMode(publishMode);
      setProgress(0);

      const formData = new FormData();
      formData.append("title", values.bookTitle.trim());
      formData.append("authorName", values.authorName.trim());
      formData.append("subtitle", values.subtitle.trim());
      formData.append("description", values.synopsis.trim());
      formData.append("genre", values.genre.trim());
      formData.append("language", values.language.trim());
      formData.append("price", String(values.price || 0));
      formData.append("pageCount", values.pageCount === "" ? "" : String(values.pageCount));
      formData.append("isbn", values.isbn.trim());
      formData.append("edition", values.edition.trim());
      formData.append("audience", values.audience.trim());
      formData.append("readingAge", values.readingAge.trim());
      formData.append("tableOfContents", values.tableOfContents.trim());
      formData.append("copyrightDeclared", String(Boolean(values.copyrightDeclaration)));
      formData.append("fileFormat", inferFileFormat(values.manuscriptFile));
      formData.append("publishedStatus", publishMode);
      formData.append("content", values.manuscriptFile);
      if (values.coverImageFile) {
        formData.append("cover", values.coverImageFile);
      }

      const created = await createCreatorBook(formData, { onProgress: setProgress });
      await refreshWorkspace();
      setOutcome(
        buildUploadOutcome({
          creatorProfileId: creatorProfile?._id || "",
          categoryKey: "bookPublishing",
          itemType: "book",
          itemId: created?._id || "",
          title: created?.title || values.bookTitle,
          publishedStatus: created?.publishedStatus || publishMode,
        })
      );
      toast.success(publishMode === "draft" ? "Book draft saved" : "Book published");
      reset(buildDefaultValues(creatorProfile));
    } catch (err) {
      toast.error(err?.message || "Could not publish this book");
    } finally {
      setBusyMode("");
      setProgress(0);
    }
  };

  return (
    <div className="creator-upload-studio-shell creator-upload-studio-shell--focused">
      {showNotice ? (
        <section className="creator-upload-notice card">
          <strong>Book publishing only</strong>
          <p>This studio accepts only book metadata, cover images, and supported manuscript formats. Audio and podcast episode fields are excluded.</p>
        </section>
      ) : null}

      <div className="creator-upload-focus-grid">
        <section className="creator-panel creator-upload-form-card card">
          <div className="creator-panel-head">
            <div>
              <h2>Book Publishing Uploads</h2>
              <p>Prepare a clean digital book release with refined metadata, supported manuscript formats, and creator-friendly publishing states.</p>
            </div>
            <span className="creator-status-badge success">Books only</span>
          </div>

          <div className="creator-upload-section">
            <div className="creator-upload-section-head">
              <strong>Book details</strong>
              <small>Core metadata for your reader-facing listing and storefront presentation.</small>
            </div>

            <div className="creator-form-grid">
              <label>
                <span>Book Title</span>
                <input placeholder="The Quiet Shape of Becoming" {...register("bookTitle")} />
                {errors.bookTitle ? <p className="creator-field-error">{errors.bookTitle.message}</p> : null}
              </label>

              <label>
                <span>Author Name</span>
                <input placeholder="Author or pen name" {...register("authorName")} />
                {errors.authorName ? <p className="creator-field-error">{errors.authorName.message}</p> : null}
              </label>

              <label>
                <span>Genre / Category</span>
                <input placeholder="Fiction, Memoir, Business" {...register("genre")} />
                {errors.genre ? <p className="creator-field-error">{errors.genre.message}</p> : null}
              </label>

              <label>
                <span>Language</span>
                <input placeholder="English" {...register("language")} />
                {errors.language ? <p className="creator-field-error">{errors.language.message}</p> : null}
              </label>

              <label>
                <span>Price</span>
                <input type="number" min="0" step="1" inputMode="numeric" placeholder="0" {...register("price")} />
                {errors.price ? <p className="creator-field-error">{errors.price.message}</p> : null}
              </label>

              <label>
                <span>Number of Pages</span>
                <input type="number" min="0" inputMode="numeric" placeholder="Optional" {...register("pageCount")} />
                {errors.pageCount ? <p className="creator-field-error">{errors.pageCount.message}</p> : null}
              </label>

              <label className="creator-form-full">
                <span>Book Description / Synopsis</span>
                <textarea rows={5} placeholder="Write a compelling synopsis for readers..." {...register("synopsis")} />
                {errors.synopsis ? <p className="creator-field-error">{errors.synopsis.message}</p> : null}
              </label>
            </div>
          </div>

          <div className="creator-upload-section">
            <div className="creator-upload-section-head">
              <strong>Files</strong>
              <small>Supported manuscript formats: PDF, EPUB, MOBI, and TXT.</small>
            </div>

            <div className="creator-upload-dropzone-grid">
              <CreatorFileDropzone
                icon="M"
                label="Manuscript Upload"
                helper="Upload the full book manuscript"
                accept={BOOK_ACCEPT}
                formats="PDF, EPUB, MOBI, TXT"
                file={manuscriptFile}
                error={errors.manuscriptFile?.message}
                onChange={(file) => setValue("manuscriptFile", file, { shouldDirty: true, shouldValidate: true })}
              />
              <CreatorFileDropzone
                icon="C"
                label="Cover Image Upload"
                helper="Upload the cover artwork for your book"
                accept={IMAGE_ACCEPT}
                formats="PNG, JPG, WEBP, GIF, AVIF"
                file={coverImageFile}
                error={errors.coverImageFile?.message}
                onChange={(file) => setValue("coverImageFile", file, { shouldDirty: true, shouldValidate: true })}
              />
            </div>
          </div>

          <details className="creator-advanced-panel">
            <summary>Advanced book details</summary>
            <div className="creator-form-grid">
              <label>
                <span>Subtitle</span>
                <input placeholder="Optional subtitle" {...register("subtitle")} />
              </label>
              <label>
                <span>ISBN</span>
                <input placeholder="Optional ISBN" {...register("isbn")} />
              </label>
              <label>
                <span>Edition</span>
                <input placeholder="First edition" {...register("edition")} />
              </label>
              <label>
                <span>Reading Age / Audience</span>
                <input placeholder="Young adult, 13+, Professional" {...register("readingAge")} />
              </label>
              <label>
                <span>Audience</span>
                <input placeholder="General readers, Students, Families" {...register("audience")} />
              </label>
              <label className="creator-form-full">
                <span>Table of Contents Preview</span>
                <textarea rows={5} placeholder="Optional preview of the table of contents" {...register("tableOfContents")} />
              </label>
              <label className="creator-toggle-field creator-form-full">
                <span>Copyright Declaration</span>
                <button
                  type="button"
                  className={`creator-toggle${copyrightDeclaration ? " is-active" : ""}`}
                  onClick={() => setValue("copyrightDeclaration", !copyrightDeclaration, { shouldDirty: true })}
                  aria-pressed={copyrightDeclaration}
                >
                  <span>{copyrightDeclaration ? "Confirmed" : "Not confirmed"}</span>
                </button>
              </label>
            </div>
          </details>

          {busyMode ? (
            <div className="creator-upload-progress-block" role="status" aria-live="polite">
              <div className="creator-upload-progress-bar">
                <span style={{ width: `${progress}%` }} />
              </div>
              <strong>{busyMode === "draft" ? "Saving draft" : "Publishing book"}...</strong>
              <small>{progress}% uploaded</small>
            </div>
          ) : null}

          <div className="creator-form-actions">
            <button
              type="button"
              className="creator-ghost-btn"
              disabled={Boolean(busyMode)}
              onClick={handleSubmit((values) => submitUpload(values, "draft"))}
            >
              Save as Draft
            </button>
            <button
              type="button"
              className="creator-primary-btn"
              disabled={Boolean(busyMode)}
              onClick={handleSubmit((values) => submitUpload(values, "published"))}
            >
              Publish Book
            </button>
          </div>
        </section>

        <aside className="creator-panel creator-upload-preview-card card">
          <div className="creator-panel-head">
            <div>
              <h2>Book preview</h2>
              <p>A calm, reader-first summary of the book package you are publishing.</p>
            </div>
          </div>

          <div className="creator-upload-preview-card__hero books">
            <span className="creator-upload-preview-card__eyebrow">{fileFormat ? fileFormat.toUpperCase() : "BOOK"}</span>
            <strong>{bookTitle || "Untitled book"}</strong>
            <span>{authorName || "Author name"}</span>
          </div>

          <div className="creator-stack-list">
            <div className="creator-stack-row">
              <span>Genre</span>
              <strong>{genre || "Not set yet"}</strong>
            </div>
            <div className="creator-stack-row">
              <span>Language</span>
              <strong>{language || "Not set yet"}</strong>
            </div>
            <div className="creator-stack-row">
              <span>Price</span>
              <strong>{formatCurrency(price || 0)}</strong>
            </div>
            <div className="creator-stack-row">
              <span>Pages</span>
              <strong>{pageCount || "Optional"}</strong>
            </div>
          </div>

          <div className="creator-upload-checklist">
            <div className={`creator-upload-checklist-item${manuscriptFile ? " is-complete" : ""}`}>
              <span />
              <small>{manuscriptFile ? "Manuscript selected" : "Upload the full manuscript"}</small>
            </div>
            <div className={`creator-upload-checklist-item${coverImageFile ? " is-complete" : ""}`}>
              <span />
              <small>{coverImageFile ? "Cover image selected" : "Optional cover image can be added"}</small>
            </div>
            <div className={`creator-upload-checklist-item${copyrightDeclaration ? " is-complete" : ""}`}>
              <span />
              <small>
                {copyrightDeclaration
                  ? "Copyright declaration confirmed"
                  : "Optional copyright declaration can be confirmed"}
              </small>
            </div>
          </div>
        </aside>
      </div>

      <CreatorPublishOutcomeCard outcome={outcome} />
    </div>
  );
}
