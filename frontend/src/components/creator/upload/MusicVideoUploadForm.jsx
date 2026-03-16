export default function MusicVideoUploadForm({
  value,
  onChange,
  busy = false,
  progress = 0,
  onSaveDraft,
  onPublish,
}) {
  return (
    <article className="creator-panel creator-upload-panel creator-upload-panel--wide card">
      <div className="creator-panel-head">
        <div>
          <h2>Upload Music Video</h2>
          <p>Premieres, lyric visuals, and cinematic drops with thumbnails, preview clips, and pricing.</p>
        </div>
      </div>

      <div className="creator-form-grid">
        <label>
          <span>Video title</span>
          <input value={value.videoTitle} onChange={(event) => onChange("videoTitle", event.target.value)} />
        </label>
        <label>
          <span>Price</span>
          <input value={value.price} inputMode="decimal" onChange={(event) => onChange("price", event.target.value)} />
        </label>
        <label>
          <span>Video file</span>
          <input type="file" accept="video/*" onChange={(event) => onChange("videoFile", event.target.files?.[0] || null)} />
        </label>
        <label>
          <span>Thumbnail file</span>
          <input type="file" accept="image/*" onChange={(event) => onChange("thumbnailFile", event.target.files?.[0] || null)} />
        </label>
        <label>
          <span>Preview clip file</span>
          <input type="file" accept="video/*" onChange={(event) => onChange("previewClipFile", event.target.files?.[0] || null)} />
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
          Publish music video
        </button>
      </div>
    </article>
  );
}
