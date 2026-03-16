import { Link } from "react-router-dom";

import CreatorProfileSummaryCard from "../../components/creator/CreatorProfileSummaryCard";
import CreatorStatsCard from "../../components/creator/CreatorStatsCard";
import CopyrightStatusBadge from "../../components/creator/CopyrightStatusBadge";
import { useCreatorWorkspace } from "../../components/creator/useCreatorWorkspace";
import {
  CREATOR_CATEGORY_CONFIG,
  formatCurrency,
  formatShortDate,
  normalizeCreatorLaneKeys,
} from "../../components/creator/creatorConfig";

export default function CreatorDashboardPage() {
  const { creatorProfile, dashboard } = useCreatorWorkspace();
  const creatorLanes = normalizeCreatorLaneKeys(creatorProfile?.creatorTypes);

  return (
    <div className="creator-page-grid">
      <div className="creator-page-main">
        <CreatorProfileSummaryCard creatorProfile={creatorProfile} summary={dashboard.summary} />

        <section className="creator-metric-grid">
          <CreatorStatsCard
            label="Total uploads"
            value={creatorLanes.reduce(
              (sum, key) => sum + Number(dashboard.categories?.[CREATOR_CATEGORY_CONFIG[key]?.dashboardKey]?.uploads || 0),
              0
            )}
            helper="Published releases live across your active lanes."
            tone="success"
          />
          <CreatorStatsCard
            label="Drafts"
            value={creatorLanes.reduce(
              (sum, key) => sum + Number(dashboard.categories?.[CREATOR_CATEGORY_CONFIG[key]?.dashboardKey]?.drafts || 0),
              0
            )}
            helper="Unfinished work waiting in your studio."
          />
          <CreatorStatsCard
            label="Pending review"
            value={creatorLanes.reduce(
              (sum, key) => sum + Number(dashboard.categories?.[CREATOR_CATEGORY_CONFIG[key]?.dashboardKey]?.underReview || 0),
              0
            )}
            helper="Uploads currently in moderation or copyright review."
            tone="warning"
          />
        </section>

        <section className="creator-upload-launchpad card">
          <div className="creator-panel-head">
            <div>
              <h2>Upload new content</h2>
              <p>Open the dedicated publishing studio for any creator lane you enabled and start uploading immediately.</p>
            </div>
          </div>

          <div className="creator-upload-launch-grid">
            {creatorLanes.map((key) => {
              const item = CREATOR_CATEGORY_CONFIG[key];
              const stats = dashboard.categories?.[item.dashboardKey] || {};

              return (
                <article key={key} className="creator-upload-launch-card card">
                  <div className="creator-category-top">
                    <span className="creator-category-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <div>
                      <h3>{item.uploadTitle}</h3>
                      <p>{item.description}</p>
                    </div>
                  </div>

                  <div className="creator-upload-launch-meta">
                    <span>Published {Number(stats.uploads || 0)}</span>
                    <span>Drafts {Number(stats.drafts || 0)}</span>
                    <span>In review {Number(stats.underReview || 0)}</span>
                  </div>

                  <div className="creator-category-actions">
                    <Link className="creator-primary-btn creator-upload-cta" to={item.uploadRoute}>
                      {item.uploadButtonLabel}
                    </Link>
                    <Link className="creator-secondary-btn" to={item.route}>
                      Open {item.shortTitle}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
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
            {creatorLanes.map((key) => (
              <Link key={key} className="creator-quick-action" to={CREATOR_CATEGORY_CONFIG[key].uploadRoute}>
                <span>{CREATOR_CATEGORY_CONFIG[key].uploadButtonLabel}</span>
                <small>{CREATOR_CATEGORY_CONFIG[key].uploadDescription}</small>
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
