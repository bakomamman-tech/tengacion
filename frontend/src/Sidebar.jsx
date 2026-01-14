export default function Sidebar({ user, openChat, openProfile }) {
  return (
    <div className="card sidebar">
      {/* USER HEADER */}
      <div
        className="sidebar-user"
        onClick={openProfile}
        style={{ cursor: "pointer" }}
      >
        <b>{user.name}</b>
        <span>@{user.username}</span>
      </div>

      <hr />

      {/* NAV */}
      <button className="sidebar-btn">🏠 Home</button>

      <button className="sidebar-btn" onClick={openChat}>
        💬 Messages
      </button>

      <button className="sidebar-btn" onClick={openProfile}>
        👤 Profile
      </button>

      <button className="sidebar-btn">⚙️ Settings</button>
    </div>
  );
}
