import AdminAvatar from "./AdminAvatar";
import AdminDashboardIcon from "./AdminDashboardIcon";

const timeAgo = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.max(1, Math.round(diffMs / (60 * 60 * 1000)));
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
};

export default function RecentPostsCard({ items = [] }) {
  return (
    <section className="tdash-panel">
      <div className="tdash-panel__head">
        <h3 className="tdash-panel__title">Recent Posts</h3>
        <button type="button" className="tdash-panel__ghost-btn" aria-label="Open recent posts menu">
          <AdminDashboardIcon name="more" size={18} />
        </button>
      </div>

      <div className="tdash-recent-posts">
        {items.map((item) => (
          <article key={item.id} className="tdash-recent-post">
            <div
              className={`tdash-recent-post__media ${item.previewImage ? "has-image" : ""}`}
              style={item.previewImage ? { backgroundImage: `url(${item.previewImage})` } : undefined}
            >
              {!item.previewImage ? (
                <div className="tdash-recent-post__placeholder">
                  <span>Tengacion update</span>
                </div>
              ) : null}
            </div>

            <div className="tdash-recent-post__body">
              <div className="tdash-recent-post__meta">
                <AdminAvatar name={item.authorName} size={38} />
                <div>
                  <div className="tdash-recent-post__author">{item.authorName}</div>
                  <div className="tdash-recent-post__time">{timeAgo(item.createdAt)}</div>
                </div>
              </div>

              <p className="tdash-recent-post__excerpt">{item.excerpt}</p>

              <div className="tdash-recent-post__stats">
                <span>{Number(item.metrics?.likes || 0).toLocaleString()} likes</span>
                <span>{Number(item.metrics?.comments || 0).toLocaleString()} comments</span>
                <span>{Number(item.metrics?.shares || 0).toLocaleString()} shares</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
