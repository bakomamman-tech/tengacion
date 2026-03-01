import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";

const NAV_ITEMS = [
  {
    key: "friends",
    label: "Friends",
    path: "/friends",
    description: "People you know",
    icon: "friends",
  },
  {
    key: "dashboard",
    label: "Professional dashboard",
    path: "/dashboard",
    description: "Insights and analytics",
    icon: "dashboard",
  },
  {
    key: "memories",
    label: "Memories",
    path: "/memories",
    description: "On this day",
    icon: "memories",
  },
  {
    key: "saved",
    label: "Saved",
    path: "/saved",
    description: "Bookmarks and collections",
    icon: "saved",
  },
  {
    key: "groups",
    label: "Groups",
    path: "/groups",
    description: "Communities and clubs",
    icon: "groups",
  },
  {
    key: "events",
    label: "Events",
    path: "/events",
    description: "Upcoming activities",
    icon: "events",
  },
  {
    key: "birthdays",
    label: "Birthdays",
    path: "/birthdays",
    description: "Celebrate friends",
    icon: "birthdays",
  },
  {
    key: "ads-manager",
    label: "Ads Manager",
    path: "/ads-manager",
    description: "Campaign tools",
    icon: "ads",
  },
];

function QuickNavIcon({ name }) {
  switch (name) {
    case "friends":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="9" cy="8" r="3" />
          <circle cx="16" cy="9" r="2.7" />
          <path d="M3.8 18.8a5.3 5.3 0 0 1 10.4 0v.6H3.8z" />
          <path d="M13.4 19.4c.2-2 1.6-3.6 3.8-3.8 1.8-.2 3 1 3 2.8v1h-6.8z" />
        </svg>
      );
    case "dashboard":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="4" />
          <rect x="6.5" y="13" width="2.8" height="4.5" rx="1" fill="currentColor" />
          <rect x="10.6" y="9.8" width="2.8" height="7.7" rx="1" fill="currentColor" />
          <rect x="14.7" y="6.7" width="2.8" height="10.8" rx="1" fill="currentColor" />
        </svg>
      );
    case "memories":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.2v5.2l3.6 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "saved":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-3.8L5 21V4.5a1 1 0 0 1 1-1z" />
        </svg>
      );
    case "groups":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="8" cy="10" r="3" />
          <circle cx="16" cy="10" r="3" />
          <path d="M2.8 20a5.1 5.1 0 0 1 10.4 0z" />
          <path d="M10.8 20a5.1 5.1 0 0 1 10.4 0z" />
        </svg>
      );
    case "events":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <rect x="3" y="8.5" width="18" height="2.2" fill="currentColor" />
          <rect x="7" y="12.6" width="4" height="4" rx="1" fill="currentColor" />
          <rect x="13" y="12.6" width="4" height="4" rx="1" fill="currentColor" />
        </svg>
      );
    case "birthdays":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="10" width="16" height="10" rx="2" />
          <rect x="4" y="8" width="16" height="3" rx="1.2" />
          <path d="M12 8v12" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 8c-1.8-.2-3-.9-3-2.2a2 2 0 0 1 3.4-1.3L12 5" />
          <path d="M12 8c1.8-.2 3-.9 3-2.2a2 2 0 0 0-3.4-1.3L12 5" />
        </svg>
      );
    case "ads":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 14h4l8-5v10l-8-5H4z" />
          <path d="M8 14.2l1.5 4.3h3.3l-1.9-5.4" />
        </svg>
      );
    default:
      return null;
  }
}

function QuickNavList({ items, expanded, onToggleExpand, onNavigate }) {
  const visibleItems = expanded ? items : items.slice(0, 5);
  const canExpand = items.length > 5;

  return (
    <>
      <div className="quick-nav-items">
        {visibleItems.map((item) => (
          <NavLink
            key={item.key}
            to={item.path}
            className={({ isActive }) =>
              `quick-nav-item${isActive ? " active" : ""}`
            }
            onClick={onNavigate}
          >
            <span className="quick-nav-item-icon" aria-hidden="true">
              <QuickNavIcon name={item.icon} />
            </span>
            <span className="quick-nav-item-copy">
              <b>{item.label}</b>
              <small>{item.description}</small>
            </span>
          </NavLink>
        ))}
      </div>
      {canExpand && (
        <button
          type="button"
          className="quick-nav-more"
          onClick={onToggleExpand}
          aria-expanded={expanded}
        >
          {expanded ? "See less" : "See more"}
        </button>
      )}
    </>
  );
}

export default function RightQuickNav() {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return NAV_ITEMS;
    }
    return NAV_ITEMS.filter((item) => {
      const haystack = `${item.label} ${item.description}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [query]);

  useEffect(() => {
    if (!drawerOpen) {
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) {
      return undefined;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [drawerOpen]);

  return (
    <>
      <aside className="card quick-nav-panel" aria-label="Quick Access">
        <div className="quick-nav-head">
          <h3>Quick Access</h3>
          <p>Explore</p>
        </div>
        <label className="quick-nav-search-wrap">
          <span className="sr-only">Search quick access</span>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setExpanded(true);
            }}
            placeholder="Search quick access"
            className="quick-nav-search"
          />
        </label>
        <QuickNavList
          items={filteredItems}
          expanded={expanded}
          onToggleExpand={() => setExpanded((value) => !value)}
          onNavigate={() => {
            setQuery("");
            setExpanded(false);
          }}
        />
      </aside>

      <button
        type="button"
        className="quick-nav-fab"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open quick access"
        title="Quick Access"
      >
        <QuickNavIcon name="dashboard" />
      </button>

      {drawerOpen && (
        <div className="quick-nav-drawer-backdrop" onMouseDown={() => setDrawerOpen(false)}>
          <aside
            className="quick-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Quick Access menu"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="quick-nav-drawer-head">
              <strong>Quick Access</strong>
              <button
                type="button"
                className="quick-nav-drawer-close"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close quick access"
              >
                <span className="icon-glyph-center">X</span>
              </button>
            </div>
            <label className="quick-nav-search-wrap">
              <span className="sr-only">Search quick access</span>
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setExpanded(true);
                }}
                placeholder="Search quick access"
                className="quick-nav-search"
              />
            </label>
            <QuickNavList
              items={filteredItems}
              expanded
              onToggleExpand={() => {}}
              onNavigate={() => {
                setDrawerOpen(false);
                setQuery("");
                setExpanded(false);
              }}
            />
          </aside>
        </div>
      )}
    </>
  );
}
