import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Room, createLocalAudioTrack, createLocalVideoTrack } from "livekit-client";

import { useAuth } from "../context/AuthContext";
import {
  endLiveSession,
  getLiveConfig,
  requestLiveToken,
  startLiveSession,
} from "../api";
import { connectSocket } from "../socket";
import { resolveLivekitWsUrl } from "../livekitConfig";
import LiveControlsBar from "../components/live/LiveControlsBar";
import LiveChatDrawer from "../components/live/LiveChatDrawer";

const formatElapsedTime = (value) => {
  const total = Math.max(0, Number(value) || 0);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hrs > 0) {
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

export default function GoLive() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [liveSession, setLiveSession] = useState(null);
  const [liveConfig, setLiveConfig] = useState(null);
  const [liveQuota, setLiveQuota] = useState(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
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
  const roomRef = useRef(null);
  const liveSessionRef = useRef(null);
  const localTracksRef = useRef({ video: null, audio: null });
  const socketRef = useRef(null);
  const reactionTimeoutRef = useRef(new Map());

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    liveSessionRef.current = liveSession;
  }, [liveSession]);

  const refreshLiveConfig = useCallback(async () => {
    const config = await getLiveConfig();
    setLiveConfig(config || null);
    setLiveQuota(config?.quota || null);
    return config || null;
  }, []);

  useEffect(() => {
    let alive = true;

    const loadLiveConfig = async () => {
      try {
        setConfigLoading(true);
        await refreshLiveConfig();
      } catch (err) {
        if (alive) {
          setError(err.message || "Failed to load live quota");
        }
      } finally {
        if (alive) {
          setConfigLoading(false);
        }
      }
    };

    loadLiveConfig();

    return () => {
      alive = false;
    };
  }, [refreshLiveConfig]);

  const handleStart = async () => {
    if (loading) {
      return;
    }
    setError("");
    setLoading(true);

    let startedFreshSession = false;
    let sessionRoomName = null;

    try {
      const config = liveConfig || (await refreshLiveConfig());
      const activeSession = config?.activeSession;

      if (activeSession?.roomName) {
        sessionRoomName = activeSession.roomName;
        const tokenResult = await requestLiveToken({
          roomName: activeSession.roomName,
          publish: true,
        });
        setViewerCount(activeSession.viewerCount || 0);
        setLiveSession(activeSession);
        setLiveQuota(activeSession.quota || config?.quota || null);
        await attachLiveKit(tokenResult.token, {
          livekitConfig: config,
          fallbackLivekit: tokenResult.livekit,
        });
      } else {
        const result = await startLiveSession(title.trim());
        const { session, token, livekit } = result;
        startedFreshSession = true;
        sessionRoomName = session.roomName;
        setViewerCount(session.viewerCount || 0);
        setLiveSession(session);
        setLiveQuota(session.quota || config?.quota || null);
        await attachLiveKit(token, {
          livekitConfig: config,
          fallbackLivekit: livekit,
        });
      }
    } catch (err) {
      if (startedFreshSession && sessionRoomName) {
        await endLiveSession(sessionRoomName).catch(() => {});
      }
      releaseLocalTracks();
      setError(err.message || "Failed to start live broadcast");
      const currentRoom = roomRef.current;
      if (currentRoom) {
        currentRoom.disconnect();
        setRoom(null);
        roomRef.current = null;
      }
      setLiveSession(null);
      liveSessionRef.current = null;
      setViewerCount(0);
      await refreshLiveConfig().catch(() => {});
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
    roomRef.current = nextRoom;
  };

  const releaseLocalTracks = () => {
    const { video, audio } = localTracksRef.current;

    if (video) {
      video.detach();
      video.stop();
    }
    if (audio) {
      audio.stop();
    }

    localTracksRef.current = { video: null, audio: null };
  };

  const stopLive = useCallback(async () => {
    const currentRoom = roomRef.current;
    const currentSession = liveSessionRef.current;
    releaseLocalTracks();

    if (currentRoom) {
      currentRoom.disconnect();
      setRoom(null);
      roomRef.current = null;
    }

    if (currentSession?.roomName) {
      await endLiveSession(currentSession.roomName).catch(() => {});
    }

    setLiveSession(null);
    liveSessionRef.current = null;
    setViewerCount(0);
    setIsChatOpen(false);
    setChatMessages([]);
    setReactions([]);
    setElapsedSec(0);

    try {
      await refreshLiveConfig();
    } catch {
      // Ignore refresh failures after the stream is stopped.
    }
  }, [refreshLiveConfig]);

  useEffect(() => {
    if (!liveSession?.roomName) {
      return;
    }
    if (!user?._id) {
      return;
    }

    const socket = connectSocket({ userId: user._id });
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

  useEffect(() => {
    const expiresAt = liveSession?.quota?.expiresAt;
    if (!liveSession || liveSession.status !== "active" || !expiresAt) {
      return undefined;
    }

    const deadline = new Date(expiresAt).getTime();
    if (!Number.isFinite(deadline)) {
      return undefined;
    }

    const delay = Math.max(0, deadline - Date.now());
    const timer = window.setTimeout(() => {
      setError("Your 30-second daily live limit has ended.");
      void stopLive();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [liveSession?.quota?.expiresAt, liveSession?.status, liveSession, stopLive]);

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

  const liveReportSummary = useMemo(() => {
    if (!liveSession) {
      return null;
    }

    const startedAt = liveSession.startedAt
      ? new Intl.DateTimeFormat(undefined, {
          hour: "numeric",
          minute: "numeric",
        }).format(new Date(liveSession.startedAt))
      : "";
    const quotaExpiresAt = liveSession.quota?.expiresAt
      ? new Date(liveSession.quota.expiresAt).getTime()
      : null;
    const quotaRemainingMs =
      liveSession.status === "active" && Number.isFinite(quotaExpiresAt)
        ? Math.max(0, quotaExpiresAt - Date.now())
        : 0;

    return {
      title: liveSession.title || "Streaming now",
      host: liveSession.host?.name || liveSession.host?.username || "Host",
      startedAt,
      metrics: [
        {
          label: "Viewers now",
          value: String(viewerCount || 0),
          note: "Watching live",
        },
        {
          label: "Duration",
          value: formatElapsedTime(elapsedSec),
          note: "Stream time",
        },
        {
          label: "Time left",
          value: formatElapsedTime(Math.ceil(quotaRemainingMs / 1000)),
          note: "Daily allowance",
        },
        {
          label: "Chat",
          value: String(chatMessages.length),
          note: "Messages received",
        },
        {
          label: "Reactions",
          value: String(reactions.length),
          note: "Emoji bursts",
        },
      ],
    };
  }, [chatMessages.length, elapsedSec, liveSession, reactions.length, viewerCount]);

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
        <label className="go-live-title-field">
          <span className="go-live-field-label">Stream title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Share what you're about to do"
          />
        </label>

        <div className="go-live-limit-note">
          <span>Daily allowance</span>
          <strong>
            {configLoading
              ? "Checking quota..."
              : liveSession
                ? "Countdown shown below"
                : liveQuota
                  ? `${formatElapsedTime(liveQuota.remainingSecondsToday || 0)} left today`
                  : "30 seconds per day"}
          </strong>
          {!liveSession && liveConfig?.activeSession && (
            <span className="go-live-limit-warning">
              You already have an active live session. Resume it instead of starting a new one.
            </span>
          )}
          {!liveSession && liveQuota && !liveQuota.canGoLive && (
            <span className="go-live-limit-warning">
              You have used today's 30-second live allowance.
            </span>
          )}
        </div>

        {!liveSession ? (
          <button
            type="button"
            className="primary go-live-start-btn"
            disabled={loading || configLoading || (!liveConfig?.activeSession && liveQuota && !liveQuota.canGoLive)}
            onClick={handleStart}
          >
            {loading
              ? "Starting..."
              : liveConfig?.activeSession
                ? "Resume live stream"
                : "Start live stream"}
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
          {liveReportSummary && (
            <div className="go-live-report">
              <div className="go-live-report__head">
                <div>
                  <p className="go-live-label">Live report summary</p>
                  <h3>{liveReportSummary.title}</h3>
                  <p>
                    {liveReportSummary.startedAt
                      ? `Started at ${liveReportSummary.startedAt} - hosting as ${liveReportSummary.host}`
                      : `Hosting as ${liveReportSummary.host}`}
                  </p>
                </div>
                <span className="go-live-report__status">Live</span>
              </div>
              <div className="go-live-report__grid">
                {liveReportSummary.metrics.map((metric) => (
                  <article key={metric.label} className="go-live-report__metric">
                    <span className="go-live-report__metric-label">{metric.label}</span>
                    <strong className="go-live-report__metric-value">{metric.value}</strong>
                    <span className="go-live-report__metric-note">{metric.note}</span>
                  </article>
                ))}
              </div>
            </div>
          )}
          <p className="go-live-label">You're live now</p>
          <div className="go-live-video-wrap">
            <video
              ref={videoRef}
              controls
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
            quotaRemainingSec={
              liveSession?.quota?.expiresAt
                ? Math.max(
                    0,
                    Math.ceil(
                      (new Date(liveSession.quota.expiresAt).getTime() - Date.now()) /
                        1000
                    )
                  )
                : undefined
            }
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
