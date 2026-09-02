import { Fragment, useCallback, useEffect, useState } from "react";

import AdminShell from "../components/AdminShell";
import { fetchTeacherTrainingAdminTracker } from "../services/teacherTrainingService";

import "./admin-teacher-training.css";

const initialTracker = {
  campaign: { moduleCount: 22, deadlineAt: null, isOpen: true },
  benchmark: { passMarkPercent: 60, requiresAllModules: true },
  summary: {
    totalParticipants: 0,
    inProgress: 0,
    completedAll: 0,
    benchmarkPassed: 0,
    benchmarkNotMet: 0,
  },
  participants: [],
};

const formatDate = (value) => {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-NG", {
        dateStyle: "medium",
        timeStyle: "short",
      });
};

const statusLabel = (participant) => {
  if (participant.salaryIncrementEligible) {
    return "Benchmark passed";
  }
  if (participant.completedAllModules) {
    return "Benchmark not met";
  }
  return "Training in progress";
};

export default function AdminTeacherTrainingPage({ user }) {
  const [tracker, setTracker] = useState(initialTracker);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [expandedId, setExpandedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setTracker(
        (await fetchTeacherTrainingAdminTracker({ search, status })) ||
          initialTracker
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The staff training tracker could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = tracker.summary || initialTracker.summary;
  const benchmark = tracker.benchmark || initialTracker.benchmark;

  return (
    <AdminShell
      title="Staff Training Tracker"
      subtitle="Kurah Tech and Arts Academy module completion and salary-increment benchmark monitoring."
      user={user}
      actions={
        <button type="button" className="adminx-btn" onClick={load}>
          Refresh
        </button>
      }
    >
      {error ? <div className="adminx-error" role="alert">{error}</div> : null}

      <section className="training-admin-banner">
        <div>
          <span>Training availability</span>
          <strong>Open · Self-paced · No deadline</strong>
          <p>
            Staff can complete all {tracker.campaign?.moduleCount || 22} modules
            at their own pace. Per-question assessment timers still apply.
          </p>
        </div>
        <div>
          <span>Salary increment benchmark</span>
          <strong>{benchmark.passMarkPercent || 60}% cumulative</strong>
          <p>All modules must be completed before a staff member is marked eligible.</p>
        </div>
      </section>

      <section className="training-admin-kpis" aria-label="Training tracker summary">
        {[
          ["Staff engaged", summary.totalParticipants],
          ["Still in progress", summary.inProgress],
          ["Completed all modules", summary.completedAll],
          ["Passed salary benchmark", summary.benchmarkPassed],
          ["Completed but below benchmark", summary.benchmarkNotMet],
        ].map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{Number(value || 0).toLocaleString()}</strong>
          </article>
        ))}
      </section>

      <section className="adminx-panel training-admin-panel">
        <div className="adminx-panel-head">
          <div>
            <h2 className="adminx-panel-title">Staff progress records</h2>
            <span className="adminx-section-meta">
              Only staff who have started at least one module appear here.
            </span>
          </div>
          <span className="adminx-badge">
            {tracker.participants?.length || 0} shown
          </span>
        </div>

        <form
          className="training-admin-filters"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(searchInput.trim());
          }}
        >
          <input
            className="adminx-input"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search staff name, username or email"
          />
          <select
            className="adminx-select"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">All participants</option>
            <option value="in_progress">Training in progress</option>
            <option value="completed">Completed all modules</option>
            <option value="eligible">Passed salary benchmark</option>
            <option value="benchmark_not_met">Completed below benchmark</option>
          </select>
          <button className="adminx-btn adminx-btn--primary">Apply filters</button>
          {(search || status !== "all") ? (
            <button
              type="button"
              className="adminx-btn"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setStatus("all");
              }}
            >
              Clear
            </button>
          ) : null}
        </form>

        {loading ? (
          <div className="adminx-loading">Loading staff training records…</div>
        ) : (
          <div className="adminx-table-wrap adminx-table-wrap--flush">
            <table className="adminx-table training-admin-table">
              <thead>
                <tr>
                  <th>Staff member</th>
                  <th>Modules</th>
                  <th>Cumulative result</th>
                  <th>Salary benchmark</th>
                  <th>Started</th>
                  <th>Last activity</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {(tracker.participants || []).map((participant) => (
                  <Fragment key={participant.id}>
                    <tr>
                      <td>
                        <strong>{participant.name}</strong>
                        <small>@{participant.username || "staff"} · {participant.email}</small>
                      </td>
                      <td>
                        <strong>
                          {participant.completedModules}/{participant.totalModules}
                        </strong>
                        <small>{participant.inProgressModules || 0} currently in progress</small>
                        <span className="training-admin-progress">
                          <i style={{ width: `${participant.progressPercent || 0}%` }} />
                        </span>
                      </td>
                      <td>
                        <strong>{participant.scorePercent || 0}%</strong>
                        <small>{participant.correctAnswers}/{participant.possibleAnswers} correct overall</small>
                        <small>{participant.averageCompletedScore || 0}% average on completed modules</small>
                      </td>
                      <td>
                        <span
                          className={`training-admin-decision is-${participant.trackerStatus}`}
                        >
                          {statusLabel(participant)}
                        </span>
                      </td>
                      <td>{formatDate(participant.startedAt)}</td>
                      <td>{formatDate(participant.lastActivityAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="adminx-btn"
                          onClick={() =>
                            setExpandedId((current) =>
                              current === participant.id ? "" : participant.id
                            )
                          }
                        >
                          {expandedId === participant.id ? "Hide" : "View modules"}
                        </button>
                      </td>
                    </tr>
                    {expandedId === participant.id ? (
                      <tr
                        key={`${participant.id}-modules`}
                        className="training-admin-module-row"
                      >
                        <td colSpan="7">
                          <div className="training-admin-module-grid">
                            {(participant.modules || []).map((module) => (
                              <article
                                key={module.code}
                                className={`is-${module.status}`}
                              >
                                <span>{module.code}</span>
                                <strong>{module.title}</strong>
                                <small>
                                  {module.status === "completed"
                                    ? `${module.scorePercent}% · ${module.passed ? "Pass" : "Below pass mark"}`
                                    : module.status === "in_progress"
                                      ? "Assessment in progress"
                                      : "Not started"}
                                </small>
                              </article>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
            {!tracker.participants?.length ? (
              <div className="adminx-empty">
                No staff training records match these filters.
              </div>
            ) : null}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
