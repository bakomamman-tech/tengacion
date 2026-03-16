const asyncHandler = require("../middleware/asyncHandler");
const User = require("../models/User");
const Video = require("../models/Video");
const { saveUploadedFile } = require("../services/mediaStore");
const { logAnalyticsEvent } = require("../services/analyticsService");
const { evaluateVerification } = require("../services/contentVerificationService");
const { creatorHasCategory } = require("../services/creatorProfileService");

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
  description: String(video?.caption || ""),
  videoUrl: String(video?.videoUrl || ""),
  coverImageUrl: String(video?.coverImageUrl || ""),
  previewClipUrl: String(video?.previewClipUrl || ""),
  price: Number(video?.price || 0),
  isFree: Boolean(video?.isFree),
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
  const price = Number(req.body?.price || 0);
  const requestedStatus = resolveRequestedStatus(req.body);
  const { videoUrl, coverImageUrl, previewClipUrl, videoFile, thumbnailFile } = await resolveUploadFields({
    req,
  });

  if (!videoUrl) {
    return res.status(400).json({ error: "Video file or videoUrl is required" });
  }
  if (!Number.isFinite(price) || price < 0) {
    return res.status(400).json({ error: "price must be a valid non-negative number" });
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
  const description = String(req.body?.description || video.caption || "").trim();
  const price = Number(req.body?.price ?? video.price ?? 0);
  const requestedStatus = resolveRequestedStatus(req.body);
  const { videoUrl, coverImageUrl, previewClipUrl, videoFile, thumbnailFile } = await resolveUploadFields({
    req,
    current: video,
  });

  if (!videoUrl) {
    return res.status(400).json({ error: "Video file or videoUrl is required" });
  }
  if (!Number.isFinite(price) || price < 0) {
    return res.status(400).json({ error: "price must be a valid non-negative number" });
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
    },
  });

  video.videoUrl = videoUrl;
  video.coverImageUrl = coverImageUrl;
  video.previewClipUrl = previewClipUrl;
  video.caption = title || description || "";
  video.price = price;
  video.isFree = price <= 0;
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
