const CreatorProfile = require("../models/CreatorProfile");
const asyncHandler = require("./asyncHandler");

const creatorAuth = asyncHandler(async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const profile = await CreatorProfile.findOne({ userId }).lean();
  if (!profile) {
    return res.status(403).json({ error: "Creator profile required" });
  }

  req.creatorProfile = profile;
  next();
});

module.exports = creatorAuth;
