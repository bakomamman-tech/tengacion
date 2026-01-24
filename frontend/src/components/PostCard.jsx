import { useState } from "react";
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

  const timeLabel = post.createdAt
    ? new Date(post.createdAt).toLocaleString()
    : "Just now";

  return (
    <article className="post-card fade-in">
      {/* HEADER */}
      <div className="post-top">
        <img
          src={post.avatar || "/avatar.png"}
          className="post-avatar"
          alt={post.username}
        />

        <div className="post-meta">
          <div className="post-name-row">
            <span className="post-name">@{post.username}</span>
            <span className="post-dot">·</span>
            <span className="post-time">{timeLabel}</span>
          </div>
          <div className="post-visibility">🌍 Public</div>
        </div>

        <button className="post-more" title="More">
          ⋯
        </button>
      </div>

      {/* BODY */}
      <div className="post-body">
        <p className="post-text">{post.text}</p>
      </div>

      {/* ACTIONS */}
      <div className="post-actions">
        {/* LIKE / REACTION */}
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
            <span>{reaction?.name || "Like"}</span>
          </button>
        </div>

        {/* COMMENT */}
        <button
          className={`action-btn ${showComments ? "active" : ""}`}
          onClick={() => setShowComments((s) => !s)}
        >
          💬 Comment
        </button>

        {/* SHARE */}
        <button className="action-btn">↗ Share</button>
      </div>

      {/* COMMENTS */}
      {showComments && (
        <div className="post-comments">
          <PostComments postId={post._id} />
        </div>
      )}
    </article>
  );
}

