const { createJsonIngestService } = require("./baseIngestService");

const DEFAULT_RIGHTS = {
  mode: "THUMBNAIL_LINKOUT",
  attributionRequired: true,
  canonicalLinkRequired: true,
  allowBodyHtml: false,
  allowSummary: true,
  allowThumbnail: true,
  allowEmbed: false,
};

const mapGdeltPayload = (payload = {}) =>
  (Array.isArray(payload?.articles) ? payload.articles : []).map((entry) => ({
    sourceSlug: "gdelt",
    externalId: entry?.url || entry?.id || "",
    title: entry?.title || "",
    subtitle: entry?.seendate || "",
    bodyHtml: "",
    summaryText: entry?.socialimage || entry?.domain || entry?.title || "",
    canonicalUrl: entry?.url || "",
    publishedAt: entry?.seendate || entry?.publishedAt,
    updatedAt: entry?.seendate || entry?.updatedAt,
    authorByline: "",
    language: entry?.language || "en",
    assets: entry?.socialimage
      ? [
          {
            assetType: "image",
            role: "thumbnail",
            url: entry.socialimage,
            secureUrl: entry.socialimage,
            altText: entry?.title || "",
          },
        ]
      : [],
    tags: entry?.themes || entry?.keywords || [],
    rights: { ...DEFAULT_RIGHTS, ...(entry?.rights || {}) },
    raw: entry,
  }));

module.exports = createJsonIngestService({
  providerName: "gdelt",
  envBaseKey: "NEWS_GDELT_BASE_URL",
  envApiKey: "NEWS_GDELT_API_KEY",
  envApiSecret: "NEWS_GDELT_API_SECRET",
  defaultRights: DEFAULT_RIGHTS,
  mapResponse: mapGdeltPayload,
});
