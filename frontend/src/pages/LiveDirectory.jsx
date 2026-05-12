import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { getDiscoveryLive, getLiveSessions, trackDiscoveryEvents } from "../api";
import { connectSocket } from "../socket";

const LIVE_DISCOVERY_LIMIT = 24;

const normalizeLiveSession = (session = {}, discoveryMeta = null) => ({
  ...session,
  id: String(session?.id || session?._id || discoveryMeta?.entityId || "").trim(),
  roomName: String(session?.roomName || "").trim(),
  title: session?.title || "Live stream",
  viewerCount: Number(session?.viewerCount || 0),
  discoveryMeta,
});

const normalizeLegacyLiveSessions = (sessions = []) =>
  (Array.isArray(sessions) ? sessions : [])
    .filter((session) => session?.roomName)
    .map((session) => normalizeLiveSession(session));

const normalizeDiscoveryLiveSessions = (payload = {}) => {
  const requestId = String(payload?.requestId || "").trim();

  return (Array.isArray(payload?.items) ? payload.items : [])
    .filter((item) => item?.entityType === "live" && item?.payload?.roomName)
    .map((item) =>
      normalizeLiveSession(item.payload, {
        requestId,
        entityId: String(item.id || item?.payload?.id || item?.payload?.roomName || "").trim(),
        entityType: String(item.entityType || "live").trim().toLowerCase(),
        rank: Number(item.rank || 0),
        reason: String(item.reason || "").trim(),
        reasonLabel: String(item.reasonLabel || "").trim(),
        creatorId: String(item.creatorId || item?.payload?.host?.creatorId || "").trim(),
        authorUserId: String(item.authorUserId || item?.payload?.host?.userId || "").trim(),
      })
    );
};

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
        let nextSessions = [];

        try {
          const discoveryPayload = await getDiscoveryLive({ limit: LIVE_DISCOVERY_LIMIT });
          nextSessions = normalizeDiscoveryLiveSessions(discoveryPayload);
        } catch {
          const result = await getLiveSessions();
          nextSessions = normalizeLegacyLiveSessions(result?.sessions);
        }

        if (!alive) {
          return;
        }
        setSessions(nextSessions);
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
    const socket = connectSocket({ userId: user._id });
    if (!socket) {
      return;
    }

    const handleCreated = (session) => {
      setSessions((prev) => [
        normalizeLiveSession(session),
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

  const formatStartedAt = (value) => {
    const date = new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) {
      return "now";
    }
    return formatter.format(date);
  };

  const watchSession = (session = {}) => {
    const discoveryMeta = session.discoveryMeta || {};
    const requestId = String(discoveryMeta.requestId || "").trim();

    if (requestId) {
      void trackDiscoveryEvents({
        requestId,
        surface: "live",
        events: [
          {
            type: "live_joined",
            entityType: "live",
            entityId: String(discoveryMeta.entityId || session.id || session.roomName || "").trim(),
            position: Number(discoveryMeta.rank || 0),
            metadata: {
              roomName: session.roomName,
              reason: discoveryMeta.reason || "",
            },
          },
        ],
      }).catch(() => null);
    }

    navigate(`/live/watch/${session.roomName}`);
  };

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
        <p className="live-directory-empty">Loading live sessions...</p>
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
                  {session.host?.name || session.host?.username || "Creator"} -{" "}
                  {formatStartedAt(session.startedAt)}
                </span>
              </header>
              {session.discoveryMeta?.reasonLabel ? (
                <span className="live-directory-reason">
                  {session.discoveryMeta.reasonLabel}
                </span>
              ) : null}
              <div className="live-directory-stats">
                {session.viewerCount || 0} viewers
              </div>
              <button
                type="button"
                className="primary"
                onClick={() => watchSession(session)}
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
