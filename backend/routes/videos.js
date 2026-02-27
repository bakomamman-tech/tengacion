const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const auth = require("../middleware/auth");
const Video = require("../models/Video");
const User = require("../models/User");
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
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const video = await Video.create({
      userId: user._id,
      name: user.name,
      username: user.username,
      avatar: user.avatar,
      videoUrl: req.body.videoUrl,
      caption: req.body.caption || "",
      likes: [],
      comments: [],
    });

    res.json(video);
  })
);

router.get(
  "/",
  auth,
  asyncHandler(async (_req, res) => {
    const vids = await Video.find().sort({ time: -1 });
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
