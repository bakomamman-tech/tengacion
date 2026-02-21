import { useState } from "react";
import Navbar from "../Navbar";
import Sidebar from "../Sidebar";

export default function Notifications({ user }) {
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: "like",
      actor: "Sarah Johnson",
      action: "liked your post",
      time: "2 hours ago",
      icon: "👍",
      read: false
    },
    {
      id: 2,
      type: "comment",
      actor: "Alex Chen",
      action: "commented on your post",
      time: "4 hours ago",
      icon: "💬",
      read: false
    },
    {
      id: 3,
      type: "follow",
      actor: "Emma White",
      action: "started following you",
      time: "1 day ago",
      icon: "👥",
      read: true
    }
  ]);

  const [preferences, setPreferences] = useState({
    likes: true,
    comments: true,
    follows: true,
    shares: true,
    mentions: true,
    pushNotifications: true,
    emailNotifications: false,
    smsNotifications: false
  });

  const [filter, setFilter] = useState("all"); // all, unread, likes, comments, follows

  const togglePreference = (key) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const markAsRead = (id) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === "all") {return true;}
    if (filter === "unread") {return !n.read;}
    return n.type === filter;
  });

  return (
    <>
      <Navbar user={user} />
      <div className="app-shell">
        <aside className="sidebar">
          <Sidebar user={user} />
        </aside>

        <main className="feed notifications-page">
          {/* HEADER */}
          <div className="notifications-header card">
            <div className="header-top">
              <h2>🔔 Notifications</h2>
              {notifications.some(n => !n.read) && (
                <button 
                  className="btn-link"
                  onClick={markAllAsRead}
                  style={{ fontSize: "13px", color: "var(--fb-blue)" }}
                >
                  Mark all as read
                </button>
              )}
            </div>

            {/* FILTER TABS */}
            <div className="notification-filters">
              {["all", "unread", "likes", "comments", "follows"].map((f) => (
                <button
                  key={f}
                  className={`filter-tab ${filter === f ? "active" : ""}`}
                  onClick={() => setFilter(f)}
                >
                  {f === "all" && "✨ All"}
                  {f === "unread" && `⭕ Unread (${notifications.filter(n => !n.read).length})`}
                  {f === "likes" && "👍 Likes"}
                  {f === "comments" && "💬 Comments"}
                  {f === "follows" && "👥 Follows"}
                </button>
              ))}
            </div>
          </div>

          {/* NOTIFICATIONS LIST */}
          <div className="notifications-list">
            {filteredNotifications.length === 0 ? (
              <div className="card empty-state" style={{ textAlign: "center", padding: "40px" }}>
                <div style={{ fontSize: "48px", marginBottom: "12px" }}>✨</div>
                <h3>All caught up!</h3>
                <p>No new notifications in this category</p>
              </div>
            ) : (
              filteredNotifications.map(notif => (
                <div
                  key={notif.id}
                  className={`notification-item ${!notif.read ? "unread" : ""}`}
                  onClick={() => markAsRead(notif.id)}
                >
                  <div className="notification-icon">{notif.icon}</div>
                  <div className="notification-content">
                    <p className="notification-text">
                      <strong>{notif.actor}</strong> {notif.action}
                    </p>
                    <p className="notification-time">{notif.time}</p>
                  </div>
                  {!notif.read && <div className="notification-dot" />}
                </div>
              ))
            )}
          </div>

          {/* DIVIDER */}
          <div style={{ 
            height: "1px", 
            background: "var(--border)", 
            margin: "24px 0",
            borderRadius: "1px"
          }} />

          {/* PREFERENCES */}
          <div className="notification-preferences card">
            <h3>⚙️ Notification Preferences</h3>

            {/* NOTIFICATION TYPES */}
            <div className="preferences-section">
              <h4>What to notify me about:</h4>
              <div className="preference-group">
                {[
                  { key: "likes", label: "👍 Post Likes", desc: "When someone likes your post" },
                  { key: "comments", label: "💬 Comments", desc: "When someone comments on your post" },
                  { key: "follows", label: "👥 New Followers", desc: "When someone follows you" },
                  { key: "shares", label: "🔗 Shares", desc: "When someone shares your content" },
                  { key: "mentions", label: "@ Mentions", desc: "When someone mentions you" }
                ].map(pref => (
                  <div key={pref.key} className="preference-row">
                    <div className="preference-label">
                      <div className="preference-title">{pref.label}</div>
                      <div className="preference-desc">{pref.desc}</div>
                    </div>
                    <div className="toggle-switch">
                      <input
                        type="checkbox"
                        id={pref.key}
                        checked={preferences[pref.key]}
                        onChange={() => togglePreference(pref.key)}
                      />
                      <label htmlFor={pref.key}>
                        <span className="toggle-handle" />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* DELIVERY METHOD */}
            <div className="preferences-section" style={{ marginTop: "24px" }}>
              <h4>How to notify me:</h4>
              <div className="preference-group">
                {[
                  { key: "pushNotifications", label: "🔔 Push", desc: "Browser notifications" },
                  { key: "emailNotifications", label: "📧 Email", desc: "Email notifications" },
                  { key: "smsNotifications", label: "📱 SMS", desc: "Text message notifications" }
                ].map(pref => (
                  <div key={pref.key} className="preference-row">
                    <div className="preference-label">
                      <div className="preference-title">{pref.label}</div>
                      <div className="preference-desc">{pref.desc}</div>
                    </div>
                    <div className="toggle-switch">
                      <input
                        type="checkbox"
                        id={pref.key}
                        checked={preferences[pref.key]}
                        onChange={() => togglePreference(pref.key)}
                      />
                      <label htmlFor={pref.key}>
                        <span className="toggle-handle" />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SAVE BUTTON */}
            <div className="preferences-actions">
              <button className="btn-primary">💾 Save Preferences</button>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
