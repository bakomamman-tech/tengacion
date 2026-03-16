import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { createPodcastEpisode, updatePodcastSeries } from "../../../api";
import { useUnsavedChangesPrompt } from "../../../hooks/useUnsavedChangesPrompt";
import { useCreatorWorkspace } from "../useCreatorWorkspace";
import CreatorPublishOutcomeCard from "./CreatorPublishOutcomeCard";
import PodcastEpisodeForm from "./PodcastEpisodeForm";
import PodcastSeriesForm from "./PodcastSeriesForm";
import { buildUploadOutcome } from "./uploadAudienceUtils";

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

export default function PodcastUploadStudio({ showNotice = true }) {
  const { creatorProfile, refreshWorkspace, setCreatorProfile } = useCreatorWorkspace();
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
  const [outcome, setOutcome] = useState(null);

  useEffect(() => {
    setSeriesForm({
      podcastName: creatorProfile?.podcastsProfile?.podcastName || "",
      hostName: creatorProfile?.podcastsProfile?.hostName || "",
      themeOrTopic: creatorProfile?.podcastsProfile?.themeOrTopic || "",
      seriesTitle: creatorProfile?.podcastsProfile?.seriesTitle || "",
      description: creatorProfile?.podcastsProfile?.description || "",
    });
  }, [creatorProfile?.podcastsProfile]);

  const savedSeriesProfile = useMemo(
    () => ({
      podcastName: creatorProfile?.podcastsProfile?.podcastName || "",
      hostName: creatorProfile?.podcastsProfile?.hostName || "",
      themeOrTopic: creatorProfile?.podcastsProfile?.themeOrTopic || "",
      seriesTitle: creatorProfile?.podcastsProfile?.seriesTitle || "",
      description: creatorProfile?.podcastsProfile?.description || "",
    }),
    [creatorProfile?.podcastsProfile]
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
      const created = await createPodcastEpisode(formData, { onProgress: setProgress });
      await refreshWorkspace();
      setOutcome(
        buildUploadOutcome({
          creatorProfileId: creatorProfile?._id || "",
          categoryKey: "podcast",
          itemType: "podcast",
          itemId: created?._id || "",
          title: created?.title || podcastForm.episodeTitle,
          publishedStatus: created?.publishedStatus || publishedStatus,
        })
      );
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

  return (
    <div className="creator-upload-studio-shell">
      {showNotice ? (
        <section className="creator-upload-notice card">
          <strong>Podcast verification</strong>
          <p>
            Podcast uploads use the same metadata and duplicate screening pipeline as music uploads, with episode and
            series checks layered in.
          </p>
        </section>
      ) : null}

      <section className="creator-upload-grid">
        <PodcastSeriesForm
          value={seriesForm}
          onChange={(key, nextValue) => setSeriesForm((current) => ({ ...current, [key]: nextValue }))}
          busy={seriesBusy}
          onSave={saveSeriesProfile}
        />

        <PodcastEpisodeForm
          value={podcastForm}
          onChange={(key, nextValue) =>
            setPodcastForm((current) => ({
              ...current,
              [key]: nextValue,
              ...(key === "accessType" && nextValue !== "paid" ? { price: "" } : {}),
            }))
          }
          busy={busy}
          progress={progress}
          onSaveDraft={() => submitEpisode("draft")}
          onPublish={() => submitEpisode("published")}
        />
      </section>

      <CreatorPublishOutcomeCard outcome={outcome} />
    </div>
  );
}
