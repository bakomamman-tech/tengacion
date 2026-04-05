import { useEffect, useMemo, useState } from "react";

import {
  PIECE_SYMBOLS,
  applyChessMove,
  createInitialChessState,
  getBoardSize,
  getCapturedMaterial,
  getLegalMovesForSquare,
  getSquareName,
  getTurnLabel,
  hydrateChessState,
  undoChessMove,
} from "./chessRoomEngine";

const STORAGE_KEY = "tengacion.gaming.chess-room.state";
const PROMOTION_OPTIONS = ["q", "r", "b", "n"];

const readStoredRoom = () => {
  if (typeof window === "undefined") {
    return {
      gameState: createInitialChessState(),
      flipped: false,
      showHints: true,
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        gameState: createInitialChessState(),
        flipped: false,
        showHints: true,
      };
    }

    const parsed = JSON.parse(raw);
    return {
      gameState: hydrateChessState(parsed?.gameState || parsed),
      flipped: Boolean(parsed?.flipped),
      showHints: parsed?.showHints !== false,
    };
  } catch {
    return {
      gameState: createInitialChessState(),
      flipped: false,
      showHints: true,
    };
  }
};

const describeMaterialLead = (whiteMaterial, blackMaterial) => {
  const swing = whiteMaterial - blackMaterial;
  if (!swing) {
    return "Even board";
  }

  return swing > 0 ? `White +${swing}` : `Black +${Math.abs(swing)}`;
};

const getStatusLine = (gameState, whiteMaterial, blackMaterial) => {
  if (gameState.status.checkmate) {
    return `${getTurnLabel(gameState.status.winner)} wins by checkmate.`;
  }

  if (gameState.status.stalemate) {
    return "Stalemate. The room is locked with no legal move.";
  }

  if (gameState.status.inCheck) {
    return `${getTurnLabel(gameState.turn)} to move and currently in check.`;
  }

  return `${getTurnLabel(gameState.turn)} to move. ${describeMaterialLead(whiteMaterial, blackMaterial)}.`;
};

const getSquareAriaLabel = (row, col, piece) => {
  const square = getSquareName(row, col);
  if (!piece) {
    return `Empty square ${square}`;
  }

  const pieceNames = {
    k: "king",
    q: "queen",
    r: "rook",
    b: "bishop",
    n: "knight",
    p: "pawn",
  };

  return `${piece.color === "w" ? "White" : "Black"} ${pieceNames[piece.type]} on ${square}`;
};

export default function ChessRoom({ onSessionChange }) {
  const [roomState, setRoomState] = useState(() => readStoredRoom());
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [promotionMove, setPromotionMove] = useState(null);

  const { gameState, flipped, showHints } = roomState;
  const boardSize = getBoardSize();
  const selectedPiece =
    selectedSquare && gameState.board[selectedSquare.row]?.[selectedSquare.col]
      ? gameState.board[selectedSquare.row][selectedSquare.col]
      : null;

  const legalMoves = useMemo(() => {
    if (!selectedSquare || !selectedPiece || selectedPiece.color !== gameState.turn) {
      return [];
    }

    return getLegalMovesForSquare(gameState, selectedSquare.row, selectedSquare.col);
  }, [gameState, selectedPiece, selectedSquare]);

  const legalMoveMap = useMemo(
    () =>
      new Map(
        legalMoves.map((move) => [`${move.to.row}:${move.to.col}`, move])
      ),
    [legalMoves]
  );

  const whiteMaterial = getCapturedMaterial(gameState.captured.w);
  const blackMaterial = getCapturedMaterial(gameState.captured.b);
  const materialLead = describeMaterialLead(whiteMaterial, blackMaterial);
  const statusLine = getStatusLine(gameState, whiteMaterial, blackMaterial);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(roomState));
  }, [roomState]);

  useEffect(() => {
    onSessionChange?.({
      game: "chess-room",
      moves: gameState.moveCount,
      score: gameState.moveCount,
      bestScore: Math.max(whiteMaterial, blackMaterial),
      highestTile: Math.abs(whiteMaterial - blackMaterial),
      gameOver: gameState.status.checkmate || gameState.status.stalemate,
      turn: gameState.turn,
      materialLead,
      capturedWhiteValue: whiteMaterial,
      capturedBlackValue: blackMaterial,
      status: statusLine,
    });
  }, [gameState, materialLead, onSessionChange, statusLine, whiteMaterial, blackMaterial]);

  const commitMove = (move) => {
    setRoomState((current) => ({
      ...current,
      gameState: applyChessMove(current.gameState, move),
    }));
    setSelectedSquare(null);
    setPromotionMove(null);
  };

  const handleSquarePress = (row, col) => {
    if (promotionMove) {
      return;
    }

    const piece = gameState.board[row][col];
    const targetMove = legalMoveMap.get(`${row}:${col}`);

    if (targetMove) {
      if (targetMove.special === "promotion") {
        setPromotionMove(targetMove);
        return;
      }

      commitMove(targetMove);
      return;
    }

    if (piece && piece.color === gameState.turn) {
      const isSameSquare =
        selectedSquare?.row === row && selectedSquare?.col === col;
      setSelectedSquare(isSameSquare ? null : { row, col });
      return;
    }

    setSelectedSquare(null);
  };

  const resetRoom = () => {
    setRoomState((current) => ({
      ...current,
      gameState: createInitialChessState(),
    }));
    setSelectedSquare(null);
    setPromotionMove(null);
  };

  const undoMove = () => {
    setRoomState((current) => ({
      ...current,
      gameState: undoChessMove(current.gameState),
    }));
    setSelectedSquare(null);
    setPromotionMove(null);
  };

  const rowOrder = flipped
    ? Array.from({ length: boardSize }, (_, index) => boardSize - 1 - index)
    : Array.from({ length: boardSize }, (_, index) => index);
  const colOrder = flipped
    ? Array.from({ length: boardSize }, (_, index) => boardSize - 1 - index)
    : Array.from({ length: boardSize }, (_, index) => index);

  const moveLogRows = [];
  for (let index = 0; index < gameState.moveHistory.length; index += 2) {
    moveLogRows.push({
      turnNumber: Math.floor(index / 2) + 1,
      white: gameState.moveHistory[index] || null,
      black: gameState.moveHistory[index + 1] || null,
    });
  }

  const turnLabel = getTurnLabel(gameState.turn);
  const overlayVisible = promotionMove || gameState.status.checkmate || gameState.status.stalemate;

  return (
    <section className="game-chess-shell">
      <div className="game-chess-head">
        <div>
          <p className="game-chess-kicker">Tengacion board room</p>
          <h3>Chess Room</h3>
          <p>{statusLine}</p>
        </div>

        <div className="game-chess-head-actions">
          <span className={`game-chess-turn-pill ${gameState.status.inCheck ? "is-alert" : ""}`}>
            {gameState.status.checkmate
              ? "Checkmate"
              : gameState.status.stalemate
                ? "Stalemate"
                : `${turnLabel} to move`}
          </span>
          <button type="button" className="btn-secondary" onClick={undoMove} disabled={!gameState.history.length}>
            Undo
          </button>
          <button type="button" className="btn-secondary" onClick={resetRoom}>
            New game
          </button>
        </div>
      </div>

      <div className="game-chess-toolbar">
        <div className="game-chess-room-note">
          <span>Room mode</span>
          <strong>Live local match</strong>
          <p>Play a full pass-and-play chess game with legal moves, castling, promotion, and saved local progress.</p>
        </div>

        <div className="game-chess-toolbar-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              setRoomState((current) => ({ ...current, flipped: !current.flipped }))
            }
          >
            {flipped ? "White side view" : "Black side view"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              setRoomState((current) => ({ ...current, showHints: !current.showHints }))
            }
          >
            {showHints ? "Hide move hints" : "Show move hints"}
          </button>
        </div>
      </div>

      <div className="game-chess-stats">
        <div>
          <span>Turn</span>
          <strong>{turnLabel}</strong>
        </div>
        <div>
          <span>Moves played</span>
          <strong>{gameState.moveCount}</strong>
        </div>
        <div>
          <span>White capture</span>
          <strong>{whiteMaterial}</strong>
        </div>
        <div>
          <span>Black capture</span>
          <strong>{blackMaterial}</strong>
        </div>
      </div>

      <div className="game-chess-stage">
        <div className="game-chess-board-shell">
          <div
            className={`game-chess-board ${gameState.status.inCheck ? "is-tense" : ""}`}
            style={{ gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))` }}
            aria-label="Chess Room board"
          >
            {rowOrder.map((row, displayRowIndex) =>
              colOrder.map((col, displayColIndex) => {
                const piece = gameState.board[row][col];
                const isDarkSquare = (row + col) % 2 === 1;
                const isSelected =
                  selectedSquare?.row === row && selectedSquare?.col === col;
                const move = legalMoveMap.get(`${row}:${col}`);
                const isLastMove =
                  (gameState.lastMove?.from.row === row && gameState.lastMove?.from.col === col) ||
                  (gameState.lastMove?.to.row === row && gameState.lastMove?.to.col === col);
                const isCheckedKing =
                  gameState.status.inCheck &&
                  piece?.type === "k" &&
                  piece.color === gameState.turn;

                return (
                  <button
                    key={`${row}:${col}`}
                    type="button"
                    className={[
                      "game-chess-square",
                      isDarkSquare ? "dark" : "light",
                      isSelected ? "is-selected" : "",
                      move && showHints ? "is-target" : "",
                      move?.captured && showHints ? "is-capture" : "",
                      isLastMove ? "is-last-move" : "",
                      isCheckedKing ? "is-checked" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => handleSquarePress(row, col)}
                    aria-label={getSquareAriaLabel(row, col, piece)}
                  >
                    {displayColIndex === 0 ? (
                      <span className="game-chess-rank-label">{boardSize - row}</span>
                    ) : null}
                    {displayRowIndex === boardSize - 1 ? (
                      <span className="game-chess-file-label">{String.fromCharCode(97 + col)}</span>
                    ) : null}
                    {move && showHints ? (
                      <span
                        className={`game-chess-move-marker ${
                          move.captured ? "is-capture" : "is-dot"
                        }`}
                        aria-hidden="true"
                      />
                    ) : null}
                    {piece ? (
                      <span
                        className={`game-chess-piece ${piece.color === "w" ? "white" : "black"}`}
                        aria-hidden="true"
                      >
                        {PIECE_SYMBOLS[piece.color][piece.type]}
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>

          {overlayVisible ? (
            <div className="game-chess-overlay">
              {promotionMove ? (
                <>
                  <strong>Choose a promotion piece</strong>
                  <p>Finish the move by promoting your pawn.</p>
                  <div className="game-chess-promotion-grid">
                    {PROMOTION_OPTIONS.map((pieceType) => (
                      <button
                        key={pieceType}
                        type="button"
                        onClick={() => commitMove({ ...promotionMove, promotion: pieceType })}
                      >
                        <span aria-hidden="true">
                          {PIECE_SYMBOLS[gameState.turn][pieceType]}
                        </span>
                        <small>{pieceType.toUpperCase()}</small>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <strong>
                    {gameState.status.checkmate ? "Checkmate" : "Stalemate"}
                  </strong>
                  <p>
                    {gameState.status.checkmate
                      ? `${getTurnLabel(gameState.status.winner)} closes the room with a clean finish.`
                      : "No legal move remains, so the room settles into a draw."}
                  </p>
                </>
              )}
            </div>
          ) : null}
        </div>

        <div className="game-chess-aside">
          <div className="game-chess-side-card">
            <span>Board read</span>
            <strong>{materialLead}</strong>
            <p>
              {selectedPiece
                ? `${getTurnLabel(selectedPiece.color)} ${getSquareName(
                    selectedSquare.row,
                    selectedSquare.col
                  )} selected with ${legalMoves.length} legal move${
                    legalMoves.length === 1 ? "" : "s"
                  }.`
                : "Tap any active piece to reveal legal squares and keep the room flowing."}
            </p>
          </div>

          <div className="game-chess-side-card">
            <span>Captured by White</span>
            <div className="game-chess-captured-row" aria-label="Pieces captured by White">
              {gameState.captured.w.length ? (
                gameState.captured.w.map((pieceType, index) => (
                  <span key={`white-${pieceType}-${index}`}>
                    {PIECE_SYMBOLS.b[pieceType]}
                  </span>
                ))
              ) : (
                <small>No captures yet</small>
              )}
            </div>

            <span>Captured by Black</span>
            <div className="game-chess-captured-row" aria-label="Pieces captured by Black">
              {gameState.captured.b.length ? (
                gameState.captured.b.map((pieceType, index) => (
                  <span key={`black-${pieceType}-${index}`}>
                    {PIECE_SYMBOLS.w[pieceType]}
                  </span>
                ))
              ) : (
                <small>No captures yet</small>
              )}
            </div>
          </div>

          <div className="game-chess-side-card">
            <span>Room log</span>
            <div className="game-chess-history-list">
              {moveLogRows.length ? (
                moveLogRows.map((entry) => (
                  <article key={entry.turnNumber}>
                    <strong>{entry.turnNumber}.</strong>
                    <p>{entry.white?.notation || "..."}</p>
                    <p>{entry.black?.notation || "..."}</p>
                  </article>
                ))
              ) : (
                <small>The first move will appear here.</small>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
