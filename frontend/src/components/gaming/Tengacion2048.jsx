import { useEffect, useState } from "react";

const STORAGE_KEY = "tengacion.gaming.2048.state";
const GRID_SIZE = 4;
const DIRECTIONS = {
  up: "up",
  down: "down",
  left: "left",
  right: "right",
};

const createEmptyBoard = () =>
  Array.from({ length: GRID_SIZE }, () => Array.from({ length: GRID_SIZE }, () => 0));

const cloneBoard = (board) => board.map((row) => [...row]);

const getEmptyCells = (board) => {
  const cells = [];
  board.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (!value) {
        cells.push({ rowIndex, colIndex });
      }
    });
  });
  return cells;
};

const addRandomTile = (board) => {
  const nextBoard = cloneBoard(board);
  const emptyCells = getEmptyCells(nextBoard);
  if (!emptyCells.length) {
    return nextBoard;
  }

  const target = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  nextBoard[target.rowIndex][target.colIndex] = Math.random() < 0.9 ? 2 : 4;
  return nextBoard;
};

const createFreshState = () => {
  let board = createEmptyBoard();
  board = addRandomTile(board);
  board = addRandomTile(board);
  return {
    board,
    score: 0,
    bestScore: 0,
    moves: 0,
    highestTile: 4,
    gameOver: false,
  };
};

const readStoredState = () => {
  if (typeof window === "undefined") {
    return createFreshState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createFreshState();
    }
    const parsed = JSON.parse(raw);
    const board = Array.isArray(parsed?.board) ? parsed.board : createFreshState().board;
    return {
      board,
      score: Number(parsed?.score) || 0,
      bestScore: Number(parsed?.bestScore) || 0,
      moves: Number(parsed?.moves) || 0,
      highestTile: Number(parsed?.highestTile) || 4,
      gameOver: Boolean(parsed?.gameOver),
    };
  } catch {
    return createFreshState();
  }
};

const operateLine = (line) => {
  const compact = line.filter(Boolean);
  const merged = [];
  let scoreGain = 0;

  for (let index = 0; index < compact.length; index += 1) {
    const current = compact[index];
    const next = compact[index + 1];

    if (current && current === next) {
      const combined = current * 2;
      merged.push(combined);
      scoreGain += combined;
      index += 1;
      continue;
    }

    merged.push(current);
  }

  while (merged.length < GRID_SIZE) {
    merged.push(0);
  }

  const moved = merged.some((value, index) => value !== line[index]);
  return { line: merged, scoreGain, moved };
};

const getColumn = (board, colIndex) => board.map((row) => row[colIndex]);

const setColumn = (board, colIndex, values) => {
  values.forEach((value, rowIndex) => {
    board[rowIndex][colIndex] = value;
  });
};

const hasMovesAvailable = (board) => {
  if (getEmptyCells(board).length > 0) {
    return true;
  }

  for (let rowIndex = 0; rowIndex < GRID_SIZE; rowIndex += 1) {
    for (let colIndex = 0; colIndex < GRID_SIZE; colIndex += 1) {
      const value = board[rowIndex][colIndex];
      if (board[rowIndex][colIndex + 1] === value || board[rowIndex + 1]?.[colIndex] === value) {
        return true;
      }
    }
  }

  return false;
};

const moveBoard = (board, direction) => {
  const nextBoard = cloneBoard(board);
  let moved = false;
  let scoreGain = 0;

  if (direction === DIRECTIONS.left || direction === DIRECTIONS.right) {
    nextBoard.forEach((row, rowIndex) => {
      const source = direction === DIRECTIONS.right ? [...row].reverse() : row;
      const operated = operateLine(source);
      const finalLine =
        direction === DIRECTIONS.right ? [...operated.line].reverse() : operated.line;
      nextBoard[rowIndex] = finalLine;
      moved = moved || operated.moved;
      scoreGain += operated.scoreGain;
    });
  }

  if (direction === DIRECTIONS.up || direction === DIRECTIONS.down) {
    for (let colIndex = 0; colIndex < GRID_SIZE; colIndex += 1) {
      const column = getColumn(nextBoard, colIndex);
      const source = direction === DIRECTIONS.down ? [...column].reverse() : column;
      const operated = operateLine(source);
      const finalLine =
        direction === DIRECTIONS.down ? [...operated.line].reverse() : operated.line;
      setColumn(nextBoard, colIndex, finalLine);
      moved = moved || operated.moved;
      scoreGain += operated.scoreGain;
    }
  }

  return { nextBoard, moved, scoreGain };
};

const getHighestTile = (board) => Math.max(...board.flat());

export default function Tengacion2048({ onSessionChange }) {
  const [state, setState] = useState(() => readStoredState());
  const { board, score, bestScore, moves, highestTile, gameOver } = state;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    onSessionChange?.(state);
  }, [onSessionChange, state]);

  const startNewGame = () => {
    setState((current) => {
      const fresh = createFreshState();
      return {
        ...fresh,
        bestScore: Math.max(current.bestScore, current.score, fresh.bestScore),
      };
    });
  };

  const handleMove = (direction) => {
    setState((current) => {
      if (current.gameOver) {
        return current;
      }

      const { nextBoard, moved, scoreGain } = moveBoard(current.board, direction);
      if (!moved) {
        return current;
      }

      const boardWithSpawn = addRandomTile(nextBoard);
      const nextScore = current.score + scoreGain;
      const nextBestScore = Math.max(current.bestScore, nextScore);
      const nextHighestTile = Math.max(current.highestTile, getHighestTile(boardWithSpawn));
      const nextGameOver = !hasMovesAvailable(boardWithSpawn);

      return {
        board: boardWithSpawn,
        score: nextScore,
        bestScore: nextBestScore,
        moves: current.moves + 1,
        highestTile: nextHighestTile,
        gameOver: nextGameOver,
      };
    });
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      const keyMap = {
        ArrowUp: DIRECTIONS.up,
        ArrowDown: DIRECTIONS.down,
        ArrowLeft: DIRECTIONS.left,
        ArrowRight: DIRECTIONS.right,
      };

      const direction = keyMap[event.key];
      if (!direction) {
        return;
      }

      event.preventDefault();
      handleMove(direction);
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const tileMeta = {
    0: { label: "", className: "empty" },
    2: { label: "2", className: "v2" },
    4: { label: "4", className: "v4" },
    8: { label: "8", className: "v8" },
    16: { label: "16", className: "v16" },
    32: { label: "32", className: "v32" },
    64: { label: "64", className: "v64" },
    128: { label: "128", className: "v128" },
    256: { label: "256", className: "v256" },
    512: { label: "512", className: "v512" },
    1024: { label: "1024", className: "v1024" },
    2048: { label: "2048", className: "v2048" },
  };

  const statusText = gameOver
    ? "No more moves. Start a new run and beat your best."
    : highestTile >= 2048
      ? "You hit 2048. Keep going for a higher score."
      : "Use your arrow keys or the controls below to combine matching tiles.";

  return (
    <section className="game-2048-shell">
      <div className="game-2048-head">
        <div>
          <p className="game-2048-kicker">Open-source spotlight</p>
          <h3>2048 Classic</h3>
          <p>{statusText}</p>
        </div>
        <button type="button" className="btn-secondary" onClick={startNewGame}>
          New game
        </button>
      </div>

      <div className="game-2048-stats">
        <div>
          <span>Score</span>
          <strong>{score}</strong>
        </div>
        <div>
          <span>Best</span>
          <strong>{bestScore}</strong>
        </div>
        <div>
          <span>Moves</span>
          <strong>{moves}</strong>
        </div>
        <div>
          <span>Top tile</span>
          <strong>{highestTile}</strong>
        </div>
      </div>

      <div className="game-2048-board" aria-label="2048 board">
        {board.flat().map((value, index) => {
          const meta = tileMeta[value] || { label: String(value), className: "v2048" };
          return (
            <div key={`${index}-${value}`} className={`game-2048-tile ${meta.className}`}>
              {meta.label}
            </div>
          );
        })}
      </div>

      <div className="game-2048-controls" aria-label="2048 movement controls">
        <button type="button" onClick={() => handleMove(DIRECTIONS.up)}>
          Up
        </button>
        <button type="button" onClick={() => handleMove(DIRECTIONS.left)}>
          Left
        </button>
        <button type="button" onClick={() => handleMove(DIRECTIONS.down)}>
          Down
        </button>
        <button type="button" onClick={() => handleMove(DIRECTIONS.right)}>
          Right
        </button>
      </div>
    </section>
  );
}
