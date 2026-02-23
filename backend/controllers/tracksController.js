const mongoose = require("mongoose");
const asyncHandler = require("../middleware/asyncHandler");
const Track = require("../models/Track");
const CreatorProfile = require("../models/CreatorProfile");
const { saveUploadedFile } = require("../services/mediaStore");
const { hasEntitlement } = require("../services/entitlementService");
const { buildSignedMediaUrl } = require("../services/mediaSigner");

const toTrackPayload = (track, { includeAudio = false } = {}) => ({
  _id: track._id.toString(),
  creatorId:
    track.creatorId?._id?.toString() ||
    track.creatorId?.toString() ||
    "",
  title: track.title || "",
  description: track.description || "",
  price: Number(track.price) || 0,
  previewUrl: track.previewUrl || "",
  durationSec: Number(track.durationSec) || 0,
  createdAt: track.createdAt,
  creator:
    track.creatorId && typeof track.creatorId === "object"
      ? {
          _id: track.creatorId._id?.toString() || "",
          displayName: track.creatorId.displayName || "",
          userId: track.creatorId.userId?._id?.toString() || track.creatorId.userId?.toString() || "",
          username: track.creatorId.userId?.username || "",
        }
      : null,
  ...(includeAudio ? { audioUrl: track.audioUrl || "" } : {}),
});

const canAccessFullTrack = async ({ track, userId }) => {
  if (!track) {
    return false;
  }

  if (Number(track.price) <= 0) {
    return true;
  }

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return false;
  }

  const creator =
    track.creatorId && typeof track.creatorId === "object" && track.creatorId.userId
      ? track.creatorId
      : await CreatorProfile.findById(track.creatorId).select("userId").lean();

  if (creator?.userId?.toString() === userId.toString()) {
    return true;
  }

  return hasEntitlement({
    userId,
    itemType: "track",
    itemId: track._id,
  });
};

exports.createTrack = asyncHandler(async (req, res) => {
  const title = String(req.body?.title || "").trim();
  const description = String(req.body?.description || "").trim();
  const price = Number(req.body?.price);
  const durationSec = Number(req.body?.durationSec || 0);

  if (!title) {
    return res.status(400).json({ error: "title is required" });
  }

  if (!Number.isFinite(price) || price < 0) {
    return res.status(400).json({ error: "price must be a valid non-negative number" });
  }

  let audioUrl = String(req.body?.audioUrl || "").trim();
  let previewUrl = String(req.body?.previewUrl || "").trim();

  const audioFile = req.files?.audio?.[0] || null;
  const previewFile = req.files?.preview?.[0] || null;

  if (audioFile) {
    audioUrl = await saveUploadedFile(audioFile);
  }

  if (previewFile) {
    previewUrl = await saveUploadedFile(previewFile);
  }

  if (!audioUrl) {
    return res.status(400).json({ error: "audioUrl or audio upload is required" });
  }

  if (price > 0 && !previewUrl) {
    return res.status(400).json({
      error: "previewUrl or preview upload is required for paid tracks",
    });
  }

  const track = await Track.create({
    creatorId: req.creatorProfile._id,
    title,
    description,
    price,
    audioUrl,
    previewUrl,
    durationSec: Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0,
  });

  const hydrated = await Track.findById(track._id)
    .populate({
      path: "creatorId",
      select: "displayName userId",
      populate: { path: "userId", select: "username" },
    })
    .lean();

  return res.status(201).json(toTrackPayload(hydrated, { includeAudio: true }));
});

exports.getTrackById = asyncHandler(async (req, res) => {
  const { trackId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(trackId)) {
    return res.status(400).json({ error: "Invalid track id" });
  }

  const track = await Track.findById(trackId)
    .populate({
      path: "creatorId",
      select: "displayName userId",
      populate: { path: "userId", select: "username" },
    })
    .lean();

  if (!track) {
    return res.status(404).json({ error: "Track not found" });
  }

  const allowed = await canAccessFullTrack({
    track,
    userId: req.user?.id,
  });

  return res.json({
    ...toTrackPayload(track),
    canPlayFull: allowed,
    previewLimitSec: 30,
  });
});

exports.getTrackStream = asyncHandler(async (req, res) => {
  const { trackId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(trackId)) {
    return res.status(400).json({ error: "Invalid track id" });
  }

  const track = await Track.findById(trackId)
    .populate("creatorId", "userId")
    .lean();

  if (!track) {
    return res.status(404).json({ error: "Track not found" });
  }

  const hasFullAccess = await canAccessFullTrack({
    track,
    userId: req.user?.id,
  });

  const sourceUrl = hasFullAccess
    ? track.audioUrl
    : track.previewUrl || track.audioUrl;

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
    allowedFullAccess: hasFullAccess,
    previewOnly: !hasFullAccess,
    previewLimitSec: 30,
    streamUrl,
  });
});
