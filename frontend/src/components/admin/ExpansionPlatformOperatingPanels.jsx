const number = (value) => Number(value || 0).toLocaleString();
const money = (value, currency = "NGN") => {
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value || 0));
  } catch {
    return `${currency} ${number(value)}`;
  }
};
const label = (value = "") => String(value || "")
  .split("_")
  .filter(Boolean)
  .map((part) => `${part[0]?.toUpperCase() || ""}${part.slice(1)}`)
  .join(" ");
const statusClass = (status = "") => {
  const value = String(status || "").toLowerCase();
  if (["blocked", "expired", "rejected", "exit", "hold", "partial"].includes(value)) {return "adminx-badge adminx-badge--danger";}
  if (["watch", "draft", "review", "review_required", "repeat_with_changes", "no_attributed_data", "not_checked"].includes(value)) {return "adminx-badge adminx-badge--warn";}
  return "adminx-badge adminx-badge--good";
};

export default function ExpansionPlatformOperatingPanels({ payload = {}, navigate }) {
  const summary = payload.summary || {};
  const playbooks = payload.creatorPlaybooks || { catalog: [], plans: [], summary: {} };
  const referrals = payload.referralAttribution || { summary: {}, bySource: [], privacyBoundary: {} };
  const data = payload.dataAndExperiments || { eventTaxonomy: [], metricContracts: [], experiments: [] };
  const cohorts = payload.expansionCohorts || { reviews: [], scorecard: {} };
  const relationships = payload.fanRelationships || { stages: [], summary: {} };
  const automation = payload.operationsAutomation || { suggestions: [], sensitiveActionsAlwaysHuman: [] };
  const akuso = payload.akusoExpansion || { capabilities: [], evalSuites: [] };
  const economics = payload.unitEconomics || { summary: {}, instrumentationGaps: [], topLevers: [] };
  const partner = payload.partnerPackages || { renewals: [], sponsorPackage: {} };
  const governance = payload.expansionGovernance || { controlMap: [], decisions: [] };
  const nextRoadmap = payload.nextRoadmap || { secondaryBets: [], rankedCandidates: [] };
  const platform = payload.platform || { objectModel: [], creatorBusinessSuite: [], fanRelationshipModel: [] };

  return (
    <>
      <section className="adminx-panel adminx-panel--span-12" data-testid="expansion-platform-operating-system">
        <div className="adminx-panel-head">
          <div>
            <h2 className="adminx-panel-title">Expansion & Platform Operating System</h2>
            <span className="adminx-section-meta">Twenty roadmap packages connect creator self-service, attribution, cohorts, economics, governed automation, shared objects, and the launch planner.</span>
          </div>
          <span className={statusClass(summary.unitEconomicsCompleteness)}>{label(summary.unitEconomicsCompleteness || "partial")} economics</span>
        </div>
        <div className="adminx-ops-grid">
          <div className="adminx-ops-metric"><span>Packages complete</span><strong>{number(summary.roadmapPackagesComplete)}</strong></div>
          <div className="adminx-ops-metric"><span>Active creator plans</span><strong>{number(summary.activeCreatorPlans)}</strong></div>
          <div className="adminx-ops-metric"><span>Referral links</span><strong>{number(summary.referralLinks)}</strong></div>
          <div className="adminx-ops-metric"><span>Active cohorts</span><strong>{number(summary.activeExpansionCohorts)}</strong></div>
          <div className="adminx-ops-metric"><span>Running experiments</span><strong>{number(summary.runningExperiments)}</strong></div>
          <div className="adminx-ops-metric"><span>Next focus</span><strong>{label(summary.nextPrimaryFocus)}</strong></div>
        </div>
        <div className="adminx-pill-row">
          {(payload.roadmapPackages || []).map((item) => <span key={item.key} className={statusClass(item.status)} title={item.title}>{item.key} · {label(item.status)}</span>)}
        </div>
      </section>

      <section className="adminx-panel adminx-panel--span-7">
        <div className="adminx-panel-head"><h2 className="adminx-panel-title">Creator Playbooks & Launch Plans</h2><span className={statusClass(playbooks.summary?.reviewRequired ? "review" : "ready")}>{number(playbooks.summary?.reviewRequired)} awaiting review</span></div>
        <div className="adminx-pill-row">{(playbooks.catalog || []).map((item) => <span key={item.key} className="adminx-badge">{item.title}</span>)}</div>
        <div className="adminx-alert-list">
          {(playbooks.plans || []).slice(0, 6).map((plan) => (
            <button key={plan.id} type="button" className="adminx-alert-item" onClick={() => navigate("/admin/creators")}>
              <div className="adminx-row"><strong>{plan.title}</strong><span className={statusClass(plan.status)}>{label(plan.status)}</span></div>
              <div className="adminx-muted">{label(plan.playbookType)} · {label(plan.offerType)} · {money(plan.price, plan.currency)}</div>
              <div className="adminx-muted">Risk {label(plan.riskLevel)} · blockers {(plan.blockers || []).join(", ") || "none"}</div>
            </button>
          ))}
          {!(playbooks.plans || []).length ? <div className="adminx-empty">No creator launch plans yet. Creators can now use all six playbooks from the dashboard.</div> : null}
        </div>
      </section>

      <section className="adminx-panel adminx-panel--span-5">
        <div className="adminx-panel-head"><h2 className="adminx-panel-title">Privacy-Safe Referral Funnel</h2><span className="adminx-section-meta">Aggregate only</span></div>
        <div className="adminx-ops-grid">
          <div className="adminx-ops-metric"><span>Invites</span><strong>{number(referrals.summary?.inviteSent)}</strong></div>
          <div className="adminx-ops-metric"><span>Opens</span><strong>{number(referrals.summary?.linkOpened)}</strong></div>
          <div className="adminx-ops-metric"><span>First follows</span><strong>{number(referrals.summary?.firstFollow)}</strong></div>
          <div className="adminx-ops-metric"><span>Paid starts</span><strong>{number(Number(referrals.summary?.firstPurchase || 0) + Number(referrals.summary?.firstSubscription || 0))}</strong></div>
        </div>
        <div className="adminx-pill-row">{(referrals.bySource || []).map((source) => <span key={source.sourceType} className="adminx-badge">{label(source.sourceType)} {number(source.linkOpened)}</span>)}</div>
        <div className="adminx-muted">Fan-level rows exposed: {referrals.privacyBoundary?.userIdsExposed ? "yes" : "no"}. Actor deduplication uses one-way hashes.</div>
      </section>

      <section className="adminx-panel adminx-panel--span-6">
        <div className="adminx-panel-head"><h2 className="adminx-panel-title">Experiments & Event Contracts</h2><span className="adminx-section-meta">{number(data.metricContracts?.length)} metric contracts</span></div>
        <div className="adminx-pill-row">{(data.eventTaxonomy || []).map((contract) => <span key={contract.domain} className={statusClass(contract.observed ? "ready" : "watch")}>{label(contract.domain)} · {number(contract.observed)}</span>)}</div>
        <div className="adminx-alert-list">
          {(data.experiments || []).slice(0, 5).map((experiment) => <div key={experiment.id} className="adminx-alert-item"><div className="adminx-row"><strong>{experiment.name}</strong><span className={statusClass(experiment.status)}>{label(experiment.status)}</span></div><div className="adminx-muted">{experiment.primaryMetric} · quality {label(experiment.dataQualityState)} · assignments {number(experiment.observedAssignments)}</div></div>)}
          {!(data.experiments || []).length ? <div className="adminx-empty">No governed experiments yet. Running requires ready data quality and at least one guardrail.</div> : null}
        </div>
      </section>

      <section className="adminx-panel adminx-panel--span-6">
        <div className="adminx-panel-head"><h2 className="adminx-panel-title">Expansion Cohort Reviews</h2><span className="adminx-section-meta">Weekly stop-condition review</span></div>
        <div className="adminx-alert-list">
          {(cohorts.reviews || []).map((review) => <div key={review.betKey} className="adminx-alert-item"><div className="adminx-row"><strong>{label(review.betKey)}</strong><span className={statusClass(review.decision)}>{label(review.decision)}</span></div><div className="adminx-muted">{review.rationale}</div><div className="adminx-muted">Evidence: {label(review.evidenceState)} · owner {review.ownerName || "unassigned"}</div></div>)}
          {!(cohorts.reviews || []).length ? <div className="adminx-empty">No controlled-launch cohort is eligible for review yet.</div> : null}
        </div>
      </section>

      <section className="adminx-panel adminx-panel--span-7">
        <div className="adminx-panel-head"><h2 className="adminx-panel-title">Unit Economics & Operating Leverage</h2><span className={statusClass(economics.summary?.completenessState)}>{label(economics.summary?.completenessState || "partial")}</span></div>
        <div className="adminx-ops-grid">
          <div className="adminx-ops-metric"><span>Gross paid revenue</span><strong>{money(economics.summary?.grossRevenue)}</strong></div>
          <div className="adminx-ops-metric"><span>Known creator earnings</span><strong>{money(economics.summary?.knownCreatorEarnings)}</strong></div>
          <div className="adminx-ops-metric"><span>Payment fees</span><strong>{money(economics.summary?.paymentFees)}</strong></div>
          <div className="adminx-ops-metric"><span>Known contribution</span><strong>{money(economics.summary?.knownContribution)}</strong></div>
        </div>
        <div className="adminx-alert-list">{(economics.topLevers || []).map((lever) => <div key={lever.key} className="adminx-alert-item"><strong>{label(lever.key)}</strong><div className="adminx-muted">{lever.action}</div></div>)}</div>
        {(economics.instrumentationGaps || []).length ? <div className="adminx-muted">Gaps: {economics.instrumentationGaps.join(" ")}</div> : null}
      </section>

      <section className="adminx-panel adminx-panel--span-5">
        <div className="adminx-panel-head"><h2 className="adminx-panel-title">Fan Relationship Model</h2><span className={statusClass(relationships.summary?.suppressed ? "watch" : "ready")}>{number(relationships.summary?.suppressed)} suppressed</span></div>
        <div className="adminx-pill-row">{(relationships.stages || []).map((stage) => <span key={stage.key} className="adminx-badge">{label(stage.key)} {number(stage.count)}</span>)}</div>
        <div className="adminx-muted">Aggregate stages guide reminders, referrals, recommendations, renewal recovery, and suppression without exposing private fan behavior.</div>
      </section>

      <section className="adminx-panel adminx-panel--span-6">
        <div className="adminx-panel-head"><h2 className="adminx-panel-title">Reviewable Automation & Akuso</h2><span className={statusClass(summary.pendingAutomationReviews ? "review" : "ready")}>{number(summary.pendingAutomationReviews)} pending</span></div>
        <div className="adminx-pill-row">{(akuso.capabilities || []).map((capability) => <span key={capability.key} className={statusClass(capability.reviewRequired ? "review" : "ready")}>{label(capability.key)}</span>)}</div>
        <div className="adminx-alert-list">{(automation.suggestions || []).slice(0, 5).map((suggestion) => <div key={suggestion.id} className="adminx-alert-item"><div className="adminx-row"><strong>{suggestion.title}</strong><span className={statusClass(suggestion.status)}>{label(suggestion.status)}</span></div><div className="adminx-muted">Confidence {Math.round(Number(suggestion.confidence || 0) * 100)}% · execution authority none</div></div>)}</div>
        <button type="button" className="adminx-link-btn adminx-link-btn--inline" onClick={() => navigate("/admin/assistant")}>Review Akuso quality</button>
      </section>

      <section className="adminx-panel adminx-panel--span-6">
        <div className="adminx-panel-head"><h2 className="adminx-panel-title">Partner Renewal & Sponsor Package</h2><span className="adminx-section-meta">Aggregate, labeled, reversible</span></div>
        <div className="adminx-alert-list">{(partner.renewals || []).slice(0, 5).map((renewal) => <div key={renewal.pilotKey} className="adminx-alert-item"><div className="adminx-row"><strong>{renewal.name}</strong><span className={statusClass(renewal.renewalReadiness)}>{label(renewal.renewalReadiness)}</span></div><div className="adminx-muted">{renewal.sponsored ? renewal.disclosureLabel || "Disclosure missing" : "Partner pilot"} · review {renewal.reviewAt ? new Date(renewal.reviewAt).toLocaleDateString() : "not set"}</div></div>)}</div>
        <div className="adminx-muted">Sponsor controls: {(partner.sponsorPackage?.controls || []).map(label).join(", ")}.</div>
      </section>

      <section className="adminx-panel adminx-panel--span-6">
        <div className="adminx-panel-head"><h2 className="adminx-panel-title">Expansion Governance</h2><span className={statusClass(summary.governanceReviewsDue ? "review" : "ready")}>{number(summary.governanceReviewsDue)} due</span></div>
        <div className="adminx-pill-row">{(governance.controlMap || []).map((control) => <span key={control.workflowType} className={statusClass(control.riskLevel)}>{label(control.workflowType)} · {label(control.riskLevel)}</span>)}</div>
        <div className="adminx-alert-list">{(governance.decisions || []).slice(0, 5).map((decision) => <div key={decision.id} className="adminx-alert-item"><div className="adminx-row"><strong>{decision.title}</strong><span className={statusClass(decision.status)}>{label(decision.status)}</span></div><div className="adminx-muted">Missing roles: {(decision.missingReviewRoles || []).join(", ") || "none"} · expires {decision.expiresAt ? new Date(decision.expiresAt).toLocaleDateString() : "not set"}</div></div>)}</div>
      </section>

      <section className="adminx-panel adminx-panel--span-6">
        <div className="adminx-panel-head"><h2 className="adminx-panel-title">Next Expansion Roadmap</h2><span className="adminx-section-meta">Leadership confirmation required</span></div>
        <div className="adminx-ops-metric"><span>Primary focus</span><strong>{label(nextRoadmap.primaryFocus)}</strong></div>
        <div className="adminx-pill-row">{(nextRoadmap.secondaryBets || []).map((item) => <span key={item} className="adminx-badge">Secondary · {label(item)}</span>)}</div>
        <div className="adminx-muted">Not now: {(nextRoadmap.notNow || []).map(label).join(", ") || "none"}.</div>
      </section>

      <section className="adminx-panel adminx-panel--span-12">
        <div className="adminx-panel-head"><h2 className="adminx-panel-title">Shared Platform Objects</h2><span className="adminx-section-meta">One authority and state vocabulary per repeated workflow</span></div>
        <div className="adminx-alert-list adminx-alert-list--inline">{(platform.objectModel || []).map((object) => <div key={object.key} className="adminx-alert-item"><strong>{label(object.key)}</strong><div className="adminx-muted">Authority: {object.authority}</div><div className="adminx-muted">States: {(object.statuses || []).map(label).join(", ")}</div></div>)}</div>
      </section>
    </>
  );
}
