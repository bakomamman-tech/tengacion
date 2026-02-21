import { useMemo, useState } from "react";
import Navbar from "../Navbar";
import Sidebar from "../Sidebar";
import { resolveImage } from "../api";

const fallbackAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "User"
  )}&size=96&background=DFE8F6&color=1D3A6D`;

const NOTIFICATIONS = [
  {
    id: "n1",
    actor: "Auta Emmanuel",
    message: 'likes your comment: "Boss".',
    time: "1h",
    meta: "1 Reaction",
    type: "like",
    section: "new",
    read: false,
  },
  {
    id: "n2",
    actor: "Bayero Theophilus Atakuwa",
    message: "commented on a reel that you're tagged in.",
    time: "2h",
    meta: "",
    type: "comment",
    section: "new",
    read: false,
  },
  {
    id: "n3",
    actor: "Threads",
    message: "You have new followers on Threads.",
    time: "3h",
    meta: "",
    type: "follow",
    section: "earlier",
    read: false,
  },
  {
    id: "n4",
    actor: "Loveth Jonathan",
    message: "and 4 others have birthdays today. Wish them the best!",
    time: "4h",
    meta: "",
    type: "birthday",
    section: "earlier",
    read: false,
  },
  {
    id: "n5",
    actor: "D'dam Il-ya Ajey",
    message: 'and Naomi Shuaibu like a reel you shared: "Keep up the good work bro!"',
    time: "10h",
    meta: "",
    type: "like",
    section: "earlier",
    read: false,
  },
];

function NotificationActionIcon({ type }) {
  if (type === "comment") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4.5 4v-4H6a2 2 0 0 1-2-2z" />
      </svg>
    );
  }

  if (type === "follow") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.6a7.5 7.5 0 1 0 0 15 7.5 7.5 0 1 0 0-15zm0 2.7a4.8 4.8 0 1 1 0 9.6 4.8 4.8 0 0 1 0-9.6z" />
      </svg>
    );
  }

  if (type === "birthday") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 10h12v9H6zM4.5 10h15v2.4h-15zM12 10V6.6M8.8 7c.8 0 1.4-.6 1.4-1.4S9.6 4.2 8.8 4.2c-1.2 0-2.1 1.3-2 2.5V7h2zm6.4 0h2v-.3c.1-1.2-.8-2.5-2-2.5-.8 0-1.4.6-1.4 1.4s.6 1.4 1.4 1.4z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9.7 20.3H6.3a2 2 0 0 1-2-2v-6.5a2 2 0 0 1 2-2h3.4v10.5zm2.1-10.5L13.9 4a1.6 1.6 0 0 1 3.1.7v.8c0 .3 0 .6-.1.8l-.6 3.5H20a1.7 1.7 0 0 1 1.6 2.2l-1.9 6.3a2 2 0 0 1-1.9 1.4h-6z" />
    </svg>
  );
}

export default function Notifications({ user }) {
  const [filter, setFilter] = useState("all");
  const [notifications, setNotifications] = useState(NOTIFICATIONS);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications]
  );

  const filtered = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((item) => !item.read);
    }
    return notifications;
  }, [filter, notifications]);

  const newItems = filtered.filter((item) => item.section === "new");
  const earlierItems = filtered.filter((item) => item.section === "earlier");

  const markAsRead = (id) => {
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, read: true } : item))
    );
  };

  const markAllAsRead = () => {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  };

  const renderRow = (item) => {
    const avatarSource = resolveImage(item.avatar) || fallbackAvatar(item.actor);
    return (
      <button
        key={item.id}
        className={`notif-row ${item.read ? "" : "unread"}`}
        onClick={() => markAsRead(item.id)}
      >
        <div className="notif-avatar-wrap">
          <img src={avatarSource} alt={item.actor} className="notif-avatar" />
          <span className={`notif-action-badge ${item.type}`}>
            <NotificationActionIcon type={item.type} />
          </span>
        </div>

        <div className="notif-copy">
          <p className="notif-text">
            <strong>{item.actor}</strong> {item.message}
          </p>
          <div className="notif-meta">
            <span className="notif-time">{item.time}</span>
            {item.meta && (
              <>
                <span className="notif-meta-sep">.</span>
                <span className="notif-extra">{item.meta}</span>
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
              <button className="notif-more-btn" title="More">
                {"\u22EF"}
              </button>
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

            {newItems.length > 0 && (
              <section className="notif-section">
                <div className="notif-section-header">
                  <h3>New</h3>
                  <button className="notif-link-btn">See all</button>
                </div>
                <div className="notif-list">{newItems.map(renderRow)}</div>
              </section>
            )}

            {earlierItems.length > 0 && (
              <section className="notif-section">
                <div className="notif-section-header">
                  <h3>Earlier</h3>
                </div>
                <div className="notif-list">{earlierItems.map(renderRow)}</div>
              </section>
            )}

            {!newItems.length && !earlierItems.length && (
              <div className="notif-empty">No notifications in this view.</div>
            )}

            <button className="notif-previous-btn">See previous notifications</button>
          </section>
        </main>
      </div>
    </>
  );
}
