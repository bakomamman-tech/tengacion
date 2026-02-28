import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Room, createLocalAudioTrack, createLocalVideoTrack } from "livekit-client";

import { useAuth } from "../context/AuthContext";
import { startLiveSession, endLiveSession, getLiveConfig } from "../api";
import { connectSocket } from "../socket";
import { resolveLivekitWsUrl } from "../livekitConfig";
import LiveControlsBar from "../components/live/LiveControlsBar";
import LiveChatDrawer from "../components/live/LiveChatDrawer";

export default function GoLive() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [liveSession, setLiveSession] = useState(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState("none");
  const [blurEnabled, setBlurEnabled] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [elapsedSec, setElapsedSec] = useState(0);
  const videoRef = useRef(null);
  const localTracksRef = useRef({ video: null, audio: null });
  const socketRef = useRef(null);
  const reactionTimeoutRef = useRef(new Map());

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
      localTracksRef.current = { video: videoTrack, audio: audioTrack };
      setMicEnabled(true);
      setCameraEnabled(true);

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
    const { video, audio } = localTracksRef.current;
    if (video) {
      video.detach();
      video.stop();
    }
    if (audio) {
      audio.stop();
    }
    localTracksRef.current = { video: null, audio: null };

    if (room) {
      room.disconnect();
      setRoom(null);
    }
    if (liveSession?.roomName) {
      await endLiveSession(liveSession.roomName).catch(() => {});
    }
    setLiveSession(null);
    setIsChatOpen(false);
    setChatMessages([]);
    setReactions([]);
    setElapsedSec(0);
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
    socketRef.current = socket;

    const handleViewers = (payload) => {
      if (payload.roomName === liveSession.roomName) {
        setViewerCount(payload.viewerCount);
      }
    };
    const handleReaction = (payload) => {
      if (payload.roomName === liveSession.roomName && payload.emoji) {
        pushReaction(payload.emoji);
      }
    };
    const handleChat = (payload) => {
      if (payload.roomName !== liveSession.roomName) {
        return;
      }
      if (!payload?.text) {
        return;
      }
      setChatMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          sender: payload.sender || "Viewer",
          text: payload.text,
        },
      ]);
    };

    socket.on("live:viewers", handleViewers);
    socket.on("live:reaction", handleReaction);
    socket.on("live:chat", handleChat);

    return () => {
      socket.off("live:viewers", handleViewers);
      socket.off("live:reaction", handleReaction);
      socket.off("live:chat", handleChat);
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [liveSession?.roomName, user?._id]);

  useEffect(() => () => {
    reactionTimeoutRef.current.forEach((timer) => clearTimeout(timer));
    reactionTimeoutRef.current.clear();
    if (room) {
      room.disconnect();
    }
  }, [room]);

  useEffect(() => {
    if (!liveSession?.startedAt) {
      return undefined;
    }

    const tick = () => {
      const started = new Date(liveSession.startedAt).getTime();
      const now = Date.now();
      setElapsedSec(Math.max(0, Math.floor((now - started) / 1000)));
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [liveSession?.startedAt]);

  const toggleMic = async () => {
    const audio = localTracksRef.current.audio;
    if (!audio) {
      return;
    }
    try {
      if (micEnabled) {
        await audio.mute();
        setMicEnabled(false);
      } else {
        await audio.unmute();
        setMicEnabled(true);
      }
    } catch (err) {
      setError(err.message || "Failed to toggle microphone");
    }
  };

  const toggleCamera = async () => {
    const video = localTracksRef.current.video;
    if (!video) {
      return;
    }
    try {
      if (cameraEnabled) {
        await video.mute();
        setCameraEnabled(false);
      } else {
        await video.unmute();
        setCameraEnabled(true);
      }
    } catch (err) {
      setError(err.message || "Failed to toggle camera");
    }
  };

  const pushReaction = (emoji) => {
    const id = `${Date.now()}-${Math.random()}`;
    setReactions((prev) => [...prev, { id, emoji }]);
    const timeout = window.setTimeout(() => {
      setReactions((prev) => prev.filter((entry) => entry.id !== id));
      reactionTimeoutRef.current.delete(id);
    }, 1600);
    reactionTimeoutRef.current.set(id, timeout);
  };

  const sendReaction = (emoji) => {
    pushReaction(emoji);
    // TODO: backend broadcast event can be formalized for all viewers.
    socketRef.current?.emit("live:reaction", {
      roomName: liveSession?.roomName,
      emoji,
      sender: user?.name || user?.username || "Host",
    });
  };

  const sendChatMessage = () => {
    const trimmed = chatDraft.trim();
    if (!trimmed) {
      return;
    }

    const ownMessage = {
      id: `${Date.now()}-${Math.random()}`,
      sender: user?.name || user?.username || "You",
      text: trimmed,
    };

    setChatMessages((prev) => [...prev, ownMessage]);
    setChatDraft("");
    // TODO: backend persistence/broadcast for live chat can be expanded.
    socketRef.current?.emit("live:chat", {
      roomName: liveSession?.roomName,
      sender: ownMessage.sender,
      text: ownMessage.text,
    });
  };

  const previewFilter = useMemo(() => {
    const filters = [];
    if (selectedFilter === "warm") {
      filters.push("saturate(1.18)", "contrast(1.05)");
    } else if (selectedFilter === "cool") {
      filters.push("hue-rotate(12deg)", "saturate(1.06)");
    } else if (selectedFilter === "bw") {
      filters.push("grayscale(1)");
    } else if (selectedFilter === "sepia") {
      filters.push("sepia(0.9)");
    }

    if (blurEnabled) {
      filters.push("blur(1.4px)");
    }

    return filters.length ? filters.join(" ") : "none";
  }, [blurEnabled, selectedFilter]);

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
            <span>Live session is active.</span>
            <span>{viewerCount || 0} viewers now</span>
          </div>
        )}

        {error && <p className="field-error">{error}</p>}
      </section>

      {liveSession && (
        <section className="go-live-preview">
          <p className="go-live-label">You're live now</p>
          <div className="go-live-video-wrap">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="go-live-video"
              style={{ filter: previewFilter }}
            />
            {reactions.length > 0 && (
              <div className="live-reaction-overlay" aria-hidden="true">
                {reactions.map((entry) => (
                  <span key={entry.id} className="live-reaction-burst">
                    {entry.emoji}
                  </span>
                ))}
              </div>
            )}
          </div>
          <LiveControlsBar
            session={liveSession}
            viewerCount={viewerCount}
            hostName={liveSession.host?.name || liveSession.host?.username || "Host"}
            elapsedSec={elapsedSec}
            micEnabled={micEnabled}
            cameraEnabled={cameraEnabled}
            onToggleMic={toggleMic}
            onToggleCamera={toggleCamera}
            filter={selectedFilter}
            blurEnabled={blurEnabled}
            onChangeFilter={setSelectedFilter}
            onToggleBlur={() => setBlurEnabled((prev) => !prev)}
            onReact={sendReaction}
            onToggleChat={() => setIsChatOpen((prev) => !prev)}
            isChatOpen={isChatOpen}
            onEndLive={stopLive}
            participants={[liveSession.host?.name || liveSession.host?.username || "Host"]}
          />
          <LiveChatDrawer
            open={isChatOpen}
            messages={chatMessages}
            draft={chatDraft}
            onDraftChange={setChatDraft}
            onSend={sendChatMessage}
            onClose={() => setIsChatOpen(false)}
          />
        </section>
      )}
    </main>
  );
}
