import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getRechargeRaffleStatus, resolveImage } from "./api";

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

const getMediaUrl = (value) => {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value.trim();
  }
  return String(value.secureUrl || value.secure_url || value.url || "").trim();
};

const hasDateValue = (value) => {
  if (!value) {
    return false;
  }
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const cleanProfileValue = (value, placeholderPrefix = "") => {
  const nextValue = String(value || "").trim();
  if (!nextValue) {
    return "";
  }
  return placeholderPrefix && nextValue.startsWith(placeholderPrefix) ? "" : nextValue;
};

const hasCompletedProfileDetails = (user = {}) => {
  if (user?.onboarding?.completed) {
    return true;
  }

  return Boolean(
    user?.name &&
      user?.username &&
      user?.email &&
      cleanProfileValue(user?.phone, "tmp_phone_") &&
      cleanProfileValue(user?.country, "tmp_country_") &&
      hasDateValue(user?.dob) &&
      String(user?.gender || "").trim()
  );
};

const hidesRaffleByProfile = (user = {}) =>
  hasCompletedProfileDetails(user) && Boolean(getMediaUrl(user?.avatar));

function RaffleGameCard({ isExpanded, onToggle, onPlay }) {
  return (
    <section
      className={`sidebar-raffle-card${isExpanded ? " expanded" : " compact"}`}
      aria-label="Tengacion Spin and Win raffle game"
    >
      <div className="sidebar-raffle-topline">
        <div className="sidebar-raffle-heading">
          <span className="sidebar-raffle-badge">Spin & Win</span>
          <strong>Recharge Raffle</strong>
        </div>

        <button
          type="button"
          className="sidebar-raffle-toggle"
          onClick={onToggle}
          aria-expanded={isExpanded}
        >
          {isExpanded ? "Minimize" : "Preview"}
        </button>
      </div>

      {isExpanded ? (
        <>
          <div className="sidebar-raffle-wheel" aria-hidden="true">
            <span>100</span>
          </div>

          <p className="sidebar-raffle-copy">
            New or unfinished accounts can choose MTN or Airtel, then spin for a recharge PIN.
          </p>
        </>
      ) : (
        <div className="sidebar-raffle-compact-body">
          <div className="sidebar-raffle-thumb" aria-hidden="true">
            <span>PIN</span>
          </div>

          <p className="sidebar-raffle-copy">
            Five spins, MTN or Airtel, for new and unfinished profiles.
          </p>
        </div>
      )}

      <button
        type="button"
        className="sidebar-raffle-btn"
        onClick={onPlay}
      >
        Play
      </button>
    </section>
  );
}

export default function Sidebar({ user, openChat, openProfile }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isRaffleExpanded, setIsRaffleExpanded] = useState(false);
  const [isMobileSidebar, setIsMobileSidebar] = useState(getIsMobileSidebar);
  const [raffleVisible, setRaffleVisible] = useState(() => !hidesRaffleByProfile(user));

  const avatar = resolveImage(user?.avatar) || fallbackAvatar(user?.name);
  const raffleProfileHidden = hidesRaffleByProfile(user);
  const raffleVisibilityKey = [
    user?._id || "",
    getMediaUrl(user?.avatar),
    user?.onboarding?.completed ? "done" : "pending",
    user?.phone || "",
    user?.country || "",
    user?.dob || "",
    user?.gender || "",
  ].join("|");

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

  useEffect(() => {
    let cancelled = false;

    if (!user?._id) {
      setRaffleVisible(false);
      return () => {
        cancelled = true;
      };
    }

    setRaffleVisible(!raffleProfileHidden);
    getRechargeRaffleStatus()
      .then((payload) => {
        if (!cancelled) {
          setRaffleVisible(payload?.visibility?.visible !== false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRaffleVisible(!raffleProfileHidden);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [raffleProfileHidden, raffleVisibilityKey, user?._id]);

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
  const toggleRaffleCard = () => setIsRaffleExpanded((current) => !current);
  const openRaffleGame = () => navigate("/recharge-raffle");
  const openMessages = () => {
    if (typeof openChat === "function") {
      openChat();
      return;
    }

    navigate("/messages");
  };

  if (isMobileSidebar) {
    return raffleVisible ? (
      <div className="sidebar-mobile-feature">
        <RaffleGameCard
          isExpanded={isRaffleExpanded}
          onToggle={toggleRaffleCard}
          onPlay={openRaffleGame}
        />
      </div>
    ) : null;
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

      {raffleVisible ? (
        <RaffleGameCard
          isExpanded={isRaffleExpanded}
          onToggle={toggleRaffleCard}
          onPlay={openRaffleGame}
        />
      ) : null}

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

        {raffleVisible ? (
          <button
            className={sidebarBtnClass(location.pathname === "/recharge-raffle")}
            onClick={openRaffleGame}
          >
            Spin & Win
          </button>
        ) : null}

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
          className={sidebarBtnClass(location.pathname.startsWith("/marketplace"))}
          onClick={() => navigate("/marketplace")}
        >
          Marketplace
        </button>

        <button
          className={sidebarBtnClass(location.pathname === "/notifications")}
          onClick={() => navigate("/notifications")}
        >
          Notifications
        </button>

        <button className={sidebarBtnClass(location.pathname === "/messages")} onClick={openMessages}>
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

    </aside>
  );
}
