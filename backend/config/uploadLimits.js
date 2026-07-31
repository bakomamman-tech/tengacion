const MEBIBYTE = 1024 * 1024;

const UPLOAD_LIMITS = Object.freeze({
  IMAGE_BYTES: 10 * MEBIBYTE,
  PROFILE_STORY_VIDEO_BYTES: 25 * MEBIBYTE,
  FEED_VIDEO_BYTES: 50 * MEBIBYTE,
  REEL_VIDEO_BYTES: 100 * MEBIBYTE,
  MARKETPLACE_PRODUCT_VIDEO_BYTES: 30 * MEBIBYTE,
  CREATOR_MEDIA_BYTES: 100 * MEBIBYTE,
  ADMIN_SPECIAL_BYTES: 200 * MEBIBYTE,
});

const getPostVideoUploadLimit = (postType = "") =>
  String(postType || "").trim().toLowerCase() === "reel"
    ? UPLOAD_LIMITS.REEL_VIDEO_BYTES
    : UPLOAD_LIMITS.FEED_VIDEO_BYTES;

const LIVE_STREAM_RECORDING = Object.freeze({
  enabled: false,
  manualApprovalOnly: true,
});

module.exports = {
  LIVE_STREAM_RECORDING,
  MEBIBYTE,
  UPLOAD_LIMITS,
  getPostVideoUploadLimit,
};
