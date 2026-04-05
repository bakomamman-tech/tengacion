import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "tengacion.gaming.memory-atlas.state";

const ATLAS_MARKERS = [
  { id: "aurora", sigil: "AU", label: "Aurora", tint: "aurora" },
  { id: "reef", sigil: "RF", label: "Reef", tint: "reef" },
  { id: "ember", sigil: "EM", label: "Ember", tint: "ember" },
  { id: "nova", sigil: "NV", label: "Nova", tint: "nova" },
  { id: "lotus", sigil: "LT", label: "Lotus", tint: "lotus" },
  { id: "dune", sigil: "DN", label: "Dune", tint: "dune" },
  { id: "cedar", sigil: "CD", label: "Cedar", tint: "cedar" },
  { id: "glacier", sigil: "GL", label: "Glacier", tint: "glacier" },
  { id: "tidal", sigil: "TD", label: "Tidal", tint: "tidal" },
  { id: "lumen", sigil: "LM", label: "Lumen", tint: "lumen" },
  { id: "echo", sigil: "EC", label: "Echo", tint: "echo" },
  { id: "onyx", sigil: "ON", label: "Onyx", tint: "onyx" },
];

const CHAPTERS = [
  { chapter: 1, name: "Harbor Start", pairs: 4, previewMs: 2200 },
  { chapter: 2, name: "Canopy Route", pairs: 6, previewMs: 2400 },
  { chapter: 3, name: "Skyglass Wing", pairs: 8, previewMs: 2600 },
  { chapter: 4, name: "Deep Orbit", pairs: 10, previewMs: 2900 },
];

const shuffle = (items) => {
  const nextItems = [...items];
  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextItems[index], nextItems[swapIndex]] = [nextItems[swapIndex], nextItems[index]];
  }
  return nextItems;
};

const getChapterConfig = (chapter) => CHAPTERS[Math.min(Math.max(chapter - 1, 0), CHAPTERS.length - 1)];

const getCoordinate = (index) => {
  const row = String.fromCharCode(65 + Math.floor(index / 4));
  return `${row}${(index % 4) + 1}`;
};

const createDeck = (chapter) => {
  const config = getChapterConfig(chapter);
  const picks = shuffle(ATLAS_MARKERS).slice(0, config.pairs);
  const cards = shuffle(
    picks.flatMap((marker, index) => [
      {
        ...marker,
        cardId: `${marker.id}-a-${chapter}-${index}`,
        matched: false,
        faceUp: true,
      },
      {
        ...marker,
        cardId: `${marker.id}-b-${chapter}-${index}`,
        matched: false,
        faceUp: true,
      },
    ])
  ).map((card, index) => ({
    ...card,
    coordinate: getCoordinate(index),
  }));

  return { cards, config };
};

const createChapterState = ({
  chapter,
  score = 0,
  bestScore = 0,
  moves = 0,
  totalMatches = 0,
  bestChapter = 1,
}) => {
  const { cards, config } = createDeck(chapter);

  return {
    chapter,
    chapterName: config.name,
    totalPairs: config.pairs,
    previewMs: config.previewMs,
    cards,
    score,
    bestScore,
    moves,
    chapterMatches: 0,
    totalMatches,
    streak: 0,
    bestChapter,
    selection: [],
    locked: false,
    phase: "preview",
    status: `${config.name} is fully visible for a brief scan.`,
  };
};

const createFreshState = (bestScore = 0, bestChapter = 1) =>
  createChapterState({
    chapter: 1,
    score: 0,
    bestScore,
    moves: 0,
    totalMatches: 0,
    bestChapter,
  });

const sanitizeCard = (card, index) => {
  const marker = ATLAS_MARKERS.find((entry) => entry.id === card?.id) ||
    ATLAS_MARKERS.find((entry) => entry.id === card?.pairId);

  if (!marker) {
    return null;
  }

  return {
    ...marker,
    cardId: typeof card.cardId === "string" ? card.cardId : `${marker.id}-${index}`,
    matched: Boolean(card.matched),
    faceUp: Boolean(card.faceUp),
    coordinate: typeof card.coordinate === "string" ? card.coordinate : getCoordinate(index),
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
    if (!Array.isArray(parsed?.cards) || !parsed.cards.length) {
      return createFreshState(Number(parsed?.bestScore) || 0, Number(parsed?.bestChapter) || 1);
    }

    const cards = parsed.cards.map(sanitizeCard).filter(Boolean);
    const chapter = Number(parsed.chapter) || 1;
    const config = getChapterConfig(chapter);

    return {
      chapter,
      chapterName: typeof parsed.chapterName === "string" ? parsed.chapterName : config.name,
      totalPairs: Number(parsed.totalPairs) || config.pairs,
      previewMs: Number(parsed.previewMs) || config.previewMs,
      cards,
      score: Number(parsed.score) || 0,
      bestScore: Number(parsed.bestScore) || 0,
      moves: Number(parsed.moves) || 0,
      chapterMatches: Number(parsed.chapterMatches) || 0,
      totalMatches: Number(parsed.totalMatches) || 0,
      streak: Number(parsed.streak) || 0,
      bestChapter: Number(parsed.bestChapter) || 1,
      selection: Array.isArray(parsed.selection) ? parsed.selection.filter((item) => typeof item === "string") : [],
      locked: Boolean(parsed.locked),
      phase: typeof parsed.phase === "string" ? parsed.phase : "preview",
      status: typeof parsed.status === "string" ? parsed.status : `${config.name} restored.`,
    };
  } catch {
    return createFreshState();
  }
};

export default function MemoryAtlas({ onSessionChange }) {
  const [state, setState] = useState(() => readStoredState());
  const {
    chapter,
    chapterName,
    totalPairs,
    previewMs,
    cards,
    score,
    bestScore,
    moves,
    chapterMatches,
    totalMatches,
    streak,
    bestChapter,
    selection,
    locked,
    phase,
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
      game: "memory-atlas",
      score,
      bestScore,
      moves,
      matches: totalMatches,
      chapter,
      streak,
      gameOver: phase === "complete",
      status,
    });
  }, [bestScore, chapter, moves, onSessionChange, phase, score, status, streak, totalMatches]);

  useEffect(() => {
    if (phase !== "preview") {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setState((currentState) => {
        if (currentState.phase !== "preview") {
          return currentState;
        }

        return {
          ...currentState,
          cards: currentState.cards.map((card) => ({ ...card, faceUp: false })),
          phase: "play",
          status: "The atlas veiled itself. Match the marker pairs from memory.",
        };
      });
    }, previewMs);

    return () => window.clearTimeout(timer);
  }, [phase, previewMs]);

  useEffect(() => {
    if (phase !== "play" || locked || selection.length < 2) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setState((currentState) => {
        if (currentState.phase !== "play" || currentState.selection.length < 2) {
          return currentState;
        }

        const [firstId, secondId] = currentState.selection;
        const firstCard = currentState.cards.find((card) => card.cardId === firstId);
        const secondCard = currentState.cards.find((card) => card.cardId === secondId);

        if (!firstCard || !secondCard) {
          return {
            ...currentState,
            locked: false,
            selection: [],
          };
        }

        const nextMoves = currentState.moves + 1;
        const isMatch = firstCard.id === secondCard.id;

        if (!isMatch) {
          return {
            ...currentState,
            moves: nextMoves,
            streak: 0,
            locked: false,
            selection: [],
            cards: currentState.cards.map((card) =>
              card.cardId === firstId || card.cardId === secondId ? { ...card, faceUp: false } : card
            ),
            status: "The trail split. Re-center and uncover the right pair.",
          };
        }

        const nextChapterMatches = currentState.chapterMatches + 1;
        const nextTotalMatches = currentState.totalMatches + 1;
        const nextStreak = currentState.streak + 1;
        const gainedScore = 120 + currentState.chapter * 25 + currentState.streak * 30;
        const nextScore = currentState.score + gainedScore;
        const chapterCleared = nextChapterMatches >= currentState.totalPairs;
        const nextBestChapter = Math.max(currentState.bestChapter, currentState.chapter);

        return {
          ...currentState,
          moves: nextMoves,
          score: nextScore,
          bestScore: Math.max(currentState.bestScore, nextScore),
          chapterMatches: nextChapterMatches,
          totalMatches: nextTotalMatches,
          streak: nextStreak,
          bestChapter: nextBestChapter,
          locked: false,
          selection: [],
          phase: chapterCleared
            ? currentState.chapter >= CHAPTERS.length
              ? "complete"
              : "chapter-clear"
            : "play",
          cards: currentState.cards.map((card) =>
            card.cardId === firstId || card.cardId === secondId
              ? { ...card, matched: true, faceUp: true }
              : card
          ),
          status: chapterCleared
            ? currentState.chapter >= CHAPTERS.length
              ? "Every atlas wing is solved. Start again for a cleaner score."
              : `${currentState.chapterName} is complete. The next route is ready.`
            : `${firstCard.label} matched cleanly. Keep the streak alive.`,
        };
      });
    }, 520);

    return () => window.clearTimeout(timer);
  }, [locked, phase, selection]);

  const flipCard = (cardId) => {
    setState((currentState) => {
      if (currentState.phase !== "play" || currentState.locked || currentState.selection.length >= 2) {
        return currentState;
      }

      const targetCard = currentState.cards.find((card) => card.cardId === cardId);
      if (!targetCard || targetCard.faceUp || targetCard.matched) {
        return currentState;
      }

      const nextSelection = [...currentState.selection, cardId];
      return {
        ...currentState,
        cards: currentState.cards.map((card) =>
          card.cardId === cardId ? { ...card, faceUp: true } : card
        ),
        selection: nextSelection,
        locked: nextSelection.length === 2,
        status:
          nextSelection.length === 1
            ? `${targetCard.label} uncovered. Find its pair.`
            : "Checking the route pairing.",
      };
    });
  };

  const restartChapter = () => {
    setState((currentState) =>
      createChapterState({
        chapter: currentState.chapter,
        score: currentState.score,
        bestScore: Math.max(currentState.bestScore, currentState.score),
        moves: currentState.moves,
        totalMatches: currentState.totalMatches,
        bestChapter: currentState.bestChapter,
      })
    );
  };

  const advanceChapter = () => {
    setState((currentState) => {
      if (currentState.phase !== "chapter-clear") {
        return currentState;
      }

      return createChapterState({
        chapter: Math.min(currentState.chapter + 1, CHAPTERS.length),
        score: currentState.score,
        bestScore: Math.max(currentState.bestScore, currentState.score),
        moves: currentState.moves,
        totalMatches: currentState.totalMatches,
        bestChapter: Math.max(currentState.bestChapter, currentState.chapter + 1),
      });
    });
  };

  const startFreshRun = () => {
    setState((currentState) =>
      createFreshState(Math.max(currentState.bestScore, currentState.score), currentState.bestChapter)
    );
  };

  const progressPercent = useMemo(
    () => Math.min(100, Math.round((chapterMatches / totalPairs) * 100)),
    [chapterMatches, totalPairs]
  );

  const overlayVisible = phase === "preview" || phase === "chapter-clear" || phase === "complete";

  return (
    <section className="game-memory-shell">
      <div className="game-memory-head">
        <div>
          <p className="game-memory-kicker">Tengacion recall lane</p>
          <h3>Memory Atlas</h3>
          <p>{status}</p>
        </div>

        <div className="game-memory-head-actions">
          <button type="button" className="btn-secondary" onClick={restartChapter}>
            Replay chapter
          </button>
          <button type="button" className="btn-secondary" onClick={startFreshRun}>
            New atlas
          </button>
        </div>
      </div>

      <div className="game-memory-stats">
        <div>
          <span>Score</span>
          <strong>{score}</strong>
        </div>
        <div>
          <span>Best</span>
          <strong>{bestScore}</strong>
        </div>
        <div>
          <span>Chapter</span>
          <strong>{chapter}</strong>
        </div>
        <div>
          <span>Moves</span>
          <strong>{moves}</strong>
        </div>
      </div>

      <div className="game-memory-stage">
        <div className="game-memory-board-shell">
          <div className="game-memory-board" aria-label="Memory Atlas board">
            {cards.map((card) => (
              <button
                key={card.cardId}
                type="button"
                className={`game-memory-card ${card.faceUp ? "is-face-up" : ""} ${card.matched ? "is-matched" : ""} marker-${card.tint}`}
                onClick={() => flipCard(card.cardId)}
                disabled={phase !== "play" || locked || card.faceUp || card.matched}
              >
                <span className="game-memory-card-face game-memory-card-front">
                  <small>{card.coordinate}</small>
                  <strong>Atlas</strong>
                  <span>Memory lane</span>
                </span>
                <span className="game-memory-card-face game-memory-card-back">
                  <small>{card.sigil}</small>
                  <strong>{card.label}</strong>
                  <span>Marker pair</span>
                </span>
              </button>
            ))}
          </div>

          {overlayVisible ? (
            <div className="game-memory-overlay">
              <strong>
                {phase === "preview"
                  ? `${chapterName} preview`
                  : phase === "chapter-clear"
                    ? "Route cleared"
                    : "Atlas mastered"}
              </strong>
              <p>
                {phase === "preview"
                  ? "Take a quick visual pass. The markers will hide themselves in a moment."
                  : phase === "chapter-clear"
                    ? "You solved this route. Move forward and the atlas will widen."
                    : "Every chapter is complete. Start again and aim for a sharper run."}
              </p>

              <div className="game-memory-overlay-actions">
                {phase === "chapter-clear" ? (
                  <button type="button" className="btn-secondary" onClick={advanceChapter}>
                    Open next chapter
                  </button>
                ) : null}
                {phase === "complete" ? (
                  <button type="button" className="btn-secondary" onClick={startFreshRun}>
                    Start new atlas
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="game-memory-aside">
          <div className="game-memory-side-card">
            <span>Route</span>
            <strong>{chapterName}</strong>
            <p>
              {chapterMatches} of {totalPairs} marker pairs banked in this chapter.
            </p>
            <div className="game-memory-progress" aria-hidden="true">
              <span style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          <div className="game-memory-side-card">
            <span>Focus streak</span>
            <strong>{streak ? `${streak} clean` : "Build it"}</strong>
            <p>
              Consecutive correct pairs lift your rhythm and quietly raise each scoring burst.
            </p>
          </div>

          <div className="game-memory-side-card">
            <span>Atlas log</span>
            <strong>{totalMatches} pairs banked</strong>
            <p>
              Best chapter reached: {bestChapter}. Match confidently, not quickly, to stay efficient.
            </p>
          </div>

          <div className="game-memory-side-card">
            <span>Controls</span>
            <strong>Tap cards and match</strong>
            <p>
              Every chapter starts with a short reveal. Study the layout, then uncover and pair the markers.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
