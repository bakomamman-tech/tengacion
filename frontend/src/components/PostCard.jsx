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

  return (
    <article className="card post fade-in">
      {/* HEADER */}
      <div className="post-header">
        <img
          src={post.avatar || "/avatar.png"}
          className="post-avatar"
          alt={post.username}
        />
        <div>
          <div className="post-user">@{post.username}</div>
          <div className="post-time">
            {post.createdAt
              ? new Date(post.createdAt).toLocaleString()
              : "Just now"}
          </div>
        </div>
      </div>

      {/* BODY */}
      <p className="post-text">{post.text}</p>

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

          <button className="action-btn">
            {reaction ? reaction.label : "👍"}{" "}
            {reaction?.name || "Like"}
          </button>
        </div>

        {/* COMMENT */}
        <button
          className="action-btn"
          onClick={() => setShowComments((s) => !s)}
        >
          💬 Comment
        </button>

        {/* SHARE */}
        <button className="action-btn">↗ Share</button>
      </div>

      {/* COMMENTS */}
      {showComments && <PostComments postId={post._id} />}
    </article>
  );
}
