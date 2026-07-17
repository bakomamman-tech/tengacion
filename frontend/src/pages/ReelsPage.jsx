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

function ReelsGlyph({ name, size = 18 }) {
  const glyphs = {
    reel: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="4" />
        <path d="m10 9 5 3-5 3Z" />
        <path d="M7 4v16M17 4v16" />
      </>
    ),
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v11h14V10M9 21v-6h6v6" /></>,
    volume: <><path d="M11 5 6 9H2v6h4l5 4Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" /></>,
    volumeOff: <><path d="M11 5 6 9H2v6h4l5 4Z" /><path d="m22 9-6 6M16 9l6 6" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1.1-1a5.5 5.5 0 0 0-7.7 7.8l1 1L12 21l7.8-7.6a5.5 5.5 0 0 0 1-8.8Z" />,
    message: <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />,
    share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    previous: <><path d="m15 18-6-6 6-6" /><path d="M9 12h10" /></>,
    next: <><path d="m9 18 6-6-6-6" /><path d="M5 12h10" /></>,
    refresh: <><path d="M20 11a8 8 0 0 0-15.5-2M4 4v5h5" /><path d="M4 13a8 8 0 0 0 15.5 2M20 20v-5h-5" /></>,
    upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M20 15v5H4v-5" /></>,
    spark: <><path d="m12 3-1.4 3.6L7 8l3.6 1.4L12 13l1.4-3.6L17 8l-3.6-1.4Z" /><path d="m5 14-.8 2.2L2 17l2.2.8L5 20l.8-2.2L8 17l-2.2-.8Z" /></>,
  };

  return (
    <svg
      aria-hidden="true"
      className="reels-glyph"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {glyphs[name]}
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
      <div
        className="reels-composer"
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reels-composer-title"
      >
        <div className="reels-composer-head">
          <div>
            <p className="reels-composer-kicker">Reels studio</p>
            <h2 id="reels-composer-title">Create Reel</h2>
          </div>
          <button type="button" className="reels-composer-close" onClick={onClose} aria-label="Close">
            X
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
            <ReelsGlyph name="upload" />
            {file ? "Choose another video" : "Choose reel video"}
          </button>

          {previewUrl ? (
            <div className="reels-composer-preview">
              <video src={previewUrl} controls playsInline muted />
            </div>
          ) : (
            <div className="reels-composer-empty">
              <span className="reels-composer-empty-glyph"><ReelsGlyph name="reel" size={28} /></span>
              <span>9:16 videos look best here.</span>
              <small>MP4, MOV, or WebM, up to 100MB.</small>
            </div>
          )}

          <textarea
            className="reels-composer-caption"
            placeholder={`Write a caption for your reel, ${user?.username || "creator"}...`}
            aria-label="Reel caption"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            maxLength={240}
          />

          {progress > 0 && submitting && (
            <div
              className="reels-composer-progress"
              role="progressbar"
              aria-label="Uploading reel"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={Math.min(progress, 100)}
            >
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
            {submitting ? "Posting..." : "Post"}
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
            <p className="reels-section-kicker"><ReelsGlyph name="reel" size={15} />Tengacion Reels</p>
            <h1>Short videos with a stronger stage.</h1>
            <p>
              Watch the latest creator drops, browse already published reels, and publish your
              own without leaving the experience.
            </p>

            <div className="reels-hero-actions">
              <button type="button" className="btn-primary reels-create-btn" onClick={() => setComposerOpen(true)}>
                <ReelsGlyph name="plus" />
                Create Reel
              </button>
              <button type="button" className="btn-secondary reels-back-btn" onClick={() => navigate("/home")}>
                <ReelsGlyph name="home" />
                Back Home
              </button>
            </div>

            <div className="reels-mini-stats">
              <div>
                <strong>{formatCompactNumber(totalReels)}</strong>
                <span>published reels</span>
              </div>
              <div>
                <strong>{formatCompactNumber(reels.filter((entry) => entry?.type === "reel").length)}</strong>
                <span>native reel uploads</span>
              </div>
            </div>
          </div>

          <div className="reels-rail-card reels-tips-card">
            <h3><span className="reels-title-glyph"><ReelsGlyph name="spark" size={17} /></span>What works best</h3>
            <ul>
              <li>Vertical video gets the best stage presence.</li>
              <li>Keep captions short so the video remains the focus.</li>
              <li>Use the right rail controls to jump through the stream.</li>
            </ul>
          </div>
        </aside>

        <main className="reels-stage">
          <div className="reels-stage-head">
            <div>
              <p className="reels-section-kicker">Already created reels</p>
              <h2>Discover what creators are posting now</h2>
            </div>
            <button
              type="button"
              className="reels-sound-toggle"
              onClick={() => setSoundOn((current) => !current)}
              aria-pressed={soundOn}
            >
              <ReelsGlyph name={soundOn ? "volume" : "volumeOff"} />
              {soundOn ? "Sound on" : "Sound off"}
            </button>
          </div>

          {loading ? (
            <section className="reels-status-card" role="status">
              <h3>Loading reels</h3>
              <p>Pulling the latest short-form videos from Tengacion.</p>
            </section>
          ) : reels.length === 0 ? (
            <section className="reels-status-card">
              <h3>No reels yet</h3>
              <p>Be the first creator to publish a reel and shape what this page becomes.</p>
              <button type="button" className="btn-primary reels-create-btn" onClick={() => setComposerOpen(true)}>
                <ReelsGlyph name="plus" />
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
                        aria-label={`${authorName}'s reel`}
                      />

                      <div className="reel-overlay reel-overlay-top">
                        <span className="reel-badge">{reel?.type === "reel" ? "Reel" : "Video reel"}</span>
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
                        aria-pressed={Boolean(reel?.likedByViewer)}
                        aria-label={`${reel?.likedByViewer ? "Unlike" : "Like"} reel. ${formatCompactNumber(getLikesCount(reel))} likes`}
                      >
                        <span className="reel-action-icon"><ReelsGlyph name="heart" size={20} /></span>
                        <span>Like</span>
                        <strong>{formatCompactNumber(getLikesCount(reel))}</strong>
                      </button>
                      <button
                        type="button"
                        className="reel-action-btn"
                        onClick={() => navigate(`/posts/${reelId}`)}
                        aria-label={`Open comments. ${formatCompactNumber(getCommentsCount(reel))} comments`}
                      >
                        <span className="reel-action-icon"><ReelsGlyph name="message" size={20} /></span>
                        <span>Comments</span>
                        <strong>{formatCompactNumber(getCommentsCount(reel))}</strong>
                      </button>
                      <button type="button" className="reel-action-btn" onClick={() => handleShare(reelId)} aria-label="Copy reel link">
                        <span className="reel-action-icon"><ReelsGlyph name="share" size={20} /></span>
                        <span>Share</span>
                        <strong>Link</strong>
                      </button>
                      <button
                        type="button"
                        className="reel-action-btn"
                        onClick={() => username && navigate(`/profile/${username}`)}
                        aria-label={`Open ${authorName}'s profile`}
                      >
                        <span className="reel-action-icon"><ReelsGlyph name="user" size={20} /></span>
                        <span>Profile</span>
                        <strong>Open</strong>
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
            <p className="reels-section-kicker">Now playing</p>
            <h3>{activeReel ? getDisplayName(activeReel) : "No active reel"}</h3>
            <p>
              {activeReel
                ? `${activeIndex + 1} of ${totalReels} in the stream`
                : "Scroll the stage to lock onto a reel."}
            </p>

            <div className="reels-nav-controls">
              <button type="button" className="btn-secondary" onClick={() => scrollToIndex(activeIndex - 1)}>
                <ReelsGlyph name="previous" />
                Previous
              </button>
              <button type="button" className="btn-secondary" onClick={() => scrollToIndex(activeIndex + 1)}>
                Next
                <ReelsGlyph name="next" />
              </button>
            </div>

            <button type="button" className="btn-secondary reels-refresh-btn" onClick={loadReels}>
              <ReelsGlyph name="refresh" />
              Refresh Reels
            </button>
          </div>

          <div className="reels-rail-card reels-queue-card">
            <h3>Stream queue</h3>
            <div className="reels-queue-list">
              {reels.slice(0, 6).map((reel, index) => (
                <button
                  key={reel._id || index}
                  type="button"
                  className={`reels-queue-item ${reel._id === activeReelId ? "active" : ""}`}
                  onClick={() => scrollToIndex(index)}
                  aria-current={reel._id === activeReelId ? "true" : undefined}
                >
                  <img src={getReelPoster(reel) || getAvatar(reel)} alt={getDisplayName(reel)} />
                  <div>
                    <strong>{getDisplayName(reel)}</strong>
                    <span>{formatRelativeTime(reel?.createdAt)}</span>
                  </div>
                  <span className="reels-queue-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <button type="button" className="reels-mobile-create" onClick={() => setComposerOpen(true)}>
        <ReelsGlyph name="plus" size={20} />
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
