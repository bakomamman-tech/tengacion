const number = (value = 0) => new Intl.NumberFormat("en-NG").format(Number(value || 0));

const label = (value = "") => String(value || "")
  .replace(/_/g, " ")
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const statusClass = (status = "") => {
  const value = String(status || "").toLowerCase();
  if (["complete", "approved", "ready", "leadership_review_ready", "external_review_candidate", "pass", "passed", "current"].includes(value)) {return "adminx-badge adminx-badge--good";}
  if (["watch", "scheduled", "needs_review", "hold_for_evidence", "hold_for_assurance_evidence", "internal_remediation_required", "pass_with_observation"].includes(value)) {return "adminx-badge adminx-badge--warn";}
  if (["critical", "blocked", "failed", "fail", "withdrawn", "rollback_required", "stale", "disputed"].includes(value)) {return "adminx-badge adminx-badge--bad";}
  return "adminx-badge";
};

export default function ResilienceAssuranceAuditOperatingPanels({ payload = {} }) {
  const summary = payload.summary || {};
  const resilience = payload.resilience || { summary: {}, incidents: [], drills: [], gates: [], readinessReport: {} };
  const assurance = payload.assurance || { summary: {}, controls: [], evidencePacks: [], monitoringAlerts: [], operatingReport: {} };
  const audit = payload.audit || { summary: {}, domains: [], tests: [], findings: [], findingsReport: {} };

  return (
    <>
      <section className="adminx-panel adminx-panel--span-12" data-testid="resilience-assurance-audit-operating-system">
        <div className="adminx-panel-head">
          <div>
            <h2 className="adminx-panel-title">Resilience, Assurance & Audit Evidence</h2>
            <span className="adminx-section-meta">40 implemented packages; plans, configured controls, and owner assertions remain separate from observed evidence</span>
          </div>
          <span className={statusClass(summary.operatingDecision)}>{label(summary.operatingDecision)}</span>
        </div>
        <div className="adminx-ops-grid">
          <div className="adminx-ops-metric"><span>Packages complete</span><strong>{number(summary.roadmapPackagesComplete)}</strong></div>
          <div className="adminx-ops-metric"><span>Open incidents</span><strong>{number(summary.openIncidents)}</strong></div>
          <div className="adminx-ops-metric"><span>Drills observed</span><strong>{number(summary.drillsObserved)}</strong></div>
          <div className="adminx-ops-metric"><span>Assurance controls</span><strong>{number(summary.assuranceControls)}</strong></div>
          <div className="adminx-ops-metric"><span>Controls tested</span><strong>{number(summary.auditControlsTested)}</strong></div>
          <div className="adminx-ops-metric"><span>Open findings</span><strong>{number(summary.openAuditFindings)}</strong></div>
        </div>
        <div className="adminx-pill-row">
          {(payload.roadmapPackages || []).map((item) => <span key={item.key} className={statusClass(item.status)} title={item.title}>{item.key}</span>)}
        </div>
      </section>

      <section className="adminx-panel adminx-panel--span-4">
        <div className="adminx-panel-head">
          <h2 className="adminx-panel-title">Incident & Drill Truth</h2>
          <span className={statusClass(resilience.readinessReport?.decision)}>{label(resilience.readinessReport?.decision)}</span>
        </div>
        <div className="adminx-ops-grid">
          <div className="adminx-ops-metric"><span>Critical incidents</span><strong>{number(resilience.summary?.criticalIncidents)}</strong></div>
          <div className="adminx-ops-metric"><span>Planned drills</span><strong>{number(resilience.summary?.drillsPlanned)}</strong></div>
          <div className="adminx-ops-metric"><span>Observed drills</span><strong>{number(resilience.summary?.drillsObserved)}</strong></div>
          <div className="adminx-ops-metric"><span>Approved gates</span><strong>{number(resilience.summary?.gatesApproved)} / 8</strong></div>
        </div>
        <div className="adminx-alert-list">
          {(resilience.incidents || []).slice(0, 6).map((incident) => (
            <div className="adminx-alert-item" key={incident.id}>
              <div className="adminx-row"><strong>{label(incident.incidentClass)}</strong><span className={statusClass(incident.severity)}>{label(incident.severity)}</span></div>
              <div className="adminx-muted">{label(incident.degradedMode)} - owner {incident.ownerName}</div>
            </div>
          ))}
        </div>
        {!resilience.incidents?.length ? <div className="adminx-empty">No incident record is open in this environment.</div> : null}
        <div className="adminx-muted">A scheduled drill is not counted as observed, and a configured SLO is not proof of reliability.</div>
      </section>

      <section className="adminx-panel adminx-panel--span-4">
        <div className="adminx-panel-head">
          <h2 className="adminx-panel-title">Assurance Freshness & Exceptions</h2>
          <span className={statusClass(assurance.operatingReport?.decision)}>{label(assurance.operatingReport?.decision)}</span>
        </div>
        <div className="adminx-ops-grid">
          <div className="adminx-ops-metric"><span>Controls current</span><strong>{number(assurance.summary?.controlsCurrent)} / {number(assurance.summary?.controlsConfigured)}</strong></div>
          <div className="adminx-ops-metric"><span>Evidence packs</span><strong>{number(assurance.summary?.evidencePacks)}</strong></div>
          <div className="adminx-ops-metric"><span>High-risk exceptions</span><strong>{number(assurance.summary?.openHighCriticalExceptions)}</strong></div>
          <div className="adminx-ops-metric"><span>External packs</span><strong>{number(assurance.summary?.externalPacksApproved)}</strong></div>
        </div>
        <div className="adminx-alert-list">
          {(assurance.controls || []).slice(0, 6).map((control) => (
            <div className="adminx-alert-item" key={control.id}>
              <div className="adminx-row"><strong>{label(control.controlKey)}</strong><span className={statusClass(control.evidenceFreshness)}>{label(control.evidenceFreshness)}</span></div>
              <div className="adminx-muted">Owner {control.ownerName} - {label(control.exceptionSeverity)} exception severity</div>
            </div>
          ))}
        </div>
        {!assurance.controls?.length ? <div className="adminx-empty">No environment-specific assurance controls are configured.</div> : null}
        <div className="adminx-muted">Stale, disputed, restricted, or unreviewed evidence cannot support readiness or external sharing.</div>
      </section>

      <section className="adminx-panel adminx-panel--span-4">
        <div className="adminx-panel-head">
          <h2 className="adminx-panel-title">Audit Tests & Remediation</h2>
          <span className={statusClass(audit.findingsReport?.decision)}>{label(audit.findingsReport?.decision)}</span>
        </div>
        <div className="adminx-ops-grid">
          <div className="adminx-ops-metric"><span>Domains tested</span><strong>{number(audit.summary?.domainsTested)}</strong></div>
          <div className="adminx-ops-metric"><span>Controls tested</span><strong>{number(audit.summary?.controlsTested)}</strong></div>
          <div className="adminx-ops-metric"><span>Failed</span><strong>{number(audit.summary?.failed)}</strong></div>
          <div className="adminx-ops-metric"><span>Retest queue</span><strong>{number(audit.summary?.retestQueue)}</strong></div>
        </div>
        <div className="adminx-alert-list">
          {(audit.findings || []).slice(0, 6).map((finding) => (
            <div className="adminx-alert-item" key={finding.id}>
              <div className="adminx-row"><strong>{label(finding.findingKey)}</strong><span className={statusClass(finding.severity)}>{label(finding.severity)}</span></div>
              <div className="adminx-muted">{label(finding.status)} - retest {label(finding.retestState)}</div>
            </div>
          ))}
        </div>
        {!audit.findings?.length ? <div className="adminx-empty">No audit finding has been recorded.</div> : null}
        <div className="adminx-muted">Owner assertion alone cannot close a finding; closure requires independent retest evidence.</div>
      </section>

      <section className="adminx-panel adminx-panel--span-12">
        <div className="adminx-panel-head"><h2 className="adminx-panel-title">Akuso & External-use Boundaries</h2></div>
        <div className="adminx-muted">Akuso may explain verified status, draft evidence packs, and summarize tested counts. It cannot declare recovery, approve a gate, close a finding, accept risk, expose restricted evidence, or publish an external assurance or audit opinion.</div>
        <div className="adminx-muted">{resilience.readinessReport?.externalUseBoundary}</div>
        <div className="adminx-muted">{assurance.operatingReport?.externalUseBoundary}</div>
      </section>
    </>
  );
}
