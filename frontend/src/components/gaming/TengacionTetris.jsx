import { useEffect, useMemo, useState } from "react";

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const PREVIEW_COUNT = 3;
const BASE_DROP_DELAY = 760;
const MIN_DROP_DELAY = 110;
const STORAGE_KEY = "tengacion.gaming.tetris.state";

const TETROMINOES = {
  I: {
    label: "I Beam",
    matrix: [[1, 1, 1, 1]],
  },
  O: {
    label: "O Block",
    matrix: [
      [1, 1],
      [1, 1],
    ],
  },
  T: {
    label: "T Crown",
    matrix: [
      [0, 1, 0],
      [1, 1, 1],
    ],
  },
  S: {
    label: "S Shift",
    matrix: [
      [0, 1, 1],
      [1, 1, 0],
    ],
  },
  Z: {
    label: "Z Drift",
    matrix: [
      [1, 1, 0],
      [0, 1, 1],
    ],
  },
  J: {
    label: "J Hook",
    matrix: [
      [1, 0, 0],
      [1, 1, 1],
    ],
  },
  L: {
    label: "L Lift",
    matrix: [
      [0, 0, 1],
      [1, 1, 1],
    ],
  },
};

const PIECE_TYPES = Object.keys(TETROMINOES);

const createEmptyBoard = () =>
  Array.from({ length: BOARD_HEIGHT }, () => Array.from({ length: BOARD_WIDTH }, () => null));

const cloneBoard = (board) => board.map((row) => [...row]);

const shuffleBag = () => {
  const bag = [...PIECE_TYPES];
  for (let index = bag.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [bag[index], bag[swapIndex]] = [bag[swapIndex], bag[index]];
  }
  return bag;
};

const rotateMatrix = (matrix) =>
  Array.from({ length: matrix[0].length }, (_, colIndex) =>
    Array.from({ length: matrix.length }, (_, rowIndex) => matrix[matrix.length - 1 - rowIndex][colIndex])
  );

const getPieceMatrix = (type, rotation = 0) => {
  let matrix = TETROMINOES[type]?.matrix || TETROMINOES.T.matrix;
  for (let turn = 0; turn < rotation % 4; turn += 1) {
    matrix = rotateMatrix(matrix);
  }
  return matrix;
};

const createActivePiece = (type, rotation = 0) => {
  const matrix = getPieceMatrix(type, rotation);
  return {
    type,
    rotation,
    row: -1,
    col: Math.floor((BOARD_WIDTH - matrix[0].length) / 2),
  };
};

const fillQueue = (queue, bag, minimumLength) => {
  const nextQueue = [...queue];
  let nextBag = [...bag];

  while (nextQueue.length < minimumLength) {
    if (!nextBag.length) {
      nextBag = shuffleBag();
    }
    nextQueue.push(nextBag[0]);
    nextBag = nextBag.slice(1);
  }

  return { queue: nextQueue, bag: nextBag };
};

const pullNextPiece = (queue, bag) => {
  const prepared = fillQueue(queue, bag, PREVIEW_COUNT + 1);
  const [type, ...remainingQueue] = prepared.queue;
  const toppedUp = fillQueue(remainingQueue, prepared.bag, PREVIEW_COUNT);
  return {
    type,
    queue: toppedUp.queue,
    bag: toppedUp.bag,
  };
};

const hasCollision = (board, piece) => {
  const matrix = getPieceMatrix(piece.type, piece.rotation);
  for (let rowIndex = 0; rowIndex < matrix.length; rowIndex += 1) {
    for (let colIndex = 0; colIndex < matrix[rowIndex].length; colIndex += 1) {
      if (!matrix[rowIndex][colIndex]) {
        continue;
      }

      const boardRow = piece.row + rowIndex;
      const boardCol = piece.col + colIndex;

      if (boardCol < 0 || boardCol >= BOARD_WIDTH || boardRow >= BOARD_HEIGHT) {
        return true;
      }

      if (boardRow >= 0 && board[boardRow][boardCol]) {
        return true;
      }
    }
  }

  return false;
};

const mergePieceIntoBoard = (board, piece) => {
  const nextBoard = cloneBoard(board);
  const matrix = getPieceMatrix(piece.type, piece.rotation);
  let toppedOut = false;

  for (let rowIndex = 0; rowIndex < matrix.length; rowIndex += 1) {
    for (let colIndex = 0; colIndex < matrix[rowIndex].length; colIndex += 1) {
      if (!matrix[rowIndex][colIndex]) {
        continue;
      }

      const boardRow = piece.row + rowIndex;
      const boardCol = piece.col + colIndex;

      if (boardRow < 0) {
        toppedOut = true;
        continue;
      }

      nextBoard[boardRow][boardCol] = piece.type;
    }
  }

  return { board: nextBoard, toppedOut };
};

const clearCompletedLines = (board) => {
  const remainingRows = board.filter((row) => row.some((cell) => !cell));
  const cleared = BOARD_HEIGHT - remainingRows.length;
  const nextBoard = [
    ...Array.from({ length: cleared }, () => Array.from({ length: BOARD_WIDTH }, () => null)),
    ...remainingRows,
  ];
  return { board: nextBoard, cleared };
};

const getLevelFromLines = (lines) => 1 + Math.floor(lines / 10);

const getDropDelay = (level) => Math.max(MIN_DROP_DELAY, BASE_DROP_DELAY - (level - 1) * 58);

const getClearLabel = (count) => {
  if (count === 1) return "Single";
  if (count === 2) return "Double";
  if (count === 3) return "Triple";
  if (count >= 4) return "Tetris";
  return "Lock";
};

const getLineScore = (cleared, level) => {
  const scores = {
    0: 0,
    1: 100,
    2: 300,
    3: 500,
    4: 800,
  };

  return (scores[cleared] || 0) * level;
};

const buildPreviewMatrix = (type) => {
  const grid = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => 0));
  if (!type) {
    return grid;
  }

  const matrix = getPieceMatrix(type, 0);
  const rowOffset = Math.floor((4 - matrix.length) / 2);
  const colOffset = Math.floor((4 - matrix[0].length) / 2);

  matrix.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (!cell) {
        return;
      }

      grid[rowIndex + rowOffset][colIndex + colOffset] = 1;
    });
  });

  return grid;
};

const createFreshState = (bestScore = 0) => {
  const pulled = pullNextPiece([], []);
  return {
    board: createEmptyBoard(),
    current: createActivePiece(pulled.type),
    queue: pulled.queue,
    bag: pulled.bag,
    hold: null,
    canHold: true,
    score: 0,
    bestScore,
    lines: 0,
    level: 1,
    moves: 0,
    combo: 0,
    lastClear: 0,
    lastPlaced: pulled.type,
    gameOver: false,
    paused: false,
    status: "Fresh stack online.",
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
    if (!Array.isArray(parsed?.board) || !parsed?.current?.type) {
      return createFreshState(Number(parsed?.bestScore) || 0);
    }

    return {
      board: parsed.board.map((row) =>
        Array.isArray(row)
          ? row.map((cell) => (PIECE_TYPES.includes(cell) ? cell : null))
          : Array.from({ length: BOARD_WIDTH }, () => null)
      ),
      current: {
        type: PIECE_TYPES.includes(parsed.current.type) ? parsed.current.type : "T",
        rotation: Number(parsed.current.rotation) || 0,
        row: Number(parsed.current.row) || 0,
        col: Number(parsed.current.col) || 0,
      },
      queue: Array.isArray(parsed.queue) ? parsed.queue.filter((type) => PIECE_TYPES.includes(type)) : [],
      bag: Array.isArray(parsed.bag) ? parsed.bag.filter((type) => PIECE_TYPES.includes(type)) : [],
      hold: PIECE_TYPES.includes(parsed.hold) ? parsed.hold : null,
      canHold: parsed.canHold !== false,
      score: Number(parsed.score) || 0,
      bestScore: Number(parsed.bestScore) || 0,
      lines: Number(parsed.lines) || 0,
      level: Number(parsed.level) || 1,
      moves: Number(parsed.moves) || 0,
      combo: Number(parsed.combo) || 0,
      lastClear: Number(parsed.lastClear) || 0,
      lastPlaced: PIECE_TYPES.includes(parsed.lastPlaced) ? parsed.lastPlaced : null,
      gameOver: Boolean(parsed.gameOver),
      paused: Boolean(parsed.paused),
      status: typeof parsed.status === "string" ? parsed.status : "Run restored.",
    };
  } catch {
    return createFreshState();
  }
};

const getGhostRow = (board, current) => {
  let nextRow = current.row;
  while (!hasCollision(board, { ...current, row: nextRow + 1 })) {
    nextRow += 1;
  }
  return nextRow;
};

const PreviewPanel = ({ title, type, secondary }) => {
  const preview = buildPreviewMatrix(type);

  return (
    <div className="game-tetris-preview-card">
      <span>{title}</span>
      <strong>{type ? TETROMINOES[type].label : "Empty slot"}</strong>
      <div className="game-tetris-preview-grid" aria-hidden="true">
        {preview.flat().map((cell, index) => (
          <div
            key={`${title}-${type || "empty"}-${index}`}
            className={`game-tetris-preview-cell ${cell ? `piece-${type?.toLowerCase?.()}` : "empty"}`}
          />
        ))}
      </div>
      {secondary ? <small>{secondary}</small> : null}
    </div>
  );
};

export default function TengacionTetris({ onSessionChange }) {
  const [state, setState] = useState(() => readStoredState());
  const {
    board,
    current,
    queue,
    bag,
    hold,
    canHold,
    score,
    bestScore,
    lines,
    level,
    moves,
    combo,
    lastClear,
    lastPlaced,
    gameOver,
    paused,
    status,
  } = state;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    onSessionChange?.({
      game: "tengacion-tetris",
      score,
      bestScore,
      moves,
      highestTile: level,
      lines,
      level,
      combo,
      lastPlaced,
      gameOver,
      status,
    });
  }, [bestScore, combo, gameOver, lastPlaced, level, lines, moves, onSessionChange, score, status]);

  const spawnNextPiece = (currentState, customType = null) => {
    let nextQueue = currentState.queue;
    let nextBag = currentState.bag;
    let nextType = customType;

    if (!nextType) {
      const pulled = pullNextPiece(nextQueue, nextBag);
      nextType = pulled.type;
      nextQueue = pulled.queue;
      nextBag = pulled.bag;
    }

    const nextCurrent = createActivePiece(nextType);
    const spawnBlocked = hasCollision(currentState.board, nextCurrent);

    return {
      ...currentState,
      current: nextCurrent,
      queue: nextQueue,
      bag: nextBag,
      canHold: true,
      lastPlaced: nextType,
      gameOver: spawnBlocked,
      paused: false,
      status: spawnBlocked ? "Stack jammed at spawn. Start a fresh run." : currentState.status,
    };
  };

  const lockCurrentPiece = (currentState, extraScore = 0) => {
    const merged = mergePieceIntoBoard(currentState.board, currentState.current);
    if (merged.toppedOut) {
      return {
        ...currentState,
        board: merged.board,
        score: currentState.score + extraScore,
        bestScore: Math.max(currentState.bestScore, currentState.score + extraScore),
        gameOver: true,
        paused: false,
        status: "The stack reached the ceiling. Reset and go again.",
      };
    }

    const cleared = clearCompletedLines(merged.board);
    const nextLines = currentState.lines + cleared.cleared;
    const nextLevel = getLevelFromLines(nextLines);
    const comboBonus = cleared.cleared && currentState.combo ? currentState.combo * 40 * nextLevel : 0;
    const gainedScore =
      getLineScore(cleared.cleared, nextLevel) + comboBonus + extraScore;
    const nextScore = currentState.score + gainedScore;

    const statusLine = cleared.cleared
      ? `${getClearLabel(cleared.cleared)} clear locked in.`
      : `${TETROMINOES[currentState.current.type].label} settled.`;

    const prepared = spawnNextPiece(
      {
        ...currentState,
        board: cleared.board,
        score: nextScore,
        bestScore: Math.max(currentState.bestScore, nextScore),
        lines: nextLines,
        level: nextLevel,
        moves: currentState.moves + 1,
        combo: cleared.cleared ? currentState.combo + 1 : 0,
        lastClear: cleared.cleared,
        paused: false,
        status: statusLine,
      }
    );

    return prepared;
  };

  const moveHorizontally = (direction) => {
    setState((currentState) => {
      if (currentState.gameOver || currentState.paused) {
        return currentState;
      }

      const nextPiece = { ...currentState.current, col: currentState.current.col + direction };
      if (hasCollision(currentState.board, nextPiece)) {
        return currentState;
      }

      return {
        ...currentState,
        current: nextPiece,
        status: direction < 0 ? "Shifted left." : "Shifted right.",
      };
    });
  };

  const rotatePiece = () => {
    setState((currentState) => {
      if (currentState.gameOver || currentState.paused) {
        return currentState;
      }

      const nextRotation = (currentState.current.rotation + 1) % 4;
      const candidate = { ...currentState.current, rotation: nextRotation };
      const kicks = [
        { row: 0, col: 0 },
        { row: 0, col: -1 },
        { row: 0, col: 1 },
        { row: -1, col: 0 },
        { row: 0, col: -2 },
        { row: 0, col: 2 },
      ];

      for (const kick of kicks) {
        const kickedPiece = {
          ...candidate,
          row: candidate.row + kick.row,
          col: candidate.col + kick.col,
        };
        if (!hasCollision(currentState.board, kickedPiece)) {
          return {
            ...currentState,
            current: kickedPiece,
            status: `${TETROMINOES[currentState.current.type].label} rotated cleanly.`,
          };
        }
      }

      return currentState;
    });
  };

  const stepDown = (withBonus = false) => {
    setState((currentState) => {
      if (currentState.gameOver || currentState.paused) {
        return currentState;
      }

      const nextPiece = { ...currentState.current, row: currentState.current.row + 1 };
      if (!hasCollision(currentState.board, nextPiece)) {
        return {
          ...currentState,
          current: nextPiece,
          score: withBonus ? currentState.score + 1 : currentState.score,
          bestScore: withBonus
            ? Math.max(currentState.bestScore, currentState.score + 1)
            : currentState.bestScore,
          status: withBonus ? "Soft drop engaged." : currentState.status,
        };
      }

      return lockCurrentPiece(currentState, withBonus ? 1 : 0);
    });
  };

  const hardDrop = () => {
    setState((currentState) => {
      if (currentState.gameOver || currentState.paused) {
        return currentState;
      }

      let dropDistance = 0;
      let nextPiece = currentState.current;
      while (!hasCollision(currentState.board, { ...nextPiece, row: nextPiece.row + 1 })) {
        nextPiece = { ...nextPiece, row: nextPiece.row + 1 };
        dropDistance += 1;
      }

      return lockCurrentPiece(
        {
          ...currentState,
          current: nextPiece,
          status: `Hard drop for ${dropDistance} row${dropDistance === 1 ? "" : "s"}.`,
        },
        dropDistance * 2
      );
    });
  };

  const holdCurrentPiece = () => {
    setState((currentState) => {
      if (currentState.gameOver || currentState.paused || !currentState.canHold) {
        return currentState;
      }

      const nextHold = currentState.current.type;
      const swappedState = {
        ...currentState,
        hold: nextHold,
        canHold: false,
        status: `${TETROMINOES[nextHold].label} moved into hold.`,
      };

      if (currentState.hold) {
        const nextCurrent = createActivePiece(currentState.hold);
        const blocked = hasCollision(currentState.board, nextCurrent);
        return {
          ...swappedState,
          current: nextCurrent,
          gameOver: blocked,
          paused: false,
          status: blocked
            ? "Hold swap blocked the lane. Start a fresh run."
            : `${TETROMINOES[currentState.hold].label} re-entered the stack.`,
        };
      }

      const pulled = pullNextPiece(currentState.queue, currentState.bag);
      const nextCurrent = createActivePiece(pulled.type);
      const blocked = hasCollision(currentState.board, nextCurrent);
      return {
        ...swappedState,
        current: nextCurrent,
        queue: pulled.queue,
        bag: pulled.bag,
        gameOver: blocked,
        paused: false,
        status: blocked ? "Hold pull blocked the spawn lane." : swappedState.status,
      };
    });
  };

  const togglePause = () => {
    setState((currentState) =>
      currentState.gameOver
        ? currentState
        : {
            ...currentState,
            paused: !currentState.paused,
            status: currentState.paused ? "Stack back in motion." : "Run paused.",
          }
    );
  };

  const startNewRun = () => {
    setState((currentState) => createFreshState(Math.max(currentState.bestScore, currentState.score)));
  };

  useEffect(() => {
    if (gameOver || paused) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setState((currentState) => {
        if (currentState.gameOver || currentState.paused) {
          return currentState;
        }

        const nextPiece = { ...currentState.current, row: currentState.current.row + 1 };
        if (!hasCollision(currentState.board, nextPiece)) {
          return {
            ...currentState,
            current: nextPiece,
          };
        }

        return lockCurrentPiece(currentState);
      });
    }, getDropDelay(level));

    return () => window.clearInterval(timer);
  }, [gameOver, level, paused]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveHorizontally(-1);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        moveHorizontally(1);
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        stepDown(true);
        return;
      }

      if (event.key === "ArrowUp" || event.key.toLowerCase() === "x") {
        event.preventDefault();
        rotatePiece();
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        hardDrop();
        return;
      }

      if (event.key.toLowerCase() === "c") {
        event.preventDefault();
        holdCurrentPiece();
        return;
      }

      if (event.key.toLowerCase() === "p") {
        event.preventDefault();
        togglePause();
      }
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [gameOver, paused]);

  const ghostRow = useMemo(() => getGhostRow(board, current), [board, current]);

  const displayBoard = useMemo(() => {
    const nextBoard = board.map((row) => row.map((cell) => (cell ? { type: cell, mode: "locked" } : null)));
    const currentMatrix = getPieceMatrix(current.type, current.rotation);

    currentMatrix.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (!cell) {
          return;
        }

        const boardRow = ghostRow + rowIndex;
        const boardCol = current.col + colIndex;
        if (boardRow >= 0 && boardRow < BOARD_HEIGHT && boardCol >= 0 && boardCol < BOARD_WIDTH && !nextBoard[boardRow][boardCol]) {
          nextBoard[boardRow][boardCol] = { type: current.type, mode: "ghost" };
        }
      });
    });

    currentMatrix.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (!cell) {
          return;
        }

        const boardRow = current.row + rowIndex;
        const boardCol = current.col + colIndex;
        if (boardRow >= 0 && boardRow < BOARD_HEIGHT && boardCol >= 0 && boardCol < BOARD_WIDTH) {
          nextBoard[boardRow][boardCol] = { type: current.type, mode: "active" };
        }
      });
    });

    return nextBoard;
  }, [board, current, ghostRow]);

  const nextPieces = queue.slice(0, PREVIEW_COUNT);
  const overlayVisible = gameOver || paused;
  const clearBanner = lastClear ? `${getClearLabel(lastClear)} clear` : "No clear yet";

  return (
    <section className="game-tetris-shell">
      <div className="game-tetris-head">
        <div>
          <p className="game-tetris-kicker">Tengacion puzzle lane</p>
          <h3>Tetris</h3>
          <p>{status}</p>
        </div>

        <div className="game-tetris-head-actions">
          <button type="button" className="btn-secondary" onClick={holdCurrentPiece} disabled={!canHold || gameOver}>
            Hold
          </button>
          <button type="button" className="btn-secondary" onClick={togglePause} disabled={gameOver}>
            {paused ? "Resume" : "Pause"}
          </button>
          <button type="button" className="btn-secondary" onClick={startNewRun}>
            New run
          </button>
        </div>
      </div>

      <div className="game-tetris-stats">
        <div>
          <span>Score</span>
          <strong>{score}</strong>
        </div>
        <div>
          <span>Best</span>
          <strong>{bestScore}</strong>
        </div>
        <div>
          <span>Lines</span>
          <strong>{lines}</strong>
        </div>
        <div>
          <span>Level</span>
          <strong>{level}</strong>
        </div>
      </div>

      <div className="game-tetris-stage">
        <div className="game-tetris-board-shell">
          <div className="game-tetris-board" aria-label="Tetris board">
            {displayBoard.flat().map((cell, index) => {
              const typeClass = cell?.type ? `piece-${cell.type.toLowerCase()}` : "empty";
              const modeClass = cell?.mode ? `is-${cell.mode}` : "";
              return (
                <div
                  key={`tetris-cell-${index}`}
                  className={`game-tetris-cell ${typeClass} ${modeClass}`.trim()}
                />
              );
            })}
          </div>

          {overlayVisible ? (
            <div className="game-tetris-overlay">
              <strong>{gameOver ? "Run over" : "Run paused"}</strong>
              <p>
                {gameOver
                  ? "The stack hit the top. Start a new run and chase a cleaner board."
                  : "Resume when you are ready to keep the stack flowing."}
              </p>
            </div>
          ) : null}
        </div>

        <div className="game-tetris-aside">
          <div className="game-tetris-side-card">
            <span>Lane pulse</span>
            <strong>{clearBanner}</strong>
            <p>
              {combo
                ? `Combo streak: ${combo}. Keep chaining clears to stay in rhythm.`
                : "Clean rows in batches to keep the board breathable."}
            </p>
          </div>

          <PreviewPanel
            title="Hold slot"
            type={hold}
            secondary={canHold ? "Ready to swap this turn." : "Hold returns after the next lock."}
          />

          {nextPieces.map((type, index) => (
            <PreviewPanel
              key={`${type}-${index}`}
              title={index === 0 ? "Up next" : `Queue ${index + 1}`}
              type={type}
              secondary={index === 0 ? "The next block in line." : "Keep the future stack in mind."}
            />
          ))}

          <div className="game-tetris-side-card">
            <span>Speed note</span>
            <strong>{getDropDelay(level)} ms pace</strong>
            <p>
              Use arrows to steer, Up to rotate, Space to hard drop, and C to hold a piece.
            </p>
          </div>

          <div className="game-tetris-controls" aria-label="Tetris controls">
            <button type="button" onClick={() => moveHorizontally(-1)}>
              Left
            </button>
            <button type="button" onClick={rotatePiece}>
              Rotate
            </button>
            <button type="button" onClick={() => moveHorizontally(1)}>
              Right
            </button>
            <button type="button" onClick={() => stepDown(true)}>
              Soft drop
            </button>
            <button type="button" onClick={hardDrop}>
              Hard drop
            </button>
            <button type="button" onClick={holdCurrentPiece} disabled={!canHold || gameOver}>
              Hold
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
