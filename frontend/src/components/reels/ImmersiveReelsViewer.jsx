import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getReelAvatar,
  getReelAvatarFallback,
  getReelDisplayName,
  getReelPoster,
  getReelUsername,
  getReelVideoUrl,
} from "../../utils/reels";
import "./immersiveReelsViewer.css";

const compactFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const formatCount = (value) =>
  compactFormatter.format(Math.max(0, Number(value) || 0));

const getLikesCount = (reel) => Number(reel?.likesCount ?? reel?.likes ?? 0) || 0;
const getCommentsCount = (reel) =>
  Number(reel?.commentsCount) || (Array.isArray(reel?.comments) ? reel.comments.length : 0);

const getRelativeTime = (value) => {
  if (!value) {
    return "Just now";
  }

  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(elapsed / 60000));
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  return `${Math.floor(hours / 24)}d`;
};

function ViewerIcon({ name }) {
  const paths = {
    close: <path d="M6 6l12 12M18 6 6 18" />,
    up: <path d="m7 14 5-5 5 5" />,
    down: <path d="m7 10 5 5 5-5" />,
    volume: (
      <>
        <path d="M5 10v4h3l4 3V7l-4 3H5Z" />
        <path d="M16 9.5a4 4 0 0 1 0 5M18.5 7a7.5 7.5 0 0 1 0 10" />
      </>
    ),
    mute: (
      <>
        <path d="M5 10v4h3l4 3V7l-4 3H5Z" />
        <path d="m16 10 4 4M20 10l-4 4" />
      </>
    ),
    heart: <path d="M20 9c0 5-8 10-8 10S4 14 4 9a4 4 0 0 1 7-2.7L12 7.5l1-1.2A4 4 0 0 1 20 9Z" />,
    comment: (
      <>
        <path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 9 9 0 0 1-3.4-.7L4 20l1.7-4A7.3 7.3 0 0 1 4 11.5a7.5 7.5 0 0 1 8-7.5 7.5 7.5 0 0 1 8 7.5Z" />
        <path d="M9 11.5h6" />
      </>
    ),
    play: <path d="m9 7 8 5-8 5V7Z" />,
    share: (
      <>
        <circle cx="18" cy="5" r="2" />
        <circle cx="6" cy="12" r="2" />
        <circle cx="18" cy="19" r="2" />
        <path d="m8 11 8-5M8 13l8 5" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name] || null}
    </svg>
  );
}

function ViewerStatus({ error, onClose }) {
  return (
    <main className="immersive-reels-viewer immersive-reels-viewer--status">
      <button
        type="button"
        className="immersive-reels-close"
        aria-label="Close reel viewer"
        onClick={onClose}
      >
        <ViewerIcon name="close" />
      </button>
      <section className="immersive-reels-status" aria-live="polite">
        <img className="immersive-reels-status-mark" src="/tengacion_logo_64.png" alt="" />
        <h1>{error ? "This reel is unavailable" : "Loading reel"}</h1>
        <p>{error || "Preparing the video and creator details."}</p>
      </section>
    </main>
  );
}

export default function ImmersiveReelsViewer({
  reels = [],
  activeReelId = "",
  loading = false,
  error = "",
  soundOn = false,
  onClose,
  onSelectReel,
  onToggleSound,
  onLike,
  onComment,
  onShare,
  onProfile,
}) {
  const videoRef = useRef(null);
  const [failedVideoUrl, setFailedVideoUrl] = useState("");
  const [blockedVideoUrl, setBlockedVideoUrl] = useState("");
  const activeIndex = useMemo(
    () => reels.findIndex((entry) => String(entry?._id || "") === String(activeReelId || "")),
    [activeReelId, reels]
  );
  const reel = activeIndex >= 0 ? reels[activeIndex] : null;
  const reelId = String(reel?._id || "");
  const videoUrl = reel ? getReelVideoUrl(reel) : "";
  const canGoPrevious = activeIndex > 0;
  const canGoNext = activeIndex >= 0 && activeIndex < reels.length - 1;

  const goToOffset = useCallback(
    (offset) => {
      const next = reels[activeIndex + offset];
      if (next?._id) {
        setFailedVideoUrl("");
        onSelectReel?.(String(next._id));
      }
    },
    [activeIndex, onSelectReel, reels]
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }

      const target = event.target;
      const isInteractiveTarget =
        target instanceof Element &&
        Boolean(target.closest("video, button, a, input, textarea, select, [contenteditable='true']"));
      if (isInteractiveTarget) {
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (canGoPrevious) {
          goToOffset(-1);
        }
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        if (canGoNext) {
          goToOffset(1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canGoNext, canGoPrevious, goToOffset, onClose]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !reelId) {
      return;
    }
    video.muted = !soundOn;
    const playAttempt = video.play?.();
    playAttempt?.then?.(
      () => setBlockedVideoUrl(""),
      () => setBlockedVideoUrl(videoUrl)
    );
  }, [reelId, soundOn, videoUrl]);

  if (loading || error || !reel) {
    return <ViewerStatus error={error} onClose={onClose} />;
  }

  const posterUrl = getReelPoster(reel);
  const authorName = getReelDisplayName(reel);
  const username = getReelUsername(reel);
  const avatarFallback = getReelAvatarFallback(reel);
  const caption = String(reel?.text || "").trim();
  const videoFailed = Boolean(videoUrl) && failedVideoUrl === videoUrl;
  const playbackBlocked = Boolean(videoUrl) && blockedVideoUrl === videoUrl;

  return (
    <main className="immersive-reels-viewer" aria-label="Immersive reel viewer">
      <div className="immersive-reels-topbar">
        <button
          type="button"
          className="immersive-reels-close"
          aria-label="Close reel viewer"
          onClick={onClose}
        >
          <ViewerIcon name="close" />
        </button>
        <div className="immersive-reels-brand" aria-label="Tengacion Reels">
          <img src="/tengacion_logo_64.png" alt="" />
          <strong>Tengacion Reels</strong>
        </div>
      </div>

      <button
        type="button"
        className="immersive-reels-sound"
        aria-label={soundOn ? "Turn reel sound off" : "Turn reel sound on"}
        aria-pressed={soundOn}
        onClick={onToggleSound}
      >
        <ViewerIcon name={soundOn ? "volume" : "mute"} />
        <span>{soundOn ? "Sound on" : "Sound off"}</span>
      </button>

      <section className="immersive-reels-stage" aria-label={`Watching ${caption || "reel"} by ${authorName}`}>
        <div className="immersive-reels-video-wrap">
          {!videoFailed ? (
            <video
              key={reelId}
              ref={videoRef}
              className="immersive-reels-video"
              src={videoUrl}
              poster={posterUrl}
              playsInline
              controls
              autoPlay
              muted={!soundOn}
              preload="metadata"
              aria-label={`${caption || "Reel"} by ${authorName}`}
              onPlay={() => setBlockedVideoUrl("")}
              onEnded={() => canGoNext && goToOffset(1)}
              onError={() => setFailedVideoUrl(videoUrl)}
            />
          ) : null}

          {videoFailed ? (
            <div className="immersive-reels-video-error" role="status">
              <strong>Video unavailable</strong>
              <span>Try the next reel or return to your feed.</span>
            </div>
          ) : null}

          {!videoFailed && playbackBlocked ? (
            <button
              type="button"
              className="immersive-reels-playback-retry"
              onClick={() => {
                const playAttempt = videoRef.current?.play?.();
                playAttempt?.then?.(
                  () => setBlockedVideoUrl(""),
                  () => setBlockedVideoUrl(videoUrl)
                );
              }}
            >
              <ViewerIcon name="play" />
              <span>Play reel</span>
            </button>
          ) : null}

          <div className="immersive-reels-video-shade" aria-hidden="true" />
          <div className="immersive-reels-meta">
            <button
              type="button"
              className="immersive-reels-author"
              onClick={() => username && onProfile?.(username)}
              disabled={!username}
            >
              <img
                src={getReelAvatar(reel)}
                alt=""
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = avatarFallback;
                }}
              />
              <span>
                <strong>{authorName}</strong>
                <small>{username ? `@${username}` : "Tengacion creator"} · {getRelativeTime(reel?.createdAt)}</small>
              </span>
            </button>
            {caption ? <p>{caption}</p> : null}
          </div>
        </div>

        <nav className="immersive-reels-actions" aria-label="Reel actions">
          <button
            type="button"
            className={reel?.likedByViewer ? "is-active" : ""}
            aria-label={reel?.likedByViewer ? "Unlike reel" : "Like reel"}
            aria-pressed={Boolean(reel?.likedByViewer)}
            onClick={() => onLike?.(reelId)}
          >
            <span><ViewerIcon name="heart" /></span>
            <strong>{formatCount(getLikesCount(reel))}</strong>
          </button>
          <button type="button" aria-label="View reel comments" onClick={() => onComment?.(reelId)}>
            <span><ViewerIcon name="comment" /></span>
            <strong>{formatCount(getCommentsCount(reel))}</strong>
          </button>
          <button type="button" aria-label="Share reel" onClick={() => onShare?.(reelId)}>
            <span><ViewerIcon name="share" /></span>
            <strong>Share</strong>
          </button>
          <button
            type="button"
            aria-label={`View ${authorName}'s profile`}
            onClick={() => username && onProfile?.(username)}
            disabled={!username}
          >
            <span><ViewerIcon name="user" /></span>
            <strong>Profile</strong>
          </button>
        </nav>
      </section>

      <nav className="immersive-reels-navigation" aria-label="Change reel">
        <button
          type="button"
          aria-label="Previous reel"
          disabled={!canGoPrevious}
          onClick={() => goToOffset(-1)}
        >
          <ViewerIcon name="up" />
        </button>
        <button
          type="button"
          aria-label="Next reel"
          disabled={!canGoNext}
          onClick={() => goToOffset(1)}
        >
          <ViewerIcon name="down" />
        </button>
      </nav>

      <div
        className="immersive-reels-progress"
        role="progressbar"
        aria-label="Reel queue progress"
        aria-valuemin="1"
        aria-valuemax={reels.length}
        aria-valuenow={activeIndex + 1}
      >
        <span style={{ width: `${((activeIndex + 1) / Math.max(1, reels.length)) * 100}%` }} />
      </div>
    </main>
  );
}
