const {
  BLOCKED_PUBLIC_STATUSES,
  RESTRICTED_PUBLIC_STATUSES,
} = require("../config/moderation");

const APPROVED_PUBLIC_STATUSES = new Set(["ALLOW", "approved"]);

const normalizeModerationStatus = (value = "") => String(value || "").trim();

const isHiddenFromPublicStatus = (value = "") =>
  BLOCKED_PUBLIC_STATUSES.has(normalizeModerationStatus(value));

const isRestrictedForPublicStatus = (value = "") =>
  RESTRICTED_PUBLIC_STATUSES.has(normalizeModerationStatus(value));

const resolvePublicSensitivity = ({
  moderationStatus = "",
  sensitiveContent = false,
  sensitiveType = "",
  queue = "",
} = {}) => {
  const normalizedStatus = normalizeModerationStatus(moderationStatus);
  const isBlocked = isHiddenFromPublicStatus(normalizedStatus);
  const isRestricted = isRestrictedForPublicStatus(normalizedStatus);
  const isApproved = APPROVED_PUBLIC_STATUSES.has(normalizedStatus);

  if (isApproved) {
    return {
      moderationStatus: normalizedStatus,
      sensitiveContent: false,
      sensitiveType: "",
    };
  }

  if (isBlocked || isRestricted) {
    return {
      moderationStatus: normalizedStatus,
      sensitiveContent: true,
      sensitiveType: String(queue || sensitiveType || ""),
    };
  }

  return {
    moderationStatus: normalizedStatus || "ALLOW",
    sensitiveContent: Boolean(sensitiveContent || sensitiveType),
    sensitiveType: String(sensitiveType || ""),
  };
};

module.exports = {
  APPROVED_PUBLIC_STATUSES,
  isHiddenFromPublicStatus,
  isRestrictedForPublicStatus,
  normalizeModerationStatus,
  resolvePublicSensitivity,
};
