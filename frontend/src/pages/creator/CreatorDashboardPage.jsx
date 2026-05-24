import { useState } from "react";
import { Link } from "react-router-dom";

import CreatorProfileSummaryCard from "../../components/creator/CreatorProfileSummaryCard";
import CreatorStatsCard from "../../components/creator/CreatorStatsCard";
import CopyrightStatusBadge from "../../components/creator/CopyrightStatusBadge";
import { useCreatorWorkspace } from "../../components/creator/useCreatorWorkspace";
import {
  CREATOR_CATEGORY_CONFIG,
  CREATOR_CATEGORY_ORDER,
  formatCurrency,
  formatShortDate,
  normalizeCreatorLaneKeys,
} from "../../components/creator/creatorConfig";

const getActivationStepClass = (step, nextStepKey) => {
  if (step?.complete) {
    return " is-complete";
  }
  if (step?.key === nextStepKey) {
    return " is-current";
  }
  return "";
};

const formatNumber = (value = 0) =>
  new Intl.NumberFormat("en-NG").format(Number(value || 0));

const formatBadgeLabel = (value = "") =>
  String(value || "")
    .replace(/_/g, " ")
    .trim();

const getToneClass = (tone = "") => {
  const normalized = String(tone || "").trim().toLowerCase();
  return ["success", "warning", "danger", "neutral"].includes(normalized)
    ? normalized
    : "neutral";
};

const getBuyerName = (buyer) =>
  buyer?.name || buyer?.username || "Fan";

export default function CreatorDashboardPage() {
  const [copiedTemplateKey, setCopiedTemplateKey] = useState("");
  const { creatorProfile, dashboard } = useCreatorWorkspace();
  const creatorLanes = normalizeCreatorLaneKeys(creatorProfile?.creatorTypes);
  const activation = dashboard.activation || {};
  const activationSteps = Array.isArray(activation.steps) ? activation.steps : [];
  const nextActivationStep =
    activation.nextStep || activationSteps.find((step) => !step.complete);
  const nextStepKey = nextActivationStep?.key || "";
  const operatingConsole = dashboard.operatingConsole || {};
  const actionPrompts = Array.isArray(operatingConsole.actionPrompts)
    ? operatingConsole.actionPrompts
    : [];
  const topContent = Array.isArray(operatingConsole.topContent)
    ? operatingConsole.topContent
    : [];
  const metadataFixes = Array.isArray(operatingConsole.metadataFixes)
    ? operatingConsole.metadataFixes
    : [];
  const recentSales = Array.isArray(operatingConsole.recentSales)
    ? operatingConsole.recentSales
    : [];
  const recentSubscribers = Array.isArray(operatingConsole.recentSubscribers)
    ? operatingConsole.recentSubscribers
    : [];
  const funnel = operatingConsole.funnel || {};
  const catalogHealth = operatingConsole.catalogHealth || {};
  const catalogGrowthPrompts = Array.isArray(operatingConsole.catalogGrowthPrompts)
    ? operatingConsole.catalogGrowthPrompts
    : [];
  const akusoTemplates = Array.isArray(operatingConsole.akusoTemplates)
    ? operatingConsole.akusoTemplates
    : [];
  const discoveryInsights = dashboard.discoveryInsights || {};
  const discoverySummary = discoveryInsights.summary || {};
  const discoverySurfaces = Array.isArray(discoveryInsights.surfaceBreakdown)
    ? discoveryInsights.surfaceBreakdown
    : [];
  const discoveryPrompts = Array.isArray(discoveryInsights.actionPrompts)
    ? discoveryInsights.actionPrompts
    : [];
  const payoutReadiness = dashboard.wallet?.payoutReadiness || {};
  const payoutStatus = payoutReadiness.label || (payoutReadiness.ready ? "Ready" : "Needs attention");
  const topCatalogIssue = catalogHealth.topIssue || {};

  const handleCopyTemplate = async (template) => {
    const prompt = String(template?.prompt || "").trim();
    if (!prompt) {
      return;
    }

    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(prompt).catch(() => null);
    }
    setCopiedTemplateKey(template.key);
  };

  return (
    <div className="creator-page-grid">
      <div className="creator-page-main">
        <CreatorProfileSummaryCard
          creatorProfile={creatorProfile}
          summary={dashboard.summary}
        />

        {activationSteps.length ? (
          <section className="creator-panel creator-activation-panel">
            <div className="creator-panel-head">
              <div>
                <h2>Creator activation</h2>
                <p>
                  {activation.completedCount || 0} of{" "}
                  {activation.totalSteps || activationSteps.length} steps complete.
                </p>
              </div>

              {nextActivationStep ? (
                <Link
                  className="creator-secondary-btn"
                  to={nextActivationStep.actionTo || "/creator/dashboard"}
                >
                  {nextActivationStep.actionLabel || "Continue setup"}
                </Link>
              ) : (
                <span className="creator-status-badge success">Complete</span>
              )}
            </div>

            <div
              className="creator-activation-progress"
              aria-label={`Creator activation ${activation.progressPercent || 0}% complete`}
            >
              <span style={{ width: `${activation.progressPercent || 0}%` }} />
            </div>

            <div className="creator-activation-list">
              {activationSteps.map((step) => (
                <article
                  key={step.key}
                  className={`creator-activation-step${getActivationStepClass(
                    step,
                    nextStepKey
                  )}`}
                >
                  <span
                    className="creator-activation-step__marker"
                    aria-hidden="true"
                  />
                  <div className="creator-activation-step__copy">
                    <strong>{step.label}</strong>
                    <small>{step.description}</small>
                  </div>
                  <span
                    className={`creator-status-badge ${
                      step.complete
                        ? "success"
                        : step.key === nextStepKey
                          ? "warning"
                          : "neutral"
                    }`}
                  >
                    {step.complete
                      ? "Done"
                      : step.key === nextStepKey
                        ? "Next"
                        : "Pending"}
                  </span>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="creator-panel creator-console-panel">
          <div className="creator-panel-head">
            <div>
              <h2>Operating console</h2>
              <p>Today&apos;s highest-priority sales, content, and setup signals.</p>
            </div>
          </div>

          <div className="creator-console-funnel">
            <div>
              <span>Published</span>
              <strong>{formatNumber(funnel.publishedItems || 0)}</strong>
            </div>
            <div>
              <span>Paid items</span>
              <strong>{formatNumber(funnel.paidItems || 0)}</strong>
            </div>
            <div>
              <span>Engagement</span>
              <strong>{formatNumber(funnel.engagement || 0)}</strong>
            </div>
            <div>
              <span>Purchase rate</span>
              <strong>{Number(funnel.engagementToPurchaseRate || 0).toFixed(1)}%</strong>
            </div>
          </div>

          <div className="creator-console-prompt-grid">
            {actionPrompts.length ? (
              actionPrompts.map((prompt) => (
                <article key={prompt.key} className="creator-console-prompt">
                  <div>
                    <span className={`creator-status-badge ${getToneClass(prompt.tone)}`}>
                      {prompt.tone || "next"}
                    </span>
                    <strong>{prompt.title}</strong>
                    <p>{prompt.description}</p>
                  </div>
                  <Link
                    className="creator-secondary-btn"
                    to={prompt.actionTo || "/creator/dashboard"}
                  >
                    {prompt.actionLabel || "Open"}
                  </Link>
                </article>
              ))
            ) : (
              <div className="creator-empty-card">
                Your highest-priority creator actions will appear here as fans
                interact with your catalog.
              </div>
            )}
          </div>
        </section>

        <section className="creator-panel creator-catalog-quality-panel">
          <div className="creator-panel-head">
            <div>
              <h2>Catalog health</h2>
              <p>Highest-impact catalog fixes and copy drafts.</p>
            </div>
            <span className={`creator-status-badge ${getToneClass(catalogHealth.tone)}`}>
              {catalogHealth.label || "Not scored"}
            </span>
          </div>

          <div className="creator-catalog-health-summary">
            <div className="creator-catalog-score">
              <span>Catalog score</span>
              <strong>{formatNumber(catalogHealth.score || 0)}</strong>
              <small>
                {formatNumber(catalogHealth.itemsNeedingWork || 0)} of{" "}
                {formatNumber(catalogHealth.itemCount || 0)} items need work
              </small>
            </div>

            <div className="creator-catalog-health-detail">
              <span className={`creator-status-badge ${getToneClass(topCatalogIssue.tone)}`}>
                {topCatalogIssue.severity || "next"}
              </span>
              <strong>{topCatalogIssue.title || "Publish the first catalog item"}</strong>
              <p>
                {topCatalogIssue.description ||
                  "Catalog quality signals will appear once creator content is available."}
              </p>
            </div>
          </div>

          <div className="creator-catalog-prompt-list">
            {catalogGrowthPrompts.length ? (
              catalogGrowthPrompts.slice(0, 4).map((prompt) => (
                <article key={prompt.key} className="creator-console-prompt">
                  <div>
                    <span className={`creator-status-badge ${getToneClass(prompt.tone)}`}>
                      {formatBadgeLabel(prompt.source || "catalog")}
                    </span>
                    <strong>{prompt.title}</strong>
                    <p>{prompt.description}</p>
                  </div>
                  <Link
                    className="creator-secondary-btn"
                    to={prompt.actionTo || "/creator/dashboard"}
                  >
                    {prompt.actionLabel || "Open"}
                  </Link>
                </article>
              ))
            ) : (
              <div className="creator-empty-card">
                Catalog prompts will appear after your next content update.
              </div>
            )}
          </div>

          <div className="creator-panel-head creator-panel-head--compact">
            <div>
              <h2>Akuso copy templates</h2>
              <p>Review-ready prompts for descriptions, blurbs, benefits, and launches.</p>
            </div>
          </div>

          <div className="creator-akuso-template-grid">
            {akusoTemplates.length ? (
              akusoTemplates.map((template) => (
                <article key={template.key} className="creator-akuso-template">
                  <div>
                    <strong>{template.title}</strong>
                    <p>{template.description}</p>
                  </div>
                  <button
                    type="button"
                    className="creator-chip-link"
                    onClick={() => handleCopyTemplate(template)}
                  >
                    {copiedTemplateKey === template.key
                      ? "Copied"
                      : template.actionLabel || "Copy prompt"}
                  </button>
                </article>
              ))
            ) : (
              <div className="creator-empty-card">
                Akuso templates will appear after your creator profile loads.
              </div>
            )}
          </div>
        </section>

        <section className="creator-panel creator-discovery-insights-panel">
          <div className="creator-panel-head">
            <div>
              <h2>Discovery insights</h2>
              <p>How recommendation surfaces are introducing fans to your creator work.</p>
            </div>
          </div>

          <div className="creator-console-funnel creator-discovery-insights-grid">
            <div>
              <span>Impressions</span>
              <strong>{formatNumber(discoverySummary.impressions || 0)}</strong>
            </div>
            <div>
              <span>Clicks</span>
              <strong>{formatNumber(discoverySummary.clicks || 0)}</strong>
            </div>
            <div>
              <span>Follows</span>
              <strong>{formatNumber(discoverySummary.follows || 0)}</strong>
            </div>
            <div>
              <span>Click rate</span>
              <strong>{Number(discoverySummary.clickThroughRate || 0).toFixed(1)}%</strong>
            </div>
          </div>

          <div className="creator-panel-grid">
            <div className="creator-stack-list">
              {discoverySurfaces.length ? (
                discoverySurfaces.slice(0, 4).map((surface) => (
                  <article key={surface.surface} className="creator-stack-row">
                    <span>
                      {String(surface.surface || "Discovery").replace(/_/g, " ")}
                      <small>
                        {formatNumber(surface.impressions || 0)} impressions -{" "}
                        {Number(surface.clickThroughRate || 0).toFixed(1)}% click rate
                      </small>
                    </span>
                    <strong>{formatNumber(surface.follows || 0)}</strong>
                  </article>
                ))
              ) : (
                <div className="creator-empty-card">
                  Recommendation insights will appear once your content is served in discovery.
                </div>
              )}
            </div>

            <div className="creator-stack-list">
              {discoveryPrompts.length ? (
                discoveryPrompts.slice(0, 3).map((prompt) => (
                  <article key={prompt.key} className="creator-console-prompt">
                    <div>
                      <span className={`creator-status-badge ${getToneClass(prompt.tone)}`}>
                        {prompt.tone || "next"}
                      </span>
                      <strong>{prompt.title}</strong>
                      <p>{prompt.description}</p>
                    </div>
                    <Link
                      className="creator-secondary-btn"
                      to={prompt.actionTo || "/creator/dashboard"}
                    >
                      {prompt.actionLabel || "Open"}
                    </Link>
                  </article>
                ))
              ) : (
                <div className="creator-empty-card">
                  Discovery recommendations will appear here after the next insights window.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="creator-metric-grid">
          <CreatorStatsCard
            label="Total uploads"
            value={creatorLanes.reduce(
              (sum, key) =>
                sum +
                Number(
                  dashboard.categories?.[
                    CREATOR_CATEGORY_CONFIG[key]?.dashboardKey
                  ]?.uploads || 0
                ),
              0
            )}
            helper="Published releases live across your active lanes."
            tone="success"
          />

          <CreatorStatsCard
            label="Drafts"
            value={creatorLanes.reduce(
              (sum, key) =>
                sum +
                Number(
                  dashboard.categories?.[
                    CREATOR_CATEGORY_CONFIG[key]?.dashboardKey
                  ]?.drafts || 0
                ),
              0
            )}
            helper="Unfinished work waiting in your studio."
          />

          <CreatorStatsCard
            label="Pending review"
            value={creatorLanes.reduce(
              (sum, key) =>
                sum +
                Number(
                  dashboard.categories?.[
                    CREATOR_CATEGORY_CONFIG[key]?.dashboardKey
                  ]?.underReview || 0
                ),
              0
            )}
            helper="Uploads currently in moderation or copyright review."
            tone="warning"
          />
        </section>

        <section className="creator-upload-launchpad">
          <div className="creator-panel-head">
            <div>
              <h2>Content Categories</h2>
              <p>
                Choose the exact publishing studio you need. Music, podcasts,
                and books each open in their own fully separated upload
                experience.
              </p>
            </div>
          </div>

          <div className="creator-upload-launch-grid">
            {CREATOR_CATEGORY_ORDER.map((key) => {
              const item = CREATOR_CATEGORY_CONFIG[key];
              const stats = dashboard.categories?.[item.dashboardKey] || {};
              const enabled = creatorLanes.includes(key);

              return (
                <article key={key} className="creator-upload-launch-card">
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
                    <span
                      className={`creator-status-badge ${
                        enabled ? "success" : "neutral"
                      }`}
                    >
                      {enabled ? "Enabled" : "Not enabled"}
                    </span>
                    <span>Published {Number(stats.uploads || 0)}</span>
                    <span>Drafts {Number(stats.drafts || 0)}</span>
                    <span>In review {Number(stats.underReview || 0)}</span>
                  </div>

                  <div className="creator-category-actions">
                    <Link
                      className="creator-primary-btn creator-upload-cta"
                      to={enabled ? item.uploadRoute : "/creator/categories"}
                    >
                      {enabled
                        ? item.uploadButtonLabel
                        : `Enable ${item.shortTitle}`}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <div className="creator-panel-grid">
          <section className="creator-panel">
            <div className="creator-panel-head">
              <div>
                <h2>Top-performing content</h2>
                <p>Ranked by earnings, purchases, then engagement.</p>
              </div>
            </div>

            <div className="creator-stack-list">
              {topContent.length ? (
                topContent.map((item) => (
                  <article key={`${item.itemType}-${item.id}`} className="creator-stack-row">
                    <span>
                      {item.title}
                      <small>
                        {formatCurrency(item.earnings || 0)} earned -{" "}
                        {formatNumber(item.purchases || 0)} purchase
                        {Number(item.purchases || 0) === 1 ? "" : "s"} -{" "}
                        {formatNumber(item.engagement || 0)} engagement
                      </small>
                    </span>
                    <Link className="creator-chip-link" to={item.actionTo || "/creator/dashboard"}>
                      Open
                    </Link>
                  </article>
                ))
              ) : (
                <div className="creator-empty-card">
                  Performance rankings appear once you publish creator content.
                </div>
              )}
            </div>
          </section>

          <section className="creator-panel">
            <div className="creator-panel-head">
              <div>
                <h2>Metadata fixes</h2>
                <p>Content fields most likely to block conversion or review.</p>
              </div>
            </div>

            <div className="creator-stack-list">
              {metadataFixes.length ? (
                metadataFixes.map((item) => (
                  <article key={`${item.itemType}-${item.id}`} className="creator-stack-row">
                    <span>
                      {item.title}
                      <small>{item.missingFields.join(", ")}</small>
                    </span>
                    <Link className="creator-chip-link" to={item.actionTo || "/creator/dashboard"}>
                      Fix
                    </Link>
                  </article>
                ))
              ) : (
                <div className="creator-empty-card">
                  No metadata fixes are blocking your active catalog.
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="creator-panel">
          <div className="creator-panel-head">
            <div>
              <h2>Recent activity</h2>
              <p>
                The latest publishing, review, and sales updates from your
                creator workspace.
              </p>
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
              <div className="creator-empty-card">
                Your recent creator activity will appear here after you publish
                content.
              </div>
            )}
          </div>
        </section>
      </div>

      <aside className="creator-page-side">
        <section className="creator-panel">
          <div className="creator-panel-head">
            <div>
              <h2>Payout readiness</h2>
              <p>{payoutReadiness.nextStep || "Keep payout details ready before withdrawal requests."}</p>
            </div>
            <span className={`creator-status-badge ${payoutReadiness.ready ? "success" : "warning"}`}>
              {payoutStatus}
            </span>
          </div>

          <div className="creator-stack-list">
            <div className="creator-stack-row">
              <span>Account</span>
              <strong>{payoutReadiness.accountNumberMasked || "Not set"}</strong>
            </div>
            <div className="creator-stack-row">
              <span>Status</span>
              <strong>{payoutReadiness.status || "not_started"}</strong>
            </div>
          </div>

          <Link className="creator-secondary-btn" to="/creator/payouts">
            Review payout details
          </Link>
        </section>

        <section className="creator-panel">
          <div className="creator-panel-head">
            <div>
              <h2>Quick earnings snapshot</h2>
              <p>Your current creator finance position.</p>
            </div>
          </div>

          <div className="creator-stack-list">
            <div className="creator-stack-row">
              <span>Total earnings</span>
              <strong>
                {formatCurrency(dashboard.summary?.totalEarnings || 0)}
              </strong>
            </div>

            <div className="creator-stack-row">
              <span>Available</span>
              <strong>
                {formatCurrency(dashboard.summary?.availableBalance || 0)}
              </strong>
            </div>

            <div className="creator-stack-row">
              <span>Pending</span>
              <strong>
                {formatCurrency(dashboard.summary?.pendingBalance || 0)}
              </strong>
            </div>

            <div className="creator-stack-row">
              <span>Withdrawn</span>
              <strong>{formatCurrency(dashboard.summary?.withdrawn || 0)}</strong>
            </div>
          </div>
        </section>

        <section className="creator-panel">
          <div className="creator-panel-head">
            <div>
              <h2>Recent sales</h2>
              <p>Latest confirmed purchases across your paid catalog.</p>
            </div>
          </div>

          <div className="creator-activity-list">
            {recentSales.length ? (
              recentSales.slice(0, 4).map((sale) => (
                <article key={sale.id} className="creator-activity-item">
                  <div>
                    <strong>{sale.itemTitle}</strong>
                    <p>
                      {getBuyerName(sale.buyer)} - Your share{" "}
                      {formatCurrency(sale.creatorAmount || 0)}
                    </p>
                  </div>
                  <div className="creator-activity-meta">
                    <span className="creator-status-badge success">
                      {sale.itemLabel}
                    </span>
                    <span>{formatShortDate(sale.paidAt)}</span>
                  </div>
                </article>
              ))
            ) : (
              <div className="creator-empty-card">
                Confirmed paid purchases will appear here.
              </div>
            )}
          </div>
        </section>

        <section className="creator-panel">
          <div className="creator-panel-head">
            <div>
              <h2>Recent subscribers</h2>
              <p>Fans who joined your monthly creator membership.</p>
            </div>
          </div>

          <div className="creator-activity-list">
            {recentSubscribers.length ? (
              recentSubscribers.slice(0, 4).map((subscriber) => (
                <article key={subscriber.id} className="creator-activity-item">
                  <div>
                    <strong>{getBuyerName(subscriber.buyer)}</strong>
                    <p>
                      {formatCurrency(subscriber.amount || 0)} membership -{" "}
                      {subscriber.label || "Active"}
                    </p>
                  </div>
                  <div className="creator-activity-meta">
                    <span className="creator-status-badge success">
                      Subscriber
                    </span>
                    <span>{formatShortDate(subscriber.paidAt)}</span>
                  </div>
                </article>
              ))
            ) : (
              <div className="creator-empty-card">
                New member purchases will appear here after checkout.
              </div>
            )}
          </div>
        </section>

        <section className="creator-panel">
          <div className="creator-panel-head">
            <div>
              <h2>Verification overview</h2>
              <p>Live scan states across your uploads.</p>
            </div>
          </div>

          <div className="creator-stack-list">
            {Object.entries(dashboard.verificationOverview || {}).map(
              ([key, value]) => (
                <div key={key} className="creator-stack-row">
                  <CopyrightStatusBadge status={key} />
                  <strong>{value}</strong>
                </div>
              )
            )}
          </div>

          <Link className="creator-secondary-btn" to="/creator/verification">
            Open verification center
          </Link>
        </section>

        <section className="creator-panel">
          <div className="creator-panel-head">
            <div>
              <h2>Quick actions</h2>
              <p>Jump straight into the areas you enabled during onboarding.</p>
            </div>
          </div>

          <div className="creator-quick-list">
            <Link className="creator-quick-action" to="/creator/categories">
              <span>Content categories</span>
              <small>
                Enable more creator lanes here, then open their dashboards and
                upload there too.
              </small>
            </Link>

            {creatorLanes.map((key) => (
              <Link
                key={key}
                className="creator-quick-action"
                to={CREATOR_CATEGORY_CONFIG[key].uploadRoute}
              >
                <span>{CREATOR_CATEGORY_CONFIG[key].uploadButtonLabel}</span>
                <small>{CREATOR_CATEGORY_CONFIG[key].uploadDescription}</small>
              </Link>
            ))}

            <Link className="creator-quick-action" to="/creator/support">
              <span>Support</span>
              <small>
                Get help with onboarding, payouts, and verification questions.
              </small>
            </Link>
          </div>
        </section>
      </aside>
    </div>
  );
}
