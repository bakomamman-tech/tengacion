export default function PostSkeleton() {
  return (
    <article className="card post">
      <div className="post-header">
        <div className="skeleton avatar-skel" />
        <div className="post-meta">
          <div className="skeleton line short" />
          <div className="skeleton line tiny" />
        </div>
      </div>

      <div className="post-body">
        <div className="skeleton line" />
        <div className="skeleton line" />
        <div className="skeleton line medium" />
      </div>
    </article>
  );
}
