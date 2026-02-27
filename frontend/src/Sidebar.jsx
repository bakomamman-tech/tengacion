import { useNavigate } from "react-router-dom";
import { resolveImage } from "./api";

const fallbackAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "User"
  )}&size=96&background=DFE8F6&color=1D3A6D`;

export default function Sidebar({ user, openChat, openProfile }) {
  const navigate = useNavigate();

  const avatar = resolveImage(user?.avatar) || fallbackAvatar(user?.name);

  const goProfile = () => {
    if (typeof openProfile === "function") {
      openProfile();
      return;
    }

    if (user?.username) {
      navigate(`/profile/${user.username}`);
    }
  };

  return (
    <aside className="card sidebar-nav" role="navigation">
      <button className="sidebar-user" onClick={goProfile}>
        <img src={avatar} className="sb-avatar" alt="" />
        <div className="sb-meta">
          <b>{user?.name || "User"}</b>
          <span>@{user?.username || "username"}</span>
        </div>
      </button>

      <div className="sb-divider" />

      <button className="sidebar-btn" onClick={() => navigate("/home")}>
        Home
      </button>

      <button className="sidebar-btn" onClick={() => navigate("/trending")}>
        Trending
      </button>

      <button className="sidebar-btn" onClick={() => navigate("/live")}>
        Live directory
      </button>

      <button className="sidebar-btn" onClick={() => navigate("/live/go")}>
        Go live
      </button>

      <button className="sidebar-btn" onClick={() => navigate("/creator")}>
        Creator Dashboard
      </button>

      <button className="sidebar-btn" onClick={() => navigate("/notifications")}>
        Notifications
      </button>

      <button className="sidebar-btn" onClick={openChat}>
        Messages
      </button>

      <button className="sidebar-btn" onClick={goProfile}>
        Profile
      </button>
    </aside>
  );
}
