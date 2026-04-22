const mongoose = require("mongoose");

const Album = require("../../models/Album");
const Book = require("../../models/Book");
const Track = require("../../models/Track");
const Video = require("../../models/Video");
const { findCreatorProfileByReference } = require("../creatorLookupService");
const {
  PRIVATE_CREATOR_ALIAS_SEGMENTS,
  buildCreatorIdPath,
  buildCreatorPublicPath,
  normalizeCreatorUsername,
} = require("../publicRouteService");
const {
  DEFAULT_DESCRIPTION,
  DEFAULT_IMAGE_ALT,
  DEFAULT_IMAGE_PATH,
  DEFAULT_OG_TYPE,
  DEFAULT_TITLE,
  DEFAULT_TWITTER_CARD,
  SITE_NAME,
  SITE_URL,
  normalizePathname,
  toAbsoluteUrl,
  toCanonicalUrl,
} = require("./siteSeo");

const ACTIVE_TRACK_FILTER = { isPublished: { $ne: false }, archivedAt: null };
const ACTIVE_BOOK_FILTER = { isPublished: { $ne: false }, archivedAt: null };
const ACTIVE_ALBUM_FILTER = { status: "published", isPublished: { $ne: false }, archivedAt: null };
const ACTIVE_VIDEO_FILTER = { isPublished: { $ne: false }, archivedAt: null };

const PUBLIC_INFO_PAGES = {
  "/creators": {
    title: "Find Creators | Tengacion",
    description:
      "Discover music artists, authors, and creators on Tengacion. Explore African talent and support creators.",
    canonicalPath: "/creators",
    previewTitle: "Find creators on Tengacion",
    previewDescription:
      "Discover music artists, authors, and creators across Tengacion.",
  },
  "/music": {
    title: "African Music Releases & Creator Drops | Tengacion",
    description:
      "Discover new songs, albums, and creator releases on Tengacion. Explore public African music from independent artists and creator studios.",
    canonicalPath: "/music",
    previewTitle: "Discover music on Tengacion",
    previewDescription:
      "Browse public songs, albums, and creator drops on Tengacion.",
  },
  "/books": {
    title: "Books & Digital Reading by African Creators | Tengacion",
    description:
      "Discover public books, digital reading releases, and creator publishing pages on Tengacion.",
    canonicalPath: "/books",
    previewTitle: "Discover books on Tengacion",
    previewDescription:
      "Browse books and digital reading releases from Tengacion creators.",
  },
  "/podcasts": {
    title: "Podcasts & Spoken-Word Episodes | Tengacion",
    description:
      "Listen to public podcast episodes and spoken-word releases from Tengacion creators across Africa.",
    canonicalPath: "/podcasts",
    previewTitle: "Discover podcasts on Tengacion",
    previewDescription:
      "Browse podcasts and spoken-word releases from Tengacion creators.",
  },
  "/terms": {
    title: "Terms of Service | Tengacion",
    description:
      "Read the Tengacion Terms of Service covering platform rules, creator responsibilities, and paid features.",
    canonicalPath: "/terms",
  },
  "/privacy": {
    title: "Privacy Policy | Tengacion",
    description:
      "Learn how Tengacion processes account information, creator content, and privacy controls across the platform.",
    canonicalPath: "/privacy",
  },
  "/community-guidelines": {
    title: "Community Guidelines | Tengacion",
    description:
      "Review Tengacion community guidelines for respectful participation, safety, moderation, and reporting.",
    canonicalPath: "/community-guidelines",
  },
  "/copyright-policy": {
    title: "Copyright Policy | Tengacion",
    description:
      "Understand how Tengacion handles copyright screening, creator responsibilities, and flagged uploads.",
    canonicalPath: "/copyright-policy",
  },
  "/developer-contact": {
    title: "Developer Contact | Tengacion",
    description:
      "Find Tengacion developer contact information and support details.",
    canonicalPath: "/developer-contact",
  },
};

const NOINDEX_PAGE_CONFIG = [
  {
    patterns: ["/", "/login"],
    title: "Log In | Tengacion",
    description: "Log in to Tengacion to access your feed, creators, purchases, and messages.",
    canonicalPath: "/login",
  },
  {
    patterns: ["/register", "/signup", "/kaduna-got-talent/register"],
    title: "Create Account | Tengacion",
    description: "Create your Tengacion account to connect with creators, friends, and communities.",
  },
  {
    patterns: ["/forgot-password", "/reset-password", "/verify-email"],
    title: "Account Access | Tengacion",
    description: "Manage password recovery, email verification, and secure access for your Tengacion account.",
  },
  {
    patterns: ["/settings", "/settings/*"],
    title: "Settings | Tengacion",
    description: "Private Tengacion account settings.",
  },
  {
    patterns: ["/messages", "/messages/*"],
    title: "Messages | Tengacion",
    description: "Private Tengacion messaging area.",
  },
  {
    patterns: ["/notifications", "/notifications/*"],
    title: "Notifications | Tengacion",
    description: "Private Tengacion notifications page.",
  },
  {
    patterns: ["/dashboard", "/dashboard/*", "/creator/dashboard", "/creator/dashboard/*"],
    title: "Dashboard | Tengacion",
    description: "Private Tengacion dashboard and creator workspace.",
  },
  {
    patterns: ["/home", "/trending", "/news", "/news/*", "/live", "/live/*", "/gaming", "/reels"],
    title: "Tengacion App | Tengacion",
    description: "Private Tengacion app experience.",
  },
  {
    patterns: ["/search", "/profile/*", "/friends", "/find-friends", "/rooms", "/events", "/birthdays", "/saved", "/groups"],
    title: "Private Page | Tengacion",
    description: "Private Tengacion page.",
  },
  {
    patterns: ["/payment/verify", "/payments/*", "/purchases", "/purchases/*"],
    title: "Payments | Tengacion",
    description: "Private Tengacion payments and purchases page.",
  },
  {
    patterns: ["/onboarding", "/creator/register", "/creator/fan-page-view", "/creator/categories", "/creator/earnings", "/creator/payouts", "/creator/settings", "/creator/verification", "/creator/support", "/creator/music", "/creator/music/*", "/creator/books", "/creator/books/*", "/creator/podcasts", "/creator/podcasts/*"],
    title: "Creator Workspace | Tengacion",
    description: "Private Tengacion creator workspace.",
  },
  {
    patterns: ["/admin", "/admin/*"],
    title: "Admin | Tengacion",
    description: "Private Tengacion admin area.",
  },
  {
    patterns: ["/marketplace", "/marketplace/*"],
    title: "Marketplace | Tengacion",
    description: "Private Tengacion marketplace page.",
  },
  {
    patterns: ["/creator/*/subscribe", "/creators/*/subscribe"],
    title: "Subscribe | Tengacion",
    description: "Private Tengacion subscription flow.",
  },
];

const escapeHtml = (value = "") =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const escapeHtmlAttribute = (value = "") =>
  escapeHtml(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const safeJsonLd = (value) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

const truncateText = (value = "", maxLength = 160) => {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
};

const pickText = (...values) => {
  for (const value of values) {
    const normalized = String(value || "").replace(/\s+/g, " ").trim();
    if (normalized) {
      return normalized;
    }
  }
  return "";
};

const resolveUserAvatar = (user = {}) => {
  if (!user) {
    return "";
  }
  if (typeof user.avatar === "string") {
    return user.avatar;
  }
  return user.avatar?.url || "";
};

const buildWebSiteJsonLd = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: toCanonicalUrl("/"),
});

const buildOrganizationJsonLd = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: toCanonicalUrl("/"),
  logo: toAbsoluteUrl(DEFAULT_IMAGE_PATH),
});

const buildBreadcrumbJsonLd = (items = []) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: String(item?.name || "").trim(),
    item: toAbsoluteUrl(item?.url || "/"),
  })),
});

const buildPreviewMarkup = ({ title = SITE_NAME, description = DEFAULT_DESCRIPTION } = {}) =>
  `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p>`;

const buildSeoPayload = ({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  canonicalPath = "/",
  robots = "index,follow",
  ogType = DEFAULT_OG_TYPE,
  image = DEFAULT_IMAGE_PATH,
  imageAlt = DEFAULT_IMAGE_ALT,
  structuredData = [],
  previewTitle = "",
  previewDescription = "",
  statusCode = 200,
} = {}) => {
  const canonicalUrl = toCanonicalUrl(canonicalPath);
  const imageUrl = toAbsoluteUrl(image || DEFAULT_IMAGE_PATH);
  const normalizedDescription = truncateText(description || DEFAULT_DESCRIPTION, 180) || DEFAULT_DESCRIPTION;
  const resolvedStructuredData = [
    buildWebSiteJsonLd(),
    buildOrganizationJsonLd(),
    ...(Array.isArray(structuredData) ? structuredData.filter(Boolean) : []),
  ];

  return {
    title,
    description: normalizedDescription,
    canonicalUrl,
    canonicalPath: normalizePathname(canonicalPath),
    robots,
    ogTitle: title,
    ogDescription: normalizedDescription,
    ogType,
    ogUrl: canonicalUrl,
    ogImage: imageUrl,
    ogImageAlt: imageAlt || DEFAULT_IMAGE_ALT,
    twitterCard: DEFAULT_TWITTER_CARD,
    twitterTitle: title,
    twitterDescription: normalizedDescription,
    twitterImage: imageUrl,
    twitterImageAlt: imageAlt || DEFAULT_IMAGE_ALT,
    structuredData: resolvedStructuredData,
    previewHtml: buildPreviewMarkup({
      title: previewTitle || title,
      description: previewDescription || normalizedDescription,
    }),
    statusCode,
    xRobotsTag: String(robots || "").toLowerCase().includes("noindex") ? robots : "",
  };
};

const replaceTagAttribute = (html, key, attribute, value) =>
  html.replace(
    new RegExp(`(<[^>]+data-seo-key="${key}"[^>]*\\b${attribute}=")([^"]*)(")`, "i"),
    `$1${escapeHtmlAttribute(value)}$3`
  );

const replaceTagContent = (html, key, value) =>
  html.replace(
    new RegExp(`(<[^>]+data-seo-key="${key}"[^>]*>)([\\s\\S]*?)(</[^>]+>)`, "i"),
    `$1${value}$3`
  );

const renderSeoHtml = (template = "", seo = {}) => {
  let html = String(template || "");
  if (!html) {
    return html;
  }

  html = replaceTagContent(html, "title", escapeHtml(seo.title || DEFAULT_TITLE));
  html = replaceTagAttribute(html, "description", "content", seo.description || DEFAULT_DESCRIPTION);
  html = replaceTagAttribute(html, "canonical", "href", seo.canonicalUrl || toCanonicalUrl("/"));
  html = replaceTagAttribute(html, "robots", "content", seo.robots || "index,follow");
  html = replaceTagAttribute(html, "og:title", "content", seo.ogTitle || seo.title || DEFAULT_TITLE);
  html = replaceTagAttribute(html, "og:description", "content", seo.ogDescription || seo.description || DEFAULT_DESCRIPTION);
  html = replaceTagAttribute(html, "og:type", "content", seo.ogType || DEFAULT_OG_TYPE);
  html = replaceTagAttribute(html, "og:url", "content", seo.ogUrl || seo.canonicalUrl || toCanonicalUrl("/"));
  html = replaceTagAttribute(html, "og:image", "content", seo.ogImage || toAbsoluteUrl(DEFAULT_IMAGE_PATH));
  html = replaceTagAttribute(html, "og:image:alt", "content", seo.ogImageAlt || DEFAULT_IMAGE_ALT);
  html = replaceTagAttribute(html, "twitter:card", "content", seo.twitterCard || DEFAULT_TWITTER_CARD);
  html = replaceTagAttribute(html, "twitter:title", "content", seo.twitterTitle || seo.title || DEFAULT_TITLE);
  html = replaceTagAttribute(html, "twitter:description", "content", seo.twitterDescription || seo.description || DEFAULT_DESCRIPTION);
  html = replaceTagAttribute(html, "twitter:image", "content", seo.twitterImage || toAbsoluteUrl(DEFAULT_IMAGE_PATH));
  html = replaceTagAttribute(html, "twitter:image:alt", "content", seo.twitterImageAlt || DEFAULT_IMAGE_ALT);
  html = replaceTagContent(
    html,
    "structured-data",
    safeJsonLd(
      Array.isArray(seo.structuredData) && seo.structuredData.length === 1
        ? seo.structuredData[0]
        : seo.structuredData || []
    )
  );
  html = replaceTagContent(html, "boot-preview", seo.previewHtml || buildPreviewMarkup());

  return html;
};

const buildStaticPageSeo = (pathname) => {
  const page = PUBLIC_INFO_PAGES[pathname];
  if (!page) {
    return null;
  }
  return buildSeoPayload(page);
};

const buildNoIndexPageSeo = (pathname) => {
  for (const entry of NOINDEX_PAGE_CONFIG) {
    if (entry.patterns.some((pattern) => matchesPathPattern(pathname, pattern))) {
      return buildSeoPayload({
        title: entry.title,
        description: entry.description,
        canonicalPath: entry.canonicalPath || pathname,
        robots: "noindex,nofollow",
        previewTitle: entry.title,
        previewDescription: entry.description,
      });
    }
  }

  return buildSeoPayload({
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    canonicalPath: pathname,
    robots: "noindex,nofollow",
  });
};

const matchesPathPattern = (pathname, pattern) => {
  const cleanPath = normalizePathname(pathname);
  const cleanPattern = normalizePathname(pattern);

  if (cleanPattern.endsWith("/*")) {
    const prefix = cleanPattern.slice(0, -2);
    return cleanPath === prefix || cleanPath.startsWith(`${prefix}/`);
  }

  if (cleanPattern.includes("*")) {
    const regexSource = cleanPattern
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\\\*/g, "[^/]+");
    return new RegExp(`^${regexSource}$`, "i").test(cleanPath);
  }

  return cleanPath === cleanPattern;
};

const resolveCreatorCounts = async (creatorId, creatorUserId = "") => {
  const [tracksCount, albumsCount, booksCount, podcastsCount, videosCount] = await Promise.all([
    Track.countDocuments({ creatorId, kind: { $in: ["music", null] }, ...ACTIVE_TRACK_FILTER }),
    Album.countDocuments({ creatorId, ...ACTIVE_ALBUM_FILTER }),
    Book.countDocuments({ creatorId, ...ACTIVE_BOOK_FILTER }),
    Track.countDocuments({ creatorId, kind: "podcast", ...ACTIVE_TRACK_FILTER }),
    Video.countDocuments({
      archivedAt: null,
      isPublished: { $ne: false },
      $or: [{ creatorProfileId: creatorId }, { userId: String(creatorUserId || "") }],
    }),
  ]);

  return {
    tracksCount,
    albumsCount,
    booksCount,
    podcastsCount,
    videosCount,
  };
};

const hasMeaningfulSeoCopy = (...values) =>
  values.some((value) => String(value || "").replace(/\s+/g, " ").trim().length >= 24);

const totalCreatorItems = (counts = {}) =>
  Number(counts.tracksCount || 0) +
  Number(counts.albumsCount || 0) +
  Number(counts.booksCount || 0) +
  Number(counts.podcastsCount || 0) +
  Number(counts.videosCount || 0);

const buildCreatorCanonicalPath = (profile, tab = "home") =>
  buildCreatorPublicPath({
    creatorId: String(profile?._id || ""),
    username: profile?.userId?.username,
    tab,
  });

const buildCreatorDescription = ({ displayName, profile, counts, tab = "home" }) => {
  const creatorBio = pickText(profile?.tagline, profile?.bio);
  const defaultsByTab = {
    home: `Explore ${displayName} on Tengacion. Discover public music, books, podcasts, and updates from this creator.`,
    music: `Stream public singles, albums, and videos from ${displayName} on Tengacion.`,
    albums: `Explore public albums and EP releases from ${displayName} on Tengacion.`,
    podcasts: `Listen to public podcast episodes and spoken-word releases from ${displayName} on Tengacion.`,
    books: `Browse public books and digital releases from ${displayName} on Tengacion.`,
  };

  if (tab === "home" && creatorBio) {
    const totalItems = totalCreatorItems(counts);
    const coverage = totalItems > 0
      ? `Discover ${totalItems} public release${totalItems === 1 ? "" : "s"} from this creator.`
      : "Discover this creator's public profile and updates.";
    return truncateText(`${defaultsByTab.home} ${coverage} ${creatorBio}`, 180);
  }

  if (creatorBio && tab !== "home") {
    return truncateText(`${defaultsByTab[tab] || defaultsByTab.home} ${creatorBio}`, 180);
  }

  return truncateText(pickText(defaultsByTab[tab], defaultsByTab.home, creatorBio), 180);
};

const buildCreatorSeo = async ({ creatorRef, tab = "home", requestedPath = "/" } = {}) => {
  const profile = await findCreatorProfileByReference({
    creatorRef,
    populate: "name username avatar country links tagline bio genres heroBannerUrl coverImageUrl",
    lean: true,
  });

  if (!profile) {
    return buildSeoPayload({
      title: "Creator Not Found | Tengacion",
      description: DEFAULT_DESCRIPTION,
      canonicalPath: buildCreatorIdPath({ creatorId: creatorRef }),
      robots: "noindex,nofollow",
      statusCode: 404,
    });
  }

  const counts = await resolveCreatorCounts(profile._id, profile?.userId?._id || profile?.userId || "");
  const displayName = pickText(profile.displayName, profile.fullName, profile?.userId?.name, "Creator");
  const titleByTab = {
    home: `${displayName} on Tengacion | Music, Books, Podcasts & Updates`,
    music: `${displayName} Music on Tengacion | Singles, Videos & Releases`,
    albums: `${displayName} Albums on Tengacion | EPs & Projects`,
    podcasts: `${displayName} Podcasts on Tengacion | Episodes & Spoken Word`,
    books: `${displayName} Books on Tengacion | Reading & Publishing`,
  };
  const canonicalPath = buildCreatorCanonicalPath(profile, tab);
  const image = pickText(
    profile.heroBannerUrl,
    profile.coverImageUrl,
    resolveUserAvatar(profile.userId),
    DEFAULT_IMAGE_PATH
  );
  const sameAs = Array.isArray(profile.links)
    ? profile.links.map((entry) => String(entry?.url || "").trim()).filter(Boolean)
    : [];
  const normalizedRequestedPath = normalizePathname(requestedPath);
  const tabIndexability = {
    home: totalCreatorItems(counts) > 0 || hasMeaningfulSeoCopy(profile?.tagline, profile?.bio),
    music: Number(counts.tracksCount || 0) > 0 || Number(counts.videosCount || 0) > 0,
    albums: Number(counts.albumsCount || 0) > 0,
    podcasts: Number(counts.podcastsCount || 0) > 0,
    books: Number(counts.booksCount || 0) > 0,
  };
  const pageIsIndexable = tab === "home" ? tabIndexability.home : Boolean(tabIndexability[tab]);
  const isCanonicalRequest = normalizedRequestedPath === normalizePathname(canonicalPath);
  const breadcrumbItems = [
    { name: "Creators", url: "/creators" },
    { name: displayName, url: buildCreatorCanonicalPath(profile, "home") },
  ];

  if (tab !== "home") {
    breadcrumbItems.push({
      name: tab === "albums" ? "Albums" : tab === "books" ? "Books" : tab === "podcasts" ? "Podcasts" : "Music",
      url: canonicalPath,
    });
  }

  return buildSeoPayload({
    title: titleByTab[tab] || titleByTab.home,
    description: buildCreatorDescription({ displayName, profile, counts, tab }),
    canonicalPath,
    robots: pageIsIndexable && isCanonicalRequest ? "index,follow" : "noindex,follow",
    ogType: "profile",
    image,
    imageAlt: `${displayName} on Tengacion`,
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        name: `${displayName} on Tengacion`,
        url: toCanonicalUrl(canonicalPath),
        description: buildCreatorDescription({ displayName, profile, counts, tab: "home" }),
        mainEntity: {
          "@type": "Person",
          name: displayName,
          description: pickText(profile.tagline, profile.bio),
          image: toAbsoluteUrl(image),
          sameAs,
          knowsAbout: Array.isArray(profile.genres) ? profile.genres.filter(Boolean).slice(0, 8) : undefined,
        },
      },
      buildBreadcrumbJsonLd(breadcrumbItems),
    ],
    previewTitle: titleByTab[tab] || titleByTab.home,
    previewDescription:
      buildCreatorDescription({ displayName, profile, counts, tab: "home" }) ||
      `Explore ${displayName} across music, books, and podcasts on Tengacion.`,
  });
};

const buildTrackSeo = async (trackId) => {
  if (!mongoose.Types.ObjectId.isValid(trackId)) {
    return buildSeoPayload({
      title: "Release Not Found | Tengacion",
      description: DEFAULT_DESCRIPTION,
      canonicalPath: `/tracks/${trackId}`,
      robots: "noindex,nofollow",
      statusCode: 404,
    });
  }

  const track = await Track.findOne({ _id: trackId, ...ACTIVE_TRACK_FILTER })
    .populate({
      path: "creatorId",
      select: "displayName fullName userId",
      populate: { path: "userId", select: "name username" },
    })
    .lean();

  if (!track) {
    return buildSeoPayload({
      title: "Release Not Found | Tengacion",
      description: DEFAULT_DESCRIPTION,
      canonicalPath: `/tracks/${trackId}`,
      robots: "noindex,nofollow",
      statusCode: 404,
    });
  }

  const creatorName = pickText(
    track?.creatorId?.displayName,
    track?.creatorId?.fullName,
    track?.creatorId?.userId?.name,
    "Tengacion Creator"
  );
  const isPodcast = String(track.kind || "").toLowerCase() === "podcast";
  const title = isPodcast && track.podcastSeries
    ? `${track.title} | ${track.podcastSeries} on Tengacion`
    : `${track.title} by ${creatorName} | Tengacion`;
  const description = truncateText(
    pickText(
      track.description,
      track.showNotes,
      track.genre
        ? `${track.title} by ${creatorName} on Tengacion in ${track.genre}.`
        : "",
      track.podcastCategory
        ? `Listen to ${track.title} from ${creatorName} on Tengacion in ${track.podcastCategory}.`
        : "",
      isPodcast
        ? `Listen to ${track.title} from ${creatorName} on Tengacion.`
        : `Stream ${track.title} by ${creatorName} on Tengacion.`
    ),
    180
  );
  const image = pickText(track.coverImageUrl, DEFAULT_IMAGE_PATH);
  const creatorPath = buildCreatorPublicPath({
    creatorId: track?.creatorId?._id || track?.creatorId || "",
    username: track?.creatorId?.userId?.username,
  });
  const jsonLd = isPodcast
    ? {
        "@context": "https://schema.org",
        "@type": "PodcastEpisode",
        name: track.title || "Podcast episode",
        description,
        url: toCanonicalUrl(`/tracks/${track._id}`),
        image: toAbsoluteUrl(image),
        datePublished: track.releaseDate || track.createdAt || undefined,
        partOfSeries: track.podcastSeries
          ? {
              "@type": "PodcastSeries",
              name: track.podcastSeries,
            }
          : undefined,
        associatedMedia: {
          "@type": "MediaObject",
          duration: track.durationSec ? `PT${Number(track.durationSec)}S` : undefined,
        },
        actor: {
          "@type": "Person",
          name: creatorName,
        },
      }
    : {
        "@context": "https://schema.org",
        "@type": "MusicRecording",
        name: track.title || "Track",
        description,
        url: toCanonicalUrl(`/tracks/${track._id}`),
        image: toAbsoluteUrl(image),
        datePublished: track.releaseDate || track.createdAt || undefined,
        duration: track.durationSec ? `PT${Number(track.durationSec)}S` : undefined,
        byArtist: {
          "@type": "Person",
          name: creatorName,
          url: toCanonicalUrl(creatorPath),
        },
        inAlbum: undefined,
      };

  return buildSeoPayload({
    title,
    description,
    canonicalPath: `/tracks/${track._id}`,
    ogType: isPodcast ? "article" : "music.song",
    image,
    imageAlt: `${track.title} by ${creatorName}`,
    structuredData: [
      jsonLd,
      buildBreadcrumbJsonLd([
        { name: "Creators", url: "/creators" },
        { name: creatorName, url: creatorPath },
        { name: track.title || "Track", url: `/tracks/${track._id}` },
      ]),
    ],
  });
};

const buildBookSeo = async (bookId) => {
  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    return buildSeoPayload({
      title: "Book Not Found | Tengacion",
      description: DEFAULT_DESCRIPTION,
      canonicalPath: `/books/${bookId}`,
      robots: "noindex,nofollow",
      statusCode: 404,
    });
  }

  const book = await Book.findOne({ _id: bookId, ...ACTIVE_BOOK_FILTER })
    .populate({
      path: "creatorId",
      select: "displayName fullName userId",
      populate: { path: "userId", select: "name username" },
    })
    .lean();

  if (!book) {
    return buildSeoPayload({
      title: "Book Not Found | Tengacion",
      description: DEFAULT_DESCRIPTION,
      canonicalPath: `/books/${bookId}`,
      robots: "noindex,nofollow",
      statusCode: 404,
    });
  }

  const creatorName = pickText(
    book?.creatorId?.displayName,
    book?.creatorId?.fullName,
    book?.creatorId?.userId?.name,
    book.authorName,
    "Tengacion Creator"
  );
  const description = truncateText(
    pickText(
      book.description,
      book.subtitle,
      book.previewExcerptText,
      book.genre ? `${book.title} is a ${book.genre} release by ${creatorName} on Tengacion.` : "",
      `Discover ${book.title} by ${creatorName} on Tengacion.`
    ),
    180
  );
  const image = pickText(book.coverImageUrl, DEFAULT_IMAGE_PATH);
  const creatorPath = buildCreatorPublicPath({
    creatorId: book?.creatorId?._id || book?.creatorId || "",
    username: book?.creatorId?.userId?.username,
  });

  return buildSeoPayload({
    title: `${book.title} by ${creatorName} | Tengacion`,
    description,
    canonicalPath: `/books/${book._id}`,
    ogType: "book",
    image,
    imageAlt: `${book.title} cover`,
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "Book",
        name: book.title || "Book",
        description,
        url: toCanonicalUrl(`/books/${book._id}`),
        image: toAbsoluteUrl(image),
        author: {
          "@type": "Person",
          name: creatorName,
          url: toCanonicalUrl(creatorPath),
        },
        bookFormat: book.fileFormat ? `https://schema.org/${String(book.fileFormat).toUpperCase()}` : undefined,
        inLanguage: book.language || undefined,
        datePublished: book.createdAt || undefined,
      },
      buildBreadcrumbJsonLd([
        { name: "Creators", url: "/creators" },
        { name: creatorName, url: creatorPath },
        { name: book.title || "Book", url: `/books/${book._id}` },
      ]),
    ],
  });
};

const buildAlbumSeo = async (albumId) => {
  if (!mongoose.Types.ObjectId.isValid(albumId)) {
    return buildSeoPayload({
      title: "Album Not Found | Tengacion",
      description: DEFAULT_DESCRIPTION,
      canonicalPath: `/albums/${albumId}`,
      robots: "noindex,nofollow",
      statusCode: 404,
    });
  }

  const album = await Album.findOne({ _id: albumId, ...ACTIVE_ALBUM_FILTER })
    .populate({
      path: "creatorId",
      select: "displayName fullName userId",
      populate: { path: "userId", select: "name username" },
    })
    .lean();

  if (!album) {
    return buildSeoPayload({
      title: "Album Not Found | Tengacion",
      description: DEFAULT_DESCRIPTION,
      canonicalPath: `/albums/${albumId}`,
      robots: "noindex,nofollow",
      statusCode: 404,
    });
  }

  const creatorName = pickText(
    album?.creatorId?.displayName,
    album?.creatorId?.fullName,
    album?.creatorId?.userId?.name,
    "Tengacion Creator"
  );
  const image = pickText(album.coverUrl, DEFAULT_IMAGE_PATH);
  const trackCount = Number(album.totalTracks || (Array.isArray(album.tracks) ? album.tracks.length : 0) || 0);
  const description = truncateText(
    pickText(
      album.description,
      album.releaseType
        ? `${album.title} is a ${album.releaseType} by ${creatorName} on Tengacion with ${trackCount} ${trackCount === 1 ? "track" : "tracks"}.`
        : "",
      `${album.title} by ${creatorName} on Tengacion with ${trackCount} ${trackCount === 1 ? "track" : "tracks"}.`
    ),
    180
  );
  const creatorPath = buildCreatorPublicPath({
    creatorId: album?.creatorId?._id || album?.creatorId || "",
    username: album?.creatorId?.userId?.username,
  });

  return buildSeoPayload({
    title: `${album.title} by ${creatorName} | Tengacion`,
    description,
    canonicalPath: `/albums/${album._id}`,
    ogType: "music.album",
    image,
    imageAlt: `${album.title} cover art`,
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "MusicAlbum",
        name: album.title || "Album",
        description,
        url: toCanonicalUrl(`/albums/${album._id}`),
        image: toAbsoluteUrl(image),
        datePublished: album.createdAt || undefined,
        byArtist: {
          "@type": "Person",
          name: creatorName,
          url: toCanonicalUrl(creatorPath),
        },
        numTracks: trackCount || undefined,
      },
      buildBreadcrumbJsonLd([
        { name: "Creators", url: "/creators" },
        { name: creatorName, url: creatorPath },
        { name: album.title || "Album", url: `/albums/${album._id}` },
      ]),
    ],
  });
};

const resolveDynamicSeo = async (pathname) => {
  const creatorMatch = pathname.match(/^\/creators\/([^/]+)(?:\/(music|albums|podcasts|books))?$/i);
  if (creatorMatch) {
    return buildCreatorSeo({
      creatorRef: creatorMatch[1],
      tab: String(creatorMatch[2] || "home").toLowerCase(),
      requestedPath: pathname,
    });
  }

  const creatorAliasMatch = pathname.match(/^\/creator\/([^/]+)(?:\/(music|albums|podcasts|books))?$/i);
  if (
    creatorAliasMatch
    && !PRIVATE_CREATOR_ALIAS_SEGMENTS.has(normalizeCreatorUsername(creatorAliasMatch[1]))
  ) {
    return buildCreatorSeo({
      creatorRef: creatorAliasMatch[1],
      tab: String(creatorAliasMatch[2] || "home").toLowerCase(),
      requestedPath: pathname,
    });
  }

  const trackMatch = pathname.match(/^\/tracks\/([^/]+)$/i);
  if (trackMatch) {
    return buildTrackSeo(trackMatch[1]);
  }

  const bookMatch = pathname.match(/^\/books\/([^/]+)$/i);
  if (bookMatch) {
    return buildBookSeo(bookMatch[1]);
  }

  const albumMatch = pathname.match(/^\/albums\/([^/]+)$/i);
  if (albumMatch) {
    return buildAlbumSeo(albumMatch[1]);
  }

  return null;
};

const resolvePageSeo = async ({ path = "/" } = {}) => {
  const pathname = normalizePathname(path);

  if (pathname === "/find-creators") {
    return buildSeoPayload({
      ...PUBLIC_INFO_PAGES["/creators"],
      canonicalPath: "/creators",
      robots: "noindex,follow",
      previewTitle: "Find creators on Tengacion",
      previewDescription:
        "Discover music artists, authors, and creators across Tengacion.",
    });
  }

  const staticPageSeo = buildStaticPageSeo(pathname);
  if (staticPageSeo) {
    return staticPageSeo;
  }

  const dynamicSeo = await resolveDynamicSeo(pathname);
  if (dynamicSeo) {
    return dynamicSeo;
  }

  return buildNoIndexPageSeo(pathname);
};

module.exports = {
  renderSeoHtml,
  resolvePageSeo,
};
