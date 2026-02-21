import { useEffect, useMemo, useRef, useState } from "react";
import { markStorySeen, resolveImage } from "../api";

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

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
};

export default function StoryViewer({ story, stories = [], onClose, onSeen }) {
  const orderedStories = useMemo(() => {
    const source = Array.isArray(stories) && stories.length > 0
      ? stories
      : story
        ? [story]
        : [];
    return [...source].sort(
      (a, b) => new Date(a?.time || 0).getTime() - new Date(b?.time || 0).getTime()
    );
  }, [stories, story]);

  const [index, setIndex] = useState(
    Math.max(0, (orderedStories?.length || 1) - 1)
  );
  const seenRef = useRef(new Set());

  const activeStory = orderedStories[index] || story;
  const avatarSrc = activeStory?.avatar
    ? resolveImage(activeStory.avatar)
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(
        activeStory?.username || "User"
      )}`;

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
    if (typeof onSeen === "function") {
      onSeen([storyId]);
    }
  }, [activeStory, onSeen]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      } else if (event.key === "ArrowRight") {
        setIndex((current) => Math.min(current + 1, orderedStories.length - 1));
      } else if (event.key === "ArrowLeft") {
        setIndex((current) => Math.max(current - 1, 0));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, orderedStories.length]);

  if (!activeStory) {
    return null;
  }

  return (
    <div className="story-viewer-overlay" onClick={onClose}>
      <div className="story-viewer" onClick={(event) => event.stopPropagation()}>
        <div className="story-viewer-header">
          <div className="story-viewer-user">
            <img src={avatarSrc} alt={activeStory?.username || "User"} />
            <div>
              <strong>{activeStory?.username || "User"}</strong>
              <span>{formatStoryTime(activeStory?.time)}</span>
            </div>
          </div>
          <button className="story-viewer-close" onClick={onClose} aria-label="Close story">
            x
          </button>
        </div>

        <div className="story-viewer-media">
          {activeStory?.image ? (
            <img src={resolveImage(activeStory.image)} alt="Story" />
          ) : (
            <div className="story-viewer-text-only">{activeStory?.text || "Story"}</div>
          )}
        </div>

        {activeStory?.text && activeStory?.image && (
          <p className="story-viewer-text-caption">{activeStory.text}</p>
        )}

        {orderedStories.length > 1 && (
          <div className="story-viewer-controls">
            <button
              onClick={() => setIndex((current) => Math.max(current - 1, 0))}
              disabled={index === 0}
            >
              Previous
            </button>
            <span>
              {index + 1}/{orderedStories.length}
            </span>
            <button
              onClick={() =>
                setIndex((current) => Math.min(current + 1, orderedStories.length - 1))
              }
              disabled={index === orderedStories.length - 1}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
