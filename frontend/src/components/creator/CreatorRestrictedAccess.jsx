import { Link } from "react-router-dom";

export default function CreatorRestrictedAccess({
  title = "Access unavailable",
  message = "This area is not enabled on your creator profile.",
  actionLabel = "Return to dashboard",
  actionTo = "/creator/dashboard",
}) {
  return (
    <section className="creator-restricted-card card">
      <div className="creator-restricted-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M12 2.8a5 5 0 0 0-5 5v1.6H5.8A2.8 2.8 0 0 0 3 12.2v6A2.8 2.8 0 0 0 5.8 21h12.4a2.8 2.8 0 0 0 2.8-2.8v-6a2.8 2.8 0 0 0-2.8-2.8H17V7.8a5 5 0 0 0-5-5Zm-3.3 6.6V7.8a3.3 3.3 0 1 1 6.6 0v1.6H8.7Z" />
        </svg>
      </div>
      <h2>{title}</h2>
      <p>{message}</p>
      <Link className="creator-primary-btn" to={actionTo}>
        {actionLabel}
      </Link>
    </section>
  );
}
