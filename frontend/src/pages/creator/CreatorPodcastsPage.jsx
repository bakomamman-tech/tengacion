import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import { updateTrackWithUploadProgress } from "../../api";
import CopyrightStatusBadge from "../../components/creator/CopyrightStatusBadge";
import CreatorStatsCard from "../../components/creator/CreatorStatsCard";
import { useCreatorWorkspace } from "../../components/creator/useCreatorWorkspace";
import { formatCurrency, formatShortDate } from "../../components/creator/creatorConfig";

function PodcastEditPanel({ item, onCancel, onSave }) {
  const isVideoEpisode = item.mediaType === "video";
  const [values, setValues] = useState({
    title: item.title || "",
    description: item.description || "",
    podcastSeries: item.podcastSeries || "",
    seasonNumber: String(item.seasonNumber ?? ""),
    episodeNumber: String(item.episodeNumber ?? ""),
    price: String(item.price ?? ""),
    publishedStatus: item.publishedStatus === "draft" ? "draft" : "published",
    mediaType: item.mediaType || "audio",
    cover: null,
    media: null,
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
          <span>{isVideoEpisode ? "Replace video" : "Replace audio"}</span>
          <input
            type="file"
            accept={isVideoEpisode ? ".mp4,.mov,.m4v,.webm,video/*" : "audio/*"}
            onChange={(event) => update("media", event.target.files?.[0] || null)}
          />
        </label>
        <label>
          <span>{isVideoEpisode ? "Replace preview clip" : "Replace teaser"}</span>
          <input
            type="file"
            accept={isVideoEpisode ? ".mp4,.mov,.m4v,.webm,video/*" : "audio/*"}
            onChange={(event) => update("preview", event.target.files?.[0] || null)}
          />
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
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [editingItem, setEditingItem] = useState(null);

  const episodes = useMemo(() => dashboard.content?.podcasts?.episodes || [], [dashboard.content?.podcasts?.episodes]);
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
      formData.append("mediaType", values.mediaType || editingItem.mediaType || "audio");
      if (values.cover) {
        formData.append("cover", values.cover);
      }
      if (values.media) {
        formData.append("media", values.media);
      }
      if (values.preview) {
        formData.append("preview", values.preview);
      }

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
        <CreatorStatsCard
          label="Total episodes"
          value={analytics.totalEpisodes || 0}
          helper="Every episode published or drafted in this lane."
        />
        <CreatorStatsCard
          label="Active episodes"
          value={analytics.activeEpisodes || 0}
          helper="Podcast episodes currently live on Tengacion."
          tone="success"
        />
        <CreatorStatsCard
          label="Podcast earnings"
          value={formatCurrency(dashboard.categories?.podcast?.earnings || dashboard.categories?.podcasts?.earnings || 0)}
          helper="Creator share from podcast purchases and access unlocks."
        />
      </section>

      <section className="creator-inline-notice">
        <div>
          <strong>Dedicated upload page</strong>
          <span>Open the Podcast Uploads page for the dedicated episode publishing flow. This dashboard remains focused on managing your published and draft catalog.</span>
        </div>
        <Link className="creator-secondary-btn" to="/creator/podcasts/upload">
          Upload Podcasts
        </Link>
      </section>

      <section className="creator-panel card">
        <div className="creator-panel-head">
          <div>
            <h2>Series overview</h2>
            <p>Watch how episodes are distributed across your shows and standalone drops.</p>
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
                  <p>
                    {episode.podcastSeries || "Standalone episode"}
                    {" - "}
                    {episode.mediaType === "video" ? "Video episode" : "Audio episode"}
                  </p>
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

      {busy ? <div className="creator-upload-progress">Updating episode... {progress}%</div> : null}
    </div>
  );
}
