const { URL } = require("url");
const ApiError = require("./ApiError");

const PLATFORM_DOMAIN_RULES = {
  spotify: ["spotify.com"],
  instagram: ["instagram.com"],
  facebook: ["facebook.com"],
  tiktok: ["tiktok.com"],
  youtube: ["youtube.com", "youtu.be"],
  appleMusic: ["music.apple.com"],
  audiomack: ["audiomack.com"],
  boomplay: ["boomplay.com"],
  website: [],
};

const sanitizeUrl = (value, platform = "", requireDomain = true) => {
  if (!value) return "";

  let url;
  try {
    url = new URL(value.trim());
  } catch (err) {
    throw ApiError.badRequest(`Invalid URL for ${platform || "link"}`);
  }

  if (url.protocol !== "https:") {
    throw ApiError.badRequest(`Use HTTPS URLs only for ${platform || "link"}`);
  }

  if (requireDomain && PLATFORM_DOMAIN_RULES[platform]) {
    const allowed = PLATFORM_DOMAIN_RULES[platform];
    if (
      allowed.length &&
      !allowed.some((domain) => url.hostname.toLowerCase().endsWith(domain))
    ) {
      throw ApiError.badRequest(`Invalid ${platform} URL`);
    }
  }

  return url.toString();
};

const sanitizePlatformLinks = (links = {}) => {
  const sanitized = {};

  Object.keys(PLATFORM_DOMAIN_RULES).forEach((platform) => {
    if (!Object.prototype.hasOwnProperty.call(links, platform)) {
      return;
    }

    if (!links[platform]) {
      sanitized[platform] = "";
      return;
    }

    sanitized[platform] = sanitizeUrl(links[platform], platform);
  });

  return sanitized;
};

const sanitizeCustomLinks = (items = []) => {
  if (!Array.isArray(items)) {
    throw ApiError.badRequest("Custom links must be an array");
  }

  return items.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw ApiError.badRequest(`Custom link at index ${index} is invalid`);
    }

    const label = (item.label || "").trim();
    const url = item.url || "";

    if (!label || label.length > 60) {
      throw ApiError.badRequest(`Custom link label at index ${index} is required and must be <= 60 chars`);
    }

    return {
      label,
      url: sanitizeUrl(url, `custom link ${label}`, false),
    };
  });
};

module.exports = {
  sanitizePlatformLinks,
  sanitizeCustomLinks,
};
