const User = require("../models/User");
const {
  MODERATION_PERMISSIONS,
  PRIMARY_MODERATION_ADMIN_EMAIL,
  PRIMARY_MODERATION_ADMIN_NAME,
  PRIMARY_MODERATION_ADMIN_USERNAME_CANDIDATES,
} = require("../config/moderation");
const { normalizePermissionList } = require("./permissionService");

const normalizeEmail = (value = "") => String(value || "").trim().toLowerCase();
const normalizeName = (value = "") => String(value || "").trim();

const buildPrimaryAdminLookup = () => {
  const name = normalizeName(PRIMARY_MODERATION_ADMIN_NAME);
  const email = normalizeEmail(PRIMARY_MODERATION_ADMIN_EMAIL);
  const usernames = PRIMARY_MODERATION_ADMIN_USERNAME_CANDIDATES.map((entry) =>
    String(entry || "").trim().toLowerCase()
  ).filter(Boolean);

  const orConditions = [];
  if (name) {
    orConditions.push({ name });
    orConditions.push({ "moderationProfile.isPrimaryAuthority": true });
  }
  if (email) {
    orConditions.push({ email });
    orConditions.push({ "moderationProfile.escalationEmail": email });
  }
  if (usernames.length > 0) {
    orConditions.push({ username: { $in: usernames } });
  }

  return orConditions.length > 0 ? { $or: orConditions } : { _id: null };
};

const findPrimaryModerationAdmin = async () =>
  User.findOne(buildPrimaryAdminLookup());

const buildPrimaryAdminUpdate = (existingUser = {}, { displayName = "" } = {}) => {
  const nextPermissions = normalizePermissionList([
    ...(existingUser?.permissions || []),
    ...MODERATION_PERMISSIONS,
  ]);

  return {
    role: "super_admin",
    permissions: nextPermissions,
    isActive: true,
    isBanned: false,
    isDeleted: false,
    isSuspended: false,
    suspensionReason: "",
    suspendedAt: null,
    suspendedUntil: null,
    suspendedBy: null,
    moderationProfile: {
      isPrimaryAuthority: true,
      escalationEmail: normalizeEmail(
        existingUser?.moderationProfile?.escalationEmail || PRIMARY_MODERATION_ADMIN_EMAIL
      ),
    },
    ...(displayName ? { name: displayName } : {}),
  };
};

module.exports = {
  MODERATION_ADMIN_PERMISSION_SET: MODERATION_PERMISSIONS,
  buildPrimaryAdminLookup,
  buildPrimaryAdminUpdate,
  findPrimaryModerationAdmin,
};
