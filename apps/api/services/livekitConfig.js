const { config } = require("../../../backend/config/env");
const ApiError = require("../utils/ApiError");

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const toText = (value) => (typeof value === "string" ? value.trim() : "");

const normalizeWsUrl = (rawValue) => {
  const cleaned = toText(rawValue);
  if (!cleaned) {
    return "";
  }

  const withProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(cleaned)
    ? cleaned
    : `wss://${cleaned}`;

  let parsed;
  try {
    parsed = new URL(withProtocol);
  } catch {
    return "";
  }

  if (!parsed.hostname) {
    return "";
  }

  if (parsed.protocol === "http:") {
    parsed.protocol = "ws:";
  } else if (parsed.protocol === "https:") {
    parsed.protocol = "wss:";
  }

  if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
    return "";
  }

  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  return parsed.toString().replace(/\/$/, "");
};

const normalizeHost = (rawValue) => {
  const cleaned = toText(rawValue);
  if (!cleaned) {
    return "";
  }
  const withProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(cleaned)
    ? cleaned
    : `https://${cleaned}`;
  try {
    const parsed = new URL(withProtocol);
    if (!parsed.hostname) {
      return "";
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
};

const buildLivekitConfig = () => {
  const isProduction = config.NODE_ENV === "production";
  const rawWsUrl = toText(config.LIVEKIT_WS_URL);
  const rawHost = toText(config.LIVEKIT_HOST);

  const wsFromWsUrl = normalizeWsUrl(rawWsUrl);
  const wsFromHost = normalizeWsUrl(rawHost);
  const wsUrl = wsFromWsUrl || wsFromHost;
  const host = normalizeHost(rawHost) || normalizeHost(rawWsUrl);

  return {
    host,
    wsUrl,
    rawWsUrl,
    rawHost,
    isProduction,
  };
};

const ensureValidLivekitConfig = () => {
  const current = buildLivekitConfig();
  const issues = [];

  if (!current.rawWsUrl && !current.rawHost) {
    issues.push(
      "Neither LIVEKIT_WS_URL nor LIVEKIT_HOST is set. Configure LIVEKIT_WS_URL explicitly."
    );
  }

  if (!current.wsUrl) {
    issues.push(
      "Unable to parse LiveKit URL. Check LIVEKIT_WS_URL/LIVEKIT_HOST for typos or extra spaces."
    );
  }

  if (current.wsUrl) {
    let parsedWsUrl;
    try {
      parsedWsUrl = new URL(current.wsUrl);
    } catch {
      parsedWsUrl = null;
    }

    if (!parsedWsUrl) {
      issues.push("LiveKit wsUrl is invalid.");
    } else if (current.isProduction) {
      if (parsedWsUrl.protocol !== "wss:") {
        issues.push("Production requires LiveKit wsUrl to use wss://.");
      }
      if (LOCAL_HOSTS.has(parsedWsUrl.hostname.toLowerCase())) {
        issues.push("Production LiveKit wsUrl cannot target localhost.");
      }
    }
  }

  if (issues.length > 0) {
    throw ApiError.serviceUnavailable(
      `LiveKit configuration invalid: ${issues.join(" ")}`
    );
  }

  return {
    host: current.host,
    wsUrl: current.wsUrl,
  };
};

module.exports = {
  buildLivekitConfig,
  ensureValidLivekitConfig,
};
