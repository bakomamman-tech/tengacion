import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

import { createMusicTrack, createMusicVideo } from "../../../api";
import { useUnsavedChangesPrompt } from "../../../hooks/useUnsavedChangesPrompt";
import { formatCurrency } from "../creatorConfig";
import { useCreatorWorkspace } from "../useCreatorWorkspace";
import CreatorFileDropzone from "./CreatorFileDropzone";
import CreatorPublishOutcomeCard from "./CreatorPublishOutcomeCard";
import {
  AUDIO_ACCEPT,
  IMAGE_ACCEPT,
  VIDEO_ACCEPT,
  musicUploadSchema,
  splitCommaValues,
} from "./uploadSchemas";
import { buildUploadOutcome } from "./uploadAudienceUtils";
import useMediaFileMetadata from "./useMediaFileMetadata";

const buildDefaultValues = (creatorProfile) => ({
  releaseMediaType: "audio",
  trackTitle: "",
  artistName: creatorProfile?.displayName || creatorProfile?.fullName || "",
  genre: "",
  description: "",
  price: 0,
  releaseType: "single",
  explicitContent: false,
  featuringArtists: "",
  producerCredits: "",
  songwriterCredits: "",
  releaseDate: "",
  lyrics: "",
  coverImageFile: null,
  releaseMediaFile: null,
  previewSampleFile: null,
});

export default function MusicUploadStudio({ showNotice = true }) {
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
    resolver: zodResolver(musicUploadSchema),
    defaultValues: buildDefaultValues(creatorProfile),
  });

  useEffect(() => {
    reset(buildDefaultValues(creatorProfile));
  }, [creatorProfile, reset]);

  useUnsavedChangesPrompt(isDirty);

  const releaseMediaType = watch("releaseMediaType");
  const isVideoRelease = releaseMediaType === "video";
  const releaseMediaFile = watch("releaseMediaFile");
  const previewSampleFile = watch("previewSampleFile");
  const coverImageFile = watch("coverImageFile");
  const releaseType = watch("releaseType");
  const price = Number(watch("price") || 0);
  const trackTitle = watch("trackTitle");
  const artistName = watch("artistName");
  const genre = watch("genre");
  const explicitContent = watch("explicitContent");
  const creatorDisplayName =
    creatorProfile?.displayName || creatorProfile?.fullName || "Creator name";
  const { durationSec, formattedDuration } = useMediaFileMetadata(
    releaseMediaFile,
    releaseMediaType
  );

  const titleLabel = isVideoRelease ? "Video Title" : "Track Title";
  const titlePlaceholder = isVideoRelease ? "Lights On Me (Official Video)" : "Midnight Bloom";
  const descriptionPlaceholder = isVideoRelease
    ? "Describe the visual concept, performance story, and what makes this release special..."
    : "Tell listeners what this release is about...";
  const primaryUploadLabel = isVideoRelease ? "Full Video Upload" : "Full Audio Upload";
  const primaryUploadHelper = isVideoRelease
    ? "Upload the full high-quality music video for this release"
    : "Upload the full master audio for this release";
  const primaryUploadFormats = isVideoRelease
    ? "MP4, MOV, M4V, WEBM"
    : "MP3, WAV, FLAC, M4A, AAC, OGG";
  const primaryUploadAccept = isVideoRelease ? VIDEO_ACCEPT : AUDIO_ACCEPT;
  const previewUploadLabel = isVideoRelease ? "Preview Clip Upload" : "Preview Sample Upload";
  const previewUploadHelper = isVideoRelease
    ? "Optional teaser clip for paid music video releases"
    : "Optional teaser or sample clip for paid releases";
  const previewUploadFormats = isVideoRelease
    ? "Optional video teaser"
    : "Optional audio teaser";
  const coverUploadLabel = isVideoRelease ? "Thumbnail Upload" : "Cover Image Upload";
  const coverUploadHelper = isVideoRelease
    ? "Poster art or thumbnail for your music video"
    : "Square artwork for your release cover";
  const publishLabel = isVideoRelease ? "Publish Music Video" : "Publish Music";

  const submitUpload = async (values, publishMode) => {
    const isVideoUpload = values.releaseMediaType === "video";

    if (
      publishMode === "published"
      && Number(values.price || 0) > 0
      && !values.previewSampleFile
    ) {
      setError("previewSampleFile", {
        type: "manual",
        message: isVideoUpload
          ? "Add a preview clip before publishing a paid music video"
          : "Add a preview sample before publishing a paid music release",
      });
      return;
    }

    try {
      setBusyMode(publishMode);
      setProgress(0);
      clearErrors(["previewSampleFile", "releaseMediaFile"]);

      const formData = new FormData();

      if (isVideoUpload) {
        formData.append("title", values.trackTitle.trim());
        formData.append("description", values.description.trim());
        formData.append("price", String(values.price || 0));
        formData.append("publishedStatus", publishMode);
        formData.append("durationSec", String(durationSec || 0));
        formData.append("video", values.releaseMediaFile);
        if (values.previewSampleFile) {
          formData.append("previewClip", values.previewSampleFile);
        }
        if (values.coverImageFile) {
          formData.append("thumbnail", values.coverImageFile);
        }
      } else {
        formData.append("title", values.trackTitle.trim());
        formData.append("artistName", values.artistName.trim());
        formData.append("genre", values.genre.trim());
        formData.append("description", values.description.trim());
        formData.append("price", String(values.price || 0));
        formData.append("publishedStatus", publishMode);
        formData.append("releaseType", values.releaseType);
        formData.append("explicitContent", String(Boolean(values.explicitContent)));
        formData.append("featuringArtists", values.featuringArtists);
        formData.append("producerCredits", values.producerCredits);
        formData.append("songwriterCredits", values.songwriterCredits);
        formData.append("releaseDate", values.releaseDate || "");
        formData.append("lyrics", values.lyrics);
        formData.append("durationSec", String(durationSec || 0));
        formData.append("audio", values.releaseMediaFile);
        if (values.previewSampleFile) {
          formData.append("preview", values.previewSampleFile);
        }
        if (values.coverImageFile) {
          formData.append("cover", values.coverImageFile);
        }
      }

      const created = isVideoUpload
        ? await createMusicVideo(formData, { onProgress: setProgress })
        : await createMusicTrack(formData, { onProgress: setProgress });

      await refreshWorkspace();
      setOutcome(
        buildUploadOutcome({
          creatorProfileId: creatorProfile?._id || "",
          categoryKey: "music",
          itemType: isVideoUpload ? "video" : "track",
          itemId: created?._id || "",
          title: created?.title || values.trackTitle,
          publishedStatus: created?.publishedStatus || publishMode,
        })
      );
      toast.success(
        publishMode === "draft"
          ? isVideoUpload
            ? "Music video draft saved"
            : "Music draft saved"
          : isVideoUpload
            ? "Music video published"
            : "Music release published"
      );
      reset(buildDefaultValues(creatorProfile));
    } catch (err) {
      toast.error(
        err?.message
          || (isVideoUpload
            ? "Could not upload this music video"
            : "Could not upload this music release")
      );
    } finally {
      setBusyMode("");
      setProgress(0);
    }
  };

  return (
    <div className="creator-upload-studio-shell creator-upload-studio-shell--focused">
      {showNotice ? (
        <section className="creator-upload-notice card">
          <strong>Music uploads only</strong>
          <p>
            This studio is built for music releases only, whether you are
            publishing master audio or high-quality music videos. Podcast
            episode fields and book publishing inputs stay excluded here by
            design.
          </p>
        </section>
      ) : null}

      <div className="creator-upload-focus-grid">
        <section className="creator-panel creator-upload-form-card card">
          <div className="creator-panel-head">
            <div>
              <h2>Music Uploads</h2>
              <p>
                Publish polished music releases with focused metadata, artwork,
                pricing, and premium-ready audio or video assets.
              </p>
            </div>
            <span className="creator-status-badge success">Music only</span>
          </div>

          <div className="creator-upload-section">
            <div className="creator-upload-section-head">
              <strong>Release details</strong>
              <small>
                Everything needed for your storefront card and discovery
                metadata.
              </small>
            </div>
            <div className="creator-form-grid">
              <label>
                <span>{titleLabel}</span>
                <input placeholder={titlePlaceholder} {...register("trackTitle")} />
                {errors.trackTitle ? (
                  <p className="creator-field-error">{errors.trackTitle.message}</p>
                ) : null}
              </label>

              <label>
                <span>Release Format</span>
                <select
                  {...register("releaseMediaType")}
                  onChange={(event) => {
                    const nextType = event.target.value;
                    setValue("releaseMediaType", nextType, {
                      shouldDirty: true,
                    });
                    setValue("releaseMediaFile", null, {
                      shouldDirty: true,
                    });
                    setValue("previewSampleFile", null, {
                      shouldDirty: true,
                    });
                    clearErrors(["releaseMediaFile", "previewSampleFile"]);
                  }}
                >
                  <option value="audio">Audio release</option>
                  <option value="video">Music video</option>
                </select>
              </label>

              {!isVideoRelease ? (
                <label>
                  <span>Artist Name</span>
                  <input placeholder="Creator name" {...register("artistName")} />
                  {errors.artistName ? (
                    <p className="creator-field-error">{errors.artistName.message}</p>
                  ) : null}
                </label>
              ) : null}

              {!isVideoRelease ? (
                <label>
                  <span>Genre</span>
                  <input
                    placeholder="Afrobeats, Soul, Alternative"
                    {...register("genre")}
                  />
                  {errors.genre ? (
                    <p className="creator-field-error">{errors.genre.message}</p>
                  ) : null}
                </label>
              ) : null}

              {!isVideoRelease ? (
                <label>
                  <span>Release Type</span>
                  <select {...register("releaseType")}>
                    <option value="single">Single</option>
                    <option value="ep">EP</option>
                    <option value="album">Album</option>
                  </select>
                </label>
              ) : null}

              <label>
                <span>Price</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  placeholder="0"
                  {...register("price")}
                />
                {errors.price ? (
                  <p className="creator-field-error">{errors.price.message}</p>
                ) : null}
              </label>

              {!isVideoRelease ? (
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
              ) : null}

              <label className="creator-form-full">
                <span>{isVideoRelease ? "Video Description" : "Description"}</span>
                <textarea
                  rows={4}
                  placeholder={descriptionPlaceholder}
                  {...register("description")}
                />
                {errors.description ? (
                  <p className="creator-field-error">{errors.description.message}</p>
                ) : null}
              </label>
            </div>
          </div>

          <div className="creator-upload-section">
            <div className="creator-upload-section-head">
              <strong>Files</strong>
              <small>
                {isVideoRelease
                  ? "Upload high-quality music videos, optional preview clips, and clean thumbnail artwork."
                  : "Drag, drop, or browse. We'll show the selected file and upload state clearly."}
              </small>
            </div>
            <div className="creator-upload-dropzone-grid">
              <CreatorFileDropzone
                icon={isVideoRelease ? "V" : "A"}
                label={primaryUploadLabel}
                helper={primaryUploadHelper}
                accept={primaryUploadAccept}
                formats={primaryUploadFormats}
                file={releaseMediaFile}
                error={errors.releaseMediaFile?.message}
                onChange={(file) =>
                  setValue("releaseMediaFile", file, {
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
                label={coverUploadLabel}
                helper={coverUploadHelper}
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
            </div>
          </div>

          {!isVideoRelease ? (
            <details className="creator-advanced-panel">
              <summary>Advanced music details</summary>
              <div className="creator-form-grid">
                <label>
                  <span>Featuring Artists</span>
                  <input
                    placeholder="Comma-separated names"
                    {...register("featuringArtists")}
                  />
                </label>
                <label>
                  <span>Producer Credits</span>
                  <input
                    placeholder="Comma-separated producer names"
                    {...register("producerCredits")}
                  />
                </label>
                <label>
                  <span>Songwriter Credits</span>
                  <input
                    placeholder="Comma-separated songwriter names"
                    {...register("songwriterCredits")}
                  />
                </label>
                <label>
                  <span>Release Date</span>
                  <input type="date" {...register("releaseDate")} />
                </label>
                <label className="creator-form-full">
                  <span>Lyrics</span>
                  <textarea
                    rows={5}
                    placeholder="Optional lyrics for this release"
                    {...register("lyrics")}
                  />
                </label>
              </div>
            </details>
          ) : null}

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
                  : isVideoRelease
                    ? "Publishing music video"
                    : "Publishing release"}
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
              onClick={handleSubmit((values) => submitUpload(values, "published"))}
            >
              {publishLabel}
            </button>
          </div>
        </section>

        <aside className="creator-panel creator-upload-preview-card card">
          <div className="creator-panel-head">
            <div>
              <h2>Release preview</h2>
              <p>
                A clean summary of what will be published from this music
                studio.
              </p>
            </div>
          </div>

          <div className="creator-upload-preview-card__hero music">
            <span className="creator-upload-preview-card__eyebrow">
              {isVideoRelease ? "MUSIC VIDEO" : releaseType.toUpperCase()}
            </span>
            <strong>{trackTitle || (isVideoRelease ? "Untitled video" : "Untitled track")}</strong>
            <span>{isVideoRelease ? creatorDisplayName : artistName || creatorDisplayName}</span>
          </div>

          <div className="creator-stack-list">
            {isVideoRelease ? (
              <div className="creator-stack-row">
                <span>Format</span>
                <strong>High-quality music video</strong>
              </div>
            ) : (
              <div className="creator-stack-row">
                <span>Genre</span>
                <strong>{genre || "Not set yet"}</strong>
              </div>
            )}
            <div className="creator-stack-row">
              <span>Price</span>
              <strong>{formatCurrency(price || 0)}</strong>
            </div>
            <div className="creator-stack-row">
              <span>{isVideoRelease ? "Video duration" : "Audio duration"}</span>
              <strong>{formattedDuration || "Pending file metadata"}</strong>
            </div>
            <div className="creator-stack-row">
              <span>Preview access</span>
              <strong>
                {price <= 0
                  ? "Free release"
                  : previewSampleFile
                    ? "Preview ready"
                    : isVideoRelease
                      ? "Needs preview clip"
                      : "Needs preview sample"}
              </strong>
            </div>
          </div>

          <div className="creator-upload-checklist">
            <div
              className={`creator-upload-checklist-item${
                releaseMediaFile ? " is-complete" : ""
              }`}
            >
              <span />
              <small>
                {releaseMediaFile
                  ? isVideoRelease
                    ? "Full music video selected"
                    : "Full audio selected"
                  : isVideoRelease
                    ? "Add your full music video"
                    : "Add your full master audio"}
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
                  ? isVideoRelease
                    ? "Thumbnail selected"
                    : "Cover image selected"
                  : isVideoRelease
                    ? "Optional thumbnail can be added"
                    : "Optional cover image can be added"}
              </small>
            </div>
            <div
              className={`creator-upload-checklist-item${
                price <= 0 || previewSampleFile ? " is-complete" : ""
              }`}
            >
              <span />
              <small>
                {price <= 0 || previewSampleFile
                  ? "Preview requirement satisfied"
                  : isVideoRelease
                    ? "Paid music videos need a preview clip before publishing"
                    : "Paid releases need a preview sample before publishing"}
              </small>
            </div>
          </div>

          {!isVideoRelease ? (
            <div className="creator-upload-chip-row">
              {splitCommaValues(watch("featuringArtists")).map((value) => (
                <span key={value} className="creator-audience-chip">
                  {value}
                </span>
              ))}
            </div>
          ) : null}
        </aside>
      </div>

      <CreatorPublishOutcomeCard outcome={outcome} />
    </div>
  );
}
