import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Room } from "livekit-client";

import { useAuth } from "../context/AuthContext";
import { requestLiveToken, updateLiveViewerCount, getLiveConfig } from "../api";
import { connectSocket } from "../socket";
import { resolveLivekitWsUrl } from "../livekitConfig";

export default function WatchLive() {
  const { roomName } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [session, setSession] = useState(null);
  const [viewerCount, setViewerCount] = useState(0);
  const videoRef = useRef(null);
  const [room, setRoom] = useState(null);

  useEffect(() => {
    if (!roomName) {
      return;
    }
    let alive = true;
    let joined = false;

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await requestLiveToken({ roomName, publish: false });
        if (!alive) {
          return;
        }

        setSession(response.session);
        setViewerCount(response.session?.viewerCount || 0);
        const liveConfig = await getLiveConfig();
        await connectToRoom(response.token, {
          livekitConfig: liveConfig,
          fallbackLivekit: response.livekit,
        });
        joined = true;
        await updateLiveViewerCount({ roomName, delta: 1 });
      } catch (err) {
        if (alive) {
          setError(err.message || "Unable to join live stream");
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      alive = false;
      if (joined) {
        updateLiveViewerCount({ roomName, delta: -1 }).catch(() => {});
      }
    };
  }, [roomName]);

  useEffect(() => {
    if (!roomName || !user?._id) {
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      return;
    }

    const socket = connectSocket({
      token,
      userId: user._id,
    });
    if (!socket) {
      return;
    }

    const handleViewers = (payload) => {
      if (payload.roomName === roomName) {
        setViewerCount(payload.viewerCount);
      }
    };

    socket.on("live:viewers", handleViewers);

    return () => {
      socket.off("live:viewers", handleViewers);
    };
  }, [roomName, user?._id]);

  useEffect(
    () => () => {
      if (room) {
        room.disconnect();
      }
    },
    [room]
  );

  const connectToRoom = async (token, { livekitConfig, fallbackLivekit }) => {
    if (!token) {
      throw new Error("Missing LiveKit credentials");
    }

    const targetUrl = resolveLivekitWsUrl({
      livekitConfig,
      fallbackLivekit,
      context: "WatchLive.connect",
    });

    const nextRoom = new Room();
    await nextRoom.connect(targetUrl, token, {
      autoSubscribe: true,
    });

    nextRoom.on("trackSubscribed", (track) => {
      if (videoRef.current) {
        track.attach(videoRef.current);
      }
    });

    nextRoom.on("trackUnsubscribed", (track) => track.detach());

    setRoom(nextRoom);
  };

  const leave = () => navigate("/live");

  return (
    <main className="watch-live-page">
      <header className="watch-live-header">
        <div>
          <h2>{session?.title || "Watching live"}</h2>
          <p>
            {session?.host?.name || session?.host?.username || "Creator"} ·{" "}
            {viewerCount || 0} viewers
          </p>
        </div>
        <button type="button" className="secondary" onClick={leave}>
          Leave stream
        </button>
      </header>

      {loading ? (
        <p className="watch-live-empty">Connecting…</p>
      ) : error ? (
        <p className="watch-live-empty">{error}</p>
      ) : (
        <section className="watch-live-video">
          <video
            ref={videoRef}
            controls
            playsInline
            className="watch-live-preview"
          />
        </section>
      )}
    </main>
  );
}
