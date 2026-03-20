const { createJsonIngestService } = require("./baseIngestService");

const DEFAULT_RIGHTS = {
  mode: "SUMMARY_PLUS_LINKOUT",
  attributionRequired: true,
  canonicalLinkRequired: true,
  allowBodyHtml: false,
  allowSummary: true,
  allowThumbnail: true,
  allowEmbed: false,
};

const mapReutersPayload = (payload = {}) =>
  (Array.isArray(payload?.stories) ? payload.stories : []).map((entry) => ({
    sourceSlug: "reuters",
    externalId: entry?.id || entry?.externalId || "",
    title: entry?.title || "",
    subtitle: entry?.subtitle || entry?.deck || "",
    bodyHtml: entry?.bodyHtml || "",
    summaryText: entry?.summaryText || entry?.summary || entry?.description || "",
    canonicalUrl: entry?.canonicalUrl || entry?.url || "",
    publishedAt: entry?.publishedAt || entry?.firstPublishedAt,
    updatedAt: entry?.updatedAt || entry?.updatedAtSource,
    authorByline: entry?.authorByline || entry?.author || "",
    language: entry?.language || "en",
    assets: entry?.assets || [],
    tags: entry?.tags || [],
    rights: { ...DEFAULT_RIGHTS, ...(entry?.rights || {}) },
    raw: entry,
  }));

module.exports = createJsonIngestService({
  providerName: "reuters",
  envBaseKey: "NEWS_REUTERS_BASE_URL",
  envApiKey: "NEWS_REUTERS_API_KEY",
  envApiSecret: "NEWS_REUTERS_API_SECRET",
  defaultRights: DEFAULT_RIGHTS,
  mapResponse: mapReutersPayload,
});
