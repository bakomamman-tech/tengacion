export default function AlbumUploadForm({
  value,
  onChange,
  busy = false,
  progress = 0,
  onSaveDraft,
  onPublish,
}) {
  return (
    <article className="creator-panel creator-upload-panel card">
      <div className="creator-panel-head">
        <div>
          <h2>Upload Album</h2>
          <p>Bundle multiple songs into a premium release with cover art, optional previews, and pricing.</p>
        </div>
      </div>

      <div className="creator-form-grid">
        <label>
          <span>Album title</span>
          <input value={value.albumTitle} onChange={(event) => onChange("albumTitle", event.target.value)} />
        </label>
        <label>
          <span>Release type</span>
          <select value={value.releaseType} onChange={(event) => onChange("releaseType", event.target.value)}>
            <option value="album">Album</option>
            <option value="ep">EP</option>
          </select>
        </label>
        <label>
          <span>Price</span>
          <input value={value.price} inputMode="decimal" onChange={(event) => onChange("price", event.target.value)} />
        </label>
        <label>
          <span>Album cover image file</span>
          <input type="file" accept="image/*" onChange={(event) => onChange("albumCoverImageFile", event.target.files?.[0] || null)} />
        </label>
        <label className="creator-form-full">
          <span>Album songs files</span>
          <input type="file" accept="audio/*" multiple onChange={(event) => onChange("albumSongsFiles", Array.from(event.target.files || []))} />
        </label>
        <label className="creator-form-full">
          <span>Optional preview samples</span>
          <input type="file" accept="audio/*" multiple onChange={(event) => onChange("optionalPreviewSamples", Array.from(event.target.files || []))} />
        </label>
        <label className="creator-form-full">
          <span>Description</span>
          <textarea rows={4} value={value.description} onChange={(event) => onChange("description", event.target.value)} />
        </label>
      </div>

      {busy ? <div className="creator-upload-progress">Uploading... {progress}%</div> : null}

      <div className="creator-form-actions">
        <button type="button" className="creator-ghost-btn" disabled={busy} onClick={onSaveDraft}>
          Save draft
        </button>
        <button type="button" className="creator-primary-btn" disabled={busy} onClick={onPublish}>
          Publish album
        </button>
      </div>
    </article>
  );
}
