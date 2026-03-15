const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const auth = require("../middleware/auth");
const creatorAuth = require("../middleware/creatorAuth");
const upload = require("../utils/upload");
const Video = require("../models/Video");
const User = require("../models/User");
const { saveUploadedFile } = require("../services/mediaStore");
const {
  createVideoUploadPayload,
  MAX_VIDEO_BYTES,
} = require("../services/videoStorage");
const { logAnalyticsEvent } = require("../services/analyticsService");
const { evaluateVerification } = require("../services/contentVerificationService");
const { creatorHasCategory } = require("../services/creatorProfileService");

const router = express.Router();

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

router.post(
  "/presign",
  auth,
  async (req, res) => {
    const { filename, contentType, sizeBytes } = req.body || {};
    if (!filename || !contentType) {
      return res
        .status(400)
        .json({ error: "filename and contentType are required" });
    }

    try {
      const payload = await createVideoUploadPayload({
        filename,
        contentType,
        sizeBytes: Number(sizeBytes) || undefined,
      });

      return res.json({
        ...payload,
        maxSizeBytes: MAX_VIDEO_BYTES,
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }
);

router.post(
  "/",
  auth,
  creatorAuth,
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
    { name: "previewClip", maxCount: 1 },
  ]),
  asyncHandler(async (req, res) => {
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

    let videoUrl = String(req.body?.videoUrl || "").trim();
    let coverImageUrl = String(req.body?.coverImageUrl || "").trim();
    let previewClipUrl = String(req.body?.previewClipUrl || "").trim();

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

    res.json(video);
  })
);

router.get(
  "/",
  auth,
  creatorAuth,
  asyncHandler(async (_req, res) => {
    const vids = await Video.find({
      creatorProfileId: _req.creatorProfile?._id || null,
      archivedAt: null,
    }).sort({ time: -1 });
    res.json(vids);
  })
);

router.put(
  "/:id",
  auth,
  creatorAuth,
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
    { name: "previewClip", maxCount: 1 },
  ]),
  asyncHandler(async (req, res) => {
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

    let videoUrl = String(req.body?.videoUrl || video.videoUrl || "").trim();
    let coverImageUrl = String(req.body?.coverImageUrl || video.coverImageUrl || "").trim();
    let previewClipUrl = String(req.body?.previewClipUrl || video.previewClipUrl || "").trim();

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
    res.json(video);
  })
);

router.post(
  "/:id/like",
  auth,
  asyncHandler(async (req, res) => {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    if (!video.likes.includes(req.user.id)) {
      video.likes.push(req.user.id);
      await video.save();
    }
    res.json(video);
  })
);

module.exports = router;
