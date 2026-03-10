import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { resolveImage, searchGlobal } from "./api";
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
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const { unreadCount: unreadNotifications, markAllRead } = useNotifications();

  const [showMenu, setShowMenu] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ users: [], posts: [] });
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [createSearch, setCreateSearch] = useState("");

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

      const [usersPayload, postsPayload] = await Promise.all([
        searchGlobal({ q: value, type: "users" }),
        searchGlobal({ q: value, type: "posts" }),
      ]);
      const users = usersPayload?.data || [];
      const posts = postsPayload?.data || [];

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
  const role = String(user?.role || "").toLowerCase();
  const canOpenAdmin = role === "admin" || role === "super_admin";

  const openMessenger = () => {
    if (typeof onOpenMessenger === "function") {
      onOpenMessenger();
      return;
    }

    navigate("/home", { state: { openMessenger: true } });
  };

  const openCreateFlow = (flow = "post") => {
    if (flow === "story") {
      if (typeof onOpenCreatePost === "function") {
        onOpenCreatePost("story");
        return;
      }
      navigate("/home", { state: { openStoryCreator: true } });
      return;
    }

    if (flow === "reel") {
      if (typeof onOpenCreatePost === "function") {
        onOpenCreatePost("reel");
        return;
      }
      navigate("/home", { state: { openComposer: true, composerMode: "reel" } });
      return;
    }

    if (typeof onOpenCreatePost === "function") {
      onOpenCreatePost("post");
      return;
    }
    navigate("/home", { state: { openComposer: true, composerMode: "" } });
  };

  const menuSections = [
    {
      id: "professional",
      title: "Professional",
      items: [
        {
          id: "menu-ads",
          label: "Ads Manager",
          description: "Create, manage, and monitor Tengacion campaigns.",
          icon: "ads",
          handler: () => navigate("/ads-manager"),
        },
        {
          id: "menu-creator",
          label: "Creator dashboard",
          description: "Manage publishing tools, uploads, and creator growth.",
          icon: "creator",
          handler: () => navigate("/dashboard/creator"),
        },
        {
          id: "menu-professional-dashboard",
          label: "Professional dashboard",
          description: "Track audience growth, reach, and performance.",
          icon: "dashboard",
          handler: () => navigate("/dashboard"),
        },
        {
          id: "menu-go-live",
          label: "Go live",
          description: "Start a live session and stream to your audience.",
          icon: "broadcast",
          handler: () => navigate("/live/go"),
        },
      ],
    },
    {
      id: "social",
      title: "Social",
      items: [
        {
          id: "menu-friends",
          label: "Friends",
          description: "See your connections and discover people you may know.",
          icon: "friends",
          handler: () => navigate("/friends"),
        },
        {
          id: "menu-groups",
          label: "Groups",
          description: "Jump back into your creative communities.",
          icon: "groups",
          handler: () => navigate("/groups"),
        },
        {
          id: "menu-events",
          label: "Events",
          description: "View upcoming sessions, meetups, and launches.",
          icon: "events",
          handler: () => navigate("/events"),
        },
        {
          id: "menu-birthdays",
          label: "Birthdays",
          description: "Celebrate friends and keep up with reminders.",
          icon: "birthdays",
          handler: () => navigate("/birthdays"),
        },
      ],
    },
    {
      id: "discover",
      title: "Discover",
      items: [
        {
          id: "menu-home",
          label: "Home",
          description: "Return to your main Tengacion feed.",
          icon: "home",
          handler: () => navigate("/home"),
        },
        {
          id: "menu-trending",
          label: "Trending",
          description: "See hot posts, creators, and conversations.",
          icon: "trending",
          handler: () => navigate("/trending"),
        },
        {
          id: "menu-reels",
          label: "Reels",
          description: "Watch short-form video highlights.",
          icon: "reels",
          handler: () => navigate("/reels"),
        },
        {
          id: "menu-live",
          label: "Live directory",
          description: "Browse active live sessions across Tengacion.",
          icon: "live",
          handler: () => navigate("/live"),
        },
        {
          id: "menu-gaming",
          label: "Gaming",
          description: "Explore gaming and interactive content.",
          icon: "gaming",
          handler: () => navigate("/gaming"),
        },
        {
          id: "menu-saved",
          label: "Saved",
          description: "Open your saved posts, videos, and links.",
          icon: "saved",
          handler: () => navigate("/saved"),
        },
      ],
    },
    {
      id: "account",
      title: "Settings",
      items: [
        {
          id: "menu-notifications",
          label: "Notifications",
          description: "Review the latest updates from across the app.",
          icon: "notifications",
          handler: () => navigate("/notifications"),
        },
        {
          id: "menu-messages",
          label: "Messages",
          description: "Open your Messenger conversations.",
          icon: "messages",
          handler: () => openMessenger(),
        },
        {
          id: "menu-rooms",
          label: "Rooms",
          description: "Join or browse the rooms experience.",
          icon: "rooms",
          handler: () => navigate("/rooms"),
        },
        {
          id: "menu-security",
          label: "Security settings",
          description: "Manage password, sessions, and account protection.",
          icon: "security",
          handler: () => navigate("/settings/security"),
        },
        {
          id: "menu-privacy",
          label: "Privacy settings",
          description: "Control visibility and communication preferences.",
          icon: "privacy",
          handler: () => navigate("/settings/privacy"),
        },
      ],
    },
  ];

  const createActions = [
    {
      id: "create-post",
      label: "Post",
      description: "Share an update to your feed.",
      icon: "post",
      handler: () => openCreateFlow("post"),
    },
    {
      id: "create-story",
      label: "Story",
      description: "Share a quick visual update.",
      icon: "story",
      handler: () => openCreateFlow("story"),
    },
    {
      id: "create-reel",
      label: "Reel",
      description: "Create a short-form video post.",
      icon: "reel-create",
      handler: () => openCreateFlow("reel"),
    },
    {
      id: "create-live",
      label: "Live session",
      description: "Broadcast to your audience in real time.",
      icon: "broadcast",
      handler: () => navigate("/live/go"),
    },
    {
      id: "create-group",
      label: "Group",
      description: "Start or manage a community.",
      icon: "groups",
      handler: () => navigate("/groups"),
    },
    {
      id: "create-event",
      label: "Event",
      description: "Plan and publish an upcoming activity.",
      icon: "events",
      handler: () => navigate("/events"),
    },
    {
      id: "create-ad",
      label: "Ad campaign",
      description: "Launch a promotional campaign.",
      icon: "ads",
      handler: () => navigate("/ads-manager"),
    },
    {
      id: "create-dashboard",
      label: "Creator dashboard",
      description: "Open creator tools and publishing controls.",
      icon: "dashboard",
      handler: () => navigate("/dashboard/creator"),
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

  const filteredMenuSections = menuSections
    .map((section) => ({ ...section, items: filterItems(section.items) }))
    .filter((section) => section.items.length > 0);
  const filteredCreateActions = filterItems(createActions);

  const navTabs = [
    { id: "home", label: "Home", path: "/home" },
    { id: "trending", label: "Trending", path: "/trending" },
    { id: "creator", label: "Creator", path: "/dashboard/creator" },
    { id: "gaming", label: "Gaming", path: "/gaming" },
    { id: "reels", label: "Reels", path: "/reels" },
  ];

  const isNavTabActive = (tab, isActive) => {
    if (isActive) {
      return true;
    }
    if (tab.id === "creator") {
      return location.pathname === "/creator";
    }
    return false;
  };

  const onCreateMenuItemClick = (item) => {
    item.handler?.();
    setShowCreateMenu(false);
    setCreateSearch("");
  };

  return (
    <header className="navbar topNavRow" role="navigation">
      <div className="nav-left topNavLeft">
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
        <nav className="nav-center topNavCenter" aria-label="Main navigation">
          <div className="nav-pill-group pillGroup">
            {navTabs.map((tab) => (
              <NavLink
                key={tab.id}
                to={tab.path}
                end
                aria-label={`${tab.label} page`}
                className={({ isActive }) =>
                  `nav-tab pillLink ${isNavTabActive(tab, isActive) ? "active" : ""}`
                }
                onKeyDown={(event) => {
                  if (event.key === " ") {
                    event.preventDefault();
                    event.currentTarget.click();
                  }
                }}
              >
                {tab.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}

      {user && (
        <div className="nav-right topNavRight">
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
                aria-label="Menu"
                title="Menu"
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
                  menuSections={filteredMenuSections}
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

                {canOpenAdmin ? (
                  <button className="pm-item" onClick={() => navigate("/admin")}>
                    Admin panel
                  </button>
                ) : null}

                <button className="pm-item logout" onClick={onLogout}>
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </header>
  );
}


