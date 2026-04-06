import { resolveImage } from "../../api";

export const GROUP_SHARE_STORAGE_KEY = "tengacion:group-shares";

export const DEFAULT_SHARE_GROUPS = [
  {
    id: "artists-hub",
    name: "Tengacion Artists Hub",
    note: "Active this week",
  },
  {
    id: "afrobeat-producers",
    name: "Afrobeat Producers",
    note: "Beat swaps and sessions",
  },
  {
    id: "live-session-organizers",
    name: "Live Session Organizers",
    note: "Planning the next stage run",
  },
  {
    id: "songwriters-community",
    name: "Songwriters Community",
    note: "Lyrics, hooks, and drafts",
  },
];

export const SHARE_DESTINATION_OPTIONS = [
  { id: "feed", label: "Feed" },
  { id: "story", label: "Story" },
  { id: "group", label: "Group" },
  { id: "profile", label: "Friend's profile" },
];

export const SHARE_PRIVACY_OPTIONS = [
  { id: "public", label: "Public" },
  { id: "friends", label: "Friends" },
  { id: "private", label: "Only me" },
];

export const fallbackAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "User"
  )}&size=96&background=E3EFE7&color=1B5838`;

export const buildPostShareUrl = (postId = "") => {
  const cleanId = String(postId || "").trim();
  const base =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.hostname === "www.tengacion.com"
        ? "https://tengacion.com"
        : window.location.origin
      : "https://tengacion.com";
  if (!cleanId) {
    return "";
  }
  return `${base}/posts/${cleanId}`;
};

export const getAuthorName = (post = {}) =>
  String(post?.user?.name || post?.name || post?.user?.username || "Tengacion creator").trim();

export const getAuthorUsername = (post = {}) =>
  String(post?.user?.username || post?.username || "").trim().replace(/^@+/, "");

const getMediaUrl = (value) => {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  return String(value.secureUrl || value.secure_url || value.url || "").trim();
};

export const truncateText = (value = "", limit = 180) => {
  const clean = String(value || "").trim();
  if (!clean) {
    return "";
  }
  return clean.length > limit ? `${clean.slice(0, limit - 3).trim()}...` : clean;
};

export const getPostPreviewImage = (post = {}) => {
  const mediaList = Array.isArray(post?.media) ? post.media : [];
  const firstMedia = mediaList[0];
  const rawMediaUrl = getMediaUrl(firstMedia);

  return (
    resolveImage(post?.video?.thumbnailUrl || "") ||
    resolveImage(rawMediaUrl || "") ||
    resolveImage(post?.image || post?.photo || "") ||
    resolveImage(post?.sharedPost?.previewImage || "") ||
    ""
  );
};

export const buildShareBody = ({ note = "", post = {}, url = "", compact = false } = {}) => {
  const trimmedNote = String(note || "").trim();
  const authorName = getAuthorName(post);
  const authorUsername = getAuthorUsername(post);
  const authorLine = authorUsername
    ? `Shared from ${authorName} (@${authorUsername})`
    : `Shared from ${authorName}`;
  const excerpt = truncateText(post?.text || post?.sharedPost?.originalText || "", compact ? 120 : 220);

  return [trimmedNote, authorLine, excerpt, url]
    .filter(Boolean)
    .join(compact ? "\n" : "\n\n");
};

export const normalizeShareTarget = (entry = {}) => {
  const id = String(entry?._id || entry?.id || "").trim();
  if (!id) {
    return null;
  }

  return {
    _id: id,
    name: String(entry?.name || entry?.username || "Friend").trim(),
    username: String(entry?.username || "").trim(),
    avatar: resolveImage(entry?.avatar || entry?.profilePic || "") || "",
    lastMessageAt: Number(entry?.lastMessageAt) || 0,
  };
};

export const mergeShareTargets = (contacts = [], friends = []) => {
  const merged = new Map();

  [...contacts, ...friends].forEach((entry) => {
    const normalized = normalizeShareTarget(entry);
    if (!normalized) {
      return;
    }

    const existing = merged.get(normalized._id);
    if (!existing) {
      merged.set(normalized._id, normalized);
      return;
    }

    merged.set(normalized._id, {
      ...existing,
      ...normalized,
      lastMessageAt: Math.max(existing.lastMessageAt, normalized.lastMessageAt),
      avatar: normalized.avatar || existing.avatar,
    });
  });

  return Array.from(merged.values()).sort((left, right) => {
    if (left.lastMessageAt !== right.lastMessageAt) {
      return right.lastMessageAt - left.lastMessageAt;
    }
    return String(left.name || left.username || "").localeCompare(
      String(right.name || right.username || "")
    );
  });
};

export const buildShareState = ({ post = {}, note = "", url = "" } = {}) => ({
  postId: String(post?._id || "").trim(),
  url: String(url || "").trim(),
  note: String(note || "").trim(),
  authorName: getAuthorName(post),
  authorUsername: getAuthorUsername(post),
  excerpt: truncateText(post?.text || post?.sharedPost?.originalText || "", 220),
  previewImage: getPostPreviewImage(post),
});

export const mapPrivacyToStoryVisibility = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "public") {
    return "public";
  }
  return "friends";
};

export const readStoredGroupShares = () => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(GROUP_SHARE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

export const writeStoredGroupShares = (value) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(GROUP_SHARE_STORAGE_KEY, JSON.stringify(value || {}));
  } catch {
    // Ignore storage errors for this lightweight group share handoff.
  }
};
