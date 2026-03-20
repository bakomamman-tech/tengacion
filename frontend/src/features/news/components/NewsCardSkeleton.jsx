export default function NewsCardSkeleton() {
  return (
    <article className="card news-card news-card-skeleton" aria-hidden="true">
      <div className="news-card-skeleton-top" />
      <div className="news-card-skeleton-title" />
      <div className="news-card-skeleton-line" />
      <div className="news-card-skeleton-line short" />
      <div className="news-card-skeleton-footer" />
    </article>
  );
}
