const ApiError = require("../utils/ApiError");
const artistRepository = require("../repositories/artistRepository");
const userRepository = require("../repositories/userRepository");
const { sanitizePlatformLinks, sanitizeCustomLinks } = require("../utils/linkSanitizer");

const buildArtistPayload = (user, profile) => ({
  username: user.username,
  displayName: profile?.displayName || user.name,
  bio: profile?.bio || "",
  links: profile?.links || {},
  customLinks: profile?.customLinks || [],
  updatedAt: profile?.updatedAt,
  createdAt: profile?.createdAt,
});

class ArtistService {
  static async getProfileByUsername(username) {
    if (!username) {
      throw ApiError.badRequest("Username is required");
    }

    const user = await userRepository.findOne({ username: username.trim().toLowerCase() });
    if (!user) {
      throw ApiError.notFound("Artist not found");
    }

    const profile = await artistRepository.findByUserId(user._id);
    return buildArtistPayload(user, profile);
  }

  static async updateProfile(userId, payload = {}) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw ApiError.unauthorized("User not found");
    }

    if (!user.isArtist && user.role !== "artist") {
      throw ApiError.forbidden("Artist membership required");
    }

    const existing = await artistRepository.findByUserId(user._id);

    const rawLinks =
      payload.links && typeof payload.links === "object" ? payload.links : {};

    const mergedLinks = {
      ...(existing?.links || {}),
      ...rawLinks,
    };

    const sanitizedLinks = sanitizePlatformLinks(mergedLinks);
    const sanitizedCustomLinks = payload.customLinks
      ? sanitizeCustomLinks(payload.customLinks)
      : existing?.customLinks || [];

    const update = {
      links: sanitizedLinks,
      customLinks: sanitizedCustomLinks,
    };

    if (payload.displayName) {
      update.displayName = String(payload.displayName).trim().slice(0, 120);
    }

    if (payload.bio) {
      update.bio = String(payload.bio).trim().slice(0, 2000);
    }

    const profile = await artistRepository.upsertByUserId(user._id, update);
    return buildArtistPayload(user, profile);
  }
}

module.exports = ArtistService;
