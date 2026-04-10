import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

import Navbar from "../Navbar";
import Sidebar from "../Sidebar";
import Messenger from "../Messenger";
import {
  cancelFriendRequest,
  getFriendDirectory,
  resolveImage,
  sendFriendRequest,
} from "../api";

const PAGE_SIZE = 18;

const fallbackAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "User"
  )}&size=96&background=E3EFE7&color=1B5838`;

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

const getRelationshipCopy = (person = {}) => {
  const status = String(person?.relationship?.status || person?.relationshipStatus || "none");

  switch (status) {
    case "friends":
      return {
        badge: "Friends",
        actionLabel: "View profile",
        actionTone: "ghost",
      };
    case "request_sent":
      return {
        badge: "Request sent",
        actionLabel: "Cancel request",
        actionTone: "ghost",
      };
    case "request_received":
      return {
        badge: "Requested you",
        actionLabel: "View profile",
        actionTone: "ghost",
      };
    default:
      return {
        badge: "New on Tengacion",
        actionLabel: "Add friend",
        actionTone: "primary",
      };
  }
};

function StatCard({ label, value, hint }) {
  return (
    <article className="friends-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function DirectoryCard({ person, busy, onAction, onOpenProfile }) {
  const status = String(person?.relationship?.status || person?.relationshipStatus || "none");
  const relationship = getRelationshipCopy(person);

  return (
    <article className="friends-person-card find-friends-card">
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
          className={`friends-page-btn${relationship.actionTone === "primary" ? " primary" : " ghost"}`}
          onClick={() => onAction(person)}
          disabled={busy}
        >
          {relationship.actionLabel}
        </button>
      </div>

      <div className="find-friends-card__footer">
        <span className="friends-tag friends-tag--soft">{relationship.badge}</span>
        <span className="find-friends-card__hint">
          {status === "none"
            ? "Send a request and start a connection."
            : status === "request_sent"
              ? "You already reached out."
              : "Open the profile for more context."}
        </span>
      </div>
    </article>
  );
}

function DirectorySkeleton() {
  return (
    <article className="friends-person-card find-friends-card find-friends-card--skeleton" aria-hidden="true">
      <div className="find-friends-card__skeleton-avatar" />
      <div className="find-friends-card__skeleton-copy">
        <div className="find-friends-card__skeleton-line find-friends-card__skeleton-line--wide" />
        <div className="find-friends-card__skeleton-line" />
        <div className="find-friends-card__skeleton-line find-friends-card__skeleton-line--short" />
      </div>
    </article>
  );
}

export default function FindFriendsPage({ user }) {
  const navigate = useNavigate();
  const messengerRef = useRef(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [busyPersonId, setBusyPersonId] = useState("");
  const requestSeqRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 280);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const fetchDirectory = useCallback(
    async ({ nextPage = 1, replace = true } = {}) => {
      const requestId = ++requestSeqRef.current;
      if (replace) {
        setLoading(true);
        setError("");
      } else {
        setLoadingMore(true);
      }

      try {
        const payload = await getFriendDirectory({
          search,
          page: nextPage,
          limit: PAGE_SIZE,
        });

        if (requestId !== requestSeqRef.current) {
          return;
        }

        const nextItems = Array.isArray(payload?.items) ? payload.items : [];
        setHasMore(Boolean(payload?.hasMore));
        setTotal(Number(payload?.total || nextItems.length || 0));
        setItems((current) => (replace ? nextItems : [...current, ...nextItems]));
      } catch (err) {
        if (requestId !== requestSeqRef.current) {
          return;
        }
        setError(err?.message || "Could not load people right now.");
        toast.error(err?.message || "Could not load people right now.");
      } finally {
        if (requestId === requestSeqRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [search]
  );

  useEffect(() => {
    void fetchDirectory({ nextPage: page, replace: page === 1 });
  }, [fetchDirectory, page]);

  const onOpenProfile = useCallback(
    (username) => {
      if (!username) {
        return;
      }
      navigate(`/profile/${username}`);
    },
    [navigate]
  );

  const patchPerson = useCallback((personId, patch) => {
    const targetId = String(personId || "").trim();
    if (!targetId) {
      return;
    }

    setItems((current) =>
      current.map((entry) => {
        if (String(entry?._id || "") !== targetId) {
          return entry;
        }

        const nextRelationship = {
          ...(entry.relationship || {}),
          ...patch,
        };

        return {
          ...entry,
          relationship: nextRelationship,
          relationshipStatus: nextRelationship.status || entry.relationshipStatus || "none",
        };
      })
    );
  }, []);

  const handleAction = useCallback(
    async (person) => {
      const personId = String(person?._id || "").trim();
      if (!personId || loading || loadingMore || busyPersonId) {
        return;
      }

      const status = String(person?.relationship?.status || person?.relationshipStatus || "none");

      try {
        setBusyPersonId(personId);

        if (status === "request_sent") {
          await cancelFriendRequest(personId);
          patchPerson(personId, {
            status: "none",
            isFriend: false,
            canRequest: true,
            canCancelRequest: false,
            hasSentRequest: false,
            hasIncomingRequest: false,
          });
          toast.success("Friend request canceled.");
          return;
        }

        if (status === "none") {
          await sendFriendRequest(personId);
          patchPerson(personId, {
            status: "request_sent",
            isFriend: false,
            canRequest: false,
            canCancelRequest: true,
            hasSentRequest: true,
            hasIncomingRequest: false,
          });
          toast.success("Friend request sent.");
          return;
        }

        onOpenProfile(person?.username);
      } catch (err) {
        toast.error(err?.message || "Action failed");
      } finally {
        setBusyPersonId("");
      }
    },
    [busyPersonId, loading, loadingMore, onOpenProfile, patchPerson]
  );

  const handleLoadMore = () => {
    if (!hasMore || loadingMore) {
      return;
    }

    setPage((current) => current + 1);
  };

  const resultsLabel = useMemo(() => {
    if (loading && !items.length) {
      return "Loading people...";
    }
    if (error) {
      return "Find Friends paused";
    }
    return `${total.toLocaleString()} registered accounts`;
  }, [error, items.length, loading, total]);

  return (
    <>
      <Navbar user={user} onLogout={() => navigate("/")} />

      <div className="app-shell friends-shell">
        <aside className="sidebar">
          <Sidebar
            user={user}
            openChat={() => {
              messengerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
                <h1>Find Friends</h1>
                <p>Browse every registered Tengacion account, spot familiar faces, and send a request in one tap.</p>
              </div>

              <div className="friends-page-frame__controls">
                <button
                  type="button"
                  className="friends-page-btn ghost"
                  onClick={() => navigate("/friends")}
                >
                  Back to friends
                </button>
                <button
                  type="button"
                  className="friends-page-btn ghost"
                  onClick={() => {
                    void fetchDirectory({ nextPage: 1, replace: true });
                  }}
                  disabled={loading}
                >
                  {loading ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>

            <section className="card friends-panel find-friends-hero">
              <div className="find-friends-hero__copy">
                <p className="friends-section-eyebrow">People discovery</p>
                <h2>Facebook-style friend finding, tuned for Tengacion.</h2>
                <p>
                  Search the whole community, check mutual friends, and choose who to connect with next.
                </p>
              </div>
              <div className="friends-stat-grid find-friends-hero__stats">
                <StatCard label="Registered" value={total} hint="Accounts on Tengacion" />
                <StatCard
                  label="Visible now"
                  value={items.length}
                  hint={search ? "Search results" : "Loaded on screen"}
                />
                <StatCard label="Batch size" value={PAGE_SIZE} hint="Profiles per load" />
              </div>
            </section>

            <label className="find-friends-search">
              <span className="sr-only">Search Tengacion accounts</span>
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by name or @username"
                aria-label="Search Tengacion accounts"
              />
            </label>

            {error ? <p className="friends-page-error">{error}</p> : null}

            {loading && !items.length ? (
              <div className="friends-card-grid" aria-busy="true">
                <DirectorySkeleton />
                <DirectorySkeleton />
                <DirectorySkeleton />
              </div>
            ) : items.length > 0 ? (
              <>
                <div className="friends-card-grid">
                  {items.map((person) => (
                    <DirectoryCard
                      key={person?._id}
                      person={person}
                      busy={Boolean(loadingMore || busyPersonId === person?._id)}
                      onAction={handleAction}
                      onOpenProfile={onOpenProfile}
                    />
                  ))}
                </div>

                <div className="find-friends-footer">
                  <small>{resultsLabel}</small>
                  <button
                    type="button"
                    className="friends-page-btn ghost"
                    onClick={handleLoadMore}
                    disabled={!hasMore || loadingMore}
                  >
                    {loadingMore ? "Loading..." : hasMore ? "Load more people" : "End of results"}
                  </button>
                </div>
              </>
            ) : (
              <div className="friends-empty-state">
                <strong>No accounts matched your search</strong>
                <p>Try another name, username, or clear the search to browse everyone.</p>
                <button
                  type="button"
                  className="friends-page-btn primary"
                  onClick={() => {
                    setSearchInput("");
                    setSearch("");
                    setPage(1);
                  }}
                >
                  Clear search
                </button>
              </div>
            )}
          </section>
        </main>

        <section className="messenger" ref={messengerRef}>
          <Messenger user={user} />
        </section>
      </div>
    </>
  );
}
