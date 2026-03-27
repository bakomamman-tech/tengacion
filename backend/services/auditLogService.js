const AuditLog = require("../models/AuditLog");
const { sanitizePlainObject } = require("../config/storage");

const toReason = (value) => String(value || "").trim().slice(0, 500);

const writeAuditLog = async ({
  req,
  actorId,
  action,
  targetType = "",
  targetId = "",
  reason = "",
  metadata = {},
}) => {
  if (!actorId || !action) {
    return null;
  }

  return AuditLog.create({
    actorId,
    action: String(action).trim().slice(0, 120),
    targetType: String(targetType || "").trim().slice(0, 80),
    targetId: String(targetId || "").trim().slice(0, 120),
    reason: toReason(reason),
    metadata: metadata && typeof metadata === "object"
      ? sanitizePlainObject(metadata, {
          maxDepth: 2,
          maxKeys: 12,
          maxStringLength: 400,
          maxArrayLength: 6,
        })
      : {},
    ip: req?.ip || req?.headers?.["x-forwarded-for"] || "",
    userAgent: String(req?.headers?.["user-agent"] || "").slice(0, 400),
  });
};

module.exports = {
  writeAuditLog,
};
