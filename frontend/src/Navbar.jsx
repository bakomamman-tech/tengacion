import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { resolveImage, searchGlobal } from "./api";
import CreateMenuDropdown from "./components/CreateMenuDropdown";
import NotificationsDropdown from "./components/NotificationsDropdown";
import { Icon } from "./Icon";
import { useAuth } from "./context/AuthContext";
import { useNotifications } from "./context/NotificationsContext";
import { useTheme } from "./context/ThemeContext";
import { getNotificationTarget } from "./notificationUtils";

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

const ChevronRightIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="M7.5 4.8 12.7 10l-5.2 5.2" />
  </svg>
);

const BackIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="M11.8 4.8 6.6 10l5.2 5.2" />
  </svg>
);

function glyphFor(item) {
  if (item.glyph) {
    return item.glyph;
  }
  return String(item.label || "?")
    .split(" ")
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function AccountMenuRow({ item, onClick }) {
  return (
    <button
      type="button"
      className={`pm-nav-item ${item.danger ? "logout" : ""}`}
      onClick={onClick}
    >
      <span className="pm-nav-item-icon" aria-hidden="true">
        <span className="pm-nav-item-icon-text">{glyphFor(item)}</span>
      </span>
      <span className="pm-nav-item-copy">
        <strong>{item.label}</strong>
        {item.description ? <small>{item.description}</small> : null}
      </span>
      {item.badge ? <span className="pm-nav-item-badge">{item.badge}</span> : null}
      {item.showChevron ? (
        <span className="pm-nav-item-chevron" aria-hidden="true">
          <ChevronRightIcon />
        </span>
      ) : null}
    </button>
  );
}

export default function Navbar({
  user,
  onLogout,
  onOpenMessenger,
  onOpenCreatePost,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { logout: authLogout } = useAuth();
  const {
    notifications,
    unreadCount: unreadNotifications,
    loading: notificationsLoading,
    error: notificationsError,
    fetchNotifications,
    markAllRead,
    markOneRead,
  } = useNotifications();

  const [showMenu, setShowMenu] = useState(false);
  const [menuView, setMenuView] = useState("root");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ users: [], posts: [] });
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
  const [createSearch, setCreateSearch] = useState("");

  const searchRef = useRef(null);
  const menuRef = useRef(null);
  const createMenuRef = useRef(null);
  const createMenuButtonRef = useRef(null);
  const notificationMenuRef = useRef(null);
  const notificationButtonRef = useRef(null);

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
      if (
        notificationMenuRef.current &&
        !notificationMenuRef.current.contains(event.target)
      ) {
        setShowNotificationsMenu(false);
      }
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
        setShowMenu(false);
        setMenuView("root");
        if (showNotificationsMenu) {
          setShowNotificationsMenu(false);
          notificationButtonRef.current?.focus();
        }
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
  }, [showCreateMenu, showNotificationsMenu]);

  useEffect(() => {
    setShowMenu(false);
    setMenuView("root");
    setSearchOpen(false);
    setShowCreateMenu(false);
    setShowNotificationsMenu(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!showMenu) {
      setMenuView("root");
    }
  }, [showMenu]);

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

  const closeAccountMenu = () => {
    setShowMenu(false);
    setMenuView("root");
  };

  const openAccountRoute = (target) => {
    closeAccountMenu();
    navigate(target);
  };

  const handleLogout = () => {
    closeAccountMenu();
    authLogout({ remote: true });
    if (typeof onLogout === "function") {
      onLogout();
      return;
    }
    navigate("/");
  };

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

  const toggleNotificationsMenu = () => {
    setShowMenu(false);
    setMenuView("root");
    setShowCreateMenu(false);
    setSearchOpen(false);
    setShowNotificationsMenu((open) => {
      const next = !open;
      if (next) {
        fetchNotifications({ page: 1, limit: 40 });
      }
      return next;
    });
  };

  const openNotificationsPage = () => {
    setShowNotificationsMenu(false);
    navigate("/notifications");
  };

  const openNotificationSettings = () => {
    setShowNotificationsMenu(false);
    navigate("/settings/notifications");
  };

  const handleNotificationClick = async (item) => {
    await markOneRead(item._id);
    setShowNotificationsMenu(false);
    const target = getNotificationTarget(item);
    if (target?.state) {
      navigate(target.path, { state: target.state });
      return;
    }
    navigate(target?.path || "/notifications");
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

  const currentMode = theme === "dark" ? "Dark mode is on" : "Light mode is on";
  const accountMenuPanels = {
    root: {
      items: [
        {
          id: "account-settings",
          label: "Settings & privacy",
          description: "Privacy controls, security, notifications, and account shortcuts.",
          glyph: "SP",
          view: "settings",
          showChevron: true,
        },
        {
          id: "account-help",
          label: "Help & support",
          description: "Support resources, policies, and ways to report an issue.",
          glyph: "HS",
          view: "help",
          showChevron: true,
        },
        {
          id: "account-display",
          label: "Display & accessibility",
          description: `${currentMode}. Review appearance and accessibility options.`,
          glyph: "DA",
          view: "display",
          showChevron: true,
        },
        {
          id: "account-feedback",
          label: "Give feedback",
          description: "Report a bug, suggest a feature, or share general feedback.",
          glyph: "GF",
          view: "feedback",
          showChevron: true,
        },
        ...(canOpenAdmin
          ? [
              {
                id: "account-admin",
                label: "Admin panel",
                description: "Open moderation, analytics, and platform controls.",
                glyph: "AP",
                path: "/admin",
              },
            ]
          : []),
      ],
    },
    settings: {
      title: "Settings & privacy",
      description: "Open the account areas users expect to find in the menu.",
      items: [
        {
          id: "settings-home",
          label: "Settings center",
          description: "View your account overview and recommended next steps.",
          glyph: "SC",
          path: "/settings",
        },
        {
          id: "settings-privacy",
          label: "Privacy settings",
          description: "Control visibility, posting audience, and messaging access.",
          glyph: "PR",
          path: "/settings/privacy",
        },
        {
          id: "settings-security",
          label: "Security settings",
          description: "Manage password changes, email verification, and sessions.",
          glyph: "SE",
          path: "/settings/security",
        },
        {
          id: "settings-notifications",
          label: "Notification settings",
          description: "Choose which alerts should appear in your account.",
          glyph: "NO",
          path: "/settings/notifications",
        },
      ],
    },
    help: {
      title: "Help & support",
      description: "Policies, help destinations, and support paths.",
      items: [
        {
          id: "help-home",
          label: "Help center",
          description: "Read support guidance for account, content, and messaging issues.",
          glyph: "HC",
          path: "/help-support",
        },
        {
          id: "help-guidelines",
          label: "Community guidelines",
          description: "Review platform rules and moderation expectations.",
          glyph: "CG",
          path: "/community-guidelines",
        },
        {
          id: "help-privacy",
          label: "Privacy policy",
          description: "Learn how user data and account requests are handled.",
          glyph: "PP",
          path: "/privacy",
        },
        {
          id: "help-terms",
          label: "Terms",
          description: "Read terms covering account ownership and disputes.",
          glyph: "TM",
          path: "/terms",
        },
        {
          id: "help-bug",
          label: "Report a problem",
          description: "Open the feedback page with the bug-report flow selected.",
          glyph: "RP",
          path: "/feedback?type=bug",
        },
      ],
    },
    display: {
      title: "Display & accessibility",
      description: "Appearance controls and accessibility guidance.",
      items: [
        {
          id: "display-dark",
          label: "Dark mode",
          description: "Use darker surfaces and softer glare for low-light browsing.",
          glyph: "DM",
          badge: theme === "dark" ? "On" : "Off",
          onClick: () => setTheme("dark"),
        },
        {
          id: "display-light",
          label: "Light mode",
          description: "Use brighter surfaces for a lighter daytime experience.",
          glyph: "LM",
          badge: theme === "light" ? "On" : "Off",
          onClick: () => setTheme("light"),
        },
        {
          id: "display-center",
          label: "Display center",
          description: "Open the full page for appearance and accessibility information.",
          glyph: "DC",
          path: "/settings/display",
        },
      ],
    },
    feedback: {
      title: "Give feedback",
      description: "Collect feedback flows directly from the account menu.",
      items: [
        {
          id: "feedback-home",
          label: "Feedback center",
          description: "Open the main feedback page for general comments.",
          glyph: "FC",
          path: "/feedback",
        },
        {
          id: "feedback-bug",
          label: "Report a problem",
          description: "Open the feedback page with the bug type selected.",
          glyph: "RP",
          path: "/feedback?type=bug",
        },
        {
          id: "feedback-idea",
          label: "Suggest a feature",
          description: "Send an improvement idea or product request.",
          glyph: "SF",
          path: "/feedback?type=idea",
        },
        {
          id: "feedback-safety",
          label: "Safety feedback",
          description: "Open a safety-focused feedback form for sensitive issues.",
          glyph: "SA",
          path: "/feedback?type=safety",
        },
      ],
    },
  };

  const activeMenuPanel = accountMenuPanels[menuView] || accountMenuPanels.root;

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

  const onAccountMenuItemClick = (item) => {
    if (item.view) {
      setMenuView(item.view);
      return;
    }
    if (item.path) {
      openAccountRoute(item.path);
      return;
    }
    item.onClick?.();
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
                        navigate("/home");
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

            <div className="nav-notification-anchor" ref={notificationMenuRef}>
              <button
                ref={notificationButtonRef}
                className={`nav-circle-btn nav-notification-btn ${
                  unreadNotifications > 0 ? "has-badge" : ""
                }`}
                onClick={toggleNotificationsMenu}
                aria-label="Notifications"
                title="Notifications"
                aria-expanded={showNotificationsMenu}
                aria-controls="navbar-notifications-menu"
              >
                <NotificationBellIcon />
                {unreadNotifications > 0 && (
                  <span className="nav-badge">
                    {unreadNotifications > 99 ? "99+" : unreadNotifications}
                  </span>
                )}
              </button>

              {showNotificationsMenu && (
                <NotificationsDropdown
                  id="navbar-notifications-menu"
                  notifications={notifications}
                  unreadCount={unreadNotifications}
                  loading={notificationsLoading}
                  error={notificationsError}
                  onMarkAllRead={() => markAllRead({ optimistic: true })}
                  onNotificationClick={handleNotificationClick}
                  onOpenSettings={openNotificationSettings}
                  onOpenAll={openNotificationsPage}
                />
              )}
            </div>
          </div>

          <div className="avatar-wrapper" ref={menuRef}>
            <button
              className="avatar-btn nav-avatar-chip"
              onClick={() => {
                setShowMenu((open) => {
                  const next = !open;
                  if (!next) {
                    setMenuView("root");
                  }
                  return next;
                });
              }}
              aria-label="Account menu"
              aria-expanded={showMenu}
              aria-controls="navbar-account-menu"
            >
              <img src={avatar} className="nav-avatar" alt="Profile" />
              <span className="nav-avatar-caret" aria-hidden="true">
                v
              </span>
            </button>

            {showMenu && (
              <div className="profile-menu" id="navbar-account-menu">
                {menuView === "root" ? (
                  <>
                    <button
                      type="button"
                      className="pm-user pm-user-card"
                      onClick={() => openAccountRoute(`/profile/${user.username}`)}
                    >
                      <img src={avatar} alt="" />
                      <div>
                        <div className="pm-name">{user.name}</div>
                        <div className="pm-view">See your profile</div>
                      </div>
                    </button>

                    <div className="pm-divider" />

                    <div className="pm-menu-list">
                      {accountMenuPanels.root.items.map((item) => (
                        <AccountMenuRow
                          key={item.id}
                          item={item}
                          onClick={() => onAccountMenuItemClick(item)}
                        />
                      ))}
                    </div>

                    <div className="pm-divider" />

                    <button
                      type="button"
                      className="pm-item logout"
                      onClick={handleLogout}
                    >
                      Log out
                    </button>
                  </>
                ) : (
                  <>
                    <div className="pm-panel-head">
                      <button
                        type="button"
                        className="pm-panel-back"
                        onClick={() => setMenuView("root")}
                        aria-label="Back to account menu"
                      >
                        <BackIcon />
                      </button>
                      <div className="pm-panel-title">
                        <strong>{activeMenuPanel.title}</strong>
                        {activeMenuPanel.description ? (
                          <span>{activeMenuPanel.description}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="pm-divider" />

                    <div className="pm-menu-list">
                      {activeMenuPanel.items.map((item) => (
                        <AccountMenuRow
                          key={item.id}
                          item={item}
                          onClick={() => onAccountMenuItemClick(item)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
