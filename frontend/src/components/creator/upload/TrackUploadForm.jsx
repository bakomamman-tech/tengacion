export default function TrackUploadForm({
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
          <h2>Upload Track</h2>
          <p>Release singles with cover art, preview samples, pricing, and genre metadata.</p>
        </div>
      </div>

      <div className="creator-form-grid">
        <label>
          <span>Track title</span>
          <input value={value.trackTitle} onChange={(event) => onChange("trackTitle", event.target.value)} />
        </label>
        <label>
          <span>Genre / category</span>
          <input value={value.genre} onChange={(event) => onChange("genre", event.target.value)} />
        </label>
        <label>
          <span>Price</span>
          <input value={value.price} inputMode="decimal" onChange={(event) => onChange("price", event.target.value)} />
        </label>
        <label>
          <span>Full audio file</span>
          <input type="file" accept="audio/*" onChange={(event) => onChange("fullAudioFile", event.target.files?.[0] || null)} />
        </label>
        <label>
          <span>Preview sample file</span>
          <input type="file" accept="audio/*" onChange={(event) => onChange("previewSampleFile", event.target.files?.[0] || null)} />
        </label>
        <label>
          <span>Cover image file</span>
          <input type="file" accept="image/*" onChange={(event) => onChange("coverImageFile", event.target.files?.[0] || null)} />
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
          Publish track
        </button>
      </div>
    </article>
  );
}
