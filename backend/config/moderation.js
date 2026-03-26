const MODERATION_PERMISSIONS = [
  "view_moderation_queue",
  "review_quarantined_media",
  "review_restricted_gore",
  "review_animal_cruelty_cases",
  "review_suspected_child_exploitation_cases",
  "approve_safe_content",
  "reject_prohibited_content",
  "suspend_user_accounts",
  "ban_user_accounts",
  "preserve_evidence",
  "view_audit_logs",
];

const MODERATION_STATUSES = [
  "ALLOW",
  "HOLD_FOR_REVIEW",
  "RESTRICTED_BLURRED",
  "BLOCK_EXPLICIT_ADULT",
  "BLOCK_SUSPECTED_CHILD_EXPLOITATION",
  "BLOCK_EXTREME_GORE",
  "BLOCK_ANIMAL_CRUELTY",
  "BLOCK_REPEAT_VIOLATOR",
];

const MODERATION_QUEUES = [
  "suspected_child_exploitation",
  "explicit_pornography",
  "graphic_gore",
  "animal_cruelty",
  "user_reported_sensitive_content",
];

const MODERATION_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const MODERATION_WORKFLOW_STATES = ["OPEN", "UNDER_REVIEW", "RESOLVED", "ESCALATED"];

const readThreshold = (envKey, fallback) => {
  const parsed = Number(process.env[envKey]);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, parsed));
};

const MODERATION_PROVIDER = String(process.env.MODERATION_PROVIDER || "internal_heuristics").trim();
const MODERATION_ENABLED = String(process.env.MODERATION_ENABLED || "true").toLowerCase() !== "false";
const EXPLICIT_BLOCK_THRESHOLD = readThreshold("MODERATION_EXPLICIT_BLOCK_THRESHOLD", 0.92);
const CSAM_CRITICAL_THRESHOLD = readThreshold("MODERATION_CSAM_BLOCK_THRESHOLD", 0.98);
const GORE_BLOCK_THRESHOLD = readThreshold("MODERATION_GORE_BLOCK_THRESHOLD", 0.88);
const GORE_RESTRICT_THRESHOLD = readThreshold("MODERATION_GORE_RESTRICT_THRESHOLD", 0.64);
const ANIMAL_CRUELTY_BLOCK_THRESHOLD = readThreshold("MODERATION_ANIMAL_CRUELTY_BLOCK_THRESHOLD", 0.86);
const REVIEW_THRESHOLD = readThreshold("MODERATION_REVIEW_THRESHOLD", 0.45);
const MAX_REUPLOAD_SIMILARITY = readThreshold("MODERATION_MAX_REUPLOAD_SIMILARITY", 0.9);
const CRITICAL_QUEUE_PRIORITY = Number(process.env.MODERATION_CRITICAL_QUEUE_PRIORITY || 90);
const MODERATION_QUARANTINE_BUCKET = String(
  process.env.MODERATION_QUARANTINE_BUCKET || "tengacion-moderation-quarantine"
).trim();
const MODERATION_PRIVATE_MEDIA_PREFIX = String(
  process.env.MODERATION_PRIVATE_MEDIA_PREFIX || "moderation/private"
).trim();
const MODERATION_BLUR_DERIVATIVE_PREFIX = String(
  process.env.MODERATION_BLUR_DERIVATIVE_PREFIX || "moderation/blurred"
).trim();

const PRIMARY_MODERATION_ADMIN_NAME = String(
  process.env.MODERATION_ADMIN_NAME || "Admin@tengacion"
).trim();
const PRIMARY_MODERATION_ADMIN_EMAIL = String(
  process.env.MODERATION_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "admin@tengacion.com"
)
  .trim()
  .toLowerCase();
const PRIMARY_MODERATION_ADMIN_USERNAME_CANDIDATES = [
  "admin",
  "admintengacion",
  "admin.tengacion",
  "admin_tengacion",
];

const DEFAULT_ROLE_PERMISSIONS = {
  user: [],
  artist: [],
  moderator: [
    "view_moderation_queue",
    "review_quarantined_media",
    "review_restricted_gore",
    "review_animal_cruelty_cases",
    "approve_safe_content",
    "reject_prohibited_content",
  ],
  admin: [],
  trust_safety_admin: MODERATION_PERMISSIONS,
  super_admin: MODERATION_PERMISSIONS,
};

const QUEUE_REVIEW_PERMISSION_MAP = {
  suspected_child_exploitation: [
    "review_quarantined_media",
    "review_suspected_child_exploitation_cases",
  ],
  explicit_pornography: ["review_quarantined_media"],
  graphic_gore: ["review_restricted_gore"],
  animal_cruelty: ["review_animal_cruelty_cases"],
  user_reported_sensitive_content: [],
};

const ACTION_PERMISSION_MAP = {
  approve: ["approve_safe_content"],
  reject: ["reject_prohibited_content"],
  restrict_with_warning: ["approve_safe_content"],
  blur_preview: ["approve_safe_content"],
  suspend_user: ["suspend_user_accounts"],
  ban_user: ["ban_user_accounts"],
  preserve_evidence: ["preserve_evidence"],
  escalate_case: ["review_quarantined_media"],
};

const BLOCKED_PUBLIC_STATUSES = new Set([
  "HOLD_FOR_REVIEW",
  "BLOCK_EXPLICIT_ADULT",
  "BLOCK_SUSPECTED_CHILD_EXPLOITATION",
  "BLOCK_EXTREME_GORE",
  "BLOCK_ANIMAL_CRUELTY",
  "BLOCK_REPEAT_VIOLATOR",
]);

const RESTRICTED_PUBLIC_STATUSES = new Set(["RESTRICTED_BLURRED"]);
const CRITICAL_QUEUE_SET = new Set([
  "suspected_child_exploitation",
  "explicit_pornography",
]);
const CRITICAL_STATUS_SET = new Set([
  "BLOCK_SUSPECTED_CHILD_EXPLOITATION",
  "BLOCK_EXPLICIT_ADULT",
]);

module.exports = {
  ACTION_PERMISSION_MAP,
  ANIMAL_CRUELTY_BLOCK_THRESHOLD,
  BLOCKED_PUBLIC_STATUSES,
  CRITICAL_QUEUE_PRIORITY,
  CRITICAL_QUEUE_SET,
  CRITICAL_STATUS_SET,
  CSAM_CRITICAL_THRESHOLD,
  DEFAULT_ROLE_PERMISSIONS,
  EXPLICIT_BLOCK_THRESHOLD,
  GORE_BLOCK_THRESHOLD,
  GORE_RESTRICT_THRESHOLD,
  MAX_REUPLOAD_SIMILARITY,
  MODERATION_BLUR_DERIVATIVE_PREFIX,
  MODERATION_ENABLED,
  MODERATION_PRIVATE_MEDIA_PREFIX,
  MODERATION_PROVIDER,
  MODERATION_PERMISSIONS,
  MODERATION_QUEUES,
  MODERATION_QUARANTINE_BUCKET,
  MODERATION_SEVERITIES,
  MODERATION_STATUSES,
  MODERATION_WORKFLOW_STATES,
  PRIMARY_MODERATION_ADMIN_EMAIL,
  PRIMARY_MODERATION_ADMIN_NAME,
  PRIMARY_MODERATION_ADMIN_USERNAME_CANDIDATES,
  QUEUE_REVIEW_PERMISSION_MAP,
  RESTRICTED_PUBLIC_STATUSES,
  REVIEW_THRESHOLD,
};
