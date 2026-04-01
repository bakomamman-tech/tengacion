const {
  isLegacyTempMediaUrl,
  normalizeMediaValue,
} = require("../utils/userMedia");

describe("user media normalization", () => {
  test("treats legacy temp avatar and cover urls as empty media", () => {
    expect(normalizeMediaValue("/uploads/tmp_avatar_123.png")).toEqual({
      url: "",
      public_id: "",
    });
    expect(normalizeMediaValue({
      url: "/uploads/tmp_cover_456.jpg",
      public_id: "legacy-cover",
    })).toEqual({
      url: "",
      public_id: "",
    });
  });

  test("preserves durable media urls", () => {
    expect(normalizeMediaValue("/api/media/64f000000000000000000001")).toEqual({
      url: "/api/media/64f000000000000000000001",
      public_id: "",
    });
    expect(normalizeMediaValue({
      url: "https://cdn.example.com/avatar.jpg",
      public_id: "media/avatar.jpg",
    })).toEqual({
      url: "https://cdn.example.com/avatar.jpg",
      public_id: "media/avatar.jpg",
    });
  });

  test("detects legacy temp media urls", () => {
    expect(isLegacyTempMediaUrl("/uploads/tmp_avatar_abc.png")).toBe(true);
    expect(isLegacyTempMediaUrl("/uploads/tmp_cover_xyz.webp")).toBe(true);
    expect(isLegacyTempMediaUrl("/api/media/64f000000000000000000001")).toBe(false);
  });
});
