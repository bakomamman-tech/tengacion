export default function PostCard({ post }) {
  const time = new Date(post.createdAt || Date.now()).toLocaleString();

  return (
    <article className="card post fade-in">
      {/* HEADER */}
      <div className="post-header">
        <img
          className="post-avatar"
          src={post.avatar || "/avatar.png"}
          alt={post.username}
        />

        <div className="post-user">
          <div className="post-name">@{post.username}</div>
          <div className="post-time">{time}</div>
        </div>

        <button className="post-menu" aria-label="Post options">⋯</button>
      </div>

      {/* CONTENT */}
      <div className="post-content">
        {post.text}
      </div>

      {/* DIVIDER */}
      <div className="post-divider" />

      {/* ACTIONS */}
      <div className="post-actions">
        <button className="post-action like">👍 Like</button>
        <button className="post-action">💬 Comment</button>
        <button className="post-action">↗ Share</button>
      </div>
    </article>
  );
}
