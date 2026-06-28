import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "tengacion.gaming.word-sprint.progress";
const ROUND_SECONDS = 60;
const CHALLENGES = [
  { answer: "momentum", clue: "Forward force that is hard to stop", category: "Energy" },
  { answer: "creator", clue: "Someone who brings an original idea to life", category: "Community" },
  { answer: "horizon", clue: "Where the earth and sky seem to meet", category: "World" },
  { answer: "rhythm", clue: "A repeated pattern of sound or movement", category: "Culture" },
  { answer: "lantern", clue: "A portable light with a protective case", category: "Objects" },
  { answer: "curious", clue: "Eager to know, learn, or investigate", category: "Mindset" },
  { answer: "network", clue: "Connected people, devices, or ideas", category: "Technology" },
  { answer: "velocity", clue: "Speed measured with direction", category: "Science" },
  { answer: "mosaic", clue: "A picture assembled from many small pieces", category: "Art" },
  { answer: "compass", clue: "A guide that points toward direction", category: "Travel" },
  { answer: "vibrant", clue: "Full of life, energy, and strong color", category: "Style" },
  { answer: "archive", clue: "A collection preserved for future reference", category: "Knowledge" },
];

const readBest = () => {
  if (typeof window === "undefined") {
    return { bestScore: 0, bestStreak: 0 };
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    return { bestScore: Number(parsed.bestScore) || 0, bestStreak: Number(parsed.bestStreak) || 0 };
  } catch {
    return { bestScore: 0, bestStreak: 0 };
  }
};

const scramble = (word, seed = 0) => {
  const chars = word.toUpperCase().split("");
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapIndex = (index * 3 + seed * 5 + 1) % (index + 1);
    [chars[index], chars[swapIndex]] = [chars[swapIndex], chars[index]];
  }
  const result = chars.join("");
  return result === word.toUpperCase() ? `${result.slice(1)}${result[0]}` : result;
};

export default function WordSprint({ onSessionChange }) {
  const storedBest = useMemo(readBest, []);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(storedBest.bestScore);
  const [bestStreak, setBestStreak] = useState(storedBest.bestStreak);
  const [streak, setStreak] = useState(0);
  const [solved, setSolved] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [phase, setPhase] = useState("ready");
  const [status, setStatus] = useState("Your first clue is ready. Start the clock when your brain is warm.");
  const inputRef = useRef(null);
  const challenge = CHALLENGES[challengeIndex % CHALLENGES.length];

  const startRound = useCallback(() => {
    setScore(0);
    setStreak(0);
    setSolved(0);
    setTimeLeft(ROUND_SECONDS);
    setChallengeIndex((current) => (current + 3) % CHALLENGES.length);
    setAnswer("");
    setPhase("playing");
    setStatus("Clock live. Read the clue, rebuild the word, and protect your streak.");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const skipChallenge = useCallback(() => {
    if (phase !== "playing") {
      return;
    }
    setChallengeIndex((current) => (current + 1) % CHALLENGES.length);
    setAnswer("");
    setStreak(0);
    setTimeLeft((current) => Math.max(0, current - 4));
    setStatus("Skipped for four seconds. The next clue is live.");
    inputRef.current?.focus();
  }, [phase]);

  const submitAnswer = (event) => {
    event.preventDefault();
    if (phase !== "playing" || !answer.trim()) {
      return;
    }

    if (answer.trim().toLowerCase() === challenge.answer) {
      const nextStreak = streak + 1;
      const points = 100 + Math.min(nextStreak, 8) * 25 + Math.ceil(timeLeft / 6) * 5;
      const nextScore = score + points;
      setScore(nextScore);
      setBestScore((current) => Math.max(current, nextScore));
      setStreak(nextStreak);
      setBestStreak((current) => Math.max(current, nextStreak));
      setSolved((current) => current + 1);
      setChallengeIndex((current) => (current + 1) % CHALLENGES.length);
      setAnswer("");
      setStatus(`Correct for ${points} points. ${nextStreak} word${nextStreak === 1 ? "" : "s"} in rhythm.`);
    } else {
      setStreak(0);
      setTimeLeft((current) => Math.max(0, current - 3));
      setStatus("Not quite. Three seconds lost - use the clue and try again.");
      setAnswer("");
    }
    inputRef.current?.focus();
  };

  useEffect(() => {
    if (phase !== "playing") {
      return undefined;
    }
    const intervalId = window.setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          setPhase("complete");
          setStatus("Sprint complete. Your score is banked - run it again for a cleaner streak.");
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [phase]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ bestScore, bestStreak }));
  }, [bestScore, bestStreak]);

  useEffect(() => {
    onSessionChange?.({
      game: "word-sprint",
      score,
      bestScore,
      moves: solved,
      highestTile: streak,
      streak,
      solved,
      timeLeft,
      gameOver: phase === "complete",
      status,
      metricLabel: "Words solved",
      metricValue: solved,
      progressLabel: "Time left",
      progressValue: `${timeLeft}s`,
    });
  }, [bestScore, onSessionChange, phase, score, solved, status, streak, timeLeft]);

  const progress = (timeLeft / ROUND_SECONDS) * 100;

  return (
    <section className="game-next-shell game-word-shell">
      <div className="game-next-head">
        <div>
          <p className="game-next-kicker">Vocabulary speed lane</p>
          <h3>Word Sprint</h3>
          <p>{status}</p>
        </div>
        <span className={`game-next-live-pill ${phase !== "playing" ? "is-paused" : ""}`}>{phase === "playing" ? "Clock live" : phase === "complete" ? "Round banked" : "Ready"}</span>
      </div>

      <div className="game-next-stats">
        <div><span>Score</span><strong>{score}</strong></div>
        <div><span>Best</span><strong>{bestScore}</strong></div>
        <div><span>Solved</span><strong>{solved}</strong></div>
        <div><span>Time</span><strong>{timeLeft}s</strong></div>
      </div>

      <div className="game-next-stage">
        <div className="game-live-play-column">
          <div className="game-live-control-dock" role="region" aria-label="Word Sprint play controls">
            <div className="game-live-control-dock__head">
              <strong>Sprint controls</strong>
              <span>Answers submit with Enter. Skips cost four seconds.</span>
            </div>
            <div className="game-live-control-dock__body">
              <div className="game-next-controls game-word-dock-status">
                <span>{phase === "playing" ? `${streak}x streak` : "60 second round"}</span>
              </div>
              <div className="game-live-session-actions">
                <button type="button" className="btn-secondary" onClick={skipChallenge} disabled={phase !== "playing"}>Skip word</button>
                {phase === "playing" ? (
                  <button type="button" className="btn-secondary" onClick={startRound}>Restart</button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="game-word-surface" aria-label="Word Sprint challenge">
            <div className="game-word-timer"><span style={{ width: `${progress}%` }} /></div>
            <span className="game-word-category">{challenge.category}</span>
            <p className="game-word-clue">{challenge.clue}</p>
            <div className="game-word-scramble" aria-label={`Scrambled letters ${scramble(challenge.answer, challengeIndex)}`}>
              {scramble(challenge.answer, challengeIndex).split("").map((letter, index) => <span key={`${letter}-${index}`}>{letter}</span>)}
            </div>
            <form className="game-word-answer" onSubmit={submitAnswer}>
              <input ref={inputRef} value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder={phase === "playing" ? "Type the word" : "Start the sprint to answer"} disabled={phase !== "playing"} autoComplete="off" aria-label="Your answer" />
              <button type="submit" className="btn-primary" disabled={phase !== "playing" || !answer.trim()}>Lock answer</button>
            </form>
            {phase !== "playing" ? <div className="game-next-overlay game-word-overlay"><strong>{phase === "complete" ? `${score} points` : "Ready to sprint?"}</strong><p>{phase === "complete" ? `${solved} words solved. Best streak: ${bestStreak}.` : "One minute. Clear clues. No filler."}</p><button type="button" className="btn-primary" onClick={startRound}>{phase === "complete" ? "Run again" : "Start sprint"}</button></div> : null}
          </div>
        </div>

        <aside className="game-next-aside">
          <article><span>Current streak</span><strong>{streak ? `${streak}x` : "Find rhythm"}</strong><p>Every correct answer lifts the next scoring burst.</p></article>
          <article><span>Personal rhythm</span><strong>{bestStreak} best streak</strong><p>Your strongest chain is kept locally on this device.</p></article>
          <article><span>Sprint tip</span><strong>Clue before letters</strong><p>Read the meaning first; the scramble is confirmation, not the whole puzzle.</p></article>
        </aside>
      </div>
    </section>
  );
}
