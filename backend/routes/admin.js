const express = require("express");
const fs = require("fs");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const requireStepUp = require("../middleware/requireStepUp");
const requirePermissions = require("../middleware/requirePermissions");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const Post = require("../models/Post");
const Message = require("../models/Message");
const Report = require("../models/Report");
const AdminComplaint = require("../models/AdminComplaint");
const UserStrike = require("../models/UserStrike");
const ModerationCase = require("../models/ModerationCase");
const CreatorProfile = require("../models/CreatorProfile");
const Track = require("../models/Track");
const Album = require("../models/Album");
const Book = require("../models/Book");
const Video = require("../models/Video");
const Purchase = require("../models/Purchase");
const { writeAuditLog } = require("../services/auditLogService");
const { createNotification } = require("../services/notificationService");
const { disconnectUserSockets } = require("../utils/realtimeSessions");
const { buildAdminDashboard } = require("../services/adminDashboardService");
const { sendModerationMessengerWarning } = require("../services/moderationMessengerService");
const {
  applyModerationAction,
  getModerationItem,
  listModerationItems,
  resolvePrivateMediaPath,
} = require("../services/uploadModerationService");
const {
  banUserAccount,
  suspendUserAccount,
} = require("../services/moderationService");
const {
  buildCreatorFinanceRepository,
} = require("../services/creatorFinanceRepositoryService");
const {
  buildOverview,
  buildUserGrowth,
  buildContentUploads,
  buildRevenueAnalytics,
  buildEngagementAnalytics,
  buildMessagesOverview,
  buildTopCreators,
  buildTopContent,
  buildRecentActivity,
  buildSystemAlerts,
  buildReportsSummary,
  backfillDailyAnalytics,
  logAnalyticsEvent,
} = require("../services/analyticsService");
const {
  getStorageActionCatalog,
  getStorageOverview,
  previewCleanup,
  runCleanup,
} = require("../services/storageMaintenanceService");

const router = express.Router();

const ADMIN_ROLES = ["admin", "super_admin"];
const SUPER_ADMIN_ROLES = ["super_admin"];
const ADMIN_MANAGEABLE_ROLES = new Set(["user"]);

const toId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  return value.toString();
};

const isValidId = (value) => mongoose.Types.ObjectId.isValid(value);
const clamp = (value, min, max, fallback) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
};
const getAnalyticsFilters = (req) => ({
  range: String(req.query.range || "30d").trim().toLowerCase(),
  startDate: String(req.query.startDate || "").trim(),
  endDate: String(req.query.endDate || "").trim(),
  category: String(req.query.category || "all").trim().toLowerCase(),
  interval: String(req.query.interval || "daily").trim().toLowerCase(),
});
const normalizeComplaintStatus = (value = "") => {
  const next = String(value || "").trim().toLowerCase();
  return ["open", "reviewing", "resolved", "dismissed"].includes(next) ? next : "";
};
const mapComplaint = (entry = {}) => ({
  _id: toId(entry._id),
  subject: String(entry.subject || ""),
  category: String(entry.category || "general"),
  details: String(entry.details || ""),
  sourcePath: String(entry.sourcePath || ""),
  sourceLabel: String(entry.sourceLabel || ""),
  priority: String(entry.priority || "medium"),
  priorityScore: Number(entry.priorityScore || 0),
  status: String(entry.status || "open"),
  adminNote: String(entry.adminNote || ""),
  createdAt: entry.createdAt || null,
  updatedAt: entry.updatedAt || null,
  reviewedAt: entry.reviewedAt || null,
  resolvedAt: entry.resolvedAt || null,
  reporter: entry.reporterId
    ? {
        _id: toId(entry.reporterId._id || entry.reporterId),
        name: String(entry.reporterId.name || ""),
        username: String(entry.reporterId.username || ""),
        avatar: entry.reporterId.avatar || "",
      }
    : null,
  reviewedBy: entry.reviewedBy
    ? {
        _id: toId(entry.reviewedBy._id || entry.reviewedBy),
        name: String(entry.reviewedBy.name || ""),
        username: String(entry.reviewedBy.username || ""),
        email: String(entry.reviewedBy.email || ""),
      }
    : null,
});

const toAdminUserDTO = (user, requesterRole = "admin") => ({
  _id: toId(user._id),
  displayName: user.name || "",
  username: user.username || "",
  email: ["admin", "super_admin"].includes(String(requesterRole || "").toLowerCase())
    ? user.email || ""
    : "",
  role: user.role || "user",
  isBanned: Boolean(user.isBanned),
  isDeleted: Boolean(user.isDeleted),
  status: user.isDeleted ? "deleted" : user.isBanned ? "banned" : "active",
  createdAt: user.createdAt,
  lastLoginAt: user.lastLogin || null,
});

const canManageTarget = ({ actorRole, targetRole }) => {
  const normalizedActor = String(actorRole || "").toLowerCase();
  const normalizedTarget = String(targetRole || "").toLowerCase();
  if (normalizedActor === "super_admin") return true;
  if (normalizedActor !== "admin") return false;
  return ADMIN_MANAGEABLE_ROLES.has(normalizedTarget);
};

const assertCanManageTarget = ({ actorRole, target, res }) => {
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return false;
  }

  if (!canManageTarget({ actorRole, targetRole: target.role })) {
    res.status(403).json({ error: "Forbidden to manage this user" });
    return false;
  }

  return true;
};

const applyAdminUserSafetyAction = async ({
  req,
  res,
  targetId,
  action,
  reason,
}) => {
  if (!isValidId(targetId)) {
    res.status(400).json({ error: "Invalid user id" });
    return null;
  }

  const target = await User.findById(targetId);
  if (toId(target?._id) === req.user.id) {
    res.status(400).json({ error: `You cannot ${action} yourself` });
    return null;
  }

  if (!assertCanManageTarget({ actorRole: req.user.role, target, res })) {
    return null;
  }

  const normalizedReason = String(reason || "").trim() || "Moderation action";

  if (action === "suspend") {
    await suspendUserAccount({
      targetUserId: target._id,
      actorId: req.user.id,
      reason: normalizedReason,
      req,
    });
  } else if (action === "ban") {
    await banUserAccount({
      targetUserId: target._id,
      actorId: req.user.id,
      reason: normalizedReason,
      req,
    });
  } else {
    res.status(400).json({ error: "Unsupported user action" });
    return null;
  }

  await writeAuditLog({
    req,
    actorId: req.user.id,
    action: `admin.user.${action}`,
    targetType: "User",
    targetId: toId(target._id),
    reason: normalizedReason,
    metadata: {
      action,
    },
  });

  await sendModerationMessengerWarning({
    req,
    actor: req.user,
    recipientId: target._id,
    action: action === "ban" ? "ban_user" : "suspend_user",
    reason: normalizedReason,
    scope: "user",
    clientSeed: toId(target._id),
  }).catch(() => null);

  if (action === "ban") {
    await logAnalyticsEvent({
      type: "account_banned",
      userId: target._id,
      actorRole: target.role,
      targetId: target._id,
      targetType: "user",
      metadata: { reason: normalizedReason, bannedBy: req.user.id },
    }).catch(() => null);
  }

  return target;
};

const applyUploadModerationRouteAction = async ({ req, res, itemId, action }) => {
  if (!isValidId(itemId)) {
    res.status(400).json({ error: "Invalid moderation item id" });
    return null;
  }

  const item = await applyModerationAction({
    itemId,
    action,
    reason: req.body?.reason || "",
    actor: req.user,
    req,
  });

  return item;
};

const STRIKE_RULES = {
  temporaryMute: 3,
  temporaryBan: 5,
  permanentBan: 7,
};

const applyUserStrikes = async ({ targetUserId, reportId, count = 1, reason = "" }) => {
  if (!targetUserId) return { strikeCount: 0, action: "" };
  const strike = await UserStrike.findOneAndUpdate(
    { userId: targetUserId },
    {
      $inc: { count: Number(count) || 1 },
      $push: {
        history: {
          reportId,
          count: Number(count) || 1,
          reason: String(reason || "").slice(0, 300),
          createdAt: new Date(),
        },
      },
      $set: { lastActionAt: new Date() },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  const target = await User.findById(targetUserId);
  if (!target) return { strikeCount: Number(strike.count) || 0, action: "" };

  const total = Number(strike.count) || 0;
  let action = "";
  if (total >= STRIKE_RULES.permanentBan) {
    target.isBanned = true;
    target.isActive = false;
    target.banReason = "Permanent ban due to repeated policy violations";
    action = "permanent_ban";
  } else if (total >= STRIKE_RULES.temporaryBan) {
    target.isBanned = true;
    target.banReason = "Temporary ban due to policy violations";
    action = "temporary_ban";
  } else if (total >= STRIKE_RULES.temporaryMute) {
    action = "temporary_mute";
  }
  await target.save();
  if (action === "permanent_ban" || action === "temporary_ban") {
    await logAnalyticsEvent({
      type: "account_banned",
      userId: target._id,
      actorRole: target.role,
      targetId: target._id,
      targetType: "user",
      metadata: { action, reason: target.banReason || reason || "" },
    }).catch(() => null);
  }
  return { strikeCount: total, action };
};

router.use(auth, requireRole(ADMIN_ROLES));
router.use("/moderation", require("./moderation"));
router.use("/news", require("./newsAdmin.routes"));

router.get("/users", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const search = String(req.query.search || "").trim();
    const role = String(req.query.role || "").trim().toLowerCase();
    const banned = String(req.query.banned || "").trim().toLowerCase();

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    if (role) {
      query.role = role;
    }
    if (banned === "true" || banned === "false") {
      query.isBanned = banned === "true";
    }

    const requesterRole = String(req.user?.role || "admin").toLowerCase();
    const [rows, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          "_id name username email role lastLogin isBanned isDeleted createdAt"
        )
        .lean(),
      User.countDocuments(query),
    ]);

    return res.json({
      page,
      limit,
      total,
      users: rows.map((row) => toAdminUserDTO(row, requesterRole)),
    });
  } catch (err) {
    console.error("Admin users list error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.get("/users/:id", async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    const user = await User.findById(req.params.id)
      .select(
        "_id name username email role lastLogin isActive isBanned banReason bannedAt isDeleted deletedAt forcePasswordReset tokenVersion followers following createdAt updatedAt"
      )
      .lean();
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const [postsCount] = await Promise.all([
      Post.countDocuments({ author: user._id }).catch(() => 0),
    ]);

    const requesterRole = String(req.user?.role || "admin").toLowerCase();
    return res.json({
      ...toAdminUserDTO(user, requesterRole),
      isActive: Boolean(user.isActive),
      bannedReason: user.banReason || "",
      bannedAt: user.bannedAt || null,
      deletedAt: user.deletedAt || null,
      forcePasswordReset: Boolean(user.forcePasswordReset),
      stats: {
        postsCount: Number(postsCount) || 0,
        followersCount: Array.isArray(user.followers) ? user.followers.length : 0,
        followingCount: Array.isArray(user.following) ? user.following.length : 0,
      },
    });
  } catch (err) {
    console.error("Admin user detail error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.patch("/users/:id", requireStepUp({ adminOnly: true }), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const actorId = req.user.id;
    const actorRole = String(req.user.role || "user");
    const target = await User.findById(req.params.id);
    if (toId(target?._id) === req.user.id) {
      return res.status(400).json({ error: "You cannot modify your own admin account here" });
    }
    if (!assertCanManageTarget({ actorRole, target, res })) {
      return;
    }

    const payload = req.body && typeof req.body === "object" ? req.body : {};
    const allowedFields = ["name", "username", "phone", "country", "bio", "isActive"];
    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(payload, field)) {
        target[field] = payload[field];
      }
    }

    if (Object.prototype.hasOwnProperty.call(payload, "role")) {
      if (!SUPER_ADMIN_ROLES.includes(actorRole)) {
        return res.status(403).json({ error: "Only super_admin can change roles" });
      }
      const nextRole = String(payload.role || "").trim();
      if (!["user", "admin", "super_admin", "artist", "moderator"].includes(nextRole)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      target.role = nextRole;
    }

    await target.save();
    if (!target.isActive) {
      disconnectUserSockets(req.app, target._id, {
        code: "ACCOUNT_INACTIVE",
        message: "Your account was disabled. Please contact support.",
      });
    }
    await writeAuditLog({
      req,
      actorId,
      action: "admin.user.update",
      targetType: "User",
      targetId: toId(target._id),
      reason: String(req.body?.reason || ""),
      metadata: { fields: Object.keys(payload || {}) },
    });

    return res.json({
      success: true,
      user: toAdminUserDTO(target.toObject ? target.toObject() : target, req.user?.role),
    });
  } catch (err) {
    console.error("Admin user update error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.post("/users/:id/suspend", async (req, res) => {
  try {
    const target = await applyAdminUserSafetyAction({
      req,
      res,
      targetId: req.params.id,
      action: "suspend",
      reason: req.body?.reason || "",
    });
    if (!target) {
      return;
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Admin suspend error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.post("/users/:id/ban", async (req, res) => {
  try {
    const target = await applyAdminUserSafetyAction({
      req,
      res,
      targetId: req.params.id,
      action: "ban",
      reason: req.body?.reason || "",
    });
    if (!target) {
      return;
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Admin ban error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.post("/users/:id/unban", requireStepUp({ adminOnly: true }), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    const target = await User.findById(req.params.id);
    if (!assertCanManageTarget({ actorRole: req.user.role, target, res })) {
      return;
    }

    target.isBanned = false;
    target.banReason = "";
    target.bannedAt = null;
    target.bannedBy = null;
    if (!target.isSuspended) {
      target.isActive = true;
    }
    await target.save();

    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.user.unban",
      targetType: "User",
      targetId: toId(target._id),
      reason: String(req.body?.reason || ""),
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("Admin unban error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.post("/users/:id/unsuspend", requireStepUp({ adminOnly: true }), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    const target = await User.findById(req.params.id);
    if (!assertCanManageTarget({ actorRole: req.user.role, target, res })) {
      return;
    }

    target.isSuspended = false;
    target.suspendedAt = null;
    target.suspendedUntil = null;
    target.suspensionReason = "";
    target.tokenVersion = (Number(target.tokenVersion) || 0) + 1;
    if (!target.isBanned) {
      target.isActive = true;
    }
    await target.save();

    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.user.unsuspend",
      targetType: "User",
      targetId: toId(target._id),
      reason: String(req.body?.reason || ""),
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("Admin unsuspend error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.post("/users/:id/force-logout", requireStepUp({ adminOnly: true }), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    const target = await User.findById(req.params.id);
    if (toId(target?._id) === req.user.id) {
      return res.status(400).json({ error: "Use normal logout for your current session" });
    }
    if (!assertCanManageTarget({ actorRole: req.user.role, target, res })) {
      return;
    }
    target.tokenVersion = (Number(target.tokenVersion) || 0) + 1;
    await target.save();
    disconnectUserSockets(req.app, target._id, {
      code: "ADMIN_FORCE_LOGOUT",
      message: "An administrator logged out your account.",
    });

    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.user.force_logout",
      targetType: "User",
      targetId: toId(target._id),
      reason: String(req.body?.reason || ""),
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("Admin force logout error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.post("/users/:id/reset-password", requireStepUp({ adminOnly: true }), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    const target = await User.findById(req.params.id);
    if (!assertCanManageTarget({ actorRole: req.user.role, target, res })) {
      return;
    }
    target.forcePasswordReset = true;
    await target.save();

    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.user.reset_password_flag",
      targetType: "User",
      targetId: toId(target._id),
      reason: String(req.body?.reason || ""),
    });

    return res.json({ success: true, forcePasswordReset: true });
  } catch (err) {
    console.error("Admin reset-password error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.delete("/users/:id", requireStepUp({ adminOnly: true }), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    const target = await User.findById(req.params.id);
    if (toId(target?._id) === req.user.id) {
      return res.status(400).json({ error: "You cannot delete your own account here" });
    }
    if (!assertCanManageTarget({ actorRole: req.user.role, target, res })) {
      return;
    }

    const uid = toId(target._id);
    target.isDeleted = true;
    target.deletedAt = new Date();
    target.isActive = false;
    target.isBanned = true;
    target.banReason = "Soft deleted by admin";
    target.tokenVersion = (Number(target.tokenVersion) || 0) + 1;
    if (!target.username.startsWith("deleted_")) {
      target.username = `deleted_${uid.slice(-8)}_${Date.now()}`;
    }
    if (!target.email.startsWith("deleted+")) {
      target.email = `deleted+${uid.slice(-8)}@tengacion.local`;
    }
    await target.save();
    disconnectUserSockets(req.app, target._id, {
      code: "ACCOUNT_DELETED",
      message: "This account is no longer available.",
    });

    await User.updateMany(
      {},
      {
        $pull: {
          friends: target._id,
          friendRequests: target._id,
          followers: target._id,
          following: target._id,
          blockedUsers: target._id,
        },
      }
    );

    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.user.soft_delete",
      targetType: "User",
      targetId: uid,
      reason: String(req.body?.reason || ""),
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("Admin soft-delete error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.get("/moderation/items", async (req, res) => {
  try {
    const payload = await listModerationItems({
      status: String(req.query.status || "").trim(),
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search || "",
    });
    return res.json(payload);
  } catch (err) {
    const code = err?.status || 500;
    return res.status(code).json({ error: err.message || "Failed to load moderation items" });
  }
});

router.get("/moderation/items/:id", async (req, res) => {
  try {
    const payload = await getModerationItem(req.params.id);
    return res.json(payload);
  } catch (err) {
    const code = err?.status || 500;
    return res.status(code).json({ error: err.message || "Failed to load moderation item" });
  }
});

router.get("/moderation/items/:id/preview", async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid moderation item id" });
    }

    const item = await ModerationCase.findById(req.params.id)
      .select("_id fileUrl mimeType media")
      .lean();
    if (!item) {
      return res.status(404).json({ error: "Moderation item not found" });
    }

    const fileUrl = String(item.fileUrl || item.media?.[0]?.sourceUrl || item.media?.[0]?.previewUrl || "").trim();
    if (!fileUrl.startsWith("private://")) {
      return res.status(404).json({ error: "Preview unavailable" });
    }

    const filePath = resolvePrivateMediaPath(fileUrl);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Preview unavailable" });
    }

    res.set("Cache-Control", "no-store");
    const mimeType = String(item.mimeType || item.media?.[0]?.mimeType || "application/octet-stream");
    res.type(mimeType);
    return res.sendFile(filePath);
  } catch (err) {
    const code = err?.status || 500;
    return res.status(code).json({ error: err.message || "Failed to load preview" });
  }
});

router.post("/moderation/items/:id/approve", async (req, res) => {
  try {
    const item = await applyUploadModerationRouteAction({
      req,
      res,
      itemId: req.params.id,
      action: "approve",
    });
    if (!item) {
      return;
    }
    return res.json({ success: true, item });
  } catch (err) {
    const code = err?.status || 500;
    return res.status(code).json({ error: err.message || "Failed to approve item" });
  }
});

router.post("/moderation/items/:id/reject", async (req, res) => {
  try {
    const item = await applyUploadModerationRouteAction({
      req,
      res,
      itemId: req.params.id,
      action: "reject",
    });
    if (!item) {
      return;
    }
    return res.json({ success: true, item });
  } catch (err) {
    const code = err?.status || 500;
    return res.status(code).json({ error: err.message || "Failed to reject item" });
  }
});

router.post("/moderation/items/:id/remove", async (req, res) => {
  try {
    const item = await applyUploadModerationRouteAction({
      req,
      res,
      itemId: req.params.id,
      action: "remove",
    });
    if (!item) {
      return;
    }
    return res.json({ success: true, item });
  } catch (err) {
    const code = err?.status || 500;
    return res.status(code).json({ error: err.message || "Failed to remove item" });
  }
});

router.post("/moderation/items/:id/quarantine", async (req, res) => {
  try {
    const item = await applyUploadModerationRouteAction({
      req,
      res,
      itemId: req.params.id,
      action: "quarantine",
    });
    if (!item) {
      return;
    }
    return res.json({ success: true, item });
  } catch (err) {
    const code = err?.status || 500;
    return res.status(code).json({ error: err.message || "Failed to quarantine item" });
  }
});

router.get("/audit-logs", requirePermissions(["view_audit_logs"]), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 30));
    const skip = (page - 1) * limit;
    const action = String(req.query.action || "").trim();
    const targetType = String(req.query.targetType || "").trim();
    const actorId = String(req.query.actorId || "").trim();

    const query = {};
    if (action) query.action = action;
    if (targetType) query.targetType = targetType;
    if (isValidId(actorId)) query.actorId = new mongoose.Types.ObjectId(actorId);

    const [rows, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("actorId", "_id name username role")
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    return res.json({
      page,
      limit,
      total,
      logs: rows.map((row) => ({
        _id: toId(row._id),
        actor: row.actorId
          ? {
              _id: toId(row.actorId._id),
              name: row.actorId.name || "",
              username: row.actorId.username || "",
              role: row.actorId.role || "user",
            }
          : null,
        action: row.action || "",
        targetType: row.targetType || "",
        targetId: row.targetId || "",
        reason: row.reason || "",
        ip: row.ip || "",
        userAgent: row.userAgent || "",
        createdAt: row.createdAt,
      })),
    });
  } catch (err) {
    console.error("Admin audit logs error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.get("/reports", requirePermissions(["view_moderation_queue"]), async (req, res) => {
  try {
    const status = String(req.query.status || "").trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const query = {};
    if (status) {
      query.status = status;
    }

    const [rows, total] = await Promise.all([
      Report.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("reporterId", "_id name username")
        .populate("assignedTo", "_id name username role")
        .lean(),
      Report.countDocuments(query),
    ]);
    return res.json({
      page,
      limit,
      total,
      reports: rows,
    });
  } catch (err) {
    console.error("Admin reports list error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.get("/reports/:id", requirePermissions(["view_moderation_queue"]), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid report id" });
    }
    const report = await Report.findById(req.params.id)
      .populate("reporterId", "_id name username")
      .populate("assignedTo", "_id name username role")
      .lean();
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }
    return res.json(report);
  } catch (err) {
    console.error("Admin report detail error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.patch("/reports/:id", requirePermissions(["view_moderation_queue"]), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid report id" });
    }
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }
    const nextStatus = String(req.body?.status || "").trim();
    if (nextStatus && ["open", "reviewing", "actioned", "dismissed"].includes(nextStatus)) {
      report.status = nextStatus;
    }
    if (req.body?.assignedTo && isValidId(req.body.assignedTo)) {
      report.assignedTo = req.body.assignedTo;
    } else if (!report.assignedTo) {
      report.assignedTo = req.user.id;
    }
    if (req.body?.actionTaken !== undefined) {
      report.actionTaken = String(req.body.actionTaken || "").slice(0, 500);
    }
    await report.save();
    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.report.update",
      targetType: "Report",
      targetId: toId(report._id),
      reason: String(req.body?.reason || ""),
      metadata: { status: report.status },
    });
    return res.json({ success: true, report });
  } catch (err) {
    console.error("Admin report update error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.post("/moderation/action", requirePermissions(["view_moderation_queue"]), async (req, res) => {
  try {
    const action = String(req.body?.action || "").trim().toLowerCase();
    const targetType = String(req.body?.targetType || "").trim().toLowerCase();
    const targetId = String(req.body?.targetId || "").trim();
    const reportId = String(req.body?.reportId || "").trim();
    const reason = String(req.body?.reason || "").trim();
    const strikes = Math.max(0, Number(req.body?.strikes) || 1);

    if (!action || !targetType || !targetId) {
      return res.status(400).json({ error: "action, targetType and targetId are required" });
    }

    let targetUserId = "";
    if (targetType === "user") {
      targetUserId = targetId;
    } else if (targetType === "post") {
      const post = await Post.findById(targetId).select("author");
      targetUserId = toId(post?.author);
      if (action === "delete_post" && post) {
        await Post.deleteOne({ _id: targetId });
      }
    } else if (targetType === "comment") {
      const post = await Post.findOne({ "comments._id": targetId });
      const comment = post?.comments?.find((entry) => toId(entry._id) === targetId);
      targetUserId = toId(comment?.author);
      if (action === "delete_comment" && post) {
        post.comments = (post.comments || []).filter((entry) => toId(entry._id) !== targetId);
        post.commentsCount = post.comments.length;
        await post.save();
      }
    } else if (targetType === "message") {
      const message = await Message.findById(targetId).select("senderId");
      targetUserId = toId(message?.senderId);
      if (action === "delete_message" && message) {
        await Message.deleteOne({ _id: targetId });
      }
    }

    if (["ban", "mute", "warn"].includes(action) && isValidId(targetUserId)) {
      const user = await User.findById(targetUserId);
      if (user) {
        if (action === "ban") {
          user.isBanned = true;
          user.banReason = reason || "Moderation action";
          user.bannedAt = new Date();
        }
        if (action === "mute") {
          user.forcePasswordReset = false;
        }
        await user.save();
      }
    }

    const strikeResult = isValidId(targetUserId)
      ? await applyUserStrikes({
          targetUserId,
          reportId: isValidId(reportId) ? reportId : null,
          count: strikes,
          reason: reason || action,
        })
      : { strikeCount: 0, action: "" };

    if (isValidId(reportId)) {
      await Report.findByIdAndUpdate(reportId, {
        status: "actioned",
        actionTaken: `${action}${strikeResult.action ? ` + ${strikeResult.action}` : ""}`,
        strikesApplied: {
          userId: isValidId(targetUserId) ? targetUserId : null,
          count: strikes,
        },
        assignedTo: req.user.id,
      });
    }

    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.moderation.action",
      targetType,
      targetId,
      reason,
      metadata: {
        action,
        reportId: isValidId(reportId) ? reportId : "",
        strikes,
        strikeCount: strikeResult.strikeCount,
      },
    });

    return res.json({
      success: true,
      strikeCount: strikeResult.strikeCount,
      autoAction: strikeResult.action,
    });
  } catch (err) {
    console.error("Admin moderation action error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.get("/content", async (req, res) => {
  try {
    const page = clamp(req.query.page, 1, 500, 1);
    const limit = clamp(req.query.limit, 1, 100, 20);
    const skip = (page - 1) * limit;
    const category = String(req.query.category || "all").trim().toLowerCase();

    const items = [];
    const pushRows = (rows, type, getTitle, getCreatedAt, getMetric) => {
      for (const row of rows) {
        items.push({
          id: toId(row._id),
          type,
          title: getTitle(row),
          createdAt: getCreatedAt(row),
          metricValue: getMetric(row),
          status: row.isPublished === false ? "draft" : "published",
          moderationStatus: row.moderationStatus || "ALLOW",
          reviewRequired: Boolean(row.reviewRequired),
          sensitiveType: row.sensitiveType || "",
          sensitiveContent: Boolean(row.sensitiveContent),
        });
      }
    };

    if (["all", "music", "tracks"].includes(category)) {
      pushRows(
        await Track.find({ archivedAt: null, kind: { $ne: "podcast" } }).sort({ createdAt: -1 }).limit(200).lean(),
        "track",
        (row) => row.title || "Untitled Track",
        (row) => row.createdAt,
        (row) => Number(row.playsCount || row.playCount || 0)
      );
    }
    if (["all", "albums"].includes(category)) {
      pushRows(
        await Album.find({ archivedAt: null }).sort({ createdAt: -1 }).limit(200).lean(),
        "album",
        (row) => row.title || "Untitled Album",
        (row) => row.createdAt,
        (row) => Number(row.playCount || 0)
      );
    }
    if (["all", "books"].includes(category)) {
      pushRows(
        await Book.find({ archivedAt: null }).sort({ createdAt: -1 }).limit(200).lean(),
        "book",
        (row) => row.title || "Untitled Book",
        (row) => row.createdAt,
        (row) => Number(row.downloadCount || 0)
      );
    }
    if (["all", "podcasts"].includes(category)) {
      pushRows(
        await Track.find({ archivedAt: null, kind: "podcast" }).sort({ createdAt: -1 }).limit(200).lean(),
        "podcast",
        (row) => row.title || "Untitled Podcast",
        (row) => row.createdAt,
        (row) => Number(row.playsCount || row.playCount || 0)
      );
    }
    if (["all", "videos"].includes(category)) {
      pushRows(
        await Video.find({ archivedAt: null }).sort({ time: -1 }).limit(200).lean(),
        "video",
        (row) => row.caption || "Untitled Video",
        (row) => row.time || row.createdAt,
        (row) => Number(row.viewsCount || 0)
      );
    }

    const rows = items
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(skip, skip + limit);

    return res.json({ page, limit, total: items.length, items: rows });
  } catch (err) {
    console.error("Admin content list error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.get("/transactions", async (req, res) => {
  try {
    const page = clamp(req.query.page, 1, 500, 1);
    const limit = clamp(req.query.limit, 1, 100, 20);
    const skip = (page - 1) * limit;
    const status = String(req.query.status || "").trim().toLowerCase();
    const query = status ? { status } : {};
    const [rows, total] = await Promise.all([
      Purchase.find(query)
        .sort({ paidAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Purchase.countDocuments(query),
    ]);

    return res.json({
      page,
      limit,
      total,
      transactions: rows.map((row) => ({
        _id: toId(row._id),
        userId: toId(row.userId),
        creatorId: toId(row.creatorId),
        itemType: row.itemType || "",
        itemId: toId(row.itemId),
        amount: Number(row.amount || 0),
        currency: row.currency || "NGN",
        status: row.status || "pending",
        provider: row.provider || "",
        providerRef: row.providerRef || "",
        paidAt: row.paidAt || null,
        createdAt: row.createdAt,
      })),
    });
  } catch (err) {
    console.error("Admin transactions list error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.get("/finance/creator-earnings", async (req, res) => {
  try {
    return res.json(await buildCreatorFinanceRepository(getAnalyticsFilters(req)));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res
      .status(code)
      .json({ error: err.message || "Failed to load creator earnings repository" });
  }
});

router.get("/creators/:id", async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid creator id" });
    }

    const creator = await CreatorProfile.findById(req.params.id).populate("userId", "_id name username email avatar").lean();
    if (!creator) {
      return res.status(404).json({ error: "Creator not found" });
    }

    const [tracks, podcasts, albums, books, videos, revenueRows] = await Promise.all([
      Track.countDocuments({ creatorId: creator._id, kind: { $ne: "podcast" }, archivedAt: null }),
      Track.countDocuments({ creatorId: creator._id, kind: "podcast", archivedAt: null }),
      Album.countDocuments({ creatorId: creator._id, archivedAt: null }),
      Book.countDocuments({ creatorId: creator._id, archivedAt: null }),
      Video.countDocuments({ creatorProfileId: creator._id, archivedAt: null }),
      Purchase.aggregate([
        { $match: { creatorId: creator._id, status: "paid" } },
        { $group: { _id: null, revenue: { $sum: "$amount" }, purchases: { $sum: 1 } } },
      ]),
    ]);

    return res.json({
      _id: toId(creator._id),
      displayName: creator.displayName || "",
      bio: creator.bio || "",
      tagline: creator.tagline || "",
      genres: Array.isArray(creator.genres) ? creator.genres : [],
      links: Array.isArray(creator.links) ? creator.links : [],
      user: creator.userId
        ? {
            _id: toId(creator.userId._id),
            name: creator.userId.name || "",
            username: creator.userId.username || "",
            email: creator.userId.email || "",
            avatar: creator.userId.avatar?.url || creator.userId.avatar || "",
          }
        : null,
      stats: {
        tracks,
        podcasts,
        albums,
        books,
        videos,
        totalRevenue: Number(revenueRows[0]?.revenue || 0),
        purchases: Number(revenueRows[0]?.purchases || 0),
      },
    });
  } catch (err) {
    console.error("Admin creator detail error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.post("/analytics/backfill", requireRole(SUPER_ADMIN_ROLES), async (req, res) => {
  try {
    const startDate = String(req.body?.startDate || "").trim();
    const endDate = String(req.body?.endDate || "").trim();
    const docs = await backfillDailyAnalytics({ startDate, endDate });
    return res.json({ success: true, count: docs.length });
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res.status(code).json({ error: err.message || "Failed to backfill analytics" });
  }
});

router.get("/dashboard", async (req, res) => {
  try {
    return res.json(await buildAdminDashboard(getAnalyticsFilters(req)));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    console.error("Admin dashboard error:", req.requestId, err);
    return res.status(code).json({ error: err.message || "Failed to load admin dashboard" });
  }
});

router.get("/analytics/overview", async (req, res) => {
  try {
    return res.json(await buildOverview(getAnalyticsFilters(req)));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    console.error("Admin analytics overview error:", req.requestId, err);
    return res.status(code).json({ error: err.message || "Internal Server Error", requestId: req.requestId });
  }
});

router.get("/analytics/user-growth", async (req, res) => {
  try {
    return res.json(await buildUserGrowth(getAnalyticsFilters(req)));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res.status(code).json({ error: err.message || "Failed to load user growth analytics" });
  }
});

router.get("/analytics/content-uploads", async (req, res) => {
  try {
    return res.json(await buildContentUploads(getAnalyticsFilters(req)));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res.status(code).json({ error: err.message || "Failed to load content upload analytics" });
  }
});

router.get("/analytics/revenue", async (req, res) => {
  try {
    return res.json(await buildRevenueAnalytics(getAnalyticsFilters(req)));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res.status(code).json({ error: err.message || "Failed to load revenue analytics" });
  }
});

router.get("/analytics/engagement", async (req, res) => {
  try {
    return res.json(await buildEngagementAnalytics(getAnalyticsFilters(req)));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res.status(code).json({ error: err.message || "Failed to load engagement analytics" });
  }
});

router.get("/messages/overview", async (req, res) => {
  try {
    return res.json(await buildMessagesOverview(getAnalyticsFilters(req)));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res.status(code).json({ error: err.message || "Failed to load message analytics" });
  }
});

router.get("/messages/complaints", requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const limit = clamp(req.query.limit, 1, 50, 8);
    const page = clamp(req.query.page, 1, 1000, 1);
    const status = normalizeComplaintStatus(req.query.status);
    const query = status ? { status } : {};
    const skip = (page - 1) * limit;

    const [complaints, total, open, reviewing, resolved, dismissed, critical, high] = await Promise.all([
      AdminComplaint.find(query)
        .populate("reporterId", "_id name username avatar")
        .populate("reviewedBy", "_id name username email")
        .sort({ priorityScore: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AdminComplaint.countDocuments(query),
      AdminComplaint.countDocuments({ status: "open" }),
      AdminComplaint.countDocuments({ status: "reviewing" }),
      AdminComplaint.countDocuments({ status: "resolved" }),
      AdminComplaint.countDocuments({ status: "dismissed" }),
      AdminComplaint.countDocuments({ priority: "critical" }),
      AdminComplaint.countDocuments({ priority: "high" }),
    ]);

    return res.json({
      summary: {
        total,
        open,
        reviewing,
        resolved,
        dismissed,
        critical,
        high,
      },
      complaints: complaints.map(mapComplaint),
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    console.error("Admin complaints list error:", req.requestId, err);
    return res.status(500).json({ error: "Failed to load admin complaints" });
  }
});

router.patch("/messages/complaints/:id", requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid complaint id" });
    }

    const complaint = await AdminComplaint.findById(req.params.id)
      .populate("reporterId", "_id name username avatar")
      .populate("reviewedBy", "_id name username email");
    if (!complaint) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    const nextStatus = normalizeComplaintStatus(req.body?.status) || complaint.status;
    const note = String(req.body?.adminNote || "").trim().slice(0, 1000);
    const previousStatus = String(complaint.status || "open");
    const statusChanged = nextStatus && nextStatus !== complaint.status;
    const wasClosed = ["resolved", "dismissed"].includes(String(complaint.status || "").toLowerCase());
    const willClose = ["resolved", "dismissed"].includes(nextStatus);

    if (statusChanged) {
      complaint.status = nextStatus;
      complaint.reviewedBy = req.user.id;
      complaint.reviewedAt = new Date();
      if (nextStatus === "resolved") {
        complaint.resolvedAt = new Date();
      }
    }
    if (note) {
      complaint.adminNote = note;
    }

    await complaint.save();

    if (statusChanged && willClose && !wasClosed && complaint.reporterId?._id) {
      await createNotification({
        recipient: complaint.reporterId._id,
        sender: req.user.id,
        type: "system",
        text: `Your Report To Admin message was marked ${nextStatus}.`,
        metadata: {
          previewText: note || complaint.subject,
          link: "/home",
          dedupeKey: `admin_complaint_status:${complaint._id.toString()}:${nextStatus}`,
        },
      }).catch(() => null);
    }

    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.complaint.update",
      targetType: "AdminComplaint",
      targetId: toId(complaint._id),
      reason: note || nextStatus,
      metadata: {
        previousStatus,
        newStatus: nextStatus,
      },
    }).catch(() => null);

    return res.json({ success: true, complaint: mapComplaint(complaint) });
  } catch (err) {
    console.error("Admin complaint update error:", req.requestId, err);
    return res.status(500).json({ error: "Failed to update complaint" });
  }
});

router.get("/analytics/top-creators", async (req, res) => {
  try {
    const mode = String(req.query.mode || "revenue").trim().toLowerCase();
    const limit = clamp(req.query.limit, 1, 50, 10);
    return res.json(await buildTopCreators({ ...getAnalyticsFilters(req), mode, limit }));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res.status(code).json({ error: err.message || "Failed to load top creators analytics" });
  }
});

router.get("/analytics/top-content", async (req, res) => {
  try {
    const limit = clamp(req.query.limit, 1, 50, 10);
    return res.json(await buildTopContent({ ...getAnalyticsFilters(req), limit }));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res.status(code).json({ error: err.message || "Failed to load top content analytics" });
  }
});

router.get("/analytics/recent-activity", async (req, res) => {
  try {
    return res.json(await buildRecentActivity({
      ...getAnalyticsFilters(req),
      page: req.query.page,
      limit: req.query.limit,
    }));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res.status(code).json({ error: err.message || "Failed to load recent activity" });
  }
});

router.get("/analytics/system-alerts", async (req, res) => {
  try {
    return res.json(await buildSystemAlerts(getAnalyticsFilters(req)));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res.status(code).json({ error: err.message || "Failed to load system alerts" });
  }
});

router.get("/analytics/reports-summary", async (req, res) => {
  try {
    return res.json(await buildReportsSummary(getAnalyticsFilters(req)));
  } catch (err) {
    const code = /invalid/i.test(String(err?.message || "")) ? 400 : 500;
    return res.status(code).json({ error: err.message || "Failed to load reports summary" });
  }
});

router.post(
  "/users/:id/promote-super-admin",
  requireRole(SUPER_ADMIN_ROLES),
  async (req, res) => {
    try {
      if (!isValidId(req.params.id)) {
        return res.status(400).json({ error: "Invalid user id" });
      }
      const target = await User.findById(req.params.id);
      if (!target) return res.status(404).json({ error: "User not found" });
      target.role = "super_admin";
      await target.save();
      await writeAuditLog({
        req,
        actorId: req.user.id,
        action: "admin.user.promote_super_admin",
        targetType: "User",
        targetId: toId(target._id),
        reason: String(req.body?.reason || ""),
      });
      return res.json({ success: true });
    } catch (err) {
      console.error("Promote super_admin error:", req.requestId, err);
      return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
    }
  }
);

router.get("/storage/overview", async (_req, res) => {
  try {
    return res.json({
      actions: getStorageActionCatalog(),
      ...(await getStorageOverview()),
    });
  } catch (err) {
    console.error("Admin storage overview error:", err);
    return res.status(500).json({ error: err.message || "Failed to load storage overview" });
  }
});

router.post("/storage/cleanup/preview", async (req, res) => {
  try {
    const actions = req.body?.actions || [];
    return res.json(await previewCleanup(actions));
  } catch (err) {
    console.error("Admin storage cleanup preview error:", err);
    return res.status(500).json({ error: err.message || "Failed to preview storage cleanup" });
  }
});

router.post("/storage/cleanup/run", requireStepUp({ adminOnly: true }), async (req, res) => {
  try {
    const actions = req.body?.actions || [];
    const dryRun = Boolean(req.body?.dryRun);
    return res.json(await runCleanup(actions, { dryRun }));
  } catch (err) {
    console.error("Admin storage cleanup run error:", err);
    return res.status(500).json({ error: err.message || "Failed to run storage cleanup" });
  }
});

module.exports = router;
