import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import {
  updateAlbumWithUploadProgress,
  updateCreatorVideoWithUploadProgress,
  updateTrackWithUploadProgress,
} from "../../api";
import CopyrightStatusBadge from "../../components/creator/CopyrightStatusBadge";
import CreatorStatsCard from "../../components/creator/CreatorStatsCard";
import { formatCurrency, formatShortDate } from "../../components/creator/creatorConfig";
import MusicUploadStudio from "../../components/creator/upload/MusicUploadStudio";
import { useCreatorWorkspace } from "../../components/creator/useCreatorWorkspace";

function ReleaseCard({ item, type, onEdit }) {
  return (
    <article className="creator-release-card">
      <div>
        <div className="creator-inline-row">
          <strong>{item.title}</strong>
          <CopyrightStatusBadge status={item.publishedStatus} />
        </div>
        <p>{type}</p>
      </div>
      <div className="creator-release-meta">
        <span>{formatCurrency(item.price || 0)}</span>
        <span>{formatShortDate(item.updatedAt || item.createdAt)}</span>
        <CopyrightStatusBadge status={item.copyrightScanStatus} />
      </div>
      <button type="button" className="creator-ghost-btn" onClick={onEdit}>
        Edit metadata
      </button>
    </article>
  );
}

function MusicEditPanel({ entry, onCancel, onSave }) {
  const [values, setValues] = useState({
    title: entry.title || "",
    description: entry.description || "",
    price: String(entry.price ?? ""),
    genre: entry.genre || "",
    releaseType: entry.releaseType || entry.contentType || "album",
    publishedStatus: entry.publishedStatus === "draft" ? "draft" : "published",
    cover: null,
    audio: null,
    preview: null,
    video: null,
    thumbnail: null,
    previewClip: null,
  });

  const update = (key, value) => setValues((current) => ({ ...current, [key]: value }));

  return (
    <section className="creator-editor-card card">
      <div className="creator-panel-head">
        <div>
          <h3>
            Edit{" "}
            {entry.contentType === "music_video"
              ? "music video"
              : entry.contentType === "album" || entry.contentType === "ep"
                ? "album"
                : "track"}
          </h3>
          <p>Update metadata and republish through the verification-aware workflow.</p>
        </div>
      </div>

      <div className="creator-form-grid">
        <label>
          <span>Title</span>
          <input value={values.title} onChange={(event) => update("title", event.target.value)} />
        </label>
        <label>
          <span>Price</span>
          <input value={values.price} onChange={(event) => update("price", event.target.value)} inputMode="numeric" />
        </label>
        {entry.contentType === "track" ? (
          <label>
            <span>Genre</span>
            <input value={values.genre} onChange={(event) => update("genre", event.target.value)} />
          </label>
        ) : null}
        {entry.contentType === "album" || entry.contentType === "ep" ? (
          <label>
            <span>Release type</span>
            <select value={values.releaseType} onChange={(event) => update("releaseType", event.target.value)}>
              <option value="album">Album</option>
              <option value="ep">EP</option>
            </select>
          </label>
        ) : null}
        <label className="creator-form-full">
          <span>Description</span>
          <textarea value={values.description} onChange={(event) => update("description", event.target.value)} rows={4} />
        </label>
        <label>
          <span>Publishing mode</span>
          <select value={values.publishedStatus} onChange={(event) => update("publishedStatus", event.target.value)}>
            <option value="published">Publish</option>
            <option value="draft">Save as draft</option>
          </select>
        </label>
        <label>
          <span>Cover / thumbnail</span>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => update(entry.contentType === "music_video" ? "thumbnail" : "cover", event.target.files?.[0] || null)}
          />
        </label>
        {entry.contentType === "track" ? (
          <>
            <label>
              <span>Replace audio</span>
              <input type="file" accept="audio/*" onChange={(event) => update("audio", event.target.files?.[0] || null)} />
            </label>
            <label>
              <span>Replace preview</span>
              <input type="file" accept="audio/*" onChange={(event) => update("preview", event.target.files?.[0] || null)} />
            </label>
          </>
        ) : null}
        {entry.contentType === "music_video" ? (
          <>
            <label>
              <span>Replace video</span>
              <input type="file" accept="video/*" onChange={(event) => update("video", event.target.files?.[0] || null)} />
            </label>
            <label>
              <span>Replace preview clip</span>
              <input type="file" accept="video/*" onChange={(event) => update("previewClip", event.target.files?.[0] || null)} />
            </label>
          </>
        ) : null}
      </div>

      <div className="creator-form-actions">
        <button type="button" className="creator-ghost-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="creator-primary-btn" onClick={() => onSave(values)}>
          Save changes
        </button>
      </div>
    </section>
  );
}

export default function CreatorMusicPage() {
  const { dashboard, refreshWorkspace } = useCreatorWorkspace();
  const [editingEntry, setEditingEntry] = useState(null);
  const [busyKey, setBusyKey] = useState("");
  const [progress, setProgress] = useState(0);

  const musicContent = dashboard.content?.music || { tracks: [], albums: [], videos: [], analytics: {} };
  const allEntries = useMemo(
    () =>
      [
        ...musicContent.tracks.map((entry) => ({ ...entry, listType: "Track" })),
        ...musicContent.albums.map((entry) => ({ ...entry, listType: entry.releaseType === "ep" ? "EP" : "Album" })),
        ...musicContent.videos.map((entry) => ({ ...entry, listType: "Music video" })),
      ].sort((left, right) => new Date(right.updatedAt || right.createdAt) - new Date(left.updatedAt || left.createdAt)),
    [musicContent.albums, musicContent.tracks, musicContent.videos]
  );

  const saveEdit = async (values) => {
    if (!editingEntry) {
      return;
    }

    try {
      setBusyKey(`edit-${editingEntry._id}`);
      const formData = new FormData();
      formData.append("title", values.title.trim());
      formData.append("description", values.description.trim());
      formData.append("price", values.price || "0");
      formData.append("publishedStatus", values.publishedStatus);

      if (editingEntry.contentType === "track") {
        formData.append("kind", "music");
        formData.append("genre", values.genre || "");
        if (values.cover) {
          formData.append("cover", values.cover);
        }
        if (values.audio) {
          formData.append("audio", values.audio);
        }
        if (values.preview) {
          formData.append("preview", values.preview);
        }
        await updateTrackWithUploadProgress(editingEntry._id, formData, { onProgress: setProgress });
      } else if (editingEntry.contentType === "album" || editingEntry.contentType === "ep") {
        formData.append("releaseType", values.releaseType || "album");
        if (values.cover) {
          formData.append("coverImage", values.cover);
        }
        await updateAlbumWithUploadProgress(editingEntry._id, formData, { onProgress: setProgress });
      } else {
        if (values.thumbnail) {
          formData.append("thumbnail", values.thumbnail);
        }
        if (values.video) {
          formData.append("video", values.video);
        }
        if (values.previewClip) {
          formData.append("previewClip", values.previewClip);
        }
        await updateCreatorVideoWithUploadProgress(editingEntry._id, formData, { onProgress: setProgress });
      }

      await refreshWorkspace();
      toast.success("Release updated");
      setEditingEntry(null);
    } catch (err) {
      toast.error(err?.message || "Could not update this release");
    } finally {
      setBusyKey("");
      setProgress(0);
    }
  };

  return (
    <div className="creator-page-stack">
      <section className="creator-metric-grid">
        <CreatorStatsCard
          label="Published releases"
          value={musicContent.analytics?.activeReleases || 0}
          helper="Tracks, albums, and videos currently live."
          tone="success"
        />
        <CreatorStatsCard
          label="Total streams"
          value={musicContent.analytics?.totalStreams || 0}
          helper="Combined listens and video plays."
        />
        <CreatorStatsCard
          label="Music earnings"
          value={formatCurrency(dashboard.categories?.music?.earnings || 0)}
          helper="Creator share across paid music releases."
        />
      </section>

      <section className="creator-inline-notice">
        <div>
          <strong>Dedicated upload page</strong>
          <span>Open the full Upload Music studio for a focused publishing layout with track, album, and video cards.</span>
        </div>
        <Link className="creator-secondary-btn" to="/creator/music/upload">
          Upload Music
        </Link>
      </section>

      <MusicUploadStudio />

      {editingEntry ? <MusicEditPanel entry={editingEntry} onCancel={() => setEditingEntry(null)} onSave={saveEdit} /> : null}

      <section className="creator-panel card">
        <div className="creator-panel-head">
          <div>
            <h2>Existing releases</h2>
            <p>Manage current tracks, albums, and music videos from one list.</p>
          </div>
        </div>
        <div className="creator-activity-list">
          {allEntries.length ? (
            allEntries.map((entry) => (
              <ReleaseCard
                key={`${entry.contentType}-${entry._id}`}
                item={entry}
                type={entry.listType}
                onEdit={() => setEditingEntry(entry)}
              />
            ))
          ) : (
            <div className="creator-empty-card">Your music catalog will appear here after your first upload.</div>
          )}
        </div>
      </section>

      {busyKey ? <div className="creator-upload-progress">Updating release... {progress}%</div> : null}
    </div>
  );
}
