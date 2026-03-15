import { Link } from "react-router-dom";

import CopyrightStatusBadge from "./CopyrightStatusBadge";
import { formatCurrency } from "./creatorConfig";

export default function CreatorHeader({
  title,
  subtitle,
  creatorProfile,
  summary,
  onToggleMenu,
  action,
  primaryAction,
}) {
  return (
    <header className="creator-header">
      <div className="creator-header-left">
        <button type="button" className="creator-mobile-toggle" onClick={onToggleMenu}>
          <span />
          <span />
          <span />
        </button>
        <div>
          <div className="creator-inline-row">
            <h1>{title}</h1>
            <CopyrightStatusBadge status={creatorProfile?.status || "active"} />
          </div>
          <p>{subtitle}</p>
        </div>
      </div>

      <div className="creator-header-right">
        <div className="creator-top-pill">
          <span>Available</span>
          <strong>{formatCurrency(summary?.availableBalance || 0)}</strong>
        </div>
        {action ? (
          action
        ) : (
          <Link className="creator-secondary-btn" to="/creator/settings">
            Edit creator profile
          </Link>
        )}
        {primaryAction ? primaryAction : null}
      </div>
    </header>
  );
}
