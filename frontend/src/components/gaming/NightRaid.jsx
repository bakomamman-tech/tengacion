import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "tengacion.gaming.night-raid.progress";
const LANES = 5;
const ROWS = 8;

const readBestScore = () => {
  if (typeof window === "undefined") {
    return 0;
  }

  try {
    return Number(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}")?.bestScore) || 0;
  } catch {
    return 0;
  }
};

const createRun = (bestScore = 0) => ({
  playerLane: 2,
  enemies: [],
  score: 0,
  bestScore,
  wave: 1,
  combo: 0,
  integrity: 100,
  shots: 0,
  dodges: 0,
  tick: 0,
  paused: false,
  gameOver: false,
  status: "Raid channel open. Track the closest signal and fire before it reaches you.",
});

const createEnemy = (tick, occupiedLanes) => {
  const openLanes = Array.from({ length: LANES }, (_, lane) => lane).filter(
    (lane) => !occupiedLanes.includes(lane)
  );
  const lanePool = openLanes.length ? openLanes : Array.from({ length: LANES }, (_, lane) => lane);
  const lane = lanePool[Math.floor(Math.random() * lanePool.length)];

  return {
    id: `signal-${tick}-${Math.random().toString(36).slice(2)}`,
    lane,
    row: 0,
    elite: tick > 18 && Math.random() > 0.78,
  };
};

export default function NightRaid({ onSessionChange }) {
  const [run, setRun] = useState(() => createRun(readBestScore()));
  const { playerLane, enemies, score, bestScore, wave, combo, integrity, shots, dodges, paused, gameOver, status } = run;

  const move = useCallback((direction) => {
    setRun((current) => {
      if (current.gameOver || current.paused) {
        return current;
      }
      const nextLane = Math.min(LANES - 1, Math.max(0, current.playerLane + direction));
      if (nextLane === current.playerLane) {
        return current;
      }

      return {
        ...current,
        playerLane: nextLane,
        dodges: current.dodges + 1,
        status: `Shifted to lane ${nextLane + 1}. Keep scanning the skyline.`,
      };
    });
  }, []);

  const fire = useCallback(() => {
    setRun((current) => {
      if (current.gameOver || current.paused) {
        return current;
      }
      const targets = current.enemies
        .filter((enemy) => enemy.lane === current.playerLane)
        .sort((left, right) => right.row - left.row);
      const target = targets[0];

      if (!target) {
        return {
          ...current,
          shots: current.shots + 1,
          combo: 0,
          status: "Pulse missed. Re-center on a live signal.",
        };
      }

      const nextCombo = current.combo + 1;
      const points = (target.elite ? 180 : 100) + Math.min(nextCombo, 8) * 20;
      const nextScore = current.score + points;
      const nextBest = Math.max(current.bestScore, nextScore);

      return {
        ...current,
        enemies: current.enemies.filter((enemy) => enemy.id !== target.id),
        shots: current.shots + 1,
        combo: nextCombo,
        score: nextScore,
        bestScore: nextBest,
        status: target.elite
          ? `Elite signal erased. ${nextCombo}x lock chain.`
          : `Signal cleared for ${points} points.`,
      };
    });
  }, []);

  const togglePause = useCallback(() => {
    setRun((current) =>
      current.gameOver
        ? current
        : {
            ...current,
            paused: !current.paused,
            status: current.paused ? "Raid resumed. Signals are moving." : "Raid paused. Your lane is holding.",
          }
    );
  }, []);

  const restart = useCallback(() => {
    setRun((current) => createRun(current.bestScore));
  }, []);

  useEffect(() => {
    if (paused || gameOver) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setRun((current) => {
        if (current.paused || current.gameOver) {
          return current;
        }

        const advanced = current.enemies.map((enemy) => ({ ...enemy, row: enemy.row + 1 }));
        const impacts = advanced.filter(
          (enemy) => enemy.row >= ROWS - 1 && enemy.lane === current.playerLane
        );
        const escaped = advanced.filter((enemy) => enemy.row >= ROWS - 1 && enemy.lane !== current.playerLane);
        const survivors = advanced.filter((enemy) => enemy.row < ROWS - 1);
        const nextIntegrity = Math.max(0, current.integrity - impacts.length * 25);
        const nextTick = current.tick + 1;
        const nextWave = Math.floor(nextTick / 12) + 1;
        const spawnEvery = Math.max(1, 3 - Math.floor(nextWave / 3));

        if (nextTick % spawnEvery === 0 && survivors.length < 7) {
          survivors.push(createEnemy(nextTick, survivors.filter((enemy) => enemy.row === 0).map((enemy) => enemy.lane)));
        }

        return {
          ...current,
          enemies: survivors,
          tick: nextTick,
          wave: nextWave,
          combo: impacts.length ? 0 : current.combo,
          integrity: nextIntegrity,
          gameOver: nextIntegrity <= 0,
          status:
            nextIntegrity <= 0
              ? "The shield collapsed. Reboot the raid and chase a cleaner line."
              : impacts.length
                ? `Direct hit. Shield integrity at ${nextIntegrity}%.`
                : escaped.length
                  ? `${escaped.length} signal${escaped.length === 1 ? "" : "s"} slipped past the flank.`
                  : current.status,
        };
      });
    }, Math.max(360, 760 - wave * 42));

    return () => window.clearInterval(intervalId);
  }, [gameOver, paused, wave]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (["INPUT", "TEXTAREA"].includes(event.target?.tagName)) {
        return;
      }
      const key = event.key.toLowerCase();
      if (["arrowleft", "a", "arrowright", "d", " ", "enter", "p"].includes(key)) {
        event.preventDefault();
      }
      if (key === "arrowleft" || key === "a") {
        move(-1);
      }
      if (key === "arrowright" || key === "d") {
        move(1);
      }
      if (key === " " || key === "enter") {
        fire();
      }
      if (key === "p") {
        togglePause();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fire, move, togglePause]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ bestScore }));
  }, [bestScore]);

  useEffect(() => {
    onSessionChange?.({
      game: "night-raid",
      score,
      bestScore,
      moves: shots + dodges,
      highestTile: wave,
      wave,
      combo,
      integrity,
      gameOver,
      status,
      metricLabel: "Wave",
      metricValue: wave,
      progressLabel: "Integrity",
      progressValue: `${integrity}%`,
    });
  }, [bestScore, combo, dodges, gameOver, integrity, onSessionChange, score, shots, status, wave]);

  const accuracy = shots ? Math.round(((score > 0 ? Math.min(shots, score / 100) : 0) / shots) * 100) : 100;
  const cells = useMemo(
    () => Array.from({ length: ROWS * LANES }, (_, index) => ({ row: Math.floor(index / LANES), lane: index % LANES })),
    []
  );

  return (
    <section className="game-next-shell game-night-shell">
      <div className="game-next-head">
        <div>
          <p className="game-next-kicker">Neon survival lane</p>
          <h3>Night Raid</h3>
          <p>{status}</p>
        </div>
        <span className={`game-next-live-pill ${paused ? "is-paused" : ""}`}>{paused ? "Paused" : "Live raid"}</span>
      </div>

      <div className="game-next-stats">
        <div><span>Score</span><strong>{score}</strong></div>
        <div><span>Best</span><strong>{bestScore}</strong></div>
        <div><span>Wave</span><strong>{wave}</strong></div>
        <div><span>Shield</span><strong>{integrity}%</strong></div>
      </div>

      <div className="game-next-stage">
        <div className="game-live-play-column">
          <div className="game-live-control-dock" role="region" aria-label="Night Raid play controls">
            <div className="game-live-control-dock__head">
              <strong>Raid controls</strong>
              <span>A/D to move · Space to fire · P to pause</span>
            </div>
            <div className="game-live-control-dock__body">
              <div className="game-next-controls">
                <button type="button" onClick={() => move(-1)}>← Left</button>
                <button type="button" className="is-action" onClick={fire}>Fire pulse</button>
                <button type="button" onClick={() => move(1)}>Right →</button>
              </div>
              <div className="game-live-session-actions">
                <button type="button" className="btn-secondary" onClick={togglePause} disabled={gameOver}>
                  {paused ? "Resume" : "Pause"}
                </button>
                <button type="button" className="btn-secondary" onClick={restart}>New raid</button>
              </div>
            </div>
          </div>

          <div className="game-night-board-shell">
            <div className="game-night-skyline" aria-hidden="true"><span /><span /><span /><span /><span /></div>
            <div className="game-night-board" aria-label="Night Raid battle grid">
              {cells.map((cell) => {
                const enemy = enemies.find((entry) => entry.row === cell.row && entry.lane === cell.lane);
                const isPlayer = cell.row === ROWS - 1 && cell.lane === playerLane;
                return (
                  <div key={`${cell.row}-${cell.lane}`} className={`game-night-cell ${enemy ? "has-enemy" : ""} ${isPlayer ? "has-player" : ""}`}>
                    {enemy ? <span className={`game-night-enemy ${enemy.elite ? "is-elite" : ""}`} aria-label={enemy.elite ? "Elite enemy" : "Enemy"}>◆</span> : null}
                    {isPlayer ? <span className="game-night-player" aria-label="Your pulse ship">▲</span> : null}
                  </div>
                );
              })}
            </div>
            {gameOver ? (
              <div className="game-next-overlay"><strong>Raid over</strong><p>Your best score is {bestScore}. Reboot and hold the line.</p><button type="button" className="btn-primary" onClick={restart}>Reboot raid</button></div>
            ) : null}
          </div>
        </div>

        <aside className="game-next-aside">
          <article><span>Lock chain</span><strong>{combo ? `${combo}x` : "Build it"}</strong><p>Consecutive hits add a rising pulse bonus.</p></article>
          <article><span>Field read</span><strong>{enemies.length} live signals</strong><p>Fire down your current lane or slip away before contact.</p></article>
          <article><span>Run rhythm</span><strong>{accuracy}% pressure</strong><p>{shots} pulses fired and {dodges} lane shifts logged.</p></article>
        </aside>
      </div>
    </section>
  );
}
