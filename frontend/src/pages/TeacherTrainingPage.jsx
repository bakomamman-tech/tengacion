import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import SeoHead from "../components/seo/SeoHead";
import {
  answerTeacherTrainingQuestion,
  fetchTeacherTrainingStatus,
  startTeacherTrainingModule,
} from "../services/teacherTrainingService";

import "./teacher-training.css";

const OPTION_LABELS = ["A", "B", "C", "D"];
const BLOCKED_SHORTCUTS = new Set(["a", "c", "p", "s", "u", "x"]);
const FLYER_PATH =
  "/assets/kurah-academy/staff-teachers-online-training.png";

const preventProtectedAction = (event) => event.preventDefault();

const formatCampaignDate = (value, options = {}) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
  }).format(date);
};

const formatWeekRange = (startAt, endAt) =>
  `${formatCampaignDate(startAt, { day: "numeric", month: "short" })} – ${formatCampaignDate(
    endAt,
    { day: "numeric", month: "short" }
  )}`;

const getModuleNumber = (code = "") => String(code).replace(/\D+/g, "");

const getModuleStatus = (module) => {
  if (module?.attempt?.status === "completed") {
    return "completed";
  }
  if (module?.attempt?.status === "in_progress") {
    return "in_progress";
  }
  return "not_started";
};

const getAccessMessage = (access = {}) => {
  if (access.isPreview) {
    return "Assessments open 1 August at 12:00 AM WAT.";
  }
  if (access.isClosed) {
    return "The 2026 assessment window is closed.";
  }
  return "Assessment available now.";
};

function TrainingIcon({ name }) {
  const paths = {
    book: (
      <>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11a3 3 0 0 1 3 3v14a3 3 0 0 0-3-3H6.5A2.5 2.5 0 0 0 4 19.5v-14Z" />
        <path d="M24 5.5A2.5 2.5 0 0 0 21.5 3H17a3 3 0 0 0-3 3v14a3 3 0 0 1 3-3h4.5a2.5 2.5 0 0 1 2.5 2.5v-14Z" />
      </>
    ),
    clock: (
      <>
        <circle cx="14" cy="14" r="10" />
        <path d="M14 8v6l4 2" />
      </>
    ),
    award: (
      <>
        <circle cx="14" cy="11" r="7" />
        <path d="m10 17-2 8 6-3 6 3-2-8" />
      </>
    ),
    shield: (
      <>
        <path d="M14 3 24 7v6c0 6-4.2 10.1-10 12-5.8-1.9-10-6-10-12V7l10-4Z" />
        <path d="m10 14 2.5 2.5L19 10" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 14h18" />
        <path d="m17 8 6 6-6 6" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="12" width="18" height="13" rx="3" />
        <path d="M9 12V9a5 5 0 0 1 10 0v3" />
      </>
    ),
  };
  return (
    <svg
      className="training-icon"
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.book}
    </svg>
  );
}

function ProgressRing({ value = 0, label = "complete" }) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div
      className="training-progress-ring"
      style={{ "--training-progress": `${safeValue * 3.6}deg` }}
      aria-label={`${safeValue}% ${label}`}
    >
      <strong>{safeValue}%</strong>
      <span>{label}</span>
    </div>
  );
}

function GuestTrainingLanding() {
  const [showFlyer, setShowFlyer] = useState(false);
  return (
    <main className="teacher-training-page teacher-training-page--guest">
      <SeoHead
        title="Staff Teachers Online Training | Kurah Tech and Arts Academy"
        description="Kurah Tech and Arts Academy's self-paced professional development programme for staff teachers."
        canonical="/kurahtechandartsacademy/training"
        robots="index,follow"
        ogType="website"
        ogImage={FLYER_PATH}
        ogImageAlt="Kurah Tech and Arts Academy staff teachers online training flyer"
      />
      <div className="training-guest-orb training-guest-orb--one" />
      <div className="training-guest-orb training-guest-orb--two" />
      <nav className="training-topbar">
        <Link className="training-brand" to="/kurahtechandartsacademy">
          <img src="/assets/kurah-academy/logo.jpg" alt="" />
          <span>
            <strong>Kurah Academy</strong>
            <small>Teachers’ Learning Studio</small>
          </span>
        </Link>
        <div className="training-topbar__actions">
          <Link to="/login">Sign in</Link>
          <Link className="is-primary" to="/register">Create account</Link>
        </div>
      </nav>

      <section className="training-guest-hero">
        <div className="training-guest-copy">
          <p className="training-eyebrow">
            <span />
            1–31 August 2026 · Self-paced
          </p>
          <h1>Teach with deeper knowledge and sharper practice.</h1>
          <p className="training-guest-lead">
            A focused professional journey through 22 education modules, designed
            for the teachers of Kurah Tech and Arts Academy.
          </p>
          <div className="training-guest-actions">
            <Link className="training-button training-button--gold" to="/login">
              Enter training
              <TrainingIcon name="arrow" />
            </Link>
            <button type="button" onClick={() => setShowFlyer(true)}>
              View full flyer
            </button>
          </div>
          <div className="training-guest-facts" aria-label="Training facts">
            <span><strong>22</strong> modules</span>
            <span><strong>20s</strong> per question</span>
            <span><strong>60%</strong> pass mark</span>
          </div>
        </div>
        <button
          className="training-flyer-card"
          type="button"
          onClick={() => setShowFlyer(true)}
          aria-label="Open the complete training flyer"
        >
          <span className="training-flyer-card__tape" />
          <img src={FLYER_PATH} alt="Kurah Academy staff teachers online training flyer" />
          <span className="training-flyer-card__hint">Tap to enlarge</span>
        </button>
      </section>

      {showFlyer ? (
        <div
          className="training-flyer-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Training flyer"
          onClick={() => setShowFlyer(false)}
        >
          <button type="button" onClick={() => setShowFlyer(false)} aria-label="Close flyer">
            ×
          </button>
          <img src={FLYER_PATH} alt="Kurah Academy staff teachers online training flyer" />
        </div>
      ) : null}
    </main>
  );
}

function ModuleScore({ attempt, compact = false }) {
  if (!attempt || attempt.status !== "completed") {
    return null;
  }
  return (
    <div className={`training-module-score${compact ? " is-compact" : ""}`}>
      <div>
        <span>Module result</span>
        <strong>{attempt.scorePercent}%</strong>
      </div>
      <p className={`is-${attempt.performance?.id || "support"}`}>
        {attempt.performance?.label || "Result"}
      </p>
      {!compact ? (
        <small>
          {attempt.correctAnswers} of 5 correct · {attempt.timedOutAnswers} timed out
        </small>
      ) : null}
    </div>
  );
}

function ModuleReader({ module, access, onBack, onStart, working }) {
  const assessmentOpen = Boolean(access?.isOpen);
  const completed = module?.attempt?.status === "completed";

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [module?.code]);

  return (
    <main className="training-reader">
      <nav className="training-reader-nav">
        <button type="button" onClick={onBack}>
          <span aria-hidden="true">←</span>
          All modules
        </button>
        <div>
          <span>{module.code}</span>
          <strong>{module.title}</strong>
        </div>
        <img src="/assets/kurah-academy/logo.jpg" alt="Kurah Academy" />
      </nav>

      <header className="training-reader-hero">
        <div>
          <p className="training-eyebrow">
            <span />
            Module {getModuleNumber(module.code)} · {module.strand}
          </p>
          <h1>{module.title}</h1>
          <p>{module.overview}</p>
          <div className="training-reader-meta">
            <span><TrainingIcon name="clock" /> {module.duration}</span>
            <span><TrainingIcon name="book" /> {module.units} {module.units === 1 ? "unit" : "units"}</span>
            <span><TrainingIcon name="award" /> 5 challenge questions</span>
          </div>
        </div>
        <div className="training-reader-number" aria-hidden="true">
          {getModuleNumber(module.code)}
        </div>
      </header>

      <div className="training-reader-layout">
        <aside className="training-reader-outline">
          <p>In this module</p>
          <a href="#module-overview">Overview</a>
          <a href="#module-key-ideas">Key ideas</a>
          <a href="#module-practice">Practice moves</a>
          <a href="#module-assessment">Assessment</a>
          <div className="training-reader-outline__status">
            <span>{completed ? "Completed" : "Your status"}</span>
            <strong>{completed ? `${module.attempt.scorePercent}%` : "Ready to learn"}</strong>
          </div>
        </aside>

        <article className="training-reader-content">
          <section id="module-overview" className="training-learning-block">
            <p className="training-section-label">01 · Learning destination</p>
            <h2>What you will be able to do</h2>
            <div className="training-outcomes-grid">
              {module.outcomes.map((outcome, index) => (
                <div key={outcome}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>{outcome}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="module-key-ideas" className="training-learning-block">
            <p className="training-section-label">02 · Core reading</p>
            <h2>Three ideas to carry into the classroom</h2>
            <div className="training-key-ideas">
              {module.keyIdeas.map((idea, index) => (
                <article key={idea.title}>
                  <span aria-hidden="true">0{index + 1}</span>
                  <div>
                    <h3>{idea.title}</h3>
                    <p>{idea.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section id="module-practice" className="training-learning-block">
            <p className="training-section-label">03 · Transfer to practice</p>
            <h2>Moves to try at Kurah Academy</h2>
            <div className="training-practice-panel">
              <div className="training-practice-panel__mark">KTA</div>
              <ol>
                {module.classroomPractice.map((item) => <li key={item}>{item}</li>)}
              </ol>
            </div>
          </section>

          <section id="module-assessment" className="training-assessment-callout">
            <div className="training-assessment-callout__icon">
              <TrainingIcon name={completed ? "award" : "shield"} />
            </div>
            {completed ? (
              <>
                <p className="training-section-label">Module completed</p>
                <h2>Your performance is ready</h2>
                <ModuleScore attempt={module.attempt} />
                <button className="training-button training-button--navy" type="button" onClick={onBack}>
                  Return to modules
                  <TrainingIcon name="arrow" />
                </button>
              </>
            ) : (
              <>
                <p className="training-section-label">04 · Timed assessment</p>
                <h2>Ready for the knowledge challenge?</h2>
                <p>
                  Five difficult questions will appear one at a time. Each question
                  and its A–D answers stay on screen for exactly 20 seconds. The
                  assessment cannot be paused or restarted.
                </p>
                <ul>
                  <li>Unanswered questions receive zero automatically.</li>
                  <li>Question and answer order is protected and randomised.</li>
                  <li>Your module score appears as soon as all five questions finish.</li>
                </ul>
                <button
                  className="training-button training-button--gold"
                  type="button"
                  onClick={() => onStart(module.code)}
                  disabled={!assessmentOpen || working}
                >
                  {working ? "Preparing assessment…" : "Start timed assessment"}
                  <TrainingIcon name="arrow" />
                </button>
                <small>{getAccessMessage(access)}</small>
              </>
            )}
          </section>
        </article>
      </div>
    </main>
  );
}

function AssessmentStage({ training, module, onTrainingChange, onRecover }) {
  const question = module?.attempt?.currentQuestion;
  const [remainingMs, setRemainingMs] = useState(0);
  const [working, setWorking] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const timeoutSentRef = useRef("");
  const watermark = `${training?.participant?.name || "Kurah teacher"} · ${
    training?.participant?.email || "staff assessment"
  }`;

  useEffect(() => {
    if (!question?.expiresAt) {
      setRemainingMs(0);
      return undefined;
    }
    const update = () => {
      setRemainingMs(
        Math.max(0, new Date(question.expiresAt).getTime() - Date.now())
      );
    };
    update();
    const interval = window.setInterval(update, 200);
    return () => window.clearInterval(interval);
  }, [question?.id, question?.expiresAt]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const key = String(event.key || "").toLocaleLowerCase("en");
      const modifier = event.ctrlKey || event.metaKey;
      if (
        (modifier && (BLOCKED_SHORTCUTS.has(key) || key === "insert")) ||
        (event.shiftKey && key === "insert")
      ) {
        event.preventDefault();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const submitAnswer = useCallback(
    async (choice) => {
      if (!question?.id || working) {
        return;
      }
      setWorking(true);
      setSelectedIndex(Number.isInteger(choice) ? choice : null);
      try {
        const payload = await answerTeacherTrainingQuestion({
          moduleCode: module.code,
          questionId: question.id,
          selectedIndex: Number.isInteger(choice) ? choice : null,
        });
        onTrainingChange(payload.training);
      } catch (error) {
        const recovered = error?.payload?.training;
        if (recovered) {
          onTrainingChange(recovered);
        } else {
          toast.error(error?.message || "Your answer could not be recorded.");
          await onRecover();
        }
      } finally {
        setWorking(false);
        setSelectedIndex(null);
      }
    },
    [module?.code, onRecover, onTrainingChange, question?.id, working]
  );

  useEffect(() => {
    if (
      question?.id &&
      remainingMs <= 0 &&
      timeoutSentRef.current !== question.id &&
      !working
    ) {
      timeoutSentRef.current = question.id;
      submitAnswer(null);
    }
  }, [question?.id, remainingMs, submitAnswer, working]);

  if (!question) {
    return (
      <main className="training-assessment-stage training-assessment-stage--loading">
        <span className="training-loader" />
        <h1>Finalising your module result…</h1>
      </main>
    );
  }

  const secondsRemaining = Math.max(0, Math.ceil(remainingMs / 1000));
  const timerProgress = Math.max(
    0,
    Math.min(1, remainingMs / (question.timeLimitSeconds * 1000))
  );

  return (
    <main
      className="training-assessment-stage"
      onCopy={preventProtectedAction}
      onCut={preventProtectedAction}
      onContextMenu={preventProtectedAction}
      onDragStart={preventProtectedAction}
    >
      <header className="training-assessment-bar">
        <div className="training-brand">
          <img src="/assets/kurah-academy/logo.jpg" alt="" />
          <span>
            <strong>Kurah Academy</strong>
            <small>Protected assessment</small>
          </span>
        </div>
        <div className="training-assessment-module">
          <span>{module.code}</span>
          <strong>{module.title}</strong>
        </div>
        <span className="training-secure-badge">
          <TrainingIcon name="shield" />
          Session protected
        </span>
      </header>

      <section
        className="training-question-card"
        data-participant-watermark={watermark}
      >
        <div className="training-question-card__head">
          <div>
            <p>Question {question.number} of {question.totalQuestions}</p>
            <h1>Knowledge challenge</h1>
          </div>
          <div
            className={`training-question-timer${secondsRemaining <= 5 ? " is-urgent" : ""}`}
            style={{ "--timer-progress": `${timerProgress * 360}deg` }}
            aria-live="polite"
            aria-label={`${secondsRemaining} seconds remaining`}
          >
            <strong>{secondsRemaining}</strong>
            <span>seconds</span>
          </div>
        </div>

        <div className="training-question-track" aria-hidden="true">
          {Array.from({ length: question.totalQuestions }).map((_, index) => (
            <span
              key={index}
              className={
                index + 1 < question.number
                  ? "is-complete"
                  : index + 1 === question.number
                    ? "is-current"
                    : ""
              }
            />
          ))}
        </div>

        <div className="training-question-protection">
          <span>20-second limit</span>
          <span>One question at a time</span>
          <span>Auto-advance enabled</span>
        </div>

        <h2>{question.prompt}</h2>
        <div className="training-answer-grid">
          {question.options.map((option, index) => (
            <button
              type="button"
              key={`${question.id}-${index}`}
              className={selectedIndex === index ? "is-selected" : ""}
              onClick={() => submitAnswer(index)}
              disabled={working || remainingMs <= 0}
            >
              <span>{OPTION_LABELS[index]}</span>
              <strong>{option}</strong>
              <i aria-hidden="true">→</i>
            </button>
          ))}
        </div>

        <footer>
          <p>
            Choose carefully. Your answer locks immediately and cannot be changed.
          </p>
          <span>{working ? "Securing answer…" : `${question.timeLimitSeconds}s maximum`}</span>
        </footer>
      </section>
    </main>
  );
}

function WeeklySchedule({ periods = [] }) {
  return (
    <section className="training-dashboard-section">
      <div className="training-section-heading">
        <div>
          <p className="training-section-label">Your August rhythm</p>
          <h2>Four modules every full week.</h2>
        </div>
        <p>
          Completed dates are counted in the week you submitted each module.
          Finish the final six during the closing sprint.
        </p>
      </div>
      <div className="training-week-grid">
        {periods.map((period) => (
          <article key={period.id} className={`is-${period.status}`}>
            <div className="training-week-card__top">
              <span>{period.label}</span>
              <small>{formatWeekRange(period.startAt, period.endAt)}</small>
            </div>
            <strong>{period.completedInWindow}<em>/{period.target}</em></strong>
            <p>{period.subtitle}</p>
            <div className="training-week-meter">
              <span
                style={{
                  width: `${Math.min(
                    100,
                    (period.completedInWindow / Math.max(1, period.target)) * 100
                  )}%`,
                }}
              />
            </div>
            <small>
              {period.status === "met"
                ? "Weekly target achieved"
                : period.status === "missed"
                  ? "Weekly target missed"
                  : period.status === "current"
                    ? `${Math.max(0, period.target - period.completedInWindow)} to reach target`
                    : "Upcoming"}
            </small>
          </article>
        ))}
      </div>
    </section>
  );
}

function FinalResultCard({ training }) {
  const result = training?.finalResult;
  if (result) {
    return (
      <section className={`training-final-result is-${result.performance?.id || "support"}`}>
        <div className="training-final-result__seal">
          <TrainingIcon name="award" />
          <span>Final</span>
        </div>
        <div>
          <p className="training-section-label">Cumulative assessment released</p>
          <h2>{result.performance?.label}</h2>
          <p>{result.performance?.message}</p>
          <div className="training-final-result__facts">
            <span><strong>{result.scorePercent}%</strong> overall</span>
            <span><strong>{result.completedModules}/{result.totalModules}</strong> modules</span>
            <span><strong>{result.correctAnswers}/{result.possibleAnswers}</strong> correct</span>
          </div>
        </div>
        <div className="training-final-result__decision">
          <span>{result.passed ? "Standard achieved" : "Standard not achieved"}</span>
          <strong>{result.passed ? "Eligible" : "Not eligible"}</strong>
          <small>Salary increment and next-term eligibility</small>
        </div>
      </section>
    );
  }

  return (
    <section className="training-final-lock">
      <div><TrainingIcon name="lock" /></div>
      <div>
        <p className="training-section-label">Final performance</p>
        <h2>Your cumulative result stays sealed until the deadline.</h2>
        <p>{training?.finalResultLock?.message}</p>
      </div>
      <time dateTime={training?.finalResultLock?.releaseAt || ""}>
        <strong>31</strong>
        <span>August</span>
        <small>11:59 PM WAT</small>
      </time>
    </section>
  );
}

function TrainingDashboard({ training, onOpenModule }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [showFlyer, setShowFlyer] = useState(false);
  const modules = useMemo(() => training?.modules || [], [training?.modules]);
  const access = training?.campaign?.access || {};

  const visibleModules = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("en");
    return modules.filter((module) => {
      const status = getModuleStatus(module);
      const matchesFilter =
        filter === "all" ||
        (filter === "completed" && status === "completed") ||
        (filter === "pending" && status !== "completed");
      const matchesQuery =
        !normalizedQuery ||
        `${module.code} ${module.title} ${module.strand}`
          .toLocaleLowerCase("en")
          .includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [filter, modules, query]);

  const activePeriod = training?.progress?.weeklySchedule?.find(
    (period) => period.status === "current"
  );

  return (
    <main className="teacher-training-page">
      <SeoHead
        title="My Teacher Training | Kurah Tech and Arts Academy"
        description="Complete Kurah Tech and Arts Academy's self-paced staff teacher training modules and timed assessments."
        canonical="/kurahtechandartsacademy/training"
        robots="noindex,nofollow"
        ogType="website"
        ogImage={FLYER_PATH}
        ogImageAlt="Kurah Tech and Arts Academy staff teachers online training flyer"
      />
      <nav className="training-topbar">
        <Link className="training-brand" to="/kurahtechandartsacademy">
          <img src="/assets/kurah-academy/logo.jpg" alt="" />
          <span>
            <strong>Kurah Academy</strong>
            <small>Teachers’ Learning Studio</small>
          </span>
        </Link>
        <div className="training-topbar__dashboard-links">
          <a href="#training-progress">Progress</a>
          <a href="#training-modules">Modules</a>
          <a href="#training-final-result">Final result</a>
        </div>
        <div className="training-user-chip">
          <span>{training.participant.name?.charAt(0) || "T"}</span>
          <div>
            <strong>{training.participant.name}</strong>
            <small>Staff participant</small>
          </div>
        </div>
      </nav>

      <section className="training-dashboard-hero">
        <div className="training-dashboard-hero__copy">
          <p className="training-eyebrow"><span /> 2026 professional development</p>
          <h1>Learn. Apply. <em>Excel.</em></h1>
          <p>
            Your August pathway to stronger teaching, sharper judgment, and
            better learner outcomes.
          </p>
          <div className="training-dashboard-hero__actions">
            <a className="training-button training-button--gold" href="#training-modules">
              Continue learning
              <TrainingIcon name="arrow" />
            </a>
            <button type="button" onClick={() => setShowFlyer(true)}>View flyer</button>
          </div>
          <div className="training-deadline-chip">
            <span>Deadline</span>
            <strong>31 August · 11:59 PM WAT</strong>
          </div>
        </div>
        <div className="training-dashboard-hero__visual">
          <div className="training-hero-progress-card">
            <ProgressRing value={training.progress.percent} />
            <div>
              <span>Your journey</span>
              <strong>{training.progress.completedModules} of {training.progress.totalModules}</strong>
              <small>modules completed</small>
            </div>
          </div>
          <img src="/assets/kurah-academy/teachers-cultural-day.jpg" alt="Kurah Academy teachers" />
          <div className="training-hero-quote">
            <span>“</span>
            <p>Professional growth becomes visible in the choices we make for learners.</p>
          </div>
        </div>
      </section>

      <section id="training-progress" className="training-progress-strip">
        <div>
          <TrainingIcon name="book" />
          <span>Programme</span>
          <strong>22 focused modules</strong>
        </div>
        <div>
          <TrainingIcon name="clock" />
          <span>Assessment</span>
          <strong>20 seconds each</strong>
        </div>
        <div>
          <TrainingIcon name="award" />
          <span>Pass standard</span>
          <strong>60% cumulative</strong>
        </div>
        <div>
          <TrainingIcon name="shield" />
          <span>Current phase</span>
          <strong>
            {access.isPreview
              ? "Preview"
              : access.isClosed
                ? "Results"
                : activePeriod?.label || "Open"}
          </strong>
        </div>
      </section>

      <WeeklySchedule periods={training.progress.weeklySchedule} />

      <section id="training-modules" className="training-dashboard-section training-modules-section">
        <div className="training-section-heading">
          <div>
            <p className="training-section-label">Training library</p>
            <h2>Build your professional toolkit.</h2>
          </div>
          <p>
            Read each module at your own pace. Once its assessment begins, five
            questions run continuously for 100 seconds.
          </p>
        </div>

        <div className="training-module-tools">
          <div className="training-filter-tabs" role="group" aria-label="Filter modules">
            {[
              ["all", "All modules"],
              ["pending", "To complete"],
              ["completed", "Completed"],
            ].map(([id, label]) => (
              <button
                type="button"
                key={id}
                className={filter === id ? "is-active" : ""}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="training-module-search">
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a module"
              aria-label="Find a training module"
            />
          </label>
        </div>

        <div className="training-module-grid">
          {visibleModules.map((module, index) => {
            const status = getModuleStatus(module);
            return (
              <article
                className={`training-module-card is-${status}`}
                key={module.code}
                style={{ "--module-index": index }}
              >
                <div className="training-module-card__head">
                  <span>{module.code}</span>
                  <i>{module.strand}</i>
                </div>
                <div className="training-module-card__number" aria-hidden="true">
                  {getModuleNumber(module.code)}
                </div>
                <h3>{module.title}</h3>
                <p>{module.overview}</p>
                <div className="training-module-card__meta">
                  <span>{module.duration}</span>
                  <span>{module.units} {module.units === 1 ? "unit" : "units"}</span>
                  <span>5 questions</span>
                </div>
                {status === "completed" ? (
                  <ModuleScore attempt={module.attempt} compact />
                ) : status === "in_progress" ? (
                  <p className="training-module-live">
                    <span /> Timed assessment in progress
                  </p>
                ) : null}
                <button type="button" onClick={() => onOpenModule(module.code)}>
                  {status === "completed" ? "Review learning" : "Open module"}
                  <TrainingIcon name="arrow" />
                </button>
              </article>
            );
          })}
        </div>
        {!visibleModules.length ? (
          <div className="training-empty-state">
            <strong>No modules match this view.</strong>
            <button type="button" onClick={() => { setFilter("all"); setQuery(""); }}>
              Show all modules
            </button>
          </div>
        ) : null}
      </section>

      <div id="training-final-result" className="training-final-wrap">
        <FinalResultCard training={training} />
      </div>

      <footer className="training-footer">
        <div className="training-brand">
          <img src="/assets/kurah-academy/logo.jpg" alt="" />
          <span>
            <strong>Kurah Tech and Arts Academy</strong>
            <small>Learn · Create · Excel</small>
          </span>
        </div>
        <p>Complete the training. Qualify for next term. Earn your salary increment.</p>
        <Link to="/kurahtechandartsacademy">Back to school page →</Link>
      </footer>

      {showFlyer ? (
        <div
          className="training-flyer-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Training flyer"
          onClick={() => setShowFlyer(false)}
        >
          <button type="button" onClick={() => setShowFlyer(false)} aria-label="Close flyer">×</button>
          <img src={FLYER_PATH} alt="Kurah Academy staff teachers online training flyer" />
        </div>
      ) : null}
    </main>
  );
}

export default function TeacherTrainingPage({ user }) {
  const [training, setTraining] = useState(null);
  const [selectedModuleCode, setSelectedModuleCode] = useState("");
  const [loading, setLoading] = useState(Boolean(user));
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const loadTraining = useCallback(async () => {
    if (!user) {
      return null;
    }
    setError("");
    try {
      const payload = await fetchTeacherTrainingStatus();
      setTraining(payload);
      return payload;
    } catch (requestError) {
      setError(requestError?.message || "The training studio could not be loaded.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadTraining();
  }, [loadTraining]);

  const activeModule = training?.modules?.find(
    (module) => module.attempt?.status === "in_progress"
  );
  const selectedModule = training?.modules?.find(
    (module) => module.code === selectedModuleCode
  );

  const startAssessment = async (moduleCode) => {
    if (working) {
      return;
    }
    setWorking(true);
    setError("");
    try {
      const payload = await startTeacherTrainingModule(moduleCode);
      setTraining(payload);
      toast.success("Assessment started. The clock is now running.");
    } catch (requestError) {
      const message = requestError?.message || "The assessment could not begin.";
      toast.error(message);
      setError(message);
      if (requestError?.payload?.training) {
        setTraining(requestError.payload.training);
      }
    } finally {
      setWorking(false);
    }
  };

  if (!user) {
    return <GuestTrainingLanding />;
  }

  if (loading) {
    return (
      <main className="training-loading-screen">
        <img src="/assets/kurah-academy/logo.jpg" alt="Kurah Academy" />
        <span className="training-loader" />
        <h1>Preparing your learning studio…</h1>
        <p>Loading modules, weekly progress, and assessment status.</p>
      </main>
    );
  }

  if (error && !training) {
    return (
      <main className="training-error-screen">
        <TrainingIcon name="book" />
        <h1>We could not open the training studio.</h1>
        <p>{error}</p>
        <button type="button" onClick={loadTraining}>Try again</button>
        <Link to="/kurahtechandartsacademy">Return to the school page</Link>
      </main>
    );
  }

  if (activeModule) {
    return (
      <AssessmentStage
        training={training}
        module={activeModule}
        onTrainingChange={(payload) => {
          setTraining(payload);
          const updated = payload?.modules?.find(
            (module) => module.code === activeModule.code
          );
          if (updated?.attempt?.status === "completed") {
            setSelectedModuleCode(activeModule.code);
            toast.success(`Module complete: ${updated.attempt.scorePercent}%`);
          }
        }}
        onRecover={loadTraining}
      />
    );
  }

  if (selectedModule) {
    return (
      <ModuleReader
        module={selectedModule}
        access={training.campaign.access}
        onBack={() => setSelectedModuleCode("")}
        onStart={startAssessment}
        working={working}
      />
    );
  }

  return (
    <TrainingDashboard
      training={training}
      onOpenModule={(moduleCode) => setSelectedModuleCode(moduleCode)}
    />
  );
}
