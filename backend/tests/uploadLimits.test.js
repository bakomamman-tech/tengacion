const {
  LIVE_STREAM_RECORDING,
  MEBIBYTE,
  UPLOAD_LIMITS,
  getPostVideoUploadLimit,
} = require("../config/uploadLimits");
const adminSpecialUpload = require("../middleware/adminSpecialUpload");
const marketplaceProductUpload = require("../middleware/marketplaceProductUpload");
const postUpload = require("../middleware/postUpload");
const privateUpload = require("../middleware/privateUpload");
const storyUpload = require("../middleware/storyUpload");
const { validateFilePayload } = require("../utils/memoryUpload");

const videoFile = (size) => ({
  originalname: "upload.mp4",
  mimetype: "video/mp4",
  size,
});
const imageFile = (size) => ({
  originalname: "story.jpg",
  mimetype: "image/jpeg",
  size,
});

describe("Tengacion upload limit policy", () => {
  test("maps all video uploads to 200MB, except 100MB story videos", () => {
    expect(storyUpload.maxFileBytes).toBe(100 * MEBIBYTE);
    expect(storyUpload.maxBytesByCategory.image).toBe(100 * MEBIBYTE);
    expect(storyUpload.maxBytesByCategory.video).toBe(100 * MEBIBYTE);
    expect(postUpload.maxFileBytes).toBe(200 * MEBIBYTE);
    expect(postUpload.maxBytesByCategory.video).toBe(200 * MEBIBYTE);
    expect(marketplaceProductUpload.maxFileBytes).toBe(200 * MEBIBYTE);
    expect(privateUpload.maxFileBytes).toBe(200 * MEBIBYTE);
    expect(adminSpecialUpload.maxFileBytes).toBe(200 * MEBIBYTE);
    expect(UPLOAD_LIMITS.CREATOR_MEDIA_BYTES).toBe(100 * MEBIBYTE);
    expect(UPLOAD_LIMITS.IMAGE_BYTES).toBe(10 * MEBIBYTE);
  });

  test.each([
    ["story video", UPLOAD_LIMITS.PROFILE_STORY_VIDEO_BYTES, storyUpload],
    ["post video", UPLOAD_LIMITS.REEL_VIDEO_BYTES, postUpload],
    ["marketplace video", UPLOAD_LIMITS.MARKETPLACE_PRODUCT_VIDEO_BYTES, marketplaceProductUpload],
    ["creator video", UPLOAD_LIMITS.CREATOR_VIDEO_BYTES, privateUpload],
    ["admin video", UPLOAD_LIMITS.ADMIN_SPECIAL_BYTES, adminSpecialUpload],
  ])("%s accepts its boundary and rejects one byte over", (_name, maxBytes, upload) => {
    const options = { maxBytesByCategory: upload.maxBytesByCategory };
    expect(() => validateFilePayload(videoFile(maxBytes), options)).not.toThrow();
    expect(() => validateFilePayload(videoFile(maxBytes + 1), options))
      .toThrow(new RegExp(`${maxBytes / MEBIBYTE}MB`));
  });

  test("story images accept 100MB exactly and reject 100MB + 1 byte", () => {
    const options = { maxBytesByCategory: storyUpload.maxBytesByCategory };
    expect(() => validateFilePayload(imageFile(100 * MEBIBYTE), options)).not.toThrow();
    expect(() => validateFilePayload(imageFile(100 * MEBIBYTE + 1), options))
      .toThrow(/100MB/);
    expect(() => validateFilePayload(imageFile(10 * MEBIBYTE + 1)))
      .toThrow(/10MB/);
  });

  test("sets both feed and reel video limits to 200MB", () => {
    expect(getPostVideoUploadLimit("video")).toBe(200 * MEBIBYTE);
    expect(getPostVideoUploadLimit("reel")).toBe(200 * MEBIBYTE);
  });

  test("keeps live-stream recording disabled pending manual approval", () => {
    expect(LIVE_STREAM_RECORDING).toEqual({
      enabled: false,
      manualApprovalOnly: true,
    });
  });
});
