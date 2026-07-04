import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { markStorySeen, reactToStory, replyToStory, resolveImage } from "../api";
import Button from "../components/ui/Button";
import { getStoryMedia } from "./storyMedia";

const IMAGE_DURATION_MS = 5000;
const getSoundtrackPreviewSeconds = (soundtrack = null) =>
  Math.max(1, Math.min(30, Number(soundtrack?.previewLimitSec || 30)));

const QUICK_REACTIONS = [
  "\u2764\uFE0F",
  "\u{1F525}",
  "\u{1F602}",
  "\u{1F62E}",
  "\u{1F389}",
];

const REACTION_BURST_PARTICLES = [
  { tx: "-44px", ty: "-58px", rot: "-34deg", color: "#ff4d6d", delay: "0ms" },
  { tx: "-18px", ty: "-72px", rot: "28deg", color: "#ffd166", delay: "35ms" },
  { tx: "28px", ty: "-66px", rot: "58deg", color: "#06d6a0", delay: "15ms" },
  { tx: "52px", ty: "-36px", rot: "112deg", color: "#4cc9f0", delay: "45ms" },
  { tx: "-52px", ty: "-18px", rot: "-88deg", color: "#f72585", delay: "55ms" },
  { tx: "38px", ty: "-10px", rot: "148deg", color: "#b8f35c", delay: "25ms" },
  { tx: "-8px", ty: "-92px", rot: "-128deg", color: "#ffffff", delay: "70ms" },
  { tx: "4px", ty: "-42px", rot: "76deg", color: "#ff9f1c", delay: "5ms" },
];

const isTextEntryTarget = (target) => {
  if (!target || typeof target.closest !== "function") {
    return false;
  }
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
};

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
  const viewerRef = useRef(null);
  const videoRef = useRef(null);
  const soundtrackRef = useRef(null);
  const replyInputRef = useRef(null);
  const holdAdvanceRef = useRef(false);
  const pendingVideoAdvanceRef = useRef(false);
  const burstIdRef = useRef(0);
  const burstTimeoutsRef = useRef(new Set());
  const [replyText, setReplyText] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyFocused, setReplyFocused] = useState(false);
  const [reactionBusy, setReactionBusy] = useState("");
  const [reactionBursts, setReactionBursts] = useState([]);
  const [soundtrackPlaying, setSoundtrackPlaying] = useState(false);
  const [soundtrackProgress, setSoundtrackProgress] = useState(0);
  const [soundtrackError, setSoundtrackError] = useState("");

  const activeStory = orderedStories[index] || story;
  const activeStoryKey = activeStory
    ? String(activeStory?._id || activeStory?.id || activeStory?.time || index)
    : "";
  const { mediaType, mediaUrl } = getStoryMedia(activeStory);
  const soundtrack = activeStory?.musicAttachment || null;
  const storyDurationMs = soundtrack?.previewUrl
    ? getSoundtrackPreviewSeconds(soundtrack) * 1000
    : IMAGE_DURATION_MS;
  const holdStoryAdvance = replyFocused || Boolean(replyText.trim()) || replyBusy;
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

  const handleVideoEnded = useCallback(() => {
    if (holdAdvanceRef.current) {
      pendingVideoAdvanceRef.current = true;
      setProgress(1);
      return;
    }

    goToNext();
  }, [goToNext]);

  const spawnReactionBurst = useCallback((emoji, event) => {
    const viewerRect = viewerRef.current?.getBoundingClientRect();
    const buttonRect = event?.currentTarget?.getBoundingClientRect?.();
    if (!viewerRect || !buttonRect) {
      return;
    }

    burstIdRef.current += 1;
    const burstId = burstIdRef.current;
    const burst = {
      id: burstId,
      emoji,
      x: buttonRect.left + buttonRect.width / 2 - viewerRect.left,
      y: buttonRect.top + buttonRect.height / 2 - viewerRect.top,
    };

    setReactionBursts((current) => [...current, burst].slice(-5));

    const timeoutId = window.setTimeout(() => {
      setReactionBursts((current) => current.filter((entry) => entry.id !== burstId));
      burstTimeoutsRef.current.delete(timeoutId);
    }, 950);
    burstTimeoutsRef.current.add(timeoutId);
  }, []);

  useEffect(
    () => () => {
      burstTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      burstTimeoutsRef.current.clear();
    },
    []
  );

  useEffect(() => {
    holdAdvanceRef.current = holdStoryAdvance;
    if (!holdStoryAdvance && pendingVideoAdvanceRef.current) {
      pendingVideoAdvanceRef.current = false;
      goToNext();
    }
  }, [goToNext, holdStoryAdvance]);

  useEffect(() => {
    pendingVideoAdvanceRef.current = false;
  }, [activeStoryKey, mediaType]);

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

    if (!activeStoryKey) {
      return undefined;
    }

    if (mediaType === "video") {
      return undefined;
    }

    let elapsed = 0;
    let lastTick = Date.now();
    timerRef.current = window.setInterval(() => {
      const now = Date.now();
      const delta = now - lastTick;
      lastTick = now;

      if (holdAdvanceRef.current) {
        return;
      }

      elapsed += delta;
      const ratio = Math.min(1, elapsed / storyDurationMs);
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
  }, [activeStoryKey, goToNext, mediaType, storyDurationMs]);

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
      if (isTextEntryTarget(event.target)) {
        return;
      }

      if (holdAdvanceRef.current && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
        return;
      }

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
  }, [goToNext, goToPrev, onClose]);

  if (!activeStory) {
    return null;
  }

  const handleReact = async (emoji, event) => {
    if (!activeStory?._id || reactionBusy) {
      return;
    }
    spawnReactionBurst(emoji, event);
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
      setReplyFocused(false);
      replyInputRef.current?.blur();
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
        ref={viewerRef}
        className={`story-viewer${soundtrack?.previewUrl ? " story-viewer--with-soundtrack" : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="story-viewer-reaction-burst-layer" aria-hidden="true">
          {reactionBursts.map((burst) => (
            <span
              key={burst.id}
              className="story-viewer-reaction-burst"
              style={{
                "--burst-x": `${burst.x}px`,
                "--burst-y": `${burst.y}px`,
              }}
            >
              <span className="story-viewer-reaction-pop">{burst.emoji}</span>
              {REACTION_BURST_PARTICLES.map((particle, particleIndex) => (
                <span
                  key={`${burst.id}-${particleIndex}`}
                  className="story-viewer-reaction-particle"
                  style={{
                    "--particle-color": particle.color,
                    "--particle-delay": particle.delay,
                    "--rot": particle.rot,
                    "--tx": particle.tx,
                    "--ty": particle.ty,
                  }}
                />
              ))}
            </span>
          ))}
        </div>

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
                onEnded={handleVideoEnded}
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
                const previewLimit = getSoundtrackPreviewSeconds(soundtrack);
                const duration = Math.min(event.currentTarget.duration || previewLimit, previewLimit);
                const now = event.currentTarget.currentTime || 0;
                setSoundtrackProgress(duration > 0 ? Math.min(1, now / duration) : 0);
                if (now >= previewLimit) {
                  event.currentTarget.pause();
                  event.currentTarget.currentTime = 0;
                  setSoundtrackPlaying(false);
                  setSoundtrackProgress(1);
                }
              }}
            />
          </div>
        ) : null}

        {activeStory?.text && mediaUrl && (
          <p className="story-viewer-text-caption">{activeStory.text}</p>
        )}

        <div className="story-viewer-actions">
          <div className="story-viewer-quick-reactions">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={reactionBusy === emoji ? "is-reacting" : ""}
                onClick={(event) => handleReact(emoji, event)}
                disabled={Boolean(reactionBusy)}
                aria-label={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
          <div className="story-viewer-reply-row">
            <input
              ref={replyInputRef}
              value={replyText}
              onChange={(event) => setReplyText(event.target.value)}
              onBlur={() => setReplyFocused(false)}
              onFocus={() => setReplyFocused(true)}
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
