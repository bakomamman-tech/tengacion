const { URL } = require("url");

const {
  normalizeKnowledgeText,
} = require("./knowledgeChunkingService");
const {
  syncKnowledgeSource,
} = require("./knowledgeIngestionService");
const {
  findOwnerWorkspace,
} = require("./ownerWorkspaceService");
const {
  htmlToKnowledgeText,
} = require("./websiteKnowledgeService");

const MAX_WEBSITE_BYTES = 1500000;
const DEFAULT_TIMEOUT_MS = 12000;

const normalizeHost = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");

const isPrivateOrLocalHost = (value) => {
  const host = normalizeHost(value);

  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  ) {
    return true;
  }

  if (host.includes(":")) {
    if (
      host === "::" ||
      host === "::1" ||
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      /^fe[89ab]/.test(host)
    ) {
      return true;
    }

    if (host.startsWith("::ffff:")) {
      return isPrivateOrLocalHost(
        host.slice("::ffff:".length)
      );
    }

    return false;
  }

  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
    return false;
  }

  const octets = host.split(".").map(Number);

  if (
    octets.some(
      (valuePart) =>
        !Number.isInteger(valuePart) ||
        valuePart < 0 ||
        valuePart > 255
    )
  ) {
    return true;
  }

  const [a, b] = octets;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
};

const assertPublicWebsiteHost = (hostname) => {
  if (isPrivateOrLocalHost(hostname)) {
    throw new Error(
      "Website knowledge cannot target local or private network addresses."
    );
  }
};

const allowedOwnerHosts = (website) => {
  let parsed;

  try {
    parsed = new URL(String(website || ""));
  } catch (_error) {
    throw new Error(
      "Add a valid HTTPS business website to your TengaAgent workspace first."
    );
  }

  if (parsed.protocol !== "https:") {
    throw new Error(
      "Business website must use HTTPS before website knowledge can be imported."
    );
  }

  const host = normalizeHost(parsed.hostname);
  assertPublicWebsiteHost(host);

  const hosts = new Set([host]);

  if (host.startsWith("www.")) {
    hosts.add(host.slice(4));
  } else {
    hosts.add(`www.${host}`);
  }

  return hosts;
};

const validateOwnerWebsiteUrl = ({
  value,
  website,
}) => {
  let parsed;

  try {
    parsed = new URL(String(value || ""));
  } catch (_error) {
    throw new Error("Invalid website knowledge URL.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Website knowledge URL must use HTTPS.");
  }

  if (parsed.username || parsed.password) {
    throw new Error(
      "Website knowledge URL cannot contain credentials."
    );
  }

  const targetHost = normalizeHost(parsed.hostname);
  assertPublicWebsiteHost(targetHost);

  if (!allowedOwnerHosts(website).has(targetHost)) {
    throw new Error(
      "Website knowledge URL must match the business website hostname."
    );
  }

  parsed.hash = "";
  return parsed;
};

const fetchOwnerWebsiteText = async ({
  url,
  website,
  fetchImpl = global.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxRedirects = 3,
}) => {
  if (typeof fetchImpl !== "function") {
    throw new Error(
      "Website fetch implementation is unavailable."
    );
  }

  const originalUrl = validateOwnerWebsiteUrl({
    value: url,
    website,
  }).toString();

  let currentUrl = originalUrl;

  for (
    let redirectCount = 0;
    redirectCount <= maxRedirects;
    redirectCount += 1
  ) {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      timeoutMs
    );

    let response;

    try {
      response = await fetchImpl(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "text/html,text/plain;q=0.9",
          "User-Agent":
            "TengaAgentKnowledgeBot/1.0 (+https://tengacion.com)",
        },
      });
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers?.get?.("location");

      if (!location) {
        throw new Error(
          "Website redirect did not provide a location."
        );
      }

      currentUrl = validateOwnerWebsiteUrl({
        value: new URL(location, currentUrl).toString(),
        website,
      }).toString();
      continue;
    }

    if (!response.ok) {
      throw new Error(
        `Website request failed with HTTP ${response.status}.`
      );
    }

    const contentType = String(
      response.headers?.get?.("content-type") || ""
    ).toLowerCase();

    if (
      contentType &&
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain")
    ) {
      throw new Error(
        "Website response was not HTML or plain text."
      );
    }

    const contentLength = Number(
      response.headers?.get?.("content-length")
    );

    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_WEBSITE_BYTES
    ) {
      throw new Error("Website response is too large.");
    }

    const body = await response.text();

    if (
      Buffer.byteLength(body, "utf8") > MAX_WEBSITE_BYTES
    ) {
      throw new Error("Website response is too large.");
    }

    const text = contentType.includes("text/plain")
      ? normalizeKnowledgeText(body)
      : htmlToKnowledgeText(body);

    if (text.length < 40) {
      throw new Error(
        "Website did not contain enough readable knowledge."
      );
    }

    return {
      requestedUrl: originalUrl,
      finalUrl: currentUrl,
      text,
    };
  }

  throw new Error(
    "Website exceeded the allowed redirect limit."
  );
};

const syncOwnerWebsiteKnowledge = async ({
  userId,
  url,
  title,
  fetchImpl,
  embedder,
}) => {
  const workspace = await findOwnerWorkspace(userId);

  if (!workspace) {
    throw new Error(
      "Create your TengaAgent workspace first."
    );
  }

  const website = workspace.organization.website;

  if (!website) {
    throw new Error(
      "Add your business website to the workspace before importing website knowledge."
    );
  }

  const result = await fetchOwnerWebsiteText({
    url: url || website,
    website,
    ...(fetchImpl ? { fetchImpl } : {}),
  });

  const synced = await syncKnowledgeSource({
    organizationId: workspace.organization._id,
    agentId: null,
    type: "website",
    title:
      String(title || "Business website").trim().slice(0, 240) ||
      "Business website",
    text: result.text,
    sourceUrl: result.finalUrl,
    metadata: {
      sourceKind: "owner-website",
      createdByUser: String(userId),
      requestedUrl: result.requestedUrl,
    },
    ...(embedder ? { embedder } : {}),
  });

  return {
    ...workspace,
    source: synced.source,
    chunksCreated: synced.chunksCreated,
    unchanged: Boolean(synced.unchanged),
  };
};

module.exports = {
  allowedOwnerHosts,
  fetchOwnerWebsiteText,
  isPrivateOrLocalHost,
  syncOwnerWebsiteKnowledge,
  validateOwnerWebsiteUrl,
};
