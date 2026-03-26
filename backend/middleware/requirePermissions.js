const asyncHandler = require("./asyncHandler");
const User = require("../models/User");
const {
  canAccessAdminConsole,
  getEffectivePermissions,
  hasAllPermissions,
  hasAnyPermission,
  normalizePermissionList,
} = require("../services/permissionService");

const USER_PERMISSION_SELECT =
  "_id email role permissions moderationProfile isActive isBanned isDeleted isSuspended";

const requirePermissions = (requiredPermissions = [], { match = "all" } = {}) =>
  asyncHandler(async (req, res, next) => {
    const normalized = normalizePermissionList(requiredPermissions);
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await User.findById(userId).select(USER_PERMISSION_SELECT);
    if (!user || !canAccessAdminConsole(user)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (!user.isActive || user.isDeleted || user.isBanned || user.isSuspended) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const allowed =
      match === "any"
        ? hasAnyPermission(user, normalized)
        : hasAllPermissions(user, normalized);

    if (!allowed) {
      return res.status(403).json({
        error: "Forbidden",
        missingPermissions: normalized,
      });
    }

    req.permissionUser = user;
    req.user = {
      ...req.user,
      email: user.email || req.user?.email || "",
      permissions: [...getEffectivePermissions(user)],
    };
    return next();
  });

module.exports = requirePermissions;
