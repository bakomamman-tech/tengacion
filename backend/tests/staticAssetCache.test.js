const path = require("path");

const {
  getStaticCacheControl,
  normalizeRelativePath,
} = require("../utils/staticAssetCache");

describe("static asset cache policy", () => {
  test("serves hashed build assets and versioned campaign images as immutable", () => {
    expect(getStaticCacheControl("assets/index-D6NucGpQ.css")).toBe(
      "public, max-age=31536000, immutable"
    );
    expect(
      getStaticCacheControl(
        "assets/campaigns/tengacion-millionaire-2026-480.avif"
      )
    ).toBe("public, max-age=31536000, immutable");
  });

  test("revalidates the service worker and gives ordinary static media a short fresh lifetime", () => {
    expect(getStaticCacheControl("sw.js")).toBe("no-cache");
    expect(getStaticCacheControl("manifest.json")).toBe("no-cache");
    expect(getStaticCacheControl("tengacion_logo_256.png")).toBe(
      "public, max-age=86400, stale-while-revalidate=604800"
    );
  });

  test("normalizes Windows static file paths before matching them", () => {
    const frontendPath = path.join("C:", "app", "frontend", "dist");
    const filePath = path.join(
      frontendPath,
      "assets",
      "campaigns",
      "tengacion-millionaire-2026-768.webp"
    );

    expect(normalizeRelativePath(frontendPath, filePath)).toBe(
      "assets/campaigns/tengacion-millionaire-2026-768.webp"
    );
  });
});
