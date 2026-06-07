const Album = require("../../models/Album");
const Book = require("../../models/Book");
const CreatorProfile = require("../../models/CreatorProfile");
const MarketplaceProduct = require("../../models/MarketplaceProduct");
const MarketplaceSeller = require("../../models/MarketplaceSeller");
const Track = require("../../models/Track");
const Video = require("../../models/Video");
const { buildCreatorPublicPath } = require("../publicRouteService");
const { normalizePathname, toCanonicalUrl } = require("./siteSeo");

const ACTIVE_TRACK_FILTER = { isPublished: { $ne: false }, archivedAt: null };
const ACTIVE_BOOK_FILTER = { isPublished: { $ne: false }, archivedAt: null };
const ACTIVE_ALBUM_FILTER = { status: "published", isPublished: { $ne: false }, archivedAt: null };
const ACTIVE_VIDEO_FILTER = { isPublished: { $ne: false }, archivedAt: null };
const ACTIVE_MARKETPLACE_PRODUCT_FILTER = {
  isPublished: true,
  isHidden: false,
  moderationStatus: "approved",
};
const ACTIVE_MARKETPLACE_SELLER_FILTER = {
  status: "approved",
  isActive: true,
};
const SITEMAP_CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_URLS_PER_SITEMAP = 1000;

const STATIC_PUBLIC_ROUTES = [
  { path: "/" },
  { path: "/about" },
  { path: "/leadership" },
  { path: "/how-it-works" },
  { path: "/for-creators" },
  { path: "/for-music-artists" },
  { path: "/for-authors" },
  { path: "/for-podcasters" },
  { path: "/safety" },
  { path: "/child-safety" },
  { path: "/moderation-policy" },
  { path: "/refund-policy" },
  { path: "/creator-monetization-terms" },
  { path: "/marketplace-seller-terms" },
  { path: "/creators" },
  { path: "/music" },
  { path: "/books" },
  { path: "/podcasts" },
  { path: "/marketplace" },
  { path: "/activity" },
  { path: "/terms" },
  { path: "/privacy" },
  { path: "/community-guidelines" },
  { path: "/copyright-policy" },
  { path: "/contact" },
  { path: "/developer-contact" },
];

let sitemapCache = {
  expiresAt: 0,
  manifest: null,
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

const buildUrlEntry = ({ path, lastModified }) => {
  const parts = [
    "  <url>",
    `    <loc>${escapeXml(toCanonicalUrl(path))}</loc>`,
  ];

  const lastmod = formatDate(lastModified);
  if (lastmod) {
    parts.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
  }

  parts.push("  </url>");
  return parts.join("\n");
};

const buildSitemapReferenceEntry = ({ name, lastModified }) => {
  const parts = [
    "  <sitemap>",
    `    <loc>${escapeXml(toCanonicalUrl(`/sitemaps/${name}.xml`))}</loc>`,
  ];

  const lastmod = formatDate(lastModified);
  if (lastmod) {
    parts.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
  }

  parts.push("  </sitemap>");
  return parts.join("\n");
};

const dedupeEntries = (entries = []) =>
  Array.from(
    new Map(
      (Array.isArray(entries) ? entries : [])
        .filter((entry) => entry?.path)
        .map((entry) => [normalizePathname(entry.path), { ...entry, path: normalizePathname(entry.path) }])
    ).values()
  );

const chunkEntries = (entries = [], chunkSize = MAX_URLS_PER_SITEMAP) => {
  const chunks = [];
  for (let index = 0; index < entries.length; index += chunkSize) {
    chunks.push(entries.slice(index, index + chunkSize));
  }
  return chunks;
};

const renderUrlSetXml = (entries = []) =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map((entry) => buildUrlEntry(entry)),
    "</urlset>",
    "",
  ].join("\n");

const renderSitemapIndexXml = (sections = []) =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sections.map((entry) => buildSitemapReferenceEntry(entry)),
    "</sitemapindex>",
    "",
  ].join("\n");

const getSectionLastModified = (entries = []) => {
  const timestamps = entries
    .map((entry) => new Date(entry?.lastModified || 0).getTime())
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!timestamps.length) {
    return "";
  }

  return new Date(Math.max(...timestamps)).toISOString();
};

const addCoverage = (coverage, creatorId, field, count = 0, lastModified = null) => {
  const key = String(creatorId || "").trim();
  if (!key) {
    return;
  }

  const next = coverage.get(key) || {
    musicCount: 0,
    albumCount: 0,
    podcastCount: 0,
    bookCount: 0,
    videoCount: 0,
    lastModified: null,
  };

  next[field] += Number(count || 0);
  if (lastModified) {
    const lastTime = new Date(lastModified).getTime();
    const currentTime = new Date(next.lastModified || 0).getTime();
    if (!currentTime || lastTime > currentTime) {
      next.lastModified = lastModified;
    }
  }

  coverage.set(key, next);
};

const buildCreatorCoverageMap = async () => {
  const coverage = new Map();

  const [musicRows, podcastRows, bookRows, albumRows, videoProfileRows, videoUserRows] = await Promise.all([
    Track.aggregate([
      { $match: { ...ACTIVE_TRACK_FILTER, kind: { $in: ["music", null] } } },
      { $group: { _id: "$creatorId", count: { $sum: 1 }, lastModified: { $max: "$updatedAt" } } },
    ]),
    Track.aggregate([
      { $match: { ...ACTIVE_TRACK_FILTER, kind: "podcast" } },
      { $group: { _id: "$creatorId", count: { $sum: 1 }, lastModified: { $max: "$updatedAt" } } },
    ]),
    Book.aggregate([
      { $match: ACTIVE_BOOK_FILTER },
      { $group: { _id: "$creatorId", count: { $sum: 1 }, lastModified: { $max: "$updatedAt" } } },
    ]),
    Album.aggregate([
      { $match: ACTIVE_ALBUM_FILTER },
      { $group: { _id: "$creatorId", count: { $sum: 1 }, lastModified: { $max: "$updatedAt" } } },
    ]),
    Video.aggregate([
      {
        $match: {
          ...ACTIVE_VIDEO_FILTER,
          creatorProfileId: { $ne: null },
        },
      },
      { $group: { _id: "$creatorProfileId", count: { $sum: 1 }, lastModified: { $max: "$updatedAt" } } },
    ]),
    Video.aggregate([
      {
        $match: {
          ...ACTIVE_VIDEO_FILTER,
          userId: { $ne: null, $ne: "" },
        },
      },
      { $group: { _id: "$userId", count: { $sum: 1 }, lastModified: { $max: "$updatedAt" } } },
    ]),
  ]);

  musicRows.forEach((row) => addCoverage(coverage, row?._id, "musicCount", row?.count, row?.lastModified));
  podcastRows.forEach((row) => addCoverage(coverage, row?._id, "podcastCount", row?.count, row?.lastModified));
  bookRows.forEach((row) => addCoverage(coverage, row?._id, "bookCount", row?.count, row?.lastModified));
  albumRows.forEach((row) => addCoverage(coverage, row?._id, "albumCount", row?.count, row?.lastModified));
  videoProfileRows.forEach((row) => addCoverage(coverage, row?._id, "videoCount", row?.count, row?.lastModified));

  if (videoUserRows.length > 0) {
    const userIds = videoUserRows.map((row) => row?._id).filter(Boolean);
    const profiles = await CreatorProfile.find({ userId: { $in: userIds } }).select("_id userId").lean();
    const profileByUserId = new Map(
      profiles.map((profile) => [String(profile?.userId || ""), String(profile?._id || "")])
    );

    videoUserRows.forEach((row) => {
      const creatorId = profileByUserId.get(String(row?._id || ""));
      if (creatorId) {
        addCoverage(coverage, creatorId, "videoCount", row?.count, row?.lastModified);
      }
    });
  }

  return coverage;
};

const buildStaticEntries = () => dedupeEntries(STATIC_PUBLIC_ROUTES);

const buildCreatorEntries = async () => {
  const coverage = await buildCreatorCoverageMap();
  const creatorIds = Array.from(coverage.keys());

  if (!creatorIds.length) {
    return [];
  }

  const creators = await CreatorProfile.find({ _id: { $in: creatorIds } })
    .select("_id userId updatedAt createdAt")
    .populate("userId", "username")
    .lean();

  return dedupeEntries(
    creators.flatMap((creator) => {
      const key = String(creator?._id || "");
      const creatorCoverage = coverage.get(key) || {};
      const username = creator?.userId?.username || "";
      const lastModified = creatorCoverage.lastModified || creator.updatedAt || creator.createdAt || null;
      const entries = [
        {
          path: buildCreatorPublicPath({ creatorId: key, username }),
          lastModified,
        },
      ];

      if (Number(creatorCoverage.musicCount || 0) > 0 || Number(creatorCoverage.videoCount || 0) > 0) {
        entries.push({
          path: buildCreatorPublicPath({ creatorId: key, username, tab: "music" }),
          lastModified,
        });
      }
      if (Number(creatorCoverage.albumCount || 0) > 0) {
        entries.push({
          path: buildCreatorPublicPath({ creatorId: key, username, tab: "albums" }),
          lastModified,
        });
      }
      if (Number(creatorCoverage.podcastCount || 0) > 0) {
        entries.push({
          path: buildCreatorPublicPath({ creatorId: key, username, tab: "podcasts" }),
          lastModified,
        });
      }
      if (Number(creatorCoverage.bookCount || 0) > 0) {
        entries.push({
          path: buildCreatorPublicPath({ creatorId: key, username, tab: "books" }),
          lastModified,
        });
      }

      return entries;
    })
  );
};

const buildMusicEntries = async () => {
  const [tracks, albums] = await Promise.all([
    Track.find({ ...ACTIVE_TRACK_FILTER, kind: { $in: ["music", null] } })
      .select("_id updatedAt createdAt")
      .sort({ updatedAt: -1 })
      .lean(),
    Album.find(ACTIVE_ALBUM_FILTER)
      .select("_id updatedAt createdAt")
      .sort({ updatedAt: -1 })
      .lean(),
  ]);

  return dedupeEntries([
    ...tracks.map((track) => ({
      path: `/tracks/${track._id}`,
      lastModified: track.updatedAt || track.createdAt,
    })),
    ...albums.map((album) => ({
      path: `/albums/${album._id}`,
      lastModified: album.updatedAt || album.createdAt,
    })),
  ]);
};

const buildBookEntries = async () =>
  dedupeEntries(
    (
      await Book.find(ACTIVE_BOOK_FILTER)
        .select("_id updatedAt createdAt")
        .sort({ updatedAt: -1 })
        .lean()
    ).map((book) => ({
      path: `/books/${book._id}`,
      lastModified: book.updatedAt || book.createdAt,
    }))
  );

const buildPodcastEntries = async () =>
  dedupeEntries(
    (
      await Track.find({ ...ACTIVE_TRACK_FILTER, kind: "podcast" })
        .select("_id updatedAt createdAt")
        .sort({ updatedAt: -1 })
        .lean()
    ).map((track) => ({
      path: `/tracks/${track._id}`,
      lastModified: track.updatedAt || track.createdAt,
    }))
  );

const marketplaceProductPath = (product = {}) =>
  `/marketplace/product/${encodeURIComponent(product.slug || product._id || "")}`;

const marketplaceStorePath = (seller = {}) =>
  `/marketplace/store/${encodeURIComponent(seller.slug || seller._id || "")}`;

const buildMarketplaceEntries = async () => {
  const products = await MarketplaceProduct.find(ACTIVE_MARKETPLACE_PRODUCT_FILTER)
    .select("_id slug seller updatedAt createdAt")
    .sort({ updatedAt: -1 })
    .populate("seller", "_id slug status isActive updatedAt createdAt")
    .lean();

  const approvedProducts = products.filter(
    (product) => product?.seller?.status === "approved" && product?.seller?.isActive
  );
  const productEntries = approvedProducts.map((product) => ({
    path: marketplaceProductPath(product),
    lastModified: product.updatedAt || product.createdAt,
  }));
  const sellerEntries = approvedProducts.map((product) => ({
    path: marketplaceStorePath(product.seller),
    lastModified: product.seller?.updatedAt || product.updatedAt || product.createdAt,
  }));

  const sellersWithoutProducts = await MarketplaceSeller.find(ACTIVE_MARKETPLACE_SELLER_FILTER)
    .select("_id slug updatedAt createdAt")
    .sort({ updatedAt: -1 })
    .limit(500)
    .lean();
  const storeEntries = sellersWithoutProducts.map((seller) => ({
    path: marketplaceStorePath(seller),
    lastModified: seller.updatedAt || seller.createdAt,
  }));

  return dedupeEntries([...productEntries, ...sellerEntries, ...storeEntries]);
};

const buildSectionFiles = (baseName, entries = []) =>
  chunkEntries(entries).map((chunk, index) => ({
    name: `${baseName}-${index + 1}`,
    entries: chunk,
    lastModified: getSectionLastModified(chunk),
    xml: renderUrlSetXml(chunk),
  }));

const buildSitemapManifest = async () => {
  const [staticEntries, creatorEntries, musicEntries, bookEntries, podcastEntries, marketplaceEntries] = await Promise.all([
    Promise.resolve(buildStaticEntries()),
    buildCreatorEntries(),
    buildMusicEntries(),
    buildBookEntries(),
    buildPodcastEntries(),
    buildMarketplaceEntries(),
  ]);

  const sections = [
    {
      name: "static",
      entries: staticEntries,
      lastModified: getSectionLastModified(staticEntries),
      xml: renderUrlSetXml(staticEntries),
    },
    ...buildSectionFiles("creators", creatorEntries),
    ...buildSectionFiles("music", musicEntries),
    ...buildSectionFiles("books", bookEntries),
    ...buildSectionFiles("podcasts", podcastEntries),
    ...buildSectionFiles("marketplace", marketplaceEntries),
  ].filter((section) => Array.isArray(section.entries) && section.entries.length > 0);

  return {
    indexXml: renderSitemapIndexXml(sections),
    sections: new Map(
      sections.map((section) => [
        section.name,
        {
          xml: section.xml,
          lastModified: section.lastModified,
        },
      ])
    ),
  };
};

const getSitemapManifest = async ({ force = false } = {}) => {
  if (!force && sitemapCache.manifest && sitemapCache.expiresAt > Date.now()) {
    return sitemapCache.manifest;
  }

  const manifest = await buildSitemapManifest();
  sitemapCache = {
    manifest,
    expiresAt: Date.now() + SITEMAP_CACHE_TTL_MS,
  };

  return manifest;
};

const getSitemapIndexXml = async ({ force = false } = {}) => {
  const manifest = await getSitemapManifest({ force });
  return manifest.indexXml;
};

const getSitemapSectionXml = async (name, { force = false } = {}) => {
  const manifest = await getSitemapManifest({ force });
  return manifest.sections.get(String(name || "").trim()) || null;
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
    "Disallow: /marketplace/register",
    "Disallow: /marketplace/become-seller",
    "Disallow: /marketplace/dashboard",
    "Disallow: /marketplace/orders",
    "Disallow: /marketplace/payouts",
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
  getSitemapIndexXml,
  getSitemapSectionXml,
};
