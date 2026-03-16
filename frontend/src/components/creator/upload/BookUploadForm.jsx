import CreatorUploadField from "./CreatorUploadField";

export default function BookUploadForm({
  value,
  onChange,
  busy = false,
  progress = 0,
  onSaveDraft,
  onPublish,
}) {
  return (
    <article className="creator-panel creator-upload-panel creator-upload-panel--books card">
      <div className="creator-panel-head">
        <div>
          <h2>Upload Book</h2>
          <p>Publish PDF, EPUB, MOBI, or TXT releases with previews, language, genre, and pricing.</p>
        </div>
      </div>

      <div className="creator-form-grid">
        <label>
          <span>Book title</span>
          <input value={value.bookTitle} onChange={(event) => onChange("bookTitle", event.target.value)} />
        </label>
        <label>
          <span>Genre / category</span>
          <input value={value.genre} onChange={(event) => onChange("genre", event.target.value)} />
        </label>
        <label>
          <span>Language</span>
          <input value={value.language} onChange={(event) => onChange("language", event.target.value)} />
        </label>
        <label>
          <span>Price</span>
          <input value={value.price} inputMode="decimal" onChange={(event) => onChange("price", event.target.value)} />
        </label>
        <label>
          <span>File format</span>
          <select value={value.fileFormat} onChange={(event) => onChange("fileFormat", event.target.value)}>
            <option value="pdf">PDF</option>
            <option value="epub">EPUB</option>
            <option value="mobi">MOBI</option>
            <option value="txt">TXT</option>
          </select>
        </label>
        <label>
          <span>Tags</span>
          <input value={value.tags} onChange={(event) => onChange("tags", event.target.value)} placeholder="literary, drama, fiction" />
        </label>
        <CreatorUploadField
          icon="C"
          label="Cover image file"
          helper="Upload book artwork"
          accept="image/*"
          selectedText={value.coverImageFile?.name || ""}
          onChange={(event) => onChange("coverImageFile", event.target.files?.[0] || null)}
        />
        <CreatorUploadField
          icon="F"
          label="Full book upload"
          helper="PDF, EPUB, MOBI, or TXT release file"
          accept=".pdf,.epub,.mobi,.txt"
          selectedText={value.fullBookFile?.name || ""}
          onChange={(event) => onChange("fullBookFile", event.target.files?.[0] || null)}
        />
        <CreatorUploadField
          icon="P"
          label="Preview sample"
          helper="Optional sample file for discovery previews"
          accept=".pdf,.epub,.mobi,.txt"
          selectedText={value.previewSampleFile?.name || ""}
          onChange={(event) => onChange("previewSampleFile", event.target.files?.[0] || null)}
        />
        <label className="creator-form-full">
          <span>Description</span>
          <textarea rows={4} value={value.description} onChange={(event) => onChange("description", event.target.value)} />
        </label>
        <label className="creator-form-full">
          <span>Preview excerpt</span>
          <textarea rows={4} value={value.previewExcerptText} onChange={(event) => onChange("previewExcerptText", event.target.value)} />
        </label>
      </div>

      {busy ? <div className="creator-upload-progress">Uploading... {progress}%</div> : null}

      <div className="creator-form-actions">
        <button type="button" className="creator-ghost-btn" disabled={busy} onClick={onSaveDraft}>
          Save draft
        </button>
        <button type="button" className="creator-primary-btn" disabled={busy} onClick={onPublish}>
          Publish Book
        </button>
      </div>
    </article>
  );
}
