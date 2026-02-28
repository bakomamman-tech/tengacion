import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Room, createLocalAudioTrack, createLocalVideoTrack } from "livekit-client";

import { useAuth } from "../context/AuthContext";
import { startLiveSession, endLiveSession, getLiveConfig } from "../api";
import { connectSocket } from "../socket";
import { resolveLivekitWsUrl } from "../livekitConfig";

export default function GoLive() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [liveSession, setLiveSession] = useState(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef(null);

  const handleStart = async () => {
    if (loading) {
      return;
    }
    setError("");
    setLoading(true);

    try {
      const result = await startLiveSession(title.trim());
      const { session, token, livekit } = result;
      const liveConfig = await getLiveConfig();
      setViewerCount(session.viewerCount || 0);
      setLiveSession(session);
      await attachLiveKit(token, {
        livekitConfig: liveConfig,
        fallbackLivekit: livekit,
      });
    } catch (err) {
      setError(err.message || "Failed to start live broadcast");
      if (room) {
        room.disconnect();
        setRoom(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const attachLiveKit = async (token, { livekitConfig, fallbackLivekit }) => {
    if (!token) {
      throw new Error("Missing LiveKit credentials");
    }

    const targetUrl = resolveLivekitWsUrl({
      livekitConfig,
      fallbackLivekit,
      context: "GoLive.connect",
    });

    const nextRoom = new Room();
    await nextRoom.connect(targetUrl, token);
    try {
      const [videoTrack, audioTrack] = await Promise.all([
        createLocalVideoTrack({
          facingMode: "user",
        }),
        createLocalAudioTrack(),
      ]);

      await nextRoom.localParticipant.publishTrack(videoTrack);
      await nextRoom.localParticipant.publishTrack(audioTrack);

      if (videoRef.current) {
        videoTrack.attach(videoRef.current);
      }
    } catch (err) {
      nextRoom.disconnect();
      throw err;
    }

    setRoom(nextRoom);
  };

  const stopLive = async () => {
    if (room) {
      room.disconnect();
      setRoom(null);
    }
    if (liveSession?.roomName) {
      await endLiveSession(liveSession.roomName).catch(() => {});
    }
    setLiveSession(null);
  };

  useEffect(() => {
    if (!liveSession?.roomName) {
      return;
    }
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

    const handleViewers = (payload) => {
      if (payload.roomName === liveSession.roomName) {
        setViewerCount(payload.viewerCount);
      }
    };

    socket.on("live:viewers", handleViewers);

    return () => {
      socket.off("live:viewers", handleViewers);
    };
  }, [liveSession?.roomName, user?._id]);

  useEffect(() => () => {
    if (room) {
      room.disconnect();
    }
  }, [room]);

  return (
    <main className="go-live-page">
      <header className="go-live-header">
        <div>
          <h2>Go live</h2>
          <p>Broadcast to your followers for free with LiveKit.</p>
        </div>
        <button className="secondary" onClick={() => navigate("/live")}>
          Back to directory
        </button>
      </header>

      <section className="go-live-panel">
        <label>
          Stream title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Share what you're about to do"
          />
        </label>

        {!liveSession ? (
          <button
            type="button"
            className="primary"
            disabled={loading}
            onClick={handleStart}
          >
            {loading ? "Starting…" : "Start live stream"}
          </button>
        ) : (
          <div className="go-live-controls">
            <button type="button" className="danger" onClick={stopLive}>
              End stream
            </button>
            <span>{viewerCount || 0} viewers now</span>
          </div>
        )}

        {error && <p className="field-error">{error}</p>}
      </section>

      {liveSession && (
        <section className="go-live-preview">
          <p className="go-live-label">You're live now</p>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="go-live-video"
          />
          <div className="go-live-info">
            <strong>{liveSession.title || "Streaming now"}</strong>
            <span>
              Hosting as {liveSession.host?.name || liveSession.host?.username}
            </span>
            <span>{viewerCount || 0} live viewers</span>
          </div>
        </section>
      )}
    </main>
  );
}
