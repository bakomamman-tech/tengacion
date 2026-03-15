import { Link } from "react-router-dom";

import CreatorCategoryCard from "../../components/creator/CreatorCategoryCard";
import CreatorProfileSummaryCard from "../../components/creator/CreatorProfileSummaryCard";
import CopyrightStatusBadge from "../../components/creator/CopyrightStatusBadge";
import { useCreatorWorkspace } from "../../components/creator/useCreatorWorkspace";
import { CREATOR_CATEGORY_CONFIG, formatCurrency, formatShortDate } from "../../components/creator/creatorConfig";

export default function CreatorDashboardPage() {
  const { creatorProfile, dashboard } = useCreatorWorkspace();

  return (
    <div className="creator-page-grid">
      <div className="creator-page-main">
        <CreatorProfileSummaryCard creatorProfile={creatorProfile} summary={dashboard.summary} />

        <section className="creator-panel-grid">
          {creatorProfile.creatorTypes?.map((key) => (
            <CreatorCategoryCard key={key} categoryKey={key} stats={dashboard.categories?.[key] || {}} />
          ))}
        </section>

        <section className="creator-panel card">
          <div className="creator-panel-head">
            <div>
              <h2>Recent activity</h2>
              <p>The latest publishing, review, and sales updates from your creator workspace.</p>
            </div>
          </div>

          <div className="creator-activity-list">
            {dashboard.recentActivity?.length ? (
              dashboard.recentActivity.map((item) => (
                <article key={item.id} className="creator-activity-item">
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>
                  <div className="creator-activity-meta">
                    <CopyrightStatusBadge status={item.status} />
                    <span>{formatShortDate(item.timestamp)}</span>
                  </div>
                </article>
              ))
            ) : (
              <div className="creator-empty-card">Your recent creator activity will appear here after you publish content.</div>
            )}
          </div>
        </section>
      </div>

      <aside className="creator-page-side">
        <section className="creator-panel card">
          <div className="creator-panel-head">
            <div>
              <h2>Quick earnings snapshot</h2>
              <p>Your current creator finance position.</p>
            </div>
          </div>
          <div className="creator-stack-list">
            <div className="creator-stack-row">
              <span>Total earnings</span>
              <strong>{formatCurrency(dashboard.summary?.totalEarnings || 0)}</strong>
            </div>
            <div className="creator-stack-row">
              <span>Available</span>
              <strong>{formatCurrency(dashboard.summary?.availableBalance || 0)}</strong>
            </div>
            <div className="creator-stack-row">
              <span>Pending</span>
              <strong>{formatCurrency(dashboard.summary?.pendingBalance || 0)}</strong>
            </div>
            <div className="creator-stack-row">
              <span>Withdrawn</span>
              <strong>{formatCurrency(dashboard.summary?.withdrawn || 0)}</strong>
            </div>
          </div>
        </section>

        <section className="creator-panel card">
          <div className="creator-panel-head">
            <div>
              <h2>Verification overview</h2>
              <p>Live scan states across your uploads.</p>
            </div>
          </div>
          <div className="creator-stack-list">
            {Object.entries(dashboard.verificationOverview || {}).map(([key, value]) => (
              <div key={key} className="creator-stack-row">
                <CopyrightStatusBadge status={key} />
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <Link className="creator-secondary-btn" to="/creator/verification">
            Open verification center
          </Link>
        </section>

        <section className="creator-panel card">
          <div className="creator-panel-head">
            <div>
              <h2>Quick actions</h2>
              <p>Jump straight into the areas you enabled during onboarding.</p>
            </div>
          </div>
          <div className="creator-quick-list">
            <Link className="creator-quick-action" to="/creator/categories">
              <span>Content categories</span>
              <small>Enable more creator lanes here, then open their dashboards and upload there too.</small>
            </Link>
            {creatorProfile.creatorTypes?.map((key) => (
              <Link key={key} className="creator-quick-action" to={CREATOR_CATEGORY_CONFIG[key].route}>
                <span>{CREATOR_CATEGORY_CONFIG[key].shortTitle}</span>
                <small>{CREATOR_CATEGORY_CONFIG[key].description}</small>
              </Link>
            ))}
            <Link className="creator-quick-action" to="/creator/support">
              <span>Support</span>
              <small>Get help with onboarding, payouts, and verification questions.</small>
            </Link>
          </div>
        </section>
      </aside>
    </div>
  );
}
