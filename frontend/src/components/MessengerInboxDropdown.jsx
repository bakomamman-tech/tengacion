import { useEffect, useMemo, useState } from "react";

import { getChatContacts, resolveImage } from "../api";

const fallbackAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "User"
  )}&size=96&background=DFE8F6&color=1D3A6D`;

const formatRelativeTime = (value) => {
  const timestamp = new Date(value || 0).getTime();
  if (!timestamp) {
    return "";
  }

  const diff = Math.max(0, Date.now() - timestamp);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) {
    return "now";
  }
  if (diff < hour) {
    return `${Math.round(diff / minute)}m`;
  }
  if (diff < day) {
    return `${Math.round(diff / hour)}h`;
  }
  return `${Math.round(diff / day)}d`;
};

export default function MessengerInboxDropdown({
  id = "navbar-messenger-menu",
  onSelectContact,
}) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;

    const loadContacts = async () => {
      setLoading(true);
      setError("");

      try {
        const data = await getChatContacts();
        if (!alive) {
          return;
        }
        setContacts(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!alive) {
          return;
        }
        setContacts([]);
        setError(err?.message || "Failed to load chats");
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    loadContacts();

    return () => {
      alive = false;
    };
  }, []);

  const filteredContacts = useMemo(() => {
    const needle = String(search || "").trim().toLowerCase();
    if (!needle) {
      return contacts;
    }

    return contacts.filter((contact) => {
      const haystack = [
        contact?.name,
        contact?.username,
        contact?.lastMessage,
        contact?.status?.text,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [contacts, search]);

  return (
    <div className="nav-messenger-dropdown" id={id} role="dialog" aria-label="Chats">
      <div className="nav-messenger-top">
        <div className="nav-messenger-title-block">
          <h3>Chats</h3>
          <p>Recent conversations and message previews</p>
        </div>
        <div className="nav-messenger-head-actions" aria-label="Messenger actions">
          <button type="button" className="nav-messenger-icon-btn" aria-label="More options">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="6" cy="12" r="1.9" />
              <circle cx="12" cy="12" r="1.9" />
              <circle cx="18" cy="12" r="1.9" />
            </svg>
          </button>
          <button type="button" className="nav-messenger-icon-btn" aria-label="New message">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h9A2.5 2.5 0 0 1 18 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 4 17.5z" />
              <path d="M18.5 5.5 20 4l.5.5-1.5 1.5zM14 9.5 19.5 4l1.5 1.5L15.5 11H14z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="nav-messenger-search">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10.5 4a6.5 6.5 0 1 0 4.1 11.5l4 4a1 1 0 0 0 1.4-1.4l-4-4A6.5 6.5 0 0 0 10.5 4zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search Messenger"
          aria-label="Search Messenger"
        />
      </div>

      <div className="nav-messenger-filters" role="tablist" aria-label="Chat filters">
        <button type="button" className="nav-messenger-filter active" aria-selected="true">
          All
        </button>
        <button type="button" className="nav-messenger-filter" aria-selected="false">
          Recent
        </button>
        <button type="button" className="nav-messenger-filter" aria-selected="false">
          Groups
        </button>
      </div>

      <div className="nav-messenger-list">
        {loading ? <div className="nav-messenger-state">Loading chats...</div> : null}
        {!loading && error ? <div className="nav-messenger-state">{error}</div> : null}
        {!loading && !error && filteredContacts.length === 0 ? (
          <div className="nav-messenger-state">
            {search.trim() ? "No chats matched your search." : "No conversations yet."}
          </div>
        ) : null}

        {!loading &&
          !error &&
          filteredContacts.map((contact) => {
            const name = contact?.name || contact?.username || "Messenger friend";
            const avatar = resolveImage(contact?.avatar) || fallbackAvatar(name);
            const preview = String(contact?.lastMessage || "Start chatting").trim() || "Start chatting";
            const timeLabel = formatRelativeTime(contact?.lastMessageAt);
            const statusLabel = contact?.status?.text
              ? `${contact.status.emoji || ""} ${contact.status.text}`.trim()
              : "";

            return (
              <div className="nav-messenger-item" key={contact?._id || name}>
                <button
                  type="button"
                  className="nav-messenger-item-main"
                  onClick={() => onSelectContact?.(contact)}
                >
                  <div className="nav-messenger-avatar-wrap">
                    <img src={avatar} alt="" className="nav-messenger-avatar" />
                    {contact?.isOnline ? <span className="nav-messenger-online-dot" /> : null}
                  </div>

                  <div className="nav-messenger-copy">
                    <div className="nav-messenger-row">
                      <strong>{name}</strong>
                      {timeLabel ? <span>{timeLabel}</span> : null}
                    </div>
                    <p>{preview}</p>
                    {statusLabel ? <small>{statusLabel}</small> : null}
                  </div>
                </button>

                <button
                  type="button"
                  className="nav-messenger-item-more"
                  aria-label={`More options for ${name}`}
                  title="More options"
                  onClick={() => onSelectContact?.(contact)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="6" cy="12" r="1.8" />
                    <circle cx="12" cy="12" r="1.8" />
                    <circle cx="18" cy="12" r="1.8" />
                  </svg>
                </button>
              </div>
            );
          })}
      </div>
    </div>
  );
}
