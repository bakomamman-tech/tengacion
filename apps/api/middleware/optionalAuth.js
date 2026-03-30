const {
  authenticateAccessToken,
  extractBearerToken,
} = require("../../../backend/services/sessionAuth");

const optionalAuth = async (req, _res, next) => {
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
    // ignore invalid tokens and allow anonymous access
  }

  next();
};

module.exports = optionalAuth;
