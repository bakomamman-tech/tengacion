import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import Navbar from "../Navbar";
import ChessRoom from "../components/gaming/ChessRoom";
import MemoryAtlas from "../components/gaming/MemoryAtlas";
import MushroomRun from "../components/gaming/MushroomRun";
import Tengacion2048 from "../components/gaming/Tengacion2048";
import SnakeXavia from "../components/gaming/SnakeXavia";
import TengacionTetris from "../components/gaming/TengacionTetris";

const SAVED_GAMES_KEY = "tengacion.gaming.saved";

const GAME_LIBRARY = [
  {
    id: "2048-classic",
    title: "2048 Classic",
    genre: "Puzzle",
    status: "Playable now",
    playable: true,
    accent: "linear-gradient(145deg, #f4cf79 0%, #b0681a 100%)",
    summary: "A polished local take on the open-source 2048 web classic.",
    description:
      "Stack matching tiles, chase smoother merges, and build a bigger browser-saved score without leaving Tengacion.",
    difficulty: "Easy to learn",
    session: "2-8 min",
    controls: "Arrow keys or swipe",
    highlights: [
      "Undo support gives you room to recover smartly.",
      "Runs stay saved in this browser, so your best score is always nearby.",
      "Touch controls now work naturally on mobile.",
    ],
    originalUrl: "https://gabrielecirulli.github.io/2048/",
    sourceUrl: "https://github.com/gabrielecirulli/2048",
  },
  {
    id: "snake-xavia",
    title: "Snake Xavia",
    genre: "Arcade",
    status: "Playable now",
    playable: true,
    accent: "linear-gradient(145deg, #3ccd87 0%, #0c4330 100%)",
    summary: "A faster Tengacion original built for quick reflex sessions.",
    description:
      "Guide the snake, collect glowing fruit, avoid collisions, and switch between pacing modes depending on how hard you want the run to hit.",
    difficulty: "Mode-based",
    session: "1-6 min",
    controls: "Arrow keys, WASD, or swipe",
    highlights: [
      "Three pace modes change how each run feels.",
      "The board now supports touch steering for phone-first play.",
      "Pause, resume, and restart flow feels cleaner mid-session.",
    ],
    builtInLabel: "Built inside Tengacion",
  },
  {
    id: "mushroom-run",
    title: "Mushroom Run",
    genre: "Arcade",
    status: "Playable now",
    playable: true,
    accent: "linear-gradient(145deg, #ffcb63 0%, #ff7f4e 44%, #4a88ff 100%)",
    summary: "A bright side-scrolling platform lane built around coins, checkpoints, and stylish jumps.",
    description:
      "Sprint through a polished original plumber course, collect glowing coins, stomp past hazards, and reach the finale banner with enough hearts to score big.",
    difficulty: "Rhythm-based",
    session: "3-9 min",
    controls: "Arrow keys, Space, P",
    highlights: [
      "Checkpoint banners keep runs fair while still rewarding cleaner movement.",
      "Canvas visuals give the course a more playful, arcade-first feel inside Tengacion.",
      "Best score, best distance, and course clears stay saved locally on this device.",
    ],
    builtInLabel: "Built inside Tengacion",
  },
  {
    id: "night-raid",
    title: "Night Raid",
    genre: "Arcade",
    status: "Prototype queue",
    playable: false,
    accent: "linear-gradient(145deg, #2b4b6e 0%, #101a2d 100%)",
    summary: "Reflex lanes, neon enemies, and score-chasing night runs.",
    description:
      "This concept is positioned as a stylish combat lane with short rounds, escalating danger, and creator-grade visual polish.",
    difficulty: "Medium-high",
    session: "3-7 min",
    controls: "Tap, dodge, boost",
    highlights: [
      "Designed for fast replays and compact rounds.",
      "Visual direction leans cinematic instead of retro.",
      "A strong candidate for the next playable arcade drop.",
    ],
  },
  {
    id: "word-sprint",
    title: "Word Sprint",
    genre: "Word",
    status: "Prototype queue",
    playable: false,
    accent: "linear-gradient(145deg, #4e9f79 0%, #193c2c 100%)",
    summary: "A timed vocabulary lane built for quick creative competition.",
    description:
      "Word Sprint is being shaped as a social, replayable challenge that fits creators, classrooms, and casual communities equally well.",
    difficulty: "Adaptive",
    session: "2-5 min",
    controls: "Type and submit",
    highlights: [
      "Timed prompts keep rounds tense but readable.",
      "Great fit for community tournaments and streaks.",
      "Would give the page a lighter, social lane.",
    ],
  },
  {
    id: "block-drop",
    title: "Block Drop",
    genre: "Strategy",
    status: "Prototype queue",
    playable: false,
    accent: "linear-gradient(145deg, #6f6be8 0%, #241b5e 100%)",
    summary: "A stack-and-clear concept with cleaner visual rhythm.",
    description:
      "This lane is being framed as a calmer strategy game with smooth combo feedback, satisfying clears, and a strong mobile silhouette.",
    difficulty: "Climbs over time",
    session: "4-10 min",
    controls: "Tap, drag, rotate",
    highlights: [
      "Best suited to players who like compounding decision-making.",
      "Would bring a more meditative lane to the hub.",
      "The visual language is already a strong fit for Tengacion.",
    ],
  },
  {
    id: "chess-room",
    title: "Chess Room",
    genre: "Board",
    status: "Playable now",
    playable: true,
    accent: "linear-gradient(145deg, #989179 0%, #373224 100%)",
    summary: "A polished local chess table for head-to-head play inside Tengacion.",
    description:
      "Play a full local chess match with legal moves, castling, promotion, move history, and a clean room-style board that stays saved on this device.",
    difficulty: "Skill-based",
    session: "8-40 min",
    controls: "Tap pieces and squares",
    highlights: [
      "Full legal move flow includes castling, promotion, and en passant.",
      "Flip the board to suit over-the-table club play or teaching moments.",
      "Room log and local saves keep the match easy to revisit.",
    ],
    builtInLabel: "Built inside Tengacion",
  },
  {
    id: "memory-atlas",
    title: "Memory Atlas",
    genre: "Puzzle",
    status: "Playable now",
    playable: true,
    accent: "linear-gradient(145deg, #4bd8ff 0%, #2275d9 52%, #4b2ca8 100%)",
    summary: "An atmospheric recall lane built around short reveals, clean matches, and chapter progression.",
    description:
      "Scan a glowing atlas board, watch it veil itself, and recover matching marker pairs across richer chapters that stay saved on this device.",
    difficulty: "Pattern recall",
    session: "2-7 min",
    controls: "Tap and match",
    highlights: [
      "Each chapter starts with a brief reveal, then turns into a focused recall run.",
      "Matching streaks reward cleaner memory reads instead of frantic tapping.",
      "Local save state lets you reopen the atlas without losing your progress.",
    ],
    builtInLabel: "Built inside Tengacion",
  },
  {
    id: "tengacion-tetris",
    title: "Tetris",
    genre: "Puzzle",
    status: "Playable now",
    playable: true,
    accent: "linear-gradient(145deg, #42d4ff 0%, #2e7bff 48%, #6629d4 100%)",
    summary: "A neon-glass stack lane built for fast clears, hard drops, and steady pressure.",
    description:
      "Guide falling tetrominoes through a polished Tengacion board, hold pieces for rescue plays, and chase cleaner line clears as the lane speeds up.",
    difficulty: "Climbs over time",
    session: "3-12 min",
    controls: "Arrow keys, Space, C",
    highlights: [
      "Hold and preview panels let you plan beyond the next drop.",
      "Level speed builds naturally, so clean stacking matters more each minute.",
      "Mobile control buttons keep the run playable beyond desktop keyboards.",
    ],
    builtInLabel: "Built inside Tengacion",
  },
];

const GAMING_VIEWS = [
  {
    id: "play",
    label: "Play games",
    description: "Launch live games, inspect lanes, and jump between playable picks quickly.",
  },
  {
    id: "activity",
    label: "Gaming activity",
    description: "Track score momentum, saved progress, and whichever lane you touched last.",
  },
  {
    id: "saved",
    label: "Saved games",
    description: "Keep a tidy shortlist of concepts and playable titles worth returning to.",
  },
];

const GAME_CATEGORIES = ["All", "Puzzle", "Arcade", "Word", "Strategy", "Board"];

const readSavedGames = () => {
  if (typeof window === "undefined") {
    return ["2048-classic"];
  }

  try {
    const raw = window.localStorage.getItem(SAVED_GAMES_KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) && parsed.length ? parsed : ["2048-classic"];
  } catch {
    return ["2048-classic"];
  }
};

export default function GamingPage({ user }) {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState("play");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedGameId, setSelectedGameId] = useState("2048-classic");
  const [savedGameIds, setSavedGameIds] = useState(() => readSavedGames());
  const [lastSession, setLastSession] = useState({
    score: 0,
    bestScore: 0,
    moves: 0,
    highestTile: 4,
    lines: 0,
    level: 1,
    combo: 0,
    matches: 0,
    chapter: 1,
    streak: 0,
    coins: 0,
    distance: 0,
    hearts: 3,
    wins: 0,
    lastPlaced: "T",
    gameOver: false,
    game: "2048-classic",
    turn: "w",
    materialLead: "Even board",
    capturedWhiteValue: 0,
    capturedBlackValue: 0,
    status: "White to move",
  });

  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    window.localStorage.setItem(SAVED_GAMES_KEY, JSON.stringify(savedGameIds));
  }, [savedGameIds]);

  const filteredGames = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase();
    return GAME_LIBRARY.filter((game) => {
      const categoryMatch =
        activeCategory === "All" || game.genre.toLowerCase() === activeCategory.toLowerCase();
      if (!categoryMatch) {
        return false;
      }

      if (!needle) {
        return true;
      }

      const haystack =
        `${game.title} ${game.genre} ${game.summary} ${game.description} ${game.difficulty} ${game.controls}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [activeCategory, deferredSearch]);

  const featuredGame =
    GAME_LIBRARY.find((game) => game.id === selectedGameId) || GAME_LIBRARY[0];

  const savedGames = useMemo(
    () => GAME_LIBRARY.filter((game) => savedGameIds.includes(game.id)),
    [savedGameIds]
  );

  const playableCount = useMemo(
    () => GAME_LIBRARY.filter((game) => game.playable).length,
    []
  );
  const conceptCount = GAME_LIBRARY.length - playableCount;
  const isChessSession = lastSession.game === "chess-room";
  const isTetrisSession = lastSession.game === "tengacion-tetris";
  const isMemorySession = lastSession.game === "memory-atlas";
  const isMushroomSession = lastSession.game === "mushroom-run";
  const lastPlayedTitle =
    lastSession.game === "snake-xavia"
      ? "Snake Xavia"
      : lastSession.game === "mushroom-run"
        ? "Mushroom Run"
      : lastSession.game === "chess-room"
        ? "Chess Room"
        : lastSession.game === "tengacion-tetris"
          ? "Tetris"
          : lastSession.game === "memory-atlas"
            ? "Memory Atlas"
          : "2048 Classic";
  const activityCards = isChessSession
    ? [
        {
          title: "Last lane touched",
          value: lastPlayedTitle,
          meta: "The most recent live board room you opened on this device.",
        },
        {
          title: "Side to move",
          value: lastSession.turn === "b" ? "Black" : "White",
          meta: "Whose turn it is in the current saved chess room.",
        },
        {
          title: "Room state",
          value: lastSession.status || "White to move",
          meta: "Live match status from the local chess session.",
        },
        {
          title: "Material lead",
          value: lastSession.materialLead || "Even board",
          meta: "Quick board read based on captured material.",
        },
        {
          title: "Moves played",
          value: lastSession.moves || 0,
          meta: "Total legal moves made in the current room.",
        },
        {
          title: "Saved games",
          value: savedGames.length,
          meta: "Shortlisted titles ready to reopen from this page.",
        },
      ]
    : isMushroomSession
      ? [
          {
            title: "Last lane touched",
            value: lastPlayedTitle,
            meta: "The most recent platform run you opened on this device.",
          },
          {
            title: "Best score",
            value: lastSession.bestScore || 0,
            meta: "Highest Mushroom Run score stored locally in this browser.",
          },
          {
            title: "Coins grabbed",
            value: lastSession.coins || 0,
            meta: "Coin pickups from the active or latest course run.",
          },
          {
            title: "Furthest distance",
            value: lastSession.distance || 0,
            meta: "How far you pushed through the course before the latest stop.",
          },
          {
            title: "Course clears",
            value: lastSession.wins || 0,
            meta: "Total times the finale banner has been reached on this device.",
          },
          {
            title: "Saved games",
            value: savedGames.length,
            meta: "Shortlisted titles ready to reopen from this page.",
          },
        ]
    : isMemorySession
      ? [
          {
            title: "Last lane touched",
            value: lastPlayedTitle,
            meta: "The most recent recall board you opened on this device.",
          },
          {
            title: "Best score",
            value: lastSession.bestScore || 0,
            meta: "Highest Memory Atlas score stored locally in this browser.",
          },
          {
            title: "Pairs banked",
            value: lastSession.matches || 0,
            meta: "Total marker pairs solved across the active saved atlas.",
          },
          {
            title: "Chapter reached",
            value: lastSession.chapter || 1,
            meta: "How far the current atlas run has progressed.",
          },
          {
            title: "Focus streak",
            value: lastSession.streak ? `${lastSession.streak} clean` : "Build it",
            meta: "Consecutive clean matches from the current route.",
          },
          {
            title: "Saved games",
            value: savedGames.length,
            meta: "Shortlisted titles ready to reopen from this page.",
          },
        ]
    : isTetrisSession
      ? [
          {
            title: "Last lane touched",
            value: lastPlayedTitle,
            meta: "The most recent live stack lane you opened on this device.",
          },
          {
            title: "Best score",
            value: lastSession.bestScore || 0,
            meta: "Highest Tetris score saved locally in this browser.",
          },
          {
            title: "Lines cleared",
            value: lastSession.lines || 0,
            meta: "Total completed rows from the active or latest run.",
          },
          {
            title: "Level reached",
            value: lastSession.level || 1,
            meta: "Speed pressure rises every ten cleared lines.",
          },
          {
            title: "Combo rhythm",
            value: lastSession.combo ? `${lastSession.combo}x` : "Steady",
            meta: "Back-to-back clears stack into a stronger scoring rhythm.",
          },
          {
            title: "Saved games",
            value: savedGames.length,
            meta: "Shortlisted titles ready to reopen from this page.",
          },
        ]
    : [
        {
          title: "Last lane touched",
          value: lastPlayedTitle,
          meta: "The most recent playable game you interacted with on this device.",
        },
        {
          title: "Best score",
          value: lastSession.bestScore || 0,
          meta: `${lastPlayedTitle} personal best stored locally in this browser.`,
        },
        {
          title: "Latest score",
          value: lastSession.score || 0,
          meta: lastSession.gameOver
            ? "That run ended. There is room for a cleaner follow-up."
            : "The current run is still active.",
        },
        {
          title: lastSession.game === "snake-xavia" ? "Longest snake" : "Top tile",
          value: lastSession.highestTile || (lastSession.game === "snake-xavia" ? 3 : 4),
          meta:
            lastSession.game === "snake-xavia"
              ? "Length reached on the current or latest run."
              : "Highest tile reached so far in the active browser save.",
        },
        {
          title: "Session steps",
          value: lastSession.moves || 0,
          meta: "Movement count from the current or most recent session.",
        },
        {
          title: "Saved games",
          value: savedGames.length,
          meta: "Shortlisted titles ready to reopen from this page.",
        },
      ];

  const spotlightCards = [
    {
      title: `${featuredGame.title} is the current focus`,
      copy: featuredGame.playable
        ? `It is live right now with a cleaner stage, richer controls, and a more polished play loop.`
        : `It is still a concept lane, but it now reads like a stronger part of the catalog instead of filler.`,
    },
    {
      title: savedGames.length ? `${savedGames.length} saved lane${savedGames.length === 1 ? "" : "s"} ready` : "Start building a shortlist",
      copy: savedGames.length
        ? "You can switch between saved concepts and live games faster from the left rail."
        : "Save any lane that feels promising and it will stay close for your next session.",
    },
    {
      title: `${playableCount} live games, ${conceptCount} future lanes`,
      copy: "The hub now feels like a real destination, not a waiting room, while the broader catalog keeps taking shape.",
    },
  ];

  const heroMetrics = [
    {
      label: "Playable now",
      value: playableCount,
      meta: "Launch instantly",
    },
    {
      label: "Concept lanes",
      value: conceptCount,
      meta: "Saved for future build",
    },
    {
      label: "Saved by you",
      value: savedGames.length,
      meta: savedGames.length ? "Shortlist in progress" : "Start a shortlist",
    },
  ];

  const toggleSavedGame = (gameId) => {
    setSavedGameIds((current) =>
      current.includes(gameId)
        ? current.filter((entry) => entry !== gameId)
        : [...current, gameId]
    );
  };

  const openGame = (gameId) => {
    startTransition(() => {
      setSelectedGameId(gameId);
      setActiveView("play");
    });
  };

  const handleLogout = () => {
    navigate("/");
  };

  const renderPlayableGame = () => {
    if (featuredGame.id === "chess-room") {
      return <ChessRoom onSessionChange={setLastSession} />;
    }

    if (featuredGame.id === "mushroom-run") {
      return <MushroomRun onSessionChange={setLastSession} />;
    }

    if (featuredGame.id === "memory-atlas") {
      return <MemoryAtlas onSessionChange={setLastSession} />;
    }

    if (featuredGame.id === "tengacion-tetris") {
      return <TengacionTetris onSessionChange={setLastSession} />;
    }

    if (featuredGame.id === "snake-xavia") {
      return <SnakeXavia onSessionChange={setLastSession} />;
    }

    return <Tengacion2048 onSessionChange={setLastSession} />;
  };

  const renderPlayDeck = () => (
    <>
      <section className="gaming-hero">
        <div className="gaming-hero-copy">
          <p className="gaming-kicker">Gaming hub</p>
          <h1>Play faster. Save favorites. Keep the fun going.</h1>
          <p className="gaming-hero-lede">
            Jump into a game, save the ones you like, and pick up your score chase anytime.
          </p>

          <div className="gaming-hero-metrics">
            {heroMetrics.map((item) => (
              <article key={item.label} className="gaming-metric-card">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.meta}</small>
              </article>
            ))}
          </div>
        </div>

        <div className="gaming-hero-stage">
          <div className="gaming-hero-card" style={{ background: featuredGame.accent }}>
            <span>{featuredGame.status}</span>
            <strong>{featuredGame.title}</strong>
            <p>{featuredGame.summary}</p>

            <div className="gaming-card-meta">
              <small>{featuredGame.genre}</small>
              <small>{featuredGame.difficulty}</small>
              <small>{featuredGame.session}</small>
            </div>

            <div className="gaming-hero-actions">
              <button type="button" className="btn-primary" onClick={() => openGame(featuredGame.id)}>
                {featuredGame.playable ? "Play now" : "Open preview"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => toggleSavedGame(featuredGame.id)}
              >
                {savedGameIds.includes(featuredGame.id) ? "Saved" : "Save game"}
              </button>
            </div>
          </div>

          <div className="gaming-hero-notes">
            {featuredGame.highlights.map((item) => (
              <article key={item}>
                <span />
                <p>{item}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="gaming-section">
        <div className="gaming-section-head">
          <div>
            <p className="gaming-kicker">Top picks</p>
            <h2>Choose a game lane</h2>
          </div>

          <div className="gaming-chip-row">
            {GAME_CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                className={`gaming-chip ${activeCategory === category ? "active" : ""}`}
                onClick={() => startTransition(() => setActiveCategory(category))}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="gaming-card-grid">
          {filteredGames.map((game) => (
            <button
              key={game.id}
              type="button"
              className={`gaming-game-card ${selectedGameId === game.id ? "active" : ""}`}
              onClick={() => openGame(game.id)}
            >
              <div className="gaming-game-card-art" style={{ background: game.accent }}>
                <span>{game.genre}</span>
                <strong>{game.playable ? "Live" : "Concept"}</strong>
              </div>
              <div className="gaming-game-card-body">
                <div className="gaming-card-title-row">
                  <strong>{game.title}</strong>
                  {savedGameIds.includes(game.id) && <small className="gaming-card-save">Saved</small>}
                </div>
                <p>{game.summary}</p>
                <div className="gaming-card-meta">
                  <small>{game.difficulty}</small>
                  <small>{game.controls}</small>
                  <small>{game.session}</small>
                </div>
              </div>
            </button>
          ))}
        </div>

        {filteredGames.length === 0 && (
          <div className="gaming-empty-state">
            <h3>No games matched that search</h3>
            <p>Try another keyword or switch back to the full category list.</p>
          </div>
        )}
      </section>

      <section className="gaming-play-grid">
        <div className="gaming-play-panel">
          <div className="gaming-section-head compact">
            <div>
              <p className="gaming-kicker">Play deck</p>
              <h2>{featuredGame.title}</h2>
            </div>
          </div>

          <p className="gaming-panel-copy">{featuredGame.description}</p>

          <div className="gaming-fact-grid">
            <article className="gaming-fact-card">
              <span>Difficulty</span>
              <strong>{featuredGame.difficulty}</strong>
            </article>
            <article className="gaming-fact-card">
              <span>Session</span>
              <strong>{featuredGame.session}</strong>
            </article>
            <article className="gaming-fact-card">
              <span>Controls</span>
              <strong>{featuredGame.controls}</strong>
            </article>
            <article className="gaming-fact-card">
              <span>Status</span>
              <strong>{featuredGame.status}</strong>
            </article>
          </div>

          {featuredGame.playable ? (
            <>
              {(featuredGame.originalUrl || featuredGame.sourceUrl || featuredGame.builtInLabel) && (
                <div className="gaming-link-row">
                  {featuredGame.originalUrl && (
                    <a href={featuredGame.originalUrl} target="_blank" rel="noreferrer">
                      Original game
                    </a>
                  )}
                  {featuredGame.sourceUrl && (
                    <a href={featuredGame.sourceUrl} target="_blank" rel="noreferrer">
                      Source code
                    </a>
                  )}
                  {featuredGame.builtInLabel && <span>{featuredGame.builtInLabel}</span>}
                </div>
              )}
              {renderPlayableGame()}
            </>
          ) : (
            <div className="gaming-coming-soon-card" style={{ background: featuredGame.accent }}>
              <span>{featuredGame.status}</span>
              <h3>{featuredGame.title}</h3>
              <p>{featuredGame.description}</p>

              <div className="gaming-highlight-list">
                {featuredGame.highlights.map((item) => (
                  <article key={item}>
                    <span />
                    <p>{item}</p>
                  </article>
                ))}
              </div>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => toggleSavedGame(featuredGame.id)}
              >
                {savedGameIds.includes(featuredGame.id) ? "Saved for later" : "Save this concept"}
              </button>
            </div>
          )}
        </div>

        <div className="gaming-side-stack">
          <div className="gaming-side-card gaming-side-card-focus">
            <p className="gaming-kicker">Game intel</p>
            <div className="gaming-intel-list">
              {featuredGame.highlights.map((item) => (
                <article key={item} className="gaming-intel-item">
                  <span />
                  <p>{item}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="gaming-side-card">
            <p className="gaming-kicker">Live session</p>
            <div className="gaming-current-game">
              <strong>{lastPlayedTitle}</strong>
              <small>
                {isChessSession
                  ? lastSession.status || "White to move"
                  : isMushroomSession
                    ? lastSession.status || "Course in motion"
                  : isMemorySession
                    ? lastSession.status || "Route in motion"
                  : isTetrisSession
                    ? lastSession.status || "Stack in motion"
                  : lastSession.gameOver
                    ? "Last run ended"
                    : "Run in progress"}
              </small>
            </div>

            <div className="gaming-stat-list">
              <div>
                <span>{isChessSession ? "Turn" : "Current score"}</span>
                <strong>
                  {isChessSession ? (lastSession.turn === "b" ? "Black" : "White") : lastSession.score || 0}
                </strong>
              </div>
              <div>
                <span>{isChessSession ? "Moves" : "Best score"}</span>
                <strong>{isChessSession ? lastSession.moves || 0 : lastSession.bestScore || 0}</strong>
              </div>
              <div>
                <span>
                  {isChessSession
                    ? "White capture"
                    : isMushroomSession
                      ? "Coins"
                    : isMemorySession
                      ? "Pairs banked"
                    : isTetrisSession
                      ? "Lines cleared"
                    : lastSession.game === "snake-xavia"
                      ? "Snake length"
                      : "Top tile"}
                </span>
                <strong>
                  {isChessSession
                    ? lastSession.capturedWhiteValue || 0
                    : isMushroomSession
                      ? lastSession.coins || 0
                    : isMemorySession
                      ? lastSession.matches || 0
                    : isTetrisSession
                      ? lastSession.lines || 0
                    : lastSession.highestTile || (lastSession.game === "snake-xavia" ? 3 : 4)}
                </strong>
              </div>
              <div>
                <span>
                  {isChessSession
                    ? "Black capture"
                    : isMushroomSession
                      ? "Distance"
                    : isMemorySession
                      ? "Chapter"
                      : isTetrisSession
                        ? "Level"
                        : "Steps"}
                </span>
                <strong>
                  {isChessSession
                    ? lastSession.capturedBlackValue || 0
                    : isMushroomSession
                      ? lastSession.distance || 0
                    : isMemorySession
                      ? lastSession.chapter || 1
                    : isTetrisSession
                      ? lastSession.level || 1
                      : lastSession.moves || 0}
                </strong>
              </div>
            </div>
          </div>

          <div className="gaming-side-card">
            <p className="gaming-kicker">Happening now</p>
            <div className="gaming-spotlight-list">
              {spotlightCards.map((card) => (
                <article key={card.title}>
                  <strong>{card.title}</strong>
                  <p>{card.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );

  const renderActivityDeck = () => (
    <section className="gaming-section">
      <div className="gaming-section-head">
        <div>
          <p className="gaming-kicker">Gaming activity</p>
          <h2>Your current local progress</h2>
        </div>
      </div>

      <div className="gaming-activity-grid">
        {activityCards.map((card) => (
          <article key={card.title} className="gaming-activity-card">
            <span>{card.title}</span>
            <strong>{card.value}</strong>
            <p>{card.meta}</p>
          </article>
        ))}
      </div>
    </section>
  );

  const renderSavedDeck = () => (
    <section className="gaming-section">
      <div className="gaming-section-head">
        <div>
          <p className="gaming-kicker">Saved games</p>
          <h2>Your shortlist</h2>
        </div>
      </div>

      {savedGames.length ? (
        <div className="gaming-card-grid">
          {savedGames.map((game) => (
            <button
              key={game.id}
              type="button"
              className="gaming-game-card active"
              onClick={() => openGame(game.id)}
            >
              <div className="gaming-game-card-art" style={{ background: game.accent }}>
                <span>{game.genre}</span>
                <strong>{game.playable ? "Live" : "Concept"}</strong>
              </div>
              <div className="gaming-game-card-body">
                <div className="gaming-card-title-row">
                  <strong>{game.title}</strong>
                  <small className="gaming-card-save">Saved</small>
                </div>
                <p>{game.summary}</p>
                <div className="gaming-card-meta">
                  <small>{game.difficulty}</small>
                  <small>{game.controls}</small>
                  <small>{game.session}</small>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="gaming-empty-state">
          <h3>No saved games yet</h3>
          <p>Save a game from the play deck and it will appear here for quick access.</p>
        </div>
      )}
    </section>
  );

  return (
    <>
      <Navbar
        user={user}
        onLogout={handleLogout}
        onOpenMessenger={(payload = {}) =>
          navigate("/home", {
            state: {
              openMessenger: true,
              messengerTargetId: payload?.contactId || "",
            },
          })
        }
        onOpenCreatePost={(target = "post") =>
          navigate("/home", {
            state:
              target === "story"
                ? { openStoryCreator: true }
                : { openComposer: true, composerMode: target === "reel" ? "reel" : "" },
          })
        }
      />

      <div className="gaming-page-shell">
        <aside className="gaming-sidebar">
          <div className="gaming-sidebar-card">
            <div className="gaming-sidebar-head">
              <div>
                <p className="gaming-kicker">Tengacion</p>
                <h2>Games</h2>
              </div>
            </div>

            <div className="gaming-sidebar-stats">
              {heroMetrics.map((item) => (
                <article key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </article>
              ))}
            </div>

            <label className="gaming-search-shell">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search games"
                aria-label="Search games"
              />
            </label>

            <div className="gaming-nav-list">
              {GAMING_VIEWS.map((view) => (
                <button
                  key={view.id}
                  type="button"
                  className={`gaming-nav-btn ${activeView === view.id ? "active" : ""}`}
                  onClick={() => startTransition(() => setActiveView(view.id))}
                >
                  <strong>{view.label}</strong>
                  <span>{view.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="gaming-sidebar-card">
            <div className="gaming-rail-head">
              <h3>Your games</h3>
              <button type="button" onClick={() => startTransition(() => setActiveView("saved"))}>
                See all
              </button>
            </div>

            {savedGames.length ? (
              <div className="gaming-mini-list">
                {savedGames.slice(0, 4).map((game) => (
                  <button key={game.id} type="button" onClick={() => openGame(game.id)}>
                    <span className="swatch" style={{ background: game.accent }} />
                    <div>
                      <strong>{game.title}</strong>
                      <small>{game.genre}</small>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="gaming-mini-empty">
                Save a lane and it will show up here for quick return visits.
              </div>
            )}
          </div>

          <div className="gaming-sidebar-card">
            <h3>Categories</h3>
            <div className="gaming-category-list">
              {GAME_CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={activeCategory === category ? "active" : ""}
                  onClick={() => startTransition(() => setActiveCategory(category))}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="gaming-main">
          {activeView === "play" && renderPlayDeck()}
          {activeView === "activity" && renderActivityDeck()}
          {activeView === "saved" && renderSavedDeck()}
        </main>
      </div>
    </>
  );
}
