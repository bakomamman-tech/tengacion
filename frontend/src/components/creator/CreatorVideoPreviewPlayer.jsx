import { useEffect, useMemo, useRef, useState } from "react";

import { formatCurrency } from "./creatorConfig";
import "./CreatorVideoPreviewPlayer.css";

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const formatTime = (value = 0) => {
  const totalSeconds = Math.max(0, Math.floor(Number(value || 0)));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const formatCount = (value = 0) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Math.max(0, Number(value || 0)));

const pauseVideo = (video) => {
  if (!video || video.paused) {
    return;
  }

  try {
    video.pause();
  } catch {
    // Ignore cleanup failures in non-browser environments.
  }
};

export default function CreatorVideoPreviewPlayer({
  item,
  creatorName = "Creator",
  queueLength = 0,
  queueIndex = 0,
  onPrevious,
  onNext,
  onPlayingChange,
  autoplayRequest = 0,
}) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const lastAutoplayRequestRef = useRef(autoplayRequest);

  const [sourceMode, setSourceMode] = useState("full");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [playbackError, setPlaybackError] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPictureInPicture, setIsPictureInPicture] = useState(false);

  const itemId = String(item?.id || item?._id || item?.title || "");
  const title = item?.title || "No video selected";
  const subtitle = item?.subtitle || creatorName || "Creator";
  const posterUrl = String(item?.imageUrl || item?.coverUrl || "");
  const fullSource = String(item?.videoUrl || "");
  const previewSource = String(item?.previewVideoUrl || item?.previewClipUrl || "");

  const availableSources = useMemo(() => {
    const sources = [];

    if (fullSource) {
      sources.push({
        key: "full",
        label: "Full Video",
        helper: "Uploaded release video",
        src: fullSource,
      });
    }

    if (previewSource && previewSource !== fullSource) {
      sources.push({
        key: "preview",
        label: "Preview Clip",
        helper: "Short promotional clip",
        src: previewSource,
      });
    }

    return sources;
  }, [fullSource, previewSource]);

  const hasMultipleSources = availableSources.length > 1;
  const activeSourceMode = availableSources.some((entry) => entry.key === sourceMode)
    ? sourceMode
    : availableSources[0]?.key || "";
  const activeSourceEntry = availableSources.find((entry) => entry.key === activeSourceMode);
  const activeSource = activeSourceEntry?.src || "";
  const canPlayVideo = Boolean(activeSource);
  const displayedDuration = Math.max(0, Number(duration || item?.durationSec || 0));
  const queueSummary =
    queueLength > 1
      ? `${queueIndex + 1} of ${queueLength} videos`
      : item?.statusLabel || "Ready to watch";
  const supportingMeta = [
    item?.secondaryLine || "",
    Number(item?.viewsCount || item?.metricValue || 0) > 0
      ? `${formatCount(item?.viewsCount || item?.metricValue || 0)} views`
      : "",
    Number(item?.price || 0) > 0 ? formatCurrency(item.price) : "",
  ]
    .filter(Boolean)
    .join(" / ");
  const helperText = playbackError
    || (canPlayVideo
      ? activeSourceEntry?.helper || "Video preview ready"
      : "Upload a video in the music studio to preview it here.");
  const disableQueueNavigation = queueLength <= 1;
  const pictureInPictureAvailable =
    typeof document !== "undefined"
    && document.pictureInPictureEnabled
    && typeof videoRef.current?.requestPictureInPicture === "function";

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
    const video = videoRef.current;
    if (!video) {
      return;
    }

    pauseVideo(video);
    video.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(Number(item?.durationSec || 0));
    setPlaybackError("");
  }, [activeSource, item?.durationSec, itemId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.volume = clamp(volume, 0, 1);
    video.muted = isMuted;
  }, [isMuted, volume]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    onPlayingChange?.(isPlaying);
  }, [isPlaying, onPlayingChange]);

  useEffect(() => {
    if (autoplayRequest === lastAutoplayRequestRef.current) {
      return;
    }

    lastAutoplayRequestRef.current = autoplayRequest;

    const video = videoRef.current;
    if (!video || !activeSource) {
      return;
    }

    const startPlayback = async () => {
      try {
        setPlaybackError("");
        if (Number(video.currentTime || 0) >= Math.max(displayedDuration - 0.1, 0.1)) {
          video.currentTime = 0;
          setCurrentTime(0);
        }
        await video.play();
      } catch {
        setPlaybackError("Playback could not start yet. Try pressing play again.");
      }
    };

    startPlayback();
  }, [activeSource, autoplayRequest, displayedDuration]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const handleFullscreenChange = () => {
      const fullscreenElement = document.fullscreenElement;
      setIsFullscreen(
        Boolean(fullscreenElement && containerRef.current?.contains(fullscreenElement))
      );
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return undefined;
    }

    const handleEnterPictureInPicture = () => setIsPictureInPicture(true);
    const handleLeavePictureInPicture = () => setIsPictureInPicture(false);

    video.addEventListener("enterpictureinpicture", handleEnterPictureInPicture);
    video.addEventListener("leavepictureinpicture", handleLeavePictureInPicture);

    return () => {
      video.removeEventListener("enterpictureinpicture", handleEnterPictureInPicture);
      video.removeEventListener("leavepictureinpicture", handleLeavePictureInPicture);
    };
  }, [activeSource, itemId]);

  useEffect(
    () => () => {
      pauseVideo(videoRef.current);
    },
    []
  );

  const handleTogglePlayback = async () => {
    const video = videoRef.current;
    if (!video || !activeSource) {
      return;
    }

    try {
      setPlaybackError("");
      if (video.paused) {
        if (Number(video.currentTime || 0) >= Math.max(displayedDuration - 0.1, 0.1)) {
          video.currentTime = 0;
          setCurrentTime(0);
        }
        await video.play();
        return;
      }

      video.pause();
    } catch {
      setPlaybackError("Playback could not start yet. Try again.");
    }
  };

  const handleSeek = (value) => {
    const video = videoRef.current;
    if (!video || !activeSource) {
      return;
    }

    const nextTime = clamp(Number(value || 0), 0, displayedDuration || 0);
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleSkip = (offset) => {
    const video = videoRef.current;
    if (!video || !activeSource) {
      return;
    }

    const nextTime = clamp(
      Number(video.currentTime || 0) + Number(offset || 0),
      0,
      displayedDuration || 0
    );
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleVolumeChange = (value) => {
    const nextVolume = clamp(Number(value || 0), 0, 1);
    setVolume(nextVolume);
    if (nextVolume > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const handleToggleMute = () => {
    setIsMuted((current) => !current);
  };

  const handleTogglePictureInPicture = async () => {
    const video = videoRef.current;
    if (
      !video
      || !pictureInPictureAvailable
    ) {
      return;
    }

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture?.();
        return;
      }

      await video.requestPictureInPicture();
    } catch {
      setPlaybackError("Picture in picture is not available on this device.");
    }
  };

  const handleToggleFullscreen = async () => {
    const target = containerRef.current || videoRef.current;
    if (!target || typeof document === "undefined") {
      return;
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen?.();
        return;
      }

      await target.requestFullscreen?.();
    } catch {
      setPlaybackError("Fullscreen is not available in this browser.");
    }
  };

  return (
    <section
      className={`creator-video-preview-player${canPlayVideo ? "" : " is-disabled"}`}
      aria-label="Video preview player"
    >
      <div className="creator-video-preview-player__header">
        <div className="creator-video-preview-player__copy">
          <div className="creator-video-preview-player__badges">
            <span className="creator-video-preview-player__badge">
              {item?.statusLabel || "Workspace preview"}
            </span>
            <span className="creator-video-preview-player__badge creator-video-preview-player__badge--accent">
              {activeSourceEntry?.label || "Video"}
            </span>
          </div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>

        {hasMultipleSources ? (
          <div
            className="creator-video-preview-player__modes"
            role="tablist"
            aria-label="Choose video source"
          >
            {availableSources.map((entry) => {
              const isActive = entry.key === activeSourceMode;
              return (
                <button
                  key={entry.key}
                  type="button"
                  className={`creator-video-preview-player__mode-btn${isActive ? " is-active" : ""}`}
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

      <div className="creator-video-preview-player__stage-shell" ref={containerRef}>
        {canPlayVideo ? (
          <video
            ref={videoRef}
            className="creator-video-preview-player__stage"
            src={activeSource}
            poster={posterUrl || undefined}
            preload="metadata"
            playsInline
            onClick={handleTogglePlayback}
            onLoadedMetadata={(event) => {
              const nextDuration = Number(
                event.currentTarget.duration || item?.durationSec || 0
              );
              setDuration(nextDuration);
              setCurrentTime(Number(event.currentTarget.currentTime || 0));
            }}
            onDurationChange={(event) => {
              setDuration(Number(event.currentTarget.duration || item?.durationSec || 0));
            }}
            onTimeUpdate={(event) => {
              setCurrentTime(Number(event.currentTarget.currentTime || 0));
            }}
            onPlay={() => {
              setPlaybackError("");
              setIsPlaying(true);
            }}
            onPause={() => setIsPlaying(false)}
            onEnded={() => {
              setIsPlaying(false);
              setCurrentTime(displayedDuration);
            }}
            onVolumeChange={(event) => {
              setIsMuted(Boolean(event.currentTarget.muted));
              setVolume(Number(event.currentTarget.volume || 0));
            }}
            onError={() => {
              setIsPlaying(false);
              setPlaybackError("This video is not ready to play yet.");
            }}
            aria-label={`Preview video ${title}`}
          />
        ) : (
          <div className="creator-video-preview-player__empty">
            <div>
              <strong>No video source yet</strong>
              <p>Upload a video and optional preview clip to make this player live.</p>
            </div>
          </div>
        )}
      </div>

      <div className="creator-video-preview-player__controls">
        <div className="creator-video-preview-player__control-row">
          <div className="creator-video-preview-player__cluster">
            <button
              type="button"
              className="creator-video-preview-player__btn"
              onClick={onPrevious}
              disabled={disableQueueNavigation}
              aria-label="Previous video"
            >
              Back
            </button>
            <button
              type="button"
              className="creator-video-preview-player__btn"
              onClick={() => handleSkip(-10)}
              disabled={!canPlayVideo}
              aria-label={`Skip back 10 seconds in ${title}`}
            >
              -10s
            </button>
            <button
              type="button"
              className="creator-video-preview-player__btn creator-video-preview-player__btn--primary"
              onClick={handleTogglePlayback}
              disabled={!canPlayVideo}
              aria-label={`${isPlaying ? "Pause" : "Play"} ${title}`}
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              className="creator-video-preview-player__btn"
              onClick={() => handleSkip(10)}
              disabled={!canPlayVideo}
              aria-label={`Skip forward 10 seconds in ${title}`}
            >
              +10s
            </button>
            <button
              type="button"
              className="creator-video-preview-player__btn"
              onClick={onNext}
              disabled={disableQueueNavigation}
              aria-label="Next video"
            >
              Next
            </button>
          </div>
        </div>

        <div className="creator-video-preview-player__timeline">
          <span>{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max={Math.max(1, displayedDuration || 0)}
            step="0.1"
            value={Math.min(currentTime, Math.max(1, displayedDuration || 0))}
            className="creator-video-preview-player__range"
            onChange={(event) => handleSeek(event.target.value)}
            disabled={!canPlayVideo}
            aria-label={`Seek within ${title}`}
          />
          <span>{formatTime(displayedDuration || 0)}</span>
        </div>

        <div className="creator-video-preview-player__control-row creator-video-preview-player__control-row--secondary">
          <div className="creator-video-preview-player__cluster">
            <button
              type="button"
              className="creator-video-preview-player__btn"
              onClick={handleToggleMute}
              disabled={!canPlayVideo}
              aria-label={isMuted ? `Unmute ${title}` : `Mute ${title}`}
            >
              {isMuted ? "Unmute" : "Mute"}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              className="creator-video-preview-player__range creator-video-preview-player__range--volume"
              onChange={(event) => handleVolumeChange(event.target.value)}
              disabled={!canPlayVideo}
              aria-label={`Adjust volume for ${title}`}
            />
          </div>

          <div className="creator-video-preview-player__cluster creator-video-preview-player__cluster--actions">
            <label className="creator-video-preview-player__speed">
              <span>Speed</span>
              <select
                value={String(playbackRate)}
                onChange={(event) => setPlaybackRate(Number(event.target.value || 1))}
                disabled={!canPlayVideo}
                aria-label="Playback speed"
              >
                {PLAYBACK_RATES.map((rate) => (
                  <option key={rate} value={rate}>
                    {rate}x
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="creator-video-preview-player__btn"
              onClick={handleTogglePictureInPicture}
              disabled={!canPlayVideo || !pictureInPictureAvailable}
              aria-label="Picture in picture"
            >
              {isPictureInPicture ? "Exit PiP" : "PiP"}
            </button>
            <button
              type="button"
              className="creator-video-preview-player__btn"
              onClick={handleToggleFullscreen}
              disabled={!canPlayVideo}
              aria-label="Fullscreen"
            >
              {isFullscreen ? "Exit Full" : "Fullscreen"}
            </button>
          </div>
        </div>
      </div>

      <div className="creator-video-preview-player__footer">
        <span>{queueSummary}</span>
        <span>{supportingMeta || "Video preview ready"}</span>
        <small>{helperText}</small>
      </div>
    </section>
  );
}
