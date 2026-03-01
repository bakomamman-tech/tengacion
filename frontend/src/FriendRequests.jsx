import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  acceptFriendRequest,
  getFriendRequests,
  rejectFriendRequest,
  resolveImage,
} from "./api";
import { useAuth } from "./context/AuthContext";
import { connectSocket } from "./socket";

const fallbackAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "User"
  )}&size=96&background=DFE8F6&color=1D3A6D`;

export default function FriendRequests() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      console.log("[FRIEND FETCH]", { source: "FriendRequests.load:start" });
      const result = await getFriendRequests();
      const list = Array.isArray(result) ? result : [];
      console.log("[FRIEND UI]", {
        source: "FriendRequests.load:done",
        incomingCount: list.length,
      });
      setRequests(list);
    } catch (err) {
      setError(err?.message || "Failed to load friend requests");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || !user?._id) {
      return undefined;
    }

    const socket = connectSocket({ token, userId: user._id });
    if (!socket) {
      return undefined;
    }

    const onFriendRequest = (payload) => {
      console.log("[SOCKET DELIVER]", {
        type: "friend:request",
        fromUserId: payload?.fromUser?._id || "",
      });
      loadRequests();
    };
    const onFriendAccepted = (payload) => {
      console.log("[SOCKET DELIVER]", {
        type: "friend:accepted",
        friendId: payload?.friend?._id || "",
      });
      loadRequests();
    };

    socket.on("friend:request", onFriendRequest);
    socket.on("friend:accepted", onFriendAccepted);

    return () => {
      socket.off("friend:request", onFriendRequest);
      socket.off("friend:accepted", onFriendAccepted);
    };
  }, [loadRequests, user?._id]);

  const handleDecision = async (userId, action) => {
    if (!userId || busyId) {
      return;
    }

    try {
      setBusyId(userId);
      setError("");

      if (action === "accept") {
        console.log("[FRIEND ACCEPT]", { action: "accept:start", userId });
        await acceptFriendRequest(userId);
      } else {
        await rejectFriendRequest(userId);
      }

      setRequests((current) => current.filter((item) => item._id !== userId));
      console.log("[FRIEND UI]", {
        action: action === "accept" ? "accept:done" : "reject:done",
        userId,
      });
    } catch (err) {
      setError(err?.message || "Action failed");
    } finally {
      setBusyId("");
    }
  };

  return (
    <section className="card friend-requests-card">
      <div className="friend-requests-head">
        <h3>Friend requests</h3>
        <button className="btn-link" onClick={loadRequests}>
          Refresh
        </button>
      </div>

      {loading && <p className="friend-requests-state">Loading requests...</p>}
      {!loading && error && <p className="friend-requests-error">{error}</p>}

      {!loading && !error && requests.length === 0 && (
        <p className="friend-requests-state">No pending friend requests.</p>
      )}

      {!loading &&
        !error &&
        requests.map((entry) => (
          <article key={entry._id} className="friend-request-item">
            <button
              className="friend-request-profile"
              onClick={() => navigate(`/profile/${entry.username}`)}
            >
              <img
                src={resolveImage(entry.avatar) || fallbackAvatar(entry.name)}
                alt={entry.name}
              />
              <div>
                <strong>{entry.name}</strong>
                <span>@{entry.username}</span>
              </div>
            </button>

            <div className="friend-request-actions">
              <button
                className="friend-request-btn confirm"
                onClick={() => handleDecision(entry._id, "accept")}
                disabled={busyId === entry._id}
              >
                {busyId === entry._id ? "Confirming..." : "Confirm"}
              </button>
              <button
                className="friend-request-btn delete"
                onClick={() => handleDecision(entry._id, "reject")}
                disabled={busyId === entry._id}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
    </section>
  );
}
