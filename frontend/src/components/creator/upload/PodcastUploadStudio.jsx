import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

import { createPodcastEpisode } from "../../../api";
import { useUnsavedChangesPrompt } from "../../../hooks/useUnsavedChangesPrompt";
import { formatCurrency } from "../creatorConfig";
import { useCreatorWorkspace } from "../useCreatorWorkspace";
import CreatorFileDropzone from "./CreatorFileDropzone";
import CreatorPublishOutcomeCard from "./CreatorPublishOutcomeCard";
import {
  AUDIO_ACCEPT,
  IMAGE_ACCEPT,
  TRANSCRIPT_ACCEPT,
  VIDEO_ACCEPT,
  podcastUploadSchema,
  splitCommaValues,
} from "./uploadSchemas";
import { buildUploadOutcome } from "./uploadAudienceUtils";
import useMediaFileMetadata from "./useMediaFileMetadata";

const buildDefaultValues = (creatorProfile) => ({
  episodeTitle: "",
  podcastSeriesName:
    creatorProfile?.podcastsProfile?.seriesTitle ||
    creatorProfile?.podcastsProfile?.podcastName ||
    "",
  episodeDescription: "",
  episodeMediaType: "audio",
  seasonNumber: "",
  episodeNumber: "",
  category: creatorProfile?.podcastsProfile?.themeOrTopic || "",
  episodeType: "free",
  price: 0,
  explicitContent: false,
  guestNames: "",
  showNotes: "",
  episodeTags: "",
  coverImageFile: null,
  episodeMediaFile: null,
  previewSampleFile: null,
  transcriptFile: null,
});

export default function PodcastUploadStudio({ showNotice = true }) {
  const { creatorProfile, refreshWorkspace } = useCreatorWorkspace();
  const [busyMode, setBusyMode] = useState("");
  const [progress, setProgress] = useState(0);
  const [outcome, setOutcome] = useState(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(podcastUploadSchema),
    defaultValues: buildDefaultValues(creatorProfile),
  });

  useEffect(() => {
    reset(buildDefaultValues(creatorProfile));
  }, [creatorProfile, reset]);

  useUnsavedChangesPrompt(isDirty);

  const episodeMediaType = watch("episodeMediaType");
  const isVideoEpisode = episodeMediaType === "video";
  const episodeMediaFile = watch("episodeMediaFile");
  const previewSampleFile = watch("previewSampleFile");
  const coverImageFile = watch("coverImageFile");
  const transcriptFile = watch("transcriptFile");
  const episodeType = watch("episodeType");
  const price = Number(watch("price") || 0);
  const episodeTitle = watch("episodeTitle");
  const podcastSeriesName = watch("podcastSeriesName");
  const category = watch("category");
  const explicitContent = watch("explicitContent");
  const { durationSec, formattedDuration } = useMediaFileMetadata(
    episodeMediaFile,
    episodeMediaType
  );

  const primaryUploadLabel = isVideoEpisode
    ? "Full Video Upload"
    : "Full Audio Upload";
  const primaryUploadHelper = isVideoEpisode
    ? "Upload the full high-quality video episode for this release"
    : "Upload the full episode master audio";
  const primaryUploadFormats = isVideoEpisode
    ? "MP4, MOV, M4V, WEBM"
    : "MP3, WAV, FLAC, M4A, AAC, OGG";
  const primaryUploadAccept = isVideoEpisode ? VIDEO_ACCEPT : AUDIO_ACCEPT;
  const previewUploadLabel = isVideoEpisode
    ? "Preview Clip Upload"
    : "Preview Sample Upload";
  const previewUploadHelper = isVideoEpisode
    ? "Optional teaser clip for discovery and premium gating"
    : "Optional sample clip for discovery and premium gating";
  const previewUploadFormats = isVideoEpisode
    ? "Optional video teaser"
    : "Optional audio teaser";

  const submitUpload = async (values, publishMode) => {
    const isVideoUpload = values.episodeMediaType === "video";

    if (values.episodeType === "premium" && Number(values.price || 0) <= 0) {
      setError("price", {
        type: "manual",
        message: "Premium podcast episodes need a price",
      });
      return;
    }

    if (
      publishMode === "published"
      && values.episodeType === "premium"
      && !values.previewSampleFile
    ) {
      setError("previewSampleFile", {
        type: "manual",
        message: isVideoUpload
          ? "Add a preview clip before publishing a premium video podcast episode"
          : "Add a preview sample before publishing a premium podcast episode",
      });
      return;
    }

    try {
      setBusyMode(publishMode);
      setProgress(0);
      clearErrors(["price", "previewSampleFile", "episodeMediaFile"]);

      const formData = new FormData();
      formData.append("title", values.episodeTitle.trim());
      formData.append("podcastSeries", values.podcastSeriesName.trim());
      formData.append("description", values.episodeDescription.trim());
      formData.append("mediaType", values.episodeMediaType);
      formData.append("seasonNumber", String(values.seasonNumber || 0));
      formData.append("episodeNumber", String(values.episodeNumber || 0));
      formData.append("category", values.category.trim());
      formData.append("episodeType", values.episodeType);
      formData.append(
        "price",
        String(values.episodeType === "premium" ? values.price || 0 : 0)
      );
      formData.append("publishedStatus", publishMode);
      formData.append("explicitContent", String(Boolean(values.explicitContent)));
      formData.append("guestNames", values.guestNames);
      formData.append("showNotes", values.showNotes);
      formData.append("episodeTags", values.episodeTags);
      formData.append("durationSec", String(durationSec || 0));
      formData.append("media", values.episodeMediaFile);
      if (values.previewSampleFile) {
        formData.append("preview", values.previewSampleFile);
      }
      if (values.coverImageFile) {
        formData.append("cover", values.coverImageFile);
      }
      if (values.transcriptFile) {
        formData.append("transcript", values.transcriptFile);
      }

      const created = await createPodcastEpisode(formData, {
        onProgress: setProgress,
      });
      await refreshWorkspace();
      setOutcome(
        buildUploadOutcome({
          creatorProfileId: creatorProfile?._id || "",
          categoryKey: "podcast",
          itemType: "podcast",
          itemId: created?._id || "",
          title: created?.title || values.episodeTitle,
          publishedStatus: created?.publishedStatus || publishMode,
        })
      );
      toast.success(
        publishMode === "draft"
          ? "Podcast draft saved"
          : "Podcast episode published"
      );
      reset(buildDefaultValues(creatorProfile));
    } catch (err) {
      toast.error(err?.message || "Could not upload this podcast episode");
    } finally {
      setBusyMode("");
      setProgress(0);
    }
  };

  return (
    <div className="creator-upload-studio-shell creator-upload-studio-shell--focused">
      {showNotice ? (
        <section className="creator-upload-notice card">
          <strong>Podcast uploads only</strong>
          <p>
            This studio is dedicated to podcast episodes and spoken-word
            metadata, whether you are publishing audio episodes or high-quality
            video podcasts. Music release fields and book publishing inputs are
            intentionally excluded.
          </p>
        </section>
      ) : null}

      <div className="creator-upload-focus-grid">
        <section className="creator-panel creator-upload-form-card card">
          <div className="creator-panel-head">
            <div>
              <h2>Podcast Uploads</h2>
              <p>
                Publish a clean episode page with series context, season
                numbering, monetization, and polished audio or video assets.
              </p>
            </div>
            <span className="creator-status-badge success">Podcast only</span>
          </div>

          <div className="creator-upload-section">
            <div className="creator-upload-section-head">
              <strong>Episode details</strong>
              <small>
                Everything your audience sees before they press play.
              </small>
            </div>

            <div className="creator-form-grid">
              <label>
                <span>Episode Title</span>
                <input
                  placeholder="Episode 012: Making the leap"
                  {...register("episodeTitle")}
                />
                {errors.episodeTitle ? (
                  <p className="creator-field-error">
                    {errors.episodeTitle.message}
                  </p>
                ) : null}
              </label>

              <label>
                <span>Podcast Series Name</span>
                <input
                  placeholder="Studio Conversations"
                  {...register("podcastSeriesName")}
                />
                {errors.podcastSeriesName ? (
                  <p className="creator-field-error">
                    {errors.podcastSeriesName.message}
                  </p>
                ) : null}
              </label>

              <label>
                <span>Episode Format</span>
                <select
                  {...register("episodeMediaType")}
                  onChange={(event) => {
                    const nextType = event.target.value;
                    setValue("episodeMediaType", nextType, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    setValue("episodeMediaFile", null, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    setValue("previewSampleFile", null, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    clearErrors(["episodeMediaFile", "previewSampleFile"]);
                  }}
                >
                  <option value="audio">Audio episode</option>
                  <option value="video">Video episode</option>
                </select>
              </label>

              <label>
                <span>Season Number</span>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="1"
                  {...register("seasonNumber")}
                />
                {errors.seasonNumber ? (
                  <p className="creator-field-error">
                    {errors.seasonNumber.message}
                  </p>
                ) : null}
              </label>

              <label>
                <span>Episode Number</span>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="12"
                  {...register("episodeNumber")}
                />
                {errors.episodeNumber ? (
                  <p className="creator-field-error">
                    {errors.episodeNumber.message}
                  </p>
                ) : null}
              </label>

              <label>
                <span>Category</span>
                <input
                  placeholder="Business, Culture, Wellness"
                  {...register("category")}
                />
                {errors.category ? (
                  <p className="creator-field-error">
                    {errors.category.message}
                  </p>
                ) : null}
              </label>

              <label>
                <span>Episode Type</span>
                <select
                  {...register("episodeType")}
                  onChange={(event) => {
                    setValue("episodeType", event.target.value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    if (event.target.value !== "premium") {
                      setValue("price", 0, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }
                  }}
                >
                  <option value="free">Free</option>
                  <option value="premium">Premium</option>
                </select>
              </label>

              <label>
                <span>Price</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  disabled={episodeType !== "premium"}
                  placeholder="0"
                  {...register("price")}
                />
                {errors.price ? (
                  <p className="creator-field-error">{errors.price.message}</p>
                ) : null}
              </label>

              <label className="creator-toggle-field">
                <span>Explicit Content</span>
                <button
                  type="button"
                  className={`creator-toggle${explicitContent ? " is-active" : ""}`}
                  onClick={() =>
                    setValue("explicitContent", !explicitContent, {
                      shouldDirty: true,
                    })
                  }
                  aria-pressed={explicitContent}
                >
                  <span>{explicitContent ? "Enabled" : "Clean"}</span>
                </button>
              </label>

              <label className="creator-form-full">
                <span>Episode Description</span>
                <textarea
                  rows={4}
                  placeholder="Describe the episode, key moments, and why it matters..."
                  {...register("episodeDescription")}
                />
                {errors.episodeDescription ? (
                  <p className="creator-field-error">
                    {errors.episodeDescription.message}
                  </p>
                ) : null}
              </label>
            </div>
          </div>

          <div className="creator-upload-section">
            <div className="creator-upload-section-head">
              <strong>Files</strong>
              <small>
                {isVideoEpisode
                  ? "Upload high-quality video episodes, optional preview clips, cover art, and transcripts."
                  : "Clean upload zones for audio, art, and optional transcript support."}
              </small>
            </div>

            <div className="creator-upload-dropzone-grid">
              <CreatorFileDropzone
                icon={isVideoEpisode ? "V" : "A"}
                label={primaryUploadLabel}
                helper={primaryUploadHelper}
                accept={primaryUploadAccept}
                formats={primaryUploadFormats}
                file={episodeMediaFile}
                error={errors.episodeMediaFile?.message}
                onChange={(file) =>
                  setValue("episodeMediaFile", file, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
              <CreatorFileDropzone
                icon="P"
                label={previewUploadLabel}
                helper={previewUploadHelper}
                accept={primaryUploadAccept}
                formats={previewUploadFormats}
                file={previewSampleFile}
                error={errors.previewSampleFile?.message}
                onChange={(file) =>
                  setValue("previewSampleFile", file, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
              <CreatorFileDropzone
                icon="C"
                label="Cover Image Upload"
                helper="Episode artwork or branded show cover"
                accept={IMAGE_ACCEPT}
                formats="PNG, JPG, WEBP, GIF, AVIF"
                file={coverImageFile}
                error={errors.coverImageFile?.message}
                onChange={(file) =>
                  setValue("coverImageFile", file, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
              <CreatorFileDropzone
                icon="T"
                label="Transcript Upload"
                helper="Optional transcript file for accessibility and repurposing"
                accept={TRANSCRIPT_ACCEPT}
                formats="PDF, TXT, DOC, DOCX"
                file={transcriptFile}
                error={errors.transcriptFile?.message}
                onChange={(file) =>
                  setValue("transcriptFile", file, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
            </div>
          </div>

          <details className="creator-advanced-panel">
            <summary>Advanced podcast details</summary>
            <div className="creator-form-grid">
              <label>
                <span>Guest Names</span>
                <input
                  placeholder="Comma-separated guest names"
                  {...register("guestNames")}
                />
              </label>
              <label>
                <span>Episode Tags</span>
                <input
                  placeholder="Comma-separated tags"
                  {...register("episodeTags")}
                />
              </label>
              <label className="creator-form-full">
                <span>Show Notes</span>
                <textarea
                  rows={5}
                  placeholder="Links, callouts, timestamps, and supporting notes"
                  {...register("showNotes")}
                />
              </label>
            </div>
          </details>

          {busyMode ? (
            <div
              className="creator-upload-progress-block"
              role="status"
              aria-live="polite"
            >
              <div className="creator-upload-progress-bar">
                <span style={{ width: `${progress}%` }} />
              </div>
              <strong>
                {busyMode === "draft"
                  ? "Saving draft"
                  : "Publishing episode"}
                ...
              </strong>
              <small>{progress}% uploaded</small>
            </div>
          ) : null}

          <div className="creator-form-actions">
            <button
              type="button"
              className="creator-ghost-btn"
              disabled={Boolean(busyMode)}
              onClick={handleSubmit((values) => submitUpload(values, "draft"))}
            >
              Save as Draft
            </button>
            <button
              type="button"
              className="creator-primary-btn"
              disabled={Boolean(busyMode)}
              onClick={handleSubmit((values) =>
                submitUpload(values, "published")
              )}
            >
              {isVideoEpisode ? "Publish Video Podcast" : "Publish Podcast"}
            </button>
          </div>
        </section>

        <aside className="creator-panel creator-upload-preview-card card">
          <div className="creator-panel-head">
            <div>
              <h2>Episode preview</h2>
              <p>
                A quick summary of how this podcast drop is shaping up before
                you publish it.
              </p>
            </div>
          </div>

          <div className="creator-upload-preview-card__hero podcasts">
            <span className="creator-upload-preview-card__eyebrow">
              {episodeType === "premium" ? "PREMIUM" : "FREE"}
            </span>
            <strong>{episodeTitle || "Untitled episode"}</strong>
            <span>{podcastSeriesName || "Podcast series"}</span>
          </div>

          <div className="creator-stack-list">
            <div className="creator-stack-row">
              <span>Format</span>
              <strong>{isVideoEpisode ? "Video podcast" : "Audio podcast"}</strong>
            </div>
            <div className="creator-stack-row">
              <span>Category</span>
              <strong>{category || "Not set yet"}</strong>
            </div>
            <div className="creator-stack-row">
              <span>Price</span>
              <strong>
                {formatCurrency(episodeType === "premium" ? price || 0 : 0)}
              </strong>
            </div>
            <div className="creator-stack-row">
              <span>Episode duration</span>
              <strong>{formattedDuration || "Pending file metadata"}</strong>
            </div>
            <div className="creator-stack-row">
              <span>Explicit</span>
              <strong>{explicitContent ? "Yes" : "No"}</strong>
            </div>
          </div>

          <div className="creator-upload-checklist">
            <div
              className={`creator-upload-checklist-item${
                episodeMediaFile ? " is-complete" : ""
              }`}
            >
              <span />
              <small>
                {episodeMediaFile
                  ? isVideoEpisode
                    ? "Episode video selected"
                    : "Episode audio selected"
                  : isVideoEpisode
                    ? "Add your full episode video"
                    : "Add your full episode audio"}
              </small>
            </div>
            <div
              className={`creator-upload-checklist-item${
                coverImageFile ? " is-complete" : ""
              }`}
            >
              <span />
              <small>
                {coverImageFile
                  ? "Cover image selected"
                  : "Optional episode cover can be added"}
              </small>
            </div>
            <div
              className={`creator-upload-checklist-item${
                episodeType !== "premium" || previewSampleFile
                  ? " is-complete"
                  : ""
              }`}
            >
              <span />
              <small>
                {episodeType !== "premium" || previewSampleFile
                  ? "Preview requirement satisfied"
                  : isVideoEpisode
                    ? "Premium video podcast episodes need a preview clip before publishing"
                    : "Premium episodes need a preview sample before publishing"}
              </small>
            </div>
            <div
              className={`creator-upload-checklist-item${
                transcriptFile ? " is-complete" : ""
              }`}
            >
              <span />
              <small>
                {transcriptFile
                  ? "Transcript attached"
                  : "Transcript upload is optional"}
              </small>
            </div>
          </div>

          <div className="creator-upload-chip-row">
            {splitCommaValues(watch("guestNames")).map((value) => (
              <span key={value} className="creator-audience-chip">
                {value}
              </span>
            ))}
          </div>
        </aside>
      </div>

      <CreatorPublishOutcomeCard outcome={outcome} />
    </div>
  );
}
