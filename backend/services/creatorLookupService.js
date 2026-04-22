const CreatorProfile = require("../models/CreatorProfile");
const User = require("../models/User");
const { isObjectIdLike, normalizeCreatorUsername } = require("./publicRouteService");

const resolveCreatorReferenceQuery = async (creatorRef = "") => {
  const reference = String(creatorRef || "").trim();
  if (!reference) {
    return null;
  }

  if (isObjectIdLike(reference)) {
    return { _id: reference };
  }

  const username = normalizeCreatorUsername(reference);
  if (!username) {
    return null;
  }

  const user = await User.findOne({ username }).select("_id").lean();
  if (!user?._id) {
    return null;
  }

  return { userId: user._id };
};

const findCreatorProfileByReference = async ({
  creatorRef = "",
  populate = "name username avatar followers isVerified emailVerified country",
  lean = true,
} = {}) => {
  const query = await resolveCreatorReferenceQuery(creatorRef);
  if (!query) {
    return null;
  }

  let request = CreatorProfile.findOne(query).populate("userId", populate);
  if (lean) {
    request = request.lean();
  }

  return request;
};

module.exports = {
  findCreatorProfileByReference,
  resolveCreatorReferenceQuery,
};
