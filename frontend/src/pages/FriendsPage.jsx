import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useLocation, useNavigate } from "react-router-dom";

import Navbar from "../Navbar";
import Sidebar from "../Sidebar";
import Messenger from "../Messenger";
import {
  acceptFriendRequest,
  apiRequest,
  cancelFriendRequest,
  getFriendsHub,
  rejectFriendRequest,
  resolveImage,
  sendFriendRequest,
  unfriend,
  updateCloseFriends,
} from "../api";
import { connectSocket } from "../socket";

const SECTION_ITEMS = [
  { id: "home", label: "Home", description: "Overview", icon: "home", countKey: "" },
  {
    id: "requests",
    label: "Friend Requests",
    description: "Pending invites",
    icon: "requests",
    countKey: "incomingRequestsCount",
  },
  {
    id: "suggestions",
    label: "Suggestions",
    description: "People you may know",
    icon: "suggestions",
    countKey: "suggestionsCount",
  },
  {
    id: "friends",
    label: "All Friends",
    description: "Your network",
    icon: "friends",
    countKey: "friendsCount",
  },
  {
    id: "birthdays",
    label: "Birthdays",
    description: "Celebrate your circle",
    icon: "birthdays",
    countKey: "birthdaysCount",
  },
  {
    id: "lists",
    label: "Custom Lists",
    description: "Close friends",
    icon: "lists",
    countKey: "closeFriendsCount",
  },
];

const EMPTY_HUB = {
  stats: {
    friendsCount: 0,
    incomingRequestsCount: 0,
    outgoingRequestsCount: 0,
    suggestionsCount: 0,
    birthdaysCount: 0,
    closeFriendsCount: 0,
  },
  incomingRequests: [],
  outgoingRequests: [],
  suggestions: [],
  friends: [],
  birthdays: [],
  closeFriends: [],
};

const fallbackAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "User"
  )}&size=96&background=E3EFE7&color=1B5838`;

const normalizeShareDraft = (value = {}) => {
  const postId = String(value?.postId || "").trim();
  const url = String(value?.url || "").trim();
  if (!postId || !url) {
    return null;
  }

  return {
    postId,
    url,
    note: String(value?.note || "").trim(),
    authorName: String(value?.authorName || "Tengacion creator").trim(),
    authorUsername: String(value?.authorUsername || "").trim().replace(/^@+/, ""),
    excerpt: String(value?.excerpt || "").trim(),
    previewImage: String(value?.previewImage || "").trim(),
  };
};

const filterPeople = (list = [], query = "") => {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) {
    return Array.isArray(list) ? list : [];
  }

  return (Array.isArray(list) ? list : []).filter((entry) => {
    const haystack = `${entry?.name || ""} ${entry?.username || ""}`.toLowerCase();
    return haystack.includes(needle);
  });
};

const formatMutualFriends = (count = 0) => {
  const total = Number(count) || 0;
  if (total <= 0) {
    return "New to your circle";
  }
  if (total === 1) {
    return "1 mutual friend";
  }
  return `${total} mutual friends`;
};

function DirectoryIcon({ name }) {
  switch (name) {
    case "home":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4.2 10.6L12 4l7.8 6.6V20a1 1 0 0 1-1 1h-4.8v-5.8H10V21H5.2a1 1 0 0 1-1-1v-9.4z" />
        </svg>
      );
    case "requests":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="9" cy="8" r="3" />
          <path d="M3.8 19a5.2 5.2 0 0 1 10.4 0z" />
          <path d="M17.8 6.2v4.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M15.6 8.4H20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "suggestions":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="9" cy="8" r="3" />
          <circle cx="16.6" cy="9.2" r="2.4" />
          <path d="M3.6 19a5.3 5.3 0 0 1 10.6 0z" />
          <path d="M16.8 14.4v4.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M14.7 16.5H19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "friends":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="8" cy="8.5" r="3" />
          <circle cx="16.4" cy="9.1" r="2.8" />
          <path d="M2.8 19.2a5.2 5.2 0 0 1 10.4 0z" />
          <path d="M11.8 19.4a4.7 4.7 0 0 1 9.4 0z" />
        </svg>
      );
    case "birthdays":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="10" width="16" height="10" rx="2" />
          <rect x="4" y="8" width="16" height="3" rx="1.2" />
          <path d="M12 8v12" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 8c-1.8-.2-3-.9-3-2.2a2 2 0 0 1 3.4-1.3L12 5" />
          <path d="M12 8c1.8-.2 3-.9 3-2.2a2 2 0 0 0-3.4-1.3L12 5" />
        </svg>
      );
    case "lists":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="5" width="16" height="14" rx="3" />
          <rect x="7" y="8" width="10" height="1.8" rx=".9" fill="currentColor" />
          <rect x="7" y="12" width="7.5" height="1.8" rx=".9" fill="currentColor" />
          <rect x="7" y="16" width="9" height="1.8" rx=".9" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
}

function SectionHeader({ eyebrow, title, description, action }) {
  return (
    <div className="friends-section-head">
      <div>
        {eyebrow ? <p className="friends-section-eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action || null}
    </div>
  );
}

function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <div className="friends-empty-state">
      <strong>{title}</strong>
      <p>{description}</p>
      {actionLabel && typeof onAction === "function" ? (
        <button type="button" className="friends-page-btn ghost" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, hint }) {
  return (
    <article className="friends-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function RequestCard({
  person,
  disabled,
  confirmBusy,
  deleteBusy,
  onConfirm,
  onDelete,
  onOpenProfile,
}) {
  return (
    <article className="friends-person-card">
      <button
        type="button"
        className="friends-person-card__profile"
        onClick={() => onOpenProfile(person?.username)}
      >
        <img
          src={resolveImage(person?.avatar) || fallbackAvatar(person?.name)}
          alt={person?.name || "User"}
        />
        <div>
          <strong>{person?.name || "Unknown user"}</strong>
          <span>@{person?.username || "unknown"}</span>
          <small>{formatMutualFriends(person?.mutualFriendsCount)}</small>
        </div>
      </button>
      <div className="friends-person-card__actions">
        <button
          type="button"
          className="friends-page-btn primary"
          onClick={onConfirm}
          disabled={disabled}
        >
          {confirmBusy ? "Confirming..." : "Confirm"}
        </button>
        <button
          type="button"
          className="friends-page-btn ghost"
          onClick={onDelete}
          disabled={disabled}
        >
          {deleteBusy ? "Removing..." : "Delete"}
        </button>
      </div>
    </article>
  );
}

function SuggestionCard({ person, disabled, addBusy, onAdd, onOpenProfile }) {
  return (
    <article className="friends-person-card">
      <button
        type="button"
        className="friends-person-card__profile"
        onClick={() => onOpenProfile(person?.username)}
      >
        <img
          src={resolveImage(person?.avatar) || fallbackAvatar(person?.name)}
          alt={person?.name || "User"}
        />
        <div>
          <strong>{person?.name || "Unknown user"}</strong>
          <span>@{person?.username || "unknown"}</span>
          <small>{formatMutualFriends(person?.mutualFriendsCount)}</small>
        </div>
      </button>
      <div className="friends-person-card__actions friends-person-card__actions--single">
        <button
          type="button"
          className="friends-page-btn primary"
          onClick={onAdd}
          disabled={disabled}
        >
          {addBusy ? "Sending..." : "Add friend"}
        </button>
      </div>
    </article>
  );
}

function FriendRow({
  person,
  busy,
  onOpenProfile,
  onToggleCloseFriend,
  onRemoveFriend,
  closeFriendBusy,
  removeBusy,
  extraActionLabel = "",
  extraActionBusy = false,
  onExtraAction,
}) {
  return (
    <article className="friends-row-card">
      <button
        type="button"
        className="friends-row-card__profile"
        onClick={() => onOpenProfile(person?.username)}
      >
        <img
          src={resolveImage(person?.avatar) || fallbackAvatar(person?.name)}
          alt={person?.name || "User"}
        />
        <div>
          <strong>{person?.name || "Unknown user"}</strong>
          <span>@{person?.username || "unknown"}</span>
          <small>{formatMutualFriends(person?.mutualFriendsCount)}</small>
        </div>
      </button>

      <div className="friends-row-card__meta">
        {person?.isCloseFriend ? (
          <span className="friends-tag">Close friends</span>
        ) : (
          <span className="friends-tag friends-tag--muted">Friend</span>
        )}
        {person?.birthdayLabel ? (
          <span className="friends-tag friends-tag--soft">
            {person?.birthdayIsToday ? "Birthday today" : `Birthday ${person.birthdayLabel}`}
          </span>
        ) : null}
      </div>

      <div className="friends-row-card__actions">
        {typeof onExtraAction === "function" ? (
          <button
            type="button"
            className="friends-page-btn primary"
            onClick={onExtraAction}
            disabled={busy}
          >
            {extraActionBusy ? "Opening..." : extraActionLabel || "Share"}
          </button>
        ) : null}
        <button
          type="button"
          className="friends-page-btn ghost"
          onClick={onToggleCloseFriend}
          disabled={busy}
        >
          {closeFriendBusy
            ? person?.isCloseFriend
              ? "Updating..."
              : "Adding..."
            : person?.isCloseFriend
              ? "Remove from close friends"
              : "Add to close friends"}
        </button>
        <button
          type="button"
          className="friends-page-btn subtle-danger"
          onClick={onRemoveFriend}
          disabled={busy}
        >
          {removeBusy ? "Removing..." : "Remove friend"}
        </button>
      </div>
    </article>
  );
}

function BirthdayRow({ person, onOpenProfile }) {
  return (
    <article className="friends-row-card friends-row-card--birthday">
      <button
        type="button"
        className="friends-row-card__profile"
        onClick={() => onOpenProfile(person?.username)}
      >
        <img
          src={resolveImage(person?.avatar) || fallbackAvatar(person?.name)}
          alt={person?.name || "User"}
        />
        <div>
          <strong>{person?.name || "Unknown user"}</strong>
          <span>@{person?.username || "unknown"}</span>
          <small>
            {person?.birthdayIsToday
              ? "Celebrate them today"
              : `Coming up ${person?.birthdayLabel || "soon"}`}
          </small>
        </div>
      </button>
      <div className="friends-row-card__meta">
        <span className={`friends-tag${person?.birthdayIsToday ? " friends-tag--accent" : ""}`}>
          {person?.birthdayLabel || "Upcoming"}
        </span>
        {person?.isCloseFriend ? <span className="friends-tag">Close friends</span> : null}
      </div>
    </article>
  );
}

export default function FriendsPage({ user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const shareDraft = normalizeShareDraft(location.state?.sharePost);
  const [hub, setHub] = useState(EMPTY_HUB);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("home");
  const [search, setSearch] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMinimized, setChatMinimized] = useState(false);
  const [chatDockMeta, setChatDockMeta] = useState(null);
  const [selectedChatId, setSelectedChatId] = useState("");

  const loadHub = useCallback(async ({ silent = false } = {}) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");
      const payload = await getFriendsHub();
      setHub({
        ...EMPTY_HUB,
        ...(payload || {}),
        stats: {
          ...EMPTY_HUB.stats,
          ...(payload?.stats || {}),
        },
        incomingRequests: Array.isArray(payload?.incomingRequests) ? payload.incomingRequests : [],
        outgoingRequests: Array.isArray(payload?.outgoingRequests) ? payload.outgoingRequests : [],
        suggestions: Array.isArray(payload?.suggestions) ? payload.suggestions : [],
        friends: Array.isArray(payload?.friends) ? payload.friends : [],
        birthdays: Array.isArray(payload?.birthdays) ? payload.birthdays : [],
        closeFriends: Array.isArray(payload?.closeFriends) ? payload.closeFriends : [],
      });
    } catch (err) {
      setError(err?.message || "Failed to load your friends hub");
      if (!silent) {
        setHub(EMPTY_HUB);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadHub();
  }, [loadHub]);

  useEffect(() => {
    if (shareDraft?.postId) {
      setActiveSection("friends");
    }
  }, [shareDraft?.postId]);

  useEffect(() => {
    if (!user?._id) {
      return undefined;
    }

    const socket = connectSocket({ userId: user._id });
    if (!socket) {
      return undefined;
    }

    const syncHub = () => {
      void loadHub({ silent: true });
    };

    socket.on("friend:request", syncHub);
    socket.on("friend:accepted", syncHub);

    return () => {
      socket.off("friend:request", syncHub);
      socket.off("friend:accepted", syncHub);
    };
  }, [loadHub, user?._id]);

  const runAction = useCallback(
    async ({ key, task, successMessage }) => {
      if (busyKey) {
        return;
      }

      try {
        setBusyKey(key);
        await task();
        if (successMessage) {
          toast.success(successMessage);
        }
        await loadHub({ silent: true });
      } catch (err) {
        toast.error(err?.message || "Action failed");
      } finally {
        setBusyKey("");
      }
    },
    [busyKey, loadHub]
  );

  const openProfile = (username) => {
    if (!username) {
      return;
    }
    navigate(`/profile/${username}`);
  };

  const copyShareLink = useCallback(async () => {
    if (!shareDraft?.url) {
      return;
    }

    try {
      await navigator.clipboard.writeText(shareDraft.url);
      toast.success("Post link copied.");
    } catch (err) {
      toast.error(err?.message || "Failed to copy the share link");
    }
  }, [shareDraft?.url]);

  const shareToProfile = useCallback(
    async (person) => {
      const personId = String(person?._id || "").trim();
      const username = String(person?.username || "").trim();
      if (!shareDraft?.postId || !personId || !username || busyKey) {
        return;
      }

      const key = `share-profile:${personId}`;
      try {
        setBusyKey(key);
        await apiRequest(`/api/posts/${encodeURIComponent(shareDraft.postId)}/share`, {
          method: "POST",
        }).catch(() => null);

        navigate(`/profile/${username}`, {
          state: {
            sharedPost: {
              ...shareDraft,
              targetName: String(person?.name || "").trim(),
              targetUsername: username,
              sharedAt: new Date().toISOString(),
            },
          },
        });
        toast.success(`Opened ${person?.name || username}'s profile with this post ready to share.`);
      } catch (err) {
        toast.error(err?.message || "Failed to prepare this profile share");
      } finally {
        setBusyKey("");
      }
    },
    [busyKey, navigate, shareDraft]
  );

  const logout = () => {
    navigate("/");
  };

  const incomingRequests = filterPeople(hub.incomingRequests, search);
  const suggestions = filterPeople(hub.suggestions, search);
  const friends = filterPeople(hub.friends, search);
  const birthdays = filterPeople(hub.birthdays, search);
  const closeFriends = filterPeople(hub.closeFriends, search);
  const outgoingRequests = filterPeople(hub.outgoingRequests, search);

  const pageTitle =
    shareDraft
      ? "Choose a friend's profile and continue the share from there."
      : activeSection === "home"
      ? "All the people that matter, in one place."
      : activeSection === "requests"
        ? "Review the invites waiting on you."
        : activeSection === "suggestions"
          ? "Find more people you may want to know."
          : activeSection === "friends"
            ? "Manage your full Tengacion friends list."
            : activeSection === "birthdays"
              ? "Keep up with upcoming celebrations."
              : "Shape your close-friends list.";

  const renderHomeSection = () => (
    <>
      <section className="card friends-panel friends-panel--hero">
        <SectionHeader
          eyebrow="Connections"
          title="Friends"
          description="See requests, discover people you may know, and keep your close circle organized."
        />
        <div className="friends-stat-grid">
          <StatCard
            label="Requests"
            value={hub.stats.incomingRequestsCount}
            hint="Waiting on you"
          />
          <StatCard
            label="Friends"
            value={hub.stats.friendsCount}
            hint="In your network"
          />
          <StatCard
            label="Suggestions"
            value={hub.stats.suggestionsCount}
            hint="Ready to connect"
          />
          <StatCard
            label="Birthdays"
            value={hub.stats.birthdaysCount}
            hint="Celebrations ahead"
          />
        </div>
      </section>

      <section className="friends-panel-grid">
        <section className="card friends-panel">
          <SectionHeader
            title="Pending friend requests"
            description="Confirm or clear the people waiting to join your circle."
            action={
              <button
                type="button"
                className="friends-page-btn ghost"
                onClick={() => setActiveSection("requests")}
              >
                See all
              </button>
            }
          />
          {incomingRequests.length > 0 ? (
            <div className="friends-card-grid">
              {incomingRequests.slice(0, 4).map((person) => (
                <RequestCard
                  key={person._id}
                  person={person}
                  disabled={Boolean(busyKey)}
                  confirmBusy={busyKey === `accept:${person._id}`}
                  deleteBusy={busyKey === `reject:${person._id}`}
                  onConfirm={() =>
                    runAction({
                      key: `accept:${person._id}`,
                      task: () => acceptFriendRequest(person._id),
                      successMessage: `${person.name} is now your friend.`,
                    })
                  }
                  onDelete={() =>
                    runAction({
                      key: `reject:${person._id}`,
                      task: () => rejectFriendRequest(person._id),
                      successMessage: "Friend request removed.",
                    })
                  }
                  onOpenProfile={openProfile}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No pending requests"
              description="When someone adds you, they will appear here."
              actionLabel="Browse suggestions"
              onAction={() => setActiveSection("suggestions")}
            />
          )}
        </section>

        <section className="card friends-panel">
          <SectionHeader
            title="Birthdays"
            description="Keep track of close celebrations."
            action={
              <button
                type="button"
                className="friends-page-btn ghost"
                onClick={() => setActiveSection("birthdays")}
              >
                Open birthdays
              </button>
            }
          />
          {birthdays.length > 0 ? (
            <div className="friends-row-stack">
              {birthdays.slice(0, 4).map((person) => (
                <BirthdayRow key={person._id} person={person} onOpenProfile={openProfile} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No visible birthdays yet"
              description="As friends share their birthday, this section will light up."
            />
          )}
        </section>

        <section className="card friends-panel friends-panel--wide">
          <SectionHeader
            title="People you may know"
            description="Suggestions based on your existing network."
            action={
              <button
                type="button"
                className="friends-page-btn ghost"
                onClick={() => setActiveSection("suggestions")}
              >
                Explore suggestions
              </button>
            }
          />
          {suggestions.length > 0 ? (
            <div className="friends-card-grid">
              {suggestions.slice(0, 6).map((person) => (
                <SuggestionCard
                  key={person._id}
                  person={person}
                  disabled={Boolean(busyKey)}
                  addBusy={busyKey === `request:${person._id}`}
                  onAdd={() =>
                    runAction({
                      key: `request:${person._id}`,
                      task: () => sendFriendRequest(person._id),
                      successMessage: "Friend request sent.",
                    })
                  }
                  onOpenProfile={openProfile}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No fresh suggestions right now"
              description="You are caught up. Check back after more people join your orbit."
            />
          )}
        </section>

        <section className="card friends-panel">
          <SectionHeader
            title="Custom lists"
            description="Keep your closest people one tap away."
            action={
              <button
                type="button"
                className="friends-page-btn ghost"
                onClick={() => setActiveSection("lists")}
              >
                Manage lists
              </button>
            }
          />
          {closeFriends.length > 0 ? (
            <div className="friends-row-stack">
              {closeFriends.slice(0, 4).map((person) => (
                <FriendRow
                  key={person._id}
                  person={person}
                  busy={Boolean(busyKey)}
                  closeFriendBusy={busyKey === `close:${person._id}`}
                  removeBusy={busyKey === `unfriend:${person._id}`}
                  onOpenProfile={openProfile}
                  onToggleCloseFriend={() =>
                    runAction({
                      key: `close:${person._id}`,
                      task: () => updateCloseFriends({ remove: [person._id] }),
                      successMessage: "Removed from close friends.",
                    })
                  }
                  onRemoveFriend={() =>
                    runAction({
                      key: `unfriend:${person._id}`,
                      task: () => unfriend(person._id),
                      successMessage: "Friend removed.",
                    })
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Your custom list is empty"
              description="Mark a few people as close friends to surface them here."
            />
          )}
        </section>

        {outgoingRequests.length > 0 ? (
          <section className="card friends-panel">
            <SectionHeader
              title="Sent requests"
              description="Requests you have already sent."
            />
            <div className="friends-row-stack">
              {outgoingRequests.slice(0, 4).map((person) => (
                <article key={person._id} className="friends-row-card">
                  <button
                    type="button"
                    className="friends-row-card__profile"
                    onClick={() => openProfile(person.username)}
                  >
                    <img
                      src={resolveImage(person.avatar) || fallbackAvatar(person.name)}
                      alt={person.name || "User"}
                    />
                    <div>
                      <strong>{person.name || "Unknown user"}</strong>
                      <span>@{person.username || "unknown"}</span>
                      <small>{formatMutualFriends(person.mutualFriendsCount)}</small>
                    </div>
                  </button>
                  <div className="friends-row-card__actions">
                    <button
                      type="button"
                      className="friends-page-btn ghost"
                      onClick={() =>
                        runAction({
                          key: `cancel:${person._id}`,
                          task: () => cancelFriendRequest(person._id),
                          successMessage: "Friend request canceled.",
                        })
                      }
                      disabled={Boolean(busyKey)}
                    >
                      {busyKey === `cancel:${person._id}` ? "Canceling..." : "Cancel request"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </>
  );

  const renderRequestsSection = () => (
    <section className="card friends-panel">
      <SectionHeader
        title="Friend Requests"
        description="Approve the people you want to keep close."
      />
      {incomingRequests.length > 0 ? (
        <div className="friends-card-grid">
          {incomingRequests.map((person) => (
            <RequestCard
              key={person._id}
              person={person}
              disabled={Boolean(busyKey)}
              confirmBusy={busyKey === `accept:${person._id}`}
              deleteBusy={busyKey === `reject:${person._id}`}
              onConfirm={() =>
                runAction({
                  key: `accept:${person._id}`,
                  task: () => acceptFriendRequest(person._id),
                  successMessage: `${person.name} is now your friend.`,
                })
              }
              onDelete={() =>
                runAction({
                  key: `reject:${person._id}`,
                  task: () => rejectFriendRequest(person._id),
                  successMessage: "Friend request removed.",
                })
              }
              onOpenProfile={openProfile}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No pending requests"
          description="You are all caught up for now."
          actionLabel="Go to home"
          onAction={() => setActiveSection("home")}
        />
      )}
    </section>
  );

  const renderSuggestionsSection = () => (
    <section className="card friends-panel">
      <SectionHeader
        title="Suggestions"
        description="People you may know from your growing network."
      />
      {suggestions.length > 0 ? (
        <div className="friends-card-grid">
          {suggestions.map((person) => (
            <SuggestionCard
              key={person._id}
              person={person}
              disabled={Boolean(busyKey)}
              addBusy={busyKey === `request:${person._id}`}
              onAdd={() =>
                runAction({
                  key: `request:${person._id}`,
                  task: () => sendFriendRequest(person._id),
                  successMessage: "Friend request sent.",
                })
              }
              onOpenProfile={openProfile}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No suggestions available"
          description="Try again later after more people connect around you."
          actionLabel="Refresh"
          onAction={() => {
            void loadHub({ silent: true });
          }}
        />
      )}
    </section>
  );

  const renderFriendsSection = () => (
    <section className="card friends-panel">
      <SectionHeader
        title="All Friends"
        description={
          shareDraft
            ? "Pick a friend below to open their profile with this post ready to share."
            : "Every connection in your Tengacion circle."
        }
      />
      {friends.length > 0 ? (
        <div className="friends-row-stack">
          {friends.map((person) => (
            <FriendRow
              key={person._id}
              person={person}
              busy={Boolean(busyKey)}
              closeFriendBusy={busyKey === `close:${person._id}`}
              removeBusy={busyKey === `unfriend:${person._id}`}
              onOpenProfile={openProfile}
              onToggleCloseFriend={() =>
                runAction({
                  key: `close:${person._id}`,
                  task: () =>
                    person.isCloseFriend
                      ? updateCloseFriends({ remove: [person._id] })
                      : updateCloseFriends({ add: [person._id] }),
                  successMessage: person.isCloseFriend
                    ? "Removed from close friends."
                    : "Added to close friends.",
                })
              }
              onRemoveFriend={() =>
                runAction({
                  key: `unfriend:${person._id}`,
                  task: () => unfriend(person._id),
                  successMessage: "Friend removed.",
                })
              }
              extraActionLabel={shareDraft ? "Share to profile" : ""}
              extraActionBusy={busyKey === `share-profile:${person._id}`}
              onExtraAction={
                shareDraft
                  ? () => {
                      void shareToProfile(person);
                    }
                  : undefined
              }
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title={shareDraft ? "No friends available for this share" : "No friends yet"}
          description={
            shareDraft
              ? "Add a few friends first, then come back here to share directly to their profiles."
              : "Start with suggestions to grow your network."
          }
          actionLabel="See suggestions"
          onAction={() => setActiveSection("suggestions")}
        />
      )}
    </section>
  );

  const renderBirthdaysSection = () => (
    <section className="card friends-panel">
      <SectionHeader
        title="Birthdays"
        description="Upcoming celebrations from the friends who share their date with you."
      />
      {birthdays.length > 0 ? (
        <div className="friends-row-stack">
          {birthdays.map((person) => (
            <BirthdayRow key={person._id} person={person} onOpenProfile={openProfile} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No birthdays to show"
          description="This list will populate when friends add their birthday and make it visible."
        />
      )}
    </section>
  );

  const renderListsSection = () => (
    <>
      <section className="card friends-panel">
        <SectionHeader
          title="Close Friends"
          description="Your favorite people for faster check-ins and tighter sharing."
        />
        {closeFriends.length > 0 ? (
          <div className="friends-row-stack">
            {closeFriends.map((person) => (
              <FriendRow
                key={person._id}
                person={person}
                busy={Boolean(busyKey)}
                closeFriendBusy={busyKey === `close:${person._id}`}
                removeBusy={busyKey === `unfriend:${person._id}`}
                onOpenProfile={openProfile}
                onToggleCloseFriend={() =>
                  runAction({
                    key: `close:${person._id}`,
                    task: () => updateCloseFriends({ remove: [person._id] }),
                    successMessage: "Removed from close friends.",
                  })
                }
                onRemoveFriend={() =>
                  runAction({
                    key: `unfriend:${person._id}`,
                    task: () => unfriend(person._id),
                    successMessage: "Friend removed.",
                  })
                }
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No close friends yet"
            description="Use the button on any friend to pin them into your custom list."
          />
        )}
      </section>

      <section className="card friends-panel">
        <SectionHeader
          title="Manage Custom List"
          description="Promote or remove friends from your close-friends list."
        />
        {friends.length > 0 ? (
          <div className="friends-row-stack">
            {friends.map((person) => (
              <FriendRow
                key={person._id}
                person={person}
                busy={Boolean(busyKey)}
                closeFriendBusy={busyKey === `close:${person._id}`}
                removeBusy={busyKey === `unfriend:${person._id}`}
                onOpenProfile={openProfile}
                onToggleCloseFriend={() =>
                  runAction({
                    key: `close:${person._id}`,
                    task: () =>
                      person.isCloseFriend
                        ? updateCloseFriends({ remove: [person._id] })
                        : updateCloseFriends({ add: [person._id] }),
                    successMessage: person.isCloseFriend
                      ? "Removed from close friends."
                      : "Added to close friends.",
                  })
                }
                onRemoveFriend={() =>
                  runAction({
                    key: `unfriend:${person._id}`,
                    task: () => unfriend(person._id),
                    successMessage: "Friend removed.",
                  })
                }
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No friends available"
            description="Add a few friends first, then build your custom list."
          />
        )}
      </section>
    </>
  );

  const renderActiveSection = () => {
    if (loading) {
      return (
        <section className="card friends-panel">
          <div className="friends-loading-state">
            <strong>Loading your friends hub...</strong>
            <p>Pulling requests, suggestions, birthdays, and your current network.</p>
          </div>
        </section>
      );
    }

    switch (activeSection) {
      case "requests":
        return renderRequestsSection();
      case "suggestions":
        return renderSuggestionsSection();
      case "friends":
        return renderFriendsSection();
      case "birthdays":
        return renderBirthdaysSection();
      case "lists":
        return renderListsSection();
      case "home":
      default:
        return renderHomeSection();
    }
  };

  return (
    <>
      <Navbar
        user={user}
        onLogout={logout}
        onOpenMessenger={(payload = {}) => {
          setSelectedChatId(String(payload?.contactId || ""));
          if (payload?.contact) {
            setChatDockMeta({
              name: payload.contact?.name || payload.contact?.username || "Messenger",
              avatar: payload.contact?.avatar || "",
            });
          }
          setChatOpen(true);
          setChatMinimized(false);
        }}
        onOpenCreatePost={(target = "post") => {
          if (target === "story") {
            navigate("/home", { state: { openStoryCreator: true } });
            return;
          }

          navigate("/home", {
            state: {
              openComposer: true,
              composerMode: target === "reel" ? "reel" : "",
            },
          });
        }}
      />

      <div className="app-shell friends-shell">
        <aside className="sidebar">
          <Sidebar
            user={user}
            openChat={() => {
              setSelectedChatId("");
              setChatOpen(true);
              setChatMinimized(false);
            }}
            openProfile={() => {
              if (user?.username) {
                navigate(`/profile/${user.username}`);
              }
            }}
          />
        </aside>

        <main className="feed friends-main">
          <section className="card friends-page-frame">
            <div className="friends-page-frame__head">
              <div>
                <p className="friends-page-frame__eyebrow">Social</p>
                <h1>Friends</h1>
                <p>{pageTitle}</p>
              </div>

              <div className="friends-page-frame__controls">
                <label className="friends-page-search">
                  <span className="sr-only">Search friends page</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={
                      activeSection === "home"
                        ? "Search your people"
                        : activeSection === "birthdays"
                          ? "Search birthday list"
                          : "Search by name or username"
                    }
                  />
                </label>
                <button
                  type="button"
                  className="friends-page-btn ghost"
                  onClick={() => {
                    void loadHub({ silent: true });
                  }}
                  disabled={refreshing}
                >
                  {refreshing ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>

            {shareDraft ? (
              <section className="friends-share-banner">
                <div className="friends-share-banner__content">
                  <p className="friends-share-banner__eyebrow">Friend profile share</p>
                  <strong>
                    {shareDraft.authorName}
                    {shareDraft.authorUsername ? ` @${shareDraft.authorUsername}` : ""}
                  </strong>
                  <p>
                    {shareDraft.note || shareDraft.excerpt || "Open a friend's profile below and keep this post ready to share."}
                  </p>
                  <small>{shareDraft.url}</small>
                </div>
                <div className="friends-share-banner__actions">
                  <button type="button" className="friends-page-btn primary" onClick={() => void copyShareLink()}>
                    Copy link
                  </button>
                  <button
                    type="button"
                    className="friends-page-btn ghost"
                    onClick={() => navigate(`/posts/${shareDraft.postId}/share`)}
                  >
                    Back to share
                  </button>
                </div>
              </section>
            ) : null}

            {error ? <p className="friends-page-error">{error}</p> : null}

            <div className="friends-page-workspace">
              <aside className="friends-directory-nav">
                <div className="friends-directory-nav__items">
                  {SECTION_ITEMS.map((item) => {
                    const count = item.countKey ? hub.stats?.[item.countKey] || 0 : 0;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`friends-directory-nav__item${
                          activeSection === item.id ? " active" : ""
                        }`}
                        onClick={() => setActiveSection(item.id)}
                      >
                        <span className="friends-directory-nav__icon" aria-hidden="true">
                          <DirectoryIcon name={item.icon} />
                        </span>
                        <span className="friends-directory-nav__copy">
                          <b>{item.label}</b>
                          <small>{item.description}</small>
                        </span>
                        {item.countKey ? (
                          <span className="friends-directory-nav__count">{count}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <div className="friends-directory-nav__foot">
                  <strong>{hub.stats.closeFriendsCount} close friends</strong>
                  <p>Curate your inner circle and keep the important people close.</p>
                </div>
              </aside>

              <div className="friends-page-content">{renderActiveSection()}</div>
            </div>
          </section>
        </main>
      </div>

      {chatOpen ? (
        <section className="messenger-panel">
          <Messenger
            user={user}
            initialSelectedId={selectedChatId}
            conversationOnly={Boolean(selectedChatId)}
            onClose={() => {
              setSelectedChatId("");
              setChatOpen(false);
              setChatMinimized(false);
            }}
            onMinimize={(meta) => {
              setChatDockMeta(meta || null);
              setChatOpen(false);
              setChatMinimized(true);
            }}
          />
        </section>
      ) : null}

      {!chatOpen && chatMinimized ? (
        <button
          type="button"
          className="messenger-dock friends-messenger-dock"
          onClick={() => {
            setChatOpen(true);
            setChatMinimized(false);
          }}
          title="Restore chat"
        >
          <img
            src={resolveImage(chatDockMeta?.avatar) || resolveImage(user?.avatar) || "/avatar.png"}
            alt=""
          />
          <span>{chatDockMeta?.name || "Messenger"}</span>
        </button>
      ) : null}
    </>
  );
}
