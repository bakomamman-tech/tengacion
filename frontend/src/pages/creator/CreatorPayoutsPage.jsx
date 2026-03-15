import { Link } from "react-router-dom";

import { useCreatorWorkspace } from "../../components/creator/useCreatorWorkspace";
import { formatCurrency } from "../../components/creator/creatorConfig";

export default function CreatorPayoutsPage() {
  const { creatorProfile, dashboard } = useCreatorWorkspace();

  return (
    <div className="creator-page-stack">
      <section className="creator-panel card">
        <div className="creator-panel-head">
          <div>
            <h2>Payout readiness</h2>
            <p>Your payout details and current balances used for creator settlements.</p>
          </div>
        </div>
        <div className="creator-stack-list">
          <div className="creator-stack-row">
            <span>Account number</span>
            <strong>{creatorProfile.accountNumber || "Not set"}</strong>
          </div>
          <div className="creator-stack-row">
            <span>Country</span>
            <strong>{creatorProfile.country || "Not set"}</strong>
          </div>
          <div className="creator-stack-row">
            <span>Country of residence</span>
            <strong>{creatorProfile.countryOfResidence || "Not set"}</strong>
          </div>
          <div className="creator-stack-row">
            <span>Available balance</span>
            <strong>{formatCurrency(dashboard.summary?.availableBalance || 0)}</strong>
          </div>
          <div className="creator-stack-row">
            <span>Pending balance</span>
            <strong>{formatCurrency(dashboard.summary?.pendingBalance || 0)}</strong>
          </div>
        </div>
        <Link className="creator-secondary-btn" to="/creator/settings">
          Update payout details
        </Link>
      </section>
    </div>
  );
}
