import { useEffect, useMemo, useRef, useState } from "react";
import { markStorySeen, resolveImage } from "../api";

const IMAGE_DURATION_MS = 5000;

const formatStoryTime = (value) => {
  const time = new Date(value || "");
  if (Number.isNaN(time.getTime())) {
    return "now";
  }

  const diffMs = Date.now() - time.getTime();
  const diffMin = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMin < 60) {
    return `${diffMin}m`;
  }

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return `${diffHours}h`;
  }

  return `${Math.floor(diffHours / 24)}d`;
};

export default function StoryViewer({ story, stories = [], onClose, onSeen }) {
  const orderedStories = useMemo(() => {
    const source =
      Array.isArray(stories) && stories.length > 0
        ? stories
        : story
          ? [story]
          : [];
    return [...source].sort(
      (a, b) => new Date(a?.time || 0).getTime() - new Date(b?.time || 0).getTime()
    );
  }, [stories, story]);

  const [index, setIndex] = useState(Math.max(0, (orderedStories?.length || 1) - 1));
  const [progress, setProgress] = useState(0);
  const seenRef = useRef(new Set());
  const timerRef = useRef(null);
  const videoRef = useRef(null);

  const activeStory = orderedStories[index] || story;
  const mediaType = activeStory?.mediaType || "image";
  const mediaUrl = resolveImage(activeStory?.mediaUrl || activeStory?.image);
  const avatarSrc = activeStory?.avatar
    ? resolveImage(activeStory.avatar)
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(
        activeStory?.username || "User"
      )}`;

  const goToNext = () => {
    setIndex((current) => {
      if (current >= orderedStories.length - 1) {
        onClose?.();
        return current;
      }
      return current + 1;
    });
  };

  const goToPrev = () => {
    setIndex((current) => Math.max(current - 1, 0));
  };

  useEffect(() => {
    if (!activeStory?._id) {
      return;
    }

    const storyId = String(activeStory._id);
    if (seenRef.current.has(storyId)) {
      return;
    }
    seenRef.current.add(storyId);
    markStorySeen(storyId).catch(() => null);
    onSeen?.([storyId]);
  }, [activeStory, onSeen]);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setProgress(0);

    if (!activeStory) {
      return undefined;
    }

    if (mediaType === "video") {
      return undefined;
    }

    const start = Date.now();
    timerRef.current = window.setInterval(() => {
      const ratio = Math.min(1, (Date.now() - start) / IMAGE_DURATION_MS);
      setProgress(ratio);
      if (ratio >= 1) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        goToNext();
      }
    }, 80);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [activeStory, mediaType]);

  useEffect(() => {
    if (mediaType !== "video") {
      return;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [mediaType, index]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      } else if (event.key === "ArrowRight") {
        goToNext();
      } else if (event.key === "ArrowLeft") {
        goToPrev();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (!activeStory) {
    return null;
  }

  return (
    <div className="story-viewer-overlay" onClick={onClose}>
      <div className="story-viewer" onClick={(event) => event.stopPropagation()}>
        <div className="story-viewer-progress-row">
          {orderedStories.map((entry, idx) => {
            const fill = idx < index ? 1 : idx > index ? 0 : progress;
            return (
              <span key={entry?._id || `${idx}`} className="story-viewer-progress-track">
                <i style={{ width: `${Math.round(fill * 100)}%` }} />
              </span>
            );
          })}
        </div>

        <div className="story-viewer-header">
          <div className="story-viewer-user">
            <img src={avatarSrc} alt={activeStory?.username || "User"} />
            <div>
              <strong>{activeStory?.username || "User"}</strong>
              <span>{formatStoryTime(activeStory?.time)}</span>
            </div>
          </div>
          <button className="story-viewer-close" onClick={onClose} aria-label="Close story">
            X
          </button>
        </div>

        <div className="story-viewer-media">
          {mediaUrl ? (
            mediaType === "video" ? (
              <video
                ref={videoRef}
                src={mediaUrl}
                controls
                playsInline
                onTimeUpdate={(event) => {
                  const duration = event.currentTarget.duration || 0;
                  const now = event.currentTarget.currentTime || 0;
                  setProgress(duration > 0 ? Math.min(1, now / duration) : 0);
                }}
                onEnded={goToNext}
              />
            ) : (
              <img src={mediaUrl} alt="Story" />
            )
          ) : (
            <div className="story-viewer-text-only">{activeStory?.text || "Story"}</div>
          )}
        </div>

        {activeStory?.text && mediaUrl && (
          <p className="story-viewer-text-caption">{activeStory.text}</p>
        )}

        {orderedStories.length > 1 && (
          <div className="story-viewer-controls">
            <button onClick={goToPrev} disabled={index === 0}>
              Previous
            </button>
            <span>
              {index + 1}/{orderedStories.length}
            </span>
            <button onClick={goToNext} disabled={index === orderedStories.length - 1}>
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
