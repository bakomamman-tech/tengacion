const AuditLog = require("../models/AuditLog");

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
    metadata: metadata && typeof metadata === "object" ? metadata : {},
    ip: req?.ip || req?.headers?.["x-forwarded-for"] || "",
    userAgent: String(req?.headers?.["user-agent"] || "").slice(0, 400),
  });
};

module.exports = {
  writeAuditLog,
};
