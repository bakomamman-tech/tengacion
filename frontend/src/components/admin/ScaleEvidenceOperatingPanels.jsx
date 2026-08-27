const number = (value) => Number(value || 0).toLocaleString();
const label = (value = "") => String(value || "")
  .split("_")
  .filter(Boolean)
  .map((part) => `${part[0]?.toUpperCase() || ""}${part.slice(1)}`)
  .join(" ");

const statusClass = (status = "") => {
  const normalized = String(status || "").toLowerCase();
  if (["blocked", "incident", "hold", "exit", "invest_in_reliability_and_support"].includes(normalized)) {
    return "adminx-badge adminx-badge--danger";
  }
  if (["watch", "degraded", "review", "research", "seed"].includes(normalized)) {
    return "adminx-badge adminx-badge--warn";
  }
  return "adminx-badge adminx-badge--good";
};

const money = (value, currency = "NGN") => {
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value || 0));
  } catch {
    return `${currency} ${number(value)}`;
  }
};

export default function ScaleEvidenceOperatingPanels({ payload = {}, navigate }) {
  const summary = payload.summary || {};
  const calendar = payload.campaignCalendar || { summary: {}, entries: [], missingFourWeekTypes: [] };
  const retention = payload.fanRetention || { summary: {}, byType: {}, interventions: [] };
  const partner = payload.partnerReporting || { privacyBoundary: {}, commerce: {} };
  const copilot = payload.akusoLaunchCopilot || { capabilities: [], evalSuites: [] };
  const slos = payload.sloBudgets || { summary: {}, policies: [] };
  const performance = payload.performanceCost || { summary: {}, instrumentationGaps: [], lowBandwidth: {} };
  const pilots = payload.partnerPilots || { types: [], pilots: [] };
  const governance = payload.governance || { checklists: [] };
  const report = payload.scaleReport || { sections: {}, decision: {} };
  const expansion = payload.expansionScorecard || { bets: [], scoreInputs: [] };

  return (
    <>
      <section className="adminx-panel adminx-panel--span-12" data-testid="scale-evidence-operating-system">
        <div className="adminx-panel-head">
          <div>
            <h2 className="adminx-panel-title">Scale Evidence Operating System</h2>
            <span className="adminx-section-meta">The next ten roadmap packages connect campaigns, retention, partners, SLOs, governance, and expansion gates.</span>
          </div>
          <span className={statusClass(summary.sloExpansionPaused ? "blocked" : "ready")}>{summary.sloExpansionPaused ? "Expansion paused" : "Gated expansion available"}</span>
        </div>
        <div className="adminx-ops-grid">
          <div className="adminx-ops-metric"><span>Packages complete</span><strong>{number(summary.roadmapPackagesComplete)}</strong></div>
          <div className="adminx-ops-metric"><span>Calendar coverage</span><strong>{number(summary.calendarCoveragePercent)}%</strong></div>
          <div className="adminx-ops-metric"><span>Retention candidates</span><strong>{number(summary.retentionCandidates)}</strong></div>
          <div className="adminx-ops-metric"><span>Active pilots</span><strong>{number(summary.activePilots)}</strong></div>
          <div className="adminx-ops-metric"><span>Expansion bets</span><strong>{number(summary.expansionBets)}</strong></div>
          <div className="adminx-ops-metric"><span>90-day decision</span><strong>{label(summary.decision || "pending")}</strong></div>
        </div>
        <div className="adminx-pill-row">
          {(payload.roadmapPackages || []).map((item) => <span key={item.key} className={statusClass(item.status)} title={item.title}>{item.key} · {label(item.status)}</span>)}
        </div>
      </section>

      <section className="adminx-panel adminx-panel--span-7">
        <div className="adminx-panel-head"><h2 className="adminx-panel-title">Four-Week Campaign Calendar</h2><span className={statusClass(calendar.missingFourWeekTypes?.length ? "watch" : "ready")}>{number(calendar.summary?.coveragePercent)}% type coverage</span></div>
        <div className="adminx-alert-list">
          {(calendar.entries || []).slice(0, 5).map((entry) => (
            <button key={entry.id} type="button" className="adminx-alert-item" onClick={() => navigate("/admin/campaigns")}>
              <div className="adminx-row"><strong>{entry.title}</strong><span className={statusClass(entry.readinessState)}>{label(entry.status)}</span></div>
              <div className="adminx-muted">{label(entry.type)} · {entry.audience} · {entry.reportingKey}</div>
              <div className="adminx-muted">Purchases {number(entry.metrics?.purchases)} · subscriptions {number(entry.metrics?.subscriptions)} · refunds {number(entry.metrics?.refunds)}</div>
            </button>
          ))}
          {!(calendar.entries || []).length ? <div className="adminx-empty">No calendar entries yet. The API requires a window, audience, objective, CTA, owner, reporting key, and scoped creator or content.</div> : null}
        </div>
        {(calendar.missingFourWeekTypes || []).length ? <div className="adminx-muted">Missing in the next four weeks: {calendar.missingFourWeekTypes.map((item) => item.title).join(", ")}.</div> : null}
      </section>

      <section className="adminx-panel adminx-panel--span-5">
        <div className="adminx-panel-head"><h2 className="adminx-panel-title">Retention Interventions</h2><span className={statusClass(retention.summary?.suppressed ? "watch" : "ready")}>{number(retention.summary?.suppressed)} suppressed</span></div>
        <div className="adminx-ops-grid">
          <div className="adminx-ops-metric"><span>Candidates</span><strong>{number(retention.summary?.candidates)}</strong></div>
          <div className="adminx-ops-metric"><span>Eligible</span><strong>{number(retention.summary?.eligible)}</strong></div>
        </div>
        <div className="adminx-pill-row">{Object.entries(retention.byType || {}).map(([key, count]) => <span key={key} className="adminx-badge">{label(key)} {number(count)}</span>)}</div>
        <div className="adminx-muted">Every suppressed intervention carries a visible opt-out, complaint, or frequency-cap reason.</div>
      </section>

      <section className="adminx-panel adminx-panel--span-6">
        <div className="adminx-panel-head"><h2 className="adminx-panel-title">Partner-Ready Reporting</h2><span className={statusClass(partner.privacyBoundary?.aggregationOnly ? "ready" : "blocked")}>Aggregate only</span></div>
        <div className="adminx-ops-grid">
          <div className="adminx-ops-metric"><span>GMV</span><strong>{money(partner.commerce?.grossMerchandiseValue)}</strong></div>
          <div className="adminx-ops-metric"><span>Creator earnings</span><strong>{money(partner.commerce?.creatorEarnings)}</strong></div>
          <div className="adminx-ops-metric"><span>Paid orders</span><strong>{number(partner.commerce?.paidOrders)}</strong></div>
          <div className="adminx-ops-metric"><span>Refunds</span><strong>{number(partner.commerce?.refundCount)}</strong></div>
        </div>
        <div className="adminx-muted">Excluded: {(partner.privacyBoundary?.excludedFields || []).join(", ") || "private user, payment, identity, and safety data"}.</div>
      </section>

      <section className="adminx-panel adminx-panel--span-6">
        <div className="adminx-panel-head"><h2 className="adminx-panel-title">Akuso Launch Copilot</h2><span className="adminx-section-meta">{number(copilot.capabilities?.length)} bounded capabilities</span></div>
        <div className="adminx-pill-row">{(copilot.capabilities || []).map((capability) => <span key={capability.key} className={statusClass(capability.reviewRequired ? "review" : "ready")}>{capability.title}</span>)}</div>
        <div className="adminx-muted">{copilot.reviewRule}</div>
        <button type="button" className="adminx-link-btn adminx-link-btn--inline" onClick={() => navigate("/admin/assistant")}>Open assistant quality</button>
      </section>

      <section className="adminx-panel adminx-panel--span-12">
        <div className="adminx-panel-head"><h2 className="adminx-panel-title">Production SLOs And Error Budgets</h2><span className={statusClass(slos.summary?.expansionPaused ? "blocked" : "ready")}>{number(slos.summary?.blocked)} expansion blockers</span></div>
        <div className="adminx-alert-list adminx-alert-list--inline">
          {(slos.policies || []).map((policy) => (
            <button key={policy.key} type="button" className="adminx-alert-item" onClick={() => navigate("/admin/assurance")}>
              <div className="adminx-row"><strong>{policy.title}</strong><span className={statusClass(policy.state)}>{label(policy.state)}</span></div>
              <div className="adminx-muted">Target {number(policy.targetPercent)}% · budget {number(policy.errorBudgetMinutes)} min · consumed {number(policy.consumedPercent)}%</div>
              <div className="adminx-muted">Owner: {policy.owner} · runbook: {policy.runbookKey}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="adminx-panel adminx-panel--span-6">
        <div className="adminx-panel-head"><h2 className="adminx-panel-title">Performance, Cost, Low Bandwidth</h2><span className={statusClass(performance.instrumentationGaps?.length ? "watch" : "ready")}>{number(performance.instrumentationGaps?.length)} gaps</span></div>
        <div className="adminx-ops-grid">
          <div className="adminx-ops-metric"><span>Route latency</span><strong>{number(performance.summary?.averageRouteLatencyMs)} ms</strong></div>
          <div className="adminx-ops-metric"><span>Payload</span><strong>{number(performance.summary?.averagePayloadBytes)} B</strong></div>
          <div className="adminx-ops-metric"><span>Akuso latency</span><strong>{number(performance.summary?.akusoAverageLatencyMs)} ms</strong></div>
          <div className="adminx-ops-metric"><span>Notification sends</span><strong>{number(performance.summary?.notificationSends)}</strong></div>
        </div>
        <div className="adminx-muted">Automatic Save-Data and constrained-network mode prevents media preloading; deterministic Akuso help remains available.</div>
      </section>

      <section className="adminx-panel adminx-panel--span-6">
        <div className="adminx-panel-head"><h2 className="adminx-panel-title">Partner And Sponsor Pilots</h2><span className="adminx-section-meta">{number(pilots.pilots?.length)} pilots</span></div>
        <div className="adminx-alert-list">
          {(pilots.pilots || []).slice(0, 5).map((pilot) => <div key={pilot.id} className="adminx-alert-item"><div className="adminx-row"><strong>{pilot.name}</strong><span className={statusClass(pilot.readinessState)}>{label(pilot.status)}</span></div><div className="adminx-muted">{label(pilot.type)} · {pilot.geography}{pilot.sponsored ? ` · ${pilot.disclosureLabel}` : ""}</div></div>)}
          {!(pilots.pilots || []).length ? <div className="adminx-empty">No pilots yet. Sponsored pilots cannot become ready without a disclosure label.</div> : null}
        </div>
      </section>

      <section className="adminx-panel adminx-panel--span-6">
        <div className="adminx-panel-head"><h2 className="adminx-panel-title">Governance And Compliance</h2><span className="adminx-section-meta">Operational evidence, with counsel boundaries</span></div>
        <div className="adminx-pill-row">{(governance.checklists || []).map((item) => <span key={item.key} className={statusClass(item.state)}>{item.title} · {label(item.state)}</span>)}</div>
        <div className="adminx-muted">{governance.legalBoundary}</div>
      </section>

      <section className="adminx-panel adminx-panel--span-6">
        <div className="adminx-panel-head"><h2 className="adminx-panel-title">90-Day Launch And Scale Report</h2><span className={statusClass(report.decision?.key)}>{label(report.decision?.key || "pending")}</span></div>
        <div className="adminx-muted">{report.decision?.rationale}</div>
        <div className="adminx-pill-row">{Object.keys(report.sections || {}).map((key) => <span key={key} className="adminx-badge">{label(key)}</span>)}</div>
      </section>

      <section className="adminx-panel adminx-panel--span-12">
        <div className="adminx-panel-head"><h2 className="adminx-panel-title">Expansion Scorecard</h2><span className={statusClass(expansion.expansionPaused ? "blocked" : "ready")}>{expansion.expansionPaused ? "Transitions held" : "Evidence-gated"}</span></div>
        <div className="adminx-alert-list adminx-alert-list--inline">
          {(expansion.bets || []).map((bet) => <div key={bet.id} className="adminx-alert-item"><div className="adminx-row"><strong>{bet.name}</strong><span className={statusClass(bet.state)}>{label(bet.state)}</span></div><div className="adminx-muted">{bet.marketOrSegment} · score {number(bet.averageScore)}/5 · recommended {label(bet.recommendedState)}</div><div className="adminx-muted">Cap {money(bet.costCap, bet.currency)} · review {bet.reviewAt ? new Date(bet.reviewAt).toLocaleDateString() : "not set"}</div></div>)}
          {!(expansion.bets || []).length ? <div className="adminx-empty">No expansion bets yet. Each bet requires an owner, cohort, gate, cost cap, metric, stop condition, review date, and all ten score inputs.</div> : null}
        </div>
      </section>
    </>
  );
}
