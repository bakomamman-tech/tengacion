const asyncHandler = require("./asyncHandler");
const {
  SessionAuthError,
  authenticateAccessToken,
  extractBearerToken,
} = require("../services/sessionAuth");
const { getEffectivePermissions } = require("../services/permissionService");

/**
 * Authentication middleware
 * - Enforces Bearer token format
 * - Verifies JWT
 * - Confirms user still exists
 * - Attaches trusted user identity to request
 */
const auth = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = extractBearerToken(authHeader);
  if (!token) {
    return res.status(401).json({ error: "No token" });
  }
  try {
    const authContext = await authenticateAccessToken(token, { touchSession: true });
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
    next();
  } catch (err) {
    if (err instanceof SessionAuthError) {
      return res.status(err.statusCode || 401).json({ error: err.message });
    }
    return res.status(401).json({ error: "Invalid token" });
  }
});

module.exports = auth;
