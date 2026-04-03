const mongoose = require("mongoose");
const asyncHandler = require("../middleware/asyncHandler");
const Track = require("../models/Track");
const CreatorProfile = require("../models/CreatorProfile");
const { saveUploadedMedia } = require("../services/mediaStore");
const { hasEntitlement } = require("../services/entitlementService");
const { buildSignedMediaUrl } = require("../services/mediaSigner");
const { logAnalyticsEvent } = require("../services/analyticsService");
const Post = require("../models/Post");
const { evaluateVerification } = require("../services/contentVerificationService");
const { creatorHasCategory } = require("../services/creatorProfileService");
const { cleanupReplacedMedia, mediaDocumentToUrl, toMediaDocument } = require("../utils/cloudinaryMedia");

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

const inferUploadedFormat = (file) => {
  const originalName = String(file?.originalname || "");
  const dotIndex = originalName.lastIndexOf(".");
  if (dotIndex >= 0) {
    return originalName.slice(dotIndex + 1).toLowerCase();
  }
  return String(file?.mimetype || "").split("/")[1] || "";
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
  artistName: track.artistName || "",
  releaseType: track.releaseType || "single",
  explicitContent: Boolean(track.explicitContent),
  featuringArtists: Array.isArray(track.featuringArtists) ? track.featuringArtists : [],
  producerCredits: Array.isArray(track.producerCredits) ? track.producerCredits : [],
  songwriterCredits: Array.isArray(track.songwriterCredits) ? track.songwriterCredits : [],
  releaseDate: track.releaseDate || null,
  lyrics: track.lyrics || "",
  audioFormat: track.audioFormat || "",
  mediaType: track.mediaType || (track.videoUrl ? "video" : "audio"),
  videoFormat: track.videoFormat || "",
  previewUrl: mediaDocumentToUrl(track.previewMedia, track.previewUrl || ""),
  previewStartSec: Number(track.previewStartSec || 0),
  previewLimitSec: Number(track.previewLimitSec || 30),
  coverImageUrl: mediaDocumentToUrl(track.coverMedia, track.coverImageUrl || ""),
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
  podcastCategory: track.podcastCategory || "",
  episodeType: track.episodeType || "free",
  guestNames: Array.isArray(track.guestNames) ? track.guestNames : [],
  showNotes: track.showNotes || "",
  transcriptUrl: mediaDocumentToUrl(track.transcriptMedia, track.transcriptUrl || ""),
  episodeTags: Array.isArray(track.episodeTags) ? track.episodeTags : [],
  creator:
    track.creatorId && typeof track.creatorId === "object"
      ? {
          _id: track.creatorId._id?.toString() || "",
          displayName: track.creatorId.displayName || "",
          userId: track.creatorId.userId?._id?.toString() || track.creatorId.userId?.toString() || "",
          username: track.creatorId.userId?.username || "",
        }
      : null,
  ...(includeAudio
    ? {
        audioUrl: mediaDocumentToUrl(track.audioMedia, track.audioUrl || ""),
        videoUrl: mediaDocumentToUrl(track.videoMedia, track.videoUrl || ""),
      }
    : {}),
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
    creatorId: track.creatorId?._id || track.creatorId,
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
  const previewStartSec = Math.max(0, Number(req.body?.previewStartSec || 0));

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
  let audioMedia = null;
  let previewMedia = null;
  let coverMedia = null;

  const audioFile = req.files?.audio?.[0] || null;
  const previewFile = req.files?.preview?.[0] || null;
  const coverFile = req.files?.cover?.[0] || null;

  if (audioFile) {
    audioMedia = await saveUploadedMedia(audioFile, {
      source: kind === "podcast" ? "creator_podcast_audio" : "creator_music_audio",
      resourceType: "video",
    });
    audioUrl = mediaDocumentToUrl(audioMedia);
  }

  if (previewFile) {
    previewMedia = await saveUploadedMedia(previewFile, {
      source: kind === "podcast" ? "creator_podcast_preview" : "creator_music_preview",
      resourceType: "video",
    });
    previewUrl = mediaDocumentToUrl(previewMedia);
  }
  if (coverFile) {
    coverMedia = await saveUploadedMedia(coverFile, {
      source: kind === "podcast" ? "creator_podcast_cover" : "creator_music_cover",
      resourceType: "image",
    });
    coverImageUrl = mediaDocumentToUrl(coverMedia);
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
    audioMedia: audioMedia ? toMediaDocument(audioMedia) : null,
    previewUrl,
    previewMedia: previewMedia ? toMediaDocument(previewMedia) : null,
    previewStartSec,
    previewLimitSec: 30,
    coverImageUrl,
    coverMedia: coverMedia ? toMediaDocument(coverMedia) : null,
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
  const previewStartSec = Math.max(0, Number(req.body?.previewStartSec ?? track.previewStartSec ?? 0));
  const mediaType = nextKind === "podcast"
    ? (String(req.body?.mediaType || track.mediaType || (track.videoUrl ? "video" : "audio")).trim().toLowerCase() === "video"
        ? "video"
        : "audio")
    : "audio";

  if (!title) {
    return res.status(400).json({ error: "title is required" });
  }
  if (!Number.isFinite(price) || price < 0) {
    return res.status(400).json({ error: "price must be a valid non-negative number" });
  }

  let audioUrl = String(req.body?.audioUrl || track.audioUrl || "").trim();
  let videoUrl = String(req.body?.videoUrl || track.videoUrl || "").trim();
  let previewUrl = String(req.body?.previewUrl || track.previewUrl || "").trim();
  let previewClipUrl = String(req.body?.previewClipUrl || track.previewClipUrl || "").trim();
  let coverImageUrl = String(req.body?.coverImageUrl || track.coverImageUrl || "").trim();
  let audioMedia = track.audioMedia || null;
  let videoMedia = track.videoMedia || null;
  let previewMedia = track.previewMedia || null;
  let previewClipMedia = track.previewClipMedia || null;
  let coverMedia = track.coverMedia || null;

  const previousAudioMedia = track.audioMedia || null;
  const previousVideoMedia = track.videoMedia || null;
  const previousPreviewMedia = track.previewMedia || null;
  const previousPreviewClipMedia = track.previewClipMedia || null;
  const previousCoverMedia = track.coverMedia || null;

  const mediaFile = req.files?.media?.[0] || req.files?.audio?.[0] || req.files?.video?.[0] || null;
  const previewFile = req.files?.preview?.[0] || req.files?.previewClip?.[0] || null;
  const coverFile = req.files?.cover?.[0] || null;

  if (mediaFile) {
    const uploadedMedia = await saveUploadedMedia(mediaFile, {
      source:
        nextKind === "podcast"
          ? mediaType === "video"
            ? "creator_podcast_video"
            : "creator_podcast_audio"
          : "creator_music_audio",
      resourceType: mediaType === "video" ? "video" : "video",
    });
    audioMedia = toMediaDocument(uploadedMedia);
    audioUrl = mediaDocumentToUrl(uploadedMedia);
    if (mediaType === "video") {
      videoMedia = toMediaDocument(uploadedMedia);
      videoUrl = audioUrl;
    }
  }
  if (previewFile) {
    const uploadedPreview = await saveUploadedMedia(previewFile, {
      source: nextKind === "podcast" ? "creator_podcast_preview" : "creator_music_preview",
      resourceType: mediaType === "video" ? "video" : "video",
    });
    previewMedia = toMediaDocument(uploadedPreview);
    previewUrl = mediaDocumentToUrl(uploadedPreview);
    if (mediaType === "video") {
      previewClipMedia = toMediaDocument(uploadedPreview);
      previewClipUrl = previewUrl;
    }
  }
  if (coverFile) {
    const uploadedCover = await saveUploadedMedia(coverFile, {
      source: nextKind === "podcast" ? "creator_podcast_cover" : "creator_music_cover",
      resourceType: "image",
    });
    coverMedia = toMediaDocument(uploadedCover);
    coverImageUrl = mediaDocumentToUrl(uploadedCover);
  }

  if (!audioUrl) {
    return res.status(400).json({
      error: mediaType === "video" ? "videoUrl or video upload is required" : "audioUrl or audio upload is required",
    });
  }
  if (requestedStatus === "published" && price > 0 && !previewUrl) {
    return res.status(400).json({
      error:
        mediaType === "video"
          ? "previewClipUrl or preview clip upload is required for paid video podcasts"
          : "previewUrl or preview upload is required for paid tracks",
    });
  }

  const verification = await evaluateVerification({
    creatorProfileId: req.creatorProfile._id,
    creatorCategory,
    contentType: nextKind === "podcast" ? "podcast_episode" : "track",
    requestedStatus,
    title,
    description,
    primaryFile: mediaFile || null,
    metadata: {
      creatorId: req.creatorProfile._id?.toString?.() || "",
      genre,
      seriesName: podcastSeries,
      mediaType,
    },
  });

  track.title = title;
  track.description = description;
  track.price = price;
  track.audioUrl = audioUrl;
  track.fullAudioUrl = audioUrl;
  track.audioMedia = audioMedia;
  track.mediaType = mediaType;
  track.videoUrl = mediaType === "video" ? (videoUrl || audioUrl) : "";
  track.videoMedia = mediaType === "video" ? (videoMedia || audioMedia) : null;
  track.previewUrl = previewUrl;
  track.previewSampleUrl = previewUrl;
  track.previewMedia = previewMedia;
  track.previewClipUrl = mediaType === "video" ? (previewClipUrl || previewUrl) : "";
  track.previewClipMedia = mediaType === "video" ? (previewClipMedia || previewMedia) : null;
  track.coverImageUrl = coverImageUrl;
  track.coverMedia = coverMedia;
  track.durationSec = Number.isFinite(durationSec) && durationSec >= 0 ? durationSec : 0;
  track.previewStartSec = previewStartSec;
  track.previewLimitSec = 30;
  track.genre = genre;
  track.audioFormat = mediaType === "audio" && mediaFile ? inferUploadedFormat(mediaFile) : track.audioFormat;
  track.videoFormat = mediaType === "video" && mediaFile ? inferUploadedFormat(mediaFile) : "";
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
  await Promise.all([
    mediaFile ? cleanupReplacedMedia(previousAudioMedia, track.audioMedia) : Promise.resolve(false),
    (mediaFile || previousVideoMedia) && mediaType === "video"
      ? cleanupReplacedMedia(previousVideoMedia, track.videoMedia)
      : previousVideoMedia && mediaType !== "video"
        ? cleanupReplacedMedia(previousVideoMedia, null)
      : Promise.resolve(false),
    previewFile ? cleanupReplacedMedia(previousPreviewMedia, track.previewMedia) : Promise.resolve(false),
    (previewFile || previousPreviewClipMedia) && mediaType === "video"
      ? cleanupReplacedMedia(previousPreviewClipMedia, track.previewClipMedia)
      : previousPreviewClipMedia && mediaType !== "video"
        ? cleanupReplacedMedia(previousPreviewClipMedia, null)
      : Promise.resolve(false),
    coverFile ? cleanupReplacedMedia(previousCoverMedia, track.coverMedia) : Promise.resolve(false),
  ]).catch(() => null);

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
    previewStartSec: Number(track.previewStartSec || 0),
    previewLimitSec: Number(track.previewLimitSec || 30),
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
    previewStartSec: Number(track.previewStartSec || 0),
    previewLimitSec: Number(track.previewLimitSec || 30),
    streamUrl,
  });
});
