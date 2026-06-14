export const MEBIBYTE = 1024 * 1024;

export const UPLOAD_LIMITS = Object.freeze({
  IMAGE_BYTES: 10 * MEBIBYTE,
  PROFILE_STORY_VIDEO_BYTES: 25 * MEBIBYTE,
  FEED_VIDEO_BYTES: 50 * MEBIBYTE,
  MARKETPLACE_PRODUCT_VIDEO_BYTES: 30 * MEBIBYTE,
  CREATOR_MEDIA_BYTES: 100 * MEBIBYTE,
  ADMIN_SPECIAL_BYTES: 200 * MEBIBYTE,
});

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
