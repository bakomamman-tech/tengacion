const asyncHandler = require("./asyncHandler");
const {
  authenticateAccessToken,
  extractBearerToken,
} = require("../services/sessionAuth");

const optionalAuth = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = extractBearerToken(authHeader);

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
