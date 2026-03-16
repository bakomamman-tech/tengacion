import { Link } from "react-router-dom";

import { getAudienceDestinationCopy } from "./uploadAudienceUtils";

export default function CreatorAudienceDestinationCard({
  categoryKey = "music",
  publicPath = "",
  highlights = [],
}) {
  const audienceCopy = getAudienceDestinationCopy({ categoryKey });

  return (
    <section className="creator-panel card creator-upload-side-card creator-audience-destination-card">
      <div className="creator-panel-head">
        <div>
          <h2>Audience destination</h2>
          <p>{audienceCopy.description}</p>
        </div>
      </div>

      <div className="creator-audience-chip-row" aria-label="Audience actions">
        {audienceCopy.actions.map((action) => (
          <span key={action} className="creator-audience-chip">
            {action}
          </span>
        ))}
      </div>

      {publicPath ? (
        <>
          <div className="creator-category-actions">
            <Link className="creator-primary-btn creator-upload-cta" to={publicPath}>
              Open {audienceCopy.pageLabel.toLowerCase()}
            </Link>
          </div>
          <div className="creator-upload-route-note">
            <span>Final page</span>
            <strong>{publicPath}</strong>
          </div>
        </>
      ) : null}

      <div className="creator-quick-list">
        {highlights.map((item) => (
          <div key={item.title} className="creator-quick-action">
            <span>{item.title}</span>
            <small>{item.copy}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
