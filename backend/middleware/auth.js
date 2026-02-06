const jwt = require("jsonwebtoken");
const User = require("../models/User");
const asyncHandler = require("./asyncHandler");

/**
 * Authentication middleware
 * Verifies JWT access token and attaches user context to request
 */
const auth = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Enforce Bearer token standard
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401);
    throw new Error("Authentication required");
  }

  const token = authHeader.split(" ")[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    res.status(401);
    if (err.name === "TokenExpiredError") {
      throw new Error("Session expired");
    }
    throw new Error("Invalid authentication token");
  }

  // Ensure user still exists
  const user = await User.findById(decoded.id).select("_id");

  if (!user) {
    res.status(401);
    throw new Error("User no longer exists");
  }

  // Attach trusted identity
  req.user = {
    id: user._id,
  };

  next();
});

module.exports = auth;
