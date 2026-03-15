const mongoose = require("mongoose");
const asyncHandler = require("../middleware/asyncHandler");
const Track = require("../models/Track");
const CreatorProfile = require("../models/CreatorProfile");
const { saveUploadedFile } = require("../services/mediaStore");
const { hasEntitlement } = require("../services/entitlementService");
const { buildSignedMediaUrl } = require("../services/mediaSigner");
const { logAnalyticsEvent } = require("../services/analyticsService");
const Post = require("../models/Post");
const { evaluateVerification } = require("../services/contentVerificationService");
const { creatorHasCategory } = require("../services/creatorProfileService");

const resolveRequestedStatus = (body = {}) => {
  const value = String(
    body?.publishedStatus || body?.publishMode || body?.status || ""
  )
    .trim()
    .toLowerCase();
  if (value === "draft" || body?.saveAsDraft === true || body?.saveAsDraft === "true") {
    return "draft";
  }
  return "published";
};

const toTrackPayload = (track, { includeAudio = false } = {}) => ({
  _id: track._id.toString(),
  creatorId:
    track.creatorId?._id?.toString() ||
    track.creatorId?.toString() ||
    "",
  title: track.title || "",
  description: track.description || "",
  price: Number(track.price) || 0,
  genre: track.genre || "",
  previewUrl: track.previewUrl || "",
  coverImageUrl: track.coverImageUrl || "",
  durationSec: Number(track.durationSec) || 0,
  createdAt: track.createdAt,
  updatedAt: track.updatedAt,
  publishedStatus: track.publishedStatus || (track.isPublished ? "published" : "draft"),
  copyrightScanStatus: track.copyrightScanStatus || "pending_scan",
  verificationNotes: track.verificationNotes || "",
  reviewRequired: Boolean(track.reviewRequired),
  creatorCategory: track.creatorCategory || (track.kind === "podcast" ? "podcasts" : "music"),
  contentType: track.contentType || (track.kind === "podcast" ? "podcast_episode" : "track"),
  podcastSeries: track.podcastSeries || "",
  seasonNumber: Number(track.seasonNumber || 0),
  episodeNumber: Number(track.episodeNumber || 0),
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
  const rawKind = String(req.body?.kind || "music").trim().toLowerCase();
  const kind = ["music", "podcast", "comedy"].includes(rawKind) ? rawKind : "music";
  const creatorCategory = kind === "podcast" ? "podcasts" : "music";
  const podcastSeries = String(req.body?.podcastSeries || "").trim();
  const seasonNumber = Number(req.body?.seasonNumber || 0);
  const episodeNumber = Number(req.body?.episodeNumber || 0);
  const requestedStatus = resolveRequestedStatus(req.body);
  const genre = String(req.body?.genre || "").trim();

  if (!creatorHasCategory(req.creatorProfile, creatorCategory)) {
    return res.status(403).json({
      error: `${creatorCategory === "podcasts" ? "Podcast" : "Music"} publishing is not enabled on this creator profile`,
    });
  }

  if (!title) {
    return res.status(400).json({ error: "title is required" });
  }

  if (!Number.isFinite(price) || price < 0) {
    return res.status(400).json({ error: "price must be a valid non-negative number" });
  }

  let audioUrl = String(req.body?.audioUrl || "").trim();
  let previewUrl = String(req.body?.previewUrl || "").trim();
  let coverImageUrl = String(req.body?.coverImageUrl || "").trim();

  const audioFile = req.files?.audio?.[0] || null;
  const previewFile = req.files?.preview?.[0] || null;
  const coverFile = req.files?.cover?.[0] || null;

  if (audioFile) {
    audioUrl = await saveUploadedFile(audioFile);
  }

  if (previewFile) {
    previewUrl = await saveUploadedFile(previewFile);
  }
  if (coverFile) {
    coverImageUrl = await saveUploadedFile(coverFile);
  }


  if (!audioUrl) {
    return res.status(400).json({ error: "audioUrl or audio upload is required" });
  }

  if (requestedStatus === "published" && price > 0 && !previewUrl) {
    return res.status(400).json({
      error: "previewUrl or preview upload is required for paid tracks",
    });
  }

  const verification = await evaluateVerification({
    creatorProfileId: req.creatorProfile._id,
    creatorCategory,
    contentType: kind === "podcast" ? "podcast_episode" : "track",
    requestedStatus,
    title,
    description,
    primaryFile: audioFile || null,
    metadata: {
      creatorId: req.creatorProfile._id?.toString?.() || "",
      genre,
      seriesName: podcastSeries,
    },
  });

  const track = await Track.create({
    creatorId: req.creatorProfile._id,
    title,
    description,
    price,
    audioUrl,
    previewUrl,
    coverImageUrl,
    durationSec: Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 0,
    genre,
    kind,
    podcastSeries: kind === "podcast" ? podcastSeries : "",
    seasonNumber: kind === "podcast" && Number.isFinite(seasonNumber) ? Math.max(0, seasonNumber) : 0,
    episodeNumber: kind === "podcast" && Number.isFinite(episodeNumber) ? Math.max(0, episodeNumber) : 0,
    creatorCategory,
    contentType: kind === "podcast" ? "podcast_episode" : "track",
    publishedStatus: verification.publishedStatus,
    copyrightScanStatus: verification.scanStatus,
    verificationNotes: verification.verificationNotes,
    reviewRequired: verification.reviewRequired,
    contentFingerprintHash: verification.contentFingerprintHash,
    contentFileHash: verification.contentFileHash,
    isPublished: verification.publishedStatus === "published",
    archivedAt: null,
  });

  const hydrated = await Track.findById(track._id)
    .populate({
      path: "creatorId",
      select: "displayName userId",
      populate: { path: "userId", select: "username" },
    })
    .lean();

  if (track.publishedStatus === "published") {
    try {
      await Post.create({
        author: req.user.id,
        text: `${track.title} is now available.`,
        tags: ["track"],
        audio: {
          trackId: track._id,
          url: track.audioUrl,
          previewUrl: track.previewUrl,
          title: track.title,
          durationSec: Number.isFinite(track.durationSec) ? track.durationSec : 0,
          coverImageUrl: track.coverImageUrl,
        },
        privacy: "public",
      });
    } catch (err) {
      console.error("Failed to create feed post for track:", err);
    }
  }

  await logAnalyticsEvent({
    type: kind === "podcast" ? "podcast_uploaded" : "song_uploaded",
    userId: req.user.id,
    actorRole: req.user.role,
    targetId: track._id,
    targetType: "track",
    contentType: kind,
    metadata: {
      creatorId: req.creatorProfile._id.toString(),
      price: Number(track.price || 0),
      title: track.title || "",
    },
  }).catch(() => null);

  return res.status(201).json(toTrackPayload(hydrated, { includeAudio: true }));
});

exports.updateTrack = asyncHandler(async (req, res) => {
  const { trackId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(trackId)) {
    return res.status(400).json({ error: "Invalid track id" });
  }

  const track = await Track.findById(trackId);
  if (!track || String(track.creatorId) !== String(req.creatorProfile._id)) {
    return res.status(404).json({ error: "Track not found" });
  }

  const nextKind = ["music", "podcast", "comedy"].includes(String(req.body?.kind || track.kind).trim().toLowerCase())
    ? String(req.body?.kind || track.kind).trim().toLowerCase()
    : track.kind;
  const creatorCategory = nextKind === "podcast" ? "podcasts" : "music";
  if (!creatorHasCategory(req.creatorProfile, creatorCategory)) {
    return res.status(403).json({
      error: `${creatorCategory === "podcasts" ? "Podcast" : "Music"} publishing is not enabled on this creator profile`,
    });
  }

  const requestedStatus = resolveRequestedStatus(req.body);
  const title = String(req.body?.title || track.title || "").trim();
  const description = String(req.body?.description || track.description || "").trim();
  const genre = String(req.body?.genre || track.genre || "").trim();
  const price = Number(req.body?.price ?? track.price ?? 0);
  const durationSec = Number(req.body?.durationSec ?? track.durationSec ?? 0);
  const podcastSeries = String(req.body?.podcastSeries ?? track.podcastSeries ?? "").trim();
  const seasonNumber = Number(req.body?.seasonNumber ?? track.seasonNumber ?? 0);
  const episodeNumber = Number(req.body?.episodeNumber ?? track.episodeNumber ?? 0);

  if (!title) {
    return res.status(400).json({ error: "title is required" });
  }
  if (!Number.isFinite(price) || price < 0) {
    return res.status(400).json({ error: "price must be a valid non-negative number" });
  }

  let audioUrl = String(req.body?.audioUrl || track.audioUrl || "").trim();
  let previewUrl = String(req.body?.previewUrl || track.previewUrl || "").trim();
  let coverImageUrl = String(req.body?.coverImageUrl || track.coverImageUrl || "").trim();

  const audioFile = req.files?.audio?.[0] || null;
  const previewFile = req.files?.preview?.[0] || null;
  const coverFile = req.files?.cover?.[0] || null;

  if (audioFile) {
    audioUrl = await saveUploadedFile(audioFile);
  }
  if (previewFile) {
    previewUrl = await saveUploadedFile(previewFile);
  }
  if (coverFile) {
    coverImageUrl = await saveUploadedFile(coverFile);
  }

  if (!audioUrl) {
    return res.status(400).json({ error: "audioUrl or audio upload is required" });
  }
  if (requestedStatus === "published" && price > 0 && !previewUrl) {
    return res.status(400).json({
      error: "previewUrl or preview upload is required for paid tracks",
    });
  }

  const verification = await evaluateVerification({
    creatorProfileId: req.creatorProfile._id,
    creatorCategory,
    contentType: nextKind === "podcast" ? "podcast_episode" : "track",
    requestedStatus,
    title,
    description,
    primaryFile: audioFile || null,
    metadata: {
      creatorId: req.creatorProfile._id?.toString?.() || "",
      genre,
      seriesName: podcastSeries,
    },
  });

  track.title = title;
  track.description = description;
  track.price = price;
  track.audioUrl = audioUrl;
  track.previewUrl = previewUrl;
  track.coverImageUrl = coverImageUrl;
  track.durationSec = Number.isFinite(durationSec) && durationSec >= 0 ? durationSec : 0;
  track.genre = genre;
  track.kind = nextKind;
  track.podcastSeries = nextKind === "podcast" ? podcastSeries : "";
  track.seasonNumber = nextKind === "podcast" && Number.isFinite(seasonNumber) ? Math.max(0, seasonNumber) : 0;
  track.episodeNumber = nextKind === "podcast" && Number.isFinite(episodeNumber) ? Math.max(0, episodeNumber) : 0;
  track.creatorCategory = creatorCategory;
  track.contentType = nextKind === "podcast" ? "podcast_episode" : "track";
  track.publishedStatus = verification.publishedStatus;
  track.copyrightScanStatus = verification.scanStatus;
  track.verificationNotes = verification.verificationNotes;
  track.reviewRequired = verification.reviewRequired;
  track.contentFingerprintHash = verification.contentFingerprintHash;
  if (verification.contentFileHash) {
    track.contentFileHash = verification.contentFileHash;
  }
  track.isPublished = verification.publishedStatus === "published";

  await track.save();

  const hydrated = await Track.findById(track._id)
    .populate({
      path: "creatorId",
      select: "displayName userId",
      populate: { path: "userId", select: "username" },
    })
    .lean();

  return res.json(toTrackPayload(hydrated, { includeAudio: true }));
});

exports.getTrackById = asyncHandler(async (req, res) => {
  const { trackId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(trackId)) {
    return res.status(400).json({ error: "Invalid track id" });
  }

  const track = await Track.findOne({ _id: trackId, isPublished: { $ne: false }, archivedAt: null })
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

  const track = await Track.findOne({ _id: trackId, isPublished: { $ne: false }, archivedAt: null })
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
