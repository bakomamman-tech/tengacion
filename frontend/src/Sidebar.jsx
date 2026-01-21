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

      {/* ===== NAV ITEMS ===== */}

      <button
        className="sidebar-btn"
        onClick={() => navigate("/")}
      >
        <span className="sb-icon">🏠</span>
        <span>Home</span>
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

      <button
        className="sidebar-btn"
        onClick={() => navigate("/settings")}
      >
        <span className="sb-icon">⚙️</span>
        <span>Settings</span>
      </button>

      <div className="sb-divider" />

      {/* ===== SHORTCUTS ===== */}
      <div className="sb-section-title">
        Your shortcuts
      </div>

      <button className="sidebar-btn">
        <span className="sb-icon">👥</span>
        <span>Groups</span>
      </button>

      <button className="sidebar-btn">
        <span className="sb-icon">🎮</span>
        <span>Games</span>
      </button>

      <button className="sidebar-btn">
        <span className="sb-icon">🛒</span>
        <span>Marketplace</span>
      </button>
    </aside>
  );
}
