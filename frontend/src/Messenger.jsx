import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteMessageForMe,
  getChatContacts,
  getConversationMessages,
  resolveImage,
  sendChatMessage,
  shareMessageToFollowers,
  uploadChatAttachment,
} from "./api";
import { connectSocket, disconnectSocket } from "./socket";
import ContentCardMessage from "./components/ContentCardMessage";
import ShareContentModal from "./components/ShareContentModal";

const MOBILE_SHEET_QUERY = "(max-width: 640px)";
const QUICK_REACTIONS = ["ðŸ‘", "â¤ï¸", "ðŸ˜‚", "ðŸ˜®", "ðŸ˜¢", "ðŸ”¥"];

const toIdString = (value) => {
  if (!value) {return "";}
  if (typeof value === "string") {return value;}
  if (value._id) {return value._id.toString();}
  return value.toString();
};

const getViewportHeight = () => {
  if (typeof window === "undefined") {return 0;}
  return window.innerHeight || document.documentElement.clientHeight || 0;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const formatDuration = (inputSeconds) => {
  const total = Math.max(0, Math.floor(Number(inputSeconds) || 0));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const sanitizeAttachmentUrl = (rawUrl, type) => {
  const resolved = resolveImage(rawUrl || "");
  if (!resolved) {
    return "";
  }

  const normalized = String(resolved).toLowerCase();
  if (type === "audio" && normalized.startsWith("data:audio")) {
    return "";
  }

  return resolved;
};

const pickVoiceMimeType = () => {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
  ];

  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }

  return "";
};

const inferAudioMimeFromUrl = (url = "") => {
  const value = String(url || "").toLowerCase();
  if (value.includes(".ogg")) {
    return "audio/ogg";
  }
  if (value.includes(".m4a") || value.includes(".mp4")) {
    return "audio/mp4";
  }
  return "audio/webm";
};

const fallbackAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "User"
  )}&size=96&background=DFE8F6&color=1D3A6D`;

let messageBeepContext = null;
const playIncomingMessageBeep = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return;
    }

    if (!messageBeepContext) {
      messageBeepContext = new AudioCtx();
    }

    const ctx = messageBeepContext;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => null);
    }

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    const toneOsc = ctx.createOscillator();
    const shimmerOsc = ctx.createOscillator();
    const noise = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }
    noise.buffer = buffer;

    toneOsc.type = "triangle";
    toneOsc.frequency.setValueAtTime(2200, now);
    toneOsc.frequency.exponentialRampToValueAtTime(950, now + 0.2);

    shimmerOsc.type = "sine";
    shimmerOsc.frequency.setValueAtTime(3200, now);
    shimmerOsc.frequency.exponentialRampToValueAtTime(1600, now + 0.12);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.28, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

    toneOsc.connect(gain);
    shimmerOsc.connect(gain);
    noise.connect(gain);
    gain.connect(ctx.destination);

    toneOsc.start(now);
    shimmerOsc.start(now);
    noise.start(now);
    toneOsc.stop(now + 0.26);
    shimmerOsc.stop(now + 0.16);
    noise.stop(now + 0.08);
  } catch {
    // Ignore browser audio restrictions silently.
  }
};

const normalizeMessage = (message) => ({
  _id: toIdString(message?._id),
  senderId: toIdString(message?.senderId),
  receiverId: toIdString(message?.receiverId),
  senderName: message?.senderName || "",
  senderAvatar: resolveImage(message?.senderAvatar || ""),
  text: message?.text || "",
  type:
    message?.type === "contentCard"
      ? "contentCard"
      : message?.type === "voice"
        ? "voice"
        : "text",
  metadata: message?.metadata
    ? {
        itemType: message.metadata.itemType || "",
        itemId: toIdString(message.metadata.itemId),
        previewType: message.metadata.previewType || "",
        title: message.metadata.title || "",
        description: message.metadata.description || "",
        price: Number(message.metadata.price) || 0,
        coverImageUrl: resolveImage(message.metadata.coverImageUrl || ""),
      }
    : null,
  attachments: Array.isArray(message?.attachments)
    ? message.attachments
        .map((file) => ({
          type: file?.type || "file",
          url: sanitizeAttachmentUrl(file?.url || "", file?.type || "file"),
          name: file?.name || "",
          size: Number(file?.size) || 0,
          durationSeconds: Number(file?.durationSeconds) || 0,
        }))
        .filter((file) => file.url)
    : [],
  time:
    message?.time ||
    (message?.createdAt ? new Date(message.createdAt).getTime() : Date.now()),
  clientId: message?.clientId || "",
  pending: Boolean(message?.pending),
  failed: Boolean(message?.failed),
});

const getMessagePreviewText = (message) => {
  if (message?.type === "contentCard") {
    return `shared: ${message?.metadata?.title || message?.metadata?.itemType || "content"}`;
  }
  if (Array.isArray(message?.attachments) && message.attachments.length > 0) {
    return message.attachments[0]?.type === "audio" ? "voice note" : "attachment";
  }
  return message?.text || "";
};

const isForConversation = (message, meId, otherId) => {
  const a = toIdString(message.senderId);
  const b = toIdString(message.receiverId);
  return (a === meId && b === otherId) || (a === otherId && b === meId);
};

export default function Messenger({ user, onClose, onMinimize }) {
  const meId = useMemo(() => toIdString(user?._id || user?.id), [user]);
  const token = localStorage.getItem("token");

  const [text, setText] = useState("");
  const [contacts, setContacts] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [gifQuery, setGifQuery] = useState("");
  const [gifResults, setGifResults] = useState([]);
  const [gifError, setGifError] = useState("");
  const [headerNotice, setHeaderNotice] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voicePreview, setVoicePreview] = useState(null);
  const [isSendingVoice, setIsSendingVoice] = useState(false);
  const [openVoiceMenuId, setOpenVoiceMenuId] = useState("");
  const [voicePlaybackById, setVoicePlaybackById] = useState({});
  const recorderRef = useRef(null);
  const recorderChunksRef = useRef([]);
  const recordMimeRef = useRef("audio/webm");
  const recordingIntervalRef = useRef(null);
  const recordingStartRef = useRef(0);
  const recordingStreamRef = useRef(null);
  const recordingCancelledRef = useRef(false);
  const voiceMenuRef = useRef(null);
  const voiceAudioRefs = useRef(new Map());
  const mediaInputRef = useRef(null);

  const [isMobileSheet, setIsMobileSheet] = useState(() => {
    if (typeof window === "undefined") {return false;}
    return window.matchMedia(MOBILE_SHEET_QUERY).matches;
  });
  const [sheetHeight, setSheetHeight] = useState(() => {
    const vh = getViewportHeight();
    return vh ? Math.round(vh * 0.72) : 560;
  });
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);

  const socketRef = useRef(null);
  const selectedIdRef = useRef("");
  const endRef = useRef(null);
  const sheetHeightRef = useRef(sheetHeight);
  const dragRef = useRef({
    active: false,
    startY: 0,
    startHeight: 0,
    downwardDelta: 0,
  });

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    sheetHeightRef.current = sheetHeight;
  }, [sheetHeight]);

  const getMobileBounds = useCallback(() => {
    const vh = getViewportHeight();
    return {
      min: Math.round(vh * 0.46),
      max: Math.round(vh * 0.92),
    };
  }, []);

  const getMobileSnapPoints = useCallback(() => {
    const { min, max } = getMobileBounds();
    const mid = Math.round((min + max) / 2);
    return [min, mid, max];
  }, [getMobileBounds]);

  const clampSheetHeight = useCallback(
    (height) => {
      const { min, max } = getMobileBounds();
      return clamp(height, min, max);
    },
    [getMobileBounds]
  );

  useEffect(() => {
    if (typeof window === "undefined") {return undefined;}

    const media = window.matchMedia(MOBILE_SHEET_QUERY);

    const syncViewport = () => {
      const mobile = media.matches;
      setIsMobileSheet(mobile);

      if (mobile) {
        setSheetHeight((prev) => {
          const base = prev || Math.round(getViewportHeight() * 0.72);
          return clampSheetHeight(base);
        });
      }
    };

    syncViewport();

    if (media.addEventListener) {
      media.addEventListener("change", syncViewport);
    } else {
      media.addListener(syncViewport);
    }
    window.addEventListener("resize", syncViewport);

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener("change", syncViewport);
      } else {
        media.removeListener(syncViewport);
      }
      window.removeEventListener("resize", syncViewport);
    };
  }, [clampSheetHeight]);

  useEffect(() => {
    if (!isDraggingSheet) {return undefined;}

    const onPointerMove = (event) => {
      const drag = dragRef.current;
      if (!drag.active) {return;}

      const deltaY = event.clientY - drag.startY;
      drag.downwardDelta = Math.max(0, deltaY);
      setSheetHeight(clampSheetHeight(drag.startHeight - deltaY));
    };

    const onPointerEnd = () => {
      const drag = dragRef.current;
      if (!drag.active) {return;}

      drag.active = false;
      setIsDraggingSheet(false);

      const { min } = getMobileBounds();
      const closeThreshold = Math.max(76, Math.round(getViewportHeight() * 0.16));
      const nearCollapsed = sheetHeightRef.current <= min + 34;

      if (drag.downwardDelta > closeThreshold && nearCollapsed) {
        onClose?.();
        return;
      }

      const currentHeight = sheetHeightRef.current;
      const snapPoints = getMobileSnapPoints();
      const nearest = snapPoints.reduce((closest, point) =>
        Math.abs(point - currentHeight) < Math.abs(closest - currentHeight)
          ? point
          : closest
      );
      setSheetHeight(nearest);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
    };
  }, [clampSheetHeight, getMobileBounds, getMobileSnapPoints, isDraggingSheet, onClose]);

  const onSheetHandlePointerDown = useCallback(
    (event) => {
      if (!isMobileSheet) {return;}
      if (event.button !== undefined && event.button !== 0) {return;}

      dragRef.current = {
        active: true,
        startY: event.clientY,
        startHeight: sheetHeightRef.current,
        downwardDelta: 0,
      };
      setIsDraggingSheet(true);
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [isMobileSheet]
  );

  const selectedContact = useMemo(
    () => contacts.find((c) => c._id === selectedId) || null,
    [contacts, selectedId]
  );

  useEffect(() => {
    if (!headerNotice) {
      return undefined;
    }
    const timer = window.setTimeout(() => setHeaderNotice(""), 2400);
    return () => window.clearTimeout(timer);
  }, [headerNotice]);

  useEffect(() => {
    if (!openVoiceMenuId) {
      return undefined;
    }

    const onPointerDown = (event) => {
      if (voiceMenuRef.current?.contains(event.target)) {
        return;
      }
      setOpenVoiceMenuId("");
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpenVoiceMenuId("");
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openVoiceMenuId]);

  useEffect(() => () => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach((track) => track.stop());
    }
  }, []);

  useEffect(() => () => {
    if (voicePreview?.url) {
      URL.revokeObjectURL(voicePreview.url);
    }
  }, [voicePreview?.url]);

  useEffect(() => {
    if (!gifOpen) {
      return undefined;
    }

    const key = import.meta.env.VITE_GIPHY_API_KEY;
    if (!key) {
      setGifError("GIF search requires VITE_GIPHY_API_KEY");
      setGifResults([]);
      return undefined;
    }

    let alive = true;
    const timer = window.setTimeout(async () => {
      try {
        setGifError("");
        const query = gifQuery.trim() || "reaction";
        const endpoint =
          `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(key)}` +
          `&q=${encodeURIComponent(query)}&limit=24&rating=pg`;
        const response = await fetch(endpoint);
        const payload = await response.json();
        if (!alive) {
          return;
        }
        const list = Array.isArray(payload?.data) ? payload.data : [];
        setGifResults(
          list
            .map((entry) => ({
              id: entry.id,
              title: entry.title || "GIF",
              url:
                entry?.images?.fixed_height?.url ||
                entry?.images?.original?.url ||
                "",
            }))
            .filter((entry) => entry.url)
        );
      } catch {
        if (alive) {
          setGifError("Failed to load GIFs");
        }
      }
    }, 260);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [gifOpen, gifQuery]);

  const getAvatar = useCallback(
    (entity) => resolveImage(entity?.avatar) || fallbackAvatar(entity?.name),
    []
  );

  const moveContactToTop = useCallback((contactId, lastMessage, lastMessageAt) => {
    setContacts((prev) => {
      const idx = prev.findIndex((c) => c._id === contactId);
      if (idx === -1) {return prev;}

      const copy = [...prev];
      const updated = {
        ...copy[idx],
        lastMessage,
        lastMessageAt,
      };
      copy.splice(idx, 1);
      return [updated, ...copy];
    });
  }, []);

  useEffect(() => {
    let alive = true;

    const loadContacts = async () => {
      if (!meId) {return;}
      setLoadingContacts(true);
      setError("");

      try {
        const data = await getChatContacts();
        if (!alive) {return;}
        const list = Array.isArray(data) ? data : [];
        setContacts(list);
        setSelectedId((prev) => prev || list[0]?._id || "");
      } catch (err) {
        if (!alive) {return;}
        setContacts([]);
        setError(err.message || "Failed to load contacts");
      } finally {
        if (alive) {setLoadingContacts(false);}
      }
    };

    loadContacts();

    return () => {
      alive = false;
    };
  }, [meId]);

  useEffect(() => {
    let alive = true;

    const loadConversation = async () => {
      if (!selectedId) {
        setMessages([]);
        return;
      }

      setLoadingMessages(true);
      setError("");

      try {
        const data = await getConversationMessages(selectedId);
        if (!alive) {return;}
        const next = Array.isArray(data) ? data.map(normalizeMessage) : [];
        setMessages(next);
      } catch (err) {
        if (!alive) {return;}
        setMessages([]);
        setError(err.message || "Failed to load messages");
      } finally {
        if (alive) {setLoadingMessages(false);}
      }
    };

    loadConversation();

    return () => {
      alive = false;
    };
  }, [selectedId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    if (!meId || !token) {return undefined;}

    const socket = connectSocket({ token, userId: meId });
    if (!socket) {return undefined;}
    socketRef.current = socket;

    const handleOnlineUsers = (ids = []) => {
      setOnlineUsers(new Set(ids.map((id) => toIdString(id))));
    };

    const handleIncomingMessage = (rawMessage) => {
      const message = normalizeMessage(rawMessage);
      console.log("[SOCKET DELIVER]", {
        direction: "incoming",
        messageId: message._id || "",
        fromUserId: toIdString(message.senderId),
        toUserId: toIdString(message.receiverId),
      });
      const activeContactId = selectedIdRef.current;
      const isIncoming = toIdString(message.senderId) !== meId;

      if (isIncoming) {
        playIncomingMessageBeep();
      }

      if (isForConversation(message, meId, activeContactId)) {
        setMessages((prev) => {
          const byServerId =
            message._id && prev.some((m) => m._id && m._id === message._id);
          if (byServerId) {return prev;}

          const optimisticIndex = message.clientId
            ? prev.findIndex((m) => m.clientId === message.clientId)
            : -1;

          if (optimisticIndex >= 0) {
            const next = [...prev];
            next[optimisticIndex] = { ...message, pending: false, failed: false };
            return next;
          }

          return [...prev, message];
        });
      }

      const otherId =
        toIdString(message.senderId) === meId
          ? toIdString(message.receiverId)
          : toIdString(message.senderId);
      moveContactToTop(otherId, getMessagePreviewText(message), message.time);
    };

    socket.on("onlineUsers", handleOnlineUsers);
    socket.on("newMessage", handleIncomingMessage);
    socket.on("chat:message", handleIncomingMessage);
    socket.on("chat:sent", (payload) => {
      console.log("[SOCKET ACK]", {
        fromEvent: true,
        serverMsgId: payload?.serverMsgId || "",
        clientMsgId: payload?.clientMsgId || "",
      });
    });
    socket.on("message:deleted_for_me", ({ messageId }) => {
      const targetId = toIdString(messageId);
      if (!targetId) {
        return;
      }
      setMessages((prev) =>
        prev.filter((message) => toIdString(message?._id) !== targetId)
      );
    });

    return () => {
      socket.off("onlineUsers", handleOnlineUsers);
      socket.off("newMessage", handleIncomingMessage);
      socket.off("chat:message", handleIncomingMessage);
      socket.off("chat:sent");
      socket.off("message:deleted_for_me");
      disconnectSocket();
      socketRef.current = null;
    };
  }, [meId, moveContactToTop, token]);

  const replaceMessageByClientId = useCallback((clientId, patch) => {
    setMessages((prev) => prev.map((m) => (m.clientId === clientId ? { ...m, ...patch } : m)));
  }, []);

  const sendViaSocket = useCallback(
    (receiverId, payload) =>
      new Promise((resolve, reject) => {
        const socket = socketRef.current;
        if (!socket || !socket.connected) {
          reject(new Error("Socket unavailable"));
          return;
        }

        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new Error("Socket timeout"));
          }
        }, 6000);

        socket.emit(
          "chat:send",
          { receiverId, ...payload },
          (ack) => {
            if (settled) {return;}
            settled = true;
            clearTimeout(timer);
            console.log("[SOCKET ACK]", {
              ok: Boolean(ack?.ok),
              serverMsgId: ack?.serverMsgId || ack?.message?._id || "",
              clientMsgId: payload?.clientId || "",
              error: ack?.error || "",
            });

            if (ack?.ok && ack.message) {
              resolve(normalizeMessage(ack.message));
              return;
            }

            reject(new Error(ack?.error || "Socket send failed"));
          }
        );
      }),
    []
  );

  const sendPayload = useCallback(async (payloadInput, options = {}) => {
    const targetId = toIdString(options.receiverId || selectedId);
    if (!targetId || !meId) {return false;}
    const now = Date.now();
    const clientId = `c_${now}_${Math.random().toString(36).slice(2, 8)}`;
    const payload =
      payloadInput && typeof payloadInput === "object"
        ? { ...payloadInput, clientId }
        : { text: String(payloadInput || ""), type: "text", clientId };

    const normalizedType =
      payload.type === "contentCard"
        ? "contentCard"
        : payload.type === "voice"
          ? "voice"
          : "text";
    const previewText =
      normalizedType === "contentCard"
        ? `shared: ${payload?.metadata?.title || payload?.metadata?.itemType || "content"}`
        : String(payload.text || "").trim();
    const hasAttachments = Array.isArray(payload.attachments) && payload.attachments.length > 0;

    if (!previewText && !hasAttachments) {
      return false;
    }

    const optimistic = normalizeMessage({
      _id: clientId,
      senderId: meId,
      receiverId: targetId,
      senderName: user?.name || "",
      text: normalizedType === "text" ? previewText : "",
      type: normalizedType,
      metadata: normalizedType === "contentCard" ? payload.metadata : null,
      attachments: hasAttachments ? payload.attachments : [],
      time: now,
      clientId,
      pending: true,
    });

    const shouldRenderOptimistic = targetId === selectedIdRef.current;
    if (shouldRenderOptimistic) {
      setMessages((prev) => [...prev, optimistic]);
    }
    moveContactToTop(targetId, getMessagePreviewText(optimistic), now);
    setError("");

    try {
      console.log("[SOCKET SEND]", {
        fromUserId: meId,
        toUserId: targetId,
        clientMsgId: clientId,
        type: normalizedType,
      });
      const persisted = await sendViaSocket(targetId, payload);
      if (shouldRenderOptimistic) {
        replaceMessageByClientId(clientId, {
          ...persisted,
          pending: false,
          failed: false,
        });
      }
      return true;
    } catch {
      // REST fallback remains.
    }

    try {
      const persisted = await sendChatMessage(targetId, payload);
      if (shouldRenderOptimistic) {
        replaceMessageByClientId(clientId, {
          ...normalizeMessage(persisted),
          pending: false,
          failed: false,
        });
      }
      return true;
    } catch (err) {
      if (shouldRenderOptimistic) {
        replaceMessageByClientId(clientId, {
          pending: false,
          failed: true,
        });
      }
      setError(err.message || "Failed to send message");
      return false;
    }
  }, [meId, moveContactToTop, replaceMessageByClientId, selectedId, sendViaSocket, user?.name]);

  const send = async () => {
    const value = text.trim();
    if (!value) {return;}
    setText("");
    await sendPayload({ text: value, type: "text" });
  };

  const uploadAndSendAttachment = useCallback(
    async (file, attachmentPatch = {}, messageType = "text") => {
      if (!file) {
        return;
      }
      try {
        const uploaded = await uploadChatAttachment(file);
        await sendPayload({
          type: messageType,
          text: "",
          attachments: [
            {
              url: uploaded?.url || "",
              type: uploaded?.type || "file",
              name: uploaded?.name || file.name || "attachment",
              size: Number(uploaded?.size) || file.size || 0,
              ...attachmentPatch,
            },
          ],
        });
      } catch (err) {
        setError(err?.message || "Attachment upload failed");
      }
    },
    [sendPayload]
  );

  const stopRecordingStream = useCallback(() => {
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
    }
  }, []);

  const clearVoicePreview = useCallback(() => {
    setVoicePreview((prev) => {
      if (prev?.url) {
        URL.revokeObjectURL(prev.url);
      }
      return null;
    });
  }, []);

  const startVoiceNote = async () => {
    if (isRecording || isSendingVoice) {
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice notes are not supported in this browser");
      return;
    }
    setError("");
    clearVoicePreview();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      const mimeType = pickVoiceMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderChunksRef.current = [];
      recordMimeRef.current = mimeType || recorder.mimeType || "audio/webm";
      recorderRef.current = recorder;
      recordingCancelledRef.current = false;
      recordingStartRef.current = Date.now();
      setRecordingSeconds(0);

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      recordingIntervalRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartRef.current) / 1000);
        setRecordingSeconds(Math.max(0, elapsed));
      }, 1000);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recorderChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        recorderRef.current = null;
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }
        stopRecordingStream();
        setIsRecording(false);

        if (recordingCancelledRef.current) {
          recorderChunksRef.current = [];
          setRecordingSeconds(0);
          return;
        }

        const elapsed = Math.max(
          0,
          Math.floor((Date.now() - recordingStartRef.current) / 1000)
        );
        setRecordingSeconds(elapsed);
        const blob = new Blob(recorderChunksRef.current, { type: recordMimeRef.current });
        recorderChunksRef.current = [];
        if (!blob.size || elapsed < 1) {
          setError("Recording too short");
          return;
        }

        const url = URL.createObjectURL(blob);
        setVoicePreview({
          blob,
          url,
          durationSeconds: elapsed,
          mimeType: recordMimeRef.current,
        });
      };
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      const denied = err?.name === "NotAllowedError" || err?.name === "SecurityError";
      setError(denied ? "Microphone permission denied" : "Microphone access is unavailable");
      stopRecordingStream();
    }
  };

  const stopVoiceNote = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recordingCancelledRef.current = false;
      recorderRef.current.stop();
    }
  };

  const cancelVoiceNote = useCallback(() => {
    recordingCancelledRef.current = true;
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    setRecordingSeconds(0);
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    } else {
      stopRecordingStream();
      setIsRecording(false);
    }
    clearVoicePreview();
  }, [clearVoicePreview, stopRecordingStream]);

  const sendVoicePreview = useCallback(async () => {
    if (!voicePreview?.blob || isSendingVoice) {
      return;
    }
    setIsSendingVoice(true);
    try {
      const normalizedMime = String(voicePreview.mimeType || "").toLowerCase();
      const extension = normalizedMime.includes("ogg")
        ? "ogg"
        : normalizedMime.includes("mp4")
          ? "m4a"
          : "webm";
      const file = new File([voicePreview.blob], `voice-note-${Date.now()}.${extension}`, {
        type: normalizedMime || "audio/webm",
      });
      await uploadAndSendAttachment(
        file,
        { durationSeconds: Number(voicePreview.durationSeconds) || 0 },
        "voice"
      );
      clearVoicePreview();
      setRecordingSeconds(0);
    } finally {
      setIsSendingVoice(false);
    }
  }, [clearVoicePreview, isSendingVoice, uploadAndSendAttachment, voicePreview]);

  const sendQuickReaction = async (emoji) => {
    if (!emoji) {
      return;
    }
    await sendPayload({ text: emoji, type: "text" });
    setShowReactions(false);
  };

  const sendGif = async (gifUrl) => {
    if (!gifUrl) {
      return;
    }
    await sendPayload({
      type: "text",
      text: "",
      attachments: [{ url: gifUrl, type: "image", name: "gif", size: 0 }],
    });
    setGifOpen(false);
  };

  const handleDeleteVoiceNote = useCallback(async (messageId) => {
    if (!messageId) {
      return;
    }
    const confirmed = window.confirm(
      "Delete this voice note for you? The other person will still see it."
    );
    if (!confirmed) {
      return;
    }

    const targetId = toIdString(messageId);
    setOpenVoiceMenuId("");
    setMessages((prev) => prev.filter((message) => toIdString(message?._id) !== targetId));

    try {
      await deleteMessageForMe(targetId);
    } catch (err) {
      setError(err?.message || "Failed to delete voice note");
      try {
        const data = await getConversationMessages(selectedIdRef.current);
        const next = Array.isArray(data) ? data.map(normalizeMessage) : [];
        setMessages(next);
      } catch {
        // Keep current view if reload fails.
      }
    }
  }, []);

  const handleVoiceAudioEvent = useCallback((audioId, patch) => {
    if (!audioId) {
      return;
    }
    setVoicePlaybackById((prev) => ({
      ...prev,
      [audioId]: {
        currentTime: 0,
        duration: 0,
        isPlaying: false,
        ...(prev[audioId] || {}),
        ...patch,
      },
    }));
  }, []);

  const pauseOtherVoiceNotes = useCallback((activeAudioId) => {
    voiceAudioRefs.current.forEach((audio, id) => {
      if (id !== activeAudioId && audio && !audio.paused) {
        audio.pause();
      }
    });
  }, []);

  const toggleVoiceNotePlayback = useCallback(async (audioId) => {
    const audio = voiceAudioRefs.current.get(audioId);
    if (!audio) {
      return;
    }
    if (!audio.paused) {
      audio.pause();
      return;
    }
    pauseOtherVoiceNotes(audioId);
    try {
      await audio.play();
    } catch {
      setError("Unable to play voice note");
    }
  }, [pauseOtherVoiceNotes]);

  const downloadVoiceNote = useCallback((url, timeValue) => {
    const resolved = resolveImage(url);
    if (!resolved) {
      return;
    }
    const ts = new Date(timeValue || Date.now());
    const stamp = [
      ts.getFullYear(),
      String(ts.getMonth() + 1).padStart(2, "0"),
      String(ts.getDate()).padStart(2, "0"),
      "-",
      String(ts.getHours()).padStart(2, "0"),
      String(ts.getMinutes()).padStart(2, "0"),
      String(ts.getSeconds()).padStart(2, "0"),
    ].join("");
    const extGuess = /\.([a-z0-9]+)(?:\?|#|$)/i.exec(resolved)?.[1] || "webm";
    const link = document.createElement("a");
    link.href = resolved;
    link.download = `voice-note-${stamp}.${extGuess}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setOpenVoiceMenuId("");
  }, []);

  const shareContent = async (shareInput) => {
    if (shareInput?.mode === "friends") {
      const recipients = Array.isArray(shareInput.recipientIds)
        ? shareInput.recipientIds
        : [];
      for (const recipientId of recipients) {
        // sequential send to preserve ordering and prevent socket flood
        // eslint-disable-next-line no-await-in-loop
        await sendPayload(shareInput.payload, { receiverId: recipientId });
      }
      setShareOpen(false);
      return;
    }

    await sendPayload(shareInput?.payload || shareInput);
    setShareOpen(false);
  };

  const shareToFollowers = async (payload) => {
    const result = await shareMessageToFollowers(payload);
    return result;
  };

  const openAttachmentPicker = () => {
    mediaInputRef.current?.click();
  };

  const onAttachmentChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    await uploadAndSendAttachment(file);
  };

  const sheetStyle =
    isMobileSheet && sheetHeight
      ? {
          height: `${sheetHeight}px`,
          minHeight: `${sheetHeight}px`,
          maxHeight: `${sheetHeight}px`,
        }
      : undefined;

  return (
    <div
      className={`messenger ${isMobileSheet ? "mobile-sheet" : ""} ${
        isDraggingSheet ? "dragging" : ""
      }`}
      style={sheetStyle}
    >
      <div className="messenger-header">
        <button
          className="messenger-drag-handle"
          type="button"
          onPointerDown={onSheetHandlePointerDown}
          aria-label="Drag messenger panel"
        />

        <div className="messenger-header-main">
          <div className="mh-left">
            <strong>Messenger</strong>
          </div>
          <div className="mh-actions">
            <button
              type="button"
              className="mh-action-btn"
              title="Voice call"
              aria-label="Voice call"
              onClick={() => setHeaderNotice("Voice calling coming soon")}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 4h4l1.8 4.2-2.2 1.9a11 11 0 0 0 4.6 4.6l1.9-2.2L20 14v4a2 2 0 0 1-2 2C10.8 20 4 13.2 4 6a2 2 0 0 1 2-2z" />
              </svg>
            </button>
            <button
              type="button"
              className="mh-action-btn"
              title="Video call"
              aria-label="Video call"
              onClick={() => setHeaderNotice("Video calling coming soon")}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h8A2.5 2.5 0 0 1 16 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-8A2.5 2.5 0 0 1 3 16.5z" />
                <path d="M16 10.5l5-2.5v8l-5-2.5z" />
              </svg>
            </button>
            <button
              type="button"
              className="mh-action-btn"
              title="Minimize"
              aria-label="Minimize chat"
              onClick={() =>
                onMinimize?.({
                  name: selectedContact?.name || selectedContact?.username || "Messenger",
                  avatar: getAvatar(selectedContact || user),
                })
              }
            >
              —
            </button>
            <button
              className="mh-close"
              onClick={onClose}
              aria-label="Close chat"
              title="Close"
              type="button"
            >
              ×
            </button>
          </div>
        </div>
        {headerNotice && <div className="messenger-header-notice">{headerNotice}</div>}
      </div>

      <div className="messenger-body">
        <aside className="messenger-threads">
          <div className="threads-title">Chats</div>

          {loadingContacts && <div className="threads-state">Loading chats...</div>}

          {!loadingContacts && contacts.length === 0 && (
            <div className="threads-state">No active conversations.</div>
          )}

          {!loadingContacts &&
            contacts.map((contact) => {
              const active = contact._id === selectedId;
              return (
                <button
                  key={contact._id}
                  className={`thread-item ${active ? "active" : ""}`}
                  onClick={() => setSelectedId(contact._id)}
                >
                  <div className="thread-avatar-wrap">
                    <img src={getAvatar(contact)} className="thread-avatar" alt="" />
                    {onlineUsers.has(contact._id) && <span className="online-dot" />}
                  </div>

                  <div className="thread-meta">
                    <div className="thread-name">{contact.name || contact.username}</div>
                    <div className="thread-last">
                      {contact.lastMessage || "Start chatting"}
                    </div>
                  </div>
                </button>
              );
            })}
        </aside>

        <section className="messenger-chat">
          {!selectedContact && (
            <div className="chat-empty">Select a chat to start messaging.</div>
          )}

          {selectedContact && (
            <>
              <div className="chat-topbar">
                <img src={getAvatar(selectedContact)} alt="" className="chat-top-avatar" />
                <div>
                  <div className="chat-top-name">
                    {selectedContact.name || selectedContact.username}
                  </div>
                  <div className="chat-top-status">
                    {onlineUsers.has(selectedContact._id) ? "Online" : "Offline"}
                  </div>
                </div>
              </div>

              <div className="messenger-messages">
                {loadingMessages && <div className="ms-empty">Loading messages...</div>}

                {!loadingMessages && messages.length === 0 && (
                  <div className="ms-empty">No messages yet. Say hello.</div>
                )}

                {!loadingMessages &&
                  messages.map((m) => {
                    const isMe = toIdString(m.senderId) === meId;
                    const bubbleClass = `${isMe ? "me" : "them"} ${
                      m.failed ? "failed" : ""
                    }`;
                    return (
                      <div key={m._id || m.clientId} className={`message-row ${bubbleClass}`}>
                        {!isMe && (
                          <img
                            src={m.senderAvatar || getAvatar(selectedContact)}
                            className="msg-avatar"
                            alt=""
                          />
                        )}

                        <div className="msg-bubble">
                          {m.type === "contentCard" ? (
                            <ContentCardMessage metadata={m.metadata} />
                          ) : (
                            <>
                              {m.text ? <div className="msg-text">{m.text}</div> : null}
                              {Array.isArray(m.attachments) &&
                                m.attachments.map((file, index) => {
                                  const key = `${m._id || m.clientId}-att-${index}`;
                                  if (file.type === "image") {
                                    return (
                                      <img
                                        key={key}
                                        src={resolveImage(file.url)}
                                        alt={file.name || "attachment"}
                                        className="msg-attachment-image"
                                      />
                                    );
                                  }
                                  if (file.type === "video") {
                                    return (
                                      <video
                                        key={key}
                                        src={resolveImage(file.url)}
                                        controls
                                        className="msg-attachment-video"
                                      />
                                    );
                                  }
                                  if (file.type === "audio") {
                                    const messageId = toIdString(m._id || m.clientId);
                                    const audioId = `${messageId}:${index}`;
                                    const playback = voicePlaybackById[audioId] || {};
                                    const currentTime = Number(playback.currentTime) || 0;
                                    const storedDuration = Number(file.durationSeconds) || 0;
                                    const mediaDuration = Number(playback.duration) || 0;
                                    const duration = Math.max(storedDuration, mediaDuration, 0);
                                    const progressPct =
                                      duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
                                    const isPlaying = Boolean(playback.isPlaying);
                                    const menuOpen = openVoiceMenuId === audioId;
                                    return (
                                      <div key={key} className="msg-voice-card">
                                        <audio
                                          ref={(node) => {
                                            if (node) {
                                              voiceAudioRefs.current.set(audioId, node);
                                            } else {
                                              voiceAudioRefs.current.delete(audioId);
                                            }
                                          }}
                                          preload="metadata"
                                          onLoadedMetadata={(event) =>
                                            handleVoiceAudioEvent(audioId, {
                                              duration: event.currentTarget.duration || 0,
                                            })
                                          }
                                          onTimeUpdate={(event) =>
                                            handleVoiceAudioEvent(audioId, {
                                              currentTime: event.currentTarget.currentTime || 0,
                                              duration:
                                                event.currentTarget.duration ||
                                                playback.duration ||
                                                0,
                                            })
                                          }
                                          onPlay={() => {
                                            pauseOtherVoiceNotes(audioId);
                                            handleVoiceAudioEvent(audioId, { isPlaying: true });
                                          }}
                                          onPause={() =>
                                            handleVoiceAudioEvent(audioId, { isPlaying: false })
                                          }
                                          onEnded={() =>
                                            handleVoiceAudioEvent(audioId, {
                                              isPlaying: false,
                                              currentTime: 0,
                                            })
                                          }
                                          className="msg-voice-audio-hidden"
                                        >
                                          <source src={resolveImage(file.url)} type={inferAudioMimeFromUrl(file.url)} />
                                        </audio>
                                        <button
                                          type="button"
                                          className="msg-voice-play-btn"
                                          onClick={() => toggleVoiceNotePlayback(audioId)}
                                          aria-label={isPlaying ? "Pause voice note" : "Play voice note"}
                                          title={isPlaying ? "Pause" : "Play"}
                                        >
                                          {isPlaying ? "Pause" : "Play"}
                                        </button>
                                        <div className="msg-voice-meta">
                                          <div className="msg-voice-progress-track">
                                            <span
                                              className="msg-voice-progress-fill"
                                              style={{ width: `${progressPct}%` }}
                                            />
                                          </div>
                                          <div className="msg-voice-time">
                                            {formatDuration(currentTime)} / {formatDuration(duration)}
                                          </div>
                                        </div>
                                        <div className="msg-voice-menu-wrap" ref={menuOpen ? voiceMenuRef : null}>
                                          <button
                                            type="button"
                                            className="msg-voice-menu-trigger"
                                            aria-label="Voice note options"
                                            aria-haspopup="menu"
                                            aria-expanded={menuOpen}
                                            title="More options"
                                            onClick={() =>
                                              setOpenVoiceMenuId((prev) =>
                                                prev === audioId ? "" : audioId
                                              )
                                            }
                                          >
                                            …
                                          </button>
                                          {menuOpen && (
                                            <div className="msg-voice-menu" role="menu">
                                              <button
                                                type="button"
                                                role="menuitem"
                                                onClick={() => {
                                                  toggleVoiceNotePlayback(audioId);
                                                  setOpenVoiceMenuId("");
                                                }}
                                              >
                                                {isPlaying ? "Pause" : "Play"}
                                              </button>
                                              <button
                                                type="button"
                                                role="menuitem"
                                                onClick={() => downloadVoiceNote(file.url, m.time)}
                                              >
                                                Download
                                              </button>
                                              <button
                                                type="button"
                                                role="menuitem"
                                                onClick={() => handleDeleteVoiceNote(m._id)}
                                                disabled={!m._id || m.pending}
                                              >
                                                Delete
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  }
                                  return (
                                    <a
                                      key={key}
                                      href={resolveImage(file.url)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="msg-attachment-file"
                                    >
                                      {file.name || "Attachment"}
                                    </a>
                                  );
                                })}
                            </>
                          )}
                          <div className="msg-time">
                            {new Date(m.time).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {m.pending ? " - Sending" : ""}
                            {m.failed ? " - Failed" : ""}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                <div ref={endRef} />
              </div>

              <div className="messenger-input">
                {(isRecording || voicePreview) && (
                  <div className="messenger-voice-recorder">
                    <div className="messenger-voice-status">
                      <span className={`messenger-voice-dot ${isRecording ? "live" : ""}`} />
                      <strong>{isRecording ? "Recording" : "Voice preview"}</strong>
                      <span>{formatDuration(recordingSeconds)}</span>
                    </div>
                    <div className="messenger-voice-controls">
                      {isRecording ? (
                        <>
                          <button
                            type="button"
                            className="messenger-action-btn active"
                            onClick={stopVoiceNote}
                            aria-label="Stop recording"
                            title="Stop recording"
                          >
                            Stop
                          </button>
                          <button
                            type="button"
                            className="messenger-action-btn"
                            onClick={cancelVoiceNote}
                            aria-label="Cancel recording"
                            title="Cancel recording"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <audio
                            controls
                            className="messenger-voice-preview-audio"
                          >
                            <source src={voicePreview?.url || ""} type={voicePreview?.mimeType || "audio/webm"} />
                          </audio>
                          <button
                            type="button"
                            className="messenger-action-btn"
                            onClick={cancelVoiceNote}
                            aria-label="Discard voice note"
                            title="Discard"
                            disabled={isSendingVoice}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="messenger-action-btn active"
                            onClick={sendVoicePreview}
                            aria-label="Send voice note"
                            title="Send voice note"
                            disabled={isSendingVoice}
                          >
                            {isSendingVoice ? "Sending..." : "Send voice"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
                <div className="messenger-composer-actions">
                  <button
                    type="button"
                    className={`messenger-action-btn ${isRecording ? "active" : ""}`}
                    onClick={isRecording ? stopVoiceNote : startVoiceNote}
                    title="Voice message"
                    aria-label="Voice message"
                    disabled={Boolean(voicePreview)}
                  >
                    {isRecording ? (
                      "Stop"
                    ) : (
                      <svg
                        className="messenger-mic-icon"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path d="M12 3.5a3.5 3.5 0 0 0-3.5 3.5v5a3.5 3.5 0 0 0 7 0V7A3.5 3.5 0 0 0 12 3.5Z" />
                        <path d="M6.5 11.5a5.5 5.5 0 1 0 11 0" />
                        <path d="M12 17v3.5" />
                        <path d="M9 20.5h6" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    className="messenger-action-btn"
                    onClick={openAttachmentPicker}
                    title="Attach photo or file"
                    aria-label="Attach photo or file"
                    disabled={isRecording || isSendingVoice}
                  >
                    Photo
                  </button>
                  <button
                    type="button"
                    className="messenger-action-btn"
                    onClick={() => {
                      setShowEmojiPicker((prev) => !prev);
                      setGifOpen(false);
                    }}
                    title="Emoji"
                    aria-label="Emoji"
                    disabled={isRecording || isSendingVoice}
                  >
                    Emoji
                  </button>
                  <button
                    type="button"
                    className="messenger-action-btn"
                    onClick={() => {
                      setGifOpen((prev) => !prev);
                      setShowEmojiPicker(false);
                    }}
                    title="GIF"
                    aria-label="GIF"
                    disabled={isRecording || isSendingVoice}
                  >
                    GIF
                  </button>
                  <button
                    type="button"
                    className="messenger-action-btn"
                    onClick={() => setShareOpen(true)}
                    title="Share"
                    aria-label="Share"
                    disabled={isRecording || isSendingVoice || !selectedId}
                  >
                    Share
                  </button>
                  <button
                    type="button"
                    className="messenger-action-btn"
                    onClick={() => {
                      sendQuickReaction("👍");
                      setShowReactions((prev) => !prev);
                    }}
                    title="Like"
                    aria-label="Like"
                    disabled={isRecording || isSendingVoice}
                  >
                    👍
                  </button>
                </div>
                {showReactions && (
                  <div className="messenger-reactions-row">
                    {QUICK_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="messenger-reaction-chip"
                        onClick={() => sendQuickReaction(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
                {showEmojiPicker && (
                  <div className="messenger-emoji-popover">
                    {["😀", "😂", "❤️", "🔥", "🎉", "😮", "😢", "👏"].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => sendQuickReaction(emoji)}
                        className="messenger-emoji-btn"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
                {gifOpen && (
                  <div className="messenger-gif-modal">
                    <input
                      value={gifQuery}
                      onChange={(event) => setGifQuery(event.target.value)}
                      placeholder="Search GIFs"
                    />
                    {gifError ? <p>{gifError}</p> : null}
                    <div className="messenger-gif-grid">
                      {gifResults.map((gif) => (
                        <button
                          type="button"
                          key={gif.id}
                          className="messenger-gif-item"
                          onClick={() => sendGif(gif.url)}
                        >
                          <img src={gif.url} alt={gif.title} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Aa"
                  disabled={isRecording}
                />

                <button onClick={send} disabled={!text.trim() || isRecording || Boolean(voicePreview)}>
                  Send
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      {error && <div className="messenger-error">{error}</div>}

      <input
        ref={mediaInputRef}
        type="file"
        hidden
        accept="image/*,video/*,audio/*"
        onChange={onAttachmentChange}
      />

      <ShareContentModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onSubmit={shareContent}
        contacts={contacts}
        onShareFollowers={shareToFollowers}
      />
    </div>
  );
}


