const Album = require("../../models/Album");
const Book = require("../../models/Book");
const CreatorProfile = require("../../models/CreatorProfile");
const Track = require("../../models/Track");
const Video = require("../../models/Video");
const { normalizePathname, toCanonicalUrl } = require("./siteSeo");

const ACTIVE_TRACK_FILTER = { isPublished: { $ne: false }, archivedAt: null };
const ACTIVE_BOOK_FILTER = { isPublished: { $ne: false }, archivedAt: null };
const ACTIVE_ALBUM_FILTER = { status: "published", isPublished: { $ne: false }, archivedAt: null };
const ACTIVE_VIDEO_FILTER = { isPublished: { $ne: false }, archivedAt: null };
const SITEMAP_CACHE_TTL_MS = 15 * 60 * 1000;

let sitemapCache = {
  expiresAt: 0,
  xml: "",
};

const escapeXml = (value = "") =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const formatDate = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString();
};

const buildUrlEntry = ({ path, lastModified, changefreq = "", priority = "" }) => {
  const parts = [
    "  <url>",
    `    <loc>${escapeXml(toCanonicalUrl(path))}</loc>`,
  ];

  const lastmod = formatDate(lastModified);
  if (lastmod) {
    parts.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
  }
  if (changefreq) {
    parts.push(`    <changefreq>${escapeXml(changefreq)}</changefreq>`);
  }
  if (priority) {
    parts.push(`    <priority>${escapeXml(priority)}</priority>`);
  }

  parts.push("  </url>");
  return parts.join("\n");
};

const collectCreatorIdsWithPublicContent = async () => {
  const [trackCreatorIds, bookCreatorIds, albumCreatorIds, videoCreatorIds, videoUserIds] =
    await Promise.all([
      Track.distinct("creatorId", ACTIVE_TRACK_FILTER),
      Book.distinct("creatorId", ACTIVE_BOOK_FILTER),
      Album.distinct("creatorId", ACTIVE_ALBUM_FILTER),
      Video.distinct("creatorProfileId", ACTIVE_VIDEO_FILTER),
      Video.distinct("userId", ACTIVE_VIDEO_FILTER),
    ]);

  const creatorIds = new Set(
    [...trackCreatorIds, ...bookCreatorIds, ...albumCreatorIds, ...videoCreatorIds]
      .map((entry) => String(entry || "").trim())
      .filter(Boolean)
  );

  if (videoUserIds.length > 0) {
    const profiles = await CreatorProfile.find({ userId: { $in: videoUserIds } })
      .select("_id")
      .lean();
    profiles.forEach((profile) => {
      creatorIds.add(String(profile?._id || "").trim());
    });
  }

  return Array.from(creatorIds);
};

const buildSitemapXml = async () => {
  const [tracks, books, albums, creatorIds] = await Promise.all([
    Track.find(ACTIVE_TRACK_FILTER).select("_id updatedAt createdAt").sort({ updatedAt: -1 }).lean(),
    Book.find(ACTIVE_BOOK_FILTER).select("_id updatedAt createdAt").sort({ updatedAt: -1 }).lean(),
    Album.find(ACTIVE_ALBUM_FILTER).select("_id updatedAt createdAt").sort({ updatedAt: -1 }).lean(),
    collectCreatorIdsWithPublicContent(),
  ]);

  const creators = creatorIds.length
    ? await CreatorProfile.find({ _id: { $in: creatorIds } })
        .select("_id updatedAt createdAt")
        .sort({ updatedAt: -1 })
        .lean()
    : [];

  const routes = [
    { path: "/creators", changefreq: "daily", priority: "1.0" },
    { path: "/terms", changefreq: "monthly", priority: "0.4" },
    { path: "/privacy", changefreq: "monthly", priority: "0.4" },
    { path: "/community-guidelines", changefreq: "monthly", priority: "0.4" },
    { path: "/copyright-policy", changefreq: "monthly", priority: "0.4" },
    { path: "/developer-contact", changefreq: "monthly", priority: "0.3" },
    ...creators.flatMap((creator) => [
      {
        path: `/creators/${creator._id}`,
        lastModified: creator.updatedAt || creator.createdAt,
        changefreq: "weekly",
        priority: "0.9",
      },
    ]),
    ...tracks.map((track) => ({
      path: `/tracks/${track._id}`,
      lastModified: track.updatedAt || track.createdAt,
      changefreq: "weekly",
      priority: "0.8",
    })),
    ...books.map((book) => ({
      path: `/books/${book._id}`,
      lastModified: book.updatedAt || book.createdAt,
      changefreq: "weekly",
      priority: "0.8",
    })),
    ...albums.map((album) => ({
      path: `/albums/${album._id}`,
      lastModified: album.updatedAt || album.createdAt,
      changefreq: "weekly",
      priority: "0.8",
    })),
  ];

  const entries = Array.from(
    new Map(
      routes.map((entry) => [
        normalizePathname(entry.path),
        buildUrlEntry(entry),
      ])
    ).values()
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>",
    "",
  ].join("\n");
};

const getSitemapXml = async ({ force = false } = {}) => {
  if (!force && sitemapCache.xml && sitemapCache.expiresAt > Date.now()) {
    return sitemapCache.xml;
  }

  const xml = await buildSitemapXml();
  sitemapCache = {
    xml,
    expiresAt: Date.now() + SITEMAP_CACHE_TTL_MS,
  };
  return xml;
};

const buildRobotsTxt = () =>
  [
    "User-agent: *",
    "Allow: /",
    "Disallow: /login",
    "Disallow: /register",
    "Disallow: /signup",
    "Disallow: /forgot-password",
    "Disallow: /reset-password",
    "Disallow: /verify-email",
    "Disallow: /home",
    "Disallow: /messages",
    "Disallow: /notifications",
    "Disallow: /dashboard",
    "Disallow: /settings",
    "Disallow: /search",
    "Disallow: /friends",
    "Disallow: /find-friends",
    "Disallow: /profile",
    "Disallow: /payment",
    "Disallow: /payments",
    "Disallow: /purchases",
    "Disallow: /onboarding",
    "Disallow: /marketplace",
    "Disallow: /creator/register",
    "Disallow: /creator/dashboard",
    "Disallow: /creator/categories",
    "Disallow: /creator/music",
    "Disallow: /creator/books",
    "Disallow: /creator/podcasts",
    "Disallow: /creator/earnings",
    "Disallow: /creator/payouts",
    "Disallow: /creator/settings",
    "Disallow: /creator/verification",
    "Disallow: /creator/support",
    "Disallow: /creator/fan-page-view",
    "Disallow: /creators/*/subscribe",
    "Disallow: /admin",
    `Sitemap: ${toCanonicalUrl("/sitemap.xml")}`,
    "",
  ].join("\n");

module.exports = {
  buildRobotsTxt,
  getSitemapXml,
};
