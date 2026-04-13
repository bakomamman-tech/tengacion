const DAY_MS = 24 * 60 * 60 * 1000;

const getIntEnv = (key, fallback) => {
  const parsed = Number.parseInt(process.env[key] || "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const truncate = (value = "", maxLength = 0) =>
  String(value ?? "")
    .trim()
    .slice(0, Math.max(0, Number(maxLength) || 0));

const limitArray = (value = [], maxLength = 0) =>
  Array.isArray(value) ? value.slice(0, Math.max(0, Number(maxLength) || 0)) : [];

const sanitizeValue = (raw, options, depth) => {
  const { maxStringLength = 500 } = options || {};

  if (raw === undefined) {
    return undefined;
  }

  if (raw === null) {
    return null;
  }

  if (typeof raw === "string") {
    return truncate(raw, maxStringLength);
  }

  if (typeof raw === "number" || typeof raw === "boolean") {
    return raw;
  }

  if (raw instanceof Date) {
    return raw.toISOString();
  }

  if (Array.isArray(raw) || (raw && typeof raw === "object")) {
    return sanitizePlainObject(raw, options, depth + 1);
  }

  return undefined;
};

const sanitizePlainObject = (
  value,
  {
    maxDepth = 2,
    maxKeys = 20,
    maxStringLength = 500,
    maxArrayLength = 10,
  } = {},
  depth = 0
) => {
  if (!value || typeof value !== "object") {
    return {};
  }

  if (depth >= maxDepth) {
    return {};
  }

  const nextOptions = { maxDepth, maxKeys, maxStringLength, maxArrayLength };

  const entries = Array.isArray(value)
    ? limitArray(value, maxArrayLength).map((entry) => sanitizeValue(entry, nextOptions, depth))
    : Object.entries(value)
        .slice(0, Math.max(0, Number(maxKeys) || 0))
        .reduce((acc, [key, raw]) => {
          const sanitized = sanitizeValue(raw, nextOptions, depth);
          if (sanitized !== undefined) {
            acc[key] = sanitized;
          }

          return acc;
        }, {});

  return entries;
};

const buildExpiryDate = ({ createdAt = new Date(), retentionDays = 0 } = {}) => {
  const baseDate = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const safeBase = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;
  return new Date(safeBase.getTime() + Math.max(0, Number(retentionDays) || 0) * DAY_MS);
};

const estimateSerializedSize = (value) => {
  try {
    return Buffer.byteLength(JSON.stringify(value ?? {}), "utf8");
  } catch {
    return 0;
  }
};

const storageConfig = {
  notificationReadRetentionDays: getIntEnv("NOTIFICATION_READ_RETENTION_DAYS", 90),
  notificationUnreadRetentionDays: getIntEnv("NOTIFICATION_UNREAD_RETENTION_DAYS", 365),
  auditLogRetentionDays: getIntEnv("AUDIT_LOG_RETENTION_DAYS", 365),
  analyticsEventRetentionDays: getIntEnv("ANALYTICS_EVENT_RETENTION_DAYS", 365),
  moderationDecisionRetentionDays: getIntEnv("MODERATION_DECISION_LOG_RETENTION_DAYS", 365),
  recommendationLogRetentionDays: getIntEnv("RECOMMENDATION_LOG_RETENTION_DAYS", 30),
  newsFeedImpressionRetentionDays: getIntEnv("NEWS_FEED_IMPRESSION_RETENTION_DAYS", 90),
  newsIngestionJobRetentionDays: getIntEnv("NEWS_INGESTION_JOB_RETENTION_DAYS", 30),
  tempUploadRetentionDays: getIntEnv("TEMP_UPLOAD_RETENTION_DAYS", 14),
  orphanMediaRetentionDays: getIntEnv("ORPHAN_MEDIA_RETENTION_DAYS", 30),
  assistantMemoryRetentionDays: getIntEnv("ASSISTANT_MEMORY_RETENTION_DAYS", 30),
  assistantFeedbackRetentionDays: getIntEnv("ASSISTANT_FEEDBACK_RETENTION_DAYS", 90),
  messageAttachmentLimit: getIntEnv("MESSAGE_ATTACHMENT_LIMIT", 5),
  messageMetadataMaxBytes: getIntEnv("MESSAGE_METADATA_MAX_BYTES", 4096),
  analyticsMetadataMaxBytes: getIntEnv("ANALYTICS_METADATA_MAX_BYTES", 8192),
  auditMetadataMaxBytes: getIntEnv("AUDIT_METADATA_MAX_BYTES", 4096),
  cleanupBatchSize: getIntEnv("STORAGE_CLEANUP_BATCH_SIZE", 2500),
};

module.exports = {
  DAY_MS,
  ...storageConfig,
  buildExpiryDate,
  estimateSerializedSize,
  limitArray,
  sanitizePlainObject,
  sanitizeValue,
  truncate,
};
