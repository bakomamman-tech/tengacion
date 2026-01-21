const jwt = require("jsonwebtoken");

/**
 * Authentication middleware
 * Verifies JWT access token and attaches user context to request
 */
module.exports = function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  // Enforce Bearer token standard
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Authentication required",
      code: "NO_TOKEN",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach minimal, trusted identity
    req.user = {
      id: decoded.id,
    };

    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Session expired",
        code: "TOKEN_EXPIRED",
      });
    }

    return res.status(401).json({
      error: "Invalid authentication token",
      code: "INVALID_TOKEN",
    });
  }
};
