import { describe, expect, it, vi } from "vitest";

vi.mock("../../api", () => ({
  resolveImage: (value) => {
    if (!value) {
      return "";
    }
    if (typeof value === "string") {
      return value;
    }
    return (
      value.secureUrl ||
      value.secure_url ||
      value.url ||
      value.playbackUrl ||
      value.mediaUrl ||
      value.fileUrl ||
      value.legacyPath ||
      ""
    );
  },
}));

import {
  getReelAvatar,
  getReelAvatarFallback,
  getReelPoster,
  getReelVideoUrl,
  isReelCandidate,
} from "../reels";

describe("reel media helpers", () => {
  it("does not treat the API's legacy MP4 image alias as a poster", () => {
    const videoUrl = "https://cdn.example.com/reels/live-reel.mp4?token=abc";
    const reel = {
      _id: "live-reel",
      type: "reel",
      image: videoUrl,
      media: [{ type: "video", resourceType: "video", url: videoUrl }],
      video: { playbackUrl: videoUrl, thumbnailUrl: "" },
    };

    expect(getReelVideoUrl(reel)).toBe(videoUrl);
    expect(getReelPoster(reel)).toBe("");
  });

  it("finds extensionless video media and keeps a real image as its poster", () => {
    const reel = {
      _id: "mixed-media-reel",
      media: [
        { type: "image", secureUrl: "https://cdn.example.com/poster.jpg" },
        { type: "video", mimeType: "video/mp4", playbackUrl: "/api/media/video-id" },
      ],
    };

    expect(getReelVideoUrl(reel)).toBe("/api/media/video-id");
    expect(getReelPoster(reel)).toBe("https://cdn.example.com/poster.jpg");
    expect(isReelCandidate(reel)).toBe(true);
  });

  it("uses later avatar fields when a nested profile object is empty", () => {
    const reel = {
      name: "Samuel Kaboshia",
      user: { profilePic: {} },
      avatar: "https://cdn.example.com/samuel.jpg",
    };

    expect(getReelAvatar(reel)).toBe("https://cdn.example.com/samuel.jpg");
  });

  it("creates a deterministic initials image instead of a missing static avatar", () => {
    const reel = { user: { name: "Samuel Kaboshia" } };
    const fallback = getReelAvatarFallback(reel);

    expect(getReelAvatar(reel)).toBe(fallback);
    expect(fallback).toMatch(/^data:image\/svg\+xml/);
    expect(decodeURIComponent(fallback)).toContain(">SK</text>");
    expect(fallback).not.toContain("/avatar.png");
  });

  it("never exposes restricted video aliases as playable reel media", () => {
    const originalVideoUrl = "https://cdn.example.com/restricted-original.mp4";
    const blurredPreviewUrl = "/api/media/restricted-preview.svg";
    const reel = {
      _id: "restricted-reel",
      type: "reel",
      moderationStatus: "RESTRICTED_BLURRED",
      autoplayDisabled: true,
      blurPreviewUrl: blurredPreviewUrl,
      image: blurredPreviewUrl,
      media: [
        {
          type: "video",
          url: blurredPreviewUrl,
          secureUrl: originalVideoUrl,
          secure_url: originalVideoUrl,
        },
      ],
      video: {
        url: "",
        playbackUrl: "",
        thumbnailUrl: blurredPreviewUrl,
        restricted: true,
      },
    };

    expect(getReelVideoUrl(reel)).toBe("");
    expect(getReelPoster(reel)).toBe(blurredPreviewUrl);
    expect(isReelCandidate(reel)).toBe(false);
  });
});
