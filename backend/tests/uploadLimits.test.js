const { LIVE_STREAM_RECORDING, MEBIBYTE, UPLOAD_LIMITS } = require("../config/uploadLimits");
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

describe("Tengacion upload limit policy", () => {
  test("maps upload categories to the approved limits", () => {
    expect(storyUpload.maxFileBytes).toBe(25 * MEBIBYTE);
    expect(postUpload.maxFileBytes).toBe(50 * MEBIBYTE);
    expect(marketplaceProductUpload.maxFileBytes).toBe(30 * MEBIBYTE);
    expect(privateUpload.maxFileBytes).toBe(100 * MEBIBYTE);
    expect(adminSpecialUpload.maxFileBytes).toBe(200 * MEBIBYTE);
  });

  test.each([
    ["story", UPLOAD_LIMITS.PROFILE_STORY_VIDEO_BYTES, storyUpload],
    ["feed", UPLOAD_LIMITS.FEED_VIDEO_BYTES, postUpload],
    ["marketplace", UPLOAD_LIMITS.MARKETPLACE_PRODUCT_VIDEO_BYTES, marketplaceProductUpload],
    ["creator", UPLOAD_LIMITS.CREATOR_MEDIA_BYTES, privateUpload],
    ["admin special", UPLOAD_LIMITS.ADMIN_SPECIAL_BYTES, adminSpecialUpload],
  ])("%s video policy rejects files above its limit", (_name, maxBytes, upload) => {
    expect(() =>
      validateFilePayload(videoFile(maxBytes + 1), {
        maxBytesByCategory: upload.maxBytesByCategory,
      })
    ).toThrow(new RegExp(`${maxBytes / MEBIBYTE}MB`));
  });

  test("keeps live-stream recording disabled pending manual approval", () => {
    expect(LIVE_STREAM_RECORDING).toEqual({
      enabled: false,
      manualApprovalOnly: true,
    });
  });
});
