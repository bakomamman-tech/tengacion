import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Room,
  RoomEvent,
  createLocalAudioTrack,
  createLocalVideoTrack,
} from "livekit-client";

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
import "./GoLive.css";

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

const LIVE_ADMIN_PERMISSION_MESSAGE = "You Need Permission from the Admin";

const getLivePermissionBlockMessage = (config, quota) => {
  if (config?.liveAccess?.canPublish === false) {
    return config.liveAccess.message || LIVE_ADMIN_PERMISSION_MESSAGE;
  }
  if (quota?.blockedReason) {
    return quota.blockedReason;
  }
  return "";
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
  const [screenShareEnabled, setScreenShareEnabled] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("none");
  const [blurEnabled, setBlurEnabled] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState("idle");
  const videoRef = useRef(null);
  const roomRef = useRef(null);
  const liveSessionRef = useRef(null);
  const localTracksRef = useRef({ video: null, audio: null });
  const socketRef = useRef(null);
  const reactionTimeoutRef = useRef(new Map());
  const manualDisconnectRef = useRef(false);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    liveSessionRef.current = liveSession;
  }, [liveSession]);

  const refreshLiveConfig = useCallback(async () => {
    const config = await getLiveConfig({ publish: true });
    setLiveConfig(config || null);
    setLiveQuota(config?.quota || null);
    return config || null;
  }, []);

  const livePermissionMessage = getLivePermissionBlockMessage(liveConfig, liveQuota);
  const livePermissionBlocked = Boolean(livePermissionMessage);
  const hasUnlimitedLiveAccess = Boolean(
    liveQuota?.unlimited || liveConfig?.liveAccess?.quotaExempt
  );

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
    if (livePermissionBlocked) {
      setError(livePermissionMessage);
      return;
    }
    setError("");
    setLoading(true);

    let startedFreshSession = false;
    let sessionRoomName = null;

    try {
      const config = liveConfig || (await refreshLiveConfig());
      const publishBlockMessage = getLivePermissionBlockMessage(config, config?.quota);
      if (publishBlockMessage) {
        throw new Error(publishBlockMessage);
      }
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
        manualDisconnectRef.current = true;
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

    setConnectionStatus("connecting");
    manualDisconnectRef.current = false;

    const [videoResult, audioResult] = await Promise.allSettled([
      createLocalVideoTrack({
        facingMode: "user",
      }),
      createLocalAudioTrack(),
    ]);
    const videoTrack = videoResult.status === "fulfilled" ? videoResult.value : null;
    const audioTrack = audioResult.status === "fulfilled" ? audioResult.value : null;

    if (!videoTrack && !audioTrack) {
      setConnectionStatus("disconnected");
      throw new Error(
        "Camera and microphone are unavailable. Allow media access, then try again."
      );
    }

    const nextRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
    });

    if (typeof nextRoom.on === "function") {
      nextRoom.on(RoomEvent.Reconnecting, () => {
        setConnectionStatus("reconnecting");
      });
      nextRoom.on(RoomEvent.Reconnected, () => {
        setConnectionStatus("connected");
        setError("");
      });
      nextRoom.on(RoomEvent.Disconnected, () => {
        if (manualDisconnectRef.current) {
          return;
        }
        setConnectionStatus("disconnected");
        setError("The live connection was interrupted. Use Reconnect to continue.");
      });
      nextRoom.on(RoomEvent.MediaDevicesError, (mediaError) => {
        setError(mediaError?.message || "A camera or microphone device became unavailable.");
      });
    }

    localTracksRef.current = { video: videoTrack, audio: audioTrack };
    try {
      await nextRoom.connect(targetUrl, token, {
        autoSubscribe: true,
      });
      if (videoTrack) {
        await nextRoom.localParticipant.publishTrack(videoTrack);
      }
      if (audioTrack) {
        await nextRoom.localParticipant.publishTrack(audioTrack);
      }
      setMicEnabled(Boolean(audioTrack));
      setCameraEnabled(Boolean(videoTrack));
      setConnectionStatus("connected");

      if (!videoTrack || !audioTrack) {
        setError(
          videoTrack
            ? "Microphone unavailable. The stream is continuing with video only."
            : "Camera unavailable. The stream is continuing with audio only."
        );
      }
    } catch (err) {
      manualDisconnectRef.current = true;
      nextRoom.disconnect();
      releaseLocalTracks();
      setConnectionStatus("disconnected");
      throw err;
    }

    setRoom(nextRoom);
    roomRef.current = nextRoom;
  };

  useEffect(() => {
    const videoTrack = localTracksRef.current.video;
    const videoElement = videoRef.current;
    if (!videoTrack || !videoElement || !liveSession?.roomName) {
      return undefined;
    }

    videoTrack.attach(videoElement);
    return () => {
      videoTrack.detach(videoElement);
    };
  }, [cameraEnabled, connectionStatus, liveSession?.roomName]);

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
      manualDisconnectRef.current = true;
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
    setScreenShareEnabled(false);
    setConnectionStatus("idle");

    try {
      await refreshLiveConfig();
    } catch {
      // Ignore refresh failures after the stream is stopped.
    }
  }, [refreshLiveConfig]);

  const reconnectLiveKit = async () => {
    const currentSession = liveSessionRef.current;
    if (!currentSession?.roomName || loading) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      releaseLocalTracks();
      if (roomRef.current) {
        manualDisconnectRef.current = true;
        roomRef.current.disconnect();
        roomRef.current = null;
        setRoom(null);
      }

      const tokenResult = await requestLiveToken({
        roomName: currentSession.roomName,
        publish: true,
      });
      await attachLiveKit(tokenResult.token, {
        livekitConfig: liveConfig,
        fallbackLivekit: tokenResult.livekit,
      });
    } catch (err) {
      setConnectionStatus("disconnected");
      setError(err.message || "Unable to reconnect the live stream");
    } finally {
      setLoading(false);
    }
  };

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
    socket.emit("live:join", { roomName: liveSession.roomName });

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
      socket.emit("live:leave", { roomName: liveSession.roomName });
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [liveSession?.roomName, user?._id]);

  useEffect(() => () => {
    reactionTimeoutRef.current.forEach((timer) => clearTimeout(timer));
    reactionTimeoutRef.current.clear();
    if (roomRef.current) {
      manualDisconnectRef.current = true;
      roomRef.current.disconnect();
    }
    const { video, audio } = localTracksRef.current;
    video?.detach();
    video?.stop();
    audio?.stop();
    localTracksRef.current = { video: null, audio: null };
  }, []);

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

  const toggleScreenShare = async () => {
    const currentRoom = roomRef.current;
    if (!currentRoom?.localParticipant?.setScreenShareEnabled) {
      setError("Screen sharing is not available on this device.");
      return;
    }

    try {
      const nextEnabled = !screenShareEnabled;
      await currentRoom.localParticipant.setScreenShareEnabled(nextEnabled);
      setScreenShareEnabled(nextEnabled);
      setError("");
    } catch (err) {
      setError(err.message || "Unable to change screen sharing");
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
    // Live chat is intentionally ephemeral here; durable chat history remains out of scope for host streams.
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
          value: liveSession.quota?.unlimited
            ? "Unlimited"
            : formatElapsedTime(Math.ceil(quotaRemainingMs / 1000)),
          note: liveSession.quota?.unlimited ? "Admin access" : "Daily allowance",
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
    <main className="go-live-page go-live-meet-page">
      <header className="go-live-header">
        <div>
          <span className="go-live-header__eyebrow">Tengacion Live Studio</span>
          <h2>{liveSession ? liveSession.title || "Live meeting" : "Go live"}</h2>
          <p>
            {liveSession
              ? `${formatElapsedTime(elapsedSec)} · ${viewerCount || 0} watching`
              : "Set up your camera, microphone, and broadcast details."}
          </p>
        </div>
        <button className="secondary go-live-directory-btn" onClick={() => navigate("/live")}>
          Back to directory
        </button>
      </header>

      {!liveSession && (
        <section className="go-live-panel go-live-lobby">
          <div className="go-live-lobby__preview" aria-hidden="true">
            <div className="go-live-lobby__avatar">
              {(user?.name || user?.username || "H").charAt(0).toUpperCase()}
            </div>
            <strong>Ready to join?</strong>
            <span>Your camera preview begins when the secure room connects.</span>
          </div>

          <div className="go-live-lobby__setup">
            <div>
              <span className="go-live-lobby__kicker">Broadcast setup</span>
              <h3>Start a live session</h3>
              <p>Followers can join from the Live directory as soon as you connect.</p>
            </div>

            <label className="go-live-title-field">
              <span className="go-live-field-label">Stream title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Share what you're about to do"
              />
            </label>

            <div className="go-live-limit-note">
              <span>{hasUnlimitedLiveAccess ? "Admin access" : "Daily allowance"}</span>
              <strong>
                {configLoading
                  ? "Checking access..."
                  : hasUnlimitedLiveAccess
                    ? "Unlimited · Go live at any time"
                    : liveQuota
                      ? `${formatElapsedTime(liveQuota.remainingSecondsToday || 0)} left today`
                      : "30 seconds per day"}
              </strong>
              {liveConfig?.activeSession && (
                <span className="go-live-limit-warning">
                  You already have an active live session. Resume it instead of starting a new one.
                </span>
              )}
              {livePermissionBlocked && (
                <span className="go-live-limit-warning">
                  {livePermissionMessage}
                </span>
              )}
              {!livePermissionBlocked && liveQuota && !liveQuota.canGoLive && (
                <span className="go-live-limit-warning">
                  You have used today's 30-second live allowance.
                </span>
              )}
            </div>

          <button
            type="button"
            className="primary go-live-start-btn"
            disabled={
              loading ||
              configLoading ||
              livePermissionBlocked ||
              (!liveConfig?.activeSession && liveQuota && !liveQuota.canGoLive)
            }
            onClick={handleStart}
          >
            {loading
              ? "Starting..."
              : liveConfig?.activeSession
                ? "Resume live stream"
                : "Start live stream"}
          </button>
            {error && <p className="field-error go-live-error">{error}</p>}
          </div>
        </section>
      )}

      {liveSession && (
        <section className="go-live-preview go-live-meeting">
          <div className="go-live-meeting__topbar">
            <div className="go-live-meeting__identity">
              <span className="go-live-meeting__live-dot" aria-hidden="true" />
              <strong>Live</strong>
              <span>{liveSession.roomName}</span>
            </div>
            <div className={`go-live-connection go-live-connection--${connectionStatus}`}>
              {connectionStatus === "connected"
                ? "Connected"
                : connectionStatus === "reconnecting"
                  ? "Reconnecting…"
                  : connectionStatus === "connecting"
                    ? "Connecting…"
                    : "Connection interrupted"}
            </div>
          </div>

          {error && (
            <div className="go-live-connection-alert" role="alert">
              <span>{error}</span>
              {connectionStatus === "disconnected" && (
                <button type="button" onClick={reconnectLiveKit} disabled={loading}>
                  {loading ? "Reconnecting…" : "Reconnect"}
                </button>
              )}
            </div>
          )}

          <div className={`go-live-meeting__layout${isChatOpen ? " has-chat" : ""}`}>
            <div className="go-live-stage">
              <div className="go-live-video-wrap">
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  autoPlay
                  className="go-live-video"
                  style={{ filter: previewFilter }}
                />
                {!cameraEnabled && (
                  <div className="go-live-camera-off">
                    <div className="go-live-camera-off__avatar">
                      {(user?.name || user?.username || "H").charAt(0).toUpperCase()}
                    </div>
                    <span>Camera is off</span>
                  </div>
                )}
                <div className="go-live-stage__name">
                  {liveSession.host?.name || liveSession.host?.username || "Host"}
                </div>
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
            </div>

            <LiveChatDrawer
              open={isChatOpen}
              messages={chatMessages}
              draft={chatDraft}
              onDraftChange={setChatDraft}
              onSend={sendChatMessage}
              onClose={() => setIsChatOpen(false)}
            />
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
            screenShareEnabled={screenShareEnabled}
            onToggleScreenShare={toggleScreenShare}
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

          {liveReportSummary && (
            <details className="go-live-report">
              <summary>Live report summary</summary>
              <div className="go-live-report__head">
                <div>
                  <h3>{liveReportSummary.title}</h3>
                  <p>
                    {liveReportSummary.startedAt
                      ? `Started at ${liveReportSummary.startedAt} · hosting as ${liveReportSummary.host}`
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
            </details>
          )}
        </section>
      )}
    </main>
  );
}
