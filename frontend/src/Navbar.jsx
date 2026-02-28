import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { resolveImage } from "./api";
import { useTheme } from "./context/ThemeContext";
import { useNotifications } from "./context/NotificationsContext";
import { Icon } from "./Icon";
import CreateMenuDropdown from "./components/CreateMenuDropdown";

const fallbackAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "User"
  )}&size=96&background=DFE8F6&color=1D3A6D`;

const GridIcon = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <circle cx="5" cy="5" r="2" />
    <circle cx="12" cy="5" r="2" />
    <circle cx="19" cy="5" r="2" />
    <circle cx="5" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="19" cy="12" r="2" />
    <circle cx="5" cy="19" r="2" />
    <circle cx="12" cy="19" r="2" />
    <circle cx="19" cy="19" r="2" />
  </svg>
);

const NotificationBellIcon = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M12 3.2a5 5 0 0 0-5 5v2.1c0 .8-.2 1.6-.7 2.3l-1 1.5a1.2 1.2 0 0 0 1 1.9h11.4a1.2 1.2 0 0 0 1-1.9l-1-1.5a4.1 4.1 0 0 1-.7-2.3V8.2a5 5 0 0 0-5-5Z"
      fill="currentColor"
    />
    <path
      d="M9.4 17.4a2.6 2.6 0 0 0 5.2 0"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

export default function Navbar({ user, onLogout, onOpenMessenger, onOpenCreatePost }) {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const { unreadCount: unreadNotifications, markAllRead } = useNotifications();

  const [showMenu, setShowMenu] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ users: [], posts: [] });
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [createSearch, setCreateSearch] = useState("");
  const [comingSoonLabel, setComingSoonLabel] = useState("");

  const searchRef = useRef(null);
  const menuRef = useRef(null);
  const createMenuRef = useRef(null);
  const createMenuButtonRef = useRef(null);

  useEffect(() => {
    const close = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
      if (createMenuRef.current && !createMenuRef.current.contains(event.target)) {
        setShowCreateMenu(false);
      }
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
        setShowMenu(false);
        setComingSoonLabel("");
        if (showCreateMenu) {
          setShowCreateMenu(false);
          createMenuButtonRef.current?.focus();
        }
      }
    };

    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showCreateMenu]);

  const performSearch = useCallback(async (value) => {
    if (!value.trim()) {
      setResults({ users: [], posts: [] });
      setSearchOpen(false);
      return;
    }

    try {
      setLoading(true);

      const headers = {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      };

      const [usersResponse, postsResponse] = await Promise.all([
        fetch(`/api/users?search=${encodeURIComponent(value)}`, { headers }),
        fetch(`/api/posts?search=${encodeURIComponent(value)}`, { headers }),
      ]);

      const users = await usersResponse.json();
      const posts = await postsResponse.json();

      setResults({
        users: Array.isArray(users) ? users.slice(0, 5) : [],
        posts: Array.isArray(posts) ? posts.slice(0, 5) : [],
      });

      setSearchOpen(true);
    } catch {
      setResults({ users: [], posts: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => performSearch(query), 250);
    return () => clearTimeout(timeout);
  }, [query, performSearch]);

  const avatar = resolveImage(user?.avatar) || fallbackAvatar(user?.name);

  const openMessenger = () => {
    if (typeof onOpenMessenger === "function") {
      onOpenMessenger();
      return;
    }

    navigate("/home", { state: { openMessenger: true } });
  };

  const openPostComposer = () => {
    if (typeof onOpenCreatePost === "function") {
      onOpenCreatePost();
      return;
    }
    navigate("/home", { state: { openComposer: true } });
  };

  const createActions = [
    {
      id: "create-post",
      label: "Post",
      description: "Share an update",
      icon: "📝",
      handler: () => openPostComposer(),
    },
    {
      id: "create-story",
      label: "Story",
      description: "Share a story",
      icon: "📖",
      handler: () => setComingSoonLabel("Story"),
    },
    {
      id: "create-reel",
      label: "Reel",
      description: "Create a short video",
      icon: "🎬",
      handler: () => setComingSoonLabel("Reel"),
    },
    {
      id: "create-life-update",
      label: "Life update",
      description: "Post a life update",
      icon: "💬",
      handler: () => openPostComposer(),
    },
    {
      id: "create-page",
      label: "Page",
      description: "Create a page",
      icon: "📄",
      handler: () => setComingSoonLabel("Page"),
    },
    {
      id: "create-group",
      label: "Group",
      description: "Start a community",
      icon: "👥",
      handler: () => setComingSoonLabel("Group"),
    },
    {
      id: "create-event",
      label: "Event",
      description: "Host an event",
      icon: "📅",
      handler: () => setComingSoonLabel("Event"),
    },
    {
      id: "create-marketplace",
      label: "Marketplace listing",
      description: "Sell something",
      icon: "🛍️",
      handler: () => setComingSoonLabel("Marketplace listing"),
    },
  ];

  const menuItems = [
    {
      id: "menu-home",
      label: "Home",
      description: "Main feed",
      icon: "🏠",
      handler: () => navigate("/home"),
    },
    {
      id: "menu-trending",
      label: "Trending",
      description: "Hot posts and topics",
      icon: "🔥",
      handler: () => navigate("/trending"),
    },
    {
      id: "menu-live",
      label: "Live directory",
      description: "Watch live sessions",
      icon: "📡",
      handler: () => navigate("/live"),
    },
    {
      id: "menu-go-live",
      label: "Go live",
      description: "Start a live update",
      icon: "🎥",
      handler: () => navigate("/live/go"),
    },
    {
      id: "menu-creator",
      label: "Creator dashboard",
      description: "Manage your creator tools",
      icon: "📊",
      handler: () => navigate("/dashboard/creator"),
    },
    {
      id: "menu-notifications",
      label: "Notifications",
      description: "See updates",
      icon: "🔔",
      handler: () => navigate("/notifications"),
    },
    {
      id: "menu-messages",
      label: "Messages",
      description: "Open Messenger",
      icon: "💬",
      handler: () => openMessenger(),
    },
  ];

  const normalizeNeedle = (value) => value.trim().toLowerCase();
  const filterItems = (items) => {
    const needle = normalizeNeedle(createSearch);
    if (!needle) {
      return items;
    }
    return items.filter((item) => {
      const haystack = `${item.label} ${item.description || ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  };

  const filteredMenuItems = filterItems(menuItems);
  const filteredCreateActions = filterItems(createActions);

  const onCreateMenuItemClick = (item) => {
    item.handler?.();
    setShowCreateMenu(false);
    setCreateSearch("");
  };

  return (
    <header className="navbar" role="navigation">
      <div className="nav-left">
        <button
          className="logo-area"
          onClick={() => navigate("/home")}
          aria-label="Go home"
        >
          <img src="/tengacion_logo_64.png" className="nav-logo" alt="Tengacion" />
          <span className="brand-text">Tengacion</span>
        </button>

        {user && (
          <div className="search-box" ref={searchRef}>
            <input
              className="nav-search"
              placeholder="Search Tengacion"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search"
            />

            {searchOpen && (
              <div className="search-dropdown">
                {loading && <div className="sd-loading">Searching...</div>}

                {!loading &&
                  results.users.map((entry) => (
                    <button
                      key={entry._id}
                      className="sd-item"
                      onClick={() => {
                        navigate(`/profile/${entry.username}`);
                        setSearchOpen(false);
                      }}
                    >
                      <img
                        src={resolveImage(entry.avatar) || fallbackAvatar(entry.name)}
                        className="sd-avatar"
                        alt=""
                      />
                      <span>{entry.name}</span>
                    </button>
                  ))}

                {!loading &&
                  results.posts.map((entry) => (
                    <button
                      key={entry._id}
                      className="sd-item"
                      onClick={() => {
                        navigate(`/home`);
                        setSearchOpen(false);
                      }}
                    >
                      <span>{entry.text?.slice(0, 50) || "View post"}</span>
                    </button>
                  ))}

                {!loading &&
                  !results.users.length &&
                  !results.posts.length && (
                    <div className="sd-empty">No results found</div>
                  )}
              </div>
            )}
          </div>
        )}
      </div>

      {user && (
        <nav className="nav-center" aria-label="Main navigation">
          <button className="nav-tab" onClick={() => navigate("/home")}>
            Home
          </button>
          <button className="nav-tab" onClick={() => navigate("/trending")}>
            Trending
          </button>
          <button className="nav-tab" onClick={() => navigate("/dashboard/creator")}>
            Creator
          </button>
        </nav>
      )}

      {user && (
        <div className="nav-right">
          <div className="nav-actions-shell" aria-label="Quick actions">
            <div className="create-menu-anchor" ref={createMenuRef}>
              <button
                ref={createMenuButtonRef}
                className="nav-circle-btn"
                onClick={() =>
                  setShowCreateMenu((open) => {
                    const next = !open;
                    if (next) {
                      setCreateSearch("");
                    }
                    return next;
                  })
                }
                aria-label="Apps"
                title="Apps"
                aria-expanded={showCreateMenu}
                aria-controls="navbar-create-menu"
              >
                <GridIcon />
              </button>
              {showCreateMenu && (
                <CreateMenuDropdown
                  id="navbar-create-menu"
                  searchValue={createSearch}
                  onSearchChange={setCreateSearch}
                  leftItems={filteredMenuItems}
                  createItems={filteredCreateActions}
                  onItemClick={onCreateMenuItemClick}
                />
              )}
            </div>

            <button
              className="nav-circle-btn"
              onClick={openMessenger}
              aria-label="Messages"
              title="Messages"
            >
              <Icon name="message" size={18} />
            </button>

            <button
              className={`nav-circle-btn nav-notification-btn ${
                unreadNotifications > 0 ? "has-badge" : ""
              }`}
              onClick={() => {
                markAllRead({ optimistic: true });
                navigate("/notifications");
              }}
              aria-label="Notifications"
              title="Notifications"
            >
              <NotificationBellIcon />
              {unreadNotifications > 0 && (
                <span className="nav-badge">
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              )}
            </button>
          </div>

          <div className="avatar-wrapper" ref={menuRef}>
            <button
              className="avatar-btn nav-avatar-chip"
              onClick={() => setShowMenu((open) => !open)}
              aria-label="Account menu"
            >
              <img src={avatar} className="nav-avatar" alt="Profile" />
              <span className="nav-avatar-caret" aria-hidden="true">
                v
              </span>
            </button>

            {showMenu && (
              <div className="profile-menu">
                <button
                  className="pm-user"
                  onClick={() => navigate(`/profile/${user.username}`)}
                >
                  <img src={avatar} alt="" />
                  <div>
                    <div className="pm-name">{user.name}</div>
                    <div className="pm-view">See your profile</div>
                  </div>
                </button>

                <div className="pm-divider" />

                <button className="pm-item" onClick={toggleTheme}>
                  {isDark ? "Switch to light mode" : "Switch to dark mode"}
                </button>

                <button className="pm-item logout" onClick={onLogout}>
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {comingSoonLabel ? (
        <div className="create-coming-backdrop" onMouseDown={() => setComingSoonLabel("")}>
          <div className="create-coming-card" onMouseDown={(event) => event.stopPropagation()}>
            <h4>{comingSoonLabel}</h4>
            <p>{comingSoonLabel} creation is coming soon.</p>
            <button
              type="button"
              className="create-coming-close"
              onClick={() => setComingSoonLabel("")}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}

