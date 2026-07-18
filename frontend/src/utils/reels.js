import { resolveImage } from "../api";

const VIDEO_EXT_RE = /\.(mp4|webm|ogg|mov|m4v)(?:[?#].*)?$/i;

const getMediaEntries = (post) =>
  (Array.isArray(post?.media) ? post.media : post?.media ? [post.media] : []).filter(Boolean);

const getMediaUrl = (value) => {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value.trim();
  }
  return String(
    value.secureUrl ||
      value.secure_url ||
      value.url ||
      value.playbackUrl ||
      value.mediaUrl ||
      value.fileUrl ||
      value.legacyPath ||
      ""
  ).trim();
};

const getMediaType = (value) =>
  value && typeof value === "object"
    ? String(value.type || value.resourceType || value.resource_type || "").toLowerCase()
    : "";

const isVideoUrl = (value) => VIDEO_EXT_RE.test(String(value || "").trim());

const isVideoMedia = (value) => {
  const mimeType =
    value && typeof value === "object"
      ? String(value.mimeType || value.mime_type || value.mimetype || "").toLowerCase()
      : "";
  return getMediaType(value) === "video" || mimeType.startsWith("video/") || isVideoUrl(getMediaUrl(value));
};

const resolveFirstMediaUrl = (candidates = []) => {
  for (const candidate of candidates) {
    const resolved = resolveImage(getMediaUrl(candidate));
    if (resolved) {
      return resolved;
    }
  }
  return "";
};

const urlsMatch = (left, right) => {
  const normalize = (value) => String(value || "").trim().split("#")[0];
  return Boolean(normalize(left) && normalize(left) === normalize(right));
};

const isReelPlaybackRestricted = (post) => {
  const moderationStatus = String(post?.moderationStatus || "").trim().toUpperCase();
  return Boolean(
    post?.autoplayDisabled ||
      post?.restricted ||
      post?.video?.restricted ||
      moderationStatus === "RESTRICTED_BLURRED" ||
      moderationStatus.startsWith("BLOCK_")
  );
};

const getAvatarInitials = (post = {}) => {
  const label = String(
    post?.user?.name ||
      post?.author?.name ||
      post?.creator?.name ||
      post?.name ||
      post?.user?.username ||
      post?.author?.username ||
      post?.username ||
      "Tengacion"
  ).trim();
  const words = label.split(/\s+/).filter(Boolean);
  const initials = (words.length > 1 ? `${words[0][0]}${words.at(-1)[0]}` : words[0]?.slice(0, 2))
    ?.toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return initials || "T";
};

export const getReelAvatarFallback = (post = {}) => {
  const initials = getAvatarInitials(post);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="#1b5838"/><text x="48" y="53" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-family="Arial,sans-serif" font-size="34" font-weight="700">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export const getReelVideoUrl = (post) => {
  if (isReelPlaybackRestricted(post)) {
    return "";
  }

  const videoMedia = getMediaEntries(post).find(isVideoMedia);
  return resolveFirstMediaUrl([
    post?.video?.playbackUrl,
    post?.video?.secureUrl,
    post?.video?.secure_url,
    post?.video?.url,
    post?.video?.fileUrl,
    post?.video?.legacyPath,
    videoMedia,
    post?.videoUrl,
    post?.mediaUrl,
    post?.image,
    post?.photo,
  ]);
};

export const getReelPoster = (post) => {
  const mediaEntries = getMediaEntries(post);
  if (isReelPlaybackRestricted(post)) {
    const restrictedPreviews = [
      post?.blurPreviewUrl,
      ...mediaEntries.map((entry) => entry?.restrictedPreviewUrl),
    ];
    for (const candidate of restrictedPreviews) {
      const resolved = resolveImage(getMediaUrl(candidate));
      if (resolved && !isVideoUrl(resolved)) {
        return resolved;
      }
    }
    return "";
  }

  const firstMedia = mediaEntries[0] || null;
  const videoMedia = mediaEntries.find(isVideoMedia) || null;
  const videoUrl = getReelVideoUrl(post);
  const candidates = [
    post?.video?.thumbnailUrl,
    post?.video?.thumbnail_url,
    post?.video?.posterUrl,
    post?.video?.poster,
    post?.video?.previewUrl,
    videoMedia?.thumbnailUrl,
    videoMedia?.thumbnail_url,
    videoMedia?.posterUrl,
    videoMedia?.poster,
    videoMedia?.previewUrl,
    ...mediaEntries.flatMap((entry) => [
      entry?.thumbnailUrl,
      entry?.thumbnail_url,
      entry?.posterUrl,
      entry?.poster,
      entry?.previewUrl,
    ]),
    post?.thumbnailUrl,
    post?.thumbnail,
    post?.posterUrl,
    post?.poster,
    post?.coverImage,
    post?.blurPreviewUrl,
    post?.image,
    post?.photo,
    isVideoMedia(firstMedia) ? "" : getMediaUrl(firstMedia),
    ...mediaEntries.filter((entry) => !isVideoMedia(entry)).map(getMediaUrl),
  ];

  for (const candidate of candidates) {
    const resolved = resolveImage(getMediaUrl(candidate));
    if (!resolved || isVideoUrl(resolved) || urlsMatch(resolved, videoUrl)) {
      continue;
    }
    return resolved;
  }

  return "";
};

export const isReelCandidate = (post) => {
  const hasVideoMedia = getMediaEntries(post).some(isVideoMedia);
  const videoUrl = getReelVideoUrl(post);

  return Boolean(
    videoUrl &&
      (
        String(post?.type || "").toLowerCase() === "reel" ||
        String(post?.type || "").toLowerCase() === "video" ||
        hasVideoMedia ||
        VIDEO_EXT_RE.test(videoUrl)
      )
  );
};

export const sortReels = (feed = []) =>
  [...(Array.isArray(feed) ? feed : [])].sort((left, right) => {
    const leftIsNativeReel = String(left?.type || "").toLowerCase() === "reel";
    const rightIsNativeReel = String(right?.type || "").toLowerCase() === "reel";
    if (leftIsNativeReel !== rightIsNativeReel) {
      return Number(rightIsNativeReel) - Number(leftIsNativeReel);
    }
    return new Date(right?.createdAt || 0).getTime() - new Date(left?.createdAt || 0).getTime();
  });

export const getReelDisplayName = (post) =>
  post?.user?.name ||
  post?.author?.name ||
  post?.creator?.name ||
  post?.name ||
  post?.user?.username ||
  post?.author?.username ||
  post?.username ||
  "Unknown creator";

export const getReelUsername = (post) =>
  post?.user?.username || post?.author?.username || post?.creator?.username || post?.username || "";

export const getReelAvatar = (post) =>
  resolveFirstMediaUrl([
    post?.user?.profilePic,
    post?.user?.avatar,
    post?.user?.avatarUrl,
    post?.user?.profilePicture,
    post?.author?.profilePic,
    post?.author?.avatar,
    post?.author?.avatarUrl,
    post?.creator?.profilePic,
    post?.creator?.avatar,
    post?.avatar,
    post?.profilePic,
    post?.profileImage,
    post?.avatarUrl,
  ]) || getReelAvatarFallback(post);
