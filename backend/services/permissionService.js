const {
  DEFAULT_ROLE_PERMISSIONS,
  MODERATION_PERMISSIONS,
} = require("../config/moderation");

const ALL_PERMISSION_SET = new Set(MODERATION_PERMISSIONS);

const normalizePermission = (value = "") => String(value || "").trim().toLowerCase();
const normalizeRole = (value = "") => String(value || "").trim().toLowerCase();

const normalizePermissionList = (permissions = []) => {
  if (!Array.isArray(permissions)) {
    return [];
  }

  return [...new Set(
    permissions
      .map((entry) => normalizePermission(entry))
      .filter((entry) => entry && ALL_PERMISSION_SET.has(entry))
  )];
};

const getRolePermissions = (role = "") =>
  normalizePermissionList(DEFAULT_ROLE_PERMISSIONS[normalizeRole(role)] || []);

const getEffectivePermissions = (user = {}) => {
  const rolePermissions = getRolePermissions(user?.role);
  const explicitPermissions = normalizePermissionList(user?.permissions || []);
  return new Set([...rolePermissions, ...explicitPermissions]);
};

const hasAllPermissions = (user, requiredPermissions = []) => {
  const effectivePermissions = getEffectivePermissions(user);
  return normalizePermissionList(requiredPermissions).every((entry) =>
    effectivePermissions.has(entry)
  );
};

const hasAnyPermission = (user, requiredPermissions = []) => {
  const normalized = normalizePermissionList(requiredPermissions);
  if (normalized.length === 0) {
    return true;
  }

  const effectivePermissions = getEffectivePermissions(user);
  return normalized.some((entry) => effectivePermissions.has(entry));
};

const canAccessAdminConsole = (user = {}) => {
  const role = normalizeRole(user?.role);
  if (["admin", "super_admin", "moderator", "trust_safety_admin"].includes(role)) {
    return true;
  }
  return getEffectivePermissions(user).size > 0;
};

module.exports = {
  canAccessAdminConsole,
  getEffectivePermissions,
  getRolePermissions,
  hasAllPermissions,
  hasAnyPermission,
  normalizePermission,
  normalizePermissionList,
  normalizeRole,
};
