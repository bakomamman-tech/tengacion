import { useState } from "react";

import { updateCreatorIntelligencePrompt } from "../../api";

const label = (value = "") => String(value || "")
  .replace(/_/g, " ")
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const confidenceLabel = (value) => `${Math.round(Number(value || 0) * 100)}% confidence`;

export default function CreatorNetworkIntelligencePanel({ payload = {}, onRefresh }) {
  const [savingId, setSavingId] = useState("");
  const [notice, setNotice] = useState("");
  const programs = Array.isArray(payload.networkPrograms?.programs)
    ? payload.networkPrograms.programs
    : [];
  const prompts = Array.isArray(payload.intelligence?.prompts)
    ? payload.intelligence.prompts
    : [];

  const updatePrompt = async (prompt, status, feedback = "") => {
    if (!prompt?.id || savingId) {
      return;
    }
    setSavingId(prompt.id);
    setNotice("");
    try {
      await updateCreatorIntelligencePrompt(prompt.id, { status, feedback });
      setNotice(status === "help_requested" ? "A help request was recorded." : "Your preference was saved.");
      await onRefresh?.();
    } catch (error) {
      setNotice(error?.message || "Could not save your preference.");
    } finally {
      setSavingId("");
    }
  };

  return (
    <section className="creator-panel" data-testid="creator-network-intelligence-panel">
      <div className="creator-panel-head">
        <div>
          <h2>Network & intelligence</h2>
          <p>Optional, explainable suggestions and consented network programs. You stay in control of every action.</p>
        </div>
        <span className="creator-status-badge neutral">
          {Number(payload.intelligence?.summary?.available || 0)} available
        </span>
      </div>

      {notice ? <div className="creator-empty-card" role="status">{notice}</div> : null}

      {prompts.length ? (
        <div className="creator-launch-plan-list">
          {prompts.map((prompt) => (
            <article key={prompt.id} className="creator-launch-plan-card">
              <div>
                <strong>{prompt.title}</strong>
                <p>{prompt.explanation}</p>
                <small>
                  {prompt.sourceLabel} · {prompt.timeframeLabel} · {confidenceLabel(prompt.confidence)}
                </small>
                <details>
                  <summary>Why am I seeing this?</summary>
                  <p>{prompt.limitations}</p>
                  <small>Sources: {(prompt.sourceMetricKeys || []).map(label).join(", ") || "No source contract listed"}</small>
                </details>
                <p><strong>Optional next step:</strong> {prompt.suggestedAction}</p>
              </div>
              <div className="creator-launch-plan-actions">
                <button
                  type="button"
                  className="creator-chip-link"
                  disabled={savingId === prompt.id}
                  onClick={() => updatePrompt(prompt, "dismissed")}
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  className="creator-chip-link"
                  disabled={savingId === prompt.id}
                  onClick={() => updatePrompt(prompt, "dismissed", "not_relevant")}
                >
                  Not relevant
                </button>
                <button
                  type="button"
                  className="creator-secondary-btn"
                  disabled={savingId === prompt.id}
                  onClick={() => updatePrompt(prompt, "help_requested", "needs_explanation")}
                >
                  Request help
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="creator-empty-card">
          No governed intelligence suggestion is available. Tengacion will not fill this space with guessed benchmarks or private fan data.
        </div>
      )}

      <div className="creator-panel-head creator-panel-head--compact">
        <div>
          <h2>Consented network programs</h2>
          <p>Every active program has a named owner, review date, outcome measure, and withdrawal path.</p>
        </div>
      </div>

      {programs.length ? (
        <div className="creator-launch-plan-list">
          {programs.map((program) => (
            <article key={program.id} className="creator-launch-plan-card">
              <div>
                <strong>{label(program.programType)}</strong>
                <p>{program.creatorBenefit}</p>
                <small>
                  {label(program.status)} · owner {program.ownerName || program.ownerRole} · review {program.reviewAt ? new Date(program.reviewAt).toLocaleDateString() : "not set"}
                </small>
              </div>
              <span className={`creator-status-badge ${program.creatorConsentRecorded ? "success" : "warning"}`}>
                {program.creatorConsentRecorded ? "Consented" : "Consent pending"}
              </span>
            </article>
          ))}
        </div>
      ) : (
        <div className="creator-empty-card">
          You are not enrolled in a creator business network program. Participation is never automatic.
        </div>
      )}

      <small>{payload.privacyBoundary}</small>
    </section>
  );
}
