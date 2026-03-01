const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const User = require("../models/User");
const AuditLog = require("../models/AuditLog");
const { writeAuditLog } = require("../services/auditLogService");

const router = express.Router();

const ADMIN_ROLES = ["admin", "super_admin"];
const SUPER_ADMIN_ROLES = ["super_admin"];
const PROTECTED_ROLES_FOR_ADMIN = new Set(["admin", "super_admin"]);

const toId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  return value.toString();
};

const isValidId = (value) => mongoose.Types.ObjectId.isValid(value);

const toUserPayload = (user) => ({
  _id: toId(user._id),
  name: user.name || "",
  username: user.username || "",
  email: user.email || "",
  role: user.role || "user",
  isActive: Boolean(user.isActive),
  isBanned: Boolean(user.isBanned),
  banReason: user.banReason || "",
  isDeleted: Boolean(user.isDeleted),
  forcePasswordReset: Boolean(user.forcePasswordReset),
  twoFactor: {
    enabled: Boolean(user?.twoFactor?.enabled),
    method: user?.twoFactor?.method || "none",
    setupPending: Boolean(user?.twoFactor?.setupPending),
  },
  bannedAt: user.bannedAt || null,
  deletedAt: user.deletedAt || null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const canManageTarget = ({ actorRole, targetRole }) => {
  const normalizedActor = String(actorRole || "").toLowerCase();
  const normalizedTarget = String(targetRole || "").toLowerCase();
  if (normalizedActor === "super_admin") return true;
  if (normalizedActor !== "admin") return false;
  return !PROTECTED_ROLES_FOR_ADMIN.has(normalizedTarget);
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

router.use(auth, requireRole(ADMIN_ROLES));

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

    const [rows, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          "_id name username email role isActive isBanned banReason isDeleted forcePasswordReset createdAt updatedAt"
        )
        .lean(),
      User.countDocuments(query),
    ]);

    return res.json({
      page,
      limit,
      total,
      users: rows.map(toUserPayload),
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
        "_id name username email role isActive isBanned banReason bannedAt bannedBy isDeleted deletedAt forcePasswordReset tokenVersion createdAt updatedAt twoFactor"
      )
      .lean();
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.json(toUserPayload(user));
  } catch (err) {
    console.error("Admin user detail error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.patch("/users/:id", async (req, res) => {
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
    await writeAuditLog({
      req,
      actorId,
      action: "admin.user.update",
      targetType: "User",
      targetId: toId(target._id),
      reason: String(req.body?.reason || ""),
      metadata: { fields: Object.keys(payload || {}) },
    });

    return res.json({ success: true, user: toUserPayload(target) });
  } catch (err) {
    console.error("Admin user update error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.post("/users/:id/ban", async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    const target = await User.findById(req.params.id);
    if (toId(target?._id) === req.user.id) {
      return res.status(400).json({ error: "You cannot ban yourself" });
    }
    if (!assertCanManageTarget({ actorRole: req.user.role, target, res })) {
      return;
    }
    const reason = String(req.body?.reason || "").trim();
    if (!reason) return res.status(400).json({ error: "Reason is required" });

    target.isBanned = true;
    target.banReason = reason;
    target.bannedAt = new Date();
    target.bannedBy = new mongoose.Types.ObjectId(req.user.id);
    target.tokenVersion = (Number(target.tokenVersion) || 0) + 1;
    await target.save();

    await writeAuditLog({
      req,
      actorId: req.user.id,
      action: "admin.user.ban",
      targetType: "User",
      targetId: toId(target._id),
      reason,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("Admin ban error:", req.requestId, err);
    return res.status(500).json({ error: "Internal Server Error", requestId: req.requestId });
  }
});

router.post("/users/:id/unban", async (req, res) => {
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

router.post("/users/:id/force-logout", async (req, res) => {
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

router.post("/users/:id/reset-password", async (req, res) => {
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

router.delete("/users/:id", async (req, res) => {
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

router.get("/audit-logs", async (req, res) => {
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

module.exports = router;
