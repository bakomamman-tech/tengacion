const defaultLogger = require("../utils/logger");

const STATIC_PATH_PATTERN =
  /\.(?:css|js|mjs|map|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|eot|mp4|webm|mp3|wav|pdf)$/i;
const SUCCESSFUL_HEALTH_PATHS = new Set(["/api/health", "/api/health/live"]);

const normalizePath = (originalUrl = "") => {
  const raw = String(originalUrl || "").trim() || "/";
  try {
    return new URL(raw, "http://tengacion.local").pathname || "/";
  } catch {
    return raw.split("?")[0] || "/";
  }
};

const truncate = (value = "", maxLength = 180) => {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
};

const getQueryKeys = (originalUrl = "") => {
  try {
    const parsed = new URL(String(originalUrl || "/"), "http://tengacion.local");
    return Array.from(parsed.searchParams.keys()).slice(0, 20);
  } catch {
    return [];
  }
};

const shouldSkipSuccessfulRequest = ({ path = "", statusCode = 200 } = {}) => {
  if (Number(statusCode) >= 400) {
    return false;
  }

  if (SUCCESSFUL_HEALTH_PATHS.has(path)) {
    return true;
  }

  return path.startsWith("/assets/") || STATIC_PATH_PATTERN.test(path);
};

const getLogLevel = (statusCode) => {
  const status = Number(statusCode || 0);
  if (status >= 500) return "error";
  if (status >= 400) return "warn";
  return "info";
};

const requestLogger = ({
  logger = defaultLogger,
  enabled = process.env.NODE_ENV !== "test",
} = {}) => (req, res, next) => {
  if (!enabled) {
    return next();
  }

  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const path = normalizePath(req.originalUrl || req.url);
    const statusCode = Number(res.statusCode || 0);

    if (shouldSkipSuccessfulRequest({ path, statusCode })) {
      return;
    }

    const durationMs = Number((process.hrtime.bigint() - startedAt) / 1000000n);
    const level = getLogLevel(statusCode);
    const contentLength = Number(res.getHeader("content-length") || 0) || undefined;
    const userId = req.user?.id || req.user?._id || req.userId || "";
    const meta = {
      requestId: req.requestId || res.locals?.requestId || req.id || "",
      method: req.method,
      path,
      statusCode,
      durationMs,
      contentLength,
      userId: userId ? String(userId) : undefined,
      ip: req.ip || req.socket?.remoteAddress || "",
      userAgent: truncate(req.get?.("user-agent") || ""),
      queryKeys: getQueryKeys(req.originalUrl || req.url),
    };

    logger[level]?.("http.request.completed", meta);
  });

  next();
};

module.exports = {
  getLogLevel,
  normalizePath,
  requestLogger,
  shouldSkipSuccessfulRequest,
};
