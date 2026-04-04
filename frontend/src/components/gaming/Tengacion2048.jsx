import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "tengacion.gaming.2048.state";
const GRID_SIZE = 4;
const MAX_HISTORY = 12;
const SWIPE_THRESHOLD = 24;
const DIRECTIONS = {
  up: "up",
  down: "down",
  left: "left",
  right: "right",
};

const TILE_META = {
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

const createFreshState = (bestScore = 0) => {
  let board = createEmptyBoard();
  board = addRandomTile(board);
  board = addRandomTile(board);
  return {
    board,
    score: 0,
    bestScore,
    moves: 0,
    highestTile: 4,
    gameOver: false,
    won: false,
    combo: 0,
    lastGain: 0,
    history: [],
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
    const bestScore = Number(parsed?.bestScore) || 0;
    return {
      board,
      score: Number(parsed?.score) || 0,
      bestScore,
      moves: Number(parsed?.moves) || 0,
      highestTile: Number(parsed?.highestTile) || 4,
      gameOver: Boolean(parsed?.gameOver),
      won: Boolean(parsed?.won),
      combo: Number(parsed?.combo) || 0,
      lastGain: Number(parsed?.lastGain) || 0,
      history: Array.isArray(parsed?.history) ? parsed.history.slice(-MAX_HISTORY) : [],
    };
  } catch {
    return createFreshState();
  }
};

const operateLine = (line) => {
  const compact = line.filter(Boolean);
  const merged = [];
  let scoreGain = 0;
  let mergeCount = 0;

  for (let index = 0; index < compact.length; index += 1) {
    const current = compact[index];
    const next = compact[index + 1];

    if (current && current === next) {
      const combined = current * 2;
      merged.push(combined);
      scoreGain += combined;
      mergeCount += 1;
      index += 1;
      continue;
    }

    merged.push(current);
  }

  while (merged.length < GRID_SIZE) {
    merged.push(0);
  }

  const moved = merged.some((value, index) => value !== line[index]);
  return { line: merged, scoreGain, mergeCount, moved };
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
  let mergeCount = 0;

  if (direction === DIRECTIONS.left || direction === DIRECTIONS.right) {
    nextBoard.forEach((row, rowIndex) => {
      const source = direction === DIRECTIONS.right ? [...row].reverse() : row;
      const operated = operateLine(source);
      const finalLine =
        direction === DIRECTIONS.right ? [...operated.line].reverse() : operated.line;
      nextBoard[rowIndex] = finalLine;
      moved = moved || operated.moved;
      scoreGain += operated.scoreGain;
      mergeCount += operated.mergeCount;
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
      mergeCount += operated.mergeCount;
    }
  }

  return { nextBoard, moved, scoreGain, mergeCount };
};

const getHighestTile = (board) => Math.max(...board.flat());

const buildSnapshot = (state) => ({
  board: cloneBoard(state.board),
  score: state.score,
  moves: state.moves,
  highestTile: state.highestTile,
  gameOver: state.gameOver,
  won: state.won,
  combo: state.combo,
});

export default function Tengacion2048({ onSessionChange }) {
  const [state, setState] = useState(() => readStoredState());
  const touchStartRef = useRef(null);
  const { board, score, bestScore, moves, highestTile, gameOver, won, combo, lastGain, history } =
    state;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    onSessionChange?.({
      ...state,
      game: "2048-classic",
    });
  }, [onSessionChange, state]);

  const startNewGame = () => {
    setState((current) => createFreshState(Math.max(current.bestScore, current.score)));
  };

  const undoMove = () => {
    setState((current) => {
      if (!current.history.length) {
        return current;
      }

      const previous = current.history[current.history.length - 1];
      return {
        ...current,
        ...previous,
        board: cloneBoard(previous.board),
        bestScore: Math.max(current.bestScore, previous.score),
        gameOver: false,
        lastGain: 0,
        history: current.history.slice(0, -1),
      };
    });
  };

  const handleMove = (direction) => {
    setState((current) => {
      if (current.gameOver) {
        return current;
      }

      const { nextBoard, moved, scoreGain, mergeCount } = moveBoard(current.board, direction);
      if (!moved) {
        return current;
      }

      const boardWithSpawn = addRandomTile(nextBoard);
      const nextScore = current.score + scoreGain;
      const nextHighestTile = Math.max(current.highestTile, getHighestTile(boardWithSpawn));
      const nextWon = current.won || nextHighestTile >= 2048;
      const nextCombo = mergeCount ? current.combo + 1 : 0;

      return {
        board: boardWithSpawn,
        score: nextScore,
        bestScore: Math.max(current.bestScore, nextScore),
        moves: current.moves + 1,
        highestTile: nextHighestTile,
        gameOver: !hasMovesAvailable(boardWithSpawn),
        won: nextWon,
        combo: nextCombo,
        lastGain: scoreGain,
        history: [...current.history.slice(-(MAX_HISTORY - 1)), buildSnapshot(current)],
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

  const statusText = gameOver
    ? "The board is locked. Undo the last move or start a fresh run."
    : won
      ? "You cleared 2048. Keep stacking for a bigger finish."
      : highestTile >= 1024
        ? "You are deep in the run now. One great merge can flip the board."
        : lastGain > 0
          ? `Last move banked ${lastGain} points. Keep your center open.`
          : "Use arrow keys or swipe to pair matching tiles and build momentum.";

  const nextTarget = highestTile >= 2048 ? highestTile * 2 : Math.max(8, highestTile * 2);

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
      handleMove(deltaX > 0 ? DIRECTIONS.right : DIRECTIONS.left);
      return;
    }

    handleMove(deltaY > 0 ? DIRECTIONS.down : DIRECTIONS.up);
  };

  return (
    <section className="game-2048-shell">
      <div className="game-2048-head">
        <div>
          <p className="game-2048-kicker">Open-source spotlight</p>
          <h3>2048 Classic</h3>
          <p>{statusText}</p>
        </div>

        <div className="game-2048-head-actions">
          <button type="button" className="btn-secondary" onClick={undoMove} disabled={!history.length}>
            Undo
          </button>
          <button type="button" className="btn-secondary" onClick={startNewGame}>
            New game
          </button>
        </div>
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

      <div className="game-2048-pulse">
        <article>
          <span>Next target</span>
          <strong>{nextTarget}</strong>
          <p>Build smaller pairs on the edge, then collapse them inward.</p>
        </article>
        <article>
          <span>Merge streak</span>
          <strong>{combo}</strong>
          <p>{combo ? "You are chaining productive moves." : "Start a streak with back-to-back merges."}</p>
        </article>
        <article>
          <span>Saved state</span>
          <strong>{history.length}</strong>
          <p>Undo remembers your last {history.length || 0} move{history.length === 1 ? "" : "s"}.</p>
        </article>
      </div>

      <div className="game-2048-stage">
        <div className="game-2048-board-shell">
          <div
            className="game-2048-board"
            aria-label="2048 board"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={() => {
              touchStartRef.current = null;
            }}
          >
            {board.flat().map((value, index) => {
              const meta = TILE_META[value] || { label: String(value), className: "v2048" };
              return (
                <div key={`${index}-${value}`} className={`game-2048-tile ${meta.className}`}>
                  {meta.label}
                </div>
              );
            })}
          </div>

          {gameOver && (
            <div className="game-2048-overlay">
              <strong>Run over</strong>
              <p>Undo to recover the board or launch a fresh climb.</p>
            </div>
          )}
        </div>

        <div className="game-2048-aside">
          <div className="game-2048-aside-card">
            <span>Control flow</span>
            <p>
              Arrow keys work on desktop. On mobile, swipe across the board to steer the tiles.
            </p>
          </div>
          <div className="game-2048-aside-card">
            <span>Run note</span>
            <p>
              {won
                ? "2048 is already cleared, so this run is now about elegant board management."
                : "Keep your largest tile anchored and avoid scattering medium-value stacks."}
            </p>
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
        </div>
      </div>
    </section>
  );
}
