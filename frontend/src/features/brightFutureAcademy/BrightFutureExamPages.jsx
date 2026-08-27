import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import BrightFutureLayout from "./BrightFutureLayout";
import { CANONICAL_ROOT, LEGACY_SUBJECTS, SUBJECTS } from "./brightFutureData";
import {
  answerBrightFutureExam,
  getBrightFutureExam,
  getBrightFutureResult,
  recordBrightFutureViolation,
  startBrightFutureExam,
  submitBrightFutureExam,
} from "./brightFutureApi";
import useBrightFuture from "./useBrightFuture";

const OPTION_LABELS = ["A", "B", "C", "D", "E"];
const BLOCKED_KEYS = new Set(["a", "c", "p", "s", "u", "x"]);
const formatTime = (seconds = 0) => `00:${String(Math.max(0, seconds)).padStart(2, "0")}`;
const formatDuration = (seconds = 0) => {
  const minutes = Math.floor(Number(seconds || 0) / 60);
  const rest = Math.round(Number(seconds || 0) % 60);
  return `${minutes}m ${rest}s`;
};
const makeIdempotencyKey = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

const playTone = (frequency, duration = 0.08) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {return;}
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.045;
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.stop(context.currentTime + duration);
  } catch { /* sound is an enhancement */ }
};

export function BrightFutureExamInstructionsPage() {
  const navigate = useNavigate();
  const { candidate, competition } = useBrightFuture();
  const [accepted, setAccepted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const start = async () => {
    if (candidate.examCompleted) { navigate(`${CANONICAL_ROOT}/result`); return; }
    setStarting(true); setError("");
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen().catch(() => null);
      }
      await startBrightFutureExam();
      playTone(520, 0.15);
      navigate(`${CANONICAL_ROOT}/exam`);
    } catch (requestError) {
      setError(requestError.message || "The examination could not be started.");
    } finally { setStarting(false); }
  };

  return (
    <BrightFutureLayout portal activeKey="exam">
      <header className="bfa-instructions-heading"><p className="bfa-eyebrow">Official examination rules</p><h1>Bright Future Academy<br /><span>National CBT Challenge</span></h1><p>Read every rule before starting your one official attempt.</p></header>
      <div className="bfa-exam-summary"><article><span>▥</span><strong>50</strong><small>Total questions</small></article><article><span>◇</span><strong>5</strong><small>Challenge categories</small></article><article><span>◷</span><strong>{competition?.questionTimerSeconds || 50}s</strong><small>Per question</small></article><article><span>1×</span><strong>One</strong><small>Official attempt</small></article></div>
      <section className="bfa-instruction-panel">
        <div className="bfa-panel-title"><div><p className="bfa-eyebrow">Before you begin</p><h2>Examination instructions</h2></div><span className="bfa-secure-chip">◆ Secure session</span></div>
        <div className="bfa-rule-grid">
          {[
            ["01", "Five challenging categories", "Entertainment, Football, Technology, General English, and Mathematics & Science/STEM each contain 10 questions."],
            ["02", "Five options, one answer", "Every question has options A–E. Select only one before moving forward."],
            ["03", "A strict question timer", `You have ${competition?.questionTimerSeconds || 50} seconds for each question. An expired question cannot be revisited.`],
            ["04", "One official attempt", "Refreshing or opening another tab does not restart your attempt or add time."],
            ["05", "Stay on the examination screen", `Leaving, switching tabs or exiting fullscreen is recorded. ${competition?.allowedViolations || 3} violations cause automatic submission.`],
            ["06", "Protect examination content", "Copying, printing, screenshots, screen recording, photographing or sharing questions is prohibited."],
          ].map(([number, title, copy]) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{copy}</p></div></article>)}
        </div>
        <div className="bfa-screenshot-policy"><span>!</span><p><strong>Important screenshot limitation</strong>A browser cannot technically prevent every operating-system screenshot or external camera. Candidate watermarks and focus monitoring deter sharing, and suspicious activity may lead to disqualification.</p></div>
        <div className="bfa-candidate-check"><span>{candidate.firstName.slice(0, 1)}{candidate.lastName.slice(0, 1)}</span><div><small>Candidate taking this examination</small><strong>{candidate.fullName}</strong><p>{candidate.candidateId} · {candidate.classLevel} · {candidate.schoolName}</p></div></div>
        {error ? <div className="bfa-alert" role="alert">{error}</div> : null}
        <label className="bfa-rules-check"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>✓</span><p><strong>I have read and understood the examination rules.</strong>I understand that all class levels write the same challenge and that my official attempt cannot be repeated without administrator approval.</p></label>
        <button type="button" className="bfa-button bfa-button--primary bfa-button--large bfa-start-exam" disabled={!accepted || starting || (!competition?.examinationOpen && !candidate.examStarted)} onClick={start}>{starting ? <><span className="bfa-spinner" /> Securing examination…</> : candidate.examCompleted ? "View My Result →" : candidate.examStarted ? "Resume Examination →" : "Start Examination →"}</button>
      </section>
    </BrightFutureLayout>
  );
}

export function BrightFutureExamPage() {
  const navigate = useNavigate();
  const { candidate, refreshCandidate } = useBrightFuture();
  const [attempt, setAttempt] = useState(null);
  const [selected, setSelected] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState(null);
  const [transition, setTransition] = useState(null);
  const [muted, setMuted] = useState(() => { try { return localStorage.getItem("brightFutureMuted") === "true"; } catch { return false; } });
  const timeoutHandled = useRef("");
  const lastViolationAt = useRef(0);
  const fullscreenEntered = useRef(Boolean(document.fullscreenElement));
  const previousSeconds = useRef(null);

  const question = attempt?.currentQuestion;
  const deadline = question?.deadlineAt ? new Date(question.deadlineAt).getTime() : 0;
  const secondsRemaining = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;

  const applyAttempt = useCallback((nextAttempt) => {
    setAttempt(nextAttempt || null);
    setSelected(null);
    timeoutHandled.current = "";
    if (nextAttempt && nextAttempt.status !== "in_progress") {
      refreshCandidate({ quiet: true });
      navigate(`${CANONICAL_ROOT}/result`, { replace: true });
    }
  }, [navigate, refreshCandidate]);

  const recover = useCallback(async () => {
    setLoading(true); setError("");
    try { const data = await getBrightFutureExam(); applyAttempt(data.attempt); }
    catch (requestError) {
      if (requestError.code === "exam_not_started") {navigate(`${CANONICAL_ROOT}/exam/instructions`, { replace: true });}
      else {setError(requestError.message || "The examination could not be restored.");}
    } finally { setLoading(false); }
  }, [applyAttempt, navigate]);

  useEffect(() => { recover(); }, [recover]);
  useEffect(() => { const interval = window.setInterval(() => setNow(Date.now()), 250); return () => window.clearInterval(interval); }, []);
  useEffect(() => { try { localStorage.setItem("brightFutureMuted", String(muted)); } catch { /* enhancement */ } }, [muted]);
  useEffect(() => {
    if (muted || secondsRemaining === previousSeconds.current) {return;}
    if (secondsRemaining === 10) {playTone(620, 0.1);}
    if (secondsRemaining <= 5 && secondsRemaining > 0) {playTone(760, 0.06);}
    previousSeconds.current = secondsRemaining;
  }, [muted, secondsRemaining]);

  const sendAnswer = useCallback(async ({ automatic = false } = {}) => {
    if (!question || submitting || selected === null) {return;}
    setSubmitting(true); setError("");
    try {
      const data = await answerBrightFutureExam({ questionId: question.id, selectedOptionIndex: selected, idempotencyKey: makeIdempotencyKey() });
      if (!muted) {playTone(430, 0.08);}
      if (data.subjectTransition?.completedSubject && data.attempt?.status === "in_progress") {
        setTransition(data.subjectTransition);
        window.setTimeout(() => { setTransition(null); applyAttempt(data.attempt); }, 1300);
      } else {applyAttempt(data.attempt);}
    } catch (requestError) {
      if (requestError.payload?.attempt) {applyAttempt(requestError.payload.attempt);}
      else if (requestError.code === "attempt_changed") {await recover();}
      else {setError(automatic ? "Your timed answer could not be confirmed. Reconnecting safely…" : requestError.message || "Answer submission failed. Your attempt is still safe.");}
      if (automatic) {window.setTimeout(recover, 900);}
    } finally { setSubmitting(false); }
  }, [applyAttempt, muted, question, recover, selected, submitting]);

  useEffect(() => {
    if (!question || secondsRemaining > 0 || timeoutHandled.current === question.id) {return;}
    timeoutHandled.current = question.id;
    if (selected !== null) {sendAnswer({ automatic: true });}
    else {window.setTimeout(recover, 250);}
  }, [question, recover, secondsRemaining, selected, sendAnswer]);

  const reportViolation = useCallback(async (type, detail = "") => {
    const timestamp = Date.now();
    if (!attempt || attempt.status !== "in_progress" || timestamp - lastViolationAt.current < 1800) {return;}
    lastViolationAt.current = timestamp;
    try {
      const data = await recordBrightFutureViolation({ type, detail, occurredAt: new Date().toISOString() });
      if (data.autoSubmitted) { applyAttempt(data.attempt); return; }
      if (data.recorded) {
        setAttempt(data.attempt);
        setWarning({ count: data.attempt.violationCount, limit: data.attempt.allowedViolations });
      }
    } catch { /* do not disrupt the answer flow; the next recovery remains server-authoritative */ }
  }, [applyAttempt, attempt]);

  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === "hidden") {reportViolation("visibility_hidden", "Examination tab became hidden");} };
    const onBlur = () => reportViolation("window_blur", "Examination window lost focus");
    const onFullscreen = () => {
      if (document.fullscreenElement) {fullscreenEntered.current = true;}
      else if (fullscreenEntered.current) {reportViolation("fullscreen_exit", "Candidate exited fullscreen");}
    };
    const onKeyDown = (event) => {
      const key = String(event.key || "").toLowerCase();
      if ((event.ctrlKey || event.metaKey) && BLOCKED_KEYS.has(key)) { event.preventDefault(); if (key === "p") {reportViolation("print_shortcut", "Print shortcut blocked");} }
    };
    const block = (event) => event.preventDefault();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("copy", block);
    document.addEventListener("contextmenu", block);
    document.addEventListener("dragstart", block);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility); window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFullscreen); document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("copy", block); document.removeEventListener("contextmenu", block); document.removeEventListener("dragstart", block);
    };
  }, [reportViolation]);

  const endExam = async () => {
    if (!window.confirm("Submit the examination now? Every remaining question will be recorded as unanswered, and this cannot be undone.")) {return;}
    setSubmitting(true);
    try { const data = await submitBrightFutureExam({ reason: "student_submit" }); applyAttempt(data.attempt); }
    catch (requestError) { setError(requestError.message || "Submission failed. Your attempt remains safe on the server."); }
    finally { setSubmitting(false); }
  };

  const watermarkText = `${candidate.candidateId} · ${candidate.fullName.toUpperCase()}`;
  if (loading || !attempt) {return <div className="bfa-exam-shell"><div className="bfa-page-loader"><span /><p>Restoring the secure examination…</p></div>{error ? <button type="button" onClick={recover}>Try again</button> : null}</div>;}

  return (
    <div className="bfa-exam-shell">
      <div className="bfa-watermark" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <span key={index}>{watermarkText}<small>{new Date(now).toLocaleString()}</small></span>)}</div>
      <header className="bfa-exam-header"><div><strong>BRIGHT FUTURE ACADEMY</strong><small>CBT CHALLENGE</small></div><p>Entertainment <i>•</i> Football <i>•</i> Tech <i>•</i> English <i>•</i> STEM</p><div><button type="button" onClick={() => setMuted((value) => !value)} aria-label={muted ? "Unmute exam sounds" : "Mute exam sounds"}>{muted ? "🔇" : "🔊"}</button><button type="button" className="bfa-end-exam" onClick={endExam}>Submit exam</button></div></header>
      <div className="bfa-exam-progress"><span style={{ width: `${((question.number - 1) / question.totalQuestions) * 100}%` }} /></div>
      <main className="bfa-exam-content">
        <div className="bfa-exam-meta"><div><span className={`bfa-subject-dot is-${question.subject}`} /> <strong>{question.subjectLabel}</strong><small>Question {question.subjectQuestionNumber} of 10</small></div><p>Question <strong>{question.number}</strong> of {question.totalQuestions}</p><div className={`bfa-exam-timer ${secondsRemaining <= 10 ? "is-warning" : ""} ${secondsRemaining <= 5 ? "is-critical" : ""}`}><small>Time remaining</small><strong>{formatTime(secondsRemaining)}</strong></div></div>
        <section className="bfa-question-card" aria-live="polite"><p className="bfa-question-label">Choose the best answer</p><h1>{question.prompt}</h1><div className="bfa-option-list" role="radiogroup" aria-label="Answer options">{question.options.map((option, index) => <button type="button" role="radio" aria-checked={selected === index} className={selected === index ? "is-selected" : ""} key={`${question.id}-${index}`} onClick={() => setSelected(index)} disabled={submitting}><span>{OPTION_LABELS[index]}</span><p>{option}</p><i>✓</i></button>)}</div>{error ? <div className="bfa-alert" role="alert">{error}</div> : null}<footer><p><span>!</span> Screenshots, copying, recording and sharing questions are prohibited.</p><button type="button" className="bfa-button bfa-button--primary" onClick={() => sendAnswer()} disabled={selected === null || submitting}>{submitting ? "Saving answer…" : question.number === question.totalQuestions ? "Finish Examination →" : "Submit & Continue →"}</button></footer></section>
      </main>
      {warning ? <div className="bfa-modal-backdrop"><section className="bfa-warning-modal" role="alertdialog" aria-modal="true"><span>!</span><p className="bfa-eyebrow">Examination warning</p><h2>Leaving the examination is not allowed.</h2><p>Your activity has been recorded. Repeated violations automatically submit your official attempt.</p><div><strong>Violation {warning.count} of {warning.limit}</strong><span>{Array.from({ length: warning.limit }, (_, index) => <i key={index} className={index < warning.count ? "is-filled" : ""} />)}</span></div><button type="button" className="bfa-button bfa-button--primary" onClick={() => setWarning(null)}>I understand — continue</button></section></div> : null}
      {transition ? <div className="bfa-modal-backdrop"><section className="bfa-transition-modal"><span>✓</span><p>{transition.completedSubject}</p><h2>Subject complete!</h2><small>{transition.nextSubject ? `Next subject: ${transition.nextSubject}` : "Preparing your result"}</small></section></div> : null}
    </div>
  );
}

export function BrightFutureResultPage() {
  const { candidate, refreshCandidate } = useBrightFuture();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    getBrightFutureResult().then((data) => { setResult(data.result); refreshCandidate({ quiet: true }); }).catch((requestError) => setError(requestError.message || "Result unavailable.")).finally(() => setLoading(false));
  }, [refreshCandidate]);
  const subjectScores = useMemo(() => result ? (result.maximumScore === 40 ? LEGACY_SUBJECTS : SUBJECTS).map((subject) => ({ ...subject, score: result.subjectScores[subject.key] || 0 })) : [], [result]);
  if (loading) {return <BrightFutureLayout portal activeKey="result"><div className="bfa-page-loader"><span /><p>Verifying your result…</p></div></BrightFutureLayout>;}
  if (!result) {return <BrightFutureLayout portal activeKey="result"><div className="bfa-empty-state"><span>▥</span><h1>Your result is not ready yet</h1><p>{error || "Complete and submit your examination to see verified scores."}</p><Link className="bfa-button bfa-button--primary" to={`${CANONICAL_ROOT}/exam/instructions`}>{candidate.examStarted ? "Resume examination" : "Read examination rules"}</Link></div></BrightFutureLayout>;}
  return (
    <BrightFutureLayout portal activeKey="result">
      <section className="bfa-result-hero"><div className="bfa-result-confetti" aria-hidden="true">✦ ● ◆ ✦ ●</div><span className="bfa-result-medal">★</span><p className="bfa-eyebrow">Examination complete</p><h1>Congratulations, {result.candidate.firstName}!</h1><p>Your official answers have been scored securely. This is your current verified competition result.</p><div className="bfa-result-score"><strong>{result.totalScore}</strong><span>/{result.maximumScore}<small>Total score</small></span><i>{result.percentage}%</i></div><div className="bfa-result-rank"><small>Current rank</small><strong>#{result.rank || "—"}</strong></div></section>
      <section className="bfa-result-candidate"><div><small>Candidate</small><strong>{result.candidate.fullName}</strong></div><div><small>Candidate ID</small><strong>{result.candidate.candidateId}</strong></div><div><small>Class</small><strong>{result.candidate.classLevel}</strong></div><div><small>School</small><strong>{result.candidate.schoolName}</strong></div></section>
      <section className="bfa-result-subjects"><div className="bfa-panel-title"><div><p className="bfa-eyebrow">Subject performance</p><h2>Your score breakdown</h2></div></div><div>{subjectScores.map((subject) => <article className={`is-${subject.tone}`} key={subject.key}><span>{subject.mark}</span><div><small>{subject.name}</small><div className="bfa-score-bar"><i style={{ width: `${subject.score * 10}%` }} /></div></div><strong>{subject.score}<small>/10</small></strong></article>)}</div></section>
      <section className="bfa-result-stats"><article><span>✓</span><strong>{result.totalCorrect}</strong><small>Correct</small></article><article><span>×</span><strong>{result.totalWrong}</strong><small>Wrong</small></article><article><span>—</span><strong>{result.totalUnanswered}</strong><small>Unanswered</small></article><article><span>◷</span><strong>{formatDuration(result.totalTimeUsed)}</strong><small>Total time</small></article><article><span>≈</span><strong>{result.averageResponseTime}s</strong><small>Average response</small></article></section>
      <div className="bfa-result-actions"><Link className="bfa-button bfa-button--primary bfa-button--large" to={`${CANONICAL_ROOT}/leaderboard`}>View Competition Leaderboard →</Link><Link className="bfa-button bfa-button--large" to={`${CANONICAL_ROOT}/dashboard`}>Return to Dashboard</Link></div>
      {!result.detailedResultsVisible ? <div className="bfa-notice"><strong>Detailed answer review is currently hidden</strong><p>To protect the active competition, the correct answer key is not published. Administrators can enable detailed review after the competition closes.</p></div> : null}
    </BrightFutureLayout>
  );
}
