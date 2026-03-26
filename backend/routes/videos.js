const express = require("express");
const auth = require("../middleware/auth");
const creatorAuth = require("../middleware/creatorAuth");
const upload = require("../utils/upload");
const moderateUpload = require("../middleware/moderateUpload");
const {
  createVideoUploadPayload,
  MAX_VIDEO_BYTES,
} = require("../services/videoStorage");
const asyncHandler = require("../middleware/asyncHandler");
const {
  createCreatorVideo,
  likeCreatorVideo,
  listCreatorVideos,
  updateCreatorVideo,
} = require("../controllers/videosController");

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
  moderateUpload({
    sourceType: "creator_video_upload",
    titleFields: ["title", "caption"],
    descriptionFields: ["description", "caption"],
  }),
  createCreatorVideo
);

router.get(
  "/",
  auth,
  creatorAuth,
  listCreatorVideos
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
  moderateUpload({
    sourceType: "creator_video_upload",
    titleFields: ["title", "caption"],
    descriptionFields: ["description", "caption"],
  }),
  updateCreatorVideo
);

router.post(
  "/:id/like",
  auth,
  likeCreatorVideo
);

module.exports = router;
