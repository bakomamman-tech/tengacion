const express = require("express");
const router = express.Router();
const catchAsync = require("../utils/catchAsync");
const auth = require("../../../backend/middleware/auth");
const musicController = require("../controllers/musicController");

router.post("/tracks", auth, catchAsync(musicController.createTrack));
router.get("/tracks/:id/preview", catchAsync(musicController.previewTrack));
router.get("/tracks/:id/stream", catchAsync(musicController.streamTrack));

module.exports = router;
