import { resolveImage } from "../api";

const VIDEO_EXTENSION_PATTERN = /\.(mp4|webm|ogg|mov|m4v)(?:\?.*)?$/i;
const IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|gif|webp|bmp|svg|avif)(?:\?.*)?$/i;

const toText = (value = "") => String(value || "").trim();
const toNumber = (value = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const inferMediaType = (entry = {}, fallbackType = "") => {
  const explicitType = toText(entry?.type).toLowerCase();
  if (explicitType === "video" || explicitType === "image") {
    return explicitType;
  }

  const mimeType = toText(entry?.mimeType || entry?.mimetype).toLowerCase();
  if (mimeType.startsWith("video/")) {
    return "video";
  }
  if (mimeType.startsWith("image/")) {
    return "image";
  }

  const url = toText(
    entry?.secureUrl ||
      entry?.secure_url ||
      entry?.url ||
      entry?.playbackUrl ||
      entry?.thumbnailUrl ||
      entry?.previewUrl
  );
  if (VIDEO_EXTENSION_PATTERN.test(url)) {
    return "video";
  }
  if (IMAGE_EXTENSION_PATTERN.test(url)) {
    return "image";
  }

  return fallbackType === "video" ? "video" : "image";
};

const normalizeEntry = (entry = {}, index = 0, fallbackType = "") => {
  if (!entry) {
    return null;
  }

  const type = inferMediaType(entry, fallbackType);
  const primaryUrl = resolveImage(
    entry?.secureUrl ||
      entry?.secure_url ||
      entry?.url ||
      entry?.playbackUrl ||
      ""
  );
  const previewUrl = resolveImage(
    entry?.thumbnailUrl ||
      entry?.previewUrl ||
      primaryUrl
  );

  if (!primaryUrl) {
    return null;
  }

  return {
    id: toText(entry?.publicId || entry?.public_id || entry?.assetId) || `post-media-${index}`,
    type,
    url: primaryUrl,
    previewUrl: previewUrl || primaryUrl,
    publicId: toText(entry?.publicId || entry?.public_id),
    mimeType: toText(entry?.mimeType || entry?.mimetype).toLowerCase(),
    format: toText(entry?.format).toLowerCase(),
    width: toNumber(entry?.width),
    height: toNumber(entry?.height),
    duration: toNumber(entry?.duration),
    originalFilename: toText(entry?.originalFilename),
    resourceType: toText(entry?.resourceType || entry?.resource_type).toLowerCase(),
    isLegacy: Boolean(entry?.isLegacy),
  };
};

export const normalizePostMedia = (post = {}) => {
  const rawMedia = Array.isArray(post?.media)
    ? post.media
    : post?.media
      ? [post.media]
      : [];
  const normalizedMedia = rawMedia
    .map((entry, index) => normalizeEntry(entry, index))
    .filter(Boolean);

  if (normalizedMedia.length > 0) {
    return normalizedMedia;
  }

  const legacyVideo = normalizeEntry(
    {
      ...((post?.video && typeof post.video === "object") ? post.video : {}),
      type: "video",
      url: post?.video?.playbackUrl || post?.video?.url || "",
      previewUrl: post?.video?.thumbnailUrl || post?.video?.playbackUrl || post?.video?.url || "",
    },
    0,
    "video"
  );
  if (legacyVideo) {
    return [{ ...legacyVideo, id: legacyVideo.id || "post-video-legacy", isLegacy: true }];
  }

  const legacyUrl = resolveImage(post?.image || post?.photo || "");
  if (!legacyUrl) {
    return [];
  }

  const fallbackType =
    toText(post?.type).toLowerCase() === "video" || VIDEO_EXTENSION_PATTERN.test(legacyUrl)
      ? "video"
      : "image";

  return [
    {
      id: "post-image-legacy",
      type: fallbackType,
      url: legacyUrl,
      previewUrl: legacyUrl,
      publicId: "",
      mimeType: "",
      format: "",
      width: 0,
      height: 0,
      duration: 0,
      originalFilename: "",
      resourceType: fallbackType,
      isLegacy: true,
    },
  ];
};
