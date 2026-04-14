const asyncHandler = require("./asyncHandler");
const CreatorProfile = require("../models/CreatorProfile");
const {
  SessionAuthError,
  authenticateAccessToken,
  extractBearerToken,
} = require("../services/sessionAuth");
const { getEffectivePermissions } = require("../services/permissionService");

const attachAkusoUser = asyncHandler(async (req, _res, next) => {
  const token = extractBearerToken(req.headers.authorization || "");
  req.akusoAccess = {
    isAuthenticated: false,
    authError: null,
  };

  if (!token) {
    return next();
  }

  try {
    const authContext = await authenticateAccessToken(token, { touchSession: false });
    const isCreator = Boolean(
      await CreatorProfile.exists({ userId: authContext.user._id })
    );
    const role = authContext.user.role || "user";
    const isAdmin = ["admin", "super_admin", "moderator", "trust_safety_admin"].includes(
      String(role || "").trim().toLowerCase()
    );

    req.user = {
      id: authContext.userId,
      _id: authContext.user._id,
      role,
      permissions: [...getEffectivePermissions(authContext.user)],
      isActive: Boolean(authContext.user.isActive),
      isBanned: Boolean(authContext.user.isBanned),
      isDeleted: Boolean(authContext.user.isDeleted),
      isSuspended: Boolean(authContext.user.isSuspended),
      tokenVersion: authContext.tokenVersion,
      sessionId: authContext.sessionId,
      isCreator,
      isAdmin,
    };
    req.userId = authContext.userId;
    req.akusoAccess = {
      isAuthenticated: true,
      authError: null,
    };
  } catch (error) {
    req.akusoAccess = {
      isAuthenticated: false,
      authError:
        error instanceof SessionAuthError ? error.message : "Invalid or expired session.",
    };
  }

  return next();
});

const requireAkusoAuth =
  ({ creatorOnly = false } = {}) =>
  (req, res, next) => {
    if (!req.user?.id) {
      return res.status(401).json({
        ok: false,
        error: "AKUSO_AUTH_REQUIRED",
        message: req.akusoAccess?.authError || "Please sign in to use this Akuso endpoint.",
      });
    }

    if (creatorOnly && !req.user.isCreator && !req.user.isAdmin) {
      return res.status(403).json({
        ok: false,
        error: "AKUSO_CREATOR_REQUIRED",
        message: "This Akuso endpoint is limited to creators or admins.",
      });
    }

    return next();
  };

module.exports = {
  attachAkusoUser,
  requireAkusoAuth,
};
