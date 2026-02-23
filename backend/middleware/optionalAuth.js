const jwt = require("jsonwebtoken");
const User = require("../models/User");
const asyncHandler = require("./asyncHandler");

const optionalAuth = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("_id");
    if (!user) {
      return next();
    }
    req.user = { id: user._id.toString(), _id: user._id };
    req.userId = user._id.toString();
  } catch {
    // Ignore invalid token for optional auth routes.
  }

  return next();
});

module.exports = optionalAuth;
