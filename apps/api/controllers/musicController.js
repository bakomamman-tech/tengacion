const mongoose = require("mongoose");

const Track = require("../../../backend/models/Track");
const { buildSignedMediaUrl } = require("../../../backend/services/mediaSigner");
const { getTrackStream } = require("../../../backend/controllers/tracksController");
const { mediaDocumentToUrl } = require("../../../backend/utils/cloudinaryMedia");
const ApiError = require("../utils/ApiError");

const toIdString = (value) => {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (value._id) {
    return value._id.toString();
  }
  return value.toString();
};

const resolvePreviewSourceUrl = (track = {}) =>
  mediaDocumentToUrl(track.previewMedia, track.previewUrl || "") ||
  mediaDocumentToUrl(track.previewClipMedia, track.previewClipUrl || "") ||
  mediaDocumentToUrl(track.audioMedia, track.audioUrl || "");

exports.previewTrack = async (req, res) => {
  const trackId = String(req.params.trackId || req.params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(trackId)) {
    throw ApiError.badRequest("Invalid track id");
  }

  const track = await Track.findOne({
    _id: trackId,
    isPublished: { $ne: false },
    archivedAt: null,
  }).lean();
  if (!track) {
    throw ApiError.notFound("Track not found");
  }

  const sourceUrl = resolvePreviewSourceUrl(track);
  if (!sourceUrl) {
    throw ApiError.notFound("Track preview is not available");
  }
  const hasDedicatedPreview = Boolean(
    mediaDocumentToUrl(track.previewMedia, track.previewUrl || "") ||
      mediaDocumentToUrl(track.previewClipMedia, track.previewClipUrl || "")
  );

  const streamUrl = buildSignedMediaUrl({
    sourceUrl,
    userId: req.user?.id || "",
    itemType: "track",
    itemId: track._id.toString(),
    req,
    expiresInSec: 5 * 60,
  });

  return res.json({
    itemId: track._id.toString(),
    trackId: track._id.toString(),
    creatorId: toIdString(track.creatorId),
    title: track.title || "",
    previewOnly: true,
    allowedFullAccess: false,
    previewStartSec: Number(track.previewStartSec || 0),
    previewLimitSec: Number(track.previewLimitSec || 30),
    streamUrl,
    previewUrl: streamUrl,
    source: hasDedicatedPreview ? "preview" : "full_fallback",
  });
};

exports.streamTrack = getTrackStream;
