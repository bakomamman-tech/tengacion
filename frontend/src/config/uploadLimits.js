export const MEBIBYTE = 1024 * 1024;

export const UPLOAD_LIMITS = Object.freeze({
  IMAGE_BYTES: 10 * MEBIBYTE,
  STORY_IMAGE_BYTES: 100 * MEBIBYTE,
  PROFILE_STORY_VIDEO_BYTES: 100 * MEBIBYTE,
  FEED_VIDEO_BYTES: 200 * MEBIBYTE,
  REEL_VIDEO_BYTES: 200 * MEBIBYTE,
  MARKETPLACE_PRODUCT_VIDEO_BYTES: 200 * MEBIBYTE,
  CREATOR_MEDIA_BYTES: 100 * MEBIBYTE,
  CREATOR_VIDEO_BYTES: 200 * MEBIBYTE,
  ADMIN_SPECIAL_BYTES: 200 * MEBIBYTE,
});

export const getPostVideoUploadLimit = (postType = "") =>
  String(postType || "").trim().toLowerCase() === "reel"
    ? UPLOAD_LIMITS.REEL_VIDEO_BYTES
    : UPLOAD_LIMITS.FEED_VIDEO_BYTES;

export const formatUploadLimit = (bytes = 0) => {
  const sizeInMb = Number(bytes || 0) / MEBIBYTE;
  return Number.isInteger(sizeInMb) ? `${sizeInMb}MB` : `${sizeInMb.toFixed(1)}MB`;
};

export const getUploadSizeError = (file, maxBytes, label = "File") => {
  if (!file || (Number(file.size) || 0) <= maxBytes) {
    return "";
  }
  return `${label} must be ${formatUploadLimit(maxBytes)} or smaller.`;
};
