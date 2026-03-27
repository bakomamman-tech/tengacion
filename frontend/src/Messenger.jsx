import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import {
  blockUser,
  createReport,
  deleteMessageForMe,
  getChatContacts,
  getConversationMessages,
  reactToChatMessage,
  resolveImage,
  sendChatMessage,
  shareMessageToFollowers,
  unsendChatMessage,
  uploadChatAttachment,
} from "./api";
import { connectSocket, disconnectSocket } from "./socket";
import ContentCardMessage from "./components/ContentCardMessage";
import ShareContentModal from "./components/ShareContentModal";
import { useDialog } from "./components/ui/useDialog";
import { createReportDialogConfig } from "./constants/reportReasons";

const MOBILE_SHEET_QUERY = "(max-width: 640px)";
const QUICK_REACTIONS = [
  "\u{1F44D}",
  "\u{2764}\u{FE0F}",
  "\u{1F602}",
  "\u{1F62E}",
  "\u{1F622}",
  "\u{1F525}",
];
const MESSAGE_ACTION_EMOJIS = [
  "\u{1F44D}",
  "\u{2764}\u{FE0F}",
  "\u{1F602}",
  "\u{1F62E}",
  "\u{1F622}",
  "\u{1F525}",
  "\u{1F389}",
  "\u{1F44F}",
];
const FALLBACK_GIFS = [
  {
    id: "fallback-cheer",
    title: "Cheer",
    url: "https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif",
  },
  {
    id: "fallback-excited",
    title: "Excited",
    url: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif",
  },
  {
    id: "fallback-laugh",
    title: "Laugh",
    url: "https://media.giphy.com/media/ASd0Ukj0y3qMM/giphy.gif",
  },
  {
    id: "fallback-hype",
    title: "Hype",
    url: "https://media.giphy.com/media/111ebonMs90YLu/giphy.gif",
  },
  {
    id: "fallback-yes",
    title: "Yes",
    url: "https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif",
  },
  {
    id: "fallback-wow",
    title: "Wow",
    url: "https://media.giphy.com/media/xT9IgG50Fb7Mi0prBC/giphy.gif",
  },
];
const VOICE_PREVIEW_AUDIO_ID = "__voice_preview__";
const VOICE_WAVE_BARS = [0.38, 0.72, 0.46, 0.84, 0.52, 0.94, 0.4, 0.76, 0.58, 0.88, 0.44, 0.68];

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

function VoiceWaveform({ progressPct = 0, isPlaying = false, className = "" }) {
  const classes = ["msg-voice-wave", isPlaying ? "is-playing" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} aria-hidden="true">
      {VOICE_WAVE_BARS.map((scale, index) => {
        const threshold = ((index + 1) / VOICE_WAVE_BARS.length) * 100;
        const isActive = progressPct >= threshold;
        return (
          <span
            key={`${className || "voice"}-${index}`}
            className={`msg-voice-wave-bar${isActive ? " is-active" : ""}`}
            style={{
              "--voice-bar-scale": String(scale),
              "--voice-bar-index": String(index),
            }}
          />
        );
      })}
    </div>
  );
}

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

const PINNED_MESSAGE_STORAGE_KEY = "tengacion:messenger:pinned-messages";

const readPinnedMessages = () => {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(PINNED_MESSAGE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writePinnedMessages = (nextValue) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      PINNED_MESSAGE_STORAGE_KEY,
      JSON.stringify(nextValue && typeof nextValue === "object" ? nextValue : {})
    );
  } catch {
    // Ignore storage failures so chat stays usable.
  }
};

let messageBeepContext = null;
const playIncomingMessageBeep = () => {
  try {
    if (typeof window === "undefined") {
      return;
    }

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
    const masterGain = ctx.createGain();
    const bodyGain = ctx.createGain();
    const shimmerGain = ctx.createGain();
    const echoGain = ctx.createGain();
    const strikeFilter = ctx.createBiquadFilter();
    const toneOsc = ctx.createOscillator();
    const bodyOsc = ctx.createOscillator();
    const shimmerOsc = ctx.createOscillator();
    const echoOsc = ctx.createOscillator();
    const noise = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.035, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.14;
    }
    noise.buffer = buffer;

    strikeFilter.type = "bandpass";
    strikeFilter.frequency.setValueAtTime(1550, now);
    strikeFilter.Q.setValueAtTime(3.5, now);

    toneOsc.type = "triangle";
    toneOsc.frequency.setValueAtTime(1840, now);
    toneOsc.frequency.exponentialRampToValueAtTime(980, now + 0.18);

    bodyOsc.type = "sine";
    bodyOsc.frequency.setValueAtTime(1320, now + 0.01);
    bodyOsc.frequency.exponentialRampToValueAtTime(780, now + 0.28);

    shimmerOsc.type = "sine";
    shimmerOsc.frequency.setValueAtTime(2780, now);
    shimmerOsc.frequency.exponentialRampToValueAtTime(1760, now + 0.16);

    echoOsc.type = "triangle";
    echoOsc.frequency.setValueAtTime(1460, now + 0.055);
    echoOsc.frequency.exponentialRampToValueAtTime(920, now + 0.23);

    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.exponentialRampToValueAtTime(0.22, now + 0.01);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

    bodyGain.gain.setValueAtTime(0.0001, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.22, now + 0.012);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);

    shimmerGain.gain.setValueAtTime(0.0001, now);
    shimmerGain.gain.exponentialRampToValueAtTime(0.12, now + 0.008);
    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    echoGain.gain.setValueAtTime(0.0001, now);
    echoGain.gain.exponentialRampToValueAtTime(0.09, now + 0.07);
    echoGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    toneOsc.connect(bodyGain);
    bodyOsc.connect(bodyGain);
    shimmerOsc.connect(shimmerGain);
    echoOsc.connect(echoGain);
    noise.connect(strikeFilter);
    bodyGain.connect(masterGain);
    shimmerGain.connect(masterGain);
    echoGain.connect(masterGain);
    strikeFilter.connect(masterGain);
    masterGain.connect(ctx.destination);

    toneOsc.start(now);
    bodyOsc.start(now);
    shimmerOsc.start(now);
    noise.start(now);
    echoOsc.start(now + 0.055);
    toneOsc.stop(now + 0.22);
    bodyOsc.stop(now + 0.3);
    shimmerOsc.stop(now + 0.18);
    echoOsc.stop(now + 0.28);
    noise.stop(now + 0.05);
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
  replyTo:
    message?.replyTo?.messageId
      ? {
          messageId: toIdString(message.replyTo.messageId),
          senderId: toIdString(message.replyTo.senderId),
          senderName: message.replyTo.senderName || "",
          type:
            message.replyTo.type === "contentCard"
              ? "contentCard"
              : message.replyTo.type === "voice"
                ? "voice"
                : "text",
          text: message.replyTo.text || "",
          contentTitle: message.replyTo.contentTitle || "",
          attachmentType: String(message.replyTo.attachmentType || "").trim(),
          attachmentCount: Number(message.replyTo.attachmentCount) || 0,
        }
      : null,
  reactions: Array.isArray(message?.reactions)
    ? message.reactions
        .map((entry) => ({
          userId: toIdString(entry?.userId),
          emoji: String(entry?.emoji || "").trim(),
          createdAt: entry?.createdAt || null,
        }))
        .filter((entry) => entry.userId && entry.emoji)
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

const getReplyPreviewText = (message) => {
  if (!message) {
    return "";
  }
  if (message.type === "contentCard") {
    return message.metadata?.title || "Shared content";
  }
  if (message.type === "voice") {
    return "Voice message";
  }
  if (message.attachmentType) {
    const firstType = String(message.attachmentType || "").trim().toLowerCase();
    if (firstType === "image") {
      return "Photo";
    }
    if (firstType === "video") {
      return "Video";
    }
    if (firstType === "audio") {
      return "Voice message";
    }
    return "Attachment";
  }
  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    const firstType = String(message.attachments[0]?.type || "").trim().toLowerCase();
    if (firstType === "image") {
      return "Photo";
    }
    if (firstType === "video") {
      return "Video";
    }
    if (firstType === "audio") {
      return "Voice message";
    }
    return "Attachment";
  }
  return String(message.text || "").trim() || "Message";
};

const buildReplyTarget = (message) => {
  const messageId = toIdString(message?._id);
  if (!messageId) {
    return null;
  }
  return {
    messageId,
    senderId: toIdString(message?.senderId),
    senderName: message?.senderName || "",
    type: message?.type || "text",
    text: String(message?.text || ""),
    contentTitle: String(message?.metadata?.title || ""),
    attachmentType: String(message?.attachments?.[0]?.type || "").trim(),
    attachmentCount: Array.isArray(message?.attachments) ? message.attachments.length : 0,
    previewText: getReplyPreviewText(message),
  };
};

const buildForwardPayload = (message) => {
  if (!message) {
    return null;
  }

  const attachments = Array.isArray(message?.attachments)
    ? message.attachments
        .map((file) => ({
          ...file,
          url: sanitizeAttachmentUrl(file?.url, file?.type),
        }))
        .filter((file) => file.url)
    : [];

  if (message?.type === "contentCard") {
    return {
      type: "contentCard",
      text: "",
      metadata: { ...(message?.metadata || {}) },
      attachments,
    };
  }

  if (String(message?.text || "").trim() || attachments.length > 0) {
    return {
      type: message?.type === "voice" ? "voice" : "text",
      text: String(message?.text || ""),
      attachments,
    };
  }

  return null;
};

const buildPinnedMessageEntry = (message, meId) => {
  const messageId = toIdString(message?._id);
  if (!messageId) {
    return null;
  }

  return {
    messageId,
    senderLabel:
      toIdString(message?.senderId) === toIdString(meId)
        ? "You"
        : message?.senderName || "Friend",
    previewText: getReplyPreviewText(message),
    time: Number(message?.time) || Date.now(),
  };
};

const toggleReactionEntries = (entries = [], userId = "", emoji = "") => {
  const normalizedUserId = toIdString(userId);
  const nextEmoji = String(emoji || "").trim();
  if (!normalizedUserId || !nextEmoji) {
    return Array.isArray(entries) ? entries : [];
  }

  const list = Array.isArray(entries)
    ? entries.map((entry) => ({
        userId: toIdString(entry?.userId),
        emoji: String(entry?.emoji || "").trim(),
        createdAt: entry?.createdAt || null,
      }))
    : [];

  const existingIndex = list.findIndex((entry) => entry.userId === normalizedUserId);
  if (existingIndex >= 0) {
    if (list[existingIndex].emoji === nextEmoji) {
      list.splice(existingIndex, 1);
    } else {
      list[existingIndex] = {
        ...list[existingIndex],
        emoji: nextEmoji,
        createdAt: new Date().toISOString(),
      };
    }
    return list;
  }

  return [
    ...list,
    {
      userId: normalizedUserId,
      emoji: nextEmoji,
      createdAt: new Date().toISOString(),
    },
  ];
};

const summarizeReactions = (entries = [], meId = "") => {
  const order = [];
  const counts = new Map();
  let viewerEmoji = "";

  for (const entry of Array.isArray(entries) ? entries : []) {
    const emoji = String(entry?.emoji || "").trim();
    if (!emoji) {
      continue;
    }
    if (!counts.has(emoji)) {
      counts.set(emoji, 0);
      order.push(emoji);
    }
    counts.set(emoji, counts.get(emoji) + 1);
    if (toIdString(entry?.userId) === toIdString(meId)) {
      viewerEmoji = emoji;
    }
  }

  return {
    total: [...counts.values()].reduce((sum, value) => sum + value, 0),
    viewerEmoji,
    items: order.map((emoji) => ({
      emoji,
      count: counts.get(emoji) || 0,
      viewerReacted: emoji === viewerEmoji,
    })),
  };
};

const getReplyLabel = ({ message, meId }) => {
  const replySenderId = toIdString(message?.replyTo?.senderId);
  const messageSenderId = toIdString(message?.senderId);
  const replySenderName = message?.replyTo?.senderName || "message";

  if (messageSenderId === toIdString(meId)) {
    return replySenderId === toIdString(meId)
      ? "You replied to yourself"
      : `You replied to ${replySenderName}`;
  }

  if (replySenderId === toIdString(meId)) {
    return `${message?.senderName || "They"} replied to you`;
  }

  return `${message?.senderName || "They"} replied to ${replySenderName}`;
};

const isForConversation = (message, meId, otherId) => {
  const a = toIdString(message.senderId);
  const b = toIdString(message.receiverId);
  return (a === meId && b === otherId) || (a === otherId && b === meId);
};

export default function Messenger({
  user,
  onClose,
  onMinimize,
  initialSelectedId = "",
  conversationOnly = false,
}) {
  const { confirm, prompt } = useDialog();
  const navigate = useNavigate();
  const meId = useMemo(() => toIdString(user?._id || user?.id), [user]);
  const preferredSelectedId = useMemo(() => toIdString(initialSelectedId), [initialSelectedId]);

  const [text, setText] = useState("");
  const [contacts, setContacts] = useState([]);
  const [selectedId, setSelectedId] = useState(() => preferredSelectedId);
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
  const [gifResults, setGifResults] = useState(FALLBACK_GIFS);
  const [gifError, setGifError] = useState("");
  const [headerNotice, setHeaderNotice] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voicePreview, setVoicePreview] = useState(null);
  const [isSendingVoice, setIsSendingVoice] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const [activeMessageId, setActiveMessageId] = useState("");
  const [hoveredMessageId, setHoveredMessageId] = useState("");
  const [openMessageReactionId, setOpenMessageReactionId] = useState("");
  const [openMessageMenuId, setOpenMessageMenuId] = useState("");
  const [openVoiceMenuId, setOpenVoiceMenuId] = useState("");
  const [voicePlaybackById, setVoicePlaybackById] = useState({});
  const [typingByUserId, setTypingByUserId] = useState({});
  const [recordingByUserId, setRecordingByUserId] = useState({});
  const [watchOpen, setWatchOpen] = useState(false);
  const [watchUrl, setWatchUrl] = useState("");
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [isBlockingUser, setIsBlockingUser] = useState(false);
  const [shareDraftPayload, setShareDraftPayload] = useState(null);
  const [pinnedMessagesByChat, setPinnedMessagesByChat] = useState(() =>
    readPinnedMessages()
  );
  const recorderRef = useRef(null);
  const recorderChunksRef = useRef([]);
  const recordMimeRef = useRef("audio/webm");
  const recordingIntervalRef = useRef(null);
  const recordingStartRef = useRef(0);
  const recordingStreamRef = useRef(null);
  const recordingCancelledRef = useRef(false);
  const voiceMenuRef = useRef(null);
  const chatMenuRef = useRef(null);
  const messageMenuRef = useRef(null);
  const voiceAudioRefs = useRef(new Map());
  const mediaInputRef = useRef(null);
  const composerInputRef = useRef(null);
  const watchVideoRef = useRef(null);

  const [isMobileSheet, setIsMobileSheet] = useState(() => {
    if (typeof window === "undefined") {return false;}
    return window.matchMedia(MOBILE_SHEET_QUERY).matches;
  });
  const [sheetHeight, setSheetHeight] = useState(() => {
    const vh = getViewportHeight();
    return vh ? Math.round(vh * 0.82) : 640;
  });
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const [desktopOffset, setDesktopOffset] = useState({ x: 0, y: 0 });
  const [isDraggingDesktop, setIsDraggingDesktop] = useState(false);

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
  const desktopDragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
    width: 0,
    height: 0,
  });

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (!preferredSelectedId) {
      return;
    }
    setSelectedId(preferredSelectedId);
  }, [preferredSelectedId]);

  useEffect(() => {
    setReplyTarget(null);
    setActiveMessageId("");
    setHoveredMessageId("");
    setOpenMessageReactionId("");
    setOpenMessageMenuId("");
  }, [selectedId]);

  useEffect(() => {
    sheetHeightRef.current = sheetHeight;
  }, [sheetHeight]);

  const getMobileBounds = useCallback(() => {
    const vh = getViewportHeight();
    return {
      min: Math.round(vh * 0.62),
      max: Math.round(vh * 0.96),
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
          const base = prev || Math.round(getViewportHeight() * 0.82);
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

  useEffect(() => {
    if (!isDraggingDesktop) {return undefined;}

    const onPointerMove = (event) => {
      const drag = desktopDragRef.current;
      if (!drag.active) {return;}

      const nextLeft = clamp(
        drag.startLeft + (event.clientX - drag.startX),
        8,
        Math.max(8, window.innerWidth - drag.width - 8)
      );
      const nextTop = clamp(
        drag.startTop + (event.clientY - drag.startY),
        8,
        Math.max(8, window.innerHeight - drag.height - 8)
      );

      setDesktopOffset({
        x: nextLeft - drag.startLeft,
        y: nextTop - drag.startTop,
      });
    };

    const onPointerEnd = () => {
      if (!desktopDragRef.current.active) {return;}
      desktopDragRef.current.active = false;
      setIsDraggingDesktop(false);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
    };
  }, [isDraggingDesktop]);

  useEffect(() => {
    if (!isMobileSheet) {return;}
    setIsDraggingDesktop(false);
    setDesktopOffset({ x: 0, y: 0 });
    desktopDragRef.current.active = false;
  }, [isMobileSheet]);

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

  const onDesktopHeaderPointerDown = useCallback(
    (event) => {
      if (isMobileSheet) {return;}
      if (event.button !== undefined && event.button !== 0) {return;}
      if (
        event.target instanceof Element &&
        event.target.closest("button, a, input, textarea, select, [role=\"button\"]")
      ) {
        return;
      }

      const panel = event.currentTarget.closest(".messenger-panel");
      if (!panel) {return;}

      const rect = panel.getBoundingClientRect();
      desktopDragRef.current = {
        active: true,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: rect.left,
        startTop: rect.top,
        width: rect.width,
        height: rect.height,
      };
      setIsDraggingDesktop(true);
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
    setChatMenuOpen(false);
  }, [selectedId]);

  useEffect(() => {
    if (!chatMenuOpen) {
      return undefined;
    }

    const onPointerDown = (event) => {
      if (chatMenuRef.current?.contains(event.target)) {
        return;
      }
      setChatMenuOpen(false);
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setChatMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [chatMenuOpen]);

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

  useEffect(() => {
    if (!openMessageMenuId) {
      return undefined;
    }

    const onPointerDown = (event) => {
      if (messageMenuRef.current?.contains(event.target)) {
        return;
      }
      setOpenMessageMenuId("");
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpenMessageMenuId("");
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openMessageMenuId]);

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
      setGifError("Showing sample GIFs. Add VITE_GIPHY_API_KEY to enable search.");
      setGifResults(FALLBACK_GIFS);
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
        const nextResults = list
          .map((entry) => ({
            id: entry.id,
            title: entry.title || "GIF",
            url:
              entry?.images?.fixed_height?.url ||
              entry?.images?.original?.url ||
              "",
          }))
          .filter((entry) => entry.url);
        if (nextResults.length > 0) {
          setGifResults(nextResults);
          return;
        }
        setGifError("No GIFs matched that search.");
        setGifResults(FALLBACK_GIFS);
      } catch {
        if (alive) {
          setGifError("Live GIF search is unavailable right now. Showing sample GIFs.");
          setGifResults(FALLBACK_GIFS);
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

  const updateConversationPreview = useCallback((contactId, nextMessages = []) => {
    setContacts((prev) =>
      prev.map((contact) => {
        if (toIdString(contact?._id) !== toIdString(contactId)) {
          return contact;
        }
        const latest = nextMessages[nextMessages.length - 1] || null;
        return {
          ...contact,
          lastMessage: latest ? getMessagePreviewText(latest) : "",
          lastMessageAt: latest?.time || 0,
        };
      })
    );
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
        setSelectedId((prev) => {
          const normalizedPrev = toIdString(prev);
          const nextPreferredId = preferredSelectedId;
          if (nextPreferredId && list.some((entry) => toIdString(entry?._id) === nextPreferredId)) {
            return nextPreferredId;
          }
          if (normalizedPrev && list.some((entry) => toIdString(entry?._id) === normalizedPrev)) {
            return normalizedPrev;
          }
          return toIdString(list[0]?._id);
        });
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
    if (!selectedId) {
      return;
    }

    const pinnedEntry = pinnedMessagesByChat[selectedId];
    if (!pinnedEntry?.messageId) {
      return;
    }

    const exists = messages.some(
      (message) => toIdString(message?._id) === toIdString(pinnedEntry.messageId)
    );
    if (exists) {
      return;
    }

    setPinnedMessagesByChat((current) => {
      if (!current?.[selectedId]) {
        return current;
      }
      const next = { ...current };
      delete next[selectedId];
      writePinnedMessages(next);
      return next;
    });
  }, [messages, pinnedMessagesByChat, selectedId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    if (!meId) {return undefined;}

    const socket = connectSocket({ userId: meId });
    if (!socket) {return undefined;}
    socketRef.current = socket;

    const handleOnlineUsers = (ids = []) => {
      setOnlineUsers(new Set(ids.map((id) => toIdString(id))));
    };

    const handleIncomingMessage = (rawMessage) => {
      const message = normalizeMessage(rawMessage);
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
    socket.on("chat:typing", ({ fromUserId, isTyping }) => {
      const id = toIdString(fromUserId);
      if (!id) {return;}
      setTypingByUserId((prev) => ({ ...prev, [id]: Boolean(isTyping) }));
    });
    socket.on("chat:recording", ({ fromUserId, isRecording }) => {
      const id = toIdString(fromUserId);
      if (!id) {return;}
      setRecordingByUserId((prev) => ({ ...prev, [id]: Boolean(isRecording) }));
    });
    socket.on("watch:state", ({ chatId, videoUrl, t, isPlaying }) => {
      if (toIdString(chatId) !== toIdString(selectedIdRef.current)) {return;}
      if (videoUrl) {setWatchUrl(videoUrl);}
      const node = watchVideoRef.current;
      if (!node) {return;}
      if (Number.isFinite(Number(t))) {
        node.currentTime = Number(t) || 0;
      }
      if (isPlaying) {
        node.play().catch(() => null);
      } else {
        node.pause();
      }
    });
    socket.on("watch:play", ({ chatId, t }) => {
      if (toIdString(chatId) !== toIdString(selectedIdRef.current)) {return;}
      const node = watchVideoRef.current;
      if (!node) {return;}
      node.currentTime = Number(t) || 0;
      node.play().catch(() => null);
    });
    socket.on("watch:pause", ({ chatId, t }) => {
      if (toIdString(chatId) !== toIdString(selectedIdRef.current)) {return;}
      const node = watchVideoRef.current;
      if (!node) {return;}
      node.currentTime = Number(t) || 0;
      node.pause();
    });
    socket.on("watch:seek", ({ chatId, t }) => {
      if (toIdString(chatId) !== toIdString(selectedIdRef.current)) {return;}
      const node = watchVideoRef.current;
      if (!node) {return;}
      node.currentTime = Number(t) || 0;
    });
    socket.on("message:deleted_for_me", ({ messageId }) => {
      const targetId = toIdString(messageId);
      if (!targetId) {
        return;
      }
      setMessages((prev) => {
        const next = prev.filter((message) => toIdString(message?._id) !== targetId);
        updateConversationPreview(selectedIdRef.current, next);
        return next;
      });
    });
    socket.on("message:unsent", ({ messageId }) => {
      const targetId = toIdString(messageId);
      if (!targetId) {
        return;
      }
      setMessages((prev) => {
        const next = prev.filter((message) => toIdString(message?._id) !== targetId);
        updateConversationPreview(selectedIdRef.current, next);
        return next;
      });
      setPinnedMessagesByChat((current) => {
        const chatId = selectedIdRef.current;
        if (!chatId || current?.[chatId]?.messageId !== targetId) {
          return current;
        }
        const next = { ...current };
        delete next[chatId];
        writePinnedMessages(next);
        return next;
      });
    });
    socket.on("message:reaction", ({ messageId, reactions }) => {
      const targetId = toIdString(messageId);
      if (!targetId) {
        return;
      }
      setMessages((prev) =>
        prev.map((message) =>
          toIdString(message?._id) === targetId
            ? {
                ...message,
                reactions: Array.isArray(reactions)
                  ? reactions
                      .map((entry) => ({
                        userId: toIdString(entry?.userId),
                        emoji: String(entry?.emoji || "").trim(),
                        createdAt: entry?.createdAt || null,
                      }))
                      .filter((entry) => entry.userId && entry.emoji)
                  : [],
              }
            : message
        )
      );
    });

    return () => {
      socket.off("onlineUsers", handleOnlineUsers);
      socket.off("newMessage", handleIncomingMessage);
      socket.off("chat:message", handleIncomingMessage);
      socket.off("chat:sent");
      socket.off("message:deleted_for_me");
      socket.off("message:unsent");
      socket.off("message:reaction");
      socket.off("chat:typing");
      socket.off("chat:recording");
      socket.off("watch:state");
      socket.off("watch:play");
      socket.off("watch:pause");
      socket.off("watch:seek");
      disconnectSocket();
      socketRef.current = null;
    };
  }, [meId, moveContactToTop, updateConversationPreview]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !selectedId) {return;}
    socket.emit("chat:typing", {
      chatId: selectedId,
      toUserId: selectedId,
      isTyping: Boolean(text.trim()),
    });
  }, [selectedId, text]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !selectedId) {return;}
    socket.emit("chat:recording", {
      chatId: selectedId,
      toUserId: selectedId,
      isRecording: Boolean(isRecording),
    });
  }, [isRecording, selectedId]);

  useEffect(() => {
    if (!watchOpen || !selectedId) {return;}
    const socket = socketRef.current;
    if (!socket) {return;}
    socket.emit("watch:join", { chatId: selectedId });
  }, [watchOpen, selectedId]);

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
    const nextReplyTarget = options.replyTarget || replyTarget;
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
    const networkPayload = {
      ...payload,
      replyTo: nextReplyTarget?.messageId
        ? { messageId: nextReplyTarget.messageId }
        : undefined,
    };

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
      replyTo: nextReplyTarget ? { ...nextReplyTarget } : null,
      time: now,
      clientId,
      pending: true,
    });

    const shouldRenderOptimistic = targetId === selectedIdRef.current;
    setReplyTarget(null);
    setActiveMessageId("");
    setOpenMessageReactionId("");
    if (shouldRenderOptimistic) {
      setMessages((prev) => [...prev, optimistic]);
    }
    moveContactToTop(targetId, getMessagePreviewText(optimistic), now);
    setError("");

    try {
      const persisted = await sendViaSocket(targetId, networkPayload);
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
      const persisted = await sendChatMessage(targetId, networkPayload);
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
  }, [meId, moveContactToTop, replaceMessageByClientId, replyTarget, selectedId, sendViaSocket, user?.name]);

  const send = async () => {
    const value = text.trim();
    if (!value) {return;}
    setText("");
    setShowEmojiPicker(false);
    setShowReactions(false);
    setGifOpen(false);
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
    const previewAudio = voiceAudioRefs.current.get(VOICE_PREVIEW_AUDIO_ID);
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
      voiceAudioRefs.current.delete(VOICE_PREVIEW_AUDIO_ID);
    }
    setVoicePlaybackById((prev) => {
      if (!prev?.[VOICE_PREVIEW_AUDIO_ID]) {
        return prev;
      }
      const next = { ...prev };
      delete next[VOICE_PREVIEW_AUDIO_ID];
      return next;
    });
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
    setShowEmojiPicker(false);
    setGifOpen(false);
  };

  const openShareComposer = useCallback((payload = null) => {
    setShareDraftPayload(payload && typeof payload === "object" ? payload : null);
    setShareOpen(true);
  }, []);

  const clearReplySelection = useCallback(() => {
    setReplyTarget(null);
  }, []);

  const selectReplyTarget = useCallback((message) => {
    if (!message || !toIdString(message?._id) || message?.pending) {
      return;
    }
    setReplyTarget(buildReplyTarget(message));
    setActiveMessageId(toIdString(message?._id));
    setOpenMessageReactionId("");
    setOpenMessageMenuId("");
    window.requestAnimationFrame(() => {
      composerInputRef.current?.focus();
    });
  }, []);

  const reactToMessageBubble = useCallback(async (message, emoji) => {
    const messageId = toIdString(message?._id);
    if (!messageId || !emoji) {
      return;
    }

    const previousReactions = Array.isArray(message?.reactions)
      ? message.reactions
      : [];
    const optimisticReactions = toggleReactionEntries(previousReactions, meId, emoji);

    setMessages((prev) =>
      prev.map((entry) =>
        toIdString(entry?._id) === messageId
          ? { ...entry, reactions: optimisticReactions }
          : entry
      )
    );
    setOpenMessageReactionId("");
    setActiveMessageId(messageId);

    try {
      const response = await reactToChatMessage(messageId, emoji);
      const normalizedReactions = Array.isArray(response?.reactions)
        ? response.reactions
            .map((entry) => ({
              userId: toIdString(entry?.userId),
              emoji: String(entry?.emoji || "").trim(),
              createdAt: entry?.createdAt || null,
            }))
            .filter((entry) => entry.userId && entry.emoji)
        : [];
      setMessages((prev) =>
        prev.map((entry) =>
          toIdString(entry?._id) === messageId
            ? { ...entry, reactions: normalizedReactions }
            : entry
        )
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((entry) =>
          toIdString(entry?._id) === messageId
            ? { ...entry, reactions: previousReactions }
            : entry
        )
      );
      setError(err?.message || "Failed to react to message");
    }
  }, [meId, preferredSelectedId]);

  const handleForwardMessage = useCallback((message) => {
    const payload = buildForwardPayload(message);
    if (!payload) {
      toast.error("This message cannot be forwarded");
      return;
    }
    setOpenMessageMenuId("");
    openShareComposer(payload);
  }, [openShareComposer]);

  const handleTogglePinnedMessage = useCallback((message) => {
    const chatId = toIdString(selectedIdRef.current);
    const nextEntry = buildPinnedMessageEntry(message, meId);
    if (!chatId || !nextEntry) {
      return;
    }

    setPinnedMessagesByChat((current) => {
      const existing = current?.[chatId];
      const next = { ...(current || {}) };
      const isSame = existing?.messageId === nextEntry.messageId;

      if (isSame) {
        delete next[chatId];
        toast.success("Message unpinned");
      } else {
        next[chatId] = nextEntry;
        toast.success("Message pinned");
      }

      writePinnedMessages(next);
      return next;
    });
    setOpenMessageMenuId("");
  }, [meId]);

  const focusPinnedMessage = useCallback(() => {
    const chatId = toIdString(selectedIdRef.current);
    const pinned = pinnedMessagesByChat?.[chatId];
    const messageId = toIdString(pinned?.messageId);
    if (!messageId) {
      return;
    }

    const node = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!(node instanceof HTMLElement)) {
      toast.error("Pinned message is no longer available");
      return;
    }

    node.scrollIntoView({ behavior: "smooth", block: "center" });
    setActiveMessageId(messageId);
  }, [pinnedMessagesByChat]);

  const clearPinnedMessage = useCallback(() => {
    const chatId = toIdString(selectedIdRef.current);
    if (!chatId) {
      return;
    }

    setPinnedMessagesByChat((current) => {
      if (!current?.[chatId]) {
        return current;
      }
      const next = { ...current };
      delete next[chatId];
      writePinnedMessages(next);
      return next;
    });
    toast.success("Pinned message removed");
  }, []);

  const handleRemoveMessage = useCallback(async (message) => {
    const messageId = toIdString(message?._id);
    if (!messageId || message?.pending) {
      return;
    }

    const isMyMessage = toIdString(message?.senderId) === meId;
    const confirmed = await confirm({
      title: isMyMessage ? "Unsend this message?" : "Remove this message for you?",
      description: isMyMessage
        ? "The message will disappear from both sides of the conversation."
        : "This will remove the message from your view only.",
      confirmLabel: isMyMessage ? "Unsend" : "Remove",
      cancelLabel: "Cancel",
      confirmVariant: "destructive",
    });

    if (!confirmed) {
      return;
    }

    setOpenMessageMenuId("");
    setMessages((prev) => {
      const next = prev.filter((entry) => toIdString(entry?._id) !== messageId);
      updateConversationPreview(selectedIdRef.current, next);
      return next;
    });
    setPinnedMessagesByChat((current) => {
      const chatId = toIdString(selectedIdRef.current);
      if (!chatId || current?.[chatId]?.messageId !== messageId) {
        return current;
      }
      const next = { ...current };
      delete next[chatId];
      writePinnedMessages(next);
      return next;
    });

    try {
      if (isMyMessage) {
        await unsendChatMessage(messageId);
        toast.success("Message unsent");
      } else {
        await deleteMessageForMe(messageId);
        toast.success("Message removed");
      }
    } catch (err) {
      const fallbackError = err?.message || "Failed to update this message";
      setError(fallbackError);
      toast.error(fallbackError);
      try {
        const data = await getConversationMessages(selectedIdRef.current);
        const next = Array.isArray(data) ? data.map(normalizeMessage) : [];
        setMessages(next);
        updateConversationPreview(selectedIdRef.current, next);
      } catch {
        // Keep the current view if the refresh fails.
      }
    }
  }, [confirm, meId, updateConversationPreview]);

  const handleReportMessage = useCallback(async (message) => {
    const messageId = toIdString(message?._id);
    if (!messageId) {
      return;
    }

    const reason = await prompt(createReportDialogConfig("message", "harassment"));
    if (!reason) {
      return;
    }

    try {
      await createReport({
        targetType: "message",
        targetId: messageId,
        reason: String(reason || "").trim().toLowerCase(),
      });
      setOpenMessageMenuId("");
      toast.success("Report submitted");
    } catch (err) {
      toast.error(err?.message || "Failed to submit report");
    }
  }, [prompt]);

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
    const confirmed = await confirm({
      title: "Delete voice note?",
      description:
        "This removes the voice note from your view only. The other person will still see it.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      confirmVariant: "destructive",
    });
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
      toast.error(err?.message || "Failed to delete voice note");
      try {
        const data = await getConversationMessages(selectedIdRef.current);
        const next = Array.isArray(data) ? data.map(normalizeMessage) : [];
        setMessages(next);
      } catch {
        // Keep current view if reload fails.
      }
    }
  }, [confirm]);

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
    if (audio.readyState === 0) {
      audio.load();
    }
    if (audio.duration && audio.currentTime >= Math.max(audio.duration - 0.05, 0)) {
      audio.currentTime = 0;
      handleVoiceAudioEvent(audioId, {
        currentTime: 0,
        duration: audio.duration || 0,
      });
    }
    audio.muted = false;
    audio.volume = 1;
    pauseOtherVoiceNotes(audioId);
    try {
      await audio.play();
    } catch {
      handleVoiceAudioEvent(audioId, { isPlaying: false });
      setError("Unable to play voice note");
    }
  }, [handleVoiceAudioEvent, pauseOtherVoiceNotes]);

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

  const openSelectedProfile = useCallback(() => {
    if (!selectedContact?.username) {
      setChatMenuOpen(false);
      toast.error("Profile link unavailable for this chat");
      return;
    }

    setChatMenuOpen(false);
    onClose?.();
    navigate(`/profile/${selectedContact.username}`);
  }, [navigate, onClose, selectedContact?.username]);

  const handleBlockSelectedContact = useCallback(async () => {
    const targetId = toIdString(selectedContact?._id);
    const targetName = selectedContact?.name || selectedContact?.username || "this user";

    if (!targetId || isBlockingUser) {
      return;
    }

    const confirmed = await confirm({
      title: `Block ${targetName}?`,
      description:
        "They will no longer be able to reach you in Messenger, and this chat will be removed from your list.",
      confirmLabel: "Block user",
      cancelLabel: "Cancel",
      confirmVariant: "destructive",
    });

    if (!confirmed) {
      return;
    }

    setChatMenuOpen(false);
    setIsBlockingUser(true);
    setError("");

    try {
      await blockUser(targetId);

      const remainingContacts = contacts.filter((contact) => contact._id !== targetId);
      const nextSelectedId = remainingContacts[0]?._id || "";

      setContacts(remainingContacts);
      setSelectedId((current) => (current === targetId ? nextSelectedId : current));
      if (selectedIdRef.current === targetId) {
        setMessages([]);
        setText("");
      }
      setWatchOpen(false);
      setHeaderNotice(`${targetName} blocked`);
      toast.success(`${targetName} blocked`);
    } catch (err) {
      const message = err?.message || "Failed to block user";
      setError(message);
      toast.error(message);
    } finally {
      setIsBlockingUser(false);
    }
  }, [confirm, contacts, isBlockingUser, selectedContact]);

  const shareContent = async (shareInput) => {
    if (shareInput?.mode === "friends") {
      const recipients = Array.isArray(shareInput.recipientIds)
        ? shareInput.recipientIds
        : [];
      for (const recipientId of recipients) {
        // sequential send to preserve ordering and prevent socket flood
         
        await sendPayload(shareInput.payload, { receiverId: recipientId });
      }
      setShareOpen(false);
      setShareDraftPayload(null);
      return;
    }

    await sendPayload(shareInput?.payload || shareInput);
    setShareOpen(false);
    setShareDraftPayload(null);
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

  const messengerStyle = {
    ...(sheetStyle || {}),
    ...(!isMobileSheet
      ? {
          transform: `translate3d(${desktopOffset.x}px, ${desktopOffset.y}px, 0)`,
        }
      : {}),
  };
  const selectedStatusLabel = selectedContact
    ? typingByUserId[selectedContact._id]
      ? "Typing..."
      : recordingByUserId[selectedContact._id]
        ? "Recording..."
        : onlineUsers.has(selectedContact._id)
          ? "Online"
          : "Offline"
    : "";
  const selectedStatusMeta =
    selectedContact?.status?.emoji || selectedContact?.status?.text
      ? `${selectedContact?.status?.emoji || ""} ${selectedContact?.status?.text || ""}`.trim()
      : "";
  const selectedHeaderName =
    selectedContact?.name || selectedContact?.username || "Messenger";
  const pinnedEntry = selectedId ? pinnedMessagesByChat?.[selectedId] || null : null;
  const hasTypedText = Boolean(text.trim());
  const composerBusy = isRecording || isSendingVoice || Boolean(voicePreview);
  const canSendText = hasTypedText && !composerBusy;
  const previewPlayback = voicePlaybackById[VOICE_PREVIEW_AUDIO_ID] || {};
  const previewCurrentTime = Number(previewPlayback.currentTime) || 0;
  const previewStoredDuration = Number(voicePreview?.durationSeconds) || 0;
  const previewMediaDuration = Number(previewPlayback.duration) || 0;
  const previewDuration = Math.max(previewStoredDuration, previewMediaDuration, 0);
  const previewProgressPct =
    previewDuration > 0 ? Math.min(100, (previewCurrentTime / previewDuration) * 100) : 0;
  const previewIsPlaying = Boolean(previewPlayback.isPlaying);

  return (
    <div
      className={`messenger ${conversationOnly ? "messenger--conversation-only" : ""} ${
        isMobileSheet ? "mobile-sheet" : "desktop-draggable"
      } ${isDraggingSheet || isDraggingDesktop ? "dragging" : ""} ${
        isDraggingDesktop ? "desktop-dragging" : ""
      }`}
      style={messengerStyle}
    >
      <div className="messenger-header">
        <button
          className="messenger-drag-handle"
          type="button"
          onPointerDown={onSheetHandlePointerDown}
          aria-label="Drag messenger panel"
        />

        <div className="messenger-header-main" onPointerDown={onDesktopHeaderPointerDown}>
          <div className={`mh-left${conversationOnly ? " mh-left--conversation" : ""}`}>
            {conversationOnly && selectedContact ? (
              <div className="mh-chat-contact">
                <div className="mh-chat-avatar-wrap">
                  <img src={getAvatar(selectedContact)} alt="" className="mh-chat-avatar" />
                  {onlineUsers.has(selectedContact._id) ? (
                    <span className="mh-chat-online-dot" />
                  ) : null}
                </div>
                <div className="mh-chat-copy">
                  <strong>{selectedHeaderName}</strong>
                  <span>
                    {selectedStatusLabel}
                    {selectedStatusMeta ? ` - ${selectedStatusMeta}` : ""}
                  </span>
                </div>
              </div>
            ) : (
              <strong>Messenger</strong>
            )}
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

      <div className={`messenger-body${conversationOnly ? " messenger-body--conversation-only" : ""}`}>
        {!conversationOnly && (
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
        )}

        <section className="messenger-chat">
          {!selectedContact && (
            <div className="chat-empty">Select a chat to start messaging.</div>
          )}

          {selectedContact && (
            <>
              {!conversationOnly && (
              <div className="chat-topbar" ref={chatMenuRef}>
                <button
                  type="button"
                  className={`chat-top-profile-btn ${chatMenuOpen ? "active" : ""}`}
                  onClick={() => setChatMenuOpen((prev) => !prev)}
                  aria-haspopup="menu"
                  aria-expanded={chatMenuOpen}
                  aria-label={`Open chat options for ${
                    selectedContact.name || selectedContact.username || "this user"
                  }`}
                >
                  <img src={getAvatar(selectedContact)} alt="" className="chat-top-avatar" />
                  <div className="chat-top-copy">
                    <div className="chat-top-name-row">
                      <span className="chat-top-name">
                        {selectedContact.name || selectedContact.username}
                      </span>
                      <span className={`chat-top-caret ${chatMenuOpen ? "open" : ""}`}>
                        <svg viewBox="0 0 20 20" aria-hidden="true">
                          <path d="M5 7.5 10 12.5 15 7.5" />
                        </svg>
                      </span>
                    </div>
                  <div className="chat-top-status">
                    {typingByUserId[selectedContact._id]
                      ? "Typing..."
                      : recordingByUserId[selectedContact._id]
                        ? "Recording..."
                        : onlineUsers.has(selectedContact._id)
                          ? "Online"
                          : "Offline"}
                    {selectedContact?.status?.emoji || selectedContact?.status?.text
                      ? ` · ${selectedContact?.status?.emoji || ""} ${selectedContact?.status?.text || ""}`
                      : ""}
                  </div>
                  </div>
                </button>
                <button
                  type="button"
                  className="messenger-action-btn"
                  onClick={() => {
                    setChatMenuOpen(false);
                    setWatchOpen((prev) => !prev);
                  }}
                  title="Watch Together"
                  aria-label="Watch Together"
                >
                  Watch Together
                </button>

                {chatMenuOpen && (
                  <div className="chat-top-menu" role="menu" aria-label="Conversation options">
                    <div className="chat-top-menu-header">
                      <div className="chat-top-menu-title">
                        {selectedContact.name || selectedContact.username}
                      </div>
                      <div className="chat-top-menu-sub">
                        {selectedContact.username ? `@${selectedContact.username}` : "Chat options"}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="chat-top-menu-item"
                      role="menuitem"
                      onClick={openSelectedProfile}
                    >
                      <span className="chat-top-menu-item-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5Z" />
                        </svg>
                      </span>
                      <span className="chat-top-menu-item-copy">
                        <strong>View profile</strong>
                        <small>Open their Tengacion profile page.</small>
                      </span>
                    </button>

                    <button
                      type="button"
                      className="chat-top-menu-item danger"
                      role="menuitem"
                      onClick={handleBlockSelectedContact}
                      disabled={isBlockingUser}
                    >
                      <span className="chat-top-menu-item-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path d="M12 2a9 9 0 1 0 9 9 9.01 9.01 0 0 0-9-9Zm0 2a6.94 6.94 0 0 1 4.95 2.05L6.05 16.95A7 7 0 0 1 12 4Zm0 14a6.94 6.94 0 0 1-4.95-2.05L17.95 5.05A7 7 0 0 1 12 18Z" />
                        </svg>
                      </span>
                      <span className="chat-top-menu-item-copy">
                        <strong>{isBlockingUser ? "Blocking user..." : "Block user"}</strong>
                        <small>Stop new messages from this person if you feel unsafe.</small>
                      </span>
                    </button>
                  </div>
                )}
              </div>
              )}

              {pinnedEntry ? (
                <div className="messenger-pinned-banner">
                  <button
                    type="button"
                    className="messenger-pinned-banner__main"
                    onClick={focusPinnedMessage}
                  >
                    <small>Pinned by you</small>
                    <strong>{pinnedEntry.senderLabel}: {pinnedEntry.previewText}</strong>
                  </button>
                  <button
                    type="button"
                    className="messenger-pinned-banner__close"
                    onClick={clearPinnedMessage}
                    aria-label="Remove pinned message"
                    title="Remove pinned message"
                  >
                    ×
                  </button>
                </div>
              ) : null}

              {watchOpen && !conversationOnly && (
                <div className="messenger-watch-box">
                  <div className="messenger-watch-controls">
                    <input
                      value={watchUrl}
                      onChange={(event) => setWatchUrl(event.target.value)}
                      placeholder="Paste video URL"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const socket = socketRef.current;
                        if (!socket) {return;}
                        const node = watchVideoRef.current;
                        socket.emit("watch:state", {
                          chatId: selectedId,
                          videoUrl: watchUrl,
                          t: node?.currentTime || 0,
                          isPlaying: false,
                        });
                      }}
                    >
                      Sync
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => setWatchOpen(false)}>
                      Leave
                    </button>
                  </div>
                  {watchUrl ? (
                    <video
                      ref={watchVideoRef}
                      src={watchUrl}
                      controls
                      onPlay={() => {
                        const socket = socketRef.current;
                        if (!socket) {return;}
                        socket.emit("watch:play", {
                          chatId: selectedId,
                          t: watchVideoRef.current?.currentTime || 0,
                        });
                      }}
                      onPause={() => {
                        const socket = socketRef.current;
                        if (!socket) {return;}
                        socket.emit("watch:pause", {
                          chatId: selectedId,
                          t: watchVideoRef.current?.currentTime || 0,
                        });
                      }}
                      onSeeked={() => {
                        const socket = socketRef.current;
                        if (!socket) {return;}
                        socket.emit("watch:seek", {
                          chatId: selectedId,
                          t: watchVideoRef.current?.currentTime || 0,
                        });
                      }}
                    />
                  ) : (
                    <p className="messenger-watch-hint">Paste a video URL to start.</p>
                  )}
                </div>
              )}

              <div className="messenger-messages">
                {loadingMessages && <div className="ms-empty">Loading messages...</div>}

                {!loadingMessages && messages.length === 0 && (
                  <div className="ms-empty">No messages yet. Say hello.</div>
                )}

                {!loadingMessages &&
                  messages.map((m) => {
                    const isMe = toIdString(m.senderId) === meId;
                    const messageKey = toIdString(m._id || m.clientId);
                    const hasAudioAttachment = Array.isArray(m.attachments)
                      && m.attachments.some((file) => file?.type === "audio");
                    const isTextOnlyMessage =
                      Boolean(String(m.text || "").trim())
                      && (!Array.isArray(m.attachments) || m.attachments.length === 0)
                      && m.type !== "contentCard";
                    const isVoiceOnlyMessage =
                      m.type === "voice"
                      && !String(m.text || "").trim()
                      && hasAudioAttachment;
                    const bubbleClass = `${isMe ? "me" : "them"} ${
                      m.failed ? "failed" : ""
                    }`;
                    const reactionSummary = summarizeReactions(m.reactions, meId);
                    const toolsVisible =
                      hoveredMessageId === messageKey
                      || activeMessageId === messageKey
                      || openMessageReactionId === messageKey
                      || openMessageMenuId === messageKey;
                    const messageMenuOpen = openMessageMenuId === messageKey;
                    const isPinnedMessage = pinnedEntry?.messageId === messageKey;
                    return (
                      <div
                        key={m._id || m.clientId}
                        data-message-id={messageKey}
                        className={`message-row ${bubbleClass}${toolsVisible ? " is-tools-open" : ""}`}
                        onMouseEnter={() => setHoveredMessageId(messageKey)}
                        onMouseLeave={() => {
                          setHoveredMessageId((current) =>
                            current === messageKey ? "" : current
                          );
                        }}
                      >
                        {!isMe && !conversationOnly && (
                          <img
                            src={m.senderAvatar || getAvatar(selectedContact)}
                            className="msg-avatar"
                            alt=""
                          />
                        )}

                        <div className="msg-stack">
                        <div
                          className={`msg-bubble${isPinnedMessage ? " is-pinned" : ""}${
                            isVoiceOnlyMessage ? " msg-bubble--voice" : ""
                          }${isTextOnlyMessage ? " msg-bubble--text" : ""}`}
                          onClick={() =>
                            setActiveMessageId((current) =>
                              current === messageKey ? "" : messageKey
                            )
                          }
                        >
                          {m.replyTo ? (
                            <div className="msg-reply-preview">
                              <small>{getReplyLabel({ message: m, meId })}</small>
                              <strong>{m.replyTo.contentTitle || getReplyPreviewText(m.replyTo)}</strong>
                            </div>
                          ) : null}
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
                                    const audioId = `${messageKey}:${index}`;
                                    const resolvedAudioUrl = resolveImage(file.url);
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
                                          onEnded={() => {
                                            const audio = voiceAudioRefs.current.get(audioId);
                                            if (audio) {
                                              audio.currentTime = 0;
                                            }
                                            handleVoiceAudioEvent(audioId, {
                                              isPlaying: false,
                                              currentTime: 0,
                                            });
                                          }}
                                          className="msg-voice-audio-hidden"
                                        >
                                          <source src={resolvedAudioUrl} type={inferAudioMimeFromUrl(file.url)} />
                                        </audio>
                                        <button
                                          type="button"
                                          className={`msg-voice-play-btn${isPlaying ? " is-playing" : ""}`}
                                          onClick={() => toggleVoiceNotePlayback(audioId)}
                                          aria-label={isPlaying ? "Pause voice note" : "Play voice note"}
                                          title={isPlaying ? "Pause" : "Play"}
                                        >
                                          <svg viewBox="0 0 24 24" aria-hidden="true">
                                            {isPlaying ? (
                                              <>
                                                <path d="M9 7.5v9" />
                                                <path d="M15 7.5v9" />
                                              </>
                                            ) : (
                                              <path d="m9 7 7 5-7 5z" />
                                            )}
                                          </svg>
                                        </button>
                                        <VoiceWaveform progressPct={progressPct} isPlaying={isPlaying} />
                                        <div className="msg-voice-time">
                                          {formatDuration(duration || currentTime)}
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
                          {reactionSummary.total > 0 ? (
                            <div className="msg-reaction-summary">
                              {reactionSummary.items.map((entry) => (
                                <button
                                  key={`${messageKey}-${entry.emoji}`}
                                  type="button"
                                  className={`msg-reaction-chip${entry.viewerReacted ? " is-active" : ""}`}
                                  onClick={() => reactToMessageBubble(m, entry.emoji)}
                                >
                                  <span>{entry.emoji}</span>
                                  <small>{entry.count}</small>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="msg-time">
                          {new Date(m.time).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {m.pending ? " - Sending" : ""}
                          {m.failed ? " - Failed" : ""}
                        </div>
                        {!m.pending ? (
                          <div className={`msg-tools msg-tools--${isMe ? "me" : "them"}${toolsVisible ? " is-visible" : ""}`}>
                            <div className="msg-tool-menu-wrap" ref={messageMenuOpen ? messageMenuRef : null}>
                              <button
                                type="button"
                                className="msg-tool-btn"
                                aria-label="More message actions"
                                title="More"
                                aria-haspopup="menu"
                                aria-expanded={messageMenuOpen}
                                onClick={() => {
                                  setOpenMessageReactionId("");
                                  setOpenMessageMenuId((current) =>
                                    current === messageKey ? "" : messageKey
                                  );
                                }}
                              >
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                  <circle cx="12" cy="5.5" r="1.5" />
                                  <circle cx="12" cy="12" r="1.5" />
                                  <circle cx="12" cy="18.5" r="1.5" />
                                </svg>
                              </button>
                              {messageMenuOpen ? (
                                <div className={`msg-tool-menu msg-tool-menu--${isMe ? "me" : "them"}`} role="menu">
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => handleRemoveMessage(m)}
                                  >
                                    {isMe ? "Unsend" : "Remove for you"}
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => handleForwardMessage(m)}
                                  >
                                    Forward
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => handleTogglePinnedMessage(m)}
                                  >
                                    {isPinnedMessage ? "Unpin" : "Pin"}
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => handleReportMessage(m)}
                                  >
                                    Report
                                  </button>
                                </div>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              className="msg-tool-btn"
                              aria-label="Reply to message"
                              title="Reply"
                              onClick={() => {
                                setOpenMessageMenuId("");
                                selectReplyTarget(m);
                              }}
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M10 8 5 12l5 4" />
                                <path d="M6 12h9a5 5 0 0 1 5 5" />
                              </svg>
                            </button>
                            <div className="msg-tool-picker-wrap">
                              <button
                                type="button"
                                className="msg-tool-btn"
                                aria-label="React to message"
                                title="React"
                                onClick={() => {
                                  setOpenMessageMenuId("");
                                  setOpenMessageReactionId((current) =>
                                    current === messageKey ? "" : messageKey
                                  );
                                }}
                              >
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                  <circle cx="12" cy="12" r="9" />
                                  <path d="M9 10h.01" />
                                  <path d="M15 10h.01" />
                                  <path d="M8.5 14c1 1.3 2.1 2 3.5 2s2.5-.7 3.5-2" />
                                </svg>
                              </button>
                              {openMessageReactionId === messageKey ? (
                                <div className={`msg-reaction-picker msg-reaction-picker--${isMe ? "me" : "them"}`}>
                                  {MESSAGE_ACTION_EMOJIS.map((emoji) => (
                                    <button
                                      key={`${messageKey}-${emoji}`}
                                      type="button"
                                      className="msg-reaction-picker-btn"
                                      onClick={() => reactToMessageBubble(m, emoji)}
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                        </div>
                      </div>
                    );
                  })}

                <div ref={endRef} />
              </div>

              <div className="messenger-input">
                {replyTarget ? (
                  <div className="messenger-reply-banner">
                    <div className="messenger-reply-banner__copy">
                      <small>
                        Replying to {toIdString(replyTarget.senderId) === meId ? "yourself" : replyTarget.senderName || "message"}
                      </small>
                      <strong>{replyTarget.contentTitle || replyTarget.previewText}</strong>
                    </div>
                    <button
                      type="button"
                      className="messenger-reply-banner__close"
                      onClick={clearReplySelection}
                      aria-label="Cancel reply"
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}
                {(isRecording || voicePreview) && (
                  <div className="messenger-voice-recorder">
                    <div className="messenger-voice-controls">
                      {isRecording ? (
                        <>
                          <div className="msg-voice-card msg-voice-card--preview msg-voice-card--recording">
                            <button
                              type="button"
                              className="msg-voice-play-btn msg-voice-play-btn--stop"
                              onClick={stopVoiceNote}
                              aria-label="Stop recording"
                              title="Stop recording"
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <rect x="8" y="8" width="8" height="8" rx="1.5" />
                              </svg>
                            </button>
                            <VoiceWaveform progressPct={100} isPlaying className="is-recorder" />
                            <div className="msg-voice-time">
                              <span className="messenger-voice-dot live" />
                              <span>{formatDuration(recordingSeconds)}</span>
                            </div>
                          </div>
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
                          <div className="msg-voice-card msg-voice-card--preview">
                            <audio
                              ref={(node) => {
                                if (node) {
                                  voiceAudioRefs.current.set(VOICE_PREVIEW_AUDIO_ID, node);
                                } else {
                                  voiceAudioRefs.current.delete(VOICE_PREVIEW_AUDIO_ID);
                                }
                              }}
                              preload="metadata"
                              onLoadedMetadata={(event) =>
                                handleVoiceAudioEvent(VOICE_PREVIEW_AUDIO_ID, {
                                  duration: event.currentTarget.duration || 0,
                                })
                              }
                              onTimeUpdate={(event) =>
                                handleVoiceAudioEvent(VOICE_PREVIEW_AUDIO_ID, {
                                  currentTime: event.currentTarget.currentTime || 0,
                                  duration:
                                    event.currentTarget.duration ||
                                    previewPlayback.duration ||
                                    0,
                                })
                              }
                              onPlay={() => {
                                pauseOtherVoiceNotes(VOICE_PREVIEW_AUDIO_ID);
                                handleVoiceAudioEvent(VOICE_PREVIEW_AUDIO_ID, { isPlaying: true });
                              }}
                              onPause={() =>
                                handleVoiceAudioEvent(VOICE_PREVIEW_AUDIO_ID, { isPlaying: false })
                              }
                              onEnded={() => {
                                const audio = voiceAudioRefs.current.get(VOICE_PREVIEW_AUDIO_ID);
                                if (audio) {
                                  audio.currentTime = 0;
                                }
                                handleVoiceAudioEvent(VOICE_PREVIEW_AUDIO_ID, {
                                  isPlaying: false,
                                  currentTime: 0,
                                });
                              }}
                              className="msg-voice-audio-hidden"
                            >
                              <source
                                src={voicePreview?.url || ""}
                                type={voicePreview?.mimeType || "audio/webm"}
                              />
                            </audio>
                            <button
                              type="button"
                              className={`msg-voice-play-btn${previewIsPlaying ? " is-playing" : ""}`}
                              onClick={() => toggleVoiceNotePlayback(VOICE_PREVIEW_AUDIO_ID)}
                              aria-label={previewIsPlaying ? "Pause preview" : "Play preview"}
                              title={previewIsPlaying ? "Pause preview" : "Play preview"}
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                {previewIsPlaying ? (
                                  <>
                                    <path d="M9 7.5v9" />
                                    <path d="M15 7.5v9" />
                                  </>
                                ) : (
                                  <path d="m9 7 7 5-7 5z" />
                                )}
                              </svg>
                            </button>
                            <VoiceWaveform
                              progressPct={previewProgressPct}
                              isPlaying={previewIsPlaying}
                              className="is-preview"
                            />
                            <div className="msg-voice-time">
                              {formatDuration(previewDuration || recordingSeconds)}
                            </div>
                          </div>
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
                    onClick={() => openShareComposer()}
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
                <div className="messenger-composer-row">
                  <div className="messenger-composer-tools" aria-label="Chat tools">
                    <button
                      type="button"
                      className={`messenger-composer-btn${isRecording ? " is-active" : ""}`}
                      onClick={isRecording ? stopVoiceNote : startVoiceNote}
                      title="Voice message"
                      aria-label="Voice message"
                      disabled={Boolean(voicePreview)}
                    >
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
                    </button>
                    <button
                      type="button"
                      className="messenger-composer-btn"
                      onClick={openAttachmentPicker}
                      title="Attach photo or file"
                      aria-label="Attach photo or file"
                      disabled={isRecording || isSendingVoice}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4.5 7.5A1.5 1.5 0 0 1 6 6h12a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 18 18H6a1.5 1.5 0 0 1-1.5-1.5z" />
                        <path d="M8.25 10.25h.01" />
                        <path d="m19.5 15-4.71-4.71a1.5 1.5 0 0 0-2.12 0L7.5 15.46" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className={`messenger-composer-btn${showReactions ? " is-active" : ""}`}
                      onClick={() => {
                        setShowReactions((prev) => !prev);
                        setShowEmojiPicker(false);
                        setGifOpen(false);
                      }}
                      title="Emoji"
                      aria-label="Emoji"
                      disabled={isRecording || isSendingVoice}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="12" r="8.5" />
                        <path d="M9 10h.01" />
                        <path d="M15 10h.01" />
                        <path d="M8.8 14.1c1 .95 2.08 1.4 3.2 1.4 1.12 0 2.2-.45 3.2-1.4" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className={`messenger-composer-btn messenger-composer-btn--gif${gifOpen ? " is-active" : ""}`}
                      onClick={() => {
                        setGifOpen((prev) => !prev);
                        setShowEmojiPicker(false);
                        setShowReactions(false);
                      }}
                      title="GIF"
                      aria-label="GIF"
                      disabled={isRecording || isSendingVoice}
                    >
                      GIF
                    </button>
                  </div>

                  <div className="messenger-composer-entry">
                    <input
                      ref={composerInputRef}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && send()}
                      placeholder="Aa"
                      disabled={isRecording}
                    />
                  </div>

                  <button
                    type="button"
                    className={`messenger-composer-send${canSendText ? " is-send" : ""}`}
                    onClick={() => {
                      if (canSendText) {
                        send();
                        return;
                      }
                      if (!composerBusy) {
                        sendQuickReaction("\u{1F44D}");
                      }
                    }}
                    title={canSendText ? "Send message" : "Send like"}
                    aria-label={canSendText ? "Send message" : "Send like"}
                    disabled={composerBusy && !canSendText}
                  >
                    {canSendText ? (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 20 20 12 4 4l2 6 8 2-8 2z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M11 21H7.5A2.5 2.5 0 0 1 5 18.5V11h6z" />
                        <path d="M11 11 13.6 5.8A2.2 2.2 0 0 1 15.57 4 1.43 1.43 0 0 1 17 5.43V9h1.53A2.47 2.47 0 0 1 21 11.47a2.5 2.5 0 0 1-.12.77l-1.54 5.12A2.5 2.5 0 0 1 16.95 19H11" />
                      </svg>
                    )}
                  </button>
                </div>
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
        onClose={() => {
          setShareOpen(false);
          setShareDraftPayload(null);
        }}
        onSubmit={shareContent}
        contacts={contacts}
        onShareFollowers={shareToFollowers}
        initialPayload={shareDraftPayload}
      />
    </div>
  );
}


