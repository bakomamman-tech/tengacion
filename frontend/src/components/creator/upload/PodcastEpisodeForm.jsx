import CreatorUploadField from "./CreatorUploadField";

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
          <input
            value={value.episodeTitle}
            placeholder="Episode title"
            onChange={(event) => onChange("episodeTitle", event.target.value)}
          />
        </label>
        <label>
          <span>Podcast series</span>
          <input
            value={value.podcastSeries}
            placeholder="Podcast series"
            onChange={(event) => onChange("podcastSeries", event.target.value)}
          />
        </label>
        <label>
          <span>Season</span>
          <input
            value={value.season}
            placeholder="Season"
            inputMode="numeric"
            onChange={(event) => onChange("season", event.target.value)}
          />
        </label>
        <label>
          <span>Episode number</span>
          <input
            value={value.episodeNumber}
            placeholder="Episode number"
            inputMode="numeric"
            onChange={(event) => onChange("episodeNumber", event.target.value)}
          />
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
          <input
            value={value.price}
            placeholder="Price"
            inputMode="decimal"
            disabled={value.accessType !== "paid"}
            onChange={(event) => onChange("price", event.target.value)}
          />
        </label>
        <CreatorUploadField
          icon="A"
          label="Full audio upload"
          helper="Podcast episode master audio file"
          accept="audio/*"
          selectedText={value.fullAudioFile?.name || ""}
          onChange={(event) => onChange("fullAudioFile", event.target.files?.[0] || null)}
        />
        <CreatorUploadField
          icon="S"
          label="Preview sample upload"
          helper="Optional short sample for discovery"
          accept="audio/*"
          selectedText={value.previewSampleFile?.name || ""}
          onChange={(event) => onChange("previewSampleFile", event.target.files?.[0] || null)}
        />
        <CreatorUploadField
          icon="I"
          label="Cover image upload"
          helper="Episode cover artwork"
          accept="image/*"
          selectedText={value.coverImageFile?.name || ""}
          onChange={(event) => onChange("coverImageFile", event.target.files?.[0] || null)}
        />
        <label className="creator-form-full">
          <span>Description</span>
          <textarea
            rows={4}
            value={value.description}
            placeholder="Description"
            onChange={(event) => onChange("description", event.target.value)}
          />
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
