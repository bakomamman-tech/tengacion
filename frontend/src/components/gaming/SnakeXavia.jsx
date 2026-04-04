import { useEffect, useMemo, useRef, useState } from "react";

const BOARD_SIZE = 14;
const STORAGE_KEY = "tengacion.gaming.snake-xavia.state";
const DEFAULT_DIFFICULTY = "classic";
const SWIPE_THRESHOLD = 24;
const STARTING_SNAKE = [
  { x: 4, y: 7 },
  { x: 3, y: 7 },
  { x: 2, y: 7 },
];

const DIFFICULTIES = {
  cruise: {
    label: "Cruise",
    baseSpeed: 176,
    minSpeed: 116,
    speedStep: 10,
    scoreStep: 50,
    foodScore: 8,
    description: "Longer sessions with a calmer speed curve.",
  },
  classic: {
    label: "Classic",
    baseSpeed: 150,
    minSpeed: 94,
    speedStep: 9,
    scoreStep: 40,
    foodScore: 10,
    description: "Balanced pace for quick score-chasing runs.",
  },
  blitz: {
    label: "Blitz",
    baseSpeed: 126,
    minSpeed: 76,
    speedStep: 8,
    scoreStep: 32,
    foodScore: 12,
    description: "Sharper starts and faster pressure ramps.",
  },
};

const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const DIRECTION_KEYS = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

const getStoredSnapshot = () => {
  if (typeof window === "undefined") {
    return {
      bestScore: 0,
      difficulty: DEFAULT_DIFFICULTY,
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        bestScore: 0,
        difficulty: DEFAULT_DIFFICULTY,
      };
    }

    const parsed = JSON.parse(raw);
    if (typeof parsed === "number") {
      return {
        bestScore: Number(parsed) || 0,
        difficulty: DEFAULT_DIFFICULTY,
      };
    }

    return {
      bestScore: Number(parsed?.bestScore) || 0,
      difficulty: DIFFICULTIES[parsed?.difficulty] ? parsed.difficulty : DEFAULT_DIFFICULTY,
    };
  } catch {
    const legacyBest = Number(window.localStorage.getItem(STORAGE_KEY));
    return {
      bestScore: Number.isFinite(legacyBest) && legacyBest > 0 ? legacyBest : 0,
      difficulty: DEFAULT_DIFFICULTY,
    };
  }
};

const randomCell = (blockedCells) => {
  const blocked = new Set(blockedCells.map((cell) => `${cell.x}:${cell.y}`));
  const free = [];

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (!blocked.has(`${x}:${y}`)) {
        free.push({ x, y });
      }
    }
  }

  return free[Math.floor(Math.random() * free.length)] || { x: 0, y: 0 };
};

const createFreshState = ({ bestScore = 0, difficulty = DEFAULT_DIFFICULTY } = {}) => {
  const snake = [...STARTING_SNAKE];
  return {
    snake,
    direction: DIRECTIONS.right,
    pendingDirection: DIRECTIONS.right,
    food: randomCell(snake),
    score: 0,
    bestScore,
    moves: 0,
    gameOver: false,
    paused: false,
    difficulty,
    foodsEaten: 0,
  };
};

const isOppositeDirection = (left, right) =>
  left.x + right.x === 0 && left.y + right.y === 0;

const getSpeedForState = (difficulty, score) => {
  const config = DIFFICULTIES[difficulty] || DIFFICULTIES[DEFAULT_DIFFICULTY];
  return Math.max(config.minSpeed, config.baseSpeed - Math.floor(score / config.scoreStep) * config.speedStep);
};

export default function SnakeXavia({ onSessionChange }) {
  const [state, setState] = useState(() => createFreshState(getStoredSnapshot()));
  const touchStartRef = useRef(null);
  const { snake, direction, pendingDirection, food, score, bestScore, moves, gameOver, paused, difficulty, foodsEaten } =
    state;

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          bestScore,
          difficulty,
        })
      );
    }
  }, [bestScore, difficulty]);

  useEffect(() => {
    onSessionChange?.({
      score,
      bestScore,
      moves,
      highestTile: snake.length,
      gameOver,
      game: "snake-xavia",
      difficulty,
      foodsEaten,
    });
  }, [bestScore, difficulty, foodsEaten, gameOver, moves, onSessionChange, score, snake.length]);

  const queueDirection = (nextKey) => {
    const nextDirection = DIRECTIONS[nextKey];
    if (!nextDirection) {
      return;
    }

    setState((current) => {
      if (current.gameOver) {
        return current;
      }

      if (isOppositeDirection(current.direction, nextDirection)) {
        return current;
      }

      return { ...current, pendingDirection: nextDirection, paused: false };
    });
  };

  const startNewGame = () => {
    setState((current) =>
      createFreshState({
        bestScore: Math.max(current.bestScore, current.score),
        difficulty: current.difficulty,
      })
    );
  };

  const changeDifficulty = (nextDifficulty) => {
    if (!DIFFICULTIES[nextDifficulty]) {
      return;
    }

    setState((current) =>
      createFreshState({
        bestScore: Math.max(current.bestScore, current.score),
        difficulty: nextDifficulty,
      })
    );
  };

  const togglePause = () => {
    setState((current) => (current.gameOver ? current : { ...current, paused: !current.paused }));
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      const key = DIRECTION_KEYS[event.key] || DIRECTION_KEYS[event.key?.toLowerCase?.()];
      if (key) {
        event.preventDefault();
        queueDirection(key);
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        togglePause();
      }
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (gameOver || paused) {
      return undefined;
    }

    const difficultyConfig = DIFFICULTIES[difficulty] || DIFFICULTIES[DEFAULT_DIFFICULTY];
    const speed = getSpeedForState(difficulty, score);
    const timer = window.setInterval(() => {
      setState((current) => {
        if (current.gameOver || current.paused) {
          return current;
        }

        const nextDirection = isOppositeDirection(current.direction, current.pendingDirection)
          ? current.direction
          : current.pendingDirection;

        const head = current.snake[0];
        const nextHead = {
          x: head.x + nextDirection.x,
          y: head.y + nextDirection.y,
        };

        const hitsWall =
          nextHead.x < 0 ||
          nextHead.x >= BOARD_SIZE ||
          nextHead.y < 0 ||
          nextHead.y >= BOARD_SIZE;
        const hitsSelf = current.snake.some((cell) => cell.x === nextHead.x && cell.y === nextHead.y);

        if (hitsWall || hitsSelf) {
          return {
            ...current,
            gameOver: true,
            bestScore: Math.max(current.bestScore, current.score),
          };
        }

        const ateFood = nextHead.x === current.food.x && nextHead.y === current.food.y;
        const nextSnake = ateFood
          ? [nextHead, ...current.snake]
          : [nextHead, ...current.snake.slice(0, -1)];
        const nextScore = ateFood ? current.score + difficultyConfig.foodScore : current.score;
        const nextBest = Math.max(current.bestScore, nextScore);

        return {
          snake: nextSnake,
          direction: nextDirection,
          pendingDirection: nextDirection,
          food: ateFood ? randomCell(nextSnake) : current.food,
          score: nextScore,
          bestScore: nextBest,
          moves: current.moves + 1,
          gameOver: false,
          paused: false,
          difficulty: current.difficulty,
          foodsEaten: ateFood ? current.foodsEaten + 1 : current.foodsEaten,
        };
      });
    }, speed);

    return () => window.clearInterval(timer);
  }, [difficulty, gameOver, paused, score]);

  const occupiedMap = useMemo(() => {
    const map = new Map();
    snake.forEach((cell, index) => {
      map.set(`${cell.x}:${cell.y}`, index === 0 ? "head" : "body");
    });
    return map;
  }, [snake]);

  const difficultyConfig = DIFFICULTIES[difficulty] || DIFFICULTIES[DEFAULT_DIFFICULTY];
  const speed = getSpeedForState(difficulty, score);
  const nextRampAt = Math.ceil((score + 1) / difficultyConfig.scoreStep) * difficultyConfig.scoreStep;
  const paceLabel =
    speed <= 88 ? "Ferocious" : speed <= 110 ? "Fast" : speed <= 140 ? "Flowing" : "Steady";

  const statusText = gameOver
    ? "You crashed. Spin up another run and chase a cleaner line."
    : paused
      ? "Paused. Press Space or tap any direction to continue."
      : `${difficultyConfig.label} mode is live. Use arrow keys, WASD, or swipe to steer.`;

  const handleTouchStart = (event) => {
    const touch = event.changedTouches?.[0];
    if (!touch) {
      return;
    }

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
  };

  const handleTouchEnd = (event) => {
    const start = touchStartRef.current;
    const touch = event.changedTouches?.[0];
    touchStartRef.current = null;

    if (!start || !touch) {
      return;
    }

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < SWIPE_THRESHOLD) {
      return;
    }

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      queueDirection(deltaX > 0 ? "right" : "left");
      return;
    }

    queueDirection(deltaY > 0 ? "down" : "up");
  };

  return (
    <section className="game-snake-shell">
      <div className="game-snake-head">
        <div>
          <p className="game-snake-kicker">Tengacion original</p>
          <h3>Snake Xavia</h3>
          <p>{statusText}</p>
        </div>
        <div className="game-snake-head-actions">
          <button type="button" className="btn-secondary" onClick={togglePause} disabled={gameOver}>
            {paused ? "Resume" : "Pause"}
          </button>
          <button type="button" className="btn-secondary" onClick={startNewGame}>
            New game
          </button>
        </div>
      </div>

      <div className="game-snake-toolbar">
        <div className="game-snake-difficulty" role="tablist" aria-label="Snake difficulty">
          {Object.entries(DIFFICULTIES).map(([key, option]) => (
            <button
              key={key}
              type="button"
              className={difficulty === key ? "active" : ""}
              onClick={() => changeDifficulty(key)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="game-snake-rhythm">
          <span>{paceLabel} pace</span>
          <strong>{speed} ms</strong>
          <small>Next speed lift at {nextRampAt}</small>
        </div>
      </div>

      <div className="game-snake-stats">
        <div>
          <span>Score</span>
          <strong>{score}</strong>
        </div>
        <div>
          <span>Best</span>
          <strong>{bestScore}</strong>
        </div>
        <div>
          <span>Food taken</span>
          <strong>{foodsEaten}</strong>
        </div>
        <div>
          <span>Length</span>
          <strong>{snake.length}</strong>
        </div>
      </div>

      <div className="game-snake-stage">
        <div className="game-snake-board-shell">
          <div
            className={`game-snake-board ${gameOver ? "game-over" : ""} ${paused ? "paused" : ""}`}
            style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }}
            aria-label="Snake Xavia board"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={() => {
              touchStartRef.current = null;
            }}
          >
            {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
              const x = index % BOARD_SIZE;
              const y = Math.floor(index / BOARD_SIZE);
              const key = `${x}:${y}`;
              const cellType =
                occupiedMap.get(key) || (food.x === x && food.y === y ? "food" : "empty");
              return <div key={key} className={`game-snake-cell ${cellType}`} />;
            })}
          </div>

          {(gameOver || paused) && (
            <div className="game-snake-overlay">
              <strong>{gameOver ? "Run ended" : "Run paused"}</strong>
              <p>
                {gameOver
                  ? "Tap New game to restart or switch modes for a different pace."
                  : "Tap Resume, press Space, or choose a direction to jump back in."}
              </p>
            </div>
          )}
        </div>

        <div className="game-snake-aside">
          <div className="game-snake-aside-card">
            <span>Mode note</span>
            <p>{difficultyConfig.description}</p>
          </div>
          <div className="game-snake-aside-card">
            <span>Control flow</span>
            <p>Mobile swipes work on the board. Desktop players can use arrows or WASD.</p>
          </div>
          <div className="game-snake-controls" aria-label="Snake movement controls">
            <button type="button" onClick={() => queueDirection("up")}>
              Up
            </button>
            <button type="button" onClick={() => queueDirection("left")}>
              Left
            </button>
            <button type="button" onClick={() => queueDirection("down")}>
              Down
            </button>
            <button type="button" onClick={() => queueDirection("right")}>
              Right
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
