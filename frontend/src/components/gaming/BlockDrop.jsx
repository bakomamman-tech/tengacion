import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "tengacion.gaming.block-drop.state";
const SIZE = 8;
const COLORS = ["violet", "cyan", "amber", "mint", "rose"];
const SHAPES = [
  [[0, 0]],
  [[0, 0], [0, 1]],
  [[0, 0], [1, 0]],
  [[0, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [1, 0]],
  [[0, 0], [0, 1], [1, 0], [1, 1]],
  [[0, 0], [1, 0], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [2, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 1]],
];

const emptyBoard = () => Array(SIZE * SIZE).fill("");
const normalizeCells = (cells) => {
  const minRow = Math.min(...cells.map(([row]) => row));
  const minCol = Math.min(...cells.map(([, col]) => col));
  return cells.map(([row, col]) => [row - minRow, col - minCol]);
};
const rotateCells = (cells) => normalizeCells(cells.map(([row, col]) => [col, -row]));
const createPiece = (index) => ({
  id: `piece-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
  color: COLORS[Math.floor(Math.random() * COLORS.length)],
  cells: SHAPES[Math.floor(Math.random() * SHAPES.length)],
  used: false,
});
const createTray = () => Array.from({ length: 3 }, (_, index) => createPiece(index));

const canPlace = (board, piece, anchorRow, anchorCol) =>
  piece.cells.every(([rowOffset, colOffset]) => {
    const row = anchorRow + rowOffset;
    const col = anchorCol + colOffset;
    return row >= 0 && row < SIZE && col >= 0 && col < SIZE && !board[row * SIZE + col];
  });

const pieceCanFit = (board, piece) => {
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (canPlace(board, piece, row, col)) {
        return true;
      }
    }
  }
  return false;
};

const readState = () => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    if (!Array.isArray(parsed?.board) || parsed.board.length !== SIZE * SIZE) {
      return null;
    }
    if (!Array.isArray(parsed?.tray) || parsed.tray.length !== 3) {
      return null;
    }
    return {
      board: parsed.board.map((cell) => (typeof cell === "string" ? cell : "")),
      tray: parsed.tray.map((piece, index) => ({
        id: typeof piece.id === "string" ? piece.id : `restored-${index}`,
        color: COLORS.includes(piece.color) ? piece.color : COLORS[index],
        cells: Array.isArray(piece.cells) ? normalizeCells(piece.cells) : SHAPES[index],
        used: Boolean(piece.used),
      })),
      score: Number(parsed.score) || 0,
      bestScore: Number(parsed.bestScore) || 0,
      lines: Number(parsed.lines) || 0,
      pieces: Number(parsed.pieces) || 0,
      combo: Number(parsed.combo) || 0,
      gameOver: Boolean(parsed.gameOver),
    };
  } catch {
    return null;
  }
};

const createState = (bestScore = 0) => ({
  board: emptyBoard(),
  tray: createTray(),
  score: 0,
  bestScore,
  lines: 0,
  pieces: 0,
  combo: 0,
  gameOver: false,
});

export default function BlockDrop({ onSessionChange }) {
  const restored = useMemo(readState, []);
  const [state, setState] = useState(() => restored || createState());
  const [selectedId, setSelectedId] = useState(
    () => state.tray.find((piece) => !piece.used)?.id || ""
  );
  const [status, setStatus] = useState(restored ? "Your saved strategy board is back online." : "Select a shape, then choose its top-left landing cell.");
  const { board, tray, score, bestScore, lines, pieces, combo, gameOver } = state;
  const selectedPiece = tray.find((piece) => piece.id === selectedId && !piece.used) || null;

  const startFresh = () => {
    const nextState = createState(bestScore);
    setState(nextState);
    setSelectedId(nextState.tray[0]?.id || "");
    setStatus("Fresh board ready. Build broadly and keep future shapes in mind.");
  };

  const rotateSelected = () => {
    if (!selectedPiece || gameOver) {
      return;
    }
    setState((current) => ({
      ...current,
      tray: current.tray.map((piece) =>
        piece.id === selectedId ? { ...piece, cells: rotateCells(piece.cells) } : piece
      ),
    }));
    setStatus("Shape rotated. Pick a landing cell on the board.");
  };

  const placePiece = (anchorRow, anchorCol) => {
    if (!selectedPiece || gameOver) {
      setStatus(gameOver ? "No legal moves remain. Start a fresh board." : "Choose a shape from the tray first.");
      return;
    }
    if (!canPlace(board, selectedPiece, anchorRow, anchorCol)) {
      setStatus("That landing is blocked or outside the board. Try another cell.");
      return;
    }

    const placedBoard = [...board];
    selectedPiece.cells.forEach(([rowOffset, colOffset]) => {
      placedBoard[(anchorRow + rowOffset) * SIZE + anchorCol + colOffset] = selectedPiece.color;
    });

    const fullRows = Array.from({ length: SIZE }, (_, row) => row).filter((row) =>
      Array.from({ length: SIZE }, (_, col) => placedBoard[row * SIZE + col]).every(Boolean)
    );
    const fullCols = Array.from({ length: SIZE }, (_, col) => col).filter((col) =>
      Array.from({ length: SIZE }, (_, row) => placedBoard[row * SIZE + col]).every(Boolean)
    );
    const clearedBoard = placedBoard.map((cell, index) => {
      const row = Math.floor(index / SIZE);
      const col = index % SIZE;
      return fullRows.includes(row) || fullCols.includes(col) ? "" : cell;
    });
    const clearedLines = fullRows.length + fullCols.length;
    const nextCombo = clearedLines ? combo + clearedLines : 0;
    const placementPoints = selectedPiece.cells.length * 12;
    const clearPoints = clearedLines * 180 + Math.max(0, clearedLines - 1) * 120 + nextCombo * 25;
    const nextScore = score + placementPoints + clearPoints;
    let nextTray = tray.map((piece) =>
      piece.id === selectedPiece.id ? { ...piece, used: true } : piece
    );
    if (nextTray.every((piece) => piece.used)) {
      nextTray = createTray();
    }
    const availablePieces = nextTray.filter((piece) => !piece.used);
    const isGameOver = !availablePieces.some((piece) => pieceCanFit(clearedBoard, piece));

    setState({
      board: clearedBoard,
      tray: nextTray,
      score: nextScore,
      bestScore: Math.max(bestScore, nextScore),
      lines: lines + clearedLines,
      pieces: pieces + 1,
      combo: nextCombo,
      gameOver: isGameOver,
    });
    setSelectedId(availablePieces.find((piece) => pieceCanFit(clearedBoard, piece))?.id || "");
    setStatus(
      isGameOver
        ? "The board has no legal landing left. Bank the score and rebuild."
        : clearedLines
          ? `${clearedLines} line${clearedLines === 1 ? "" : "s"} cleared for ${clearPoints} bonus points.`
          : `${selectedPiece.cells.length}-block shape placed. Keep the board breathable.`
    );
  };

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    onSessionChange?.({
      game: "block-drop",
      score,
      bestScore,
      moves: pieces,
      highestTile: lines,
      lines,
      combo,
      gameOver,
      status,
      metricLabel: "Lines cleared",
      metricValue: lines,
      progressLabel: "Pieces placed",
      progressValue: pieces,
    });
  }, [bestScore, combo, gameOver, lines, onSessionChange, pieces, score, status]);

  const filledCells = board.filter(Boolean).length;

  return (
    <section className="game-next-shell game-block-shell">
      <div className="game-next-head">
        <div>
          <p className="game-next-kicker">Spatial strategy lane</p>
          <h3>Block Drop</h3>
          <p>{status}</p>
        </div>
        <span className={`game-next-live-pill ${gameOver ? "is-paused" : ""}`}>{gameOver ? "Board locked" : "Live board"}</span>
      </div>

      <div className="game-next-stats">
        <div><span>Score</span><strong>{score}</strong></div>
        <div><span>Best</span><strong>{bestScore}</strong></div>
        <div><span>Lines</span><strong>{lines}</strong></div>
        <div><span>Pieces</span><strong>{pieces}</strong></div>
      </div>

      <div className="game-next-stage">
        <div className="game-live-play-column">
          <div className="game-live-control-dock" role="region" aria-label="Block Drop play controls">
            <div className="game-live-control-dock__head">
              <strong>Board controls</strong>
              <span>Select below, rotate if needed, then tap the board.</span>
            </div>
            <div className="game-live-control-dock__body">
              <div className="game-next-controls game-block-control-status">
                <span>{selectedPiece ? "Shape armed" : "Choose a shape"}</span>
                <button type="button" onClick={rotateSelected} disabled={!selectedPiece || gameOver}>Rotate ↻</button>
              </div>
              <div className="game-live-session-actions">
                <button type="button" className="btn-secondary" onClick={startFresh}>New board</button>
              </div>
            </div>
          </div>

          <div className="game-block-board-shell">
            <div className="game-block-board" aria-label="Block Drop board">
              {board.map((cell, index) => {
                const row = Math.floor(index / SIZE);
                const col = index % SIZE;
                return <button key={`${row}-${col}`} type="button" className={`game-block-cell ${cell ? `is-filled color-${cell}` : ""}`} onClick={() => placePiece(row, col)} aria-label={`Place at row ${row + 1}, column ${col + 1}`} />;
              })}
            </div>
            {gameOver ? <div className="game-next-overlay"><strong>Board complete</strong><p>{score} points banked across {pieces} placements.</p><button type="button" className="btn-primary" onClick={startFresh}>Fresh board</button></div> : null}
          </div>

          <div className="game-block-tray" aria-label="Available block shapes">
            {tray.map((piece) => {
              const maxRow = Math.max(...piece.cells.map(([row]) => row));
              const maxCol = Math.max(...piece.cells.map(([, col]) => col));
              return (
                <button key={piece.id} type="button" className={`game-block-piece ${selectedId === piece.id ? "is-selected" : ""} ${piece.used ? "is-used" : ""}`} onClick={() => !piece.used && !gameOver && setSelectedId(piece.id)} disabled={piece.used || gameOver}>
                  <span className="game-block-piece-grid" style={{ gridTemplateColumns: `repeat(${maxCol + 1}, 15px)`, gridTemplateRows: `repeat(${maxRow + 1}, 15px)` }}>
                    {Array.from({ length: (maxRow + 1) * (maxCol + 1) }, (_, index) => {
                      const row = Math.floor(index / (maxCol + 1));
                      const col = index % (maxCol + 1);
                      const isFilled = piece.cells.some(
                        ([pieceRow, pieceCol]) => pieceRow === row && pieceCol === col
                      );
                      return <i key={`${row}-${col}`} className={isFilled ? `color-${piece.color}` : ""} />;
                    })}
                  </span>
                  <small>{piece.used ? "Placed" : `${piece.cells.length} blocks`}</small>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="game-next-aside">
          <article><span>Board pressure</span><strong>{Math.round((filledCells / (SIZE * SIZE)) * 100)}% filled</strong><p>Full rows and columns clear together and open new routes.</p></article>
          <article><span>Clear rhythm</span><strong>{combo ? `${combo}x combo` : "Build lines"}</strong><p>Multi-line clears and consecutive clears carry bigger bonuses.</p></article>
          <article><span>Strategy</span><strong>Leave options</strong><p>Small gaps feel harmless until the next large shape arrives.</p></article>
        </aside>
      </div>
    </section>
  );
}
