const number = (value = 0) => new Intl.NumberFormat("en-NG").format(Number(value || 0));

const label = (value = "") => String(value || "")
  .replace(/_/g, " ")
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const statusClass = (status = "") => {
  const normalized = String(status || "").toLowerCase();
  if (["complete", "ready", "active", "running", "observed", "leadership_review_ready"].includes(normalized)) {return "adminx-badge adminx-badge--good";}
  if (["hold", "review", "watch", "partial", "hold_for_evidence", "hold_or_repeat_with_measurement", "pause_and_review"].includes(normalized)) {return "adminx-badge adminx-badge--warn";}
  if (["blocked", "expired", "exit", "error"].includes(normalized)) {return "adminx-badge adminx-badge--bad";}
  return "adminx-badge";
};

export default function EcosystemNetworkOperatingPanels({ payload = {} }) {
  const summary = payload.summary || {};
  const platform = payload.platform || {};
  const ecosystem = payload.ecosystem || {};
  const services = ecosystem.creatorServices || { summary: {}, programs: [], enrollments: [] };
  const loops = ecosystem.communityLoops || { summary: {}, catalog: [], programs: [] };
  const partners = ecosystem.partnerIntegrations || { summary: {}, integrations: [] };
  const markets = ecosystem.marketReadiness || { summary: {}, markets: [] };
  const network = payload.network?.creatorBusinessNetworkModel || {};
  const readiness = payload.readiness || {};

  return (
    <>
      <section className="adminx-panel adminx-panel--span-12" data-testid="ecosystem-network-operating-system">
        <div className="adminx-panel-head">
          <div>
            <h2 className="adminx-panel-title">Platform, Ecosystem & Network Operating System</h2>
            <span className="adminx-section-meta">25 completed packages · evidence-bounded operating controls</span>
          </div>
          <span className={statusClass(summary.ecosystemDecision)}>{label(summary.ecosystemDecision)}</span>
        </div>
        <div className="adminx-ops-grid">
          <div className="adminx-ops-metric"><span>Packages complete</span><strong>{number(summary.roadmapPackagesComplete)}</strong></div>
          <div className="adminx-ops-metric"><span>Active creator services</span><strong>{number(summary.activeCreatorServices)}</strong></div>
          <div className="adminx-ops-metric"><span>Running community loops</span><strong>{number(summary.runningCommunityLoops)}</strong></div>
          <div className="adminx-ops-metric"><span>Active partner access</span><strong>{number(summary.activePartnerIntegrations)}</strong></div>
          <div className="adminx-ops-metric"><span>Markets assessed</span><strong>{number(summary.assessedMarkets)}</strong></div>
          <div className="adminx-ops-metric"><span>Network state</span><strong>{label(summary.networkState)}</strong></div>
        </div>
        <div className="adminx-pill-row">
          {(payload.roadmapPackages || []).map((item) => (
            <span key={item.key} className={statusClass(item.status)} title={item.title}>{item.key} · {label(item.status)}</span>
          ))}
        </div>
      </section>

      <section className="adminx-panel adminx-panel--span-6">
        <div className="adminx-panel-head"><h2 className="adminx-panel-title">Creator Service Programs</h2><span className={statusClass(services.summary?.active ? "active" : "not_observed")}>{number(services.summary?.active)} active</span></div>
        <div className="adminx-alert-list">
          {(services.programs || []).map((program) => (
            <div key={program.key} className="adminx-alert-item">
              <div className="adminx-row"><strong>{program.title}</strong><span className={statusClass(program.recommendation)}>{label(program.recommendation)}</span></div>
              <div className="adminx-muted">{number(program.participants)} participants · {number(program.completed)} completed · metric {label(program.successMetric)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="adminx-panel adminx-panel--span-6">
        <div className="adminx-panel-head"><h2 className="adminx-panel-title">Community Loops</h2><span className={statusClass(loops.summary?.pausedByGuardrail ? "review" : "ready")}>{number(loops.summary?.pausedByGuardrail)} guardrail holds</span></div>
        <div className="adminx-pill-row">
          {(loops.catalog || []).map((loop) => <span key={loop.key} className="adminx-badge" title={loop.trustBoundary}>{label(loop.key)}</span>)}
        </div>
        <div className="adminx-alert-list">
          {(loops.programs || []).slice(0, 6).map((program) => (
            <div key={program.loopKey} className="adminx-alert-item"><div className="adminx-row"><strong>{label(program.loopType)}</strong><span className={statusClass(program.guardrailState)}>{label(program.guardrailState)}</span></div><div className="adminx-muted">{label(program.evidenceState)} · {number(program.metrics?.observed)} observed prompts</div></div>
          ))}
        </div>
        <div className="adminx-muted">Aggregate movement only; private fan rows are never exposed.</div>
      </section>

      <section className="adminx-panel adminx-panel--span-6">
        <div className="adminx-panel-head"><h2 className="adminx-panel-title">Partner Access & Market Readiness</h2><span className={statusClass(partners.summary?.pendingPrivacyReview ? "review" : "ready")}>{number(partners.summary?.pendingPrivacyReview)} privacy reviews</span></div>
        <div className="adminx-alert-list">
          {(partners.integrations || []).slice(0, 5).map((integration) => (
            <div key={integration.integrationKey} className="adminx-alert-item"><div className="adminx-row"><strong>{integration.partnerName}</strong><span className={statusClass(integration.accessState)}>{label(integration.accessState)}</span></div><div className="adminx-muted">{label(integration.level)} · consent {integration.creatorConsentRecorded ? "recorded" : "not recorded"}</div></div>
          ))}
          {(markets.markets || []).slice(0, 5).map((market) => (
            <div key={market.marketKey} className="adminx-alert-item"><div className="adminx-row"><strong>{market.marketName}</strong><span className={statusClass(market.state)}>{label(market.state)}</span></div><div className="adminx-muted">{number(market.summary?.ready)} of {number(market.summary?.total)} gates ready · controlled launch {market.controlledLaunchEligible ? "eligible" : "blocked"}</div></div>
          ))}
        </div>
        {!partners.integrations?.length && !markets.markets?.length ? <div className="adminx-empty">No partner access or market readiness record exists in this environment.</div> : null}
      </section>

      <section className="adminx-panel adminx-panel--span-6">
        <div className="adminx-panel-head"><h2 className="adminx-panel-title">Readiness, Margin & Resilience</h2><span className={statusClass(readiness.platform?.decision)}>{label(readiness.platform?.decision)}</span></div>
        <div className="adminx-pill-row">
          {(readiness.platform?.blockers || []).map((blocker) => <span key={blocker} className={statusClass("review")}>{label(blocker)}</span>)}
        </div>
        <div className="adminx-alert-list">
          {(platform.scaleValidation?.drills || []).map((drill) => (
            <div key={drill.key} className="adminx-alert-item"><div className="adminx-row"><strong>{label(drill.key)}</strong><span className={statusClass(drill.evidenceState)}>{label(drill.evidenceState)}</span></div><div className="adminx-muted">Owner {drill.owner} · rollback required</div></div>
          ))}
        </div>
        <div className="adminx-muted">Finance remains an internal operating view until ledger reconciliation is complete.</div>
      </section>

      <section className="adminx-panel adminx-panel--span-12">
        <div className="adminx-panel-head"><h2 className="adminx-panel-title">Creator Business Network Model</h2><span className={statusClass(network.status)}>{label(network.status)}</span></div>
        <div className="adminx-alert-list adminx-alert-list--inline">
          {(network.objects || []).map((object) => <div key={object.key} className="adminx-alert-item"><strong>{label(object.key)}</strong><div className="adminx-muted">Owner: {object.owner}</div><div className="adminx-muted">States: {(object.statuses || []).map(label).join(", ")}</div></div>)}
        </div>
        <div className="adminx-muted">{network.launchBoundary}</div>
      </section>
    </>
  );
}
