import { useState } from "react";
import toast from "react-hot-toast";

import {
  createMusicAlbum,
  createMusicTrack,
  createMusicVideo,
} from "../../../api";
import { useUnsavedChangesPrompt } from "../../../hooks/useUnsavedChangesPrompt";
import { useCreatorWorkspace } from "../useCreatorWorkspace";
import AlbumUploadForm from "./AlbumUploadForm";
import CreatorPublishOutcomeCard from "./CreatorPublishOutcomeCard";
import MusicVideoUploadForm from "./MusicVideoUploadForm";
import TrackUploadForm from "./TrackUploadForm";
import { buildUploadOutcome } from "./uploadAudienceUtils";

const EMPTY_TRACK_FORM = {
  trackTitle: "",
  description: "",
  genre: "",
  price: "",
  fullAudioFile: null,
  previewSampleFile: null,
  coverImageFile: null,
};

const EMPTY_ALBUM_FORM = {
  albumTitle: "",
  description: "",
  releaseType: "album",
  price: "",
  albumCoverImageFile: null,
  albumSongsFiles: [],
  optionalPreviewSamples: [],
};

const EMPTY_VIDEO_FORM = {
  videoTitle: "",
  description: "",
  price: "",
  videoFile: null,
  thumbnailFile: null,
  previewClipFile: null,
};

export default function MusicUploadStudio({ showNotice = true }) {
  const { creatorProfile, refreshWorkspace } = useCreatorWorkspace();
  const [trackForm, setTrackForm] = useState(EMPTY_TRACK_FORM);
  const [albumForm, setAlbumForm] = useState(EMPTY_ALBUM_FORM);
  const [videoForm, setVideoForm] = useState(EMPTY_VIDEO_FORM);
  const [busyKey, setBusyKey] = useState("");
  const [progress, setProgress] = useState(0);
  const [outcome, setOutcome] = useState(null);

  const hasUnsavedChanges = Boolean(
    trackForm.trackTitle ||
      trackForm.description ||
      trackForm.genre ||
      trackForm.price ||
      trackForm.fullAudioFile ||
      trackForm.previewSampleFile ||
      trackForm.coverImageFile ||
      albumForm.albumTitle ||
      albumForm.description ||
      albumForm.price ||
      albumForm.albumCoverImageFile ||
      albumForm.albumSongsFiles.length ||
      albumForm.optionalPreviewSamples.length ||
      videoForm.videoTitle ||
      videoForm.description ||
      videoForm.price ||
      videoForm.videoFile ||
      videoForm.thumbnailFile ||
      videoForm.previewClipFile
  );

  useUnsavedChangesPrompt(hasUnsavedChanges);

  const resetTrackForm = () => setTrackForm(EMPTY_TRACK_FORM);
  const resetAlbumForm = () => setAlbumForm(EMPTY_ALBUM_FORM);
  const resetVideoForm = () => setVideoForm(EMPTY_VIDEO_FORM);

  const submitTrack = async (publishedStatus) => {
    if (!trackForm.trackTitle.trim()) {
      toast.error("Track title is required");
      return;
    }
    if (!trackForm.fullAudioFile) {
      toast.error("Choose an audio file");
      return;
    }

    const formData = new FormData();
    formData.append("title", trackForm.trackTitle.trim());
    formData.append("description", trackForm.description.trim());
    formData.append("genre", trackForm.genre.trim());
    formData.append("price", trackForm.price || "0");
    formData.append("kind", "music");
    formData.append("publishedStatus", publishedStatus);
    formData.append("audio", trackForm.fullAudioFile);
    if (trackForm.previewSampleFile) {
      formData.append("preview", trackForm.previewSampleFile);
    }
    if (trackForm.coverImageFile) {
      formData.append("cover", trackForm.coverImageFile);
    }

    try {
      setBusyKey("track");
      setProgress(0);
      const created = await createMusicTrack(formData, { onProgress: setProgress });
      await refreshWorkspace();
      setOutcome(
        buildUploadOutcome({
          creatorProfileId: creatorProfile?._id || "",
          categoryKey: "music",
          itemType: "track",
          itemId: created?._id || "",
          title: created?.title || trackForm.trackTitle,
          publishedStatus: created?.publishedStatus || publishedStatus,
        })
      );
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
    if (!albumForm.albumCoverImageFile) {
      toast.error("Choose a cover image");
      return;
    }
    if (!albumForm.albumSongsFiles.length) {
      toast.error("Add at least one audio track");
      return;
    }

    const formData = new FormData();
    formData.append("albumTitle", albumForm.albumTitle.trim());
    formData.append("description", albumForm.description.trim());
    formData.append("releaseType", albumForm.releaseType);
    formData.append("price", albumForm.price || "0");
    formData.append("publishedStatus", publishedStatus);
    formData.append("coverImage", albumForm.albumCoverImageFile);
    albumForm.albumSongsFiles.forEach((file) => formData.append("tracks", file));
    albumForm.optionalPreviewSamples.forEach((file) => formData.append("previews", file));

    try {
      setBusyKey("album");
      setProgress(0);
      const created = await createMusicAlbum(formData, { onProgress: setProgress });
      await refreshWorkspace();
      setOutcome(
        buildUploadOutcome({
          creatorProfileId: creatorProfile?._id || "",
          categoryKey: "music",
          itemType: "album",
          itemId: created?._id || "",
          title: created?.title || albumForm.albumTitle,
          publishedStatus: created?.publishedStatus || publishedStatus,
        })
      );
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
    if (!videoForm.videoTitle.trim()) {
      toast.error("Video title is required");
      return;
    }
    if (!videoForm.videoFile) {
      toast.error("Choose a music video file");
      return;
    }

    const formData = new FormData();
    formData.append("title", videoForm.videoTitle.trim());
    formData.append("description", videoForm.description.trim());
    formData.append("price", videoForm.price || "0");
    formData.append("publishedStatus", publishedStatus);
    formData.append("video", videoForm.videoFile);
    if (videoForm.thumbnailFile) {
      formData.append("thumbnail", videoForm.thumbnailFile);
    }
    if (videoForm.previewClipFile) {
      formData.append("previewClip", videoForm.previewClipFile);
    }

    try {
      setBusyKey("video");
      setProgress(0);
      const created = await createMusicVideo(formData, { onProgress: setProgress });
      await refreshWorkspace();
      setOutcome(
        buildUploadOutcome({
          creatorProfileId: creatorProfile?._id || "",
          categoryKey: "music",
          itemType: "video",
          itemId: created?._id || "",
          title: created?.title || videoForm.videoTitle,
          publishedStatus: created?.publishedStatus || publishedStatus,
        })
      );
      toast.success(publishedStatus === "draft" ? "Music video draft saved" : "Music video uploaded");
      resetVideoForm();
    } catch (err) {
      toast.error(err?.message || "Could not upload music video");
    } finally {
      setBusyKey("");
      setProgress(0);
    }
  };

  return (
    <div className="creator-upload-studio-shell">
      {showNotice ? (
        <section className="creator-upload-notice card">
          <strong>Copyright screening</strong>
          <p>
            This upload flow runs metadata and duplicate checks before publication. Flagged uploads may require
            review before they go live.
          </p>
        </section>
      ) : null}

      <section className="creator-upload-grid">
        <TrackUploadForm
          value={trackForm}
          onChange={(key, nextValue) => setTrackForm((current) => ({ ...current, [key]: nextValue }))}
          busy={busyKey === "track"}
          progress={progress}
          onSaveDraft={() => submitTrack("draft")}
          onPublish={() => submitTrack("published")}
        />

        <AlbumUploadForm
          value={albumForm}
          onChange={(key, nextValue) => setAlbumForm((current) => ({ ...current, [key]: nextValue }))}
          busy={busyKey === "album"}
          progress={progress}
          onSaveDraft={() => submitAlbum("draft")}
          onPublish={() => submitAlbum("published")}
        />
      </section>

      <MusicVideoUploadForm
        value={videoForm}
        onChange={(key, nextValue) => setVideoForm((current) => ({ ...current, [key]: nextValue }))}
        busy={busyKey === "video"}
        progress={progress}
        onSaveDraft={() => submitVideo("draft")}
        onPublish={() => submitVideo("published")}
      />

      <CreatorPublishOutcomeCard outcome={outcome} />
    </div>
  );
}
