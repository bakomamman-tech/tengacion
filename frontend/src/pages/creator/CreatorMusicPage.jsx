import { useMemo, useState } from "react";
import toast from "react-hot-toast";

import {
  createAlbumWithUploadProgress,
  createCreatorVideoWithUploadProgress,
  createTrackWithUploadProgress,
  updateAlbumWithUploadProgress,
  updateCreatorVideoWithUploadProgress,
  updateTrackWithUploadProgress,
} from "../../api";
import CopyrightStatusBadge from "../../components/creator/CopyrightStatusBadge";
import { useCreatorWorkspace } from "../../components/creator/useCreatorWorkspace";
import { formatCurrency, formatShortDate } from "../../components/creator/creatorConfig";
import { useUnsavedChangesPrompt } from "../../hooks/useUnsavedChangesPrompt";

const EMPTY_TRACK_FORM = {
  title: "",
  description: "",
  genre: "",
  price: "",
  audio: null,
  preview: null,
  cover: null,
};

const EMPTY_ALBUM_FORM = {
  albumTitle: "",
  description: "",
  releaseType: "album",
  price: "",
  cover: null,
  tracks: [],
  previews: [],
};

const EMPTY_VIDEO_FORM = {
  title: "",
  description: "",
  price: "",
  video: null,
  thumbnail: null,
  previewClip: null,
};

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
          <h3>Edit {entry.contentType === "music_video" ? "music video" : entry.contentType === "album" || entry.contentType === "ep" ? "album" : "track"}</h3>
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
  const [trackForm, setTrackForm] = useState(EMPTY_TRACK_FORM);
  const [albumForm, setAlbumForm] = useState(EMPTY_ALBUM_FORM);
  const [videoForm, setVideoForm] = useState(EMPTY_VIDEO_FORM);
  const [busyKey, setBusyKey] = useState("");
  const [progress, setProgress] = useState(0);
  const [editingEntry, setEditingEntry] = useState(null);

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

  const hasUnsavedChanges = Boolean(
    trackForm.title ||
      trackForm.description ||
      trackForm.genre ||
      trackForm.price ||
      trackForm.audio ||
      trackForm.preview ||
      trackForm.cover ||
      albumForm.albumTitle ||
      albumForm.description ||
      albumForm.price ||
      albumForm.cover ||
      albumForm.tracks.length ||
      albumForm.previews.length ||
      videoForm.title ||
      videoForm.description ||
      videoForm.price ||
      videoForm.video ||
      videoForm.thumbnail ||
      videoForm.previewClip
  );

  useUnsavedChangesPrompt(hasUnsavedChanges);

  const resetTrackForm = () => setTrackForm(EMPTY_TRACK_FORM);
  const resetAlbumForm = () => setAlbumForm(EMPTY_ALBUM_FORM);
  const resetVideoForm = () => setVideoForm(EMPTY_VIDEO_FORM);

  const submitTrack = async (publishedStatus) => {
    if (!trackForm.title.trim()) {
      toast.error("Track title is required");
      return;
    }
    if (!trackForm.audio) {
      toast.error("Choose an audio file");
      return;
    }
    const formData = new FormData();
    formData.append("title", trackForm.title.trim());
    formData.append("description", trackForm.description.trim());
    formData.append("genre", trackForm.genre.trim());
    formData.append("price", trackForm.price || "0");
    formData.append("kind", "music");
    formData.append("publishedStatus", publishedStatus);
    formData.append("audio", trackForm.audio);
    if (trackForm.preview) formData.append("preview", trackForm.preview);
    if (trackForm.cover) formData.append("cover", trackForm.cover);

    try {
      setBusyKey("track");
      setProgress(0);
      await createTrackWithUploadProgress(formData, { onProgress: setProgress });
      await refreshWorkspace();
      toast.success(publishedStatus === "draft" ? "Track draft saved" : "Track uploaded");
      resetTrackForm();
    } catch (err) {
      toast.error(err?.message || "Could not upload track");
    } finally {
      setBusyKey("");
      setProgress(0);
    }
  };

  const submitAlbum = async (publishedStatus) => {
    if (!albumForm.albumTitle.trim()) {
      toast.error("Album title is required");
      return;
    }
    if (!albumForm.cover) {
      toast.error("Choose a cover image");
      return;
    }
    if (!albumForm.tracks.length) {
      toast.error("Add at least one audio track");
      return;
    }
    const formData = new FormData();
    formData.append("albumTitle", albumForm.albumTitle.trim());
    formData.append("description", albumForm.description.trim());
    formData.append("releaseType", albumForm.releaseType);
    formData.append("price", albumForm.price || "0");
    formData.append("publishedStatus", publishedStatus);
    formData.append("coverImage", albumForm.cover);
    albumForm.tracks.forEach((file) => formData.append("tracks", file));
    albumForm.previews.forEach((file) => formData.append("previews", file));

    try {
      setBusyKey("album");
      setProgress(0);
      await createAlbumWithUploadProgress(formData, { onProgress: setProgress });
      await refreshWorkspace();
      toast.success(publishedStatus === "draft" ? "Album draft saved" : "Album uploaded");
      resetAlbumForm();
    } catch (err) {
      toast.error(err?.message || "Could not upload album");
    } finally {
      setBusyKey("");
      setProgress(0);
    }
  };

  const submitVideo = async (publishedStatus) => {
    if (!videoForm.title.trim()) {
      toast.error("Video title is required");
      return;
    }
    if (!videoForm.video) {
      toast.error("Choose a music video file");
      return;
    }
    const formData = new FormData();
    formData.append("title", videoForm.title.trim());
    formData.append("description", videoForm.description.trim());
    formData.append("price", videoForm.price || "0");
    formData.append("publishedStatus", publishedStatus);
    formData.append("video", videoForm.video);
    if (videoForm.thumbnail) formData.append("thumbnail", videoForm.thumbnail);
    if (videoForm.previewClip) formData.append("previewClip", videoForm.previewClip);

    try {
      setBusyKey("video");
      setProgress(0);
      await createCreatorVideoWithUploadProgress(formData, { onProgress: setProgress });
      await refreshWorkspace();
      toast.success(publishedStatus === "draft" ? "Music video draft saved" : "Music video uploaded");
      resetVideoForm();
    } catch (err) {
      toast.error(err?.message || "Could not upload music video");
    } finally {
      setBusyKey("");
      setProgress(0);
    }
  };

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
        if (values.cover) formData.append("cover", values.cover);
        if (values.audio) formData.append("audio", values.audio);
        if (values.preview) formData.append("preview", values.preview);
        await updateTrackWithUploadProgress(editingEntry._id, formData, { onProgress: setProgress });
      } else if (editingEntry.contentType === "album" || editingEntry.contentType === "ep") {
        formData.append("releaseType", values.releaseType || "album");
        if (values.cover) formData.append("coverImage", values.cover);
        await updateAlbumWithUploadProgress(editingEntry._id, formData, { onProgress: setProgress });
      } else {
        if (values.thumbnail) formData.append("thumbnail", values.thumbnail);
        if (values.video) formData.append("video", values.video);
        if (values.previewClip) formData.append("previewClip", values.previewClip);
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
        <article className="creator-metric-card card">
          <span>Active releases</span>
          <strong>{musicContent.analytics?.activeReleases || 0}</strong>
        </article>
        <article className="creator-metric-card card">
          <span>Total streams</span>
          <strong>{musicContent.analytics?.totalStreams || 0}</strong>
        </article>
        <article className="creator-metric-card card">
          <span>Music earnings</span>
          <strong>{formatCurrency(dashboard.categories?.music?.earnings || 0)}</strong>
        </article>
      </section>

      <section className="creator-upload-notice card">
        <strong>Copyright screening</strong>
        <p>This upload flow runs metadata and duplicate checks before publication. Flagged uploads may require review before they go live.</p>
      </section>

      <section className="creator-upload-grid">
        <article className="creator-panel card">
          <div className="creator-panel-head">
            <div>
              <h2>Upload Track</h2>
              <p>Singles and standalone tracks only.</p>
            </div>
          </div>
          <div className="creator-form-grid">
            <label>
              <span>Track title</span>
              <input value={trackForm.title} onChange={(event) => setTrackForm((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label>
              <span>Genre</span>
              <input value={trackForm.genre} onChange={(event) => setTrackForm((current) => ({ ...current, genre: event.target.value }))} />
            </label>
            <label>
              <span>Price</span>
              <input value={trackForm.price} inputMode="numeric" onChange={(event) => setTrackForm((current) => ({ ...current, price: event.target.value }))} />
            </label>
            <label>
              <span>Audio file</span>
              <input type="file" accept="audio/*" onChange={(event) => setTrackForm((current) => ({ ...current, audio: event.target.files?.[0] || null }))} />
            </label>
            <label>
              <span>Preview sample</span>
              <input type="file" accept="audio/*" onChange={(event) => setTrackForm((current) => ({ ...current, preview: event.target.files?.[0] || null }))} />
            </label>
            <label>
              <span>Cover art</span>
              <input type="file" accept="image/*" onChange={(event) => setTrackForm((current) => ({ ...current, cover: event.target.files?.[0] || null }))} />
            </label>
            <label className="creator-form-full">
              <span>Description</span>
              <textarea rows={4} value={trackForm.description} onChange={(event) => setTrackForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
          </div>
          {busyKey === "track" ? <div className="creator-upload-progress">Uploading... {progress}%</div> : null}
          <div className="creator-form-actions">
            <button type="button" className="creator-ghost-btn" disabled={busyKey === "track"} onClick={() => submitTrack("draft")}>
              Save draft
            </button>
            <button type="button" className="creator-primary-btn" disabled={busyKey === "track"} onClick={() => submitTrack("published")}>
              Publish track
            </button>
          </div>
        </article>

        <article className="creator-panel card">
          <div className="creator-panel-head">
            <div>
              <h2>Upload Album / EP</h2>
              <p>Bundle multiple tracks into a single release.</p>
            </div>
          </div>
          <div className="creator-form-grid">
            <label>
              <span>Release title</span>
              <input value={albumForm.albumTitle} onChange={(event) => setAlbumForm((current) => ({ ...current, albumTitle: event.target.value }))} />
            </label>
            <label>
              <span>Release type</span>
              <select value={albumForm.releaseType} onChange={(event) => setAlbumForm((current) => ({ ...current, releaseType: event.target.value }))}>
                <option value="album">Album</option>
                <option value="ep">EP</option>
              </select>
            </label>
            <label>
              <span>Price</span>
              <input value={albumForm.price} inputMode="numeric" onChange={(event) => setAlbumForm((current) => ({ ...current, price: event.target.value }))} />
            </label>
            <label>
              <span>Cover image</span>
              <input type="file" accept="image/*" onChange={(event) => setAlbumForm((current) => ({ ...current, cover: event.target.files?.[0] || null }))} />
            </label>
            <label className="creator-form-full">
              <span>Album tracks</span>
              <input type="file" accept="audio/*" multiple onChange={(event) => setAlbumForm((current) => ({ ...current, tracks: Array.from(event.target.files || []) }))} />
            </label>
            <label className="creator-form-full">
              <span>Preview samples</span>
              <input type="file" accept="audio/*" multiple onChange={(event) => setAlbumForm((current) => ({ ...current, previews: Array.from(event.target.files || []) }))} />
            </label>
            <label className="creator-form-full">
              <span>Description</span>
              <textarea rows={4} value={albumForm.description} onChange={(event) => setAlbumForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
          </div>
          {busyKey === "album" ? <div className="creator-upload-progress">Uploading... {progress}%</div> : null}
          <div className="creator-form-actions">
            <button type="button" className="creator-ghost-btn" disabled={busyKey === "album"} onClick={() => submitAlbum("draft")}>
              Save draft
            </button>
            <button type="button" className="creator-primary-btn" disabled={busyKey === "album"} onClick={() => submitAlbum("published")}>
              Publish release
            </button>
          </div>
        </article>
      </section>

      <section className="creator-panel card">
        <div className="creator-panel-head">
          <div>
            <h2>Upload Music Video</h2>
            <p>Publish official music videos with pricing, preview clips, and verification status.</p>
          </div>
        </div>
        <div className="creator-form-grid">
          <label>
            <span>Video title</span>
            <input value={videoForm.title} onChange={(event) => setVideoForm((current) => ({ ...current, title: event.target.value }))} />
          </label>
          <label>
            <span>Price</span>
            <input value={videoForm.price} inputMode="numeric" onChange={(event) => setVideoForm((current) => ({ ...current, price: event.target.value }))} />
          </label>
          <label>
            <span>Video file</span>
            <input type="file" accept="video/*" onChange={(event) => setVideoForm((current) => ({ ...current, video: event.target.files?.[0] || null }))} />
          </label>
          <label>
            <span>Thumbnail</span>
            <input type="file" accept="image/*" onChange={(event) => setVideoForm((current) => ({ ...current, thumbnail: event.target.files?.[0] || null }))} />
          </label>
          <label>
            <span>Preview clip</span>
            <input type="file" accept="video/*" onChange={(event) => setVideoForm((current) => ({ ...current, previewClip: event.target.files?.[0] || null }))} />
          </label>
          <label className="creator-form-full">
            <span>Description</span>
            <textarea rows={4} value={videoForm.description} onChange={(event) => setVideoForm((current) => ({ ...current, description: event.target.value }))} />
          </label>
        </div>
        {busyKey === "video" ? <div className="creator-upload-progress">Uploading... {progress}%</div> : null}
        <div className="creator-form-actions">
          <button type="button" className="creator-ghost-btn" disabled={busyKey === "video"} onClick={() => submitVideo("draft")}>
            Save draft
          </button>
          <button type="button" className="creator-primary-btn" disabled={busyKey === "video"} onClick={() => submitVideo("published")}>
            Publish music video
          </button>
        </div>
      </section>

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
    </div>
  );
}
