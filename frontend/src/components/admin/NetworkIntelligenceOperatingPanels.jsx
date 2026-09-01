const number = (value = 0) => new Intl.NumberFormat("en-NG").format(Number(value || 0));

const label = (value = "") => String(value || "")
  .replace(/_/g, " ")
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const statusClass = (status = "") => {
  const normalized = String(status || "").toLowerCase();
  if (["complete", "trusted", "active", "approved", "leadership_review_ready", "registry_established_no_execution"].includes(normalized)) {return "adminx-badge adminx-badge--good";}
  if (["watch", "review_required", "pilot", "hold_or_repeat_with_measurement", "hold_for_trusted_evidence", "registry_ready_for_candidates"].includes(normalized)) {return "adminx-badge adminx-badge--warn";}
  if (["blocked", "stale", "disputed", "revoked", "expired"].includes(normalized)) {return "adminx-badge adminx-badge--bad";}
  return "adminx-badge";
};

export default function NetworkIntelligenceOperatingPanels({ payload = {} }) {
  const summary = payload.summary || {};
  const network = payload.network || {};
  const intelligence = payload.intelligence || {};
  const metrics = intelligence.metricContracts || { summary: {}, contracts: [] };
  const products = intelligence.products || { summary: {}, products: [] };
  const programs = network.programs || { summary: {}, programs: [] };
  const graduation = network.partnerGraduation || { summary: {}, assessments: [] };
  const warnings = intelligence.predictiveOperations || { summary: {}, warnings: [] };
  const registry = payload.automation?.registry || { summary: {}, entries: [] };
  const readiness = payload.readiness || {};

  return (
    <>
      <section className="adminx-panel adminx-panel--span-12" data-testid="network-intelligence-operating-system">
        <div className="adminx-panel-head">
          <div>
            <h2 className="adminx-panel-title">Network, Intelligence & Automation Registry</h2>
            <span className="adminx-section-meta">30 completed packages · trust-bounded and human-governed</span>
          </div>
          <span className={statusClass(summary.intelligenceDecision)}>{label(summary.intelligenceDecision)}</span>
        </div>
        <div className="adminx-ops-grid">
          <div className="adminx-ops-metric"><span>Packages complete</span><strong>{number(summary.roadmapPackagesComplete)}</strong></div>
          <div className="adminx-ops-metric"><span>Active network programs</span><strong>{number(summary.activeNetworkPrograms)}</strong></div>
          <div className="adminx-ops-metric"><span>Trusted metrics</span><strong>{number(summary.trustedMetrics)}</strong></div>
          <div className="adminx-ops-metric"><span>Active intelligence products</span><strong>{number(summary.activeIntelligenceProducts)}</strong></div>
          <div className="adminx-ops-metric"><span>Open warnings</span><strong>{number(summary.openPredictiveWarnings)}</strong></div>
          <div className="adminx-ops-metric"><span>Automations executing</span><strong>{number(registry.summary?.executionEnabled)}</strong></div>
        </div>
        <div className="adminx-pill-row">
          {(payload.roadmapPackages || []).map((item) => (
            <span key={item.key} className={statusClass(item.status)} title={item.title}>{item.key} · {label(item.status)}</span>
          ))}
        </div>
      </section>

      <section className="adminx-panel adminx-panel--span-6">
        <div className="adminx-panel-head">
          <h2 className="adminx-panel-title">Metric Contracts & Trust</h2>
          <span className={statusClass(metrics.summary?.blocked ? "blocked" : "trusted")}>
            {number(metrics.summary?.configured)} / {number(metrics.summary?.required)} configured
          </span>
        </div>
        <div className="adminx-ops-grid">
          <div className="adminx-ops-metric"><span>Trusted</span><strong>{number(metrics.summary?.trusted)}</strong></div>
          <div className="adminx-ops-metric"><span>Watch</span><strong>{number(metrics.summary?.watch)}</strong></div>
          <div className="adminx-ops-metric"><span>Stale</span><strong>{number(metrics.summary?.stale)}</strong></div>
          <div className="adminx-ops-metric"><span>Disputed</span><strong>{number(metrics.summary?.disputed)}</strong></div>
        </div>
        <div className="adminx-alert-list">
          {(metrics.contracts || []).map((contract) => (
            <div key={contract.metricKey} className="adminx-alert-item">
              <div className="adminx-row"><strong>{contract.title}</strong><span className={statusClass(contract.trustState)}>{label(contract.trustState)}</span></div>
              <div className="adminx-muted">{contract.configured ? contract.trustReason : "Contract not configured"} · decision use {contract.canDriveDecision ? "allowed" : "blocked"}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="adminx-panel adminx-panel--span-6">
        <div className="adminx-panel-head">
          <h2 className="adminx-panel-title">Intelligence Products</h2>
          <span className={statusClass(products.summary?.sourceBlocked ? "blocked" : "active")}>{number(products.summary?.active)} active</span>
        </div>
        <div className="adminx-alert-list">
          {(products.products || []).map((product) => (
            <div key={product.productKey} className="adminx-alert-item">
              <div className="adminx-row"><strong>{product.title}</strong><span className={statusClass(product.status)}>{label(product.status)}</span></div>
              <div className="adminx-muted">{label(product.audience)} · quality {label(product.qualityState)} · {number((product.sourceMetricKeys || []).length)} source contracts</div>
            </div>
          ))}
        </div>
      </section>

      <section className="adminx-panel adminx-panel--span-6">
        <div className="adminx-panel-head">
          <h2 className="adminx-panel-title">Creator Network Programs</h2>
          <span className={statusClass(programs.summary?.outcomeReviewed ? "active" : "watch")}>{number(programs.summary?.outcomeReviewed)} outcomes reviewed</span>
        </div>
        <div className="adminx-alert-list">
          {(programs.programs || []).slice(0, 8).map((program) => (
            <div key={program.id} className="adminx-alert-item">
              <div className="adminx-row"><strong>{label(program.programType)}</strong><span className={statusClass(program.status)}>{label(program.status)}</span></div>
              <div className="adminx-muted">Creator {program.creatorProfile} · consent {program.creatorConsentRecorded ? "recorded" : "missing"} · outcome {label(program.outcome?.evidenceState)}</div>
            </div>
          ))}
        </div>
        {!programs.programs?.length ? <div className="adminx-empty">No creator network program is configured in this environment.</div> : null}
      </section>

      <section className="adminx-panel adminx-panel--span-6">
        <div className="adminx-panel-head">
          <h2 className="adminx-panel-title">Partner & API Graduation</h2>
          <span className={statusClass(graduation.summary?.blocked ? "blocked" : "review_required")}>{number(graduation.summary?.active)} active</span>
        </div>
        <div className="adminx-alert-list">
          {(graduation.assessments || []).map((assessment) => (
            <div key={assessment.id} className="adminx-alert-item">
              <div className="adminx-row"><strong>{label(assessment.proposedLevel)}</strong><span className={statusClass(assessment.status)}>{label(assessment.status)}</span></div>
              <div className="adminx-muted">{number(assessment.summary?.ready)} of {number(assessment.summary?.total)} gates ready · human approval {assessment.humanApprovalRecorded ? "recorded" : "missing"}</div>
            </div>
          ))}
        </div>
        <div className="adminx-muted">Partner enthusiasm cannot grant exports, dashboards, campaign scope, sponsor access, or API access.</div>
      </section>

      <section className="adminx-panel adminx-panel--span-6">
        <div className="adminx-panel-head">
          <h2 className="adminx-panel-title">Predictive Operations</h2>
          <span className={statusClass(warnings.summary?.open ? "watch" : "trusted")}>{number(warnings.summary?.open)} open</span>
        </div>
        <div className="adminx-alert-list">
          {(warnings.warnings || []).slice(0, 10).map((warning) => (
            <div key={warning.id} className="adminx-alert-item">
              <div className="adminx-row"><strong>{label(warning.warningType)}</strong><span className={statusClass(warning.status)}>{label(warning.status)}</span></div>
              <div className="adminx-muted">{Math.round(Number(warning.confidence || 0) * 100)}% confidence · owner {warning.ownerName || warning.ownerRole} · warning only</div>
            </div>
          ))}
        </div>
        <div className="adminx-muted">Warnings remain hypotheses until an authoritative source and human review confirm the condition.</div>
      </section>

      <section className="adminx-panel adminx-panel--span-6">
        <div className="adminx-panel-head">
          <h2 className="adminx-panel-title">Automation Registry</h2>
          <span className={statusClass(summary.automationDecision)}>{label(summary.automationDecision)}</span>
        </div>
        <div className="adminx-alert-list">
          {(registry.entries || []).map((entry) => (
            <div key={entry.id} className="adminx-alert-item">
              <div className="adminx-row"><strong>{entry.title}</strong><span className={statusClass(entry.state)}>{label(entry.state)}</span></div>
              <div className="adminx-muted">{label(entry.actionType)} · {label(entry.riskLevel)} risk · visible as {label(entry.userVisibleStatus)} · no execution authority</div>
            </div>
          ))}
        </div>
        <div className="adminx-muted">{registry.launchBoundary}</div>
      </section>

      <section className="adminx-panel adminx-panel--span-12">
        <div className="adminx-panel-head">
          <h2 className="adminx-panel-title">Readiness Decisions</h2>
          <span className={statusClass(readiness.network?.decision)}>{label(readiness.network?.decision)}</span>
        </div>
        <div className="adminx-alert-list adminx-alert-list--inline">
          {[...(readiness.network?.blockers || []), ...(readiness.intelligence?.blockers || [])].map((blocker) => (
            <div key={blocker} className="adminx-alert-item"><strong>{label(blocker)}</strong><div className="adminx-muted">Evidence or owner review required before graduation.</div></div>
          ))}
        </div>
        <div className="adminx-muted">{readiness.externalUseBoundary}</div>
      </section>
    </>
  );
}
