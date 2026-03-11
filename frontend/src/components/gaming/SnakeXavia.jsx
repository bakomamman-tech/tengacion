import { useEffect, useMemo, useState } from "react";

const BOARD_SIZE = 14;
const STORAGE_KEY = "tengacion.gaming.snake-xavia.best";
const STARTING_SNAKE = [
  { x: 4, y: 7 },
  { x: 3, y: 7 },
  { x: 2, y: 7 },
];

const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const directionKeys = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

const getStoredBest = () => {
  if (typeof window === "undefined") {
    return 0;
  }

  const value = Number(window.localStorage.getItem(STORAGE_KEY));
  return Number.isFinite(value) && value > 0 ? value : 0;
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

const createFreshState = (bestScore = 0) => {
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
  };
};

const isOppositeDirection = (left, right) =>
  left.x + right.x === 0 && left.y + right.y === 0;

export default function SnakeXavia({ onSessionChange }) {
  const [state, setState] = useState(() => createFreshState(getStoredBest()));
  const { snake, direction, pendingDirection, food, score, bestScore, moves, gameOver, paused } = state;

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, String(bestScore));
    }
  }, [bestScore]);

  useEffect(() => {
    onSessionChange?.({
      score,
      bestScore,
      moves,
      highestTile: snake.length,
      gameOver,
      game: "snake-xavia",
    });
  }, [bestScore, gameOver, moves, onSessionChange, score, snake.length]);

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
    setState((current) => createFreshState(Math.max(current.bestScore, current.score)));
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      const key = directionKeys[event.key] || directionKeys[event.key?.toLowerCase?.()];
      if (key) {
        event.preventDefault();
        queueDirection(key);
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        setState((current) =>
          current.gameOver ? current : { ...current, paused: !current.paused }
        );
      }
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (gameOver || paused) {
      return undefined;
    }

    const speed = Math.max(82, 150 - Math.floor(score / 40) * 8);
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
        const nextScore = ateFood ? current.score + 10 : current.score;
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
        };
      });
    }, speed);

    return () => window.clearInterval(timer);
  }, [gameOver, paused, score]);

  const occupiedMap = useMemo(() => {
    const map = new Map();
    snake.forEach((cell, index) => {
      map.set(`${cell.x}:${cell.y}`, index === 0 ? "head" : "body");
    });
    return map;
  }, [snake]);

  const statusText = gameOver
    ? "You crashed. Start a new run and beat your best score."
    : paused
      ? "Paused. Press Space or any direction control to continue."
      : "Use arrow keys or WASD. Space pauses the run.";

  return (
    <section className="game-snake-shell">
      <div className="game-snake-head">
        <div>
          <p className="game-snake-kicker">Tengacion original</p>
          <h3>Snake Xavia</h3>
          <p>{statusText}</p>
        </div>
        <div className="game-snake-head-actions">
          <button type="button" className="btn-secondary" onClick={() => setState((current) => ({ ...current, paused: !current.paused }))} disabled={gameOver}>
            {paused ? "Resume" : "Pause"}
          </button>
          <button type="button" className="btn-secondary" onClick={startNewGame}>
            New game
          </button>
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
          <span>Steps</span>
          <strong>{moves}</strong>
        </div>
        <div>
          <span>Length</span>
          <strong>{snake.length}</strong>
        </div>
      </div>

      <div
        className={`game-snake-board ${gameOver ? "game-over" : ""}`}
        style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }}
        aria-label="Snake Xavia board"
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
    </section>
  );
}
