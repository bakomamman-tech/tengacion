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

const mapGuardianPayload = (payload = {}) => {
  const rows = Array.isArray(payload?.response?.results) ? payload.response.results : [];
  return rows.map((entry) => ({
    sourceSlug: "guardian",
    externalId: entry?.id || entry?.apiUrl || "",
    title: entry?.webTitle || entry?.title || "",
    subtitle: entry?.fields?.trailText || "",
    bodyHtml: entry?.fields?.body || "",
    summaryText: entry?.fields?.standfirst || entry?.fields?.trailText || "",
    canonicalUrl: entry?.webUrl || entry?.canonicalUrl || "",
    publishedAt: entry?.webPublicationDate || entry?.publishedAt,
    updatedAt: entry?.fields?.lastModified || entry?.updatedAt,
    authorByline: entry?.fields?.byline || "",
    language: entry?.fields?.lang || "en",
    assets: entry?.fields?.thumbnail
      ? [
          {
            assetType: "image",
            role: "thumbnail",
            url: entry.fields.thumbnail,
            secureUrl: entry.fields.thumbnail,
            altText: entry?.webTitle || "",
          },
        ]
      : [],
    tags:
      entry?.sectionName || Array.isArray(entry?.tags)
        ? [entry.sectionName, ...(entry.tags || [])]
        : [],
    rights: { ...DEFAULT_RIGHTS, ...(entry?.rights || {}) },
    raw: entry,
  }));
};

module.exports = createJsonIngestService({
  providerName: "guardian",
  envBaseKey: "NEWS_GUARDIAN_BASE_URL",
  envApiKey: "NEWS_GUARDIAN_API_KEY",
  envApiSecret: "NEWS_GUARDIAN_API_SECRET",
  defaultRights: DEFAULT_RIGHTS,
  mapResponse: mapGuardianPayload,
});
