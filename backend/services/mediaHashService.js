const MediaHash = require("../models/MediaHash");

const findHashMatches = async ({ hashes = [] }) => {
  const candidates = (Array.isArray(hashes) ? hashes : []).filter(
    (entry) => entry?.hashKind && entry?.hashValue
  );
  if (candidates.length === 0) {
    return [];
  }

  return MediaHash.find({
    $or: candidates.map((entry) => ({
      hashKind: entry.hashKind,
      hashValue: entry.hashValue,
    })),
  })
    .sort({ createdAt: -1 })
    .lean();
};

module.exports = {
  findHashMatches,
};
