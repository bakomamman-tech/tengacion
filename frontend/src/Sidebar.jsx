import { useLocation, useNavigate } from "react-router-dom";
import { resolveImage } from "./api";

const fallbackAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "User"
  )}&size=96&background=DFE8F6&color=1D3A6D`;

export default function Sidebar({ user, openChat, openProfile }) {
  const navigate = useNavigate();
  const location = useLocation();

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

  const isProfileRoute = location.pathname.startsWith("/profile/");
  const sidebarBtnClass = (isActive) => `sidebar-btn${isActive ? " active" : ""}`;

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

      <div className="sidebar-links">
        <button
          className={sidebarBtnClass(location.pathname === "/home")}
          onClick={() => navigate("/home")}
        >
          Home
        </button>

        <button
          className={sidebarBtnClass(location.pathname === "/trending")}
          onClick={() => navigate("/trending")}
        >
          Trending
        </button>

        <button
          className={sidebarBtnClass(location.pathname === "/live")}
          onClick={() => navigate("/live")}
        >
          Live directory
        </button>

        <button
          className={sidebarBtnClass(location.pathname === "/live/go")}
          onClick={() => navigate("/live/go")}
        >
          Go live
        </button>

        <button
          className={sidebarBtnClass(
            location.pathname === "/creator" || location.pathname === "/dashboard/creator"
          )}
          onClick={() => navigate("/creator")}
        >
          Creator Dashboard
        </button>

        <button
          className={sidebarBtnClass(location.pathname === "/notifications")}
          onClick={() => navigate("/notifications")}
        >
          Notifications
        </button>

        <button className={sidebarBtnClass(false)} onClick={openChat}>
          Messages
        </button>

        <button className={sidebarBtnClass(isProfileRoute)} onClick={goProfile}>
          Profile
        </button>

        <button
          className={sidebarBtnClass(location.pathname === "/friends")}
          onClick={() => navigate("/friends")}
        >
          Friends
        </button>
      </div>
    </aside>
  );
}
