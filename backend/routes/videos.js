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

const router = express.Router();

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
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const title = String(req.body?.title || req.body?.caption || "").trim();
    const description = String(req.body?.description || "").trim();
    const price = Number(req.body?.price || 0);

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
      isPublished: true,
      archivedAt: null,
      likes: [],
      comments: [],
    });

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
      isPublished: { $ne: false },
      archivedAt: null,
    }).sort({ time: -1 });
    res.json(vids);
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
