import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../Navbar";
import Sidebar from "../Sidebar";
import {
  resolveImage,
} from "../api";
import { useNotifications } from "../context/NotificationsContext";

const fallbackAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "User"
  )}&size=96&background=DFE8F6&color=1D3A6D`;

const getRelativeTime = (value) => {
  const stamp = new Date(value || "").getTime();
  if (!Number.isFinite(stamp)) {
    return "now";
  }

  const diffSec = Math.max(1, Math.floor((Date.now() - stamp) / 1000));
  if (diffSec < 60) {
    return `${diffSec}s`;
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin}m`;
  }

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return `${diffHours}h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
};

const normalizeNotification = (entry) => {
  const sender = entry?.sender && typeof entry.sender === "object" ? entry.sender : null;
  const actorName = sender?.name || "Someone";
  const senderId = sender?._id || "";
  const senderUsername = sender?.username || "";
  const actorAvatar = resolveImage(sender?.avatar) || fallbackAvatar(actorName);
  const type = entry?.type || "system";
  const createdAt = entry?.createdAt || null;
  const previewText = entry?.metadata?.previewText || "";

  let messageText = entry?.text || "";

  if (!messageText) {
    if (type === "message") {
      messageText = "sent you a message.";
    } else if (type === "like") {
      messageText = "liked your post.";
    } else if (type === "comment") {
      messageText = "commented on your post.";
    } else if (type === "friend_request") {
      messageText = "sent you a friend request.";
    } else {
      messageText = "sent you a notification.";
    }
  }

  if (!/[.!?]$/.test(messageText)) {
    messageText = `${messageText}.`;
  }

  return {
    _id: entry?._id || "",
    read: Boolean(entry?.read),
    type,
    actorName,
    senderId,
    senderUsername,
    actorAvatar,
    messageText,
    previewText,
    createdAt,
    timeLabel: getRelativeTime(createdAt),
  };
};

function NotificationActionIcon({ type }) {
  if (type === "comment") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4.5 4v-4H6a2 2 0 0 1-2-2z" />
      </svg>
    );
  }

  if (type === "follow" || type === "friend_request") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.6a7.5 7.5 0 1 0 0 15 7.5 7.5 0 1 0 0-15zm0 2.7a4.8 4.8 0 1 1 0 9.6 4.8 4.8 0 0 1 0-9.6z" />
      </svg>
    );
  }

  if (type === "message") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9.2L5.1 19v-3.5H6a2 2 0 0 1-2-2z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9.7 20.3H6.3a2 2 0 0 1-2-2v-6.5a2 2 0 0 1 2-2h3.4v10.5zm2.1-10.5L13.9 4a1.6 1.6 0 0 1 3.1.7v.8c0 .3 0 .6-.1.8l-.6 3.5H20a1.7 1.7 0 0 1 1.6 2.2l-1.9 6.3a2 2 0 0 1-1.9 1.4h-6z" />
    </svg>
  );
}

function MenuItemIcon({ name }) {
  if (name === "check") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.5 12.5l4.2 4.3L19.5 6.8" />
      </svg>
    );
  }

  if (name === "settings") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" />
        <path d="M19.5 13.1V11l-2-.6a6 6 0 0 0-.6-1.5l1-1.8-1.4-1.4-1.8 1a6 6 0 0 0-1.5-.6L13 3.8h-2l-.6 2.1a6 6 0 0 0-1.5.6l-1.8-1-1.4 1.4 1 1.8a6 6 0 0 0-.6 1.5L3.8 11v2l2.1.6a6 6 0 0 0 .6 1.5l-1 1.8 1.4 1.4 1.8-1a6 6 0 0 0 1.5.6l.6 2.1h2l.6-2.1a6 6 0 0 0 1.5-.6l1.8 1 1.4-1.4-1-1.8a6 6 0 0 0 .6-1.5l2.1-.6z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5h16v11H4zM8 20h8M12 16v4" />
    </svg>
  );
}

export default function Notifications({ user }) {
  const navigate = useNavigate();
  const {
    notifications: storeNotifications,
    fetchNotifications,
    markAllRead,
    markOneRead,
    loading,
    error,
  } = useNotifications();
  const [filter, setFilter] = useState("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const markedOnOpenRef = useRef(false);

  const loadNotifications = useCallback(async () => {
    await fetchNotifications({ page: 1, limit: 100 });
  }, [fetchNotifications]);

  useEffect(() => {
    loadNotifications();

    const timer = window.setInterval(loadNotifications, 20000);
    return () => window.clearInterval(timer);
  }, [loadNotifications]);

  useEffect(() => {
    if (markedOnOpenRef.current) {
      return;
    }
    markedOnOpenRef.current = true;
    markAllRead({ optimistic: true });
  }, [markAllRead]);

  useEffect(() => {
    const onMouseDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const unreadCount = useMemo(
    () => storeNotifications.filter((item) => !item.read).length,
    [storeNotifications]
  );

  const filtered = useMemo(() => {
    if (filter === "unread") {
      return storeNotifications.filter((item) => !item.read);
    }
    return storeNotifications;
  }, [filter, storeNotifications]);

  const newItems = filtered.filter((item) => {
    const createdAt = new Date(item.createdAt || "").getTime();
    return Number.isFinite(createdAt) && Date.now() - createdAt < 24 * 60 * 60 * 1000;
  });
  const earlierItems = filtered.filter((item) => !newItems.includes(item));

  const markAsRead = async (id) => {
    await markOneRead(id);
  };

  const markAllAsRead = async () => {
    await markAllRead({ optimistic: true });
  };

  const openSettings = () => {
    setFilter("all");
    setMenuOpen(false);
  };

  const openNotificationsList = () => {
    setFilter("all");
    setMenuOpen(false);
  };

  const handleNotificationClick = (item) => {
    markAsRead(item._id);
    if (item.type === "message") {
      navigate("/home", { state: { openMessenger: true } });
      return;
    }
    if (item.senderUsername) {
      navigate(`/profile/${item.senderUsername}`);
    }
  };

  const renderRow = (entry) => {
    const item = normalizeNotification(entry);
    return (
    <button
      key={item._id}
      className={`notif-row ${item.read ? "" : "unread"}`}
      onClick={() => handleNotificationClick(item)}
    >
      <div className="notif-avatar-wrap">
        <img src={item.actorAvatar} alt={item.actorName} className="notif-avatar" />
        <span className={`notif-action-badge ${item.type}`}>
          <NotificationActionIcon type={item.type} />
        </span>
      </div>

      <div className="notif-copy">
        <p className="notif-text">
          <strong>{item.actorName}</strong> {item.messageText}
        </p>
        <div className="notif-meta">
          <span className="notif-time">{item.timeLabel}</span>
          {item.previewText && (
            <>
              <span className="notif-meta-sep">.</span>
              <span className="notif-extra">{item.previewText.slice(0, 60)}</span>
            </>
          )}
        </div>
      </div>

      {!item.read && <span className="notif-unread-dot" />}
    </button>
    );
  };

  return (
    <>
      <Navbar user={user} />

      <div className="app-shell">
        <aside className="sidebar">
          <Sidebar user={user} />
        </aside>

        <main className="feed notifications-page notifications-page-v2">
          <section className="card notifications-panel">
            <header className="notifications-panel-header">
              <div>
                <h2>Notifications</h2>
              </div>
              <div className="notif-menu-wrap" ref={menuRef}>
                <button
                  className="notif-more-btn"
                  title="More"
                  onClick={() => setMenuOpen((current) => !current)}
                >
                  {"\u22EF"}
                </button>

                {menuOpen && (
                  <div className="notif-popover-menu">
                    <button
                      className="notif-popover-item"
                      onClick={() => {
                        markAllAsRead();
                        setMenuOpen(false);
                      }}
                    >
                      <span className="notif-popover-icon">
                        <MenuItemIcon name="check" />
                      </span>
                      <span>Mark all as read</span>
                    </button>

                    <button className="notif-popover-item" onClick={openSettings}>
                      <span className="notif-popover-icon">
                        <MenuItemIcon name="settings" />
                      </span>
                      <span>Notification settings</span>
                    </button>

                    <button className="notif-popover-item" onClick={openNotificationsList}>
                      <span className="notif-popover-icon">
                        <MenuItemIcon name="open" />
                      </span>
                      <span>Open Notifications</span>
                    </button>
                  </div>
                )}
              </div>
            </header>

            <div className="notifications-tabs">
              <button
                className={`notifications-tab ${filter === "all" ? "active" : ""}`}
                onClick={() => setFilter("all")}
              >
                All
              </button>
              <button
                className={`notifications-tab ${filter === "unread" ? "active" : ""}`}
                onClick={() => setFilter("unread")}
              >
                Unread{unreadCount ? ` (${unreadCount})` : ""}
              </button>
              {unreadCount > 0 && (
                <button className="notif-mark-all" onClick={markAllAsRead}>
                  Mark all as read
                </button>
              )}
            </div>

            {loading && <div className="notif-empty">Loading notifications...</div>}
            {!loading && error && <div className="notif-empty">{error}</div>}

            {!loading && !error && newItems.length > 0 && (
              <section className="notif-section">
                <div className="notif-section-header">
                  <h3>New</h3>
                  <button className="notif-link-btn" onClick={() => setFilter("all")}>
                    See all
                  </button>
                </div>
                <div className="notif-list">{newItems.map(renderRow)}</div>
              </section>
            )}

            {!loading && !error && earlierItems.length > 0 && (
              <section className="notif-section">
                <div className="notif-section-header">
                  <h3>Earlier</h3>
                </div>
                <div className="notif-list">{earlierItems.map(renderRow)}</div>
              </section>
            )}

            {!loading && !error && !newItems.length && !earlierItems.length && (
              <div className="notif-empty">No notifications in this view.</div>
            )}

            <button className="notif-previous-btn" onClick={() => setFilter("all")}>
              See previous notifications
            </button>
          </section>
        </main>
      </div>
    </>
  );
}
