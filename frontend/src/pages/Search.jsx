import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  getUsers,
  rejectFriendRequest,
  resolveImage,
  sendFriendRequest,
} from "../api";
import "../index.css";

const fallbackAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "User"
  )}&size=240&background=DFE8F6&color=1D3A6D`;

const buildRelationship = (status = "none") => ({
  status,
  isFriend: status === "friends",
  hasSentRequest: status === "request_sent",
  hasIncomingRequest: status === "request_received",
  canRequest: status === "none",
  canCancelRequest: status === "request_sent",
  canAcceptRequest: status === "request_received",
  canRejectRequest: status === "request_received",
  canUnfriend: status === "friends",
});

export default function Search() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const q = params.get("q") || "";

  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState({});

  const setBusy = (userId, value) =>
    setActionBusy((current) => ({ ...current, [userId]: value }));

  const updateRelationship = (userId, status) => {
    setUsers((current) =>
      current.map((entry) =>
        entry._id === userId
          ? { ...entry, relationship: buildRelationship(status) }
          : entry
      )
    );
  };

  useEffect(() => {
    if (!q) {
      setUsers([]);
      setPosts([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    Promise.all([
      getUsers(q),
      fetch(`/api/posts?search=${encodeURIComponent(q)}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }).then((response) => response.json()),
    ])
      .then(([people, postResults]) => {
        setUsers(Array.isArray(people) ? people : []);
        setPosts(Array.isArray(postResults) ? postResults : []);
      })
      .catch(() => {
        setUsers([]);
        setPosts([]);
      })
      .finally(() => setLoading(false));
  }, [q]);

  const runAction = async (event, userId, action) => {
    event.stopPropagation();
    if (!userId || actionBusy[userId]) {
      return;
    }

    try {
      setBusy(userId, true);

      if (action === "request") {
        await sendFriendRequest(userId);
        updateRelationship(userId, "request_sent");
        return;
      }

      if (action === "cancel") {
        await cancelFriendRequest(userId);
        updateRelationship(userId, "none");
        return;
      }

      if (action === "accept") {
        await acceptFriendRequest(userId);
        updateRelationship(userId, "friends");
        return;
      }

      if (action === "reject") {
        await rejectFriendRequest(userId);
        updateRelationship(userId, "none");
      }
    } catch {
      // Keep UI unchanged if the server action fails.
    } finally {
      setBusy(userId, false);
    }
  };

  const renderRelationshipActions = (user) => {
    const status = user?.relationship?.status || "none";
    const busy = Boolean(actionBusy[user._id]);

    if (status === "request_received") {
      return (
        <div className="search-person-actions" onClick={(event) => event.stopPropagation()}>
          <button
            className="search-person-btn primary"
            onClick={(event) => runAction(event, user._id, "accept")}
            disabled={busy}
          >
            {busy ? "Confirming..." : "Confirm"}
          </button>
          <button
            className="search-person-btn"
            onClick={(event) => runAction(event, user._id, "reject")}
            disabled={busy}
          >
            Delete
          </button>
        </div>
      );
    }

    if (status === "request_sent") {
      return (
        <div className="search-person-actions" onClick={(event) => event.stopPropagation()}>
          <button
            className="search-person-btn"
            onClick={(event) => runAction(event, user._id, "cancel")}
            disabled={busy}
          >
            {busy ? "Cancelling..." : "Cancel request"}
          </button>
        </div>
      );
    }

    if (status === "friends") {
      return (
        <div className="search-person-actions" onClick={(event) => event.stopPropagation()}>
          <button className="search-person-btn subtle" disabled>
            Friends
          </button>
        </div>
      );
    }

    return (
      <div className="search-person-actions" onClick={(event) => event.stopPropagation()}>
        <button
          className="search-person-btn primary"
          onClick={(event) => runAction(event, user._id, "request")}
          disabled={busy}
        >
          {busy ? "Sending..." : "Add Friend"}
        </button>
      </div>
    );
  };

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: "auto" }}>
      <h2>Search results for: "{q}"</h2>

      {loading && <p>Searching Tengacion...</p>}

      <div className="card" style={{ marginTop: 16 }}>
        <h3>People</h3>

        {!loading && users.length === 0 && <p>No people found</p>}

        {users.map((entry) => {
          const avatarSrc = entry?.avatar
            ? resolveImage(entry.avatar)
            : fallbackAvatar(entry?.name || "User");

          return (
            <div
              key={entry._id}
              className="search-person-row"
              onClick={() => navigate(`/profile/${entry.username}`)}
            >
              <img src={avatarSrc} alt={entry?.username || "User"} className="search-person-avatar" />

              <div className="search-person-meta">
                <b>{entry.name}</b>
                <div>@{entry.username}</div>
              </div>

              {renderRelationshipActions(entry)}
            </div>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Posts</h3>

        {!loading && posts.length === 0 && <p>No posts found</p>}

        {posts.map((entry) => (
          <div
            key={entry._id}
            style={{
              padding: 12,
              borderBottom: "1px solid #ddd",
              cursor: "pointer",
            }}
            onClick={() => navigate("/home")}
          >
            <div style={{ marginBottom: 6 }}>
              <b>{entry.name}</b>{" "}
              <span style={{ color: "#666" }}>@{entry.username}</span>
            </div>

            <div>{entry.text}</div>

            {entry.image && (
              <img
                src={resolveImage(entry.image)}
                alt="Post"
                style={{
                  width: "100%",
                  borderRadius: 10,
                  marginTop: 8,
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
