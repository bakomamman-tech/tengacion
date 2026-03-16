export default function PodcastEpisodeForm({
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
          <h2>Podcast Episode Upload</h2>
          <p>Publish episodes separately from the series profile, with access mode, seasons, and teasers.</p>
        </div>
      </div>

      <div className="creator-form-grid">
        <label>
          <span>Episode title</span>
          <input value={value.episodeTitle} onChange={(event) => onChange("episodeTitle", event.target.value)} />
        </label>
        <label>
          <span>Podcast series</span>
          <input value={value.podcastSeries} onChange={(event) => onChange("podcastSeries", event.target.value)} />
        </label>
        <label>
          <span>Season</span>
          <input value={value.season} inputMode="numeric" onChange={(event) => onChange("season", event.target.value)} />
        </label>
        <label>
          <span>Episode number</span>
          <input value={value.episodeNumber} inputMode="numeric" onChange={(event) => onChange("episodeNumber", event.target.value)} />
        </label>
        <label>
          <span>Access type</span>
          <select value={value.accessType} onChange={(event) => onChange("accessType", event.target.value)}>
            <option value="free">Free</option>
            <option value="paid">Paid</option>
          </select>
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
          Publish podcast
        </button>
      </div>
    </article>
  );
}
