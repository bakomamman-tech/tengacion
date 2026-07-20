import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deleteStory, markStorySeen, reactToStory, replyToStory, resolveImage } from "../api";
import Button from "../components/ui/Button";
import ProfileNameLink from "../components/ui/ProfileNameLink";
import { getStoryMedia } from "./storyMedia";

const IMAGE_DURATION_MS = 5000;
const EMPTY_STORY_LIST = [];
const getSoundtrackPreviewSeconds = (soundtrack = null) =>
  Math.max(1, Math.min(30, Number(soundtrack?.previewLimitSec || 30)));
const getSoundtrackPreviewStartSeconds = (soundtrack = null) =>
  Math.max(0, Number(soundtrack?.previewStartSec || 0));

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

function StoryViewerChevron({ direction }) {
  const isPrevious = direction === "previous";
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={isPrevious ? "m15 5-7 7 7 7" : "m9 5 7 7-7 7"} />
    </svg>
  );
}

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

const orderStoriesChronologically = (stories = []) =>
  [...stories].sort(
    (a, b) => new Date(a?.time || 0).getTime() - new Date(b?.time || 0).getTime()
  );

export default function StoryViewer({
  story,
  stories = EMPTY_STORY_LIST,
  storyGroups = EMPTY_STORY_LIST,
  initialGroupIndex = 0,
  onClose,
  onDeleted,
  onSeen,
  viewerId = "",
}) {
  const navigationGroups = useMemo(() => {
    const groups = (Array.isArray(storyGroups) ? storyGroups : [])
      .map((group) => {
        const groupStories = Array.isArray(group?.stories) ? group.stories : [];
        const source = groupStories.length > 0
          ? groupStories
          : group?.latestStory
            ? [group.latestStory]
            : [];
        return orderStoriesChronologically(source);
      })
      .filter((group) => group.length > 0);

    if (groups.length > 0) {
      return groups;
    }

    const source = Array.isArray(stories) && stories.length > 0
      ? stories
      : story
        ? [story]
        : [];
    return [orderStoriesChronologically(source)].filter((group) => group.length > 0);
  }, [stories, story, storyGroups]);

  const safeInitialGroupIndex = Math.min(
    Math.max(0, Number(initialGroupIndex) || 0),
    Math.max(0, navigationGroups.length - 1)
  );
  const [groupIndex, setGroupIndex] = useState(safeInitialGroupIndex);
  const orderedStories = navigationGroups[groupIndex] || [];

  const [index, setIndex] = useState(Math.max(0, (orderedStories?.length || 1) - 1));
  const [progress, setProgress] = useState(0);
  const seenRef = useRef(new Set());
  const timerRef = useRef(null);
  const viewerRef = useRef(null);
  const videoRef = useRef(null);
  const soundtrackRef = useRef(null);
  const replyInputRef = useRef(null);
  const ownerMenuRef = useRef(null);
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
  const [ownerMenuOpen, setOwnerMenuOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const activeStory = orderedStories[index] || story;
  const activeStoryKey = activeStory
    ? String(activeStory?._id || activeStory?.id || activeStory?.time || index)
    : "";
  const { mediaType, mediaUrl } = getStoryMedia(activeStory);
  const soundtrack = activeStory?.musicAttachment || null;
  const soundtrackTitle = String(soundtrack?.title || "Creator soundtrack").trim()
    || "Creator soundtrack";
  const soundtrackCreator = String(soundtrack?.creatorName || "Tengacion creator").trim()
    || "Tengacion creator";
  const soundtrackSummary = String(soundtrack?.summaryLabel || "Music").trim() || "Music";
  const soundtrackStartSec = getSoundtrackPreviewStartSeconds(soundtrack);
  const activeStoryOwnerId = String(activeStory?.authorId || activeStory?.userId || "");
  const activeStoryIsOwner = Boolean(
    activeStory?.isOwner || (viewerId && activeStoryOwnerId === String(viewerId))
  );
  const storyDurationMs = soundtrack?.previewUrl
    ? getSoundtrackPreviewSeconds(soundtrack) * 1000
    : IMAGE_DURATION_MS;
  const holdStoryAdvance =
    replyFocused || Boolean(replyText.trim()) || replyBusy || ownerMenuOpen || deleteBusy;
  const avatarSrc = activeStory?.avatar
    ? resolveImage(activeStory.avatar)
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(
        activeStory?.username || "User"
      )}`;

  const hasPreviousStory = index > 0 || groupIndex > 0;
  const hasNextStory =
    index < orderedStories.length - 1 || groupIndex < navigationGroups.length - 1;
  const hasMultipleStories = navigationGroups.length > 1 || orderedStories.length > 1;

  const goToNext = useCallback(() => {
    if (index < orderedStories.length - 1) {
      setIndex(index + 1);
      return;
    }

    if (groupIndex < navigationGroups.length - 1) {
      const nextGroupIndex = groupIndex + 1;
      const nextStories = navigationGroups[nextGroupIndex] || [];
      setGroupIndex(nextGroupIndex);
      setIndex(Math.max(0, nextStories.length - 1));
      return;
    }

    onClose?.();
  }, [groupIndex, index, navigationGroups, onClose, orderedStories.length]);

  const goToPrev = useCallback(() => {
    if (index > 0) {
      setIndex(index - 1);
      return;
    }

    if (groupIndex > 0) {
      const previousGroupIndex = groupIndex - 1;
      const previousStories = navigationGroups[previousGroupIndex] || [];
      setGroupIndex(previousGroupIndex);
      setIndex(Math.max(0, previousStories.length - 1));
    }
  }, [groupIndex, index, navigationGroups]);

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
    setOwnerMenuOpen(false);
    setDeleteError("");
  }, [activeStoryKey, mediaType]);

  useEffect(() => {
    if (!ownerMenuOpen) {
      return undefined;
    }

    const closeOwnerMenu = (event) => {
      if (!ownerMenuRef.current?.contains(event.target)) {
        setOwnerMenuOpen(false);
        setDeleteError("");
      }
    };

    document.addEventListener("pointerdown", closeOwnerMenu);
    return () => document.removeEventListener("pointerdown", closeOwnerMenu);
  }, [ownerMenuOpen]);

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
    let cancelled = false;

    const startSoundtrack = async () => {
      try {
        audio.currentTime = soundtrackStartSec;
        await audio.play();
        if (!cancelled) {
          setSoundtrackPlaying(true);
          setSoundtrackError("");
        }
      } catch {
        if (!cancelled) {
          setSoundtrackPlaying(false);
          setSoundtrackError("Autoplay was blocked. Tap Play to hear this soundtrack.");
        }
      }
    };

    void startSoundtrack();
    return () => {
      cancelled = true;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
  }, [activeStory?._id, soundtrack?.itemId, soundtrack?.previewUrl, soundtrackStartSec]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (isTextEntryTarget(event.target)) {
        return;
      }

      if (holdAdvanceRef.current && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
        return;
      }

      if (event.key === "Escape") {
        if (ownerMenuOpen) {
          setOwnerMenuOpen(false);
          setDeleteError("");
        } else {
          onClose?.();
        }
      } else if (event.key === "ArrowRight") {
        goToNext();
      } else if (event.key === "ArrowLeft") {
        goToPrev();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goToNext, goToPrev, onClose, ownerMenuOpen]);

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

  const handleDeleteStory = async () => {
    const storyId = String(activeStory?._id || activeStory?.id || "");
    if (!activeStoryIsOwner || !storyId || deleteBusy) {
      return;
    }

    const confirmed = window.confirm?.(
      "Delete this story? It will stop displaying to everyone."
    );
    if (confirmed === false) {
      return;
    }

    try {
      setDeleteBusy(true);
      setDeleteError("");
      await deleteStory(storyId);
      onDeleted?.(storyId);
      onClose?.();
    } catch (error) {
      setDeleteError(error?.message || "Could not delete this story. Please try again.");
    } finally {
      setDeleteBusy(false);
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
      audio.currentTime = soundtrackStartSec;
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
      <button
        type="button"
        className="story-viewer-toggle story-viewer-toggle--previous"
        aria-label="Previous story"
        title="Previous story"
        disabled={!hasPreviousStory}
        onClick={(event) => {
          event.stopPropagation();
          goToPrev();
        }}
      >
        <StoryViewerChevron direction="previous" />
      </button>

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
              <ProfileNameLink
                username={activeStory?.username}
                className="story-viewer-profile-link"
                ariaLabel={`Open ${activeStory?.username || "this user"}'s profile`}
              >
                <strong>{activeStory?.username || "User"}</strong>
              </ProfileNameLink>
              <span>{formatStoryTime(activeStory?.time)}</span>
            </div>
          </div>
          {activeStoryIsOwner ? (
            <div className="story-viewer-owner-menu" ref={ownerMenuRef}>
              <button
                type="button"
                className="story-viewer-more"
                aria-label="Story options"
                title="Story options"
                aria-haspopup="menu"
                aria-expanded={ownerMenuOpen}
                onClick={() => {
                  setOwnerMenuOpen((current) => !current);
                  setDeleteError("");
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="5" cy="12" r="1.8" />
                  <circle cx="12" cy="12" r="1.8" />
                  <circle cx="19" cy="12" r="1.8" />
                </svg>
              </button>
              {ownerMenuOpen ? (
                <div className="story-viewer-owner-popover" role="menu" aria-label="Story options">
                  <button
                    type="button"
                    className="story-viewer-delete"
                    role="menuitem"
                    disabled={deleteBusy}
                    onClick={handleDeleteStory}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" />
                    </svg>
                    <span>{deleteBusy ? "Deleting..." : "Delete story"}</span>
                  </button>
                  {deleteError ? <p role="alert">{deleteError}</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}
          <Button
            variant="icon"
            size="sm"
            iconOnly
            className="story-viewer-close"
            onClick={onClose}
            aria-label="Close story"
            title="Close story"
          >
            <svg className="story-viewer-close__icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </Button>
        </div>

        <div className="story-viewer-body">
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
            <div
              className="story-viewer-soundtrack"
              role="group"
              aria-label={`Music: ${soundtrackTitle} by ${soundtrackCreator}`}
            >
              <div className="story-viewer-soundtrack__head">
                <img
                  src={resolveImage(soundtrack.coverImage) || soundtrack.coverImage || mediaUrl}
                  alt={`${soundtrackTitle} cover`}
                />
                <div className="story-viewer-soundtrack__copy">
                  <span className="story-viewer-soundtrack__label">{soundtrackSummary}</span>
                  <strong title={soundtrackTitle}>{soundtrackTitle}</strong>
                  <small title={`${soundtrackCreator} - ${soundtrack.previewLimitSec || 30}s preview`}>
                    {soundtrackCreator} - {soundtrack.previewLimitSec || 30}s preview
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
              {soundtrackError ? (
                <p className="story-viewer-soundtrack__error">{soundtrackError}</p>
              ) : null}
              <audio
                ref={soundtrackRef}
                hidden
                preload="auto"
                onEnded={(event) => {
                  event.currentTarget.currentTime = soundtrackStartSec;
                  void event.currentTarget.play();
                }}
                onPause={() => setSoundtrackPlaying(false)}
                onPlay={() => setSoundtrackPlaying(true)}
                onTimeUpdate={(event) => {
                  const previewLimit = getSoundtrackPreviewSeconds(soundtrack);
                  const now = event.currentTarget.currentTime || 0;
                  const elapsed = Math.max(0, now - soundtrackStartSec);
                  setSoundtrackProgress(Math.min(1, elapsed / previewLimit));
                  if (now >= soundtrackStartSec + previewLimit) {
                    event.currentTarget.pause();
                    event.currentTarget.currentTime = soundtrackStartSec;
                    setSoundtrackProgress(0);
                    void event.currentTarget.play();
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
              <Button
                variant="secondary"
                size="sm"
                loading={replyBusy}
                onClick={handleReply}
                disabled={!replyText.trim()}
              >
                Reply
              </Button>
            </div>
          </div>

          {hasMultipleStories && (
            <div className="story-viewer-controls">
              <Button variant="outline" size="sm" onClick={goToPrev} disabled={!hasPreviousStory}>
                Previous
              </Button>
              <span>
                {index + 1}/{orderedStories.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNext}
                disabled={!hasNextStory}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        className="story-viewer-toggle story-viewer-toggle--next"
        aria-label="Next story"
        title="Next story"
        disabled={!hasNextStory}
        onClick={(event) => {
          event.stopPropagation();
          goToNext();
        }}
      >
        <StoryViewerChevron direction="next" />
      </button>
    </div>
  );
}
