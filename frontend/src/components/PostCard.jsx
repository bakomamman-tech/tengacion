import { useState } from "react";

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

  return (
    <article className="card post">
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
            {new Date(post.createdAt).toLocaleString()}
          </div>
        </div>
      </div>

      {/* BODY */}
      <p className="post-text">{post.text}</p>

      {/* ACTIONS */}
      <div className="post-actions">
        <div
          className="reaction-wrapper"
          onMouseEnter={() => setShowReactions(true)}
          onMouseLeave={() => setShowReactions(false)}
        >
          {/* REACTION BAR */}
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
            {reaction ? reaction.label : "👍"} {reaction?.name || "Like"}
          </button>
        </div>

        <button className="action-btn">💬 Comment</button>
        <button className="action-btn">↗ Share</button>
      </div>
    </article>
  );
}
