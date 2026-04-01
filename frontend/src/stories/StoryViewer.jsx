import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { markStorySeen, reactToStory, replyToStory, resolveImage } from "../api";
import Button from "../components/ui/Button";

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
  const soundtrackRef = useRef(null);
  const [replyText, setReplyText] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [reactionBusy, setReactionBusy] = useState("");
  const [soundtrackPlaying, setSoundtrackPlaying] = useState(false);
  const [soundtrackProgress, setSoundtrackProgress] = useState(0);
  const [soundtrackError, setSoundtrackError] = useState("");

  const quickReactions = [
    "\u2764\uFE0F",
    "\u{1F525}",
    "\u{1F602}",
    "\u{1F62E}",
    "\u{1F389}",
  ];

  const activeStory = orderedStories[index] || story;
  const mediaType = activeStory?.mediaType || "image";
  const mediaUrl = resolveImage(activeStory?.mediaUrl || activeStory?.image);
  const soundtrack = activeStory?.musicAttachment || null;
  const avatarSrc = activeStory?.avatar
    ? resolveImage(activeStory.avatar)
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(
        activeStory?.username || "User"
      )}`;

  const goToNext = useCallback(() => {
    setIndex((current) => {
      if (current >= orderedStories.length - 1) {
        onClose?.();
        return current;
      }
      return current + 1;
    });
  }, [onClose, orderedStories.length]);

  const goToPrev = useCallback(() => {
    setIndex((current) => Math.max(current - 1, 0));
  }, []);

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
  }, [activeStory, goToNext, mediaType]);

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
    const audio = soundtrackRef.current;
    if (!audio) {
      return undefined;
    }

    audio.pause();
    setSoundtrackPlaying(false);
    setSoundtrackProgress(0);
    setSoundtrackError("");

    if (!soundtrack?.previewUrl) {
      audio.removeAttribute("src");
      audio.load();
      return undefined;
    }

    audio.src = soundtrack.previewUrl;
    audio.load();
    return () => {
      audio.pause();
    };
  }, [activeStory?._id, soundtrack?.itemId, soundtrack?.previewUrl]);

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

  const handleReact = async (emoji) => {
    if (!activeStory?._id || reactionBusy) {
      return;
    }
    try {
      setReactionBusy(emoji);
      await reactToStory(activeStory._id, emoji);
    } catch {
      // Best-effort interaction.
    } finally {
      setReactionBusy("");
    }
  };

  const handleReply = async () => {
    const text = replyText.trim();
    if (!activeStory?._id || !text || replyBusy) {
      return;
    }
    try {
      setReplyBusy(true);
      await replyToStory(activeStory._id, text);
      setReplyText("");
    } catch {
      // Keep existing UI stable on network errors.
    } finally {
      setReplyBusy(false);
    }
  };

  const handleSoundtrackToggle = async () => {
    const audio = soundtrackRef.current;
    if (!audio || !soundtrack?.previewUrl) {
      return;
    }

    if (soundtrackPlaying) {
      audio.pause();
      setSoundtrackPlaying(false);
      return;
    }

    try {
      setSoundtrackProgress(0);
      audio.currentTime = 0;
      await audio.play();
      setSoundtrackError("");
      setSoundtrackPlaying(true);
    } catch {
      setSoundtrackPlaying(false);
      setSoundtrackError("Preview blocked by your browser. Tap play again.");
    }
  };

  return (
    <div className="story-viewer-overlay" onClick={onClose}>
      <div
        className={`story-viewer${soundtrack?.previewUrl ? " story-viewer--with-soundtrack" : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
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
          <Button
            variant="icon"
            size="sm"
            iconOnly
            className="story-viewer-close"
            onClick={onClose}
            aria-label="Close story"
          >
            X
          </Button>
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

        {soundtrack?.previewUrl ? (
          <div className="story-viewer-soundtrack">
            <div className="story-viewer-soundtrack__head">
              <img
                src={resolveImage(soundtrack.coverImage) || soundtrack.coverImage || mediaUrl}
                alt={soundtrack.title || "Soundtrack"}
              />
              <div className="story-viewer-soundtrack__copy">
                <span>{soundtrack.summaryLabel || "Music"}</span>
                <strong>{soundtrack.title || "Creator soundtrack"}</strong>
                <small>
                  {soundtrack.creatorName || "Tengacion creator"} - {soundtrack.previewLimitSec || 30}
                  s preview
                </small>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSoundtrackToggle}
                className="story-viewer-soundtrack__control"
              >
                {soundtrackPlaying ? "Pause" : "Play"}
              </Button>
            </div>
            <div className="story-viewer-soundtrack__progress">
              <span style={{ "--music-progress": `${Math.round(soundtrackProgress * 100)}%` }} />
            </div>
            {soundtrackError ? <p className="story-viewer-soundtrack__error">{soundtrackError}</p> : null}
            <audio
              ref={soundtrackRef}
              hidden
              onEnded={() => {
                setSoundtrackPlaying(false);
                setSoundtrackProgress(1);
              }}
              onPause={() => setSoundtrackPlaying(false)}
              onPlay={() => setSoundtrackPlaying(true)}
              onTimeUpdate={(event) => {
                const duration = event.currentTarget.duration || 0;
                const now = event.currentTarget.currentTime || 0;
                setSoundtrackProgress(duration > 0 ? Math.min(1, now / duration) : 0);
              }}
            />
          </div>
        ) : null}

        {activeStory?.text && mediaUrl && (
          <p className="story-viewer-text-caption">{activeStory.text}</p>
        )}

        <div className="story-viewer-actions">
          <div className="story-viewer-quick-reactions">
            {quickReactions.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleReact(emoji)}
                disabled={Boolean(reactionBusy)}
              >
                {reactionBusy === emoji ? "..." : emoji}
              </button>
            ))}
          </div>
          <div className="story-viewer-reply-row">
            <input
              value={replyText}
              onChange={(event) => setReplyText(event.target.value)}
              placeholder="Reply to story..."
              maxLength={220}
            />
            <Button variant="secondary" size="sm" loading={replyBusy} onClick={handleReply} disabled={!replyText.trim()}>
              Reply
            </Button>
          </div>
        </div>

        {orderedStories.length > 1 && (
          <div className="story-viewer-controls">
            <Button variant="outline" size="sm" onClick={goToPrev} disabled={index === 0}>
              Previous
            </Button>
            <span>
              {index + 1}/{orderedStories.length}
            </span>
            <Button variant="outline" size="sm" onClick={goToNext} disabled={index === orderedStories.length - 1}>
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
