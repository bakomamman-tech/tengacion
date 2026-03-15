import { useMemo, useState } from "react";
import toast from "react-hot-toast";

import {
  createTrackWithUploadProgress,
  updateTrackWithUploadProgress,
} from "../../api";
import CopyrightStatusBadge from "../../components/creator/CopyrightStatusBadge";
import { useCreatorWorkspace } from "../../components/creator/useCreatorWorkspace";
import { formatCurrency, formatShortDate } from "../../components/creator/creatorConfig";
import { useUnsavedChangesPrompt } from "../../hooks/useUnsavedChangesPrompt";

const EMPTY_PODCAST_FORM = {
  title: "",
  description: "",
  podcastSeries: "",
  seasonNumber: "",
  episodeNumber: "",
  price: "",
  audio: null,
  preview: null,
  cover: null,
};

function PodcastEditPanel({ item, onCancel, onSave }) {
  const [values, setValues] = useState({
    title: item.title || "",
    description: item.description || "",
    podcastSeries: item.podcastSeries || "",
    seasonNumber: String(item.seasonNumber ?? ""),
    episodeNumber: String(item.episodeNumber ?? ""),
    price: String(item.price ?? ""),
    publishedStatus: item.publishedStatus === "draft" ? "draft" : "published",
    cover: null,
    audio: null,
    preview: null,
  });

  const update = (key, value) => setValues((current) => ({ ...current, [key]: value }));

  return (
    <section className="creator-editor-card card">
      <div className="creator-panel-head">
        <div>
          <h3>Edit podcast episode</h3>
          <p>Update episode details, files, and publish status in one place.</p>
        </div>
      </div>
      <div className="creator-form-grid">
        <label>
          <span>Episode title</span>
          <input value={values.title} onChange={(event) => update("title", event.target.value)} />
        </label>
        <label>
          <span>Series</span>
          <input value={values.podcastSeries} onChange={(event) => update("podcastSeries", event.target.value)} />
        </label>
        <label>
          <span>Season number</span>
          <input value={values.seasonNumber} inputMode="numeric" onChange={(event) => update("seasonNumber", event.target.value)} />
        </label>
        <label>
          <span>Episode number</span>
          <input value={values.episodeNumber} inputMode="numeric" onChange={(event) => update("episodeNumber", event.target.value)} />
        </label>
        <label>
          <span>Price</span>
          <input value={values.price} inputMode="numeric" onChange={(event) => update("price", event.target.value)} />
        </label>
        <label>
          <span>Publishing mode</span>
          <select value={values.publishedStatus} onChange={(event) => update("publishedStatus", event.target.value)}>
            <option value="published">Publish</option>
            <option value="draft">Save as draft</option>
          </select>
        </label>
        <label>
          <span>Cover art</span>
          <input type="file" accept="image/*" onChange={(event) => update("cover", event.target.files?.[0] || null)} />
        </label>
        <label>
          <span>Replace audio</span>
          <input type="file" accept="audio/*" onChange={(event) => update("audio", event.target.files?.[0] || null)} />
        </label>
        <label>
          <span>Replace teaser</span>
          <input type="file" accept="audio/*" onChange={(event) => update("preview", event.target.files?.[0] || null)} />
        </label>
        <label className="creator-form-full">
          <span>Description</span>
          <textarea rows={4} value={values.description} onChange={(event) => update("description", event.target.value)} />
        </label>
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

export default function CreatorPodcastsPage() {
  const { dashboard, refreshWorkspace } = useCreatorWorkspace();
  const [podcastForm, setPodcastForm] = useState(EMPTY_PODCAST_FORM);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [editingItem, setEditingItem] = useState(null);

  const episodes = dashboard.content?.podcasts?.episodes || [];
  const analytics = dashboard.content?.podcasts?.analytics || {};

  const seriesSummary = useMemo(() => {
    const map = new Map();
    episodes.forEach((entry) => {
      const key = entry.podcastSeries || "Standalone";
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()];
  }, [episodes]);

  const sortedEpisodes = useMemo(
    () => [...episodes].sort((left, right) => new Date(right.updatedAt || right.createdAt) - new Date(left.updatedAt || left.createdAt)),
    [episodes]
  );

  const dirty = Boolean(
    podcastForm.title ||
      podcastForm.description ||
      podcastForm.podcastSeries ||
      podcastForm.seasonNumber ||
      podcastForm.episodeNumber ||
      podcastForm.price ||
      podcastForm.audio ||
      podcastForm.preview ||
      podcastForm.cover
  );

  useUnsavedChangesPrompt(dirty);

  const resetForm = () => setPodcastForm(EMPTY_PODCAST_FORM);

  const submitEpisode = async (publishedStatus) => {
    if (!podcastForm.title.trim()) {
      toast.error("Episode title is required");
      return;
    }
    if (!podcastForm.audio) {
      toast.error("Choose a full audio file");
      return;
    }
    const formData = new FormData();
    formData.append("title", podcastForm.title.trim());
    formData.append("description", podcastForm.description.trim());
    formData.append("kind", "podcast");
    formData.append("podcastSeries", podcastForm.podcastSeries.trim());
    formData.append("seasonNumber", podcastForm.seasonNumber || "0");
    formData.append("episodeNumber", podcastForm.episodeNumber || "0");
    formData.append("price", podcastForm.price || "0");
    formData.append("publishedStatus", publishedStatus);
    formData.append("audio", podcastForm.audio);
    if (podcastForm.preview) formData.append("preview", podcastForm.preview);
    if (podcastForm.cover) formData.append("cover", podcastForm.cover);

    try {
      setBusy(true);
      await createTrackWithUploadProgress(formData, { onProgress: setProgress });
      await refreshWorkspace();
      toast.success(publishedStatus === "draft" ? "Podcast draft saved" : "Podcast episode uploaded");
      resetForm();
    } catch (err) {
      toast.error(err?.message || "Could not upload podcast episode");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const saveEdit = async (values) => {
    if (!editingItem) {
      return;
    }
    try {
      setBusy(true);
      const formData = new FormData();
      formData.append("title", values.title.trim());
      formData.append("description", values.description.trim());
      formData.append("kind", "podcast");
      formData.append("podcastSeries", values.podcastSeries.trim());
      formData.append("seasonNumber", values.seasonNumber || "0");
      formData.append("episodeNumber", values.episodeNumber || "0");
      formData.append("price", values.price || "0");
      formData.append("publishedStatus", values.publishedStatus);
      if (values.cover) formData.append("cover", values.cover);
      if (values.audio) formData.append("audio", values.audio);
      if (values.preview) formData.append("preview", values.preview);

      await updateTrackWithUploadProgress(editingItem._id, formData, { onProgress: setProgress });
      await refreshWorkspace();
      toast.success("Podcast episode updated");
      setEditingItem(null);
    } catch (err) {
      toast.error(err?.message || "Could not update this episode");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  return (
    <div className="creator-page-stack">
      <section className="creator-metric-grid">
        <article className="creator-metric-card card">
          <span>Total episodes</span>
          <strong>{analytics.totalEpisodes || 0}</strong>
        </article>
        <article className="creator-metric-card card">
          <span>Active episodes</span>
          <strong>{analytics.activeEpisodes || 0}</strong>
        </article>
        <article className="creator-metric-card card">
          <span>Podcast earnings</span>
          <strong>{formatCurrency(dashboard.categories?.podcasts?.earnings || 0)}</strong>
        </article>
      </section>

      <section className="creator-upload-notice card">
        <strong>Podcast verification</strong>
        <p>Podcast uploads use the same metadata and duplicate screening pipeline as music uploads, with episode and series checks layered in.</p>
      </section>

      <section className="creator-panel card">
        <div className="creator-panel-head">
          <div>
            <h2>Upload podcast episode</h2>
            <p>Keep podcast publishing strictly separated from music and books.</p>
          </div>
        </div>

        <div className="creator-form-grid">
          <label>
            <span>Episode title</span>
            <input value={podcastForm.title} onChange={(event) => setPodcastForm((current) => ({ ...current, title: event.target.value }))} />
          </label>
          <label>
            <span>Series</span>
            <input value={podcastForm.podcastSeries} onChange={(event) => setPodcastForm((current) => ({ ...current, podcastSeries: event.target.value }))} />
          </label>
          <label>
            <span>Season number</span>
            <input value={podcastForm.seasonNumber} inputMode="numeric" onChange={(event) => setPodcastForm((current) => ({ ...current, seasonNumber: event.target.value }))} />
          </label>
          <label>
            <span>Episode number</span>
            <input value={podcastForm.episodeNumber} inputMode="numeric" onChange={(event) => setPodcastForm((current) => ({ ...current, episodeNumber: event.target.value }))} />
          </label>
          <label>
            <span>Price</span>
            <input value={podcastForm.price} inputMode="numeric" onChange={(event) => setPodcastForm((current) => ({ ...current, price: event.target.value }))} />
          </label>
          <label>
            <span>Cover art</span>
            <input type="file" accept="image/*" onChange={(event) => setPodcastForm((current) => ({ ...current, cover: event.target.files?.[0] || null }))} />
          </label>
          <label>
            <span>Full audio upload</span>
            <input type="file" accept="audio/*" onChange={(event) => setPodcastForm((current) => ({ ...current, audio: event.target.files?.[0] || null }))} />
          </label>
          <label>
            <span>Optional teaser</span>
            <input type="file" accept="audio/*" onChange={(event) => setPodcastForm((current) => ({ ...current, preview: event.target.files?.[0] || null }))} />
          </label>
          <label className="creator-form-full">
            <span>Description</span>
            <textarea rows={4} value={podcastForm.description} onChange={(event) => setPodcastForm((current) => ({ ...current, description: event.target.value }))} />
          </label>
        </div>

        {busy ? <div className="creator-upload-progress">Uploading... {progress}%</div> : null}

        <div className="creator-form-actions">
          <button type="button" className="creator-ghost-btn" disabled={busy} onClick={() => submitEpisode("draft")}>
            Save draft
          </button>
          <button type="button" className="creator-primary-btn" disabled={busy} onClick={() => submitEpisode("published")}>
            Publish episode
          </button>
        </div>
      </section>

      <section className="creator-panel card">
        <div className="creator-panel-head">
          <div>
            <h2>Series management</h2>
            <p>Group your episodes by series so creators and support teams can see the structure at a glance.</p>
          </div>
        </div>
        <div className="creator-stack-list">
          {seriesSummary.length ? (
            seriesSummary.map(([series, count]) => (
              <div key={series} className="creator-stack-row">
                <span>{series}</span>
                <strong>{count} episodes</strong>
              </div>
            ))
          ) : (
            <div className="creator-empty-card">Your podcast series will appear here after your first episode.</div>
          )}
        </div>
      </section>

      {editingItem ? <PodcastEditPanel item={editingItem} onCancel={() => setEditingItem(null)} onSave={saveEdit} /> : null}

      <section className="creator-panel card">
        <div className="creator-panel-head">
          <div>
            <h2>Episodes and drafts</h2>
            <p>Monitor review state, metadata, and monetization for each episode.</p>
          </div>
        </div>
        <div className="creator-activity-list">
          {sortedEpisodes.length ? (
            sortedEpisodes.map((episode) => (
              <article key={episode._id} className="creator-release-card">
                <div>
                  <div className="creator-inline-row">
                    <strong>{episode.title}</strong>
                    <CopyrightStatusBadge status={episode.publishedStatus} />
                  </div>
                  <p>{episode.podcastSeries || "Standalone episode"}</p>
                </div>
                <div className="creator-release-meta">
                  <span>{formatCurrency(episode.price || 0)}</span>
                  <span>{formatShortDate(episode.updatedAt || episode.createdAt)}</span>
                  <CopyrightStatusBadge status={episode.copyrightScanStatus} />
                </div>
                <button type="button" className="creator-ghost-btn" onClick={() => setEditingItem(episode)}>
                  Edit metadata
                </button>
              </article>
            ))
          ) : (
            <div className="creator-empty-card">Your podcast catalog will appear here after your first upload.</div>
          )}
        </div>
      </section>
    </div>
  );
}
