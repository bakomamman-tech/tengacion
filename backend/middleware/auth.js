const jwt = require("jsonwebtoken");

module.exports = function auth(req, res, next) {

  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({
      error: "Authentication required",
      code: "NO_TOKEN"
    });
  }

  const token = header.startsWith("Bearer ")
    ? header.split(" ")[1]
    : header;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Standard user object
    req.user = {
      id: decoded.id,
      email: decoded.email || null,
      username: decoded.username || null
    };

    req.userId = decoded.id;

    next();

  } catch (err) {

    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Session expired",
        code: "TOKEN_EXPIRED"
      });
    }

    return res.status(401).json({
      error: "Invalid token",
      code: "INVALID_TOKEN"
    });
  }
};
