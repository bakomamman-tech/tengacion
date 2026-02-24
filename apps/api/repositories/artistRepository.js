const ArtistProfile = require("../../../backend/models/ArtistProfile");

const findByUserId = (userId) => ArtistProfile.findOne({ userId });

const upsertByUserId = (userId, data) =>
  ArtistProfile.findOneAndUpdate({ userId }, { $set: data }, { upsert: true, new: true, setDefaultsOnInsert: true });

module.exports = {
  findByUserId,
  upsertByUserId,
};
