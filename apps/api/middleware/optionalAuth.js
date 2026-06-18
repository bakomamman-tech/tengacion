const {
  authenticateAccessToken,
  extractBearerToken,
} = require("../../../backend/services/sessionAuth");
const { getEffectivePermissions } = require("../../../backend/services/permissionService");

const optionalAuth = async (req, _res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = extractBearerToken(authHeader);
  if (!token) {
    return next();
  }

  try {
    const authContext = await authenticateAccessToken(token, { touchSession: false });
    req.user = {
      id: authContext.userId,
      _id: authContext.user._id,
      role: authContext.user.role || "user",
      permissions: [...getEffectivePermissions(authContext.user)],
      isActive: Boolean(authContext.user.isActive),
      isBanned: Boolean(authContext.user.isBanned),
      isDeleted: Boolean(authContext.user.isDeleted),
      isSuspended: Boolean(authContext.user.isSuspended),
      tokenVersion: authContext.tokenVersion,
      sessionId: authContext.sessionId,
    };
    req.userId = authContext.userId;
  } catch {
    // ignore invalid tokens and allow anonymous access
  }

  next();
};

module.exports = optionalAuth;
