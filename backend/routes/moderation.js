const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const auth = require("../middleware/auth");
const requireModerationPermission = require("../middleware/requireModerationPermission");
const moderationController = require("../controllers/moderationController");
const User = require("../models/User");
const UserStrike = require("../models/UserStrike");
const { MODERATION_REPEAT_VIOLATOR_STRIKE_THRESHOLD } = require("../config/moderation");

const router = express.Router();

const toId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  if (typeof value.toString === "function") return value.toString();
  return "";
};

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
  "/cases",
  requireModerationPermission(["view_moderation_queue"]),
  asyncHandler(moderationController.listQueue)
);

router.get(
  "/cases/:id",
  requireModerationPermission(["view_moderation_queue"]),
  asyncHandler(moderationController.getCase)
);

router.get(
  "/cases/:id/uploader",
  requireModerationPermission(["view_moderation_queue"]),
  asyncHandler(moderationController.getUploader)
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

router.post(
  "/scan",
  requireModerationPermission(["view_moderation_queue"]),
  asyncHandler(moderationController.scanContent)
);

router.post(
  "/scan/recent",
  requireModerationPermission(["view_moderation_queue"]),
  asyncHandler((req, res) => {
    req.body = {
      ...(req.body || {}),
      search: "",
      includeManualReview: false,
      limit: req.body?.limit ?? req.query.limit ?? 20,
    };
    return moderationController.scanContent(req, res);
  })
);

router.post(
  "/scan/search",
  requireModerationPermission(["view_moderation_queue"]),
  asyncHandler((req, res) => {
    const search = String(req.body?.search || req.query.search || "").trim();
    req.body = {
      ...(req.body || {}),
      search,
      includeManualReview: true,
      limit: req.body?.limit ?? req.query.limit ?? 20,
    };
    return moderationController.scanContent(req, res);
  })
);

router.get(
  "/reports",
  requireModerationPermission(["view_moderation_queue"]),
  asyncHandler(moderationController.listQueue)
);

router.get(
  "/repeat-violators",
  requireModerationPermission(["view_moderation_queue"]),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const threshold = MODERATION_REPEAT_VIOLATOR_STRIKE_THRESHOLD;
    const search = String(req.query.search || "").trim();
    const query = {
      count: { $gte: threshold },
    };

    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const matchedUsers = await User.find(
        {
          $or: [
            { name: regex },
            { username: regex },
            { email: regex },
          ],
        },
        "_id"
      ).lean();
      const matchedIds = matchedUsers.map((entry) => entry._id).filter(Boolean);
      if (matchedIds.length === 0) {
        return res.json({
          page,
          limit,
          total: 0,
          threshold,
          users: [],
        });
      }
      query.userId = { $in: matchedIds };
    }

    const [rows, total] = await Promise.all([
      UserStrike.find(query)
        .sort({ count: -1, updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "_id name username email role isBanned isSuspended")
        .lean(),
      UserStrike.countDocuments(query),
    ]);

    return res.json({
      page,
      limit,
      total,
      threshold,
      users: rows.map((row) => ({
        _id: toId(row._id),
        strikeCount: Number(row.count || 0),
        lastActionAt: row.lastActionAt || null,
        lastActionType: String(row.lastActionType || ""),
        lastSeverity: String(row.lastSeverity || ""),
        lastEnforcementAction: String(row.lastEnforcementAction || ""),
        user: row.userId
          ? {
              _id: toId(row.userId._id),
              displayName: String(row.userId.name || ""),
              username: String(row.userId.username || ""),
              email: String(row.userId.email || ""),
              role: String(row.userId.role || "user"),
              isBanned: Boolean(row.userId.isBanned),
              isSuspended: Boolean(row.userId.isSuspended),
            }
          : null,
      })),
    });
  })
);

[
  "approve",
  "restore_content",
  "hold_for_review",
  "reject",
  "delete_media",
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
  ["restore", "restore_content"],
  ["hold", "hold_for_review"],
  ["delete-media", "delete_media"],
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
