const asyncHandler = require("./asyncHandler");
const {
  authenticateAccessToken,
  extractBearerToken,
} = require("../services/sessionAuth");

const optionalAuth = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = extractBearerToken(authHeader);
  if (!token) {
    return next();
  }

  try {
    const authContext = await authenticateAccessToken(token, { touchSession: false });
    req.user = { id: authContext.userId, _id: authContext.user._id };
    req.userId = authContext.userId;
  } catch {
    // Ignore invalid token for optional auth routes.
  }

  return next();
});

module.exports = optionalAuth;
