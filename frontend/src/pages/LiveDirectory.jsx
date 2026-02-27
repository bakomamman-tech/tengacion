import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { getLiveSessions } from "../api";
import { connectSocket } from "../socket";

export default function LiveDirectory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        setLoading(true);
        const result = await getLiveSessions();
        if (!alive) {
          return;
        }
        setSessions(Array.isArray(result?.sessions) ? result.sessions : []);
      } catch (err) {
        console.error("Failed to load live sessions", err);
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!user?._id) {
      return;
    }
    const token = localStorage.getItem("token");
    if (!token) {
      return;
    }

    const socket = connectSocket({ token, userId: user._id });
    if (!socket) {
      return;
    }

    const handleCreated = (session) => {
      setSessions((prev) => [
        session,
        ...prev.filter((entry) => entry.roomName !== session.roomName),
      ]);
    };

    const handleEnded = (payload) => {
      setSessions((prev) =>
        prev.filter((entry) => entry.roomName !== payload.roomName)
      );
    };

    const handleViewers = (payload) => {
      setSessions((prev) =>
        prev.map((entry) =>
          entry.roomName === payload.roomName
            ? { ...entry, viewerCount: payload.viewerCount }
            : entry
        )
      );
    };

    socket.on("live:created", handleCreated);
    socket.on("live:ended", handleEnded);
    socket.on("live:viewers", handleViewers);

    return () => {
      socket.off("live:created", handleCreated);
      socket.off("live:ended", handleEnded);
      socket.off("live:viewers", handleViewers);
    };
  }, [user?._id]);

  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "numeric",
  });

  return (
    <main className="live-directory-page">
      <header className="live-directory-header">
        <div>
          <h2>Live directory</h2>
          <p>Join streaming creators or go live yourself.</p>
        </div>
        <button className="primary" onClick={() => navigate("/live/go")}>
          Go live
        </button>
      </header>

      {loading ? (
        <p className="live-directory-empty">Loading live sessions…</p>
      ) : sessions.length === 0 ? (
        <p className="live-directory-empty">
          No one is live right now. Start your own stream!
        </p>
      ) : (
        <div className="live-directory-grid">
          {sessions.map((session) => (
            <article key={session.roomName} className="live-directory-card">
              <header>
                <strong>{session.title || "Live stream"}</strong>
                <span className="live-directory-meta">
                  {session.host?.name || session.host?.username || "Creator"} ·{" "}
                  {formatter.format(new Date(session.startedAt))}
                </span>
              </header>
              <div className="live-directory-stats">
                {session.viewerCount || 0} viewers
              </div>
              <button
                type="button"
                className="primary"
                onClick={() => navigate(`/live/watch/${session.roomName}`)}
              >
                Watch live
              </button>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
