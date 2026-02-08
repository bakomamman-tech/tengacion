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

  // 1️⃣ Require Authorization header
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token" });
  }

  // 2️⃣ Extract token
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

  // 3️⃣ Ensure user still exists
  const user = await User.findById(decoded.id).select("_id");

  if (!user) {
    return res.status(401).json({ error: "User no longer exists" });
  }

  // 4️⃣ Attach trusted identity
  req.user = { id: user._id };

  next();
});

module.exports = auth;
