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

const mapApPayload = (payload = {}) =>
  (Array.isArray(payload?.items) ? payload.items : []).map((entry) => ({
    sourceSlug: "ap",
    externalId: entry?.id || "",
    title: entry?.headline || entry?.title || "",
    subtitle: entry?.subtitle || entry?.subheadline || "",
    bodyHtml: entry?.bodyHtml || "",
    summaryText: entry?.summary || entry?.description || "",
    canonicalUrl: entry?.link || entry?.canonicalUrl || "",
    publishedAt: entry?.publishedAt || entry?.updated,
    updatedAt: entry?.updatedAt || entry?.updated,
    authorByline: entry?.byline || entry?.author || "",
    language: entry?.language || "en",
    assets: entry?.assets || [],
    tags: entry?.tags || entry?.keywords || [],
    rights: { ...DEFAULT_RIGHTS, ...(entry?.rights || {}) },
    raw: entry,
  }));

module.exports = createJsonIngestService({
  providerName: "ap",
  envBaseKey: "NEWS_AP_BASE_URL",
  envApiKey: "NEWS_AP_API_KEY",
  envApiSecret: "NEWS_AP_API_SECRET",
  defaultRights: DEFAULT_RIGHTS,
  mapResponse: mapApPayload,
});
