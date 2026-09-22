import { describe, expect, it } from "vitest";

import {
  MEBIBYTE,
  UPLOAD_LIMITS,
  getPostVideoUploadLimit,
  getUploadSizeError,
} from "../uploadLimits";

describe("upload limits", () => {
  it("exposes the approved Tengacion upload tiers", () => {
    expect(UPLOAD_LIMITS.PROFILE_STORY_VIDEO_BYTES).toBe(100 * MEBIBYTE);
    expect(UPLOAD_LIMITS.STORY_IMAGE_BYTES).toBe(100 * MEBIBYTE);
    expect(UPLOAD_LIMITS.FEED_VIDEO_BYTES).toBe(200 * MEBIBYTE);
    expect(UPLOAD_LIMITS.REEL_VIDEO_BYTES).toBe(200 * MEBIBYTE);
    expect(UPLOAD_LIMITS.MARKETPLACE_PRODUCT_VIDEO_BYTES).toBe(200 * MEBIBYTE);
    expect(UPLOAD_LIMITS.CREATOR_MEDIA_BYTES).toBe(100 * MEBIBYTE);
    expect(UPLOAD_LIMITS.CREATOR_VIDEO_BYTES).toBe(200 * MEBIBYTE);
    expect(UPLOAD_LIMITS.ADMIN_SPECIAL_BYTES).toBe(200 * MEBIBYTE);
  });

  it("uses 200MB for regular videos and 100MB for stories", () => {
    expect(getPostVideoUploadLimit("video")).toBe(200 * MEBIBYTE);
    expect(getPostVideoUploadLimit("reel")).toBe(200 * MEBIBYTE);
  });

  it("returns a clear error for an oversized upload", () => {
    expect(
      getUploadSizeError(
        { size: UPLOAD_LIMITS.MARKETPLACE_PRODUCT_VIDEO_BYTES + 1 },
        UPLOAD_LIMITS.MARKETPLACE_PRODUCT_VIDEO_BYTES,
        "Marketplace product video"
      )
    ).toBe("Marketplace product video must be 200MB or smaller.");
  });
});
