const jwt = require("jsonwebtoken");
const User = require("../models/User");
const asyncHandler = require("./asyncHandler");

/**
 * Authentication middleware
 * - Enforces Bearer token format
 * - Verifies JWT
 * - Confirms user still exists
 * - Attaches trusted user identity to request
 */
const auth = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token" });
  }

  const token = authHeader.split(" ")[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Session expired" });
    }
    return res.status(401).json({ error: "Invalid token" });
  }

  const user = await User.findById(decoded.id).select(
    "_id role isActive isBanned isDeleted tokenVersion"
  );

  if (!user) {
    return res.status(401).json({ error: "User no longer exists" });
  }
  if (!user.isActive || user.isDeleted) {
    return res.status(403).json({ error: "Account is inactive" });
  }
  if (user.isBanned) {
    return res.status(403).json({ error: "Account is banned" });
  }

  const tokenVersion = Number(user.tokenVersion) || 0;
  const claimVersion = Number(decoded.tv ?? 0);
  if (claimVersion !== tokenVersion) {
    return res.status(401).json({ error: "Session revoked. Please login again." });
  }

  req.user = {
    id: user._id.toString(),
    _id: user._id,
    role: user.role || "user",
    tokenVersion,
  };
  req.userId = user._id.toString();

  next();
});

module.exports = auth;
