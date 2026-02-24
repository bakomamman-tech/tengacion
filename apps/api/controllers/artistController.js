const ArtistService = require("../services/artistService");
const catchAsync = require("../utils/catchAsync");

exports.getArtistByUsername = catchAsync(async (req, res) => {
  const artist = await ArtistService.getProfileByUsername(req.params.username);
  res.json(artist);
});

exports.updateOwnArtist = catchAsync(async (req, res) => {
  const artist = await ArtistService.updateProfile(req.user.id, req.body);
  res.json(artist);
});
