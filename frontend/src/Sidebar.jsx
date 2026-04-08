import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { resolveImage } from "./api";
import kadunaGotTalentPoster from "./assets/kaduna-got-talent-poster.jpg";

const MOBILE_SIDEBAR_QUERY = "(max-width: 1020px)";

const fallbackAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "User"
  )}&size=96&background=E3EFE7&color=1B5838`;

const getIsMobileSidebar = () => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia(MOBILE_SIDEBAR_QUERY).matches;
};

function SponsoredAdCard({ isExpanded, onToggle, onRegister }) {
  return (
    <section
      className={`sidebar-sponsored-card${isExpanded ? " expanded" : " compact"}`}
      aria-label="Sponsored Kaduna Got Talent advert"
    >
      <div className="sidebar-sponsored-topline">
        <div className="sidebar-sponsored-heading">
          <span className="sidebar-sponsored-badge">Sponsored</span>
          <strong>Kaduna Got Talent</strong>
        </div>

        <button
          type="button"
          className="sidebar-sponsored-toggle"
          onClick={onToggle}
          aria-expanded={isExpanded}
        >
          {isExpanded ? "Minimize" : "Preview"}
        </button>
      </div>

      {isExpanded ? (
        <>
          <img
            src={kadunaGotTalentPoster}
            alt="Kaduna Got Talent flyer"
            className="sidebar-sponsored-image"
          />

          <p className="sidebar-sponsored-copy">
            Showcase your talent on Tengacion and apply for Kaduna Got Talent.
          </p>
        </>
      ) : (
        <div className="sidebar-sponsored-compact-body">
          <img
            src={kadunaGotTalentPoster}
            alt="Kaduna Got Talent flyer"
            className="sidebar-sponsored-thumb"
          />

          <p className="sidebar-sponsored-copy">
            Open the flyer when you want it, while keeping the left menu free to use.
          </p>
        </div>
      )}

      <button
        type="button"
        className="sidebar-sponsored-btn"
        onClick={onRegister}
      >
        Register
      </button>
    </section>
  );
}

export default function Sidebar({ user, openChat, openProfile }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSponsoredExpanded, setIsSponsoredExpanded] = useState(false);
  const [isMobileSidebar, setIsMobileSidebar] = useState(getIsMobileSidebar);

  const avatar = resolveImage(user?.avatar) || fallbackAvatar(user?.name);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia(MOBILE_SIDEBAR_QUERY);
    const handleChange = (event) => setIsMobileSidebar(event.matches);

    setIsMobileSidebar(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

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
  const toggleSponsoredAd = () => setIsSponsoredExpanded((current) => !current);
  const openSponsoredAd = () => navigate("/kaduna-got-talent/register");

  if (isMobileSidebar) {
    return (
      <div className="sidebar-mobile-sponsored">
        <SponsoredAdCard
          isExpanded={isSponsoredExpanded}
          onToggle={toggleSponsoredAd}
          onRegister={openSponsoredAd}
        />
      </div>
    );
  }

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

      <SponsoredAdCard
        isExpanded={isSponsoredExpanded}
        onToggle={toggleSponsoredAd}
        onRegister={openSponsoredAd}
      />
    </aside>
  );
}
