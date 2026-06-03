import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import AdminShell from "../components/AdminShell";
import { adminGetAssuranceDashboard, adminGetCapitalReadiness } from "../api";

const RANGE_OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "year", label: "This year" },
];

const number = (value) => Number(value || 0).toLocaleString();
const percent = (value) => `${Math.round(Number(value || 0) * 100)}%`;
const money = (value = {}) => {
  if (!value || value.amount === null || value.amount === undefined) {
    return "-";
  }
  return `${value.currency || "NGN"} ${number(value.amount)}`;
};

const eventLabel = (value = "") =>
  String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");

const statusClass = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (
    [
      "blocked",
      "rollback_required",
      "critical",
      "high",
      "needs_review",
      "withdrawn",
      "not_ready",
      "restricted",
      "blocked_for_remediation",
      "do_not_contact",
      "restricted_response",
      "withdrawn_response",
    ].includes(normalized)
  ) {
    return "adminx-badge adminx-badge--danger";
  }
  if (
    [
      "watch",
      "medium",
      "delayed",
      "stale",
      "disputed",
      "pending",
      "missing",
      "needs_contract",
      "near_ready",
      "evidence_needed",
      "remediation_needed",
      "conditional",
      "internal_with_conditions",
      "internal_draft",
      "internal_only",
      "cash_balance_required",
      "coverage_gap",
      "not_configured",
      "not_approved_for_external_use",
      "advisor_review_only",
      "hold_for_evidence",
      "draft_needs_evidence",
      "conditional_response",
    ].includes(normalized)
  ) {
    return "adminx-badge adminx-badge--warn";
  }
  return "adminx-badge adminx-badge--good";
};

const dateTime = (value) => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

export default function AdminAssurancePage({ user }) {
  const navigate = useNavigate();
  const [range, setRange] = useState("30d");
  const [payload, setPayload] = useState(null);
  const [capitalPayload, setCapitalPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [assurance, capital] = await Promise.all([
        adminGetAssuranceDashboard({ range }),
        adminGetCapitalReadiness({ range }),
      ]);
      setPayload(assurance);
      setCapitalPayload(capital);
    } catch (err) {
      setError(err?.message || "Failed to load assurance dashboard");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = payload?.summary || {};
  const workstreams = payload?.workstreams || [];
  const controls = payload?.controls || [];
  const evidencePacks = payload?.evidencePacks || [];
  const metricContracts = payload?.metricContracts || [];
  const alerts = payload?.alerts || [];
  const readinessGates = payload?.readinessGates || [];
  const launchCommandCenter = payload?.launchCommandCenter || {};
  const launchSummary = launchCommandCenter.summary || {};
  const launchGates = launchCommandCenter.gates || [];
  const launchRollbackPlans = launchCommandCenter.rollbackPlans || [];
  const launchSupportMacros = launchCommandCenter.supportMacros || [];
  const standard = payload?.evidencePackStandard || {};
  const capitalSummary = capitalPayload?.summary || {};
  const capitalScorecard = capitalPayload?.scorecard || [];
  const runwayScenarios = capitalPayload?.runwayScenarios || [];
  const useOfFundsGates = capitalPayload?.useOfFundsGates || [];
  const claimRegister = capitalPayload?.claimRegister || [];
  const capitalRisks = capitalPayload?.riskRegister || [];
  const dataRoomPackets = capitalPayload?.dataRoomPackets || [];
  const diligencePipeline = capitalPayload?.diligencePipeline || [];
  const diligenceQaWorkflow = capitalPayload?.diligenceQaWorkflow || [];

  const headlineCards = [
    ["Readiness", eventLabel(summary.readinessState || "unknown")],
    ["Control Coverage", percent(summary.controlCoverageRate)],
    ["Current Evidence", `${number(summary.currentEvidenceControls)} / ${number(summary.totalControls)}`],
    ["Evidence Packs", `${number(summary.currentEvidencePackCount)} / ${number(summary.evidencePackCount)}`],
    ["Metric Trust", `${number(summary.trustedMetricContractCount)} / ${number(summary.metricContractCount)}`],
    ["Blockers", number(summary.blockerCount)],
    ["Needs Review", number(summary.needsReviewCount)],
    ["High Severity", number(summary.highSeverityCount)],
  ];

  const capitalCards = [
    [
      "Capital Score",
      capitalSummary.readinessScore === null || capitalSummary.readinessScore === undefined
        ? "-"
        : `${capitalSummary.readinessScore}/100`,
    ],
    ["Recommended Path", capitalSummary.recommendedPath?.title || "-"],
    ["Ready Areas", `${number(capitalSummary.readyCount)} / ${number(capitalSummary.totalScorecardAreas)}`],
    ["Evidence Needed", number(capitalSummary.evidenceNeededCount)],
    ["Capital Blockers", number(capitalSummary.blockerCount)],
    ["Advisor Claims", `${number(capitalSummary.advisorApprovedClaimCount)} / ${number(capitalSummary.claimCount)}`],
    ["Ready Spend Gates", `${number(capitalSummary.readyUseOfFundsGateCount)} / ${number(capitalSummary.useOfFundsGateCount)}`],
    ["Outreach Targets", `${number(capitalSummary.controlledOutreachTargetCount)} / ${number(capitalSummary.diligenceTargetCount)}`],
    ["Q&A Responses", `${number(capitalSummary.approvedDiligenceResponseCount)} / ${number(capitalSummary.diligenceQaCount)}`],
    ["High Capital Risks", number(capitalSummary.highRiskCount)],
  ];

  const launchCards = [
    ["Launch State", eventLabel(launchSummary.overallState || "unknown")],
    ["Expansion Paused", launchSummary.expansionPaused ? "Yes" : "No"],
    ["Ready Gates", `${number(launchSummary.readyCount)} / ${number(launchSummary.totalGates)}`],
    ["Watch Gates", number(launchSummary.watchCount)],
    ["Blocked Gates", number(launchSummary.blockedCount)],
    ["Rollback Required", number(launchSummary.rollbackRequiredCount)],
    ["Reliability", eventLabel(launchSummary.reliabilityOverallStatus || "unknown")],
    ["Active Incidents", number(launchSummary.activeIncidentCount)],
  ];

  return (
    <AdminShell
      title="Assurance"
      subtitle="Control registry, evidence freshness, readiness gates, and owner-visible exceptions for critical Tengacion workflows."
      user={user}
      actions={<button type="button" className="adminx-btn" onClick={load}>Refresh</button>}
    >
      <section className="adminx-panel adminx-panel--span-12">
        <div className="adminx-filter-row">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`adminx-tab ${range === option.value ? "is-active" : ""}`}
              onClick={() => setRange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {error ? <div className="adminx-error">{error}</div> : null}
      {loading ? <div className="adminx-loading">Loading assurance dashboard...</div> : null}

      {!loading && payload ? (
        <>
          <div className="adminx-stats-grid">
            {headlineCards.map(([label, value]) => (
              <article key={label} className="adminx-stat-card">
                <div className="adminx-kpi-label">{label}</div>
                <div className="adminx-kpi-value">{value}</div>
              </article>
            ))}
          </div>

          {launchGates.length ? (
            <>
              <section className="adminx-panel adminx-panel--span-12">
                <div className="adminx-panel-head">
                  <div>
                    <h2 className="adminx-panel-title">Launch Command Center</h2>
                    <span className="adminx-section-meta">
                      Controlled launch gates, rollback coverage, and support macros from the scale roadmap.
                    </span>
                  </div>
                  <span className={statusClass(launchSummary.overallState)}>
                    {eventLabel(launchSummary.overallState || "unknown")}
                  </span>
                </div>
                <div className="adminx-ops-grid">
                  {launchCards.map(([label, value]) => (
                    <div key={label} className="adminx-ops-metric">
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                {launchSummary.pauseReason ? (
                  <div className="adminx-muted">{launchSummary.pauseReason}</div>
                ) : null}
              </section>

              <section className="adminx-panel adminx-panel--span-12">
                <div className="adminx-panel-head">
                  <h2 className="adminx-panel-title">Launch Gates</h2>
                  <span className="adminx-section-meta">{number(launchGates.length)} gates</span>
                </div>
                <div className="adminx-alert-list adminx-alert-list--inline">
                  {launchGates.map((gate) => (
                    <article key={gate.key} className="adminx-alert-item">
                      <div className="adminx-row">
                        <strong>{gate.title}</strong>
                        <span className={statusClass(gate.gateState)}>
                          {eventLabel(gate.gateState)}
                        </span>
                      </div>
                      <div className="adminx-muted">{gate.owner} - reviewer: {gate.reviewer}</div>
                      <div className="adminx-muted">{gate.stateReason}</div>
                      <div className="adminx-pill-row">
                        <span className={statusClass(gate.openIssueCount ? gate.gateState : "ready")}>
                          Issues {number(gate.openIssueCount)}
                        </span>
                        {gate.rollbackPlanTitle ? (
                          <span className="adminx-badge">{gate.rollbackPlanTitle}</span>
                        ) : null}
                      </div>
                      <div className="adminx-muted">{gate.latestEvidenceSummary}</div>
                      <div className="adminx-muted">{gate.nextAction}</div>
                      <button
                        type="button"
                        className="adminx-link-btn adminx-link-btn--inline"
                        onClick={() => navigate(gate.actionPath || "/admin/assurance")}
                      >
                        Open surface
                      </button>
                    </article>
                  ))}
                </div>
              </section>

              <section className="adminx-panel adminx-panel--span-12">
                <div className="adminx-panel-head">
                  <h2 className="adminx-panel-title">Rollback Plans And Support Macros</h2>
                  <span className="adminx-section-meta">
                    {number(launchRollbackPlans.length)} rollback plans - {number(launchSupportMacros.length)} macros
                  </span>
                </div>
                <div className="adminx-alert-list adminx-alert-list--inline">
                  {launchRollbackPlans.map((plan) => (
                    <article key={plan.key} className="adminx-alert-item">
                      <div className="adminx-row">
                        <strong>{plan.title}</strong>
                        <span className="adminx-badge">{plan.owner}</span>
                      </div>
                      <div className="adminx-muted">{plan.trigger}</div>
                      <div className="adminx-muted">{plan.immediateAction}</div>
                    </article>
                  ))}
                  {launchSupportMacros.map((macro) => (
                    <article key={macro.key} className="adminx-alert-item">
                      <div className="adminx-row">
                        <strong>{macro.title}</strong>
                        <span className="adminx-badge">{macro.owner}</span>
                      </div>
                      <div className="adminx-muted">Escalation: {macro.escalationOwner}</div>
                      <div className="adminx-muted">{macro.responseGoal}</div>
                    </article>
                  ))}
                </div>
              </section>
            </>
          ) : null}

          {capitalPayload ? (
            <>
              <section className="adminx-panel adminx-panel--span-12">
                <div className="adminx-panel-head">
                  <div>
                    <h2 className="adminx-panel-title">Capital Readiness</h2>
                    <span className="adminx-section-meta">
                      Scorecard, runway scenarios, spend gates, claims, and diligence blockers from the capital roadmap.
                    </span>
                  </div>
                  <span className={statusClass(capitalSummary.readinessState)}>
                    {eventLabel(capitalSummary.readinessState || "unknown")}
                  </span>
                </div>
                <div className="adminx-ops-grid">
                  {capitalCards.map(([label, value]) => (
                    <div key={label} className="adminx-ops-metric">
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                {capitalSummary.recommendedPath?.rationale ? (
                  <div className="adminx-muted">{capitalSummary.recommendedPath.rationale}</div>
                ) : null}
              </section>

              <section className="adminx-panel adminx-panel--span-12">
                <div className="adminx-panel-head">
                  <h2 className="adminx-panel-title">Runway Scenario Inputs</h2>
                  <span className="adminx-section-meta">{number(runwayScenarios.length)} scenarios</span>
                </div>
                <div className="adminx-alert-list adminx-alert-list--inline">
                  {runwayScenarios.map((scenario) => (
                    <article key={scenario.key} className="adminx-alert-item">
                      <div className="adminx-row">
                        <strong>{scenario.title}</strong>
                        <span className={statusClass(scenario.runwayStatus)}>
                          {eventLabel(scenario.runwayStatus)}
                        </span>
                      </div>
                      <div className="adminx-muted">{scenario.assumption}</div>
                      <div className="adminx-ops-grid">
                        <div className="adminx-ops-metric">
                          <span>GMV</span>
                          <strong>{money(scenario.grossPaidAmount)}</strong>
                        </div>
                        <div className="adminx-ops-metric">
                          <span>Platform Revenue</span>
                          <strong>{money(scenario.platformRevenue)}</strong>
                        </div>
                        <div className="adminx-ops-metric">
                          <span>Operating Cost</span>
                          <strong>{money(scenario.operatingCost)}</strong>
                        </div>
                        <div className="adminx-ops-metric">
                          <span>Net Burn</span>
                          <strong>{money(scenario.netBurn)}</strong>
                        </div>
                      </div>
                      <div className="adminx-pill-row">
                        {(scenario.inputLabels || []).slice(0, 5).map((input) => (
                          <span key={input.key} className={statusClass(input.classification)}>
                            {input.label}: {eventLabel(input.classification)}
                          </span>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="adminx-panel adminx-panel--span-12">
                <div className="adminx-panel-head">
                  <h2 className="adminx-panel-title">Capital Scorecard</h2>
                  <span className="adminx-section-meta">{number(capitalScorecard.length)} readiness areas</span>
                </div>
                <div className="adminx-table-wrap adminx-table-wrap--flush">
                  <table className="adminx-table">
                    <thead>
                      <tr>
                        <th>Area</th>
                        <th>Owner</th>
                        <th>State</th>
                        <th>Latest Evidence</th>
                        <th>External Use</th>
                        <th>Gap</th>
                      </tr>
                    </thead>
                    <tbody>
                      {capitalScorecard.map((entry) => (
                        <tr key={entry.key}>
                          <td>
                            <strong>{entry.title}</strong>
                            <div className="adminx-muted">{entry.workstream}</div>
                          </td>
                          <td>{entry.owner}</td>
                          <td><span className={statusClass(entry.state)}>{eventLabel(entry.state)}</span></td>
                          <td>{entry.latestMetric}</td>
                          <td>
                            <span className={statusClass(entry.externalUseAllowed ? "approved_for_advisor_review" : entry.approvalState)}>
                              {entry.externalUseAllowed ? "Advisor Review" : eventLabel(entry.approvalState)}
                            </span>
                          </td>
                          <td>
                            <div className="adminx-muted">{(entry.gaps || [])[0] || entry.decisionRule}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="adminx-panel adminx-panel--span-12">
                <div className="adminx-panel-head">
                  <h2 className="adminx-panel-title">Use-of-funds Gates</h2>
                  <span className="adminx-section-meta">{number(useOfFundsGates.length)} categories</span>
                </div>
                <div className="adminx-alert-list adminx-alert-list--inline">
                  {useOfFundsGates.map((gate) => (
                    <article key={gate.key} className="adminx-alert-item">
                      <div className="adminx-row">
                        <strong>{gate.title}</strong>
                        <span className={statusClass(gate.gateState)}>{eventLabel(gate.gateState)}</span>
                      </div>
                      <div className="adminx-muted">{gate.owner} - {gate.budgetRange}</div>
                      <div className="adminx-muted">{gate.milestoneTrigger}</div>
                      <div className="adminx-muted">{gate.stopLossRule}</div>
                      {gate.blockingDependencies?.length ? (
                        <div className="adminx-pill-row">
                          {gate.blockingDependencies.slice(0, 4).map((dependency) => (
                            <span key={dependency.key} className={statusClass(dependency.state)}>
                              {dependency.title}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>

              <section className="adminx-panel adminx-panel--span-12">
                <div className="adminx-panel-head">
                  <h2 className="adminx-panel-title">Claims, Data-room, And Capital Risks</h2>
                  <span className="adminx-section-meta">
                    {number(claimRegister.length)} claims - {number(dataRoomPackets.length)} packets - {number(capitalRisks.length)} risks
                  </span>
                </div>
                <div className="adminx-alert-list adminx-alert-list--inline">
                  {claimRegister.slice(0, 6).map((claim) => (
                    <article key={claim.key} className="adminx-alert-item">
                      <div className="adminx-row">
                        <strong>{claim.title}</strong>
                        <span className={statusClass(claim.approvalState)}>{eventLabel(claim.approvalState)}</span>
                      </div>
                      <div className="adminx-muted">{claim.value}</div>
                      <div className="adminx-muted">{claim.approvalRule}</div>
                    </article>
                  ))}
                  {dataRoomPackets.slice(0, 4).map((packet) => (
                    <article key={packet.key} className="adminx-alert-item">
                      <div className="adminx-row">
                        <strong>{packet.title}</strong>
                        <span className={statusClass(packet.shareState)}>{eventLabel(packet.shareState)}</span>
                      </div>
                      <div className="adminx-muted">{packet.accessRule}</div>
                    </article>
                  ))}
                  {capitalRisks.slice(0, 6).map((risk) => (
                    <article key={risk.key} className="adminx-alert-item">
                      <div className="adminx-row">
                        <strong>{risk.title}</strong>
                        <span className={statusClass(risk.severity)}>{eventLabel(risk.severity)}</span>
                      </div>
                      <div className="adminx-muted">{risk.owner}</div>
                      <div className="adminx-muted">{risk.nextAction || risk.mitigation}</div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="adminx-panel adminx-panel--span-12">
                <div className="adminx-panel-head">
                  <h2 className="adminx-panel-title">Diligence Pipeline And Q&A</h2>
                  <span className="adminx-section-meta">
                    {number(diligencePipeline.length)} targets - {number(diligenceQaWorkflow.length)} answer controls
                  </span>
                </div>
                <div className="adminx-alert-list adminx-alert-list--inline">
                  {diligencePipeline.map((target) => (
                    <article key={`target-${target.key}`} className="adminx-alert-item">
                      <div className="adminx-row">
                        <strong>{target.title}</strong>
                        <span className={statusClass(target.conversationState)}>
                          {eventLabel(target.conversationState)}
                        </span>
                      </div>
                      <div className="adminx-muted">{eventLabel(target.audience)} - {target.fit}</div>
                      <div className="adminx-muted">{target.nextStep}</div>
                      <div className="adminx-pill-row">
                        <span className="adminx-badge">
                          Packets {number(target.approvedPacketCount)} / {number(target.requiredPacketCount)}
                        </span>
                        <span className="adminx-badge">
                          Claims {number(target.approvedClaimCount)} / {number(target.requiredClaimCount)}
                        </span>
                        {(target.missingEvidence || []).slice(0, 3).map((entry) => (
                          <span key={`${target.key}-${entry.kind}-${entry.key}`} className={statusClass(entry.state)}>
                            {entry.title}
                          </span>
                        ))}
                      </div>
                    </article>
                  ))}

                  {diligenceQaWorkflow.map((entry) => (
                    <article key={`qa-${entry.key}`} className="adminx-alert-item">
                      <div className="adminx-row">
                        <strong>{entry.question}</strong>
                        <span className={statusClass(entry.responseState)}>
                          {eventLabel(entry.responseState)}
                        </span>
                      </div>
                      <div className="adminx-muted">{entry.owner} - reviewer: {entry.reviewer}</div>
                      <div className="adminx-muted">{entry.answerRule}</div>
                      <div className="adminx-muted">{entry.nextStep}</div>
                      {entry.blockingEvidence?.length ? (
                        <div className="adminx-pill-row">
                          {entry.blockingEvidence.slice(0, 4).map((blocker) => (
                            <span key={`${entry.key}-${blocker.kind}-${blocker.key}`} className={statusClass(blocker.state)}>
                              {blocker.title}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                  {!diligencePipeline.length && !diligenceQaWorkflow.length ? (
                    <div className="adminx-empty">No diligence workflow data available.</div>
                  ) : null}
                </div>
              </section>
            </>
          ) : null}

          <section className="adminx-panel adminx-panel--span-12">
            <div className="adminx-panel-head">
              <div>
                <h2 className="adminx-panel-title">Workstreams</h2>
                <span className="adminx-section-meta">{dateTime(payload.filters?.startDate)} to {dateTime(payload.filters?.endDate)}</span>
              </div>
              <span className={statusClass(payload.dashboard?.readinessState)}>
                {eventLabel(payload.dashboard?.readinessState || "unknown")}
              </span>
            </div>
            <div className="adminx-ops-grid">
              {workstreams.map((entry) => (
                <div key={entry.key} className="adminx-ops-metric">
                  <span>{eventLabel(entry.key)}</span>
                  <strong>{percent(entry.evidenceFreshnessRate)}</strong>
                  <small className="adminx-muted">
                    {number(entry.controls)} controls - {eventLabel(entry.readinessState)}
                  </small>
                </div>
              ))}
            </div>
          </section>

          <section className="adminx-panel adminx-panel--span-12">
            <div className="adminx-panel-head">
              <h2 className="adminx-panel-title">Readiness Gates</h2>
              <span className="adminx-section-meta">{number(readinessGates.length)} gates</span>
            </div>
            <div className="adminx-alert-list adminx-alert-list--inline">
              {readinessGates.map((gate) => (
                <article key={gate.key} className="adminx-alert-item">
                  <div className="adminx-row">
                    <strong>{gate.title}</strong>
                    <span className={statusClass(gate.readinessState)}>{eventLabel(gate.readinessState)}</span>
                  </div>
                  <div className="adminx-muted">{gate.blockerCondition}</div>
                </article>
              ))}
            </div>
          </section>

          <section className="adminx-panel adminx-panel--span-12">
            <div className="adminx-panel-head">
              <h2 className="adminx-panel-title">Assurance Evidence Packs</h2>
              <span className="adminx-section-meta">{number(evidencePacks.length)} packs</span>
            </div>
            <div className="adminx-alert-list adminx-alert-list--inline">
              {evidencePacks.map((pack) => (
                <article key={pack.key} className="adminx-alert-item">
                  <div className="adminx-row">
                    <strong>{pack.title}</strong>
                    <span className={statusClass(pack.readinessState)}>{eventLabel(pack.readinessState)}</span>
                  </div>
                  <div className="adminx-muted">{pack.summary}</div>
                  <div className="adminx-pill-row">
                    <span className={statusClass(pack.evidenceFreshness)}>
                      {eventLabel(pack.evidenceFreshness)}
                    </span>
                    <span className={statusClass(pack.exceptionSeverity)}>
                      {eventLabel(pack.exceptionSeverity)}
                    </span>
                    <span className="adminx-badge">{eventLabel(pack.sharingLevel)}</span>
                  </div>
                  <div className="adminx-muted">{pack.latestEvidenceSummary}</div>
                  <div className="adminx-pill-row">
                    {(pack.requiredEvidence || []).slice(0, 8).map((section) => (
                      <span key={section.key} className={statusClass(section.status)}>
                        {section.label}
                      </span>
                    ))}
                  </div>
                  {pack.openRisks?.length ? (
                    <div className="adminx-muted">
                      {number(pack.openRisks.length)} open risks - {pack.revocationOrPauseRule}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="adminx-link-btn adminx-link-btn--inline"
                    onClick={() => navigate(pack.actionPath || "/admin/assurance")}
                  >
                    Open controls
                  </button>
                </article>
              ))}
              {!evidencePacks.length ? <div className="adminx-empty">No evidence packs in this window.</div> : null}
            </div>
          </section>

          <section className="adminx-panel adminx-panel--span-12">
            <div className="adminx-panel-head">
              <h2 className="adminx-panel-title">Metric Trust Contracts</h2>
              <span className="adminx-section-meta">{number(metricContracts.length)} contracts</span>
            </div>
            <div className="adminx-table-wrap adminx-table-wrap--flush">
              <table className="adminx-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Owner</th>
                    <th>Source</th>
                    <th>Trust</th>
                    <th>Freshness</th>
                    <th>External Use</th>
                  </tr>
                </thead>
                <tbody>
                  {metricContracts.map((contract) => (
                    <tr key={contract.key}>
                      <td>
                        <strong>{contract.title}</strong>
                        <div className="adminx-muted">{contract.definition}</div>
                      </td>
                      <td>{contract.owner}</td>
                      <td>
                        {eventLabel(contract.sourceSystem)}
                        <div className="adminx-muted">{contract.freshnessExpectation}</div>
                      </td>
                      <td><span className={statusClass(contract.trustState)}>{eventLabel(contract.trustState)}</span></td>
                      <td><span className={statusClass(contract.evidenceFreshness)}>{eventLabel(contract.evidenceFreshness)}</span></td>
                      <td>
                        <span className={statusClass(contract.externalUseAllowed ? "ready" : "blocked")}>
                          {contract.externalUseAllowed ? eventLabel(contract.externalUse) : "Blocked"}
                        </span>
                        {contract.blockingControls?.length ? (
                          <div className="adminx-muted">
                            {number(contract.blockingControls.length)} blocking controls
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {!metricContracts.length ? (
                    <tr>
                      <td colSpan="6">
                        <div className="adminx-empty">No metric contracts in this window.</div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="adminx-panel adminx-panel--span-12">
            <div className="adminx-panel-head">
              <h2 className="adminx-panel-title">Monitoring Alerts</h2>
              <span className="adminx-section-meta">{number(alerts.length)} open</span>
            </div>
            <div className="adminx-alert-list adminx-alert-list--inline">
              {alerts.slice(0, 8).map((alert) => (
                <button
                  key={alert.key}
                  type="button"
                  className="adminx-alert-item"
                  onClick={() => navigate(alert.actionPath || "/admin/assurance")}
                >
                  <div className="adminx-row">
                    <strong>{alert.surface}</strong>
                    <span className={statusClass(alert.severity)}>{eventLabel(alert.severity)}</span>
                  </div>
                  <div className="adminx-muted">{alert.owner}</div>
                  <div className="adminx-muted">{alert.message}</div>
                </button>
              ))}
              {!alerts.length ? <div className="adminx-empty">No assurance alerts in this window.</div> : null}
            </div>
          </section>

          <section className="adminx-panel adminx-panel--span-12">
            <div className="adminx-panel-head">
              <h2 className="adminx-panel-title">Control Registry</h2>
              <span className="adminx-section-meta">{number(controls.length)} controls</span>
            </div>
            <div className="adminx-table-wrap adminx-table-wrap--flush">
              <table className="adminx-table">
                <thead>
                  <tr>
                    <th>Control</th>
                    <th>Owner</th>
                    <th>Freshness</th>
                    <th>Readiness</th>
                    <th>Severity</th>
                    <th>Latest Evidence</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {controls.map((control) => (
                    <tr key={control.controlKey}>
                      <td>
                        <strong>{control.surface}</strong>
                        <div className="adminx-muted">{eventLabel(control.workflow)}</div>
                      </td>
                      <td>{control.owner}</td>
                      <td><span className={statusClass(control.evidenceFreshness)}>{eventLabel(control.evidenceFreshness)}</span></td>
                      <td><span className={statusClass(control.readinessState)}>{eventLabel(control.readinessState)}</span></td>
                      <td><span className={statusClass(control.exceptionSeverity)}>{eventLabel(control.exceptionSeverity)}</span></td>
                      <td>{control.latestMetric}</td>
                      <td>
                        <button
                          type="button"
                          className="adminx-link-btn adminx-link-btn--inline"
                          onClick={() => navigate(control.actionPath || "/admin/assurance")}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="adminx-panel adminx-panel--span-12">
            <div className="adminx-panel-head">
              <h2 className="adminx-panel-title">Evidence Pack Standard</h2>
              <span className="adminx-section-meta">{number((standard.sections || []).length)} sections</span>
            </div>
            <div className="adminx-pill-row">
              {(standard.sections || []).map((section) => (
                <span key={section} className="adminx-badge">{eventLabel(section)}</span>
              ))}
            </div>
            <div className="adminx-pill-row">
              {(standard.freshnessLevels || []).map((level) => (
                <span key={level} className={statusClass(level)}>{eventLabel(level)}</span>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </AdminShell>
  );
}
