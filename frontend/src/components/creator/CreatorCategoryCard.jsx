import { Link } from "react-router-dom";

import CopyrightStatusBadge from "./CopyrightStatusBadge";
import { CREATOR_CATEGORY_CONFIG, formatCurrency } from "./creatorConfig";

export default function CreatorCategoryCard({ categoryKey, stats = {} }) {
  const item = CREATOR_CATEGORY_CONFIG[categoryKey];
  if (!item) {
    return null;
  }

  return (
    <article className="creator-category-card card">
      <div className="creator-category-top">
        <span className="creator-category-icon" aria-hidden="true">
          {item.icon}
        </span>
        <div>
          <h3>{item.title}</h3>
          <p>{item.description}</p>
        </div>
      </div>

      <div className="creator-category-stats">
        <div>
          <span>Uploads</span>
          <strong>{Number(stats.uploads || 0)}</strong>
        </div>
        <div>
          <span>Drafts</span>
          <strong>{Number(stats.drafts || 0)}</strong>
        </div>
        <div>
          <span>Earnings</span>
          <strong>{formatCurrency(stats.earnings || 0)}</strong>
        </div>
      </div>

      <div className="creator-category-foot">
        <CopyrightStatusBadge status={Number(stats.underReview || 0) > 0 ? "under_review" : "active"} />
        <Link className="creator-secondary-btn" to={item.route}>
          Go to {item.shortTitle} Dashboard
        </Link>
      </div>
    </article>
  );
}
