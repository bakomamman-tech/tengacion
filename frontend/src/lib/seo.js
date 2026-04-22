export const SITE_NAME = "Tengacion";
export const SITE_URL = "https://tengacion.com";
export const DEFAULT_TITLE = "Tengacion - Discover African Creators, Music, Books & Podcasts";
export const DEFAULT_DESCRIPTION =
  "Tengacion is a creator and social platform where users discover, stream, share, and support music, books, podcasts, and creators.";
export const DEFAULT_IMAGE_PATH = "/tengacion_logo_1024.png";
export const DEFAULT_IMAGE_ALT = "Tengacion preview image";
export const DEFAULT_OG_TYPE = "website";
export const DEFAULT_TWITTER_CARD = "summary_large_image";

export const normalizePathname = (value = "/") => {
  const raw = String(value || "/").trim();
  if (!raw) {
    return "/";
  }

  const pathname = raw.startsWith("/") ? raw : `/${raw}`;
  if (pathname === "/") {
    return "/";
  }

  return pathname.replace(/\/+$/, "") || "/";
};

export const toAbsoluteUrl = (value = "/") => {
  const raw = String(value || "").trim();
  if (!raw) {
    return `${SITE_URL}/`;
  }

  try {
    return new URL(raw, `${SITE_URL}/`).toString();
  } catch {
    return `${SITE_URL}/`;
  }
};

export const buildCanonicalUrl = (pathname = "/") => toAbsoluteUrl(normalizePathname(pathname));

export const resolveSeoImage = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) {
    return toAbsoluteUrl(DEFAULT_IMAGE_PATH);
  }

  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("data:") || raw.startsWith("blob:")) {
    return toAbsoluteUrl(raw);
  }

  return toAbsoluteUrl(raw.startsWith("/") ? raw : `/${raw}`);
};

export const truncateDescription = (value = "", maxLength = 180) => {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
};

export const pickFirstText = (...values) => {
  for (const value of values) {
    const normalized = String(value || "").replace(/\s+/g, " ").trim();
    if (normalized) {
      return normalized;
    }
  }
  return "";
};

export const toDurationIso = (seconds = 0) => {
  const value = Math.max(0, Number(seconds || 0));
  if (!value) {
    return "";
  }
  return `PT${Math.round(value)}S`;
};

export const buildWebSiteJsonLd = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: buildCanonicalUrl("/"),
});

export const buildOrganizationJsonLd = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: buildCanonicalUrl("/"),
  logo: resolveSeoImage(DEFAULT_IMAGE_PATH),
});

export const buildBreadcrumbJsonLd = (items = []) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: String(item?.name || "").trim(),
    item: buildCanonicalUrl(item?.url || "/"),
  })),
});

export const buildCreatorProfileJsonLd = ({
  name = "Creator",
  description = "",
  image = DEFAULT_IMAGE_PATH,
  canonicalPath = "/",
  sameAs = [],
} = {}) => ({
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  name: `${name} on ${SITE_NAME}`,
  url: buildCanonicalUrl(canonicalPath),
  description,
  mainEntity: {
    "@type": "Person",
    name,
    description,
    image: resolveSeoImage(image),
    sameAs: Array.isArray(sameAs) ? sameAs.filter(Boolean) : [],
  },
});

export const buildMusicRecordingJsonLd = ({
  title = "Track",
  description = "",
  image = DEFAULT_IMAGE_PATH,
  canonicalPath = "/",
  creatorName = "Tengacion Creator",
  creatorPath = "/creators",
  durationSec = 0,
  publishedAt = "",
} = {}) => ({
  "@context": "https://schema.org",
  "@type": "MusicRecording",
  name: title,
  description,
  url: buildCanonicalUrl(canonicalPath),
  image: resolveSeoImage(image),
  duration: toDurationIso(durationSec) || undefined,
  datePublished: publishedAt || undefined,
  byArtist: {
    "@type": "Person",
    name: creatorName,
    url: buildCanonicalUrl(creatorPath),
  },
});

export const buildPodcastEpisodeJsonLd = ({
  title = "Podcast Episode",
  description = "",
  image = DEFAULT_IMAGE_PATH,
  canonicalPath = "/",
  creatorName = "Tengacion Creator",
  publishedAt = "",
  durationSec = 0,
  seriesTitle = "",
} = {}) => ({
  "@context": "https://schema.org",
  "@type": "PodcastEpisode",
  name: title,
  description,
  url: buildCanonicalUrl(canonicalPath),
  image: resolveSeoImage(image),
  datePublished: publishedAt || undefined,
  associatedMedia: durationSec
    ? {
        "@type": "MediaObject",
        duration: toDurationIso(durationSec),
      }
    : undefined,
  actor: {
    "@type": "Person",
    name: creatorName,
  },
  partOfSeries: seriesTitle
    ? {
        "@type": "PodcastSeries",
        name: seriesTitle,
      }
    : undefined,
});

export const buildBookJsonLd = ({
  title = "Book",
  description = "",
  image = DEFAULT_IMAGE_PATH,
  canonicalPath = "/",
  creatorName = "Tengacion Creator",
  creatorPath = "/creators",
  language = "",
  publishedAt = "",
} = {}) => ({
  "@context": "https://schema.org",
  "@type": "Book",
  name: title,
  description,
  url: buildCanonicalUrl(canonicalPath),
  image: resolveSeoImage(image),
  inLanguage: language || undefined,
  datePublished: publishedAt || undefined,
  author: {
    "@type": "Person",
    name: creatorName,
    url: buildCanonicalUrl(creatorPath),
  },
});

export const buildMusicAlbumJsonLd = ({
  title = "Album",
  description = "",
  image = DEFAULT_IMAGE_PATH,
  canonicalPath = "/",
  creatorName = "Tengacion Creator",
  creatorPath = "/creators",
  publishedAt = "",
  trackCount = 0,
} = {}) => ({
  "@context": "https://schema.org",
  "@type": "MusicAlbum",
  name: title,
  description,
  url: buildCanonicalUrl(canonicalPath),
  image: resolveSeoImage(image),
  datePublished: publishedAt || undefined,
  numTracks: trackCount || undefined,
  byArtist: {
    "@type": "Person",
    name: creatorName,
    url: buildCanonicalUrl(creatorPath),
  },
});
