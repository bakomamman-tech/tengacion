import { useEffect, useMemo, useRef, useState } from "react";
import PostComments from "./PostComments";

const REACTIONS = [
  { key: "like", label: "👍", name: "Like" },
  { key: "love", label: "❤️", name: "Love" },
  { key: "haha", label: "😂", name: "Haha" },
  { key: "wow", label: "😮", name: "Wow" },
  { key: "sad", label: "😢", name: "Sad" },
  { key: "angry", label: "😡", name: "Angry" },
];

export default function PostCard({ post }) {
  const [reaction, setReaction] = useState(null);
  const [showReactions, setShowReactions] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // ✅ Basic details
  const timeLabel = post?.createdAt
    ? new Date(post.createdAt).toLocaleString()
    : "Just now";

  const username = post?.user?.name || post?.username || "Unknown User";
  const avatar = post?.user?.profilePic || post?.avatar || "/avatar.png";

  // ✅ Optional image support (if your API returns post.image / post.media / post.photo)
  const postImage = post?.image || post?.photo || post?.media || null;

  // ✅ Decide ownership (if your post has userId & current userId later)
  // For now: only show delete/edit if backend provides something like post.isOwner === true
  const isOwner = !!post?.isOwner;

  // ✅ Close menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ✅ Close menu on ESC
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const likeBtnLabel = useMemo(() => {
    if (!reaction) return "Like";
    return reaction.name;
  }, [reaction]);

  const onShare = async () => {
    try {
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      alert("Post link copied ✅");
    } catch {
      alert("Copy failed ❌");
    }
  };

  const onDelete = async () => {
    // 🔥 We will connect backend delete endpoint in the next step
    alert("Delete feature coming next ✅");
    setMenuOpen(false);
  };

  const onEdit = async () => {
    // 🔥 We will connect edit modal in the next step
    alert("Edit feature coming next ✅");
    setMenuOpen(false);
  };

  return (
    <article className="post-card post-fade">
      {/* ✅ HEADER */}
      <div className="post-header">
        <div className="post-user">
          <img className="post-avatar" src={avatar} alt="user" />
          <div className="post-user-meta">
            <p className="post-name">{username}</p>
            <p className="post-time">{timeLabel}</p>
          </div>
        </div>

        {/* ✅ MENU */}
        <div className="post-menu" ref={menuRef}>
          <button
            className="post-menu-btn"
            title="More"
            onClick={() => setMenuOpen((s) => !s)}
          >
            ⋯
          </button>

          {menuOpen && (
            <div className="post-menu-dropdown">
              <button onClick={onShare}>🔗 Copy link</button>

              {isOwner && (
                <>
                  <button onClick={onEdit}>✏️ Edit post</button>
                  <button className="danger" onClick={onDelete}>
                    🗑 Delete post
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ✅ BODY */}
      <div className="post-body">
        {post?.text && <p className="post-text">{post.text}</p>}

        {postImage && (
          <div className="post-media">
            <img src={postImage} alt="post" className="post-image" />
          </div>
        )}
      </div>

      {/* ✅ ACTIONS */}
      <div className="post-actions">
        {/* ✅ LIKE / REACTION */}
        <div
          className="reaction-wrapper"
          onMouseEnter={() => setShowReactions(true)}
          onMouseLeave={() => setShowReactions(false)}
        >
          {showReactions && (
            <div className="reaction-bar">
              {REACTIONS.map((r) => (
                <button
                  key={r.key}
                  title={r.name}
                  onClick={() => {
                    setReaction(r);
                    setShowReactions(false);
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}

          <button className={`action-btn ${reaction ? "active-like" : ""}`}>
            <span className="btn-emoji">{reaction ? reaction.label : "👍"}</span>
            <span>{likeBtnLabel}</span>
          </button>
        </div>

        {/* ✅ COMMENT */}
        <button
          className={`action-btn ${showComments ? "active" : ""}`}
          onClick={() => setShowComments((s) => !s)}
        >
          💬 Comment
        </button>

        {/* ✅ SHARE */}
        <button className="action-btn" onClick={onShare}>
          ↗ Share
        </button>
      </div>

      {/* ✅ COMMENTS (Smooth reveal) */}
      <div className={`post-comments-wrap ${showComments ? "open" : ""}`}>
        {showComments && (
          <div className="post-comments">
            <PostComments postId={post?._id} />
          </div>
        )}
      </div>
    </article>
  );
}
