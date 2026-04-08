import { useLocation, useNavigate } from "react-router-dom";
import { resolveImage } from "./api";
import kadunaGotTalentPoster from "./assets/kaduna-got-talent-poster.jpg";

const fallbackAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "User"
  )}&size=96&background=E3EFE7&color=1B5838`;

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
            location.pathname.startsWith("/creator") || location.pathname === "/dashboard/creator"
          )}
          onClick={() => navigate("/creator")}
        >
          Creator Dashboard
        </button>

        <button
          className={sidebarBtnClass(
            location.pathname.startsWith("/find-creators") || location.pathname === "/creators"
          )}
          onClick={() => navigate("/find-creators")}
        >
          Find Creators
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

        <button
          className={sidebarBtnClass(location.pathname === "/birthdays")}
          onClick={() => navigate("/birthdays")}
        >
          Birthdays
        </button>

        <button
          className={sidebarBtnClass(location.pathname === "/calculator")}
          onClick={() => navigate("/calculator")}
        >
          Calculator
        </button>
      </div>

      <section className="sidebar-sponsored-card" aria-label="Sponsored Kaduna Got Talent advert">
        <div className="sidebar-sponsored-topline">
          <span className="sidebar-sponsored-badge">Sponsored</span>
          <strong>Kaduna Got Talent</strong>
        </div>

        <img
          src={kadunaGotTalentPoster}
          alt="Kaduna Got Talent flyer"
          className="sidebar-sponsored-image"
        />

        <p className="sidebar-sponsored-copy">
          Showcase your talent on Tengacion and apply for Kaduna Got Talent.
        </p>

        <button
          type="button"
          className="sidebar-sponsored-btn"
          onClick={() => navigate("/kaduna-got-talent/register")}
        >
          Register
        </button>
      </section>
    </aside>
  );
}
