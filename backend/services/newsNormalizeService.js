const crypto = require("crypto");

const normalizeWhitespace = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const stripHtml = (value = "") =>
  normalizeWhitespace(
    String(value || "")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
  );

const normalizeSlug = (value = "") =>
  normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const normalizeLanguage = (value = "en") =>
  normalizeWhitespace(value).toLowerCase().slice(0, 12) || "en";

const removeTrackingParams = (urlObject) => {
  const blocked = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "fbclid",
    "gclid",
    "mkt_tok",
  ];
  blocked.forEach((key) => urlObject.searchParams.delete(key));
};

const normalizeUrl = (value = "") => {
  const raw = normalizeWhitespace(value);
  if (!raw) {
    return "";
  }

  try {
    const parsed = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    parsed.hash = "";
    removeTrackingParams(parsed);
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return raw;
  }
};

const normalizeHeadline = (value = "") =>
  normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an|and|or|to|for|of|in|on|at|with|from)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const hashValue = (value = "") =>
  crypto.createHash("sha256").update(String(value || "")).digest("hex");

const coerceArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === undefined || value === null || value === "") {
    return [];
  }
  return [value];
};

const normalizeAsset = (asset = {}, fallbackSourceSlug = "") => ({
  externalId: normalizeWhitespace(asset.externalId || asset.id || ""),
  sourceSlug: normalizeSlug(asset.sourceSlug || fallbackSourceSlug),
  assetType: normalizeWhitespace(asset.assetType || asset.type || "image").toLowerCase(),
  role: normalizeWhitespace(asset.role || "thumbnail").toLowerCase(),
  url: normalizeUrl(asset.url || asset.secureUrl || asset.src || ""),
  secureUrl: normalizeUrl(asset.secureUrl || asset.url || asset.src || ""),
  width: Number(asset.width || 0) || 0,
  height: Number(asset.height || 0) || 0,
  mimeType: normalizeWhitespace(asset.mimeType || asset.contentType || ""),
  altText: normalizeWhitespace(asset.altText || asset.alt || ""),
  caption: normalizeWhitespace(asset.caption || ""),
  creditLine: normalizeWhitespace(asset.creditLine || asset.credit || ""),
});

const normalizeProviderStory = (payload = {}, { sourceSlug = "" } = {}) => {
  const normalizedSourceSlug = normalizeSlug(payload.sourceSlug || sourceSlug);
  const canonicalUrl = normalizeUrl(payload.canonicalUrl || payload.url || "");
  const title = normalizeWhitespace(payload.title || "");
  const subtitle = normalizeWhitespace(payload.subtitle || "");
  const bodyHtml = String(payload.bodyHtml || payload.body || "");
  const summaryText = normalizeWhitespace(
    payload.summaryText ||
      payload.summary ||
      payload.description ||
      subtitle ||
      stripHtml(bodyHtml).slice(0, 320)
  );

  return {
    sourceSlug: normalizedSourceSlug,
    externalId:
      normalizeWhitespace(payload.externalId || payload.id || "") ||
      hashValue(`${normalizedSourceSlug}:${canonicalUrl}:${title}`).slice(0, 32),
    title,
    normalizedTitle: normalizeHeadline(title),
    subtitle,
    bodyHtml,
    summaryText,
    canonicalUrl,
    sourceUrlKey: hashValue(canonicalUrl),
    publishedAt: payload.publishedAt ? new Date(payload.publishedAt) : new Date(),
    updatedAt: payload.updatedAt ? new Date(payload.updatedAt) : null,
    authorByline: normalizeWhitespace(payload.authorByline || payload.author || ""),
    language: normalizeLanguage(payload.language || "en"),
    assets: coerceArray(payload.assets).map((entry) =>
      normalizeAsset(entry, normalizedSourceSlug)
    ),
    tags: coerceArray(payload.tags)
      .map((entry) => normalizeSlug(entry))
      .filter(Boolean),
    rights:
      payload.rights && typeof payload.rights === "object" ? payload.rights : {},
    raw: payload.raw && typeof payload.raw === "object" ? payload.raw : {},
  };
};

const encodeCursor = (payload = {}) =>
  Buffer.from(JSON.stringify(payload || {}), "utf8").toString("base64url");

const decodeCursor = (cursor = "") => {
  const raw = String(cursor || "").trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    return {};
  }
};

module.exports = {
  normalizeWhitespace,
  stripHtml,
  normalizeSlug,
  normalizeLanguage,
  normalizeUrl,
  normalizeHeadline,
  hashValue,
  coerceArray,
  normalizeAsset,
  normalizeProviderStory,
  encodeCursor,
  decodeCursor,
};
