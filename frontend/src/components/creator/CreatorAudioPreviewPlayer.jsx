import { useEffect, useRef, useState } from "react";

import { formatCurrency } from "./creatorConfig";
import "./CreatorAudioPreviewPlayer.css";

const AUDIO_PLAYER_ITEM_TYPES = new Set(["track", "podcast"]);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const pauseAudio = (audio) => {
  if (!audio || audio.paused) {
    return;
  }

  try {
    audio.pause();
  } catch {
    // Ignore playback cleanup issues in non-browser test environments.
  }
};

const formatTime = (value = 0) => {
  const totalSeconds = Math.max(0, Math.floor(Number(value || 0)));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const getEmptyStateCopy = (itemType = "") => {
  if (itemType === "book") {
    return "Books open in reader mode. Switch to music or podcasts for audio playback.";
  }

  if (itemType === "video") {
    return "Video releases open in their release view. Audio playback activates for tracks and podcast episodes.";
  }

  return "Upload or select an audio release to preview it here.";
};

export default function CreatorAudioPreviewPlayer({
  item,
  creatorName = "Creator",
  queueLength = 0,
  queueIndex = 0,
  onPrevious,
  onNext,
  onPlayingChange,
  autoplayRequest = 0,
  variant = "workspace",
}) {
  const audioRef = useRef(null);
  const lastAutoplayRequestRef = useRef(autoplayRequest);

  const [sourceMode, setSourceMode] = useState("full");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(Number(item?.durationSec || 0));
  const [playbackError, setPlaybackError] = useState("");

  const itemId = String(item?.id || item?._id || item?.title || "");
  const itemType = String(item?.itemType || "").trim().toLowerCase();
  const canPlayAudio =
    Boolean(item?.isPlayableAudio) && AUDIO_PLAYER_ITEM_TYPES.has(itemType);

  const fullSource = canPlayAudio ? String(item?.audioUrl || "") : "";
  const previewSource = canPlayAudio ? String(item?.previewAudioUrl || "") : "";
  const availableSources = [];

  if (fullSource) {
    availableSources.push({
      key: "full",
      label: "Full Track",
      helper: "Creator full-track preview",
      src: fullSource,
    });
  }

  if (previewSource && previewSource !== fullSource) {
    availableSources.push({
      key: "preview",
      label: "Preview Sample",
      helper: "Public preview sample",
      src: previewSource,
    });
  }

  const hasMultipleSources = availableSources.length > 1;
  const activeSourceMode = availableSources.some((entry) => entry.key === sourceMode)
    ? sourceMode
    : availableSources[0]?.key || "";
  const activeSource =
    availableSources.find((entry) => entry.key === activeSourceMode)?.src || "";
  const activeSourceLabel =
    availableSources.find((entry) => entry.key === activeSourceMode)?.helper || "";
  const coverImageUrl = String(item?.imageUrl || item?.coverUrl || "");
  const title = item?.title || "No release selected";
  const subtitle = item?.subtitle || creatorName || "Creator";
  const queueSummary =
    queueLength > 1
      ? `${queueIndex + 1} of ${queueLength} in queue`
      : item?.statusLabel || "Ready to preview";
  const supportingMeta =
    item?.secondaryLine ||
    (Number(item?.price || 0) > 0 ? formatCurrency(item.price) : "Free release");
  const helperText =
    playbackError ||
    (canPlayAudio
      ? activeSourceLabel || "Release preview ready"
      : getEmptyStateCopy(itemType));

  useEffect(() => {
    if (!availableSources.length) {
      setSourceMode("");
      return;
    }

    if (!availableSources.some((entry) => entry.key === sourceMode)) {
      setSourceMode(availableSources[0].key);
    }
  }, [availableSources, sourceMode]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    pauseAudio(audio);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(Number(item?.durationSec || 0));
    setPlaybackError("");
  }, [activeSource, item?.durationSec, itemId]);

  useEffect(() => {
    onPlayingChange?.(isPlaying);
  }, [isPlaying, onPlayingChange]);

  useEffect(() => {
    if (autoplayRequest === lastAutoplayRequestRef.current) {
      return;
    }

    lastAutoplayRequestRef.current = autoplayRequest;

    const audio = audioRef.current;
    if (!audio || !activeSource) {
      return;
    }

    const startPlayback = async () => {
      try {
        setPlaybackError("");
        audio.currentTime = 0;
        await audio.play();
      } catch {
        setPlaybackError("Playback could not start yet. Try pressing play again.");
      }
    };

    startPlayback();
  }, [activeSource, autoplayRequest]);

  useEffect(
    () => () => {
      pauseAudio(audioRef.current);
    },
    []
  );

  const handleTogglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio || !activeSource) {
      return;
    }

    try {
      setPlaybackError("");
      if (audio.paused) {
        await audio.play();
        return;
      }
      audio.pause();
    } catch {
      setPlaybackError("Playback could not start yet. Try again.");
    }
  };

  const handleSeek = (value) => {
    const audio = audioRef.current;
    if (!audio || !activeSource) {
      return;
    }

    const maxDuration = Math.max(
      0,
      Number(audio.duration || 0),
      Number(duration || 0),
      Number(item?.durationSec || 0)
    );
    const nextTime = clamp(Number(value || 0), 0, maxDuration || 0);
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const disableQueueNavigation = queueLength <= 1;

  return (
    <div
      className={`creator-audio-preview-player creator-audio-preview-player--${variant}${
        canPlayAudio ? "" : " is-disabled"
      }`}
    >
      <div className="creator-audio-preview-player__top">
        <div className="creator-audio-preview-player__track">
          <div className="creator-audio-preview-player__cover" aria-hidden="true">
            {coverImageUrl ? <img src={coverImageUrl} alt="" /> : <span>{title.slice(0, 1) || "T"}</span>}
          </div>

          <div className="creator-audio-preview-player__copy">
            <div className="creator-audio-preview-player__badges">
              <span className="creator-audio-preview-player__badge">
                {item?.statusLabel || "Workspace preview"}
              </span>
              {canPlayAudio ? (
                <span className="creator-audio-preview-player__badge creator-audio-preview-player__badge--accent">
                  {activeSourceMode === "preview" ? "Preview Sample" : "Full Track"}
                </span>
              ) : null}
            </div>

            <strong>{title}</strong>
            <span>{subtitle}</span>
          </div>
        </div>

        {hasMultipleSources ? (
          <div className="creator-audio-preview-player__modes" role="tablist" aria-label="Choose playback source">
            {availableSources.map((entry) => {
              const isActive = entry.key === activeSourceMode;
              return (
                <button
                  key={entry.key}
                  type="button"
                  className={`creator-audio-preview-player__mode-btn${isActive ? " is-active" : ""}`}
                  aria-pressed={isActive}
                  onClick={() => setSourceMode(entry.key)}
                >
                  {entry.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="creator-audio-preview-player__controls">
        <div className="creator-audio-preview-player__buttons">
          <button
            type="button"
            className="creator-audio-preview-player__control-btn"
            onClick={onPrevious}
            disabled={disableQueueNavigation}
            aria-label="Previous release"
          >
            Back
          </button>
          <button
            type="button"
            className="creator-audio-preview-player__control-btn creator-audio-preview-player__control-btn--primary"
            onClick={handleTogglePlayback}
            disabled={!canPlayAudio}
            aria-label={`${isPlaying ? "Pause" : "Play"} ${title}`}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            className="creator-audio-preview-player__control-btn"
            onClick={onNext}
            disabled={disableQueueNavigation}
            aria-label="Next release"
          >
            Next
          </button>
        </div>

        <div className="creator-audio-preview-player__timeline">
          <span className="creator-audio-preview-player__time">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min="0"
            max={Math.max(1, Number(duration || item?.durationSec || 0))}
            step="1"
            value={Math.min(
              Number(currentTime || 0),
              Math.max(1, Number(duration || item?.durationSec || 0))
            )}
            className="creator-audio-preview-player__range"
            onChange={(event) => handleSeek(event.target.value)}
            disabled={!canPlayAudio}
            aria-label={`Seek within ${title}`}
          />
          <span className="creator-audio-preview-player__time">
            {formatTime(duration || item?.durationSec || 0)}
          </span>
        </div>
      </div>

      <div className="creator-audio-preview-player__meta">
        <span>{queueSummary}</span>
        <span>{supportingMeta}</span>
        <small>{helperText}</small>
      </div>

      <audio
        ref={audioRef}
        className="creator-audio-preview-player__media"
        src={activeSource || undefined}
        preload="metadata"
        onLoadedMetadata={(event) =>
          setDuration(
            Number(event.currentTarget.duration || item?.durationSec || 0)
          )
        }
        onTimeUpdate={(event) =>
          setCurrentTime(Number(event.currentTarget.currentTime || 0))
        }
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onError={() => {
          setIsPlaying(false);
          setPlaybackError("This release is not ready to play yet.");
        }}
      />
    </div>
  );
}
