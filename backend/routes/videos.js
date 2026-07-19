const express = require("express");
const auth = require("../middleware/auth");
const creatorAuth = require("../middleware/creatorAuth");
const upload = require("../middleware/privateUpload");
const moderateUpload = require("../middleware/moderateUpload");
const asyncHandler = require("../middleware/asyncHandler");
const {
  createCreatorVideo,
  deleteCreatorVideo,
  likeCreatorVideo,
  listCreatorVideos,
  updateCreatorVideo,
} = require("../controllers/videosController");

const router = express.Router();

router.post(
  "/presign",
  auth,
  (_req, res) => res.status(410).json({
    error: "Direct video uploads are disabled; use the moderated video upload endpoint",
  })
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
    deferDecisionResponse: true,
    publishWithoutManualReview: true,
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
    deferDecisionResponse: true,
    publishWithoutManualReview: true,
  }),
  updateCreatorVideo
);

router.post(
  "/:id/like",
  auth,
  likeCreatorVideo
);

router.delete(
  "/:id",
  auth,
  creatorAuth,
  deleteCreatorVideo
);

module.exports = router;
