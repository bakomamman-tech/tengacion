const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const auth = require("../middleware/auth");
const requireModerationPermission = require("../middleware/requireModerationPermission");
const moderationController = require("../controllers/moderationController");

const router = express.Router();

router.use(auth);

router.get(
  "/queue",
  requireModerationPermission(["view_moderation_queue"]),
  asyncHandler(moderationController.listQueue)
);

router.get(
  "/queue/:category",
  requireModerationPermission(["view_moderation_queue"]),
  asyncHandler(moderationController.listQueue)
);

router.get(
  "/cases/:id",
  requireModerationPermission(["view_moderation_queue"]),
  asyncHandler(moderationController.getCase)
);

router.post(
  "/cases/:id/review-url",
  requireModerationPermission(["view_moderation_queue"]),
  asyncHandler(moderationController.getReviewUrl)
);

router.post(
  "/cases/:id/actions",
  requireModerationPermission(["view_moderation_queue"]),
  asyncHandler(moderationController.applyAction)
);

[
  "approve",
  "reject",
  "restrict_with_warning",
  "blur_preview",
  "preserve_evidence",
  "escalate_case",
  "suspend_user",
  "ban_user",
].forEach((action) => {
  router.post(
    `/cases/:id/${action}`,
    requireModerationPermission(["view_moderation_queue"]),
    asyncHandler((req, res, next) => {
      req.params.action = action;
      return moderationController.applyAction(req, res, next);
    })
  );
});

[
  ["restrict", "restrict_with_warning"],
  ["preserve-evidence", "preserve_evidence"],
  ["escalate", "escalate_case"],
  ["suspend-user", "suspend_user"],
  ["ban-user", "ban_user"],
].forEach(([pathAction, mappedAction]) => {
  router.post(
    `/cases/:id/${pathAction}`,
    requireModerationPermission(["view_moderation_queue"]),
    asyncHandler((req, res, next) => {
      req.params.action = mappedAction;
      return moderationController.applyAction(req, res, next);
    })
  );
});

router.get(
  "/stats",
  requireModerationPermission(["view_moderation_queue"]),
  asyncHandler(moderationController.getStats)
);

router.get(
  "/audit-logs",
  requireModerationPermission(["view_audit_logs"]),
  asyncHandler(moderationController.getAuditLogs)
);

module.exports = router;
