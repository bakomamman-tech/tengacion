import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getChatContacts, resolveImage } from "../api";
import { DEFAULT_SHARE_GROUPS } from "./share/postShareUtils";

const COMMUNITY_ENTRIES = [
  {
    id: "creator-circle",
    name: "Creator Circle",
    note: "Tips, collaborations, and weekly prompts",
    kind: "Community",
  },
  {
    id: "campus-connect",
    name: "Campus Connect",
    note: "Student meetups and local conversations",
    kind: "Community",
  },
  {
    id: "voice-coaches",
    name: "Voice Coaches",
    note: "Warmups, rehearsals, and feedback rooms",
    kind: "Community",
  },
];

const FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "groups", label: "Groups" },
  { id: "communities", label: "Communities" },
];

const fallbackAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "Friend"
  )}&size=96&background=E3EFE7&color=1B5838`;

const formatRelativeTime = (value) => {
  const timestamp = Number(value) || 0;
  if (!timestamp) {
    return "";
  }

  const diff = Date.now() - timestamp;
  if (diff <= 0) {
    return "now";
  }

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < hour) {
    return `${Math.max(1, Math.round(diff / minute))}m`;
  }
  if (diff < day) {
    return `${Math.max(1, Math.round(diff / hour))}h`;
  }
  if (diff < day * 7) {
    return `${Math.max(1, Math.round(diff / day))}d`;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
};

const normalizeDirectoryRows = (rows = [], kind = "Group") =>
  rows.map((entry) => ({
    id: String(entry?.id || "").trim(),
    name: String(entry?.name || kind).trim(),
    note: String(entry?.note || `Open ${kind.toLowerCase()}`).trim(),
    kind,
  }));

const searchDirectoryRows = (rows = [], searchValue = "") => {
  const query = searchValue.trim().toLowerCase();
  if (!query) {
    return rows;
  }

  return rows.filter((entry) =>
    [entry?.name, entry?.note, entry?.kind].some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(query)
    )
  );
};

const getContactSnippet = (contact, composeMode) => {
  if (composeMode) {
    if (contact?.online) {
      return "Active now";
    }
    if (contact?.status?.text) {
      return String(contact.status.text);
    }
    if (contact?.username) {
      return `@${contact.username}`;
    }
    return "Start a new chat";
  }

  if (contact?.lastMessage) {
    return String(contact.lastMessage);
  }
  if (contact?.online) {
    return "Active now";
  }
  if (contact?.status?.text) {
    return String(contact.status.text);
  }
  return "Start chatting";
};

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 4a6 6 0 1 0 3.89 10.57l4.27 4.27 1.41-1.41-4.27-4.27A6 6 0 0 0 10 4zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="18" cy="12" r="1.8" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4H4v3h2V6h1zM18 4h-3v2h1v1h2zM6 17H4v3h3v-2H6zM18 18h-1v2h3v-3h-2z" />
      <path d="M8 8h8v8H8z" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ComposeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16.86 3.49a2 2 0 0 1 2.83 2.83L9.32 16.69 5 18l1.31-4.32z" />
      <path d="M13 5l6 6" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export default function MessengerInboxDropdown({
  id = "navbar-messenger-menu",
  onSelectContact,
  onOpenInbox,
}) {
  const navigate = useNavigate();
  const searchInputRef = useRef(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [composeMode, setComposeMode] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [activeOptionsId, setActiveOptionsId] = useState("");

  const loadContacts = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getChatContacts();
      setContacts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || "Failed to load chats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    if (!composeMode) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 20);

    return () => window.clearTimeout(timeoutId);
  }, [composeMode]);

  useEffect(() => {
    const closeMenus = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (!target.closest(".nav-messenger-head-actions")) {
        setShowActionsMenu(false);
      }
      if (!target.closest(".nav-messenger-item-controls")) {
        setActiveOptionsId("");
      }
    };

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setShowActionsMenu(false);
        setActiveOptionsId("");
      }
    };

    document.addEventListener("pointerdown", closeMenus);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenus);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const unreadTotal = useMemo(
    () => contacts.reduce((sum, contact) => sum + (Number(contact?.unreadCount) || 0), 0),
    [contacts]
  );

  const directoryRows = useMemo(() => {
    if (activeTab === "groups") {
      return searchDirectoryRows(normalizeDirectoryRows(DEFAULT_SHARE_GROUPS, "Group"), search);
    }
    if (activeTab === "communities") {
      return searchDirectoryRows(COMMUNITY_ENTRIES, search);
    }
    return [];
  }, [activeTab, search]);

  const filteredContacts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const visible = contacts.filter((contact) => {
      if (!query) {
        return true;
      }
      return [
        contact?.name,
        contact?.username,
        contact?.lastMessage,
        contact?.status?.text,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query)
      );
    });

    const next =
      activeTab === "unread"
        ? visible.filter((contact) => (Number(contact?.unreadCount) || 0) > 0)
        : visible;

    if (composeMode) {
      return [...next].sort((a, b) =>
        String(a?.name || a?.username || "").localeCompare(String(b?.name || b?.username || ""))
      );
    }

    return next;
  }, [activeTab, composeMode, contacts, search]);

  const isDirectoryView = activeTab === "groups" || activeTab === "communities";

  const openContact = (contact) => {
    setComposeMode(false);
    setActiveOptionsId("");
    setShowActionsMenu(false);
    if (typeof onSelectContact === "function") {
      onSelectContact(contact);
    }
  };

  const openInbox = () => {
    setComposeMode(false);
    setActiveOptionsId("");
    setShowActionsMenu(false);
    if (typeof onOpenInbox === "function") {
      onOpenInbox();
    }
  };

  const openCompose = () => {
    setComposeMode(true);
    setActiveTab("all");
    setSearch("");
    setShowActionsMenu(false);
    setActiveOptionsId("");
  };

  const openProfile = (contact) => {
    setActiveOptionsId("");
    setShowActionsMenu(false);
    const username = String(contact?.username || "").trim();
    if (username) {
      navigate(`/profile/${username}`);
      return;
    }
    openContact(contact);
  };

  const openDirectoryEntry = (entry) => {
    setComposeMode(false);
    setActiveOptionsId("");
    setShowActionsMenu(false);
    navigate("/groups", {
      state: {
        messengerDirectoryTab: activeTab,
        focusGroupId: entry?.id || "",
      },
    });
  };

  const handleFilterChange = (filterId) => {
    setComposeMode(false);
    setShowActionsMenu(false);
    setActiveOptionsId("");
    setActiveTab(filterId);
  };

  const searchPlaceholder = composeMode
    ? "Search people"
    : activeTab === "groups"
      ? "Search groups"
      : activeTab === "communities"
        ? "Search communities"
        : "Search Messenger";

  return (
    <div className="nav-messenger-dropdown" id={id} role="dialog" aria-label="Messenger inbox">
      <div className="nav-messenger-top">
        <div className="nav-messenger-title-block">
          <h3>Chats</h3>
          {composeMode ? <p>Select a friend to start a new conversation.</p> : null}
        </div>

        <div className="nav-messenger-head-actions">
          <div className="nav-messenger-head-actions-wrap">
            <button
              type="button"
              className="nav-messenger-icon-btn"
              aria-label="Chat actions"
              title="Chat actions"
              aria-expanded={showActionsMenu}
              onClick={() => {
                setActiveOptionsId("");
                setShowActionsMenu((open) => !open);
              }}
            >
              <MoreIcon />
            </button>
            {showActionsMenu ? (
              <div className="nav-messenger-actions-menu" role="menu" aria-label="Messenger actions">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setShowActionsMenu(false);
                    void loadContacts();
                  }}
                >
                  Refresh chats
                </button>
                <button type="button" role="menuitem" onClick={openInbox}>
                  Open full Messenger
                </button>
                <button type="button" role="menuitem" onClick={() => handleFilterChange("groups")}>
                  Show groups
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleFilterChange("communities")}
                >
                  Show communities
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className="nav-messenger-icon-btn"
            aria-label="Open full Messenger"
            title="Open full Messenger"
            onClick={openInbox}
          >
            <ExpandIcon />
          </button>

          <button
            type="button"
            className="nav-messenger-icon-btn"
            aria-label="New message"
            title="New message"
            onClick={openCompose}
          >
            <ComposeIcon />
          </button>
        </div>
      </div>

      <label className="nav-messenger-search">
        <SearchIcon />
        <input
          ref={searchInputRef}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={searchPlaceholder}
        />
      </label>

      <div className="nav-messenger-filters" role="tablist" aria-label="Messenger filters">
        {FILTERS.map((filter) => {
          const isActive = !composeMode && activeTab === filter.id;
          const count = filter.id === "unread" ? unreadTotal : 0;
          return (
            <button
              key={filter.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`nav-messenger-filter${isActive ? " active" : ""}`}
              onClick={() => handleFilterChange(filter.id)}
            >
              <span>{filter.label}</span>
              {count > 0 ? <small>{count}</small> : null}
            </button>
          );
        })}
      </div>

      {composeMode ? (
        <div className="nav-messenger-compose-note">
          Search your friends and tap a name to start a chat immediately.
        </div>
      ) : null}

      <div className="nav-messenger-list">
        {loading ? <div className="nav-messenger-state">Loading chats...</div> : null}

        {!loading && error ? <div className="nav-messenger-state">{error}</div> : null}

        {!loading && !error && isDirectoryView && directoryRows.length === 0 ? (
          <div className="nav-messenger-state">No matches for this filter yet.</div>
        ) : null}

        {!loading && !error && isDirectoryView
          ? directoryRows.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="nav-messenger-directory-item"
                onClick={() => openDirectoryEntry(entry)}
              >
                <div className="nav-messenger-directory-avatar" aria-hidden="true">
                  {String(entry?.name || "?").trim().charAt(0).toUpperCase()}
                </div>
                <div className="nav-messenger-directory-copy">
                  <strong>{entry.name}</strong>
                  <span>{entry.kind}</span>
                  <p>{entry.note}</p>
                </div>
                <span className="nav-messenger-directory-cta">Open</span>
              </button>
            ))
          : null}

        {!loading && !error && !isDirectoryView && filteredContacts.length === 0 ? (
          <div className="nav-messenger-state">
            {composeMode ? "No friends match that search yet." : "No chats found yet."}
          </div>
        ) : null}

        {!loading && !error && !isDirectoryView
          ? filteredContacts.map((contact) => {
              const contactId = String(contact?._id || "");
              const unreadCount = Number(contact?.unreadCount) || 0;
              const menuOpen = activeOptionsId === contactId;
              const timeLabel = composeMode ? "" : formatRelativeTime(contact?.lastMessageAt);

              return (
                <article
                  className={`nav-messenger-item${unreadCount > 0 ? " has-unread" : ""}`}
                  key={contactId}
                >
                  <button
                    type="button"
                    className="nav-messenger-item-main"
                    onClick={() => openContact(contact)}
                  >
                    <div className="nav-messenger-avatar-wrap">
                      <img
                        src={resolveImage(contact?.avatar) || fallbackAvatar(contact?.name)}
                        alt=""
                        className="nav-messenger-avatar"
                      />
                      {contact?.online ? <span className="nav-messenger-online-dot" /> : null}
                    </div>

                    <div className="nav-messenger-copy">
                      <div className="nav-messenger-row">
                        <strong>{contact?.name || contact?.username || "Friend"}</strong>
                        {timeLabel ? <span>{timeLabel}</span> : null}
                      </div>
                      <div className="nav-messenger-preview-row">
                        <p>{getContactSnippet(contact, composeMode)}</p>
                        {unreadCount > 0 && !composeMode ? (
                          <span className="nav-messenger-unread-badge">
                            {unreadCount > 9 ? "9+" : unreadCount}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>

                  <div className="nav-messenger-item-controls">
                    <button
                      type="button"
                      className="nav-messenger-item-more"
                      aria-label={`More options for ${
                        contact?.name || contact?.username || "this conversation"
                      }`}
                      aria-expanded={menuOpen}
                      onClick={(event) => {
                        event.stopPropagation();
                        setShowActionsMenu(false);
                        setActiveOptionsId((current) => (current === contactId ? "" : contactId));
                      }}
                    >
                      <MoreIcon />
                    </button>

                    {menuOpen ? (
                      <div className="nav-messenger-item-menu" role="menu">
                        <button type="button" role="menuitem" onClick={() => openContact(contact)}>
                          Message
                        </button>
                        <button type="button" role="menuitem" onClick={() => openProfile(contact)}>
                          View profile
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })
          : null}
      </div>

      <button type="button" className="nav-messenger-footer-link" onClick={openInbox}>
        See all in Messenger
      </button>
    </div>
  );
}
