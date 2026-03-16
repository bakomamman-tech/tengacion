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
          <h2>Create Book</h2>
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
        <label>
          <span>Cover image file</span>
          <input type="file" accept="image/*" onChange={(event) => onChange("coverImageFile", event.target.files?.[0] || null)} />
        </label>
        <label>
          <span>Full book file</span>
          <input type="file" accept=".pdf,.epub,.mobi,.txt" onChange={(event) => onChange("fullBookFile", event.target.files?.[0] || null)} />
        </label>
        <label>
          <span>Preview sample file</span>
          <input type="file" accept=".pdf,.epub,.mobi,.txt" onChange={(event) => onChange("previewSampleFile", event.target.files?.[0] || null)} />
        </label>
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
          Publish book
        </button>
      </div>
    </article>
  );
}
