import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import AdminShell from "../components/AdminShell";
import { adminGetAssuranceDashboard } from "../api";

const RANGE_OPTIONS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "year", label: "This year" },
];

const number = (value) => Number(value || 0).toLocaleString();
const percent = (value) => `${Math.round(Number(value || 0) * 100)}%`;

const eventLabel = (value = "") =>
  String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");

const statusClass = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["blocked", "critical", "high", "needs_review"].includes(normalized)) {
    return "adminx-badge adminx-badge--danger";
  }
  if (["watch", "medium", "delayed", "stale", "disputed"].includes(normalized)) {
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPayload(await adminGetAssuranceDashboard({ range }));
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
  const alerts = payload?.alerts || [];
  const readinessGates = payload?.readinessGates || [];
  const standard = payload?.evidencePackStandard || {};

  const headlineCards = [
    ["Readiness", eventLabel(summary.readinessState || "unknown")],
    ["Control Coverage", percent(summary.controlCoverageRate)],
    ["Current Evidence", `${number(summary.currentEvidenceControls)} / ${number(summary.totalControls)}`],
    ["Blockers", number(summary.blockerCount)],
    ["Needs Review", number(summary.needsReviewCount)],
    ["High Severity", number(summary.highSeverityCount)],
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
