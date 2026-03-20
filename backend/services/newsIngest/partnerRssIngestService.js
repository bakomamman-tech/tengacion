const { normalizeProviderStory, normalizeWhitespace } = require("../newsNormalizeService");

const DEFAULT_RIGHTS = {
  mode: "SUMMARY_PLUS_LINKOUT",
  attributionRequired: true,
  canonicalLinkRequired: true,
  allowBodyHtml: false,
  allowSummary: true,
  allowThumbnail: true,
  allowEmbed: false,
};

const extractTagValue = (block = "", tag = "") => {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = String(block || "").match(regex);
  return match ? normalizeWhitespace(match[1]) : "";
};

const decodeXml = (value = "") =>
  String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const parseRssItems = (xml = "") => {
  const matches = String(xml || "").match(/<item\b[\s\S]*?<\/item>/gi) || [];
  return matches.map((item) => ({
    externalId: decodeXml(extractTagValue(item, "guid") || extractTagValue(item, "link")),
    title: decodeXml(extractTagValue(item, "title")),
    summaryText: decodeXml(extractTagValue(item, "description")),
    canonicalUrl: decodeXml(extractTagValue(item, "link")),
    publishedAt: decodeXml(extractTagValue(item, "pubDate")),
    authorByline: decodeXml(
      extractTagValue(item, "dc:creator") || extractTagValue(item, "author")
    ),
    raw: { xml: item },
  }));
};

const fetchStories = async ({
  source = {},
  fetchImpl = global.fetch,
  mockStories = null,
} = {}) => {
  if (Array.isArray(mockStories)) {
    return mockStories.map((entry) =>
      normalizeProviderStory(
        {
          ...entry,
          rights: { ...DEFAULT_RIGHTS, ...(entry?.rights || {}) },
        },
        { sourceSlug: source?.slug || "partner-rss" }
      )
    );
  }

  const sourceMockStories = source?.ingest?.config?.mockStories;
  if (Array.isArray(sourceMockStories) && sourceMockStories.length) {
    return sourceMockStories.map((entry) =>
      normalizeProviderStory(
        {
          ...entry,
          rights: { ...DEFAULT_RIGHTS, ...(entry?.rights || {}) },
        },
        { sourceSlug: source?.slug || "partner-rss" }
      )
    );
  }

  const rssUrl = String(source?.ingest?.rssUrl || process.env.NEWS_PARTNER_RSS_URL || "").trim();
  if (!rssUrl || typeof fetchImpl !== "function") {
    return [];
  }

  const response = await fetchImpl(rssUrl, {
    method: "GET",
    headers: { Accept: "application/rss+xml, application/xml, text/xml" },
  });
  if (!response.ok) {
    throw new Error(`partner rss ingest failed with status ${response.status}`);
  }

  const xml = await response.text();
  return parseRssItems(xml).map((entry) =>
    normalizeProviderStory(
      {
        ...entry,
        rights: { ...DEFAULT_RIGHTS, ...(entry?.rights || {}) },
      },
      { sourceSlug: source?.slug || "partner-rss" }
    )
  );
};

module.exports = {
  providerName: "partner_rss",
  fetchStories,
};
