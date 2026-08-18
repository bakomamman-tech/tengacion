import { useCallback, useEffect, useMemo, useState } from "react";

import AdminShell from "../components/AdminShell";
import {
  adminGetBrightFutureControls,
  adminGetBrightFutureLeaderboard,
  adminGetBrightFutureOverview,
  adminGetBrightFutureQuestions,
  adminGetBrightFutureResults,
  adminGetBrightFutureStudents,
  adminResetBrightFutureAttempt,
  adminUpdateBrightFutureControls,
  adminUpdateBrightFutureQuestion,
  adminUpdateBrightFutureStudent,
} from "../features/brightFutureAcademy/brightFutureApi";

import "./admin-bright-future.css";

const TABS = [
  ["overview", "Overview"], ["students", "Students"], ["results", "Examination Results"],
  ["leaderboard", "Leaderboard"], ["questions", "Question Management"], ["controls", "Competition Controls"],
];
const number = (value) => Number(value || 0).toLocaleString();
const time = (seconds = 0) => `${Math.floor(Number(seconds || 0) / 60)}m ${Math.round(Number(seconds || 0) % 60)}s`;
const date = (value) => value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—";
const subjectName = (key = "") => ({ mathematics: "Mathematics", english: "English", basic_science_technology: "Basic Science & Technology", basicScienceTechnology: "Basic Science & Technology", social_studies: "Social Studies", socialStudies: "Social Studies" }[key] || key);

function AdminNotice({ error, notice }) {
  return <>{error ? <div className="adminx-error" role="alert">{error}</div> : null}{notice ? <div className="bfa-admin-notice">{notice}</div> : null}</>;
}

function OverviewTab({ overview }) {
  const metrics = [
    ["Total registrations", overview.totalRegistrations], ["Completed exams", overview.totalCompleted],
    ["Currently in progress", overview.inProgress], ["Average score", `${overview.averageScore || 0}/40`],
    ["Highest score", `${overview.highestScore || 0}/40`], ["Lowest score", `${overview.lowestScore || 0}/40`],
    ["Average completion", time(overview.averageCompletionTime)], ["Integrity violations", overview.integrityViolations],
    ["Schools represented", overview.schoolsRepresented], ["States represented", overview.statesRepresented],
  ];
  const maxClass = Math.max(1, ...(overview.registrationsPerClass || []).map((item) => item.value));
  return <><div className="bfa-admin-kpis">{metrics.map(([label, value]) => <article key={label}><span>{label}</span><strong>{typeof value === "number" ? number(value) : value}</strong></article>)}</div><div className="bfa-admin-analytics"><section className="adminx-panel"><div className="adminx-panel-head"><h2 className="adminx-panel-title">Registrations per class</h2><span className="adminx-badge">{overview.completionRate || 0}% completion</span></div><div className="bfa-admin-bars">{(overview.registrationsPerClass || []).map((item) => <div key={item.label}><span>{item.label}</span><i><b style={{ width: `${(item.value / maxClass) * 100}%` }} /></i><strong>{item.value}</strong></div>)}</div></section><section className="adminx-panel"><div className="adminx-panel-head"><h2 className="adminx-panel-title">Average subject scores</h2></div><div className="bfa-admin-subjects">{Object.entries(overview.subjectAverages || {}).map(([key, value]) => <article key={key}><span>{subjectName(key)}</span><strong>{value}/10</strong><i><b style={{ width: `${value * 10}%` }} /></i></article>)}</div><div className="bfa-admin-insights"><p><span>Hardest subject</span><strong>{subjectName(overview.hardestSubject)}</strong></p><p><span>Highest scoring</span><strong>{subjectName(overview.highestScoringSubject)}</strong></p></div></section></div></>;
}

function StudentsTab({ payload, loading, filters, setFilters, applyFilters, onStatus, onReset, saving }) {
  return <section className="adminx-panel"><div className="adminx-panel-head"><div><h2 className="adminx-panel-title">Registered students</h2><span className="adminx-section-meta">{number(payload.total)} permanent MongoDB records</span></div></div><form className="bfa-admin-filters" onSubmit={applyFilters}><input className="adminx-input" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search name, ID, school or state" /><select className="adminx-select" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="">All statuses</option><option value="active">Active</option><option value="disabled">Disabled</option><option value="withdrawn">Withdrawn</option></select><select className="adminx-select" value={filters.completed} onChange={(event) => setFilters((current) => ({ ...current, completed: event.target.value }))}><option value="">Any exam state</option><option value="true">Completed</option><option value="false">Not completed</option></select><button className="adminx-btn adminx-btn--primary">Apply</button></form>{loading ? <div className="adminx-loading">Loading Bright Future students…</div> : <div className="adminx-table-wrap adminx-table-wrap--flush"><table className="adminx-table bfa-admin-table"><thead><tr><th>Candidate</th><th>Class / School</th><th>Contact (private)</th><th>Exam</th><th>Score / Rank</th><th>Integrity</th><th>Actions</th></tr></thead><tbody>{(payload.students || []).map((student) => <tr key={student.id}><td><strong>{student.fullName}</strong><small>{student.candidateId}</small><span className={`adminx-badge is-${student.status}`}>{student.status}</span></td><td><strong>{student.classLevel}</strong><small>{student.schoolName}</small><small>{student.state} · {student.lga}</small></td><td><small>Guardian: {student.guardianPhone || "—"}</small><small>Student: {student.studentPhone || "—"}</small></td><td><strong>{student.competitionStatus.replaceAll("_", " ")}</strong><small>Attempt {student.attemptNumber || 0}</small><small>{date(student.examCompletedAt || student.examStartedAt)}</small></td><td><strong>{student.examCompleted ? `${student.totalScore}/40 · ${student.percentage}%` : "—"}</strong><small>Rank {student.ranking ? `#${student.ranking}` : "—"}</small></td><td><strong>{student.violationCount || 0} warning(s)</strong><small>{student.submissionReason || "No submission"}</small></td><td><div className="bfa-admin-actions"><button type="button" disabled={saving} onClick={() => onStatus(student)}>{student.status === "active" ? "Disable" : "Restore"}</button><button type="button" disabled={saving} onClick={() => onReset(student)}>Reset / retake</button></div></td></tr>)}</tbody></table>{!payload.students?.length ? <div className="adminx-empty">No students match these filters.</div> : null}</div>}</section>;
}

function ResultsTab({ payload, loading }) {
  return <section className="adminx-panel"><div className="adminx-panel-head"><div><h2 className="adminx-panel-title">Verified examination results</h2><span className="adminx-section-meta">Student → attempt → subject scores → rank → integrity status</span></div></div>{loading ? <div className="adminx-loading">Loading results…</div> : <div className="adminx-table-wrap adminx-table-wrap--flush"><table className="adminx-table bfa-admin-results"><thead><tr><th>Rank</th><th>Candidate</th><th>Class</th><th>School</th><th>Maths</th><th>English</th><th>BST</th><th>Social</th><th>Total</th><th>%</th><th>Time</th><th>Status</th></tr></thead><tbody>{(payload.results || []).map((result) => <tr key={result.id}><td><strong>#{result.ranking || "—"}</strong></td><td><strong>{result.fullName}</strong><small>{result.candidateId}</small></td><td>{result.classLevel}</td><td>{result.schoolName}</td><td>{result.subjectScores?.mathematics || 0}</td><td>{result.subjectScores?.english || 0}</td><td>{result.subjectScores?.basicScienceTechnology || 0}</td><td>{result.subjectScores?.socialStudies || 0}</td><td><strong>{result.totalScore}/40</strong></td><td>{result.percentage}%</td><td>{time(result.totalTimeUsed)}</td><td><span className={`adminx-badge ${result.violationCount ? "is-warning" : "is-success"}`}>{result.submissionReason || "completed"}</span><small>{result.violationCount || 0} violation(s)</small></td></tr>)}</tbody></table>{!payload.results?.length ? <div className="adminx-empty">No completed examination results yet.</div> : null}</div>}</section>;
}

function LeaderboardTab({ leaderboard }) {
  return <section className="adminx-panel"><div className="adminx-panel-head"><div><h2 className="adminx-panel-title">Live server ranking</h2><span className="adminx-section-meta">Score → Mathematics → English → shortest legitimate time</span></div>{leaderboard.hidden ? <span className="adminx-badge is-warning">Public board hidden</span> : null}</div><div className="bfa-admin-leaderboard">{(leaderboard.entries || []).map((entry) => <article key={`${entry.rank}-${entry.candidateId}`}><span>{entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : `#${entry.rank}`}</span><div><strong>{entry.displayName}</strong><small>{entry.classLevel} · {entry.schoolName} · {entry.state}</small></div><b>{entry.score}/40 <small>{entry.percentage}% · {time(entry.completionTime)}</small></b></article>)}{!leaderboard.entries?.length ? <div className="adminx-empty">No live ranking records yet.</div> : null}</div></section>;
}

function QuestionsTab({ questions, onSave, saving }) {
  const [editing, setEditing] = useState(null);
  const grouped = useMemo(() => questions.reduce((groups, question) => ({ ...groups, [question.subject]: [...(groups[question.subject] || []), question] }), {}), [questions]);
  const open = (question) => setEditing({ ...question, options: [...question.options] });
  const save = async () => { await onSave(editing); setEditing(null); };
  return <div className="bfa-admin-question-groups">{Object.entries(grouped).map(([subject, items]) => <section className="adminx-panel" key={subject}><div className="adminx-panel-head"><h2 className="adminx-panel-title">{subjectName(subject)}</h2><span className="adminx-badge">{items.filter((item) => item.active).length}/10 active</span></div><div className="bfa-admin-question-list">{items.map((question) => <article key={question.questionId}><span>{question.order}</span><div><strong>{question.prompt}</strong><small>Correct: {String.fromCharCode(65 + question.correctIndex)} · Version {question.version}</small></div><span className={`adminx-badge ${question.active ? "is-success" : "is-warning"}`}>{question.active ? "Active" : "Inactive"}</span><button type="button" className="adminx-btn" onClick={() => open(question)}>Edit</button></article>)}</div></section>)}{editing ? <div className="bfa-admin-modal-backdrop"><section className="bfa-admin-question-modal"><h2>Edit {editing.questionId}</h2><label>Question text<textarea className="adminx-textarea" rows="4" value={editing.prompt} onChange={(event) => setEditing((current) => ({ ...current, prompt: event.target.value }))} /></label>{editing.options.map((option, index) => <label key={index}>Option {String.fromCharCode(65 + index)}<input className="adminx-input" value={option} onChange={(event) => setEditing((current) => ({ ...current, options: current.options.map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))} /></label>)}<div className="bfa-admin-question-fields"><label>Correct option<select className="adminx-select" value={editing.correctIndex} onChange={(event) => setEditing((current) => ({ ...current, correctIndex: Number(event.target.value) }))}>{editing.options.map((_, index) => <option value={index} key={index}>{String.fromCharCode(65 + index)}</option>)}</select></label><label><input type="checkbox" checked={editing.active} onChange={(event) => setEditing((current) => ({ ...current, active: event.target.checked }))} /> Active for new attempts</label></div><div><button type="button" className="adminx-btn" onClick={() => setEditing(null)}>Cancel</button><button type="button" className="adminx-btn adminx-btn--primary" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save question"}</button></div></section></div> : null}</div>;
}

function ControlsTab({ controls, setControls, onSave, saving }) {
  const toggles = [["registrationOpen", "Registration open"], ["examinationOpen", "Examination open"], ["leaderboardVisible", "Leaderboard public"], ["winnerVisible", "Winner public"], ["detailedResultsVisible", "Detailed answer review public"]];
  return <section className="adminx-panel bfa-admin-controls"><div className="adminx-panel-head"><div><h2 className="adminx-panel-title">Competition controls</h2><span className="adminx-section-meta">Changes are enforced on the server for every candidate.</span></div></div><div className="bfa-admin-control-grid"><label>Competition status<select className="adminx-select" value={controls.competitionStatus || "examination_open"} onChange={(event) => setControls((current) => ({ ...current, competitionStatus: event.target.value }))}><option value="registration_upcoming">Registration upcoming</option><option value="registration_open">Registration open</option><option value="examination_open">Examination open</option><option value="examination_closed">Examination closed</option><option value="results_published">Results published</option></select></label><label>Seconds per question<input className="adminx-input" type="number" min="20" max="180" value={controls.questionTimerSeconds || 50} onChange={(event) => setControls((current) => ({ ...current, questionTimerSeconds: Number(event.target.value) }))} /></label><label>Allowed violations<input className="adminx-input" type="number" min="1" max="10" value={controls.allowedViolations || 3} onChange={(event) => setControls((current) => ({ ...current, allowedViolations: Number(event.target.value) }))} /></label></div><div className="bfa-admin-toggle-list">{toggles.map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(controls[key])} onChange={(event) => setControls((current) => ({ ...current, [key]: event.target.checked }))} /><span><i /></span><div><strong>{label}</strong><small>{key === "detailedResultsVisible" ? "When disabled, candidates see scores but never the answer key." : "Applied immediately to public and candidate APIs."}</small></div></label>)}</div><button type="button" className="adminx-btn adminx-btn--primary" onClick={onSave} disabled={saving}>{saving ? "Saving controls…" : "Save competition controls"}</button></section>;
}

export default function AdminBrightFutureAcademy({ user }) {
  const [tab, setTab] = useState("overview");
  const [overview, setOverview] = useState({});
  const [students, setStudents] = useState({ students: [], total: 0 });
  const [results, setResults] = useState({ results: [], total: 0 });
  const [leaderboard, setLeaderboard] = useState({ entries: [] });
  const [questions, setQuestions] = useState([]);
  const [controls, setControls] = useState({});
  const [filters, setFilters] = useState({ search: "", status: "", completed: "" });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [overviewData, studentData, resultData, boardData, controlData] = await Promise.all([
        adminGetBrightFutureOverview(), adminGetBrightFutureStudents({ ...appliedFilters, limit: 100 }),
        adminGetBrightFutureResults({ limit: 100 }), adminGetBrightFutureLeaderboard(), adminGetBrightFutureControls(),
      ]);
      setOverview(overviewData.overview || {}); setStudents(studentData); setResults(resultData); setLeaderboard(boardData); setControls(controlData.controls || {});
      if (tab === "questions" || !questions.length) {setQuestions((await adminGetBrightFutureQuestions()).questions || []);}
    } catch (requestError) { setError(requestError.message || "Bright Future administration could not be loaded."); }
    finally { setLoading(false); }
  }, [appliedFilters, questions.length, tab]);
  useEffect(() => { load(); }, [load]);

  const runMutation = async (task, success) => { setSaving(true); setError(""); setNotice(""); try { await task(); setNotice(success); await load(); } catch (requestError) { setError(requestError.message || "Admin action failed. A fresh step-up verification may be required."); } finally { setSaving(false); } };
  const updateStatus = (student) => { if (window.confirm(`${student.status === "active" ? "Disable" : "Restore"} ${student.fullName}?`)) {runMutation(() => adminUpdateBrightFutureStudent(student.id, { status: student.status === "active" ? "disabled" : "active", reason: "Bright Future admin status update" }), "Student status updated.");} };
  const resetAttempt = (student) => { if (window.confirm(`Authorise a new official attempt for ${student.fullName}? Their current published ranking will be removed until the retake is completed.`)) {runMutation(() => adminResetBrightFutureAttempt(student.id, { reason: "Administrator-authorized retake" }), "Exam attempt reset and retake authorised.");} };
  const saveQuestion = (question) => runMutation(() => adminUpdateBrightFutureQuestion(question.questionId, { prompt: question.prompt, options: question.options, correctIndex: question.correctIndex, active: question.active, reason: "Question bank review" }), "Question updated for future attempts.");
  const saveControls = () => runMutation(() => adminUpdateBrightFutureControls({ ...controls, reason: "Competition operations update" }), "Competition controls updated.");

  return <AdminShell title="Bright Future Academy" subtitle="Smart School Portal and National CBT Challenge operations." user={user} actions={<button type="button" className="adminx-btn" onClick={load}>Refresh</button>}><AdminNotice error={error} notice={notice} /><nav className="bfa-admin-tabs" aria-label="Bright Future Academy admin sections">{TABS.map(([key, label]) => <button type="button" key={key} className={tab === key ? "is-active" : ""} onClick={() => setTab(key)}>{label}</button>)}</nav>{tab === "overview" ? <OverviewTab overview={overview} /> : null}{tab === "students" ? <StudentsTab payload={students} loading={loading} filters={filters} setFilters={setFilters} applyFilters={(event) => { event.preventDefault(); setAppliedFilters(filters); }} onStatus={updateStatus} onReset={resetAttempt} saving={saving} /> : null}{tab === "results" ? <ResultsTab payload={results} loading={loading} /> : null}{tab === "leaderboard" ? <LeaderboardTab leaderboard={leaderboard} /> : null}{tab === "questions" ? <QuestionsTab questions={questions} onSave={saveQuestion} saving={saving} /> : null}{tab === "controls" ? <ControlsTab controls={controls} setControls={setControls} onSave={saveControls} saving={saving} /> : null}</AdminShell>;
}
