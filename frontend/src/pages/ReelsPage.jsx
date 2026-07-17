import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

import Navbar from "../Navbar";
import ExpandablePostText from "../components/posts/ExpandablePostText";
import {
  createPostWithUploadProgress,
  getFeed,
  likePost,
  resolveImage,
} from "../api";
import { UPLOAD_LIMITS } from "../config/uploadLimits";

const MAX_REEL_BYTES = UPLOAD_LIMITS.FEED_VIDEO_BYTES;
const VIDEO_EXT_RE = /\.(mp4|webm|ogg|mov|m4v)(?:\?.*)?$/i;
const compactFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function ReelIcon({ name, size = 20, strokeWidth = 1.9 }) {
  const paths = {
    arrowLeft: <><path d="m15 18-6-6 6-6" /><path d="M9 12h10" /></>,
    chevronLeft: <path d="m15 18-6-6 6-6" />,
    chevronRight: <path d="m9 18 6-6-6-6" />,
    close: <><path d="m18 6-12 12" /><path d="m6 6 12 12" /></>,
    film: <><rect width="18" height="18" x="3" y="3" rx="3" /><path d="M7 3v18M17 3v18M3 8h4M17 8h4M3 16h4M17 16h4" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1.1-1a5.5 5.5 0 0 0-7.7 7.8l1 1L12 21l7.8-7.6a5.5 5.5 0 0 0 1-8.8Z" />,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v11h14V10M9 21v-6h6v6" /></>,
    message: <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    refresh: <><path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" /></>,
    share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" /></>,
    sparkles: <><path d="m12 3-1.4 3.6L7 8l3.6 1.4L12 13l1.4-3.6L17 8l-3.6-1.4Z" /><path d="m5 14-.8 2.2L2 17l2.2.8L5 20l.8-2.2L8 17l-2.2-.8ZM19 14l-.8 2.2L16 17l2.2.8L19 20l.8-2.2L22 17l-2.2-.8Z" /></>,
    upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M20 15v5H4v-5" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    volume: <><path d="M11 5 6 9H2v6h4l5 4Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" /></>,
    volumeOff: <><path d="M11 5 6 9H2v6h4l5 4Z" /><path d="m22 9-6 6M16 9l6 6" /></>,
  };

  return (
    <svg
      aria-hidden="true"
      className="reels-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

const formatCompactNumber = (value) =>
  compactFormatter.format(Math.max(0, Number(value) || 0));

const formatRelativeTime = (value) => {
  if (!value) {
    return "Just now";
  }

  const diffMs = Date.now() - new Date(value).getTime();
  const seconds = Math.max(1, Math.floor(diffMs / 1000));
  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  const weeks = Math.floor(days / 7);
  if (weeks < 5) {
    return `${weeks}w ago`;
  }

  return new Date(value).toLocaleDateString();
};

const getFirstMedia = (post) =>
  Array.isArray(post?.media) ? post.media[0] || null : post?.media || null;

const getMediaUrl = (value) => {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  return String(value.secureUrl || value.secure_url || value.url || "").trim();
};

const getReelVideoUrl = (post) => {
  const firstMedia = getFirstMedia(post);
  const firstMediaUrl = getMediaUrl(firstMedia);

  return resolveImage(
    post?.video?.playbackUrl || post?.video?.url || firstMediaUrl || post?.image || post?.photo || ""
  );
};

const getReelPoster = (post) => {
  const firstMedia = getFirstMedia(post);
  const firstMediaUrl = getMediaUrl(firstMedia);

  return resolveImage(post?.video?.thumbnailUrl || post?.image || post?.photo || firstMediaUrl || "");
};

const isReelCandidate = (post) => {
  const firstMedia = getFirstMedia(post);
  const firstMediaType =
    firstMedia && typeof firstMedia === "object"
      ? String(firstMedia.type || "").toLowerCase()
      : "";
  const videoUrl = getReelVideoUrl(post);

  return Boolean(
    videoUrl &&
      (
        String(post?.type || "").toLowerCase() === "reel" ||
        String(post?.type || "").toLowerCase() === "video" ||
        firstMediaType === "video" ||
        VIDEO_EXT_RE.test(videoUrl)
      )
  );
};

const sortReels = (feed) =>
  [...feed].sort((left, right) => {
    const leftIsNativeReel = String(left?.type || "").toLowerCase() === "reel";
    const rightIsNativeReel = String(right?.type || "").toLowerCase() === "reel";
    if (leftIsNativeReel !== rightIsNativeReel) {
      return Number(rightIsNativeReel) - Number(leftIsNativeReel);
    }
    return new Date(right?.createdAt || 0).getTime() - new Date(left?.createdAt || 0).getTime();
  });

const getDisplayName = (post) =>
  post?.user?.name || post?.name || post?.user?.username || post?.username || "Unknown creator";

const getUsername = (post) => post?.user?.username || post?.username || "";

const getAvatar = (post) =>
  resolveImage(post?.user?.profilePic || post?.avatar || post?.user?.avatar) || "/avatar.png";

const getCommentsCount = (post) =>
  Number(post?.commentsCount) || (Array.isArray(post?.comments) ? post.comments.length : 0);

const getLikesCount = (post) => Number(post?.likesCount ?? post?.likes ?? 0) || 0;

function ReelComposerModal({ user, onClose, onCreated }) {
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => inputRef.current?.click(), 90);
    return () => {
      document.body.style.overflow = "";
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const onMouseDown = (event) => {
      if (boxRef.current && !boxRef.current.contains(event.target)) {
        onClose();
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return undefined;
    }

    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  const validateFile = (nextFile) => {
    if (!nextFile) {
      return false;
    }
    if (!["video/mp4", "video/webm", "video/quicktime"].includes(String(nextFile.type || "").toLowerCase())) {
      setError("Only MP4, MOV, and WebM videos are supported for reels.");
      return false;
    }
    if (nextFile.size > MAX_REEL_BYTES) {
      setError("Reels must be 50MB or smaller.");
      return false;
    }
    setError("");
    setFile(nextFile);
    return true;
  };

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0] || null;
    event.target.value = "";
    validateFile(nextFile);
  };

  const submit = async () => {
    if (!file || submitting) {
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      const created = await createPostWithUploadProgress(
        {
          text: caption.trim(),
          file,
          type: "reel",
        },
        {
          onProgress: setProgress,
          retries: 2,
          timeoutMs: 10 * 60 * 1000,
        }
      );

      onCreated(created);
      toast.success("Reel published");
      onClose();
    } catch (err) {
      setError(err?.message || "Failed to publish reel");
    } finally {
      setSubmitting(false);
      setProgress(0);
    }
  };

  return (
    <div className="reels-composer-overlay">
      <div className="reels-composer" ref={boxRef} role="dialog" aria-modal="true">
        <div className="reels-composer-head">
          <div>
            <p className="reels-composer-kicker">Reels studio</p>
            <h2>Create Reel</h2>
          </div>
          <button type="button" className="reels-composer-close" onClick={onClose} aria-label="Close">
            <ReelIcon name="close" size={19} />
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          hidden
          onChange={handleFileChange}
        />

        <div className="reels-composer-body">
          <div className="reels-composer-user">
            <img src={resolveImage(user?.avatar) || "/avatar.png"} alt={user?.username || "You"} />
            <div>
              <strong>{user?.name || user?.username || "You"}</strong>
              <span>Share a short-form video with your audience.</span>
            </div>
          </div>

          <button type="button" className="reels-composer-picker" onClick={() => inputRef.current?.click()}>
            <ReelIcon name="upload" size={18} />
            {file ? "Choose another video" : "Choose reel video"}
          </button>

          {previewUrl ? (
            <div className="reels-composer-preview">
              <video src={previewUrl} controls playsInline muted />
            </div>
          ) : (
            <div className="reels-composer-empty">
              <span className="reels-composer-empty-icon"><ReelIcon name="film" size={28} /></span>
              <span>9:16 videos look best here.</span>
              <small>MP4, MOV, or WebM, up to 100MB.</small>
            </div>
          )}

          <textarea
            className="reels-composer-caption"
            placeholder={`Write a caption for your reel, ${user?.username || "creator"}...`}
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            maxLength={240}
          />

          {progress > 0 && submitting && (
            <div className="reels-composer-progress">
              <div style={{ width: `${Math.min(progress, 100)}%` }} />
              <span>Uploading reel ({progress}%)</span>
            </div>
          )}

          {error && <p className="reels-composer-error">{error}</p>}
        </div>

        <div className="reels-composer-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={submit} disabled={!file || submitting}>
            {!submitting && <ReelIcon name="upload" size={17} />}
            {submitting ? "Posting..." : "Post reel"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReelsPage({ user }) {
  const navigate = useNavigate();
  const streamRef = useRef(null);
  const cardRefs = useRef(new Map());
  const videoRefs = useRef(new Map());

  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [activeReelId, setActiveReelId] = useState("");

  const loadReels = useCallback(async () => {
    try {
      setLoading(true);
      const feed = await getFeed();
      const nextReels = sortReels((Array.isArray(feed) ? feed : []).filter(isReelCandidate));
      setReels(nextReels);
      setActiveReelId((current) =>
        current && nextReels.some((entry) => entry._id === current) ? current : nextReels[0]?._id || ""
      );
    } catch {
      toast.error("Failed to load reels");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReels();
  }, [loadReels]);

  useEffect(() => {
    const root = streamRef.current;
    if (!root || !reels.length) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const nextVisible = [...entries]
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

        if (nextVisible?.target?.dataset?.reelId) {
          setActiveReelId(nextVisible.target.dataset.reelId);
        }
      },
      {
        root,
        threshold: [0.35, 0.55, 0.8],
      }
    );

    reels.forEach((reel) => {
      const node = cardRefs.current.get(reel._id);
      if (node) {
        observer.observe(node);
      }
    });

    return () => observer.disconnect();
  }, [reels]);

  useEffect(() => {
    videoRefs.current.forEach((videoNode, reelId) => {
      if (!videoNode) {
        return;
      }

      videoNode.muted = !soundOn;
      if (reelId === activeReelId) {
        const playAttempt = videoNode.play();
        if (typeof playAttempt?.catch === "function") {
          playAttempt.catch(() => {});
        }
      } else {
        videoNode.pause();
      }
    });
  }, [activeReelId, soundOn, reels.length]);

  const activeIndex = useMemo(
    () => Math.max(0, reels.findIndex((entry) => entry._id === activeReelId)),
    [activeReelId, reels]
  );

  const activeReel = reels[activeIndex] || null;
  const totalReels = reels.length;

  const scrollToIndex = (index) => {
    if (!reels.length) {
      return;
    }
    const boundedIndex = Math.min(Math.max(index, 0), reels.length - 1);
    const targetReel = reels[boundedIndex];
    const node = cardRefs.current.get(targetReel?._id);
    if (!node) {
      return;
    }
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    setActiveReelId(targetReel._id);
  };

  const handleCreateFlow = (target = "post") => {
    if (target === "reel") {
      setComposerOpen(true);
      return;
    }
    if (target === "story") {
      navigate("/home", { state: { openStoryCreator: true } });
      return;
    }
    navigate("/home", { state: { openComposer: true, composerMode: "" } });
  };

  const handleLogout = () => {
    navigate("/");
  };

  const handleLike = async (reelId) => {
    const previous = reels.find((entry) => entry._id === reelId);
    if (!previous) {
      return;
    }

    const willLike = !previous.likedByViewer;
    setReels((current) =>
      current.map((entry) =>
        entry._id === reelId
          ? {
              ...entry,
              likedByViewer: willLike,
              likesCount: Math.max(0, getLikesCount(entry) + (willLike ? 1 : -1)),
              likes: Math.max(0, getLikesCount(entry) + (willLike ? 1 : -1)),
            }
          : entry
      )
    );

    try {
      const response = await likePost(reelId);
      const nextCount = Number(response?.likesCount);
      setReels((current) =>
        current.map((entry) =>
          entry._id === reelId
            ? {
                ...entry,
                likedByViewer: Boolean(response?.liked),
                likesCount: Number.isFinite(nextCount) ? nextCount : getLikesCount(entry),
                likes: Number.isFinite(nextCount) ? nextCount : getLikesCount(entry),
              }
            : entry
        )
      );
    } catch (err) {
      setReels((current) => current.map((entry) => (entry._id === reelId ? previous : entry)));
      toast.error(err?.message || "Failed to update like");
    }
  };

  const handleShare = async (reelId) => {
    const shareUrl = `${window.location.origin}/posts/${reelId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Reel link copied");
    } catch {
      window.prompt("Copy this reel link", shareUrl);
    }
  };

  const handleReelCreated = (created) => {
    if (!created || !isReelCandidate(created)) {
      loadReels();
      return;
    }

    setReels((current) => sortReels([created, ...current.filter((entry) => entry._id !== created._id)]));
    setActiveReelId(created._id);
  };

  return (
    <>
      <Navbar
        user={user}
        onLogout={handleLogout}
        onOpenCreatePost={handleCreateFlow}
        onOpenMessenger={(payload = {}) =>
          navigate("/home", {
            state: {
              openMessenger: true,
              messengerTargetId: payload?.contactId || "",
            },
          })
        }
      />

      <div className="reels-page-shell">
        <aside className="reels-left-rail">
          <div className="reels-rail-card reels-hero-card">
            <div className="reels-rail-brand">
              <span className="reels-rail-brand-icon"><ReelIcon name="film" size={20} /></span>
              <div>
                <strong>Reels</strong>
                <span>Made on Tengacion</span>
              </div>
            </div>
            <p className="reels-section-kicker">Watch. Share. Create.</p>
            <h1>Stories that move with you.</h1>
            <p>
              Discover quick moments from your community, then share one of your own.
            </p>

            <div className="reels-hero-actions">
              <button type="button" className="btn-primary reels-create-btn" onClick={() => setComposerOpen(true)}>
                <ReelIcon name="plus" size={19} />
                Create Reel
              </button>
              <button type="button" className="btn-secondary reels-back-btn" onClick={() => navigate("/home")}>
                <ReelIcon name="home" size={18} />
                Home
              </button>
            </div>

            <div className="reels-mini-stats">
              <div>
                <strong>{formatCompactNumber(totalReels)}</strong>
                <span>In your stream</span>
              </div>
              <div>
                <strong>{formatCompactNumber(reels.filter((entry) => entry?.type === "reel").length)}</strong>
                <span>Original reels</span>
              </div>
            </div>
          </div>

          <div className="reels-rail-card reels-tips-card">
            <div className="reels-card-title-row">
              <span className="reels-card-title-icon"><ReelIcon name="sparkles" size={17} /></span>
              <h3>Creator notes</h3>
            </div>
            <ul>
              <li><span>01</span>Vertical video owns the screen.</li>
              <li><span>02</span>Short captions keep the moment moving.</li>
              <li><span>03</span>Use the queue to jump between creators.</li>
            </ul>
          </div>
        </aside>

        <main className="reels-stage">
          <div className="reels-stage-head">
            <div>
              <p className="reels-section-kicker"><span className="reels-live-dot" /> Community stream</p>
              <h2>Discover</h2>
            </div>
            <button
              type="button"
              className={`reels-sound-toggle ${soundOn ? "active" : ""}`}
              onClick={() => setSoundOn((current) => !current)}
              aria-pressed={soundOn}
            >
              <ReelIcon name={soundOn ? "volume" : "volumeOff"} size={18} />
              {soundOn ? "Sound on" : "Sound off"}
            </button>
          </div>

          {loading ? (
            <section className="reels-status-card">
              <h3>Loading reels</h3>
              <p>Pulling the latest short-form videos from Tengacion.</p>
            </section>
          ) : reels.length === 0 ? (
            <section className="reels-status-card">
              <h3>No reels yet</h3>
              <p>Be the first creator to publish a reel and shape what this page becomes.</p>
              <button type="button" className="btn-primary reels-create-btn" onClick={() => setComposerOpen(true)}>
                Create Reel
              </button>
            </section>
          ) : (
            <div className="reels-stream" ref={streamRef}>
              {reels.map((reel, index) => {
                const reelId = reel?._id || `reel-${index}`;
                const videoUrl = getReelVideoUrl(reel);
                const posterUrl = getReelPoster(reel);
                const caption = String(reel?.text || "").trim();
                const isActive = reelId === activeReelId;
                const authorName = getDisplayName(reel);
                const username = getUsername(reel);

                return (
                  <article
                    key={reelId}
                    className={`reels-slide ${isActive ? "active" : ""}`}
                    data-reel-id={reelId}
                    ref={(node) => {
                      if (node) {
                        cardRefs.current.set(reelId, node);
                      } else {
                        cardRefs.current.delete(reelId);
                      }
                    }}
                  >
                    <div className="reel-viewer-card">
                      {posterUrl ? <img className="reel-poster-ambient" src={posterUrl} alt="" aria-hidden="true" /> : null}
                      <video
                        ref={(node) => {
                          if (node) {
                            videoRefs.current.set(reelId, node);
                          } else {
                            videoRefs.current.delete(reelId);
                          }
                        }}
                        className="reel-video"
                        src={videoUrl}
                        poster={posterUrl}
                        playsInline
                        loop
                        muted={!soundOn}
                        controls={isActive}
                        preload="metadata"
                      />

                      <div className="reel-overlay reel-overlay-top">
                        <span className="reel-badge">
                          <ReelIcon name="film" size={14} />
                          {reel?.type === "reel" ? "Reel" : "Video reel"}
                        </span>
                        <span className="reel-time">{formatRelativeTime(reel?.createdAt)}</span>
                      </div>

                      <div className="reel-overlay reel-overlay-bottom">
                        <button
                          type="button"
                          className="reel-author"
                          onClick={() => username && navigate(`/profile/${username}`)}
                        >
                          <img src={getAvatar(reel)} alt={authorName} />
                          <div>
                            <strong>{authorName}</strong>
                            <span>{username ? `@${username}` : "Tengacion creator"}</span>
                          </div>
                        </button>

                        {caption ? (
                          <ExpandablePostText
                            text={caption}
                            wrapperClassName="reel-caption-block"
                            className="reel-caption"
                            toggleClassName="reel-caption-toggle"
                            collapsedLines={5}
                          />
                        ) : null}
                      </div>
                    </div>

                    <div className="reel-actions">
                      <button
                        type="button"
                        className={`reel-action-btn ${reel?.likedByViewer ? "active" : ""}`}
                        onClick={() => handleLike(reelId)}
                        aria-label={`${reel?.likedByViewer ? "Unlike" : "Like"} reel. ${formatCompactNumber(getLikesCount(reel))} likes`}
                      >
                        <span className="reel-action-icon"><ReelIcon name="heart" size={22} /></span>
                        <strong>{formatCompactNumber(getLikesCount(reel))}</strong>
                        <span className="reel-action-label">Like</span>
                      </button>
                      <button
                        type="button"
                        className="reel-action-btn"
                        onClick={() => navigate(`/posts/${reelId}`)}
                        aria-label={`Open comments. ${formatCompactNumber(getCommentsCount(reel))} comments`}
                      >
                        <span className="reel-action-icon"><ReelIcon name="message" size={21} /></span>
                        <strong>{formatCompactNumber(getCommentsCount(reel))}</strong>
                        <span className="reel-action-label">Comment</span>
                      </button>
                      <button
                        type="button"
                        className="reel-action-btn"
                        onClick={() => handleShare(reelId)}
                        aria-label="Copy reel link"
                      >
                        <span className="reel-action-icon"><ReelIcon name="share" size={21} /></span>
                        <strong>Share</strong>
                        <span className="reel-action-label">Link</span>
                      </button>
                      <button
                        type="button"
                        className="reel-action-btn"
                        onClick={() => username && navigate(`/profile/${username}`)}
                        aria-label={`Open ${authorName}'s profile`}
                      >
                        <span className="reel-action-icon"><ReelIcon name="user" size={21} /></span>
                        <strong>View</strong>
                        <span className="reel-action-label">Profile</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>

        <aside className="reels-right-rail">
          <div className="reels-rail-card reels-active-card">
            <div className="reels-now-playing-head">
              <p className="reels-section-kicker">Now playing</p>
              <span className="reels-equalizer" aria-hidden="true"><i /><i /><i /></span>
            </div>

            <div className="reels-active-creator">
              <img
                src={activeReel ? getAvatar(activeReel) : "/avatar.png"}
                alt={activeReel ? getDisplayName(activeReel) : "No active creator"}
              />
              <div>
                <h3>{activeReel ? getDisplayName(activeReel) : "No active reel"}</h3>
                <p>{activeReel && getUsername(activeReel) ? `@${getUsername(activeReel)}` : "Tengacion creator"}</p>
              </div>
            </div>

            <div className="reels-stream-progress">
              <div>
                <span>Up next</span>
                <strong>{activeReel ? `${activeIndex + 1} / ${totalReels}` : `0 / ${totalReels}`}</strong>
              </div>
              <span className="reels-progress-track">
                <i style={{ width: `${totalReels ? ((activeIndex + 1) / totalReels) * 100 : 0}%` }} />
              </span>
            </div>

            <div className="reels-nav-controls">
              <button type="button" className="btn-secondary" onClick={() => scrollToIndex(activeIndex - 1)}>
                <ReelIcon name="chevronLeft" size={18} />
                Previous
              </button>
              <button type="button" className="btn-secondary" onClick={() => scrollToIndex(activeIndex + 1)}>
                Next
                <ReelIcon name="chevronRight" size={18} />
              </button>
            </div>

            <button type="button" className="btn-secondary reels-refresh-btn" onClick={loadReels}>
              <ReelIcon name="refresh" size={17} />
              Refresh Reels
            </button>
          </div>

          <div className="reels-rail-card reels-queue-card">
            <div className="reels-queue-head">
              <h3>Stream queue</h3>
              <span>{totalReels} reels</span>
            </div>
            <div className="reels-queue-list">
              {reels.slice(0, 6).map((reel, index) => (
                <button
                  key={reel._id || index}
                  type="button"
                  className={`reels-queue-item ${reel._id === activeReelId ? "active" : ""}`}
                  onClick={() => scrollToIndex(index)}
                >
                  <span className="reels-queue-thumb">
                    <img src={getReelPoster(reel) || getAvatar(reel)} alt={getDisplayName(reel)} />
                    <i>{String(index + 1).padStart(2, "0")}</i>
                  </span>
                  <div>
                    <strong>{getDisplayName(reel)}</strong>
                    <span>{reel._id === activeReelId ? "Playing now" : formatRelativeTime(reel?.createdAt)}</span>
                  </div>
                  <ReelIcon name="chevronRight" size={17} />
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <button type="button" className="reels-mobile-create" onClick={() => setComposerOpen(true)}>
        <ReelIcon name="plus" size={20} />
        Create Reel
      </button>

      {composerOpen && (
        <ReelComposerModal
          user={user}
          onClose={() => setComposerOpen(false)}
          onCreated={handleReelCreated}
        />
      )}
    </>
  );
}
