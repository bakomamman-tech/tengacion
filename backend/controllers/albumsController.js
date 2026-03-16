const path = require("path");
const mongoose = require("mongoose");
const asyncHandler = require("../middleware/asyncHandler");
const Album = require("../models/Album");
const CreatorProfile = require("../models/CreatorProfile");
const { buildAlbumArchiveUrl } = require("../services/albumArchiveService");
const { saveUploadedFile } = require("../services/mediaStore");
const { hasEntitlement } = require("../services/entitlementService");
const { buildSignedMediaUrl } = require("../services/mediaSigner");
const { logAnalyticsEvent } = require("../services/analyticsService");
const { evaluateVerification } = require("../services/contentVerificationService");
const { creatorHasCategory } = require("../services/creatorProfileService");

const MAX_ALBUM_TRACKS = 25;
const MAX_TRACK_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
]);

const normalizeFilenameToTitle = (filename = "") =>
  String(filename || "")
    .replace(path.extname(String(filename || "")), "")
    .replace(/[_-]+/g, " ")
    .trim()
    .slice(0, 180);

const toAlbumListPayload = (album) => ({
  _id: album._id.toString(),
  creatorId: album.creatorId?.toString?.() || "",
  title: album.title || "",
  description: album.description || "",
  price: Number(album.price) || 0,
  coverUrl: album.coverUrl || "",
  totalTracks: Number(album.totalTracks || album.tracks?.length || 0),
  status: album.status || "published",
  releaseType: album.releaseType || album.contentType || "album",
  publishedStatus: album.publishedStatus || (album.isPublished ? "published" : "draft"),
  copyrightScanStatus: album.copyrightScanStatus || "pending_scan",
  verificationNotes: album.verificationNotes || "",
  reviewRequired: Boolean(album.reviewRequired),
  creatorCategory: "music",
  contentType: album.contentType || album.releaseType || "album",
  createdAt: album.createdAt,
  updatedAt: album.updatedAt,
});

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

const resolveAlbumOwnership = async ({ album, userId }) => {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return false;
  }

  const creator = await CreatorProfile.findById(album.creatorId).select("userId").lean();
  return String(creator?.userId || "") === String(userId);
};

exports.createAlbum = asyncHandler(async (req, res) => {
  if (!creatorHasCategory(req.creatorProfile, "music")) {
    return res.status(403).json({ error: "Music publishing is not enabled on this creator profile" });
  }

  const albumTitle = String(req.body?.albumTitle || req.body?.title || "").trim();
  const description = String(req.body?.description || "").trim();
  const price = Number(req.body?.price);
  const releaseType = String(req.body?.releaseType || req.body?.contentType || "album").trim().toLowerCase() === "ep"
    ? "ep"
    : "album";
  const requestedStatus = resolveRequestedStatus(req.body);
  const coverFile = req.files?.coverImage?.[0] || req.files?.cover?.[0] || null;
  const trackFiles = [
    ...(Array.isArray(req.files?.tracks) ? req.files.tracks : []),
    ...(Array.isArray(req.files?.["tracks[]"]) ? req.files["tracks[]"] : []),
  ];
  const previewFiles = [
    ...(Array.isArray(req.files?.previews) ? req.files.previews : []),
    ...(Array.isArray(req.files?.["previews[]"]) ? req.files["previews[]"] : []),
  ];

  if (!albumTitle) {
    return res.status(400).json({ error: "albumTitle is required" });
  }
  if (!Number.isFinite(price) || price < 0) {
    return res.status(400).json({ error: "price must be a valid non-negative number" });
  }
  if (!coverFile || !String(coverFile.mimetype || "").toLowerCase().startsWith("image/")) {
    return res.status(400).json({ error: "coverImage is required and must be an image file" });
  }
  if (trackFiles.length < 1 || trackFiles.length > MAX_ALBUM_TRACKS) {
    return res.status(400).json({
      error: "You can upload a maximum of 25 songs per album.",
    });
  }

  const hasInvalidAudioMime = [...trackFiles, ...previewFiles].some((file) => {
    const mime = String(file?.mimetype || "").toLowerCase();
    return !(mime.startsWith("audio/") || ALLOWED_AUDIO_TYPES.has(mime));
  });
  if (hasInvalidAudioMime) {
    return res.status(400).json({ error: "All tracks and previews must be audio files." });
  }

  const oversizedTrack = trackFiles.find((file) => Number(file?.size || 0) > MAX_TRACK_FILE_SIZE_BYTES);
  if (oversizedTrack) {
    return res.status(413).json({
      error: "Track file is too large. Maximum per track is 25MB.",
      file: oversizedTrack.originalname || "",
    });
  }

  const oversizedPreview = previewFiles.find((file) => Number(file?.size || 0) > MAX_TRACK_FILE_SIZE_BYTES);
  if (oversizedPreview) {
    return res.status(413).json({
      error: "Preview file is too large. Maximum per preview is 25MB.",
      file: oversizedPreview.originalname || "",
    });
  }

  const coverUrl = await saveUploadedFile(coverFile);
  const previewsMatch = previewFiles.length > 0 && previewFiles.length === trackFiles.length;
  const previewUrls = [];
  if (previewsMatch) {
    for (const previewFile of previewFiles) {
      const previewUrl = await saveUploadedFile(previewFile);
      previewUrls.push(previewUrl);
    }
  }

  const tracks = [];
  for (let index = 0; index < trackFiles.length; index += 1) {
    const trackFile = trackFiles[index];
    const trackUrl = await saveUploadedFile(trackFile);
    tracks.push({
      title: normalizeFilenameToTitle(trackFile.originalname) || `Track ${index + 1}`,
      trackUrl,
      previewUrl: previewsMatch ? previewUrls[index] || "" : "",
      order: index + 1,
    });
  }

  const verification = await evaluateVerification({
    creatorProfileId: req.creatorProfile._id,
    creatorCategory: "music",
    contentType: releaseType,
    requestedStatus,
    title: albumTitle,
    description,
    primaryFile: trackFiles[0] || coverFile || null,
    metadata: {
      creatorId: req.creatorProfile._id?.toString?.() || "",
      tracksCount: trackFiles.length,
      releaseType,
    },
  });

  const album = await Album.create({
    creatorId: req.creatorProfile._id,
    title: albumTitle,
    description: description.slice(0, 4000),
    price,
    releaseType,
    contentType: releaseType,
    coverUrl,
    tracks,
    status: verification.publishedStatus === "published" ? "published" : "draft",
    publishedStatus: verification.publishedStatus,
    copyrightScanStatus: verification.scanStatus,
    verificationNotes: verification.verificationNotes,
    reviewRequired: verification.reviewRequired,
    contentFingerprintHash: verification.contentFingerprintHash,
    contentFileHash: verification.contentFileHash,
    totalTracks: tracks.length,
    isPublished: verification.publishedStatus === "published",
    archivedAt: null,
  });

  await logAnalyticsEvent({
    type: "album_uploaded",
    userId: req.user.id,
    actorRole: req.user.role,
    targetId: album._id,
    targetType: "album",
    contentType: "album",
    metadata: {
      creatorId: req.creatorProfile._id.toString(),
      price: Number(album.price || 0),
      title: album.title || "",
      tracksCount: tracks.length,
    },
  }).catch(() => null);

  return res.status(201).json({
    ...toAlbumListPayload(album),
    tracks,
    previewMappingIgnored: previewFiles.length > 0 && !previewsMatch,
  });
});

exports.updateAlbum = asyncHandler(async (req, res) => {
  const { albumId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(albumId)) {
    return res.status(400).json({ error: "Invalid album id" });
  }
  if (!creatorHasCategory(req.creatorProfile, "music")) {
    return res.status(403).json({ error: "Music publishing is not enabled on this creator profile" });
  }

  const album = await Album.findById(albumId);
  if (!album || String(album.creatorId) !== String(req.creatorProfile._id)) {
    return res.status(404).json({ error: "Album not found" });
  }

  const title = String(req.body?.albumTitle || req.body?.title || album.title || "").trim();
  const description = String(req.body?.description || album.description || "").trim();
  const price = Number(req.body?.price ?? album.price ?? 0);
  const releaseType = String(req.body?.releaseType || req.body?.contentType || album.releaseType || "album")
    .trim()
    .toLowerCase() === "ep"
    ? "ep"
    : "album";
  const requestedStatus = resolveRequestedStatus(req.body);

  if (!title) {
    return res.status(400).json({ error: "albumTitle is required" });
  }
  if (!Number.isFinite(price) || price < 0) {
    return res.status(400).json({ error: "price must be a valid non-negative number" });
  }

  const coverFile = req.files?.coverImage?.[0] || req.files?.cover?.[0] || null;
  let coverUrl = String(req.body?.coverUrl || album.coverUrl || "").trim();
  if (coverFile) {
    coverUrl = await saveUploadedFile(coverFile);
  }
  if (!coverUrl) {
    return res.status(400).json({ error: "coverImage is required and must be an image file" });
  }

  const verification = await evaluateVerification({
    creatorProfileId: req.creatorProfile._id,
    creatorCategory: "music",
    contentType: releaseType,
    requestedStatus,
    title,
    description,
    primaryFile: coverFile || null,
    metadata: {
      creatorId: req.creatorProfile._id?.toString?.() || "",
      tracksCount: Array.isArray(album.tracks) ? album.tracks.length : 0,
      releaseType,
    },
  });

  album.title = title;
  album.description = description.slice(0, 4000);
  album.price = price;
  album.coverUrl = coverUrl;
  album.releaseType = releaseType;
  album.contentType = releaseType;
  album.status = verification.publishedStatus === "published" ? "published" : "draft";
  album.publishedStatus = verification.publishedStatus;
  album.copyrightScanStatus = verification.scanStatus;
  album.verificationNotes = verification.verificationNotes;
  album.reviewRequired = verification.reviewRequired;
  album.contentFingerprintHash = verification.contentFingerprintHash;
  if (verification.contentFileHash) {
    album.contentFileHash = verification.contentFileHash;
  }
  album.isPublished = verification.publishedStatus === "published";

  await album.save();

  return res.json({
    ...toAlbumListPayload(album),
    tracks: Array.isArray(album.tracks) ? album.tracks : [],
  });
});

exports.getCreatorAlbums = asyncHandler(async (req, res) => {
  const { creatorId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(creatorId)) {
    return res.status(400).json({ error: "Invalid creator id" });
  }

  const albums = await Album.find({ creatorId, status: "published", isPublished: { $ne: false }, archivedAt: null })
    .sort({ createdAt: -1 })
    .lean();

  return res.json(albums.map(toAlbumListPayload));
});

exports.getAlbumById = asyncHandler(async (req, res) => {
  const { albumId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(albumId)) {
    return res.status(400).json({ error: "Invalid album id" });
  }

  const album = await Album.findOne({ _id: albumId, isPublished: { $ne: false }, archivedAt: null }).lean();
  if (!album) {
    return res.status(404).json({ error: "Album not found" });
  }

  const isOwner = await resolveAlbumOwnership({ album, userId: req.user?.id });
  const entitled = req.user?.id
    ? await hasEntitlement({ userId: req.user.id, itemType: "album", itemId: album._id })
    : false;
  const canPlayFull = Number(album.price || 0) <= 0 || isOwner || entitled;

  const tracks = (Array.isArray(album.tracks) ? album.tracks : [])
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    .map((track, index) => {
      const fullUrl = String(track.trackUrl || "");
      const previewUrl = String(track.previewUrl || "");
      const sourceUrl = canPlayFull ? fullUrl : previewUrl;
      return {
        title: track.title || `Track ${index + 1}`,
        order: Number(track.order || index + 1),
        duration: Number(track.duration || 0),
        previewUrl,
        trackUrl: canPlayFull ? fullUrl : "",
        streamUrl: sourceUrl
          ? buildSignedMediaUrl({
              sourceUrl,
              itemType: "album",
              itemId: album._id.toString(),
              userId: req.user?.id || "",
              req,
              expiresInSec: 10 * 60,
            })
          : "",
        downloadUrl: canPlayFull && fullUrl
          ? buildSignedMediaUrl({
              sourceUrl: fullUrl,
              itemType: "album",
              itemId: album._id.toString(),
              userId: req.user?.id || "",
              req,
              allowDownload: true,
              expiresInSec: 10 * 60,
            })
          : "",
      };
    });

  return res.json({
    ...toAlbumListPayload(album),
    canPlayFull,
    downloadUrl: canPlayFull
      ? buildAlbumArchiveUrl({
          albumId: album._id.toString(),
          req,
          userId: req.user?.id || "",
        })
      : "",
    tracks,
  });
});
