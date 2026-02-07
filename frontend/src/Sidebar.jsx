import { useNavigate } from "react-router-dom";

export default function Sidebar({ user, openChat, openProfile }) {
  const navigate = useNavigate();

  const avatar =
    user?.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      user?.name || "User"
    )}&size=64`;

  return (
    <aside className="card sidebar" role="navigation">
      {/* ===== USER HEADER ===== */}
      <div
        className="sidebar-user"
        onClick={openProfile}
        role="button"
      >
        <img src={avatar} className="sb-avatar" />

        <div className="sb-meta">
          <b>{user.name}</b>
          <span>@{user.username}</span>
        </div>
      </div>

      <div className="sb-divider" />

      {/* ===== PRIMARY NAV ===== */}

      <button
        className="sidebar-btn"
        onClick={() => navigate("/home")}
      >
        <span className="sb-icon">🏠</span>
        <span>Home</span>
      </button>

      <button
        className="sidebar-btn"
        onClick={() => navigate("/trending")}
      >
        <span className="sb-icon">🔥</span>
        <span>Trending</span>
      </button>

      <button
        className="sidebar-btn"
        onClick={() => navigate("/creator")}
      >
        <span className="sb-icon">📊</span>
        <span>Creator Dashboard</span>
      </button>

      <button
        className="sidebar-btn"
        onClick={() => navigate("/notifications")}
      >
        <span className="sb-icon">🔔</span>
        <span>Notifications</span>
        <span className="sb-badge">3</span>
      </button>

      <button
        className="sidebar-btn"
        onClick={openChat}
      >
        <span className="sb-icon">💬</span>
        <span>Messages</span>
        <span className="sb-badge">2</span>
      </button>

      <button
        className="sidebar-btn"
        onClick={openProfile}
      >
        <span className="sb-icon">👤</span>
        <span>Profile</span>
      </button>

      <div className="sb-divider" />

      {/* ===== SHORTCUTS ===== */}
      <div className="sb-section-title">
        Discover
      </div>

      <button className="sidebar-btn">
        <span className="sb-icon">👥</span>
        <span>Communities</span>
      </button>

      <button className="sidebar-btn">
        <span className="sb-icon">⭐</span>
        <span>Recommended</span>
      </button>

      <button className="sidebar-btn">
        <span className="sb-icon">🎬</span>
        <span>Creators</span>
      </button>

      <button className="sidebar-btn">
        <span className="sb-icon">🛒</span>
        <span>Marketplace</span>
      </button>
    </aside>
  );
}
