const {
  MAX_PAID_TRACK_PREVIEW_SECONDS,
  resolveFullTrackSource,
  resolveSafeTrackPreview,
} = require("../services/trackPreviewPolicyService");

describe("track preview security policy", () => {
  test("paid tracks expose only a distinct verified short preview", () => {
    const track = {
      price: 2500,
      audioUrl: "https://cdn.test/full-song.mp3",
      previewUrl: "https://cdn.test/preview.mp3",
      previewMedia: {
        secureUrl: "https://cdn.test/preview.mp3",
        duration: 29.9,
      },
    };

    expect(resolveFullTrackSource(track)).toBe("https://cdn.test/full-song.mp3");
    expect(resolveSafeTrackPreview(track)).toEqual(
      expect.objectContaining({
        ok: true,
        sourceUrl: "https://cdn.test/preview.mp3",
        maxDurationSec: MAX_PAID_TRACK_PREVIEW_SECONDS,
      })
    );
  });

  test("paid tracks never fall back to the full master as a preview", () => {
    const track = {
      price: 2500,
      audioUrl: "https://cdn.test/full-song.mp3",
      previewUrl: "https://cdn.test/full-song.mp3",
      previewMedia: {
        secureUrl: "https://cdn.test/full-song.mp3",
        duration: 178,
      },
    };

    expect(resolveSafeTrackPreview(track)).toEqual(
      expect.objectContaining({
        ok: false,
        sourceUrl: "",
      })
    );
  });

  test("paid previews longer than 30 seconds are rejected", () => {
    const track = {
      price: 2500,
      audioUrl: "https://cdn.test/full-song.mp3",
      previewMedia: {
        secureUrl: "https://cdn.test/long-preview.mp3",
        duration: 31.2,
      },
    };

    const result = resolveSafeTrackPreview(track);
    expect(result.ok).toBe(false);
    expect(result.sourceUrl).toBe("");
    expect(result.reason).toMatch(/30 seconds/i);
  });

  test("paid previews with unknown duration are rejected instead of trusted", () => {
    const track = {
      price: 2500,
      audioUrl: "https://cdn.test/full-song.mp3",
      previewUrl: "https://cdn.test/unverified-preview.mp3",
    };

    const result = resolveSafeTrackPreview(track);
    expect(result.ok).toBe(false);
    expect(result.sourceUrl).toBe("");
    expect(result.reason).toMatch(/duration could not be verified/i);
  });

  test("free tracks may fall back to the full source", () => {
    const track = {
      price: 0,
      audioUrl: "https://cdn.test/free-song.mp3",
      durationSec: 180,
    };

    expect(resolveSafeTrackPreview(track)).toEqual(
      expect.objectContaining({
        ok: true,
        sourceUrl: "https://cdn.test/free-song.mp3",
      })
    );
  });
});
