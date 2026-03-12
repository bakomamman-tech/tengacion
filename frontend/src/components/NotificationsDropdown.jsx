import { useMemo, useState } from "react";

import { splitNotificationsBySection } from "../notificationUtils";

function NotificationActionIcon({ type }) {
  if (type === "comment" || type === "reply" || type === "mention" || type === "tag") {
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

  if (type === "birthday") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5.2c1 0 1.8-.8 1.8-1.8S13 1.6 12 1.6s-1.8.8-1.8 1.8S11 5.2 12 5.2zm-5.6 4.1h11.2v10.7H6.4V9.3zm2.4-3.1h6.4l1.1 2.1H7.7l1.1-2.1z" />
      </svg>
    );
  }

  if (type === "system") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.2a5 5 0 0 0-5 5v2.1c0 .8-.2 1.6-.7 2.3l-1 1.5a1.2 1.2 0 0 0 1 1.9h11.4a1.2 1.2 0 0 0 1-1.9l-1-1.5a4.1 4.1 0 0 1-.7-2.3V8.2a5 5 0 0 0-5-5Z" />
        <path d="M9.4 17.4a2.6 2.6 0 0 0 5.2 0" />
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

function MoreIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="4.2" cy="10" r="1.7" />
      <circle cx="10" cy="10" r="1.7" />
      <circle cx="15.8" cy="10" r="1.7" />
    </svg>
  );
}

function NotificationRow({ item, onClick }) {
  return (
    <button
      type="button"
      className={`nav-notif-row ${item.read ? "" : "unread"}`}
      onClick={() => onClick?.(item)}
    >
      <div className="nav-notif-avatar-wrap">
        <img src={item.actorAvatar} alt={item.actorName} className="nav-notif-avatar" />
        <span className={`nav-notif-type-badge ${item.type}`}>
          <NotificationActionIcon type={item.type} />
        </span>
      </div>

      <div className="nav-notif-copy">
        <p className="nav-notif-text">
          <strong>{item.actorName}</strong> {item.messageText}
        </p>
        {item.previewText ? <p className="nav-notif-preview">{item.previewText}</p> : null}
        <div className="nav-notif-meta">
          <span className="nav-notif-time">{item.timeLabel}</span>
          <span className="nav-notif-meta-sep">.</span>
          <span className="nav-notif-type-label">{item.typeLabel}</span>
        </div>
      </div>

      <div className="nav-notif-side">
        {item.previewImage ? (
          <img
            src={item.previewImage}
            alt=""
            className="nav-notif-preview-thumb"
            loading="lazy"
          />
        ) : null}
        {!item.read ? <span className="nav-notif-unread-dot" /> : null}
      </div>
    </button>
  );
}

export default function NotificationsDropdown({
  id,
  notifications,
  unreadCount,
  loading,
  error,
  onMarkAllRead,
  onNotificationClick,
  onOpenSettings,
  onOpenAll,
}) {
  const [filter, setFilter] = useState("all");
  const [menuOpen, setMenuOpen] = useState(false);

  const { filtered, newItems, todayItems, earlierItems } = useMemo(
    () => splitNotificationsBySection(notifications, { filter }),
    [filter, notifications]
  );

  const firstVisibleSection = newItems.length
    ? "new"
    : todayItems.length
      ? "today"
      : earlierItems.length
        ? "earlier"
        : "";

  const handleMarkAllRead = () => {
    setMenuOpen(false);
    onMarkAllRead?.();
  };

  const handleOpenSettings = () => {
    setMenuOpen(false);
    onOpenSettings?.();
  };

  const handleOpenAll = () => {
    setMenuOpen(false);
    onOpenAll?.();
  };

  const renderSection = (title, items, sectionKey) => {
    if (!items.length) {
      return null;
    }

    return (
      <section className="nav-notif-section" key={sectionKey}>
        <div className="nav-notif-section-head">
          <h4>{title}</h4>
          {sectionKey === firstVisibleSection ? (
            <button type="button" className="nav-notif-link" onClick={handleOpenAll}>
              See all
            </button>
          ) : null}
        </div>
        <div className="nav-notif-list">
          {items.map((item) => (
            <NotificationRow key={item._id} item={item} onClick={onNotificationClick} />
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="nav-notif-dropdown" id={id} role="dialog" aria-label="Notifications">
      <div className="nav-notif-top">
        <div className="nav-notif-title-block">
          <h3>Notifications</h3>
          <p>
            {loading && filtered.length
              ? "Updating your latest activity"
              : unreadCount > 0
                ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}`
                : "You are caught up for now"}
          </p>
        </div>

        <div className="nav-notif-head-actions">
          {unreadCount > 0 ? (
            <span className="nav-notif-count-chip">
              {unreadCount > 99 ? "99+" : unreadCount} new
            </span>
          ) : null}

          <div className="nav-notif-menu-wrap">
            <button
              type="button"
              className="nav-notif-icon-btn"
              aria-label="Notification options"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((current) => !current)}
            >
              <MoreIcon />
            </button>

            {menuOpen && (
              <div className="nav-notif-menu">
                <button
                  type="button"
                  className="nav-notif-menu-item"
                  onClick={handleMarkAllRead}
                >
                  <span className="nav-notif-menu-icon">
                    <MenuItemIcon name="check" />
                  </span>
                  <span>Mark all as read</span>
                </button>

                <button
                  type="button"
                  className="nav-notif-menu-item"
                  onClick={handleOpenSettings}
                >
                  <span className="nav-notif-menu-icon">
                    <MenuItemIcon name="settings" />
                  </span>
                  <span>Notification settings</span>
                </button>

                <button
                  type="button"
                  className="nav-notif-menu-item"
                  onClick={handleOpenAll}
                >
                  <span className="nav-notif-menu-icon">
                    <MenuItemIcon name="open" />
                  </span>
                  <span>Open notifications page</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="nav-notif-tabs">
        <button
          type="button"
          className={`nav-notif-tab ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All
        </button>
        <button
          type="button"
          className={`nav-notif-tab ${filter === "unread" ? "active" : ""}`}
          onClick={() => setFilter("unread")}
        >
          Unread{unreadCount ? ` (${unreadCount})` : ""}
        </button>
      </div>

      <div className="nav-notif-scroll">
        {loading && !filtered.length ? (
          <div className="nav-notif-empty">
            <strong>Loading notifications</strong>
            <span>Pulling in your latest activity.</span>
          </div>
        ) : null}

        {!loading && error && !filtered.length ? (
          <div className="nav-notif-empty">
            <strong>Notifications unavailable</strong>
            <span>{error}</span>
          </div>
        ) : null}

        {!loading && !error && !filtered.length ? (
          <div className="nav-notif-empty">
            <strong>{filter === "unread" ? "No unread notifications" : "No notifications yet"}</strong>
            <span>
              {filter === "unread"
                ? "New notifications will stay here until you review them."
                : "Activity from follows, comments, messages, and mentions will appear here."}
            </span>
          </div>
        ) : null}

        {filtered.length > 0 && filter === "unread" ? (
          <section className="nav-notif-section">
            <div className="nav-notif-section-head">
              <h4>Unread</h4>
              <button type="button" className="nav-notif-link" onClick={handleOpenAll}>
                See all
              </button>
            </div>
            <div className="nav-notif-list">
              {filtered.map((item) => (
                <NotificationRow key={item._id} item={item} onClick={onNotificationClick} />
              ))}
            </div>
          </section>
        ) : null}

        {filter === "all" ? renderSection("New", newItems, "new") : null}
        {filter === "all" ? renderSection("Today", todayItems, "today") : null}
        {filter === "all" ? renderSection("Earlier", earlierItems, "earlier") : null}
      </div>
    </div>
  );
}
