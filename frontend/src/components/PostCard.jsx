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

  const timeLabel = post?.createdAt
    ? new Date(post.createdAt).toLocaleString()
    : "Just now";

  const username =
    post?.user?.name || post?.username || "Unknown User";

  const avatar =
    post?.user?.profilePic || post?.avatar || "/avatar.png";

  return (
    <article className="post-card fade-in">
      {/* ✅ UPDATED HEADER (NEW STYLE + MENU UI) */}
      <div className="post-header">
        <div className="post-user">
          <img className="post-avatar" src={avatar} alt="user" />
          <div>
            <p className="post-name">{username}</p>
            <p className="post-time">{timeLabel}</p>
          </div>
        </div>

        <button className="post-menu-btn" title="More">
          ⋯
        </button>
      </div>

      {/* BODY */}
      <div className="post-body">
        <p className="post-text">{post?.text}</p>
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
            <span className="btn-emoji">
              {reaction ? reaction.label : "👍"}
            </span>
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
          <PostComments postId={post?._id} />
        </div>
      )}
    </article>
  );
}
