const {
  authenticateAccessToken,
  extractBearerToken,
} = require("../../../backend/services/sessionAuth");

const optionalAuth = async (req, _res, next) => {
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
    // ignore invalid tokens and allow anonymous access
  }

  next();
};

module.exports = optionalAuth;
