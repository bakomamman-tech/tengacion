import { resolveImage } from "../api";

const VIDEO_EXT_RE = /\.(mp4|webm|ogg|mov|m4v)(?:\?.*)?$/i;

const getFirstMedia = (post) =>
  Array.isArray(post?.media) ? post.media[0] || null : post?.media || null;

const getMediaUrl = (value) => {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  return String(value.secureUrl || value.secure_url || value.url || "").trim();
};

export const getReelVideoUrl = (post) => {
  const firstMedia = getFirstMedia(post);
  const firstMediaUrl = getMediaUrl(firstMedia);

  return resolveImage(
    post?.video?.playbackUrl || post?.video?.url || firstMediaUrl || post?.image || post?.photo || ""
  );
};

export const getReelPoster = (post) => {
  const firstMedia = getFirstMedia(post);
  const firstMediaUrl = getMediaUrl(firstMedia);
  const firstMediaType =
    firstMedia && typeof firstMedia === "object"
      ? String(firstMedia.type || "").toLowerCase()
      : "";
  const firstMediaPoster =
    firstMedia && typeof firstMedia === "object"
      ? firstMedia.thumbnailUrl || firstMedia.thumbnail_url || firstMedia.poster || ""
      : "";
  const imageFallback =
    firstMediaType === "video" || VIDEO_EXT_RE.test(firstMediaUrl) ? "" : firstMediaUrl;

  return resolveImage(
    post?.video?.thumbnailUrl || firstMediaPoster || post?.image || post?.photo || imageFallback || ""
  );
};

export const isReelCandidate = (post) => {
  const firstMedia = getFirstMedia(post);
  const firstMediaType =
    firstMedia && typeof firstMedia === "object"
      ? String(firstMedia.type || "").toLowerCase()
      : "";
  const videoUrl = getReelVideoUrl(post);

  return Boolean(
    videoUrl &&
      (
        String(post?.type || "").toLowerCase() === "reel" ||
        String(post?.type || "").toLowerCase() === "video" ||
        firstMediaType === "video" ||
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
  post?.user?.name || post?.name || post?.user?.username || post?.username || "Unknown creator";

export const getReelUsername = (post) => post?.user?.username || post?.username || "";

export const getReelAvatar = (post) =>
  resolveImage(post?.user?.profilePic || post?.avatar || post?.user?.avatar) || "/avatar.png";

