export default function PostCard({ post }) {
  return (
    <article className="card post fade-in">
      {/* HEADER */}
      <div className="post-header">
        <img
          src={post.avatar || "/avatar.png"}
          alt={post.username}
          className="post-avatar"
        />

        <div className="post-user">
          <div className="post-name">@{post.username}</div>
          <div className="post-time">
            {new Date(post.createdAt || Date.now()).toLocaleString()}
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="post-content">
        {post.text}
      </div>

      {/* ACTIONS */}
      <div className="post-actions">
        <button className="post-action">👍 Like</button>
        <button className="post-action">💬 Comment</button>
        <button className="post-action">↗ Share</button>
      </div>
    </article>
  );
}
