const express = require("express");
const auth = require("../middleware/auth");
const creatorAuth = require("../middleware/creatorAuth");
const optionalAuth = require("../middleware/optionalAuth");
const upload = require("../utils/upload");
const {
  createTrack,
  getTrackById,
  getTrackStream,
} = require("../controllers/tracksController");

const router = express.Router();

router.post(
  "/",
  auth,
  creatorAuth,
  upload.fields([
    { name: "audio", maxCount: 1 },
    { name: "preview", maxCount: 1 },
    { name: "cover", maxCount: 1 },
  ]),
  createTrack
);

router.get("/:trackId", optionalAuth, getTrackById);
router.get("/:trackId/stream", optionalAuth, getTrackStream);

module.exports = router;
