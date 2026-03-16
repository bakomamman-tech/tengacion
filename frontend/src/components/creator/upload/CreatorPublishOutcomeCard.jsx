import { Link } from "react-router-dom";

export default function CreatorPublishOutcomeCard({ outcome }) {
  if (!outcome) {
    return null;
  }

  const isPublished = outcome.publishedStatus === "published";
  const isDraft = outcome.publishedStatus === "draft";

  return (
    <section className={`creator-publish-outcome card${isPublished ? " is-live" : ""}`}>
      <div className="creator-panel-head">
        <div>
          <h2>{isPublished ? "Audience page ready" : isDraft ? "Draft saved" : "Submitted for review"}</h2>
          <p>
            {isPublished
              ? `${outcome.title} is now live on your public creator page, where your audience can preview, stream, buy, read, or watch it.`
              : isDraft
                ? `${outcome.title} is saved as a draft. Publish it when you are ready to send your audience to the final release page.`
                : `${outcome.title} is being reviewed before it appears on your public creator page for audience access.`}
          </p>
        </div>
        <span className={`creator-status-badge ${isPublished ? "success" : isDraft ? "neutral" : "warning"}`}>
          {isPublished ? "Live" : isDraft ? "Draft" : "In review"}
        </span>
      </div>

      {outcome.audienceActions?.length ? (
        <div className="creator-audience-chip-row" aria-label="Audience actions">
          {outcome.audienceActions.map((action) => (
            <span key={action} className="creator-audience-chip">
              {action}
            </span>
          ))}
        </div>
      ) : null}

      {outcome.audiencePageLabel || outcome.audiencePath ? (
        <div className="creator-upload-route-note">
          <span>{outcome.audiencePageLabel || "Audience page"}</span>
          <strong>{outcome.audiencePath || "Available after your creator page finishes loading."}</strong>
        </div>
      ) : null}

      <div className="creator-category-actions">
        {outcome.audiencePath ? (
          <Link className="creator-primary-btn creator-upload-cta" to={outcome.audiencePath}>
            {isPublished ? "Open audience page" : "Open creator page"}
          </Link>
        ) : null}
        {isPublished && outcome.detailPath && outcome.detailPath !== outcome.audiencePath ? (
          <Link className="creator-secondary-btn" to={outcome.detailPath}>
            Open release page
          </Link>
        ) : null}
      </div>
    </section>
  );
}
