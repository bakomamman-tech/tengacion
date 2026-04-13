const { writeAuditLog } = require("../../services/auditLogService");
const { logAnalyticsEvent } = require("../../services/analyticsService");
const { sanitizePlainObject } = require("../../config/storage");

const logAssistantEvent = async ({
  req,
  userId,
  action,
  category = "",
  severity = "info",
  conversationId = "",
  metadata = {},
} = {}) => {
  const safeMetadata = sanitizePlainObject(metadata || {}, {
    maxDepth: 2,
    maxKeys: 12,
    maxStringLength: 240,
    maxArrayLength: 6,
  });

  if (severity === "warn" || severity === "error" || category === "refusal" || category === "emergency" || category === "abuse") {
    await writeAuditLog({
      req,
      actorId: userId,
      action: `assistant:${String(action || "event").trim().slice(0, 80)}`,
      targetType: "assistant",
      targetId: conversationId,
      reason: String(category || action || "assistant event").slice(0, 240),
      metadata: safeMetadata,
    }).catch(() => null);
  }

  await logAnalyticsEvent({
    type: `assistant_${String(action || "event").trim().replace(/[^a-z0-9_]+/gi, "_").toLowerCase()}`,
    userId,
    targetId: conversationId || null,
    targetType: "assistant",
    contentType: String(category || "general").trim().toLowerCase(),
    metadata: safeMetadata,
  }).catch(() => null);
};

module.exports = {
  logAssistantEvent,
};
