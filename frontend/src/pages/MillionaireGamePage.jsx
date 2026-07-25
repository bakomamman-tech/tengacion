import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";

import Navbar from "../Navbar";
import Sidebar from "../Sidebar";
import RightQuickNav from "../components/RightQuickNav";
import {
  answerMillionaireQuestion,
  askMillionaireAi,
  getMillionaireStatus,
  startMillionaireGame,
} from "../api";

import "./millionaire-game.css";

const OPTION_LABELS = ["A", "B", "C", "D"];

const formatNaira = (value) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDateTime = (value) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

function GameRequirements({ eligibility, username }) {
  const navigate = useNavigate();
  return (
    <div className="millionaire-game-requirements">
      {(eligibility?.requirements || []).map((item) => (
        <article key={item.id} className={item.complete ? "is-ready" : "is-pending"}>
          <span aria-hidden="true">{item.complete ? "✓" : "!"}</span>
          <div>
            <strong>{item.label}</strong>
            <small>{item.complete ? "Ready" : "Complete this to unlock the game"}</small>
          </div>
          {!item.complete ? (
            <button
              type="button"
              onClick={() =>
                navigate(
                  item.id === "registration"
                    ? "/millionaire/register"
                    : `/profile/${username || ""}`
                )
              }
            >
              Fix
            </button>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function PrizeLadder({ prizes = [], currentQuestionNumber = 0, currentPrize = 0 }) {
  return (
    <aside className="millionaire-prize-ladder" aria-label="Prize ladder">
      <div className="millionaire-ladder-head">
        <span>Prize ladder</span>
        <strong>{formatNaira(currentPrize)}</strong>
      </div>
      <ol reversed>
        {[...prizes].reverse().map((amount, reverseIndex) => {
          const number = prizes.length - reverseIndex;
          const isCurrent = number === currentQuestionNumber;
          const isBanked = number < currentQuestionNumber || amount <= currentPrize;
          return (
            <li
              key={`${number}-${amount}`}
              className={`${isCurrent ? "is-current" : ""}${isBanked ? " is-banked" : ""}`}
            >
              <span>{String(number).padStart(2, "0")}</span>
              <strong>{formatNaira(amount)}</strong>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

function GameResult({ game, onHome, onReplay, canReplay }) {
  const attempt = game?.attempt || {};
  const won = Number(attempt.finalPrize || 0);
  const completedAll = attempt.status === "completed";
  return (
    <section className="millionaire-result" aria-labelledby="millionaire-result-title">
      <div className="millionaire-result__glow" aria-hidden="true" />
      <span className="millionaire-result__crest" aria-hidden="true">
        {completedAll ? "♛" : won > 0 ? "★" : "◆"}
      </span>
      <p className="millionaire-game-kicker">
        {completedAll ? "Summit conquered" : "Challenge complete"}
      </p>
      <h1 id="millionaire-result-title">
        {completedAll
          ? "You mastered all 15 questions."
          : won > 0
            ? "Your intelligence earned a prize."
            : "The next climb starts with what you learned."}
      </h1>
      <div className="millionaire-result__amount">{formatNaira(won)}</div>
      <p>
        {won > 0
          ? `Your award is marked “${String(attempt.payoutStatus || "pending").replace("_", " ")}” for verification by Tengacion administrators.`
          : "No cash prize was banked in this round, but your question review is ready below."}
      </p>

      {attempt.lifelineUsed ? (
        <div className="millionaire-ai-lesson">
          <span aria-hidden="true">AI</span>
          <div>
            <strong>The lifeline was deliberately unreliable.</strong>
            <p>
              Its suggestion was designed to be wrong. AI can sound confident and
              still fail—your judgment must stay in charge.
            </p>
          </div>
        </div>
      ) : null}

      <div className="millionaire-result__stats">
        <div><strong>{attempt.correctAnswers || 0}/15</strong><span>Correct answers</span></div>
        <div><strong>{formatNaira(attempt.finalPrize)}</strong><span>Prize banked</span></div>
        <div><strong>6 months</strong><span>Replay interval</span></div>
      </div>

      <div className="millionaire-result__actions">
        <button type="button" onClick={canReplay ? onReplay : onHome}>
          {canReplay ? "Start my new six-month game" : "Return to Tengacion"}
        </button>
        <span>
          {canReplay
            ? "Your six-month replay window is open."
            : `Next play: ${formatDateTime(game?.cooldown?.nextEligibleAt)}`}
        </span>
      </div>

      {attempt.review?.length ? (
        <details className="millionaire-review">
          <summary>Review answered questions</summary>
          <div>
            {attempt.review.map((item) => (
              <article key={`${item.number}-${item.prompt}`}>
                <div>
                  <span>Q{item.number} · {item.category}</span>
                  <strong>{item.prompt}</strong>
                </div>
                <p className={item.correct ? "is-correct" : "is-wrong"}>
                  {item.timedOut
                    ? "Time expired"
                    : `Your answer: ${
                        Number.isInteger(item.selectedIndex)
                          ? item.options[item.selectedIndex]
                          : "No answer"
                      }`}
                </p>
                {!item.correct ? <p>Correct answer: {item.correctAnswer}</p> : null}
                <small>{item.explanation}</small>
              </article>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

export default function MillionaireGamePage({ user }) {
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [aiAdvice, setAiAdvice] = useState(null);
  const timeoutSentRef = useRef(false);
  const feedbackTimerRef = useRef(null);

  const loadGame = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setGame(await getMillionaireStatus());
    } catch (requestError) {
      setError(requestError?.message || "The game lobby could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGame();
    return () => {
      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, [loadGame]);

  const attempt = game?.attempt || null;
  const question = attempt?.currentQuestion || null;

  useEffect(() => {
    timeoutSentRef.current = false;
    setSecondsRemaining(Number(question?.secondsRemaining || 0));
    setSelectedIndex(null);
    setAiAdvice(null);
  }, [question?.id, question?.secondsRemaining]);

  useEffect(() => {
    if (!question?.id || working || secondsRemaining <= 0) {
      return undefined;
    }
    const interval = window.setInterval(() => {
      setSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [question?.id, secondsRemaining, working]);

  const showFeedback = useCallback((nextFeedback) => {
    setFeedback(nextFeedback);
    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => setFeedback(null), 2400);
  }, []);

  const handleAnswer = useCallback(
    async (choice) => {
      if (!question?.id || working) {
        return;
      }
      setWorking(true);
      setSelectedIndex(Number.isInteger(choice) ? choice : null);
      setError("");
      try {
        const payload = await answerMillionaireQuestion({
          questionId: question.id,
          selectedIndex: Number.isInteger(choice) ? choice : null,
        });
        const result = payload?.answerResult || {};
        setGame(payload?.game || null);
        showFeedback({
          correct: Boolean(result.correct),
          title: result.correct
            ? `${formatNaira(result.prizeUnlocked)} unlocked`
            : result.timedOut
              ? "Time expired"
              : "That answer missed",
          detail: result.correct
            ? result.explanation
            : `Correct answer: ${result.correctAnswer}. ${result.explanation || ""}`,
        });
      } catch (requestError) {
        const message = requestError?.message || "Your answer could not be submitted.";
        setError(message);
        toast.error(message);
        if (requestError?.status === 409) {
          loadGame();
        }
      } finally {
        setWorking(false);
      }
    },
    [loadGame, question?.id, showFeedback, working]
  );

  useEffect(() => {
    if (
      question?.id &&
      secondsRemaining <= 0 &&
      !working &&
      !timeoutSentRef.current
    ) {
      timeoutSentRef.current = true;
      handleAnswer(null);
    }
  }, [handleAnswer, question?.id, secondsRemaining, working]);

  const handleStart = async () => {
    setWorking(true);
    setError("");
    try {
      setGame(await startMillionaireGame());
      toast.success("The clock is running. Trust your mind.");
    } catch (requestError) {
      const message = requestError?.message || "The game could not begin.";
      setError(message);
      toast.error(message);
      if (requestError?.payload?.eligibility) {
        setGame((current) => ({
          ...(current || {}),
          eligibility: requestError.payload.eligibility,
        }));
      }
    } finally {
      setWorking(false);
    }
  };

  const handleAskAi = async () => {
    if (!question?.id || working || attempt?.lifelineUsed) {
      return;
    }
    setWorking(true);
    setError("");
    try {
      const payload = await askMillionaireAi({ questionId: question.id });
      setGame(payload?.game || game);
      setAiAdvice(payload?.advice || null);
    } catch (requestError) {
      const message = requestError?.message || "The AI lifeline is unavailable.";
      setError(message);
      toast.error(message);
    } finally {
      setWorking(false);
    }
  };

  const stageProgress = useMemo(() => {
    const questionNumber = Number(question?.number || 1);
    return ((questionNumber - 1) % 5) + 1;
  }, [question?.number]);
  const timerProgress = question?.timeLimitSeconds
    ? Math.max(0, Math.min(1, secondsRemaining / question.timeLimitSeconds))
    : 0;

  const goProfile = () => navigate(`/profile/${user?.username || ""}`);

  let content;
  if (loading) {
    content = (
      <section className="millionaire-lobby-card millionaire-loading-card">
        <span className="millionaire-loader" aria-hidden="true" />
        <h1>Preparing the Millionaire stage…</h1>
        <p>Checking your registration, profile and play window.</p>
      </section>
    );
  } else if (!game?.registration?.registered) {
    content = (
      <section className="millionaire-lobby-card">
        <p className="millionaire-game-kicker">Registration required</p>
        <h1>Claim your seat before the questions begin.</h1>
        <p>
          Existing Tengacion members keep their current account. New participants
          can create one through the colourful game registration form.
        </p>
        <Link className="millionaire-lobby-primary" to="/millionaire/register">
          Register for the game
        </Link>
      </section>
    );
  } else if (!game?.eligibility?.eligible) {
    content = (
      <section className="millionaire-lobby-card">
        <p className="millionaire-game-kicker">Player profile check</p>
        <h1>Your intelligence is ready. Finish your profile.</h1>
        <p>
          Tengacion requires complete profile information, a genuine profile
          picture and a cover photo before any participant can play.
        </p>
        <GameRequirements eligibility={game?.eligibility} username={user?.username} />
      </section>
    );
  } else if (attempt && attempt.status !== "in_progress") {
    content = (
      <GameResult
        game={game}
        onHome={() => navigate("/home")}
        onReplay={handleStart}
        canReplay={Boolean(game?.canStart && !game?.cooldown?.active)}
      />
    );
  } else if (attempt?.status === "in_progress" && question) {
    content = (
      <section className="millionaire-game-stage">
        <div className="millionaire-question-panel">
          <header className="millionaire-question-head">
            <div>
              <p className="millionaire-game-kicker">
                Stage {question.stage} · {question.stageName}
              </p>
              <h1>Question {question.number} of 15</h1>
            </div>
            <div
              className={`millionaire-timer${secondsRemaining <= 8 ? " is-urgent" : ""}`}
              style={{ "--timer-progress": `${timerProgress * 360}deg` }}
              aria-label={`${secondsRemaining} seconds remaining`}
            >
              <span>{secondsRemaining}</span>
              <small>sec</small>
            </div>
          </header>

          <div className="millionaire-stage-meter">
            {Array.from({ length: 5 }).map((_, index) => (
              <span
                key={index}
                className={
                  index + 1 < stageProgress
                    ? "is-complete"
                    : index + 1 === stageProgress
                      ? "is-current"
                      : ""
                }
              />
            ))}
          </div>

          <div className="millionaire-question-meta">
            <span>{question.category}</span>
            <span>{question.difficulty}</span>
            <span>{formatNaira(game?.campaign?.prizeLadder?.[question.number - 1])}</span>
          </div>

          <h2>{question.prompt}</h2>

          <div className="millionaire-options" role="group" aria-label="Answer choices">
            {question.options.map((option, index) => (
              <button
                key={`${question.id}-${option}`}
                type="button"
                className={selectedIndex === index ? "is-selected" : ""}
                disabled={working || secondsRemaining <= 0}
                onClick={() => handleAnswer(index)}
              >
                <span>{OPTION_LABELS[index]}</span>
                <strong>{option}</strong>
              </button>
            ))}
          </div>

          <div className="millionaire-lifeline-row">
            <button
              type="button"
              className="millionaire-ai-button"
              disabled={working || attempt.lifelineUsed || secondsRemaining <= 0}
              onClick={handleAskAi}
            >
              <span aria-hidden="true">AI</span>
              {attempt.lifelineUsed ? "Ask AI used" : "Ask AI · one lifeline"}
            </button>
            <p>AI is a voice, not your authority. The final answer is always yours.</p>
          </div>

          {aiAdvice ? (
            <div className="millionaire-ai-advice" role="status">
              <span aria-hidden="true">AI</span>
              <div>
                <strong>Assistant suggestion</strong>
                <p>{aiAdvice.message}</p>
              </div>
            </div>
          ) : null}

          {feedback ? (
            <div
              className={`millionaire-answer-feedback ${
                feedback.correct ? "is-correct" : "is-wrong"
              }`}
              role="status"
            >
              <strong>{feedback.title}</strong>
              <p>{feedback.detail}</p>
            </div>
          ) : null}
          {error ? <div className="millionaire-game-error" role="alert">{error}</div> : null}
        </div>

        <PrizeLadder
          prizes={game?.campaign?.prizeLadder || []}
          currentQuestionNumber={question.number}
          currentPrize={attempt.currentPrize}
        />
      </section>
    );
  } else if (game?.cooldown?.active) {
    content = (
      <section className="millionaire-lobby-card">
        <p className="millionaire-game-kicker">Six-month play window</p>
        <h1>Your next challenge is already scheduled.</h1>
        <p>
          Every participant can play once every six months. Your next game opens{" "}
          <strong>{formatDateTime(game.cooldown.nextEligibleAt)}</strong>.
        </p>
        <button type="button" className="millionaire-lobby-primary" onClick={() => navigate("/home")}>
          Return home
        </button>
      </section>
    );
  } else {
    content = (
      <section className="millionaire-lobby-card is-ready">
        <div className="millionaire-lobby-orbit" aria-hidden="true"><span>15</span></div>
        <p className="millionaire-game-kicker">The stage is yours</p>
        <h1>Three stages. Fifteen questions. One sharp mind.</h1>
        <p>
          Winnings begin at ₦100 and climb to ₦5,000. Every correct answer banks
          the new amount. A wrong answer ends the run but keeps what you already earned.
        </p>
        <div className="millionaire-lobby-rules">
          <span>5 foundation questions</span>
          <span>5 advanced questions</span>
          <span>5 master questions</span>
          <span>One Ask AI lifeline</span>
        </div>
        <button
          type="button"
          className="millionaire-lobby-primary"
          disabled={working}
          onClick={handleStart}
        >
          {working ? "Opening question one…" : "Start my Millionaire game"}
        </button>
        <small>Starting now activates your six-month play window.</small>
        {error ? <div className="millionaire-game-error" role="alert">{error}</div> : null}
      </section>
    );
  }

  return (
    <>
      <Navbar
        user={user}
        onLogout={() => navigate("/")}
        onOpenMessenger={() => navigate("/messages")}
        onOpenCreatePost={() => navigate("/home", { state: { openComposer: true } })}
      />
      <div className="millionaire-app-shell">
        <aside className="sidebar">
          <Sidebar
            user={user}
            openChat={() => navigate("/messages")}
            openProfile={goProfile}
          />
        </aside>

        <main className="millionaire-game-page">{content}</main>

        <aside className="home-right-rail millionaire-right-rail">
          <RightQuickNav />
          <section className="millionaire-side-card">
            <p>Tonight&apos;s rules</p>
            <strong>Trust your intelligence.</strong>
            <span>3 stages · 15 questions</span>
            <span>₦100 minimum unlocked prize</span>
            <span>₦5,000 maximum prize</span>
            <span>One play every six months</span>
          </section>
        </aside>
      </div>
    </>
  );
}
