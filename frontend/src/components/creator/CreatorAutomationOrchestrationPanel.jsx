import { useState } from "react";

import { updateCreatorAutomationRunControl, updateCreatorWorkflowRunControl } from "../../api";

const label = (value = "") => String(value || "")
  .replace(/_/g, " ")
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const tomorrow = () => new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString();

export default function CreatorAutomationOrchestrationPanel({ payload = {}, onRefresh }) {
  const [savingId, setSavingId] = useState("");
  const [notice, setNotice] = useState("");
  const automations = Array.isArray(payload.automations) ? payload.automations : [];
  const workflows = Array.isArray(payload.workflows) ? payload.workflows : [];

  const saveControl = async (kind, run, state, extra = {}) => {
    if (!run?.id || savingId) {return;}
    setSavingId(run.id);
    setNotice("");
    try {
      const update = kind === "automation" ? updateCreatorAutomationRunControl : updateCreatorWorkflowRunControl;
      await update(run.id, { state, ...extra });
      setNotice(state === "help_requested" ? "A help request was recorded." : "Your workflow preference was saved.");
      await onRefresh?.();
    } catch (error) {
      setNotice(error?.message || "Could not save your workflow preference.");
    } finally {
      setSavingId("");
    }
  };

  if (!automations.length && !workflows.length) {
    return (
      <section className="creator-panel" data-testid="creator-automation-orchestration-panel">
        <div className="creator-panel-head"><div><h2>Workflow status</h2><p>Clear, optional automation and end-to-end workflow updates.</p></div></div>
        <div className="creator-empty-card">No governed automation or workflow is active for your account. Tengacion will not invent progress or blockers.</div>
        <small>{payload.authorityBoundary}</small>
      </section>
    );
  }

  return (
    <section className="creator-panel" data-testid="creator-automation-orchestration-panel">
      <div className="creator-panel-head">
        <div><h2>Workflow status</h2><p>See what happened, what is waiting, and the next safe step. You can snooze, hide, or request help.</p></div>
        <span className="creator-status-badge neutral">{Number(payload.summary?.activeWorkflows || 0)} active</span>
      </div>
      {notice ? <div className="creator-empty-card" role="status">{notice}</div> : null}

      <div className="creator-launch-plan-list">
        {automations.map((run) => (
          <article key={run.id} className="creator-launch-plan-card">
            <div>
              <strong>{label(run.automationKey)}</strong>
              <p>{run.userVisibleMessage}</p>
              <small>{label(run.status)} - {label(run.riskClass)} - owner {run.ownerName || run.ownerRole}</small>
              <details><summary>Why am I seeing this?</summary><p>{run.triggerSummary}</p><small>Signals: {(run.sourceSignals || []).map((signal) => label(signal.key)).join(", ") || "No source signal listed"}</small></details>
            </div>
            <div className="creator-launch-plan-actions">
              <button type="button" className="creator-chip-link" disabled={savingId === run.id} onClick={() => saveControl("automation", run, "dismissed", { feedback: "not_relevant" })}>Dismiss</button>
              <button type="button" className="creator-chip-link" disabled={savingId === run.id} onClick={() => saveControl("automation", run, "snoozed", { snoozedUntil: tomorrow() })}>Snooze 1 day</button>
              <button type="button" className="creator-secondary-btn" disabled={savingId === run.id} onClick={() => saveControl("automation", run, "help_requested", { feedback: "needs_help" })}>Request help</button>
            </div>
          </article>
        ))}
        {workflows.map((run) => (
          <article key={run.id} className="creator-launch-plan-card">
            <div>
              <strong>{label(run.workflowKey)}</strong>
              <p>{run.userVisibleStatus}</p>
              <small>{label(run.currentState)} - waiting on {run.waitingOn} - owner {run.ownerName || run.ownerRole}</small>
              <p><strong>Next step:</strong> {run.nextStep}</p>
              {(run.dependencies || []).filter((dependency) => dependency.blocking).map((dependency) => <small key={dependency.type}>{label(dependency.type)}: {dependency.userVisibleCopy}</small>)}
            </div>
            <div className="creator-launch-plan-actions">
              <button type="button" className="creator-chip-link" disabled={savingId === run.id} onClick={() => saveControl("workflow", run, "snoozed", { snoozedUntil: tomorrow() })}>Snooze 1 day</button>
              <button type="button" className="creator-chip-link" disabled={savingId === run.id} onClick={() => saveControl("workflow", run, "hidden")}>Hide</button>
              <button type="button" className="creator-secondary-btn" disabled={savingId === run.id} onClick={() => saveControl("workflow", run, "help_requested")}>Request help</button>
            </div>
          </article>
        ))}
      </div>
      <small>{payload.privacyBoundary}</small>
      <small>{payload.authorityBoundary}</small>
    </section>
  );
}
