import { useEffect, useMemo, useRef, useState } from "react";
import PostComments from "./PostComments";
import { resolveImage } from "../api";

/* ======================================================
   SYSTEM / STARTER POST HANDLING
   ====================================================== */

function SystemPost({ text }) {
  return (
    <article className="post-card system-post">
      <p className="system-text">{text}</p>
    </article>
  );
}

/* ======================================================
   REACTIONS
   ====================================================== */

const REACTIONS = [
  { key: "like", label: "\u{1F44D}", name: "Like" },
  { key: "love", label: "\u{2764}\u{FE0F}", name: "Love" },
  { key: "haha", label: "\u{1F602}", name: "Haha" },
  { key: "wow", label: "\u{1F62E}", name: "Wow" },
  { key: "sad", label: "\u{1F622}", name: "Sad" },
  { key: "angry", label: "\u{1F621}", name: "Angry" },
];

/* ======================================================
   EDIT MODAL
   ====================================================== */

function EditPostModal({ post, onClose, onSave }) {
  const [text, setText] = useState(post?.text || "");
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => (document.body.style.overflow = "");
  }, []);

  useEffect(() => {
    const handler = (event) => {
      if (boxRef.current && !boxRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    if (!text.trim() || loading) {
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`/api/posts/${post._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to update post");
      }

      onSave(data);
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pc-overlay">
      <div className="pc-modal" ref={boxRef} role="dialog" aria-modal="true">
        <div className="pc-header">
          <h3>Edit post</h3>
          <button className="pc-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <textarea
          className="pc-textarea"
          value={text}
          onChange={(event) => setText(event.target.value)}
          autoFocus
        />

        <button
          className={`pc-submit ${text.trim() ? "active" : ""}`}
          disabled={!text.trim() || loading}
          onClick={submit}
        >
          {loading ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  );
}

/* ======================================================
   MAIN POST CARD
   ====================================================== */

export default function PostCard({ post, isSystem, onDelete, onEdit }) {
  /* SYSTEM POST SHORT-CIRCUIT */
  const isSystemPost = isSystem || post?.system;

  /* -------------------------------------------------- */

  const [reaction, setReaction] = useState(
    post?.likedByViewer ? REACTIONS[0] : null
  );
  const [showReactions, setShowReactions] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const timeLabel = post?.createdAt
    ? new Date(post.createdAt).toLocaleString()
    : "Just now";

  const username = post?.user?.name || post?.username || "Unknown User";
  const avatar =
    resolveImage(post?.user?.profilePic || post?.avatar) || "/avatar.png";
  const mediaCandidate = Array.isArray(post?.media)
    ? post?.media?.[0]?.url || post?.media?.[0]
    : post?.media;
  const postImage = resolveImage(post?.image || post?.photo || mediaCandidate);
  const tags = Array.isArray(post?.tags) ? post.tags.filter(Boolean) : [];
  const feeling = typeof post?.feeling === "string" ? post.feeling.trim() : "";
  const checkInLocation =
    typeof post?.location === "string" ? post.location.trim() : "";
  const callToAction =
    post?.callToAction && typeof post.callToAction === "object"
      ? post.callToAction
      : {};
  const moreOptions = Array.isArray(post?.moreOptions)
    ? post.moreOptions.filter(Boolean)
    : [];
  const callValue =
    typeof callToAction?.value === "string" ? callToAction.value.trim() : "";
  const hasCallCta =
    callToAction?.type === "call" &&
    Boolean(callToAction?.enabled) &&
    Boolean(callValue);

  const baseLikesCount = Number(post?.likesCount ?? post?.likes ?? 0) || 0;
  const baseCommentsCount =
    Number(post?.commentsCount) ||
    (Array.isArray(post?.comments) ? post.comments.length : 0);
  const [likesCount, setLikesCount] = useState(baseLikesCount);
  const [likedByViewer, setLikedByViewer] = useState(Boolean(post?.likedByViewer));
  const [liveCommentsCount, setLiveCommentsCount] = useState(baseCommentsCount);
  const [shareCount, setShareCount] = useState(Number(post?.shareCount) || 0);
  const [liking, setLiking] = useState(false);
  const [sharing, setSharing] = useState(false);

  const reactionsCount = likesCount;
  const commentsLabel = liveCommentsCount === 1 ? "comment" : "comments";
  const sharesLabel = shareCount === 1 ? "share" : "shares";

  const isOwner = !!post?.isOwner;

  useEffect(() => {
    const handler = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setLiveCommentsCount(baseCommentsCount);
  }, [baseCommentsCount, post?._id]);

  useEffect(() => {
    setLikesCount(baseLikesCount);
    const nextLiked = Boolean(post?.likedByViewer);
    setLikedByViewer(nextLiked);
    setReaction(nextLiked ? REACTIONS[0] : null);
  }, [baseLikesCount, post?._id, post?.likedByViewer]);

  useEffect(() => {
    setShareCount(Number(post?.shareCount) || 0);
  }, [post?._id, post?.shareCount]);

  const likeBtnLabel = useMemo(() => {
    if (!likedByViewer) {
      return "Like";
    }

    return reaction?.name || "Like";
  }, [likedByViewer, reaction]);

  const copyCurrentLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
  };

  const copyLinkOnly = async () => {
    try {
      await copyCurrentLink();
      alert("Post link copied");
    } catch {
      alert("Copy failed");
    }
  };

  const syncLike = async (shouldLike, selectedReaction = null) => {
    if (liking) {
      return;
    }

    if (likedByViewer === shouldLike) {
      setReaction(shouldLike ? selectedReaction || reaction || REACTIONS[0] : null);
      return;
    }

    try {
      setLiking(true);

      const res = await fetch(`/api/posts/${post._id}/like`, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to update like");
      }

      const nextLiked = Boolean(data?.liked);
      setLikedByViewer(nextLiked);
      setLikesCount((current) => {
        const nextCount = Number(data?.likesCount);
        if (Number.isFinite(nextCount) && nextCount >= 0) {
          return nextCount;
        }
        return Math.max(0, current + (nextLiked ? 1 : -1));
      });
      setReaction(nextLiked ? selectedReaction || reaction || REACTIONS[0] : null);
    } catch (err) {
      alert(err.message || "Failed to update like");
    } finally {
      setLiking(false);
    }
  };

  const sharePost = async () => {
    if (sharing) {
      return;
    }

    try {
      setSharing(true);

      const res = await fetch(`/api/posts/${post._id}/share`, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to share post");
      }

      setShareCount((current) => {
        const nextCount = Number(data?.shareCount);
        if (Number.isFinite(nextCount) && nextCount >= 0) {
          return nextCount;
        }
        return current + 1;
      });

      try {
        await copyCurrentLink();
        alert("Post shared");
      } catch {
        alert("Post shared");
      }
    } catch (err) {
      alert(err.message || "Failed to share post");
    } finally {
      setSharing(false);
    }
  };

  const deletePost = async () => {
    if (deleting) {
      return;
    }

    const ok = confirm("Delete this post?");
    if (!ok) {
      return;
    }

    try {
      setDeleting(true);

      const res = await fetch(`/api/posts/${post._id}`, {
        method: "DELETE",
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to delete post");
      }

      onDelete?.(post._id);
      setMenuOpen(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  };

  if (isSystemPost) {
    return <SystemPost text={post?.text} />;
  }

  return (
    <>
      <article className="post-card post-fade">
        {/* HEADER */}
        <div className="post-header">
          <div className="post-user">
            <img className="post-avatar" src={avatar} alt="user" />
            <div className="post-user-meta">
              <p className="post-name">{username}</p>
              <p className="post-time">{timeLabel}</p>
            </div>
          </div>

          {/* MENU */}
          <div className="post-menu" ref={menuRef}>
            <button
              className="post-menu-btn"
              title="More"
              onClick={() => setMenuOpen((state) => !state)}
            >
              {"\u22EF"}
            </button>

            {menuOpen && (
              <div className="post-menu-dropdown">
                <button onClick={copyLinkOnly}>Copy link</button>

                {isOwner && (
                  <>
                    <button
                      onClick={() => {
                        setEditOpen(true);
                        setMenuOpen(false);
                      }}
                    >
                      Edit post
                    </button>

                    <button className="danger" onClick={deletePost}>
                      {deleting ? "Deleting..." : "Delete post"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* BODY */}
        <div className="post-body">
          {post?.text && <p className="post-text">{post.text}</p>}

          {(tags.length > 0 || feeling || checkInLocation || moreOptions.length > 0) && (
            <div className="post-meta-row">
              {tags.map((person) => (
                <span key={`tag-${person}`} className="post-meta-chip tag">
                  @{person}
                </span>
              ))}

              {feeling && (
                <span className="post-meta-chip feeling">Feeling {feeling}</span>
              )}

              {checkInLocation && (
                <span className="post-meta-chip location">
                  Check-in {checkInLocation}
                </span>
              )}

              {moreOptions.map((option) => (
                <span key={`more-${option}`} className="post-meta-chip more">
                  {option}
                </span>
              ))}
            </div>
          )}

          {postImage && (
            <div className="post-media">
              <img src={postImage} alt="post" className="post-image" />
            </div>
          )}

          {hasCallCta && (
            <a
              className="post-call-cta"
              href={`tel:${callValue.replace(/\s+/g, "")}`}
            >
              Call {callValue}
            </a>
          )}
        </div>

        <div className="post-engagement-summary">
          <div className="post-engagement-left">
            <div className="post-reaction-icons" aria-hidden="true">
              <span className="post-reaction-dot like">{"\u{1F44D}"}</span>
              <span className="post-reaction-dot wow">{"\u{1F62E}"}</span>
              <span className="post-reaction-dot love">{"\u{2764}\u{FE0F}"}</span>
            </div>
            <span className="post-engagement-count">{reactionsCount}</span>
          </div>

          <div className="post-engagement-right">
            <span>
              {liveCommentsCount} {commentsLabel}
            </span>
            <span>
              {shareCount} {sharesLabel}
            </span>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="post-actions">
          <div
            className="reaction-wrapper"
            onMouseEnter={() => setShowReactions(true)}
            onMouseLeave={() => setShowReactions(false)}
          >
            {showReactions && (
              <div className="reaction-bar">
                {REACTIONS.map((nextReaction) => (
                  <button
                    key={nextReaction.key}
                    title={nextReaction.name}
                    onClick={() => {
                      setShowReactions(false);
                      syncLike(true, nextReaction);
                    }}
                  >
                    {nextReaction.label}
                  </button>
                ))}
              </div>
            )}

            <button
              className={`action-btn ${likedByViewer ? "active-like" : ""}`}
              onClick={() => syncLike(!likedByViewer, likedByViewer ? null : REACTIONS[0])}
              disabled={liking}
            >
              <span className="btn-emoji">
                {likedByViewer ? reaction?.label || "\u{1F44D}" : "\u{1F44D}"}
              </span>
              <span>{likeBtnLabel}</span>
            </button>
          </div>

          <button
            className={`action-btn ${showComments ? "active" : ""}`}
            onClick={() => setShowComments((state) => !state)}
          >
            <span className="btn-emoji">{"\u{1F4AC}"}</span>
            <span>Comment</span>
          </button>

          <button className="action-btn" onClick={sharePost} disabled={sharing}>
            <span className="btn-emoji">{"\u{21AA}"}</span>
            <span>{sharing ? "Sharing..." : "Share"}</span>
          </button>
        </div>

        {/* COMMENTS */}
        <div className={`post-comments-wrap ${showComments ? "open" : ""}`}>
          {showComments && (
            <div className="post-comments">
              <PostComments
                postId={post?._id}
                initialComments={post?.comments}
                initialCount={baseCommentsCount}
                onCountChange={setLiveCommentsCount}
              />
            </div>
          )}
        </div>
      </article>

      {editOpen && (
        <EditPostModal
          post={post}
          onClose={() => setEditOpen(false)}
          onSave={(updatedPost) => {
            onEdit?.(updatedPost);
          }}
        />
      )}
    </>
  );
}
