export default function PodcastSeriesForm({
  value,
  onChange,
  busy = false,
  onSave,
}) {
  return (
    <article className="creator-panel creator-upload-panel creator-upload-panel--series card">
      <div className="creator-panel-head">
        <div>
          <h2>Podcast Series Profile</h2>
          <p>Set the creator-facing series identity once, then publish episodes separately below.</p>
        </div>
      </div>

      <div className="creator-form-grid">
        <label>
          <span>Podcast name</span>
          <input value={value.podcastName} onChange={(event) => onChange("podcastName", event.target.value)} />
        </label>
        <label>
          <span>Host name</span>
          <input value={value.hostName} onChange={(event) => onChange("hostName", event.target.value)} />
        </label>
        <label>
          <span>Theme or topic</span>
          <input value={value.themeOrTopic} onChange={(event) => onChange("themeOrTopic", event.target.value)} />
        </label>
        <label>
          <span>Series title</span>
          <input value={value.seriesTitle} onChange={(event) => onChange("seriesTitle", event.target.value)} />
        </label>
        <label className="creator-form-full">
          <span>Series description</span>
          <textarea rows={4} value={value.description} onChange={(event) => onChange("description", event.target.value)} />
        </label>
      </div>

      <div className="creator-form-actions">
        <button type="button" className="creator-primary-btn" disabled={busy} onClick={onSave}>
          {busy ? "Saving..." : "Save series profile"}
        </button>
      </div>
    </article>
  );
}
