const number = (value) => Number(value || 0).toLocaleString();
const percent = (value) => `${Math.round(Number(value || 0) * 100)}%`;

const label = (value = "") => String(value || "")
  .split("_")
  .filter(Boolean)
  .map((part) => `${part[0]?.toUpperCase() || ""}${part.slice(1)}`)
  .join(" ");

const statusClass = (status = "") => {
  const normalized = String(status || "").toLowerCase();
  if (["blocked", "rollback_required", "hold_expansion", "human_review_required"].includes(normalized)) {
    return "adminx-badge adminx-badge--danger";
  }
  if (["watch", "needs_review", "available_disabled", "needs_evidence"].includes(normalized)) {
    return "adminx-badge adminx-badge--warn";
  }
  return "adminx-badge adminx-badge--good";
};

const routeForProgram = (programKey = "") => {
  if (programKey === "new_creator_activation") {return "/admin/creators";}
  if (programKey === "first_paid_drop") {return "/admin/content";}
  if (programKey === "subscription_launch") {return "/admin/transactions";}
  return "/admin/creators";
};

export default function LaunchGrowthOperatingPanels({ payload = {}, navigate }) {
  const summary = payload.summary || {};
  const packages = payload.roadmapPackages || [];
  const payout = payload.payoutAutomation || { summary: {}, decisions: [] };
  const creator = payload.creatorLifecycle || { summary: {}, programSummary: [], launchCohortCandidates: [] };
  const fan = payload.fanLifecycle || { summary: {}, subscriptionDiagnostics: {}, fans: [] };
  const activation = payload.firstWeekActivation || { summary: {}, states: [], bySource: [] };
  const campaigns = payload.revenueCampaigns || { summary: {}, campaigns: [] };
  const support = payload.supportTrust || { summary: {}, queues: [], macros: [] };
  const governance = payload.launchGovernance || { launchReport: {} };

  return (
    <>
      <section className="adminx-panel adminx-panel--span-12" data-testid="next-ten-roadmap-operations">
        <div className="adminx-panel-head">
          <div>
            <h2 className="adminx-panel-title">Launch And Growth Operating System</h2>
            <span className="adminx-section-meta">
              Ten connected roadmap packages for controlled payouts, lifecycle growth, launch readiness, campaigns, and support.
            </span>
          </div>
          <span className={statusClass(summary.launchDecision)}>{label(summary.launchDecision || "no_data")}</span>
        </div>
        <div className="adminx-ops-grid">
          <div className="adminx-ops-metric"><span>Packages available</span><strong>{number(summary.packagesAvailable)}</strong></div>
          <div className="adminx-ops-metric"><span>Implemented</span><strong>{number(summary.packagesImplemented)}</strong></div>
          <div className="adminx-ops-metric"><span>Payout candidates</span><strong>{number(summary.payoutPreflightEligible)}</strong></div>
          <div className="adminx-ops-metric"><span>Creator candidates</span><strong>{number(summary.creatorCohortCandidates)}</strong></div>
          <div className="adminx-ops-metric"><span>Renewal risk</span><strong>{number(summary.fanRenewalRisk)}</strong></div>
          <div className="adminx-ops-metric"><span>SLA breaches</span><strong>{number(summary.supportSlaBreaches)}</strong></div>
        </div>
        <div className="adminx-pill-row">
          {packages.map((item) => (
            <span key={item.id} className={statusClass(item.status)} title={item.title}>
              {item.id} · {label(item.status)}
            </span>
          ))}
        </div>
      </section>

      <section className="adminx-panel adminx-panel--span-6">
        <div className="adminx-panel-head">
          <h2 className="adminx-panel-title">Controlled Payout Automation</h2>
          <span className={statusClass(payout.policy?.enabled ? "ready" : "watch")}>
            {payout.policy?.enabled ? "Preflight enabled" : "Disabled"}
          </span>
        </div>
        <div className="adminx-ops-grid">
          <div className="adminx-ops-metric"><span>Evaluated</span><strong>{number(payout.summary?.evaluated)}</strong></div>
          <div className="adminx-ops-metric"><span>Eligible</span><strong>{number(payout.summary?.eligible)}</strong></div>
          <div className="adminx-ops-metric"><span>Human review</span><strong>{number(payout.summary?.humanReview)}</strong></div>
          <div className="adminx-ops-metric"><span>Blocked</span><strong>{number(payout.summary?.blocked)}</strong></div>
        </div>
        <div className="adminx-muted">Preflight never authorizes money movement. First, high-value, changed-method, trust-risk, and provider-mismatch payouts stay human-reviewed.</div>
        <button type="button" className="adminx-link-btn adminx-link-btn--inline" onClick={() => navigate("/admin/creator-earnings")}>Open payout operations</button>
      </section>

      <section className="adminx-panel adminx-panel--span-6">
        <div className="adminx-panel-head">
          <h2 className="adminx-panel-title">Launch Governance Review</h2>
          <span className={statusClass(governance.readinessState)}>{label(governance.readinessState || "no_data")}</span>
        </div>
        <div className="adminx-muted">Decision: {label(governance.decision || "pending")}</div>
        <div className="adminx-alert-list">
          {(governance.launchReport?.knownRisks || []).slice(0, 4).map((risk) => (
            <button key={risk.key} type="button" className="adminx-alert-item" onClick={() => navigate(risk.actionPath || "/admin/assurance")}>
              <div className="adminx-row"><strong>{label(risk.key)}</strong><span className={statusClass(risk.severity)}>{label(risk.severity)}</span></div>
              <div className="adminx-muted">{risk.nextAction}</div>
            </button>
          ))}
          {!(governance.launchReport?.knownRisks || []).length ? <div className="adminx-empty">No launch blockers in current evidence.</div> : null}
        </div>
        <button type="button" className="adminx-link-btn adminx-link-btn--inline" onClick={() => navigate("/admin/assurance")}>Open command center</button>
      </section>

      <section className="adminx-panel adminx-panel--span-7">
        <div className="adminx-panel-head">
          <h2 className="adminx-panel-title">Creator Lifecycle And First Cohort</h2>
          <span className="adminx-section-meta">{number(creator.summary?.launchReady)} launch-ready</span>
        </div>
        <div className="adminx-pill-row">
          {(creator.programSummary || []).map((program) => (
            <button key={program.key} type="button" className="adminx-tab" onClick={() => navigate(routeForProgram(program.key))}>
              {program.title} · {number(program.active)} active
            </button>
          ))}
        </div>
        <div className="adminx-leaderboard">
          {(creator.launchCohortCandidates || []).slice(0, 5).map((entry) => (
            <button key={entry.creatorProfileId} type="button" className="adminx-leaderboard-item" onClick={() => navigate(`/admin/creators/${entry.creatorProfileId}`)}>
              <div className="adminx-row"><strong>{entry.displayName}</strong><span className={statusClass(entry.launchReadinessState)}>{label(entry.launchReadinessState)}</span></div>
              <div className="adminx-muted">{label(entry.lifecycleStage)} · {number(entry.metrics?.catalogItems)} catalog · {number(entry.metrics?.paidSales)} sales</div>
              <div className="adminx-muted">Program: {entry.program?.title || label(entry.recommendedProgramKey)}</div>
            </button>
          ))}
          {!(creator.launchCohortCandidates || []).length ? <div className="adminx-empty">No creator currently meets the bounded cohort criteria.</div> : null}
        </div>
      </section>

      <section className="adminx-panel adminx-panel--span-5">
        <div className="adminx-panel-head">
          <h2 className="adminx-panel-title">Fan Lifecycle And Subscription Retention</h2>
          <span className={statusClass(fan.summary?.renewalRisk ? "watch" : "ready")}>{number(fan.summary?.renewalRisk)} renewal risk</span>
        </div>
        <div className="adminx-ops-grid">
          <div className="adminx-ops-metric"><span>Failed renewals</span><strong>{number(fan.subscriptionDiagnostics?.failedRenewals)}</strong></div>
          <div className="adminx-ops-metric"><span>Cancel scheduled</span><strong>{number(fan.subscriptionDiagnostics?.cancellationScheduled)}</strong></div>
          <div className="adminx-ops-metric"><span>Grace recoveries</span><strong>{number(fan.subscriptionDiagnostics?.gracePeriodRecoveries)}</strong></div>
          <div className="adminx-ops-metric"><span>After activity</span><strong>{number(fan.subscriptionDiagnostics?.renewalAfterCreatorActivity)}</strong></div>
        </div>
        <div className="adminx-pill-row">
          {Object.entries(fan.summary?.stageCounts || {}).map(([stage, count]) => (
            <span key={stage} className="adminx-badge">{label(stage)} {number(count)}</span>
          ))}
        </div>
      </section>

      <section className="adminx-panel adminx-panel--span-6">
        <div className="adminx-panel-head">
          <h2 className="adminx-panel-title">First-Week Fan Activation</h2>
          <span className="adminx-section-meta">{number(activation.summary?.entrants)} entrants</span>
        </div>
        <div className="adminx-ops-grid">
          <div className="adminx-ops-metric"><span>Meaningful action</span><strong>{percent(activation.summary?.meaningfulActionRate)}</strong></div>
          <div className="adminx-ops-metric"><span>Week return</span><strong>{percent(activation.summary?.firstWeekReturnRate)}</strong></div>
          <div className="adminx-ops-metric"><span>Paid activation</span><strong>{percent(activation.summary?.paidActivationRate)}</strong></div>
        </div>
        <div className="adminx-pill-row">
          {(activation.states || []).map((state) => <span key={state.key} className="adminx-badge">{label(state.key)} {number(state.count)}</span>)}
        </div>
        <div className="adminx-muted">Sources: {(activation.bySource || []).map((source) => `${label(source.source)} ${percent(source.activationRate)}`).join(" · ") || "No attributed entrants"}</div>
      </section>

      <section className="adminx-panel adminx-panel--span-6">
        <div className="adminx-panel-head">
          <h2 className="adminx-panel-title">Reversible Revenue Campaigns</h2>
          <span className="adminx-section-meta">{number(campaigns.summary?.ready)} ready · {number(campaigns.summary?.active)} active</span>
        </div>
        <div className="adminx-alert-list">
          {(campaigns.campaigns || []).slice(0, 4).map((campaign) => (
            <button key={campaign.id} type="button" className="adminx-alert-item" onClick={() => navigate("/admin/campaigns")}>
              <div className="adminx-row"><strong>{campaign.name}</strong><span className={statusClass(campaign.readinessState)}>{label(campaign.status)}</span></div>
              <div className="adminx-muted">Ledger: {campaign.ledgerTrackingKey} · Discount {number(campaign.discountPercent)}%</div>
              <div className="adminx-muted">Rollback: {campaign.rollbackPlan}</div>
            </button>
          ))}
          {!(campaigns.campaigns || []).length ? <div className="adminx-empty">No campaign drafts yet. The API enforces owners, windows, margins, refund handling, ledger keys, metrics, and rollback plans.</div> : null}
        </div>
        <button type="button" className="adminx-link-btn adminx-link-btn--inline" onClick={() => navigate("/admin/campaigns")}>Open campaigns</button>
      </section>

      <section className="adminx-panel adminx-panel--span-12">
        <div className="adminx-panel-head">
          <h2 className="adminx-panel-title">Public Support And Trust Operations</h2>
          <span className={statusClass(support.summary?.breached ? "blocked" : "ready")}>{number(support.summary?.breached)} SLA breaches</span>
        </div>
        <div className="adminx-alert-list adminx-alert-list--inline">
          {(support.queues || []).map((queue) => (
            <button key={queue.key} type="button" className="adminx-alert-item" onClick={() => navigate(queue.actionPath || "/admin/reports")}>
              <div className="adminx-row"><strong>{queue.title}</strong><span className={statusClass(queue.status)}>{label(queue.status)}</span></div>
              <div className="adminx-muted">Open {number(queue.open)} · breached {number(queue.breached)} · target {number(queue.targetHours)}h</div>
              <div className="adminx-muted">Escalation: {queue.escalationOwner}</div>
            </button>
          ))}
        </div>
        <div className="adminx-muted">{number(support.macros?.length)} grounded support macros are shared with the launch command center.</div>
      </section>
    </>
  );
}
