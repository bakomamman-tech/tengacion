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
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token" });
  }

  const token = extractBearerToken(authHeader);
  try {
    const authContext = await authenticateAccessToken(token, { touchSession: true });
    req.user = {
      id: authContext.userId,
      _id: authContext.user._id,
      name: authContext.user.name || "",
      username: authContext.user.username || "",
      email: authContext.user.email || "",
      role: authContext.user.role || "user",
      permissions: [...getEffectivePermissions(authContext.user)],
      moderationProfile: authContext.user.moderationProfile || {},
      tokenVersion: authContext.tokenVersion,
      sessionId: authContext.sessionId,
      twoFactor: {
        enabled: Boolean(authContext.user?.twoFactor?.enabled),
        method: authContext.user?.twoFactor?.method || "none",
      },
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
