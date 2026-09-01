const number = (value = 0) => new Intl.NumberFormat("en-NG").format(Number(value || 0));

const label = (value = "") => String(value || "")
  .replace(/_/g, " ")
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const statusClass = (status = "") => {
  const normalized = String(status || "").toLowerCase();
  if (["complete", "active", "approved", "evidence_review_ready", "default_review_ready", "recovery_objectives_approved"].includes(normalized)) {return "adminx-badge adminx-badge--good";}
  if (["pilot", "watch", "hold_or_controlled_pilot", "define_or_continue_pilots", "objectives_incomplete", "waiting_on_internal_review"].includes(normalized)) {return "adminx-badge adminx-badge--warn";}
  if (["blocked", "paused", "rolled_back", "retired", "failed", "stale"].includes(normalized)) {return "adminx-badge adminx-badge--bad";}
  return "adminx-badge";
};

export default function AutomationOrchestrationOperatingPanels({ payload = {} }) {
  const summary = payload.summary || {};
  const automation = payload.automation || { summary: {}, entries: [], runs: [] };
  const orchestration = payload.orchestration || { summary: {}, definitions: [], runs: [] };
  const resilience = payload.resilience || { summary: {}, catalog: [] };
  const readiness = payload.readiness || {};

  return (
    <>
      <section className="adminx-panel adminx-panel--span-12" data-testid="automation-orchestration-operating-system">
        <div className="adminx-panel-head">
          <div>
            <h2 className="adminx-panel-title">Automation, Orchestration & Recovery Controls</h2>
            <span className="adminx-section-meta">30 implemented packages with human gates, expiring overrides, visible pauses, and tested rollback requirements</span>
          </div>
          <span className={statusClass(summary.orchestrationDecision)}>{label(summary.orchestrationDecision)}</span>
        </div>
        <div className="adminx-ops-grid">
          <div className="adminx-ops-metric"><span>Packages complete</span><strong>{number(summary.roadmapPackagesComplete)}</strong></div>
          <div className="adminx-ops-metric"><span>Automation pilots</span><strong>{number(summary.automationPilots)}</strong></div>
          <div className="adminx-ops-metric"><span>Active automations</span><strong>{number(summary.activeAutomations)}</strong></div>
          <div className="adminx-ops-metric"><span>Workflow definitions</span><strong>{number(summary.workflowDefinitions)}</strong></div>
          <div className="adminx-ops-metric"><span>Blocking dependencies</span><strong>{number(summary.blockingDependencies)}</strong></div>
          <div className="adminx-ops-metric"><span>Approved recovery objectives</span><strong>{number(summary.approvedResilienceObjectives)}</strong></div>
        </div>
        <div className="adminx-pill-row">
          {(payload.roadmapPackages || []).map((item) => <span key={item.key} className={statusClass(item.status)} title={item.title}>{item.key} - {label(item.status)}</span>)}
        </div>
      </section>

      <section className="adminx-panel adminx-panel--span-6">
        <div className="adminx-panel-head">
          <h2 className="adminx-panel-title">Automation Control Plane</h2>
          <span className={statusClass(readiness.automation?.decision)}>{label(readiness.automation?.decision)}</span>
        </div>
        <div className="adminx-ops-grid">
          <div className="adminx-ops-metric"><span>Registered</span><strong>{number(automation.summary?.registered)}</strong></div>
          <div className="adminx-ops-metric"><span>Runs observed</span><strong>{number(automation.summary?.runCount)}</strong></div>
          <div className="adminx-ops-metric"><span>Override rate</span><strong>{Math.round(Number(automation.summary?.overrideRate || 0) * 100)}%</strong></div>
          <div className="adminx-ops-metric"><span>Guardrail breaches</span><strong>{number(automation.summary?.guardrailBreaches)}</strong></div>
        </div>
        <div className="adminx-alert-list">
          {(automation.entries || []).slice(0, 10).map((entry) => (
            <div key={entry.id} className="adminx-alert-item">
              <div className="adminx-row"><strong>{entry.title}</strong><span className={statusClass(entry.state)}>{label(entry.state)}</span></div>
              <div className="adminx-muted">{label(entry.riskClass)} - rollout {number(entry.rolloutPercent)}% - {label(entry.executionAuthority)}</div>
            </div>
          ))}
        </div>
        {!automation.entries?.length ? <div className="adminx-empty">No governed automation pilot evidence is configured in this environment.</div> : null}
        <div className="adminx-muted">{automation.truthBoundary}</div>
      </section>

      <section className="adminx-panel adminx-panel--span-6">
        <div className="adminx-panel-head">
          <h2 className="adminx-panel-title">Workflow State & Dependencies</h2>
          <span className={statusClass(readiness.orchestration?.decision)}>{label(readiness.orchestration?.decision)}</span>
        </div>
        <div className="adminx-ops-grid">
          <div className="adminx-ops-metric"><span>Configured</span><strong>{number(orchestration.summary?.configured)}</strong></div>
          <div className="adminx-ops-metric"><span>Default recipes</span><strong>{number(orchestration.summary?.defaults)}</strong></div>
          <div className="adminx-ops-metric"><span>Active runs</span><strong>{number(orchestration.summary?.activeRuns)}</strong></div>
          <div className="adminx-ops-metric"><span>Stale workflows</span><strong>{number(orchestration.summary?.staleWorkflows)}</strong></div>
        </div>
        <div className="adminx-alert-list">
          {(orchestration.runs || []).slice(0, 10).map((run) => (
            <div key={run.id} className="adminx-alert-item">
              <div className="adminx-row"><strong>{label(run.workflowKey)}</strong><span className={statusClass(run.currentState)}>{label(run.currentState)}</span></div>
              <div className="adminx-muted">Waiting on {run.waitingOn} - {(run.dependencies || []).filter((dependency) => dependency.blocking).length} blocking dependencies</div>
            </div>
          ))}
        </div>
        {!orchestration.runs?.length ? <div className="adminx-empty">No workflow run outcome has been observed; registry definitions do not count as operating success.</div> : null}
        <div className="adminx-muted">{orchestration.truthBoundary}</div>
      </section>

      <section className="adminx-panel adminx-panel--span-6">
        <div className="adminx-panel-head">
          <h2 className="adminx-panel-title">Critical-Flow Recovery Objectives</h2>
          <span className={statusClass(readiness.resilience?.decision)}>{label(readiness.resilience?.decision)}</span>
        </div>
        <div className="adminx-ops-grid">
          <div className="adminx-ops-metric"><span>Configured</span><strong>{number(resilience.summary?.configured)} / {number(resilience.summary?.required)}</strong></div>
          <div className="adminx-ops-metric"><span>Approved</span><strong>{number(resilience.summary?.approved)}</strong></div>
          <div className="adminx-ops-metric"><span>Watch</span><strong>{number(resilience.summary?.watch)}</strong></div>
          <div className="adminx-ops-metric"><span>Blocked</span><strong>{number(resilience.summary?.blocked)}</strong></div>
        </div>
        <div className="adminx-alert-list">
          {(resilience.catalog || []).slice(0, 15).map((flow) => (
            <div key={flow.key} className="adminx-alert-item">
              <div className="adminx-row"><strong>{label(flow.key)}</strong><span className={statusClass(flow.objective?.status || "not_configured")}>{label(flow.objective?.status || "not_configured")}</span></div>
              <div className="adminx-muted">Recovery priority {flow.objective?.recoveryPriority || flow.defaultRecoveryPriority} - owner {flow.objective?.ownerRole || flow.defaultOwnerRole}</div>
            </div>
          ))}
        </div>
        <div className="adminx-muted">{resilience.truthBoundary}</div>
      </section>

      <section className="adminx-panel adminx-panel--span-6">
        <div className="adminx-panel-head"><h2 className="adminx-panel-title">Readiness & Akuso Boundaries</h2></div>
        <div className="adminx-alert-list">
          {[...(readiness.automation?.blockers || []), ...(readiness.orchestration?.blockers || []), ...(readiness.resilience?.blockers || [])].map((blocker) => (
            <div key={blocker} className="adminx-alert-item"><strong>{label(blocker)}</strong><div className="adminx-muted">Stored evidence or named approval is still required.</div></div>
          ))}
        </div>
        <div className="adminx-muted">Akuso can explain state, summarize blockers, and draft reviewed packets. It cannot approve transitions, bypass dependencies, publish external updates, or execute sensitive actions.</div>
        <div className="adminx-muted">{readiness.externalUseBoundary}</div>
      </section>
    </>
  );
}
