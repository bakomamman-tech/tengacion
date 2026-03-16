import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import {
  createPodcastEpisode,
  updatePodcastSeries,
  updateTrackWithUploadProgress,
} from "../../api";
import CopyrightStatusBadge from "../../components/creator/CopyrightStatusBadge";
import CreatorStatsCard from "../../components/creator/CreatorStatsCard";
import PodcastEpisodeForm from "../../components/creator/upload/PodcastEpisodeForm";
import PodcastSeriesForm from "../../components/creator/upload/PodcastSeriesForm";
import { useCreatorWorkspace } from "../../components/creator/useCreatorWorkspace";
import { formatCurrency, formatShortDate } from "../../components/creator/creatorConfig";
import { useUnsavedChangesPrompt } from "../../hooks/useUnsavedChangesPrompt";

const EMPTY_PODCAST_FORM = {
  episodeTitle: "",
  description: "",
  podcastSeries: "",
  season: "",
  episodeNumber: "",
  accessType: "free",
  price: "",
  fullAudioFile: null,
  previewSampleFile: null,
  coverImageFile: null,
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
  const { creatorProfile, dashboard, refreshWorkspace, setCreatorProfile } = useCreatorWorkspace();
  const [podcastForm, setPodcastForm] = useState(EMPTY_PODCAST_FORM);
  const [seriesForm, setSeriesForm] = useState({
    podcastName: creatorProfile?.podcastsProfile?.podcastName || "",
    hostName: creatorProfile?.podcastsProfile?.hostName || "",
    themeOrTopic: creatorProfile?.podcastsProfile?.themeOrTopic || "",
    seriesTitle: creatorProfile?.podcastsProfile?.seriesTitle || "",
    description: creatorProfile?.podcastsProfile?.description || "",
  });
  const [busy, setBusy] = useState(false);
  const [seriesBusy, setSeriesBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [editingItem, setEditingItem] = useState(null);

  const episodes = useMemo(
    () => dashboard.content?.podcasts?.episodes || [],
    [dashboard.content?.podcasts?.episodes]
  );
  const analytics = dashboard.content?.podcasts?.analytics || {};
  const savedSeriesProfile = {
    podcastName: creatorProfile?.podcastsProfile?.podcastName || "",
    hostName: creatorProfile?.podcastsProfile?.hostName || "",
    themeOrTopic: creatorProfile?.podcastsProfile?.themeOrTopic || "",
    seriesTitle: creatorProfile?.podcastsProfile?.seriesTitle || "",
    description: creatorProfile?.podcastsProfile?.description || "",
  };

  useEffect(() => {
    setSeriesForm({
      podcastName: creatorProfile?.podcastsProfile?.podcastName || "",
      hostName: creatorProfile?.podcastsProfile?.hostName || "",
      themeOrTopic: creatorProfile?.podcastsProfile?.themeOrTopic || "",
      seriesTitle: creatorProfile?.podcastsProfile?.seriesTitle || "",
      description: creatorProfile?.podcastsProfile?.description || "",
    });
  }, [creatorProfile?.podcastsProfile]);

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

  const seriesDirty = JSON.stringify(seriesForm) !== JSON.stringify(savedSeriesProfile);

  const dirty = Boolean(
    podcastForm.episodeTitle ||
      podcastForm.description ||
      podcastForm.podcastSeries ||
      podcastForm.season ||
      podcastForm.episodeNumber ||
      podcastForm.price ||
      podcastForm.fullAudioFile ||
      podcastForm.previewSampleFile ||
      podcastForm.coverImageFile ||
      seriesDirty
  );

  useUnsavedChangesPrompt(dirty);

  const resetForm = () => setPodcastForm(EMPTY_PODCAST_FORM);

  const submitEpisode = async (publishedStatus) => {
    if (!podcastForm.episodeTitle.trim()) {
      toast.error("Episode title is required");
      return;
    }
    if (!podcastForm.fullAudioFile) {
      toast.error("Choose a full audio file");
      return;
    }
    const formData = new FormData();
    formData.append("title", podcastForm.episodeTitle.trim());
    formData.append("description", podcastForm.description.trim());
    formData.append("kind", "podcast");
    formData.append("podcastSeries", podcastForm.podcastSeries.trim());
    formData.append("seasonNumber", podcastForm.season || "0");
    formData.append("episodeNumber", podcastForm.episodeNumber || "0");
    formData.append("price", podcastForm.accessType === "paid" ? podcastForm.price || "0" : "0");
    formData.append("publishedStatus", publishedStatus);
    formData.append("audio", podcastForm.fullAudioFile);
    if (podcastForm.previewSampleFile) {
      formData.append("preview", podcastForm.previewSampleFile);
    }
    if (podcastForm.coverImageFile) {
      formData.append("cover", podcastForm.coverImageFile);
    }

    try {
      setBusy(true);
      await createPodcastEpisode(formData, { onProgress: setProgress });
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

  const saveSeriesProfile = async () => {
    try {
      setSeriesBusy(true);
      const payload = await updatePodcastSeries(seriesForm);
      if (payload?.creatorProfile) {
        setCreatorProfile(payload.creatorProfile);
      }
      toast.success("Podcast series profile saved");
    } catch (err) {
      toast.error(err?.message || "Could not save series profile");
    } finally {
      setSeriesBusy(false);
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
      if (values.cover) {
        formData.append("cover", values.cover);
      }
      if (values.audio) {
        formData.append("audio", values.audio);
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

      <section className="creator-upload-notice card">
        <strong>Podcast verification</strong>
        <p>Podcast uploads use the same metadata and duplicate screening pipeline as music uploads, with episode and series checks layered in.</p>
      </section>

      <section className="creator-upload-grid">
        <PodcastSeriesForm
          value={seriesForm}
          onChange={(key, nextValue) => setSeriesForm((current) => ({ ...current, [key]: nextValue }))}
          busy={seriesBusy}
          onSave={saveSeriesProfile}
        />

        <PodcastEpisodeForm
          value={podcastForm}
          onChange={(key, nextValue) => setPodcastForm((current) => ({ ...current, [key]: nextValue }))}
          busy={busy}
          progress={progress}
          onSaveDraft={() => submitEpisode("draft")}
          onPublish={() => submitEpisode("published")}
        />
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
