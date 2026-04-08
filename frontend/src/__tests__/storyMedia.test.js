import { describe, expect, it, vi } from "vitest";

vi.mock("../api", () => ({
  resolveImage: (value) => value || "",
}));

describe("getStoryMedia", () => {
  it("falls back to nested cloudinary story media when legacy aliases are blank", async () => {
    const { getStoryMedia } = await import("../stories/storyMedia");

    const media = getStoryMedia({
      media: {
        secureUrl: "https://cdn.test/stories/photo.jpg",
        type: "image",
      },
      mediaUrl: "",
      image: "",
      thumbnailUrl: "",
    });

    expect(media).toMatchObject({
      mediaType: "image",
      mediaUrl: "https://cdn.test/stories/photo.jpg",
      thumbnailUrl: "https://cdn.test/stories/photo.jpg",
    });
  });

  it("prefers the blurred preview for restricted stories", async () => {
    const { getStoryMedia } = await import("../stories/storyMedia");

    const media = getStoryMedia({
      mediaUrl: "https://cdn.test/stories/original.jpg",
      blurPreviewUrl: "https://cdn.test/stories/blurred.jpg",
      moderationStatus: "RESTRICTED_BLURRED",
      mediaType: "image",
    });

    expect(media).toMatchObject({
      mediaType: "image",
      mediaUrl: "https://cdn.test/stories/blurred.jpg",
      thumbnailUrl: "https://cdn.test/stories/blurred.jpg",
    });
  });
});
