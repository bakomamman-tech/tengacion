import CreatorUploadField from "./CreatorUploadField";

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
        <CreatorUploadField
          icon="A"
          label="Full audio"
          helper="Browse or drag your release audio file"
          accept="audio/*"
          selectedText={value.fullAudioFile?.name || ""}
          onChange={(event) => onChange("fullAudioFile", event.target.files?.[0] || null)}
        />
        <CreatorUploadField
          icon="P"
          label="Preview sample"
          helper="Optional teaser upload for previews"
          accept="audio/*"
          selectedText={value.previewSampleFile?.name || ""}
          onChange={(event) => onChange("previewSampleFile", event.target.files?.[0] || null)}
        />
        <CreatorUploadField
          icon="I"
          label="Cover image"
          helper="Square artwork for storefront display"
          accept="image/*"
          selectedText={value.coverImageFile?.name || ""}
          onChange={(event) => onChange("coverImageFile", event.target.files?.[0] || null)}
        />
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
