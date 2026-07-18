import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useLocation, useNavigate } from "react-router-dom";
import {
  getFriendsHub,
  getRechargeRaffleStatus,
  resolveImage,
  sendFriendRequest,
} from "./api";

const MOBILE_SIDEBAR_QUERY = "(max-width: 1020px)";
const RAFFLE_DEMO_EMAIL = "tmintldo4_life@yahoo.com";
const PROFILE_MEDIA_REQUIRED_MESSAGE =
  "Upload a profile picture and cover photo to be able to play";
const ROUND_RETRY_MESSAGE =
  "Try after one hour but you must make a post to activate the game again.";

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

const hasRaffleDemoAccess = (user = {}) =>
  String(user?.email || "").trim().toLowerCase() === RAFFLE_DEMO_EMAIL;

const hasRequiredRafflePhotos = (user = {}) =>
  hasRaffleDemoAccess(user) ||
  (Boolean(getMediaUrl(user?.avatar)) && Boolean(getMediaUrl(user?.cover)));

const getRafflePlayMessage = (payload, locallyEligible) => {
  if (payload?.demoAccess) {
    return "";
  }
  const eligibility = payload?.eligibility;
  if (
    eligibility &&
    (!eligibility.profilePhotoComplete || !eligibility.coverPhotoComplete)
  ) {
    return PROFILE_MEDIA_REQUIRED_MESSAGE;
  }
  if (payload?.cooldown?.active) {
    return ROUND_RETRY_MESSAGE;
  }
  if (
    eligibility?.repeatPostRequirement?.required &&
    !eligibility.repeatPostRequirement.complete
  ) {
    return "Make a post on Tengacion, then revisit the game after one hour.";
  }
  return locallyEligible ? "" : PROFILE_MEDIA_REQUIRED_MESSAGE;
};

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
            New users with profile and cover photos can spin for an MTN or Airtel recharge PIN.
          </p>
        </>
      ) : (
        <div className="sidebar-raffle-compact-body">
          <div className="sidebar-raffle-thumb" aria-hidden="true">
            <span>PIN</span>
          </div>

          <p className="sidebar-raffle-copy">
            Five spins per round. Losing rounds reopen after one hour and a new post.
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

function FriendSuggestionsCard({ suggestions, pendingIds, onAdd, onProfile, onSeeAll }) {
  if (!suggestions.length) {
    return null;
  }

  return (
    <section className="sidebar-friend-suggestions" aria-labelledby="friend-suggestions-title">
      <div className="sidebar-friend-suggestions__head">
        <div>
          <span>Discover people</span>
          <strong id="friend-suggestions-title">Friend suggestions</strong>
        </div>
        <button type="button" onClick={onSeeAll}>
          <span>See all</span>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="m6 3 5 5-5 5" />
          </svg>
        </button>
      </div>

      <div className="sidebar-friend-suggestions__list">
        {suggestions.map((person) => {
          const isPending = pendingIds.has(person._id);
          return (
            <article className="sidebar-friend-suggestion" key={person._id}>
              <button
                type="button"
                className="sidebar-friend-suggestion__profile"
                onClick={() => onProfile(person)}
                aria-label={`View ${person.name || person.username}'s profile`}
              >
                <span className="sidebar-friend-suggestion__avatar">
                  <img
                    src={resolveImage(person.avatar) || fallbackAvatar(person.name)}
                    alt=""
                  />
                </span>
                <span>
                  <strong>{person.name || person.username}</strong>
                  <small>
                    {person.mutualFriendsCount
                      ? `${person.mutualFriendsCount} mutual friend${person.mutualFriendsCount === 1 ? "" : "s"}`
                      : `@${person.username}`}
                  </small>
                </span>
              </button>
              <button
                type="button"
                className="sidebar-friend-suggestion__add"
                disabled={isPending}
                aria-busy={isPending}
                onClick={() => onAdd(person)}
              >
                {isPending ? (
                  <>
                    <span className="sidebar-friend-suggestion__spinner" aria-hidden="true" />
                    <span>Sending…</span>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M6.4 7.15a2.65 2.65 0 1 0 0-5.3 2.65 2.65 0 0 0 0 5.3Z" />
                      <path d="M1.75 13.65c.25-2.45 2.1-3.9 4.65-3.9 1.05 0 1.98.24 2.72.7M12.15 7.8v5M9.65 10.3h5" />
                    </svg>
                    <span>Add friend</span>
                  </>
                )}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function Sidebar({
  user,
  openChat,
  openProfile,
  friendSuggestions: controlledFriendSuggestions,
  pendingSuggestionIds: controlledPendingSuggestionIds,
  onAddSuggestedFriend,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isRaffleExpanded, setIsRaffleExpanded] = useState(false);
  const [isMobileSidebar, setIsMobileSidebar] = useState(getIsMobileSidebar);
  const [raffleVisible, setRaffleVisible] = useState(() => Boolean(user?._id));
  const [raffleCanPlay, setRaffleCanPlay] = useState(() => hasRequiredRafflePhotos(user));
  const [rafflePlayMessage, setRafflePlayMessage] = useState(() =>
    hasRequiredRafflePhotos(user) ? "" : PROFILE_MEDIA_REQUIRED_MESSAGE
  );
  const [localFriendSuggestions, setLocalFriendSuggestions] = useState([]);
  const [localPendingSuggestionIds, setLocalPendingSuggestionIds] = useState(() => new Set());
  const hasControlledFriendSuggestions = Array.isArray(controlledFriendSuggestions);
  const friendSuggestions = hasControlledFriendSuggestions
    ? controlledFriendSuggestions.slice(0, 4)
    : localFriendSuggestions;
  const pendingSuggestionIds = hasControlledFriendSuggestions
    ? controlledPendingSuggestionIds || new Set()
    : localPendingSuggestionIds;

  const avatar = resolveImage(user?.avatar) || fallbackAvatar(user?.name);
  const raffleLocallyEligible = hasRequiredRafflePhotos(user);
  const raffleVisibilityKey = [
    user?._id || "",
    user?.email || "",
    getMediaUrl(user?.avatar),
    getMediaUrl(user?.cover),
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

    setRaffleVisible(true);
    setRaffleCanPlay(raffleLocallyEligible);
    setRafflePlayMessage(
      raffleLocallyEligible ? "" : PROFILE_MEDIA_REQUIRED_MESSAGE
    );
    getRechargeRaffleStatus()
      .then((payload) => {
        if (!cancelled) {
          setRaffleVisible(payload?.visibility?.visible !== false);
          const canPlay = payload?.eligibility
            ? Boolean(payload.eligibility.eligible) && !payload?.cooldown?.active
            : raffleLocallyEligible;
          setRaffleCanPlay(canPlay);
          setRafflePlayMessage(getRafflePlayMessage(payload, raffleLocallyEligible));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRaffleVisible(true);
          setRaffleCanPlay(raffleLocallyEligible);
          setRafflePlayMessage(
            raffleLocallyEligible ? "" : PROFILE_MEDIA_REQUIRED_MESSAGE
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [raffleLocallyEligible, raffleVisibilityKey, user?._id]);

  useEffect(() => {
    let cancelled = false;
    if (!user?._id || isMobileSidebar || hasControlledFriendSuggestions) {
      return undefined;
    }

    getFriendsHub()
      .then((payload) => {
        if (!cancelled) {
          setLocalFriendSuggestions((payload?.suggestions || []).slice(0, 4));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLocalFriendSuggestions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasControlledFriendSuggestions, isMobileSidebar, user?._id]);

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
  const openRaffleGame = () => {
    if (!raffleCanPlay) {
      toast.error(rafflePlayMessage || PROFILE_MEDIA_REQUIRED_MESSAGE);
      return;
    }
    navigate("/recharge-raffle");
  };
  const openMessages = () => {
    if (typeof openChat === "function") {
      openChat();
      return;
    }

    navigate("/messages");
  };
  const openSuggestedProfile = (person) => {
    if (person?.username) {
      navigate(`/profile/${person.username}`);
    }
  };
  const addSuggestedFriend = async (person) => {
    if (typeof onAddSuggestedFriend === "function") {
      await onAddSuggestedFriend(person);
      return;
    }

    const personId = person?._id;
    if (!personId || pendingSuggestionIds.has(personId)) {
      return;
    }

    setLocalPendingSuggestionIds((current) => new Set(current).add(personId));
    try {
      await sendFriendRequest(personId);
      setLocalFriendSuggestions((current) => current.filter((entry) => entry._id !== personId));
    } catch {
      // Keep the suggestion visible so a transient request failure can be retried.
    } finally {
      setLocalPendingSuggestionIds((current) => {
        const next = new Set(current);
        next.delete(personId);
        return next;
      });
    }
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

      <FriendSuggestionsCard
        suggestions={friendSuggestions}
        pendingIds={pendingSuggestionIds}
        onAdd={addSuggestedFriend}
        onProfile={openSuggestedProfile}
        onSeeAll={() => navigate("/find-friends")}
      />

      {friendSuggestions.length ? <div className="sb-divider" /> : null}

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
