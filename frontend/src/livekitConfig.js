const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const readText = (value) => (typeof value === "string" ? value.trim() : "");

const hasScheme = (value) => /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value);

const normalizeWsUrl = (input) => {
  const raw = readText(input);
  if (!raw) {
    return "";
  }

  const candidate = hasScheme(raw) ? raw : `wss://${raw}`;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return "";
  }

  if (parsed.protocol === "https:") {
    parsed.protocol = "wss:";
  } else if (parsed.protocol === "http:") {
    parsed.protocol = "ws:";
  }

  if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
    return "";
  }

  if (!parsed.hostname) {
    return "";
  }

  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  return parsed.toString().replace(/\/$/, "");
};

export const resolveLivekitWsUrl = ({ livekitConfig, fallbackLivekit, context }) => {
  const rawCandidate =
    readText(livekitConfig?.wsUrl) ||
    readText(livekitConfig?.host) ||
    readText(fallbackLivekit?.wsUrl) ||
    readText(fallbackLivekit?.host) ||
    readText(fallbackLivekit?.url);

  if (!rawCandidate) {
    throw new Error(
      "LiveKit wsUrl is missing. Configure backend LIVEKIT_WS_URL (preferred) or LIVEKIT_HOST."
    );
  }

  const normalized = normalizeWsUrl(rawCandidate);
  if (!normalized) {
    throw new Error(
      `LiveKit wsUrl is invalid: "${rawCandidate}". Use a valid ws:// or wss:// URL.`
    );
  }

  const isProduction = Boolean(
    (typeof import.meta !== "undefined" && import.meta?.env?.PROD) ||
      (typeof process !== "undefined" && process.env?.NODE_ENV === "production")
  );
  const parsed = new URL(normalized);
  if (isProduction) {
    if (parsed.protocol !== "wss:") {
      throw new Error(
        `Invalid production LiveKit wsUrl protocol: "${normalized}". Production requires wss://.`
      );
    }
    if (LOCAL_HOSTS.has(parsed.hostname.toLowerCase())) {
      throw new Error(
        `Invalid production LiveKit wsUrl host: "${parsed.hostname}". Localhost is not allowed in production.`
      );
    }
  }

  console.warn(`[LiveKit] ${context} wsUrl: ${normalized}`);
  return normalized;
};
