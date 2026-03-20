const { normalizeProviderStory, normalizeUrl } = require("../newsNormalizeService");

const safeJson = async (response) => {
  const contentType = response.headers.get("content-type") || "";
  const raw = await response.text();
  if (!raw) {
    return {};
  }
  if (contentType.includes("application/json")) {
    return JSON.parse(raw);
  }
  return raw;
};

const buildHeaders = ({ apiKey = "", apiSecret = "", extraHeaders = {} } = {}) => {
  const headers = {
    Accept: "application/json",
    ...extraHeaders,
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  if (apiSecret) {
    headers["X-Api-Secret"] = apiSecret;
  }

  return headers;
};

const normalizeOutput = (items = [], context = {}) =>
  (Array.isArray(items) ? items : []).map((entry) =>
    normalizeProviderStory(entry, { sourceSlug: context?.sourceSlug || "" })
  );

const createJsonIngestService = ({
  providerName,
  envBaseKey,
  envApiKey,
  envApiSecret,
  defaultRights,
  mapResponse,
}) => {
  const fetchStories = async ({
    source = {},
    limit = 20,
    fetchImpl = global.fetch,
    mockStories = null,
  } = {}) => {
    if (Array.isArray(mockStories)) {
      return normalizeOutput(mockStories, { sourceSlug: source?.slug || providerName });
    }

    const sourceMockStories = source?.ingest?.config?.mockStories;
    if (Array.isArray(sourceMockStories) && sourceMockStories.length) {
      return normalizeOutput(sourceMockStories, {
        sourceSlug: source?.slug || providerName,
      });
    }

    const baseUrl = String(
      source?.ingest?.apiBaseUrl || process.env[envBaseKey] || ""
    ).trim();
    if (!baseUrl || typeof fetchImpl !== "function") {
      return [];
    }

    const requestUrl = new URL(normalizeUrl(baseUrl));
    requestUrl.searchParams.set("limit", String(Math.max(1, Number(limit) || 20)));
    const apiKey = String(source?.ingest?.config?.apiKey || process.env[envApiKey] || "").trim();
    const apiSecret = String(
      source?.ingest?.config?.apiSecret || process.env[envApiSecret] || ""
    ).trim();
    const response = await fetchImpl(requestUrl, {
      method: "GET",
      headers: buildHeaders({ apiKey, apiSecret }),
    });
    if (!response.ok) {
      throw new Error(`${providerName} ingest failed with status ${response.status}`);
    }
    const payload = await safeJson(response);
    const rawItems = mapResponse(payload, { source, limit, defaultRights });
    return normalizeOutput(rawItems, {
      sourceSlug: source?.slug || providerName,
    }).map((entry) => ({
      ...entry,
      rights: {
        ...(defaultRights || {}),
        ...(entry?.rights || {}),
      },
    }));
  };

  return { providerName, fetchStories };
};

module.exports = {
  createJsonIngestService,
};
