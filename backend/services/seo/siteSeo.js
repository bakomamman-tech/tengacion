const SITE_NAME = "Tengacion";
const SITE_URL =
  String(process.env.SEO_SITE_URL || "https://tengacion.com").replace(/\/+$/, "")
  || "https://tengacion.com";
const DEFAULT_TITLE = "Tengacion - Discover African Creators, Music, Books & Podcasts";
const DEFAULT_DESCRIPTION =
  "Tengacion is a creator and social platform where users discover, stream, share, and support music, books, podcasts, and creators.";
const DEFAULT_IMAGE_PATH = "/tengacion_logo_1024.png";
const DEFAULT_IMAGE_ALT = "Tengacion preview image";
const DEFAULT_OG_TYPE = "website";
const DEFAULT_TWITTER_CARD = "summary_large_image";

const normalizePathname = (value = "/") => {
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

const toAbsoluteUrl = (value = "/") => {
  const raw = String(value || "").trim();
  if (!raw) {
    return SITE_URL;
  }

  try {
    return new URL(raw, `${SITE_URL}/`).toString();
  } catch {
    return SITE_URL;
  }
};

const toCanonicalUrl = (pathname = "/") => toAbsoluteUrl(normalizePathname(pathname));

module.exports = {
  SITE_NAME,
  SITE_URL,
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
  DEFAULT_IMAGE_PATH,
  DEFAULT_IMAGE_ALT,
  DEFAULT_OG_TYPE,
  DEFAULT_TWITTER_CARD,
  normalizePathname,
  toAbsoluteUrl,
  toCanonicalUrl,
};
