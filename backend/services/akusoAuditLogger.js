const { sanitizePlainObject } = require("../config/storage");
const { config } = require("../config/env");
const { writeAuditLog } = require("./auditLogService");
const logger = require("../utils/logger");

const safeText = (value = "", max = 200) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const buildSafeMeta = (metadata = {}) =>
  sanitizePlainObject(metadata, {
    maxDepth: 2,
    maxKeys: 16,
    maxStringLength: 240,
    maxArrayLength: 8,
  });

const logAkusoEvent = async ({
  level = "info",
  event = "event",
  traceId = "",
  req = null,
  userId = "",
  conversationId = "",
  metadata = {},
  persist = false,
} = {}) => {
  const safeMetadata = buildSafeMeta(metadata);
  logger[level === "error" ? "error" : level === "warn" ? "warn" : "info"](
    `akuso.${safeText(event, 80)}`,
    {
      traceId: safeText(traceId, 80),
      conversationId: safeText(conversationId, 80),
      userId: safeText(userId, 80),
      path: safeText(req?.originalUrl || req?.path || "", 160),
      method: safeText(req?.method || "", 12),
      ...safeMetadata,
    }
  );

  if (!persist || !config.akuso?.enableAuditLogs || !userId) {
    return null;
  }

  return writeAuditLog({
    req,
    actorId: userId,
    action: `akuso.${safeText(event, 80)}`,
    targetType: "Akuso",
    targetId: safeText(conversationId || traceId, 120),
    reason: safeText(metadata?.reason || event, 240),
    metadata: safeMetadata,
  }).catch(() => null);
};

const logPolicyDecision = (payload = {}) =>
  logAkusoEvent({
    ...payload,
    persist:
      payload.persist ??
      (payload.level === "warn" || payload.level === "error"),
  });

const logPromptInjection = ({ traceId, req, userId, metadata = {} } = {}) =>
  logPolicyDecision({
    level: "warn",
    event: "prompt_injection",
    traceId,
    req,
    userId,
    metadata: {
      reason: "Prompt injection attempt blocked.",
      ...metadata,
    },
    persist: true,
  });

const logOpenAIFailure = ({ traceId, req, userId, metadata = {} } = {}) =>
  logPolicyDecision({
    level: "warn",
    event: "openai_failure",
    traceId,
    req,
    userId,
    metadata: {
      reason: "OpenAI request failed; local fallback used.",
      ...metadata,
    },
  });

const logRateLimitHit = ({ traceId, req, userId, metadata = {} } = {}) =>
  logPolicyDecision({
    level: "warn",
    event: "rate_limit",
    traceId,
    req,
    userId,
    metadata: {
      reason: "Akuso rate limit reached.",
      ...metadata,
    },
    persist: true,
  });

module.exports = {
  logAkusoEvent,
  logOpenAIFailure,
  logPolicyDecision,
  logPromptInjection,
  logRateLimitHit,
};
