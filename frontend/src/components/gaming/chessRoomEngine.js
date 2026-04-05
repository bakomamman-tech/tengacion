const BOARD_SIZE = 8;
const MAX_HISTORY = 30;
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const BACK_RANK = ["r", "n", "b", "q", "k", "b", "n", "r"];

export const PIECE_SYMBOLS = {
  w: {
    k: "♔",
    q: "♕",
    r: "♖",
    b: "♗",
    n: "♘",
    p: "♙",
  },
  b: {
    k: "♚",
    q: "♛",
    r: "♜",
    b: "♝",
    n: "♞",
    p: "♟",
  },
};

export const PIECE_VALUES = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const createPiece = (type, color) => ({ type, color });

const createInitialBoard = () => [
  BACK_RANK.map((type) => createPiece(type, "b")),
  Array.from({ length: BOARD_SIZE }, () => createPiece("p", "b")),
  Array.from({ length: BOARD_SIZE }, () => null),
  Array.from({ length: BOARD_SIZE }, () => null),
  Array.from({ length: BOARD_SIZE }, () => null),
  Array.from({ length: BOARD_SIZE }, () => null),
  Array.from({ length: BOARD_SIZE }, () => createPiece("p", "w")),
  BACK_RANK.map((type) => createPiece(type, "w")),
];

const clonePiece = (piece) => (piece ? { ...piece } : null);
const cloneBoard = (board) => board.map((row) => row.map(clonePiece));
const cloneCastlingRights = (rights) => ({
  w: {
    kingSide: Boolean(rights?.w?.kingSide),
    queenSide: Boolean(rights?.w?.queenSide),
  },
  b: {
    kingSide: Boolean(rights?.b?.kingSide),
    queenSide: Boolean(rights?.b?.queenSide),
  },
});
const cloneCaptured = (captured) => ({
  w: Array.isArray(captured?.w) ? [...captured.w] : [],
  b: Array.isArray(captured?.b) ? [...captured.b] : [],
});
const cloneLastMove = (lastMove) =>
  lastMove
    ? {
        from: { ...lastMove.from },
        to: { ...lastMove.to },
        piece: lastMove.piece,
        color: lastMove.color,
        special: lastMove.special || null,
      }
    : null;
const cloneStatus = (status) => ({
  inCheck: Boolean(status?.inCheck),
  checkmate: Boolean(status?.checkmate),
  stalemate: Boolean(status?.stalemate),
  winner: status?.winner || null,
  legalMoves: Number(status?.legalMoves) || 0,
});
const cloneEnPassant = (enPassant) => (enPassant ? { ...enPassant } : null);
const cloneMoveEntry = (entry) => ({ ...entry });

const inBounds = (row, col) =>
  row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;

const oppositeColor = (color) => (color === "w" ? "b" : "w");

const squareToAlgebraic = (row, col) => `${FILES[col]}${BOARD_SIZE - row}`;

const getHomeRow = (color) => (color === "w" ? 7 : 0);

const getStartingPawnRow = (color) => (color === "w" ? 6 : 1);

const isValidPiece = (piece) =>
  !piece ||
  ((piece.color === "w" || piece.color === "b") &&
    Object.prototype.hasOwnProperty.call(PIECE_VALUES, piece.type));

const createSnapshot = (state) => ({
  board: cloneBoard(state.board),
  turn: state.turn,
  castlingRights: cloneCastlingRights(state.castlingRights),
  enPassant: cloneEnPassant(state.enPassant),
  captured: cloneCaptured(state.captured),
  moveHistory: state.moveHistory.map(cloneMoveEntry),
  lastMove: cloneLastMove(state.lastMove),
  moveCount: state.moveCount,
  status: cloneStatus(state.status),
});

const cloneSnapshot = (snapshot) => ({
  board: cloneBoard(snapshot.board),
  turn: snapshot.turn,
  castlingRights: cloneCastlingRights(snapshot.castlingRights),
  enPassant: cloneEnPassant(snapshot.enPassant),
  captured: cloneCaptured(snapshot.captured),
  moveHistory: snapshot.moveHistory.map(cloneMoveEntry),
  lastMove: cloneLastMove(snapshot.lastMove),
  moveCount: snapshot.moveCount,
  status: cloneStatus(snapshot.status),
});

const restoreFromSnapshot = (snapshot, history) => ({
  ...cloneSnapshot(snapshot),
  history: history.map(cloneSnapshot),
});

const findKing = (board, color) => {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = board[row][col];
      if (piece?.type === "k" && piece.color === color) {
        return { row, col };
      }
    }
  }

  return null;
};

const isSquareAttacked = (board, row, col, attackingColor) => {
  const pawnRow = attackingColor === "w" ? row + 1 : row - 1;
  const pawnOffsets = [-1, 1];
  for (const offset of pawnOffsets) {
    const pawn = board[pawnRow]?.[col + offset];
    if (pawn?.color === attackingColor && pawn.type === "p") {
      return true;
    }
  }

  const knightOffsets = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1],
  ];
  for (const [rowOffset, colOffset] of knightOffsets) {
    const piece = board[row + rowOffset]?.[col + colOffset];
    if (piece?.color === attackingColor && piece.type === "n") {
      return true;
    }
  }

  const kingOffsets = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ];
  for (const [rowOffset, colOffset] of kingOffsets) {
    const piece = board[row + rowOffset]?.[col + colOffset];
    if (piece?.color === attackingColor && piece.type === "k") {
      return true;
    }
  }

  const slideChecks = [
    {
      directions: [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ],
      threats: ["r", "q"],
    },
    {
      directions: [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ],
      threats: ["b", "q"],
    },
  ];

  for (const group of slideChecks) {
    for (const [rowOffset, colOffset] of group.directions) {
      let nextRow = row + rowOffset;
      let nextCol = col + colOffset;
      while (inBounds(nextRow, nextCol)) {
        const piece = board[nextRow][nextCol];
        if (piece) {
          if (piece.color === attackingColor && group.threats.includes(piece.type)) {
            return true;
          }
          break;
        }
        nextRow += rowOffset;
        nextCol += colOffset;
      }
    }
  }

  return false;
};

const isKingInCheck = (board, color) => {
  const king = findKing(board, color);
  if (!king) {
    return false;
  }
  return isSquareAttacked(board, king.row, king.col, oppositeColor(color));
};

const getPseudoMovesForSquare = (state, row, col) => {
  const board = state.board;
  const piece = board[row]?.[col];
  if (!piece) {
    return [];
  }

  const moves = [];

  if (piece.type === "p") {
    const direction = piece.color === "w" ? -1 : 1;
    const nextRow = row + direction;
    const startingRow = getStartingPawnRow(piece.color);
    const promotionRow = piece.color === "w" ? 0 : BOARD_SIZE - 1;

    if (inBounds(nextRow, col) && !board[nextRow][col]) {
      moves.push({
        from: { row, col },
        to: { row: nextRow, col },
        special: nextRow === promotionRow ? "promotion" : null,
      });

      const doubleRow = row + direction * 2;
      if (
        row === startingRow &&
        inBounds(doubleRow, col) &&
        !board[doubleRow][col]
      ) {
        moves.push({
          from: { row, col },
          to: { row: doubleRow, col },
          special: "pawn-double",
        });
      }
    }

    for (const colOffset of [-1, 1]) {
      const targetCol = col + colOffset;
      if (!inBounds(nextRow, targetCol)) {
        continue;
      }

      const targetPiece = board[nextRow][targetCol];
      if (targetPiece && targetPiece.color !== piece.color) {
        moves.push({
          from: { row, col },
          to: { row: nextRow, col: targetCol },
          captured: true,
          special: nextRow === promotionRow ? "promotion" : null,
        });
      }

      if (
        state.enPassant &&
        state.enPassant.row === nextRow &&
        state.enPassant.col === targetCol
      ) {
        moves.push({
          from: { row, col },
          to: { row: nextRow, col: targetCol },
          captured: true,
          special: "en-passant",
          captureSquare: {
            row: state.enPassant.captureRow,
            col: state.enPassant.captureCol,
          },
        });
      }
    }

    return moves;
  }

  if (piece.type === "n") {
    const knightOffsets = [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1],
    ];

    for (const [rowOffset, colOffset] of knightOffsets) {
      const targetRow = row + rowOffset;
      const targetCol = col + colOffset;
      if (!inBounds(targetRow, targetCol)) {
        continue;
      }

      const targetPiece = board[targetRow][targetCol];
      if (!targetPiece || targetPiece.color !== piece.color) {
        moves.push({
          from: { row, col },
          to: { row: targetRow, col: targetCol },
          captured: Boolean(targetPiece),
        });
      }
    }

    return moves;
  }

  if (piece.type === "k") {
    const kingOffsets = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ];

    for (const [rowOffset, colOffset] of kingOffsets) {
      const targetRow = row + rowOffset;
      const targetCol = col + colOffset;
      if (!inBounds(targetRow, targetCol)) {
        continue;
      }

      const targetPiece = board[targetRow][targetCol];
      if (!targetPiece || targetPiece.color !== piece.color) {
        moves.push({
          from: { row, col },
          to: { row: targetRow, col: targetCol },
          captured: Boolean(targetPiece),
        });
      }
    }

    const homeRow = getHomeRow(piece.color);
    const rights = state.castlingRights[piece.color];
    const enemyColor = oppositeColor(piece.color);
    const onHomeSquare = row === homeRow && col === 4;

    if (onHomeSquare && rights?.kingSide) {
      const rook = board[homeRow][7];
      if (
        rook?.type === "r" &&
        rook.color === piece.color &&
        !board[homeRow][5] &&
        !board[homeRow][6] &&
        !isSquareAttacked(board, homeRow, 4, enemyColor) &&
        !isSquareAttacked(board, homeRow, 5, enemyColor) &&
        !isSquareAttacked(board, homeRow, 6, enemyColor)
      ) {
        moves.push({
          from: { row, col },
          to: { row: homeRow, col: 6 },
          special: "castle-king",
        });
      }
    }

    if (onHomeSquare && rights?.queenSide) {
      const rook = board[homeRow][0];
      if (
        rook?.type === "r" &&
        rook.color === piece.color &&
        !board[homeRow][1] &&
        !board[homeRow][2] &&
        !board[homeRow][3] &&
        !isSquareAttacked(board, homeRow, 4, enemyColor) &&
        !isSquareAttacked(board, homeRow, 3, enemyColor) &&
        !isSquareAttacked(board, homeRow, 2, enemyColor)
      ) {
        moves.push({
          from: { row, col },
          to: { row: homeRow, col: 2 },
          special: "castle-queen",
        });
      }
    }

    return moves;
  }

  const slideGroups = {
    b: [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ],
    r: [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ],
    q: [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ],
  };

  for (const [rowOffset, colOffset] of slideGroups[piece.type] || []) {
    let targetRow = row + rowOffset;
    let targetCol = col + colOffset;

    while (inBounds(targetRow, targetCol)) {
      const targetPiece = board[targetRow][targetCol];
      if (!targetPiece) {
        moves.push({
          from: { row, col },
          to: { row: targetRow, col: targetCol },
        });
      } else {
        if (targetPiece.color !== piece.color) {
          moves.push({
            from: { row, col },
            to: { row: targetRow, col: targetCol },
            captured: true,
          });
        }
        break;
      }

      targetRow += rowOffset;
      targetCol += colOffset;
    }
  }

  return moves;
};

const buildMoveNotation = (piece, move, nextStatus) => {
  let notation = "";

  if (move.special === "castle-king") {
    notation = "O-O";
  } else if (move.special === "castle-queen") {
    notation = "O-O-O";
  } else {
    const pieceLabel = piece.type.toUpperCase();
    const from = squareToAlgebraic(move.from.row, move.from.col);
    const to = squareToAlgebraic(move.to.row, move.to.col);
    const captureMark = move.captured || move.special === "en-passant" ? "x" : "-";
    notation = `${pieceLabel} ${from}${captureMark}${to}`;

    if (move.special === "promotion" || move.promotion) {
      notation += `=${(move.promotion || "q").toUpperCase()}`;
    }

    if (move.special === "en-passant") {
      notation += " e.p.";
    }
  }

  if (nextStatus.checkmate) {
    notation += "#";
  } else if (nextStatus.inCheck) {
    notation += "+";
  }

  return notation;
};

export const getLegalMovesForSquare = (state, row, col) => {
  const piece = state.board[row]?.[col];
  if (!piece) {
    return [];
  }

  const pseudoMoves = getPseudoMovesForSquare(state, row, col);
  return pseudoMoves.filter((move) => {
    const nextState = applyChessMove(state, move, {
      recordHistory: false,
      recomputeStatus: false,
    });
    return !isKingInCheck(nextState.board, piece.color);
  });
};

export const getAllLegalMoves = (state, color = state.turn) => {
  const moves = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = state.board[row][col];
      if (!piece || piece.color !== color) {
        continue;
      }

      moves.push(...getLegalMovesForSquare(state, row, col));
    }
  }

  return moves;
};

const buildStatus = (state) => {
  const legalMoves = getAllLegalMoves(state, state.turn);
  const inCheck = isKingInCheck(state.board, state.turn);
  return {
    inCheck,
    checkmate: inCheck && legalMoves.length === 0,
    stalemate: !inCheck && legalMoves.length === 0,
    winner: inCheck && legalMoves.length === 0 ? oppositeColor(state.turn) : null,
    legalMoves: legalMoves.length,
  };
};

export const createInitialChessState = () => {
  const state = {
    board: createInitialBoard(),
    turn: "w",
    castlingRights: {
      w: { kingSide: true, queenSide: true },
      b: { kingSide: true, queenSide: true },
    },
    enPassant: null,
    captured: {
      w: [],
      b: [],
    },
    moveHistory: [],
    history: [],
    lastMove: null,
    moveCount: 0,
    status: {
      inCheck: false,
      checkmate: false,
      stalemate: false,
      winner: null,
      legalMoves: 20,
    },
  };

  state.status = buildStatus(state);
  return state;
};

export const hydrateChessState = (storedState) => {
  if (!storedState || !Array.isArray(storedState.board) || storedState.board.length !== BOARD_SIZE) {
    return createInitialChessState();
  }

  const board = storedState.board.map((row) =>
    Array.isArray(row) && row.length === BOARD_SIZE
      ? row.map((piece) => (isValidPiece(piece) ? clonePiece(piece) : null))
      : Array.from({ length: BOARD_SIZE }, () => null)
  );

  const hydrated = {
    board,
    turn: storedState.turn === "b" ? "b" : "w",
    castlingRights: cloneCastlingRights(storedState.castlingRights),
    enPassant: cloneEnPassant(storedState.enPassant),
    captured: cloneCaptured(storedState.captured),
    moveHistory: Array.isArray(storedState.moveHistory)
      ? storedState.moveHistory.map(cloneMoveEntry)
      : [],
    history: Array.isArray(storedState.history)
      ? storedState.history.slice(-MAX_HISTORY).map(cloneSnapshot)
      : [],
    lastMove: cloneLastMove(storedState.lastMove),
    moveCount: Number(storedState.moveCount) || 0,
    status: cloneStatus(storedState.status),
  };

  hydrated.status = buildStatus(hydrated);
  return hydrated;
};

export const applyChessMove = (state, move, options = {}) => {
  const recordHistory = options.recordHistory !== false;
  const recomputeStatus = options.recomputeStatus !== false;
  const board = cloneBoard(state.board);
  const piece = clonePiece(board[move.from.row][move.from.col]);
  if (!piece) {
    return state;
  }

  const nextState = {
    board,
    turn: oppositeColor(piece.color),
    castlingRights: cloneCastlingRights(state.castlingRights),
    enPassant: null,
    captured: cloneCaptured(state.captured),
    moveHistory: state.moveHistory.map(cloneMoveEntry),
    history: recordHistory ? state.history.slice(-(MAX_HISTORY - 1)).map(cloneSnapshot) : [],
    lastMove: {
      from: { ...move.from },
      to: { ...move.to },
      piece: piece.type,
      color: piece.color,
      special: move.special || null,
    },
    moveCount: state.moveCount + 1,
    status: cloneStatus(state.status),
  };

  if (recordHistory) {
    nextState.history.push(createSnapshot(state));
  }

  let capturedType = null;
  if (move.special === "en-passant" && move.captureSquare) {
    const capturedPiece = board[move.captureSquare.row][move.captureSquare.col];
    capturedType = capturedPiece?.type || "p";
    board[move.captureSquare.row][move.captureSquare.col] = null;
  } else if (board[move.to.row][move.to.col]) {
    capturedType = board[move.to.row][move.to.col].type;
  }

  board[move.from.row][move.from.col] = null;

  const movedPiece = { ...piece };
  if (move.special === "promotion" || move.promotion) {
    movedPiece.type = move.promotion || "q";
    nextState.lastMove.special = "promotion";
  }

  board[move.to.row][move.to.col] = movedPiece;

  if (move.special === "castle-king") {
    const rook = board[move.from.row][7];
    board[move.from.row][7] = null;
    board[move.from.row][5] = clonePiece(rook);
  }

  if (move.special === "castle-queen") {
    const rook = board[move.from.row][0];
    board[move.from.row][0] = null;
    board[move.from.row][3] = clonePiece(rook);
  }

  if (capturedType) {
    nextState.captured[piece.color].push(capturedType);
  }

  if (piece.type === "k") {
    nextState.castlingRights[piece.color].kingSide = false;
    nextState.castlingRights[piece.color].queenSide = false;
  }

  if (piece.type === "r") {
    const homeRow = getHomeRow(piece.color);
    if (move.from.row === homeRow && move.from.col === 0) {
      nextState.castlingRights[piece.color].queenSide = false;
    }
    if (move.from.row === homeRow && move.from.col === 7) {
      nextState.castlingRights[piece.color].kingSide = false;
    }
  }

  if (capturedType === "r") {
    const enemyColor = oppositeColor(piece.color);
    const enemyHomeRow = getHomeRow(enemyColor);
    if (move.to.row === enemyHomeRow && move.to.col === 0) {
      nextState.castlingRights[enemyColor].queenSide = false;
    }
    if (move.to.row === enemyHomeRow && move.to.col === 7) {
      nextState.castlingRights[enemyColor].kingSide = false;
    }
  }

  if (piece.type === "p" && Math.abs(move.to.row - move.from.row) === 2) {
    nextState.enPassant = {
      row: (move.from.row + move.to.row) / 2,
      col: move.from.col,
      captureRow: move.to.row,
      captureCol: move.to.col,
    };
  }

  if (recomputeStatus) {
    nextState.status = buildStatus(nextState);
  }

  const notation = buildMoveNotation(piece, move, nextState.status);
  nextState.moveHistory.push({
    index: state.moveHistory.length + 1,
    turnNumber: Math.floor(state.moveHistory.length / 2) + 1,
    color: piece.color,
    notation,
  });

  return nextState;
};

export const undoChessMove = (state) => {
  if (!state.history.length) {
    return state;
  }

  const previous = state.history[state.history.length - 1];
  return restoreFromSnapshot(previous, state.history.slice(0, -1));
};

export const getCapturedMaterial = (capturedTypes) =>
  (capturedTypes || []).reduce((total, type) => total + (PIECE_VALUES[type] || 0), 0);

export const getTurnLabel = (color) => (color === "w" ? "White" : "Black");

export const getBoardSize = () => BOARD_SIZE;

export const getSquareName = (row, col) => squareToAlgebraic(row, col);
