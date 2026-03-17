import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

import { createMusicTrack } from "../../../api";
import { useUnsavedChangesPrompt } from "../../../hooks/useUnsavedChangesPrompt";
import { formatCurrency } from "../creatorConfig";
import { useCreatorWorkspace } from "../useCreatorWorkspace";
import CreatorFileDropzone from "./CreatorFileDropzone";
import CreatorPublishOutcomeCard from "./CreatorPublishOutcomeCard";
import {
  AUDIO_ACCEPT,
  IMAGE_ACCEPT,
  musicUploadSchema,
  splitCommaValues,
} from "./uploadSchemas";
import { buildUploadOutcome } from "./uploadAudienceUtils";
import useAudioFileMetadata from "./useAudioFileMetadata";

const buildDefaultValues = (creatorProfile) => ({
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
  fullAudioFile: null,
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

  const fullAudioFile = watch("fullAudioFile");
  const previewSampleFile = watch("previewSampleFile");
  const coverImageFile = watch("coverImageFile");
  const releaseType = watch("releaseType");
  const price = Number(watch("price") || 0);
  const trackTitle = watch("trackTitle");
  const artistName = watch("artistName");
  const genre = watch("genre");
  const explicitContent = watch("explicitContent");
  const { durationSec, formattedDuration } = useAudioFileMetadata(fullAudioFile);

  const submitUpload = async (values, publishMode) => {
    if (publishMode === "published" && Number(values.price || 0) > 0 && !values.previewSampleFile) {
      setError("previewSampleFile", {
        type: "manual",
        message: "Add a preview sample before publishing a paid music release",
      });
      return;
    }

    try {
      setBusyMode(publishMode);
      setProgress(0);
      clearErrors("previewSampleFile");

      const formData = new FormData();
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
      formData.append("audio", values.fullAudioFile);
      if (values.previewSampleFile) {
        formData.append("preview", values.previewSampleFile);
      }
      if (values.coverImageFile) {
        formData.append("cover", values.coverImageFile);
      }

      const created = await createMusicTrack(formData, { onProgress: setProgress });
      await refreshWorkspace();
      setOutcome(
        buildUploadOutcome({
          creatorProfileId: creatorProfile?._id || "",
          categoryKey: "music",
          itemType: "track",
          itemId: created?._id || "",
          title: created?.title || values.trackTitle,
          publishedStatus: created?.publishedStatus || publishMode,
        })
      );
      toast.success(publishMode === "draft" ? "Music draft saved" : "Music release published");
      reset(buildDefaultValues(creatorProfile));
    } catch (err) {
      toast.error(err?.message || "Could not upload this music release");
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
          <p>This studio accepts only music metadata, cover art, and audio files. Podcast and book fields are excluded by design.</p>
        </section>
      ) : null}

      <div className="creator-upload-focus-grid">
        <section className="creator-panel creator-upload-form-card card">
          <div className="creator-panel-head">
            <div>
              <h2>Music Uploads</h2>
              <p>Create a polished music release with focused metadata, artwork, audio, and pricing.</p>
            </div>
            <span className="creator-status-badge success">Music only</span>
          </div>

          <div className="creator-upload-section">
            <div className="creator-upload-section-head">
              <strong>Release details</strong>
              <small>Everything needed for your storefront card and discovery metadata.</small>
            </div>
            <div className="creator-form-grid">
              <label>
                <span>Track Title</span>
                <input placeholder="Midnight Bloom" {...register("trackTitle")} />
                {errors.trackTitle ? <p className="creator-field-error">{errors.trackTitle.message}</p> : null}
              </label>

              <label>
                <span>Artist Name</span>
                <input placeholder="Creator name" {...register("artistName")} />
                {errors.artistName ? <p className="creator-field-error">{errors.artistName.message}</p> : null}
              </label>

              <label>
                <span>Genre</span>
                <input placeholder="Afrobeats, Soul, Alternative" {...register("genre")} />
                {errors.genre ? <p className="creator-field-error">{errors.genre.message}</p> : null}
              </label>

              <label>
                <span>Release Type</span>
                <select {...register("releaseType")}>
                  <option value="single">Single</option>
                  <option value="ep">EP</option>
                  <option value="album">Album</option>
                </select>
              </label>

              <label>
                <span>Price</span>
                <input type="number" min="0" step="1" inputMode="numeric" placeholder="0" {...register("price")} />
                {errors.price ? <p className="creator-field-error">{errors.price.message}</p> : null}
              </label>

              <label className="creator-toggle-field">
                <span>Explicit Content</span>
                <button
                  type="button"
                  className={`creator-toggle${explicitContent ? " is-active" : ""}`}
                  onClick={() => setValue("explicitContent", !explicitContent, { shouldDirty: true })}
                  aria-pressed={explicitContent}
                >
                  <span>{explicitContent ? "Enabled" : "Clean"}</span>
                </button>
              </label>

              <label className="creator-form-full">
                <span>Description</span>
                <textarea rows={4} placeholder="Tell listeners what this release is about..." {...register("description")} />
                {errors.description ? <p className="creator-field-error">{errors.description.message}</p> : null}
              </label>
            </div>
          </div>

          <div className="creator-upload-section">
            <div className="creator-upload-section-head">
              <strong>Files</strong>
              <small>Drag, drop, or browse. We’ll show the selected file and upload state clearly.</small>
            </div>
            <div className="creator-upload-dropzone-grid">
              <CreatorFileDropzone
                icon="A"
                label="Full Audio Upload"
                helper="Upload the full master audio for this release"
                accept={AUDIO_ACCEPT}
                formats="MP3, WAV, FLAC, M4A, AAC, OGG"
                file={fullAudioFile}
                error={errors.fullAudioFile?.message}
                onChange={(file) => setValue("fullAudioFile", file, { shouldDirty: true, shouldValidate: true })}
              />
              <CreatorFileDropzone
                icon="P"
                label="Preview Sample Upload"
                helper="Optional teaser or sample clip for paid releases"
                accept={AUDIO_ACCEPT}
                formats="Optional audio teaser"
                file={previewSampleFile}
                error={errors.previewSampleFile?.message}
                onChange={(file) => setValue("previewSampleFile", file, { shouldDirty: true, shouldValidate: true })}
              />
              <CreatorFileDropzone
                icon="C"
                label="Cover Image Upload"
                helper="Square artwork for your release cover"
                accept={IMAGE_ACCEPT}
                formats="PNG, JPG, WEBP, GIF, AVIF"
                file={coverImageFile}
                error={errors.coverImageFile?.message}
                onChange={(file) => setValue("coverImageFile", file, { shouldDirty: true, shouldValidate: true })}
              />
            </div>
          </div>

          <details className="creator-advanced-panel">
            <summary>Advanced music details</summary>
            <div className="creator-form-grid">
              <label>
                <span>Featuring Artists</span>
                <input placeholder="Comma-separated names" {...register("featuringArtists")} />
              </label>
              <label>
                <span>Producer Credits</span>
                <input placeholder="Comma-separated producer names" {...register("producerCredits")} />
              </label>
              <label>
                <span>Songwriter Credits</span>
                <input placeholder="Comma-separated songwriter names" {...register("songwriterCredits")} />
              </label>
              <label>
                <span>Release Date</span>
                <input type="date" {...register("releaseDate")} />
              </label>
              <label className="creator-form-full">
                <span>Lyrics</span>
                <textarea rows={5} placeholder="Optional lyrics for this release" {...register("lyrics")} />
              </label>
            </div>
          </details>

          {busyMode ? (
            <div className="creator-upload-progress-block" role="status" aria-live="polite">
              <div className="creator-upload-progress-bar">
                <span style={{ width: `${progress}%` }} />
              </div>
              <strong>{busyMode === "draft" ? "Saving draft" : "Publishing release"}...</strong>
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
              Publish Music
            </button>
          </div>
        </section>

        <aside className="creator-panel creator-upload-preview-card card">
          <div className="creator-panel-head">
            <div>
              <h2>Release preview</h2>
              <p>A clean summary of what will be published from this music studio.</p>
            </div>
          </div>

          <div className="creator-upload-preview-card__hero music">
            <span className="creator-upload-preview-card__eyebrow">{releaseType.toUpperCase()}</span>
            <strong>{trackTitle || "Untitled track"}</strong>
            <span>{artistName || "Artist name"}</span>
          </div>

          <div className="creator-stack-list">
            <div className="creator-stack-row">
              <span>Genre</span>
              <strong>{genre || "Not set yet"}</strong>
            </div>
            <div className="creator-stack-row">
              <span>Price</span>
              <strong>{formatCurrency(price || 0)}</strong>
            </div>
            <div className="creator-stack-row">
              <span>Audio duration</span>
              <strong>{formattedDuration || "Pending file metadata"}</strong>
            </div>
            <div className="creator-stack-row">
              <span>Explicit</span>
              <strong>{explicitContent ? "Yes" : "No"}</strong>
            </div>
          </div>

          <div className="creator-upload-checklist">
            <div className={`creator-upload-checklist-item${fullAudioFile ? " is-complete" : ""}`}>
              <span />
              <small>{fullAudioFile ? "Full audio selected" : "Add your full master audio"}</small>
            </div>
            <div className={`creator-upload-checklist-item${coverImageFile ? " is-complete" : ""}`}>
              <span />
              <small>{coverImageFile ? "Cover image selected" : "Optional cover image can be added"}</small>
            </div>
            <div className={`creator-upload-checklist-item${price <= 0 || previewSampleFile ? " is-complete" : ""}`}>
              <span />
              <small>
                {price <= 0 || previewSampleFile
                  ? "Preview requirement satisfied"
                  : "Paid releases need a preview sample before publishing"}
              </small>
            </div>
          </div>

          <div className="creator-upload-chip-row">
            {splitCommaValues(watch("featuringArtists")).map((value) => (
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
