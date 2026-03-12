import { resolveImage } from "./api";

const DEFAULT_NOTIFICATION_COPY = {
  like: "liked your post",
  comment: "commented on your post",
  reply: "replied to your comment",
  follow: "started following you",
  message: "sent you a message",
  mention: "mentioned you in a comment",
  tag: "tagged you in a post",
  friend_request: "sent you a friend request",
  birthday: "sent you a birthday update",
  system: "sent you a notification",
};

const NOTIFICATION_TYPE_LABELS = {
  like: "Like",
  comment: "Comment",
  reply: "Reply",
  follow: "Follow",
  message: "Message",
  mention: "Mention",
  tag: "Tag",
  friend_request: "Request",
  birthday: "Birthday",
  system: "System",
};

const fallbackAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "Tengacion"
  )}&size=96&background=DFE8F6&color=1D3A6D`;

const isRecord = (value) => value && typeof value === "object";

const ensureSentence = (value) => {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  return /[.!?]$/.test(text) ? text : `${text}.`;
};

const toTimestamp = (value) => {
  const stamp = new Date(value || "").getTime();
  return Number.isFinite(stamp) ? stamp : NaN;
};

const isToday = (value) => {
  const stamp = toTimestamp(value);
  if (!Number.isFinite(stamp)) {
    return false;
  }
  const date = new Date(stamp);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
};

const getVisualType = (entry) => {
  const baseType = String(entry?.type || "system").toLowerCase();
  const metadataType = String(entry?.metadata?.type || "").toLowerCase();

  if (baseType === "system" && metadataType === "birthday") {
    return "birthday";
  }

  return baseType;
};

export const getRelativeNotificationTime = (value) => {
  const stamp = toTimestamp(value);
  if (!Number.isFinite(stamp)) {
    return "now";
  }

  const diffSec = Math.max(1, Math.floor((Date.now() - stamp) / 1000));
  if (diffSec < 60) {
    return `${diffSec}s`;
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin}m`;
  }

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return `${diffHours}h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
};

export const normalizeNotificationEntry = (entry) => {
  const sender = isRecord(entry?.sender) ? entry.sender : null;
  const metadata = isRecord(entry?.metadata) ? entry.metadata : {};
  const type = getVisualType(entry);
  const actorName = sender?.name || (type === "birthday" ? "Tengacion" : "Someone");
  const rawMessage = String(entry?.text || "").trim();
  const entity = isRecord(entry?.entity) ? entry.entity : {};

  return {
    _id: String(entry?._id || ""),
    read: Boolean(entry?.read),
    type,
    typeLabel: NOTIFICATION_TYPE_LABELS[type] || NOTIFICATION_TYPE_LABELS.system,
    actorName,
    senderId: String(sender?._id || ""),
    senderUsername: String(sender?.username || ""),
    actorAvatar: resolveImage(sender?.avatar) || fallbackAvatar(actorName),
    messageText: ensureSentence(rawMessage || DEFAULT_NOTIFICATION_COPY[type] || DEFAULT_NOTIFICATION_COPY.system),
    previewText: String(metadata?.previewText || "").trim(),
    previewImage: resolveImage(metadata?.previewImage) || "",
    createdAt: entry?.createdAt || null,
    timeLabel: getRelativeNotificationTime(entry?.createdAt),
    link: String(metadata?.link || ""),
    entity: {
      id: entity?.id ? String(entity.id) : "",
      model: String(entity?.model || ""),
    },
  };
};

export const getNotificationTarget = (entry) => {
  const item = entry?.messageText ? entry : normalizeNotificationEntry(entry);
  const entityModel = String(item?.entity?.model || "").toLowerCase();
  const entityId = String(item?.entity?.id || "");

  if (item.type === "message" || entityModel === "message") {
    return {
      path: item.link || "/home",
      state: { openMessenger: true },
    };
  }

  if (entityModel === "post" && entityId) {
    return { path: `/posts/${entityId}` };
  }

  if (item.link) {
    return { path: item.link };
  }

  if (item.senderUsername) {
    return { path: `/profile/${item.senderUsername}` };
  }

  return { path: "/notifications" };
};

export const splitNotificationsBySection = (entries, { filter = "all" } = {}) => {
  const normalized = Array.isArray(entries)
    ? entries.map(normalizeNotificationEntry).filter((item) => item._id)
    : [];

  const filtered =
    filter === "unread" ? normalized.filter((item) => !item.read) : normalized;

  const newItems = filtered.filter((item) => !item.read);
  const todayItems = filtered.filter((item) => item.read && isToday(item.createdAt));
  const earlierItems = filtered.filter((item) => item.read && !isToday(item.createdAt));

  return {
    filtered,
    newItems,
    todayItems,
    earlierItems,
  };
};
