import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import BrightFutureLayout from "./BrightFutureLayout";
import {
  ANNOUNCEMENTS,
  ASSIGNMENTS,
  CANONICAL_ROOT,
  CLASS_GROUPS,
  NIGERIAN_STATES,
  SAMPLE_TEACHERS,
  SUBJECTS,
} from "./brightFutureData";
import { getBrightFutureLeaderboard, updateBrightFutureProfile } from "./brightFutureApi";
import useBrightFuture from "./useBrightFuture";

function PortalHeading({ eyebrow, title, copy, action = null }) {
  return <header className="bfa-portal-heading"><div><p className="bfa-eyebrow">{eyebrow}</p><h1>{title}</h1><p>{copy}</p></div>{action}</header>;
}

function StatusBadge({ children, tone = "blue" }) {
  return <span className={`bfa-status-badge is-${tone}`}><i />{children}</span>;
}

export function BrightFutureDashboardPage() {
  const { candidate } = useBrightFuture();
  const [leaders, setLeaders] = useState([]);
  useEffect(() => { getBrightFutureLeaderboard({ limit: 3 }).then((data) => setLeaders(data.entries || [])).catch(() => null); }, []);
  const examLabel = candidate.examCompleted ? "Examination completed" : candidate.examStarted ? "Examination in progress" : "Ready when you are";
  return (
    <BrightFutureLayout portal activeKey="dashboard">
      <PortalHeading eyebrow="Student dashboard" title={`Good day, ${candidate.firstName}.`} copy="Your learning, competition progress and school information are organised here." action={<Link className="bfa-button bfa-button--primary" to={`${CANONICAL_ROOT}/exam/instructions`}>{candidate.examCompleted ? "View my result" : candidate.examStarted ? "Resume examination" : "Enter CBT Challenge"} →</Link>} />
      <section className="bfa-dashboard-hero">
        <div><StatusBadge tone={candidate.examCompleted ? "green" : "gold"}>{examLabel}</StatusBadge><h2>Bright Future Academy<br /><span>National CBT Challenge</span></h2><p>40 questions · 4 subjects · 50 seconds per question</p><div className="bfa-dashboard-progress"><span style={{ width: candidate.examCompleted ? "100%" : candidate.examStarted ? "35%" : "0%" }} /></div></div>
        <div className="bfa-dashboard-hero__id"><small>Candidate ID</small><strong>{candidate.candidateId}</strong><span>{candidate.classLevel} · {candidate.state}</span></div>
      </section>
      <section className="bfa-quick-grid" aria-label="Student portal areas">
        {[
          ["profile", "◉", "My Profile", "Review your official student information.", `${CANONICAL_ROOT}/profile`],
          ["exam", "✦", "CBT Examination", candidate.examCompleted ? "Your official attempt is complete." : "Read the rules and begin securely.", `${CANONICAL_ROOT}/exam/instructions`],
          ["result", "▥", "My Result", candidate.examCompleted ? "View scores and current ranking." : "Available after final submission.", `${CANONICAL_ROOT}/result`],
          ["subjects", "◇", "Official Subjects", "Explore the four competition subjects.", `${CANONICAL_ROOT}/subjects`],
          ["assignments", "✓", "Assignments", "View structured starter assignments.", `${CANONICAL_ROOT}/assignments`],
          ["attendance", "▦", "Attendance", "See the school portal attendance preview.", `${CANONICAL_ROOT}/attendance`],
          ["announcements", "◌", "Announcements", "Competition and academic updates.", `${CANONICAL_ROOT}/announcements`],
          ["teachers", "♙", "Teacher Directory", "Meet the sample academic team.", `${CANONICAL_ROOT}/teachers`],
        ].map(([key, icon, title, copy, path]) => <Link className={`bfa-quick-card is-${key}`} key={key} to={path}><span>{icon}</span><div><h3>{title}</h3><p>{copy}</p></div><b>→</b></Link>)}
      </section>
      <div className="bfa-dashboard-columns">
        <section className="bfa-portal-panel"><div className="bfa-panel-title"><div><p className="bfa-eyebrow">Latest updates</p><h2>Announcements</h2></div><Link to={`${CANONICAL_ROOT}/announcements`}>View all</Link></div>{ANNOUNCEMENTS.slice(0, 3).map((item) => <article className="bfa-announcement-line" key={item.title}><span>{item.tag.slice(0, 1)}</span><div><small>{item.tag} · {item.date}</small><strong>{item.title}</strong></div></article>)}</section>
        <section className="bfa-portal-panel"><div className="bfa-panel-title"><div><p className="bfa-eyebrow">Live standings</p><h2>Top candidates</h2></div><Link to={`${CANONICAL_ROOT}/leaderboard`}>Full board</Link></div>{leaders.map((entry, index) => <article className="bfa-leader-line" key={entry.candidateId}><span>{["🥇", "🥈", "🥉"][index]}</span><div><strong>{entry.displayName}</strong><small>{entry.schoolName}</small></div><b>{entry.score}/40</b></article>)}{!leaders.length ? <div className="bfa-panel-empty">Verified results will appear here.</div> : null}</section>
      </div>
    </BrightFutureLayout>
  );
}

export function BrightFutureProfilePage() {
  const { candidate, setCandidate } = useBrightFuture();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState(candidate);
  const locked = candidate.examStarted;
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try { const data = await updateBrightFutureProfile(form); setCandidate(data.candidate); setForm(data.candidate); setEditing(false); setMessage("Your student profile has been updated."); }
    catch (requestError) { setError(requestError.message || "Profile update failed."); }
    finally { setSaving(false); }
  };
  return (
    <BrightFutureLayout portal activeKey="profile">
      <PortalHeading eyebrow="Student identity" title="My profile" copy="Review the information attached to your official competition identity." action={!locked ? <button className="bfa-button" type="button" onClick={() => setEditing((value) => !value)}>{editing ? "Cancel editing" : "Edit profile"}</button> : <StatusBadge tone="gold">Locked after exam start</StatusBadge>} />
      {message ? <div className="bfa-notice bfa-notice--green">{message}</div> : null}{error ? <div className="bfa-alert" role="alert">{error}</div> : null}
      <div className="bfa-profile-grid">
        <section className="bfa-profile-card"><div className="bfa-profile-avatar">{candidate.firstName.slice(0, 1)}{candidate.lastName.slice(0, 1)}</div><h2>{candidate.fullName}</h2><p>{candidate.classLevel} · {candidate.schoolName}</p><strong>{candidate.candidateId}</strong><StatusBadge tone={candidate.examCompleted ? "green" : "blue"}>{candidate.competitionStatus.replaceAll("_", " ")}</StatusBadge></section>
        <section className="bfa-portal-panel bfa-profile-details">
          {editing ? (
            <form onSubmit={save} className="bfa-profile-form"><div className="bfa-form-grid bfa-form-grid--three"><label>First name<input name="firstName" value={form.firstName} onChange={update} /></label><label>Middle name<input name="middleName" value={form.middleName || ""} onChange={update} /></label><label>Last name<input name="lastName" value={form.lastName} onChange={update} /></label></div><div className="bfa-form-grid bfa-form-grid--three"><label>Age<input type="number" name="age" value={form.age} onChange={update} /></label><label>Gender<select name="gender" value={form.gender} onChange={update}><option value="female">Female</option><option value="male">Male</option></select></label><label>Class<select name="classLevel" value={form.classLevel} onChange={update}>{CLASS_GROUPS.flatMap((group) => group.values).map((value) => <option key={value}>{value}</option>)}</select></label></div><label>School<input name="schoolName" value={form.schoolName} onChange={update} /></label><div className="bfa-form-grid"><label>State<select name="state" value={form.state} onChange={update}>{NIGERIAN_STATES.map((state) => <option key={state}>{state}</option>)}</select></label><label>LGA<input name="lga" value={form.lga} onChange={update} /></label></div><button className="bfa-button bfa-button--primary" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button></form>
          ) : (
            <dl className="bfa-definition-grid"><div><dt>Candidate ID</dt><dd>{candidate.candidateId}</dd></div><div><dt>Full name</dt><dd>{candidate.fullName}</dd></div><div><dt>Class</dt><dd>{candidate.classLevel}</dd></div><div><dt>School</dt><dd>{candidate.schoolName}</dd></div><div><dt>State / LGA</dt><dd>{candidate.state} · {candidate.lga}</dd></div><div><dt>Competition status</dt><dd>{candidate.competitionStatus.replaceAll("_", " ")}</dd></div><div><dt>Result availability</dt><dd>{candidate.resultAvailable ? "Available" : "Not yet available"}</dd></div><div><dt>Registration date</dt><dd>{new Date(candidate.registrationTimestamp).toLocaleDateString()}</dd></div></dl>
          )}
        </section>
      </div>
    </BrightFutureLayout>
  );
}

export function BrightFutureSubjectsPage() {
  return <BrightFutureLayout portal activeKey="subjects"><PortalHeading eyebrow="Academic programme" title="Official competition subjects" copy="Each subject contributes 10 questions to the same 40-question national challenge." /><div className="bfa-subject-detail-grid">{SUBJECTS.map((subject, index) => <article className={`bfa-subject-detail is-${subject.tone}`} key={subject.key}><span>{subject.mark}</span><small>Subject {index + 1} · 10 marks</small><h2>{subject.name}</h2><p>{subject.copy}</p><ul>{["Reasoning-led questions", "Five options per question", "One verified correct answer"].map((item) => <li key={item}>✓ {item}</li>)}</ul></article>)}</div><div className="bfa-notice"><strong>Fair across class levels</strong><p>The challenge prioritises reasoning, numeracy, literacy, observation and practical understanding instead of highly specialised senior-only topics.</p></div></BrightFutureLayout>;
}

export function BrightFutureAssignmentsPage() {
  return <BrightFutureLayout portal activeKey="assignments"><PortalHeading eyebrow="School portal preview" title="Assignments" copy="Starter academic tasks show how live teacher-managed assignments will appear in the portal." action={<StatusBadge tone="gold">Informational starter content</StatusBadge>} /><div className="bfa-assignment-grid">{ASSIGNMENTS.map((item) => <article key={item.title}><div><span>{item.subject.slice(0, 2)}</span><StatusBadge tone={item.status === "In progress" ? "blue" : "gray"}>{item.status}</StatusBadge></div><small>{item.subject}</small><h2>{item.title}</h2><p>{item.copy}</p><footer><span>Due {item.due}</span><button type="button" onClick={() => window.alert("This starter assignment is informational. Teacher submissions will be enabled in a future school release.")}>View brief →</button></footer></article>)}</div></BrightFutureLayout>;
}

export function BrightFutureAttendancePage() {
  const days = Array.from({ length: 30 }, (_, index) => index + 1);
  return <BrightFutureLayout portal activeKey="attendance"><PortalHeading eyebrow="School attendance" title="Attendance overview" copy="This preview is separate from CBT participation and illustrates the future school attendance record." action={<StatusBadge tone="gold">Demo school data</StatusBadge>} /><div className="bfa-attendance-stats"><article><span>✓</span><strong>18</strong><small>Present days</small></article><article><span>×</span><strong>2</strong><small>Absent days</small></article><article><span>◷</span><strong>90%</strong><small>Attendance rate</small></article></div><section className="bfa-portal-panel bfa-calendar"><div className="bfa-panel-title"><div><p className="bfa-eyebrow">August 2026</p><h2>Attendance calendar preview</h2></div></div><div className="bfa-calendar__week">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div><div className="bfa-calendar__days">{days.map((day) => <span key={day} className={day === 12 || day === 24 ? "is-absent" : day < 27 ? "is-present" : ""}>{day}<i /></span>)}</div><footer><span><i className="is-present" />Present</span><span><i className="is-absent" />Absent</span><span><i />No school / future</span></footer></section></BrightFutureLayout>;
}

export function BrightFutureAnnouncementsPage() {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => ANNOUNCEMENTS.filter((item) => `${item.title} ${item.copy} ${item.tag}`.toLowerCase().includes(query.toLowerCase())), [query]);
  return <BrightFutureLayout portal activeKey="announcements"><PortalHeading eyebrow="Academy updates" title="Announcements" copy="Important competition instructions, result notices and school academic updates." action={<label className="bfa-search"><span>⌕</span><input aria-label="Search announcements" placeholder="Search announcements" value={query} onChange={(event) => setQuery(event.target.value)} /></label>} /><div className="bfa-announcement-grid">{filtered.map((item, index) => <article key={item.title}><span>{String(index + 1).padStart(2, "0")}</span><div><StatusBadge tone={item.tag === "Competition" ? "gold" : "blue"}>{item.tag}</StatusBadge><small>{item.date}</small><h2>{item.title}</h2><p>{item.copy}</p></div></article>)}{!filtered.length ? <div className="bfa-panel-empty">No announcement matches that search.</div> : null}</div></BrightFutureLayout>;
}

export function BrightFutureTeachersPage() {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => SAMPLE_TEACHERS.filter((teacher) => `${teacher.name} ${teacher.subject}`.toLowerCase().includes(query.toLowerCase())), [query]);
  return <BrightFutureLayout portal activeKey="teachers"><PortalHeading eyebrow="Teacher directory" title="Academic team preview" copy="Clearly labelled sample profiles demonstrate the planned professional teacher directory." action={<label className="bfa-search"><span>⌕</span><input aria-label="Search teachers" placeholder="Search name or subject" value={query} onChange={(event) => setQuery(event.target.value)} /></label>} /><div className="bfa-teacher-grid">{filtered.map((teacher) => <article key={teacher.name}><div className="bfa-teacher-avatar">{teacher.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div><StatusBadge tone="gray">Sample profile</StatusBadge><h2>{teacher.name}</h2><strong>{teacher.subject}</strong><small>{teacher.qualification}</small><p>{teacher.bio}</p></article>)}</div><div className="bfa-notice"><strong>Privacy-conscious directory</strong><p>These are fictional/sample profiles, not claims about real staff. Approved teacher records can replace them when the school supplies verified information.</p></div></BrightFutureLayout>;
}
