const asyncHandler = require("../middleware/asyncHandler");
const User = require("../models/User");
const Video = require("../models/Video");
const { saveUploadedFile } = require("../services/mediaStore");
const { logAnalyticsEvent } = require("../services/analyticsService");
const { evaluateVerification } = require("../services/contentVerificationService");
const { creatorHasCategory } = require("../services/creatorProfileService");
const {
  IMAGE_EXTENSIONS,
  IMAGE_MIME_TYPES,
  VIDEO_EXTENSIONS,
  VIDEO_MIME_TYPES,
  getExtension,
  validateFile,
} = require("../services/creatorUploadValidation");

const sendBadRequest = (res, error) => res.status(400).json({ error });

const parseNonNegativeNumber = (value, { fallback = 0 } = {}) => {
  if (value === "" || value === undefined || value === null) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return Number.NaN;
  }
  return parsed;
};

const inferUploadedFormat = (file) => {
  const extension = getExtension(file);
  return extension ? extension.slice(1) : String(file?.mimetype || "").split("/")[1] || "";
};

const resolveRequestedStatus = (body = {}) => {
  const value = String(body?.publishedStatus || body?.publishMode || body?.status || "")
    .trim()
    .toLowerCase();
  if (value === "draft" || body?.saveAsDraft === true || body?.saveAsDraft === "true") {
    return "draft";
  }
  return "published";
};

const toVideoPayload = (video) => ({
  _id: String(video?._id || ""),
  title: String(video?.caption || "Music video"),
  description: String(video?.description || video?.caption || ""),
  videoUrl: String(video?.videoUrl || ""),
  coverImageUrl: String(video?.coverImageUrl || ""),
  previewClipUrl: String(video?.previewClipUrl || ""),
  price: Number(video?.price || 0),
  isFree: Boolean(video?.isFree),
  durationSec: Number(video?.durationSec || 0),
  videoFormat: String(video?.videoFormat || ""),
  creatorCategory: String(video?.creatorCategory || "music"),
  contentType: String(video?.contentType || "music_video"),
  publishedStatus: String(video?.publishedStatus || (video?.isPublished ? "published" : "draft")),
  copyrightScanStatus: String(video?.copyrightScanStatus || "pending_scan"),
  verificationNotes: String(video?.verificationNotes || ""),
  reviewRequired: Boolean(video?.reviewRequired),
  viewsCount: Number(video?.viewsCount || 0),
  createdAt: video?.createdAt || video?.time || null,
  updatedAt: video?.updatedAt || video?.time || null,
});

const resolveUploadFields = async ({ req, current = null }) => {
  let videoUrl = String(req.body?.videoUrl || current?.videoUrl || "").trim();
  let coverImageUrl = String(req.body?.coverImageUrl || current?.coverImageUrl || "").trim();
  let previewClipUrl = String(req.body?.previewClipUrl || current?.previewClipUrl || "").trim();

  const videoFile = req.files?.video?.[0] || null;
  const thumbnailFile = req.files?.thumbnail?.[0] || null;
  const previewClipFile = req.files?.previewClip?.[0] || null;

  if (videoFile) {
    videoUrl = await saveUploadedFile(videoFile);
  }
  if (thumbnailFile) {
    coverImageUrl = await saveUploadedFile(thumbnailFile);
  }
  if (previewClipFile) {
    previewClipUrl = await saveUploadedFile(previewClipFile);
  }

  return {
    videoUrl,
    coverImageUrl,
    previewClipUrl,
    videoFile,
    thumbnailFile,
    previewClipFile,
  };
};

exports.createCreatorVideo = asyncHandler(async (req, res) => {
  if (!creatorHasCategory(req.creatorProfile, "music")) {
    return res.status(403).json({ error: "Music publishing is not enabled on this creator profile" });
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const title = String(req.body?.title || req.body?.caption || "").trim();
  const description = String(req.body?.description || "").trim();
  const price = parseNonNegativeNumber(req.body?.price, { fallback: 0 });
  const durationSec = parseNonNegativeNumber(req.body?.durationSec, { fallback: 0 });
  const requestedStatus = resolveRequestedStatus(req.body);
  const {
    videoUrl,
    coverImageUrl,
    previewClipUrl,
    videoFile,
    thumbnailFile,
    previewClipFile,
  } = await resolveUploadFields({
    req,
  });

  if (!videoUrl) {
    return sendBadRequest(res, "Video file or videoUrl is required");
  }
  if (!Number.isFinite(price)) {
    return sendBadRequest(res, "price must be a valid non-negative number");
  }
  if (!Number.isFinite(durationSec)) {
    return sendBadRequest(res, "durationSec must be a valid non-negative number");
  }

  const videoError = validateFile(videoFile, {
    label: "Video upload",
    allowedExtensions: VIDEO_EXTENSIONS,
    allowedMimeTypes: VIDEO_MIME_TYPES,
  });
  if (videoError) {
    return sendBadRequest(res, videoError);
  }

  const previewError = validateFile(previewClipFile, {
    label: "Preview clip",
    allowedExtensions: VIDEO_EXTENSIONS,
    allowedMimeTypes: VIDEO_MIME_TYPES,
  });
  if (previewError) {
    return sendBadRequest(res, previewError);
  }

  const thumbnailError = validateFile(thumbnailFile, {
    label: "Thumbnail image",
    allowedExtensions: IMAGE_EXTENSIONS,
    allowedMimeTypes: IMAGE_MIME_TYPES,
  });
  if (thumbnailError) {
    return sendBadRequest(res, thumbnailError);
  }

  if (requestedStatus === "published" && price > 0 && !previewClipUrl) {
    return sendBadRequest(res, "A preview clip is required before publishing a paid music video");
  }

  const verification = await evaluateVerification({
    creatorProfileId: req.creatorProfile._id,
    creatorCategory: "music",
    contentType: "music_video",
    requestedStatus,
    title,
    description,
    primaryFile: videoFile || thumbnailFile || null,
    metadata: {
      creatorId: req.creatorProfile?._id?.toString?.() || "",
      hasPreviewClip: Boolean(previewClipUrl),
      durationSec,
    },
  });

  const video = await Video.create({
    userId: user._id,
    name: user.name,
    username: user.username,
    avatar: user.avatar,
    creatorProfileId: req.creatorProfile?._id || null,
    videoUrl,
    coverImageUrl,
    previewClipUrl,
    caption: title || description || "",
    description,
    durationSec,
    videoFormat: inferUploadedFormat(videoFile),
    price,
    isFree: price <= 0,
    creatorCategory: "music",
    contentType: "music_video",
    publishedStatus: verification.publishedStatus,
    copyrightScanStatus: verification.scanStatus,
    verificationNotes: verification.verificationNotes,
    reviewRequired: verification.reviewRequired,
    contentFingerprintHash: verification.contentFingerprintHash,
    contentFileHash: verification.contentFileHash,
    isPublished: verification.publishedStatus === "published",
    archivedAt: null,
    likes: [],
    comments: [],
  });

  await logAnalyticsEvent({
    type: "video_uploaded",
    userId: req.user.id,
    actorRole: req.user.role,
    targetId: video._id,
    targetType: "video",
    contentType: "video",
    metadata: {
      creatorId: req.creatorProfile?._id?.toString?.() || "",
      price: Number(video.price || 0),
      title: video.caption || "",
    },
  }).catch(() => null);

  return res.status(201).json(toVideoPayload(video));
});

exports.listCreatorVideos = asyncHandler(async (req, res) => {
  const videos = await Video.find({
    creatorProfileId: req.creatorProfile?._id || null,
    archivedAt: null,
  }).sort({ time: -1 });

  return res.json(videos.map(toVideoPayload));
});

exports.updateCreatorVideo = asyncHandler(async (req, res) => {
  if (!creatorHasCategory(req.creatorProfile, "music")) {
    return res.status(403).json({ error: "Music publishing is not enabled on this creator profile" });
  }

  const video = await Video.findById(req.params.id);
  if (!video || String(video.creatorProfileId || "") !== String(req.creatorProfile?._id || "")) {
    return res.status(404).json({ error: "Video not found" });
  }

  const title = String(req.body?.title || req.body?.caption || video.caption || "").trim();
  const description = String(req.body?.description ?? video.description ?? video.caption ?? "").trim();
  const price = parseNonNegativeNumber(req.body?.price, { fallback: Number(video.price || 0) });
  const durationSec = parseNonNegativeNumber(req.body?.durationSec, { fallback: Number(video.durationSec || 0) });
  const requestedStatus = resolveRequestedStatus(req.body);
  const {
    videoUrl,
    coverImageUrl,
    previewClipUrl,
    videoFile,
    thumbnailFile,
    previewClipFile,
  } = await resolveUploadFields({
    req,
    current: video,
  });

  if (!videoUrl) {
    return sendBadRequest(res, "Video file or videoUrl is required");
  }
  if (!Number.isFinite(price)) {
    return sendBadRequest(res, "price must be a valid non-negative number");
  }
  if (!Number.isFinite(durationSec)) {
    return sendBadRequest(res, "durationSec must be a valid non-negative number");
  }

  const videoError = validateFile(videoFile, {
    label: "Video upload",
    allowedExtensions: VIDEO_EXTENSIONS,
    allowedMimeTypes: VIDEO_MIME_TYPES,
  });
  if (videoError) {
    return sendBadRequest(res, videoError);
  }

  const previewError = validateFile(previewClipFile, {
    label: "Preview clip",
    allowedExtensions: VIDEO_EXTENSIONS,
    allowedMimeTypes: VIDEO_MIME_TYPES,
  });
  if (previewError) {
    return sendBadRequest(res, previewError);
  }

  const thumbnailError = validateFile(thumbnailFile, {
    label: "Thumbnail image",
    allowedExtensions: IMAGE_EXTENSIONS,
    allowedMimeTypes: IMAGE_MIME_TYPES,
  });
  if (thumbnailError) {
    return sendBadRequest(res, thumbnailError);
  }

  if (requestedStatus === "published" && price > 0 && !previewClipUrl) {
    return sendBadRequest(res, "A preview clip is required before publishing a paid music video");
  }

  const verification = await evaluateVerification({
    creatorProfileId: req.creatorProfile._id,
    creatorCategory: "music",
    contentType: "music_video",
    requestedStatus,
    title,
    description,
    primaryFile: videoFile || thumbnailFile || null,
    metadata: {
      creatorId: req.creatorProfile?._id?.toString?.() || "",
      hasPreviewClip: Boolean(previewClipUrl),
      durationSec,
    },
  });

  video.videoUrl = videoUrl;
  video.coverImageUrl = coverImageUrl;
  video.previewClipUrl = previewClipUrl;
  video.caption = title || description || "";
  video.description = description;
  video.price = price;
  video.isFree = price <= 0;
  video.durationSec = durationSec;
  if (videoFile) {
    video.videoFormat = inferUploadedFormat(videoFile);
  }
  video.publishedStatus = verification.publishedStatus;
  video.copyrightScanStatus = verification.scanStatus;
  video.verificationNotes = verification.verificationNotes;
  video.reviewRequired = verification.reviewRequired;
  video.contentFingerprintHash = verification.contentFingerprintHash;
  if (verification.contentFileHash) {
    video.contentFileHash = verification.contentFileHash;
  }
  video.isPublished = verification.publishedStatus === "published";

  await video.save();
  return res.json(toVideoPayload(video));
});

exports.likeCreatorVideo = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id);
  if (!video) {
    return res.status(404).json({ error: "Video not found" });
  }

  if (!video.likes.includes(req.user.id)) {
    video.likes.push(req.user.id);
    await video.save();
  }

  return res.json(toVideoPayload(video));
});
