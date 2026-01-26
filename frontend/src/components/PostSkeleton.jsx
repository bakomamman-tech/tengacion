export default function PostSkeleton() {
  return (
    <div className="post-card skeleton-card">
      <div className="skeleton-top">
        <div className="skel-avatar"></div>
        <div className="skel-lines">
          <div className="skel-line skel-short"></div>
          <div className="skel-line"></div>
        </div>
      </div>

      <div className="skel-body">
        <div className="skel-line"></div>
        <div className="skel-line skel-mid"></div>
        <div className="skel-image"></div>
      </div>
    </div>
  );
}
