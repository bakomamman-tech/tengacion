const {
  getMediaPreviewUrl,
  getMediaUrl,
  isCloudinaryMediaValue,
  isLegacyLocalMediaValue,
  isLegacyTempMediaUrl,
  normalizeMediaValue,
} = require("../utils/userMedia");
const { deleteCloudinaryAssets } = require("../services/cloudinaryMediaService");
const { v2: cloudinary } = require("cloudinary");

describe("user media normalization", () => {
  test("treats legacy temp avatar and cover urls as empty media", () => {
    expect(normalizeMediaValue("/uploads/tmp_avatar_123.png")).toMatchObject({
      url: "",
      secureUrl: "",
      publicId: "",
      public_id: "",
    });
    expect(normalizeMediaValue({
      url: "/uploads/tmp_cover_456.jpg",
      public_id: "legacy-cover",
    })).toMatchObject({
      url: "",
      secureUrl: "",
      publicId: "",
      public_id: "",
    });
  });

  test("preserves durable media urls", () => {
    expect(normalizeMediaValue("/api/media/64f000000000000000000001")).toMatchObject({
      url: "/api/media/64f000000000000000000001",
      secureUrl: "/api/media/64f000000000000000000001",
      publicId: "",
      public_id: "",
      legacyPath: "/api/media/64f000000000000000000001",
    });
    expect(normalizeMediaValue({
      url: "https://cdn.example.com/avatar.jpg",
      public_id: "media/avatar.jpg",
    })).toMatchObject({
      url: "https://cdn.example.com/avatar.jpg",
      secureUrl: "https://cdn.example.com/avatar.jpg",
      publicId: "media/avatar.jpg",
      public_id: "media/avatar.jpg",
      provider: "cloudinary",
    });
  });

  test("detects legacy temp media urls", () => {
    expect(isLegacyTempMediaUrl("/uploads/tmp_avatar_abc.png")).toBe(true);
    expect(isLegacyTempMediaUrl("/uploads/tmp_cover_xyz.webp")).toBe(true);
    expect(isLegacyTempMediaUrl("/api/media/64f000000000000000000001")).toBe(false);
  });

  test("resolves cloudinary and legacy media urls consistently", () => {
    const cloudinaryMedia = {
      secureUrl: "https://res.cloudinary.com/test-cloud/image/upload/v1/tengacion/profiles/avatar-1.jpg",
      publicId: "tengacion/profiles/avatar-1",
      provider: "cloudinary",
      resourceType: "image",
    };
    const legacyMedia = "/uploads/legacy/avatar-1.jpg";

    expect(getMediaUrl(cloudinaryMedia)).toBe(cloudinaryMedia.secureUrl);
    expect(getMediaPreviewUrl(cloudinaryMedia)).toBe(cloudinaryMedia.secureUrl);
    expect(isCloudinaryMediaValue(cloudinaryMedia)).toBe(true);

    expect(getMediaUrl(legacyMedia)).toBe("/uploads/legacy/avatar-1.jpg");
    expect(getMediaPreviewUrl(legacyMedia)).toBe("/uploads/legacy/avatar-1.jpg");
    expect(isLegacyLocalMediaValue(legacyMedia)).toBe(true);
  });

  test("prefers the cloudinary url for mixed legacy records", () => {
    const mixedMedia = {
      publicId: "tengacion/profiles/avatar-2",
      secureUrl: "https://res.cloudinary.com/test-cloud/image/upload/v1/tengacion/profiles/avatar-2.jpg",
      legacyPath: "/uploads/legacy/avatar-2.jpg",
    };

    expect(getMediaUrl(mixedMedia)).toBe(mixedMedia.secureUrl);
    expect(getMediaPreviewUrl(mixedMedia)).toBe(mixedMedia.secureUrl);
  });

  test("cloudinary cleanup no-ops for legacy media without a public id", async () => {
    const result = await deleteCloudinaryAssets([
      { url: "/uploads/legacy/avatar-1.jpg", legacyPath: "/uploads/legacy/avatar-1.jpg" },
    ]);

    expect(result).toMatchObject({
      attempted: 0,
      deleted: 0,
      failed: 0,
    });
    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
  });
});
