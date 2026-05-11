const express = require("express");
const router = express.Router();
const catchAsync = require("../utils/catchAsync");
const auth = require("../../../backend/middleware/auth");
const creatorAuth = require("../../../backend/middleware/creatorAuth");
const optionalAuth = require("../../../backend/middleware/optionalAuth");
const upload = require("../../../backend/utils/upload");
const { createTrack } = require("../../../backend/controllers/tracksController");
const musicController = require("../controllers/musicController");

router.post(
  "/tracks",
  auth,
  creatorAuth,
  upload.fields([
    { name: "audio", maxCount: 1 },
    { name: "preview", maxCount: 1 },
    { name: "cover", maxCount: 1 },
  ]),
  createTrack
);
router.get("/tracks/:trackId/preview", optionalAuth, catchAsync(musicController.previewTrack));
router.get("/tracks/:trackId/stream", optionalAuth, musicController.streamTrack);

module.exports = router;
