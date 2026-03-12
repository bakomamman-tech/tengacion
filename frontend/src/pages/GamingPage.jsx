import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import Navbar from "../Navbar";
import Tengacion2048 from "../components/gaming/Tengacion2048";
import SnakeXavia from "../components/gaming/SnakeXavia";

const SAVED_GAMES_KEY = "tengacion.gaming.saved";

const GAME_LIBRARY = [
  {
    id: "2048-classic",
    title: "2048 Classic",
    genre: "Puzzle",
    status: "Playable now",
    playable: true,
    accent: "linear-gradient(145deg, #f6c96a 0%, #b86d18 100%)",
    summary: "A clean local adaptation of the open-source 2048 web classic.",
    description:
      "Combine matching tiles, chase bigger numbers, and build your best score directly inside Tengacion.",
    originalUrl: "https://gabrielecirulli.github.io/2048/",
    sourceUrl: "https://github.com/gabrielecirulli/2048",
  },
  {
    id: "snake-xavia",
    title: "Snake Xavia",
    genre: "Arcade",
    status: "Playable now",
    playable: true,
    accent: "linear-gradient(145deg, #28a96b 0%, #103b27 100%)",
    summary: "A fast original Tengacion snake run built for quick reflex sessions.",
    description:
      "Guide the snake, collect glowing fruit, avoid collisions, and climb your best score in a lighter arcade lane.",
    builtInLabel: "Built inside Tengacion",
  },
  {
    id: "night-raid",
    title: "Night Raid",
    genre: "Arcade",
    status: "Prototype queue",
    playable: false,
    accent: "linear-gradient(145deg, #283b67 0%, #11182f 100%)",
    summary: "Fast reflex lanes, neon enemies, and score-chasing rounds.",
    description:
      "Arcade combat is on the roadmap. For now, save it to your list and we will slot it into the next playable wave.",
  },
  {
    id: "word-sprint",
    title: "Word Sprint",
    genre: "Word",
    status: "Prototype queue",
    playable: false,
    accent: "linear-gradient(145deg, #4f8b67 0%, #1e3d2b 100%)",
    summary: "A fast vocabulary run built for short play sessions.",
    description:
      "This lane will become a timed word game for creators and communities who like lighter competition.",
  },
  {
    id: "block-drop",
    title: "Block Drop",
    genre: "Strategy",
    status: "Prototype queue",
    playable: false,
    accent: "linear-gradient(145deg, #7843a8 0%, #2d1648 100%)",
    summary: "A stack-and-clear concept that fits mobile and desktop equally well.",
    description:
      "We are shaping a calmer strategy lane with clean visuals and satisfying combo loops.",
  },
  {
    id: "chess-room",
    title: "Chess Room",
    genre: "Board",
    status: "Community request",
    playable: false,
    accent: "linear-gradient(145deg, #767163 0%, #312d24 100%)",
    summary: "A turn-based room experience for communities, clubs, and study groups.",
    description:
      "Saved here so players can signal interest before the full multiplayer board room is built.",
  },
  {
    id: "memory-atlas",
    title: "Memory Atlas",
    genre: "Puzzle",
    status: "Concept",
    playable: false,
    accent: "linear-gradient(145deg, #2a8fa5 0%, #143642 100%)",
    summary: "Match symbols, reveal paths, and learn the board as it changes.",
    description:
      "A calmer visual-memory format designed for fast sessions and repeat play.",
  },
];

const GAMING_VIEWS = [
  {
    id: "play",
    label: "Play games",
    description: "Jump into playable web games and discover the next Tengacion originals.",
  },
  {
    id: "activity",
    label: "Gaming activity",
    description: "Track your score, milestones, and recent gaming sessions.",
  },
  {
    id: "saved",
    label: "Saved games",
    description: "Keep a short list of titles you want to return to later.",
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
    gameOver: false,
    game: "2048-classic",
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

      const haystack = `${game.title} ${game.genre} ${game.summary} ${game.description}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [activeCategory, deferredSearch]);

  const featuredGame =
    GAME_LIBRARY.find((game) => game.id === selectedGameId) || GAME_LIBRARY[0];

  const savedGames = useMemo(
    () => GAME_LIBRARY.filter((game) => savedGameIds.includes(game.id)),
    [savedGameIds]
  );

  const activityCards = [
    {
      title: "Best score",
      value: lastSession.bestScore || 0,
      meta:
        lastSession.game === "snake-xavia"
          ? "Highest local Snake Xavia run saved on this browser"
          : "Highest local 2048 run saved on this browser",
    },
    {
      title: "Latest score",
      value: lastSession.score || 0,
      meta: "Your current or most recent session score",
    },
    {
      title: "Saved games",
      value: savedGames.length,
      meta: "Titles pinned for quick access on this page",
    },
    {
      title: lastSession.game === "snake-xavia" ? "Snake length" : "Top tile",
      value: lastSession.highestTile || 4,
      meta:
        lastSession.gameOver
          ? "Last run ended. Start another."
          : "Current run is active.",
    },
  ];

  const spotlightCards = [
    {
      title: "Puzzle lane is live",
      copy: "2048 is fully playable inside Tengacion today while the rest of the catalog matures.",
    },
    {
      title: "Arcade lane is live",
      copy: "Snake Xavia is now playable and gives the gaming page a faster reflex challenge.",
    },
    {
      title: "Board games are being scoped",
      copy: "Chess Room is a strong candidate for clubs, classes, and community groups.",
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
          <h1>Play something real while Tengacion builds its own originals.</h1>
          <p>
            The gaming lane now has a real destination, not a placeholder. Start with an
            open-source web classic, save the concepts you want next, and use this page as the
            launchpad for future Tengacion games.
          </p>
        </div>

        <div className="gaming-hero-card" style={{ background: featuredGame.accent }}>
          <span>{featuredGame.status}</span>
          <strong>{featuredGame.title}</strong>
          <p>{featuredGame.summary}</p>
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
              </div>
              <div className="gaming-game-card-body">
                <strong>{game.title}</strong>
                <p>{game.summary}</p>
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
          <div className="gaming-side-card">
            <p className="gaming-kicker">Quick stats</p>
            <div className="gaming-stat-list">
              <div>
                <span>Current score</span>
                <strong>{lastSession.score || 0}</strong>
              </div>
              <div>
                <span>Best score</span>
                <strong>{lastSession.bestScore || 0}</strong>
              </div>
              <div>
                <span>{lastSession.game === "snake-xavia" ? "Snake length" : "Moves played"}</span>
                <strong>
                  {lastSession.game === "snake-xavia"
                    ? lastSession.highestTile || 3
                    : lastSession.moves || 0}
                </strong>
              </div>
              <div>
                <span>{lastSession.game === "snake-xavia" ? "Steps" : "Moves played"}</span>
                <strong>{lastSession.moves || 0}</strong>
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
              </div>
              <div className="gaming-game-card-body">
                <strong>{game.title}</strong>
                <p>{game.summary}</p>
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
        onOpenMessenger={() => navigate("/home", { state: { openMessenger: true } })}
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
