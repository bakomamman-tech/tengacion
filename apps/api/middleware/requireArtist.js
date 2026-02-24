const asyncHandler = require("../../../backend/middleware/asyncHandler");
const ApiError = require("../utils/ApiError");
const userRepository = require("../repositories/userRepository");

module.exports = asyncHandler(async (req, _res, next) => {
  const user = await userRepository.findById(req.user.id);
  if (!user) {
    throw ApiError.unauthorized("User not found");
  }

  if (!user.isArtist && user.role !== "artist") {
    throw ApiError.forbidden("Artist membership required");
  }

  next();
});
