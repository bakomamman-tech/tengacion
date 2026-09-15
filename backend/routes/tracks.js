const express = require("express");
const auth = require("../middleware/auth");
const creatorAuth = require("../middleware/creatorAuth");
const optionalAuth = require("../middleware/optionalAuth");
const upload = require("../utils/upload");
const moderateUpload = require("../middleware/moderateUpload");
const {
  createTrack,
  deleteTrack,
  getTrackById,
  getTrackStream,
  updateTrack,
} = require("../controllers/tracksController");

const router = express.Router();

// Public track metadata must never reveal a backing preview/CDN URL. Playback
// always goes through /tracks/:trackId/stream -> signed Tengacion delivery.
const hideRawTrackMediaUrls = (_req, res, next) => {
  const sendJson = res.json.bind(res);
  res.json = (body) => {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return sendJson(body);
    }

    const safeBody = { ...body };
    delete safeBody.audioUrl;
    delete safeBody.fullAudioUrl;
    delete safeBody.videoUrl;
    delete safeBody.previewUrl;
    delete safeBody.previewSampleUrl;
    delete safeBody.previewClipUrl;
    return sendJson(safeBody);
  };
  return next();
};

router.post(
  "/",
  auth,
  creatorAuth,
  upload.fields([
    { name: "audio", maxCount: 1 },
    { name: "preview", maxCount: 1 },
    { name: "cover", maxCount: 1 },
  ]),
  moderateUpload({
    sourceType: "creator_track_upload",
    titleFields: ["title", "podcastSeries"],
    descriptionFields: ["description", "lyrics", "showNotes"],
    publishWithoutManualReview: true,
  }),
  createTrack
);

router.put(
  "/:trackId",
  auth,
  creatorAuth,
  upload.fields([
    { name: "media", maxCount: 1 },
    { name: "audio", maxCount: 1 },
    { name: "video", maxCount: 1 },
    { name: "preview", maxCount: 1 },
    { name: "previewClip", maxCount: 1 },
    { name: "cover", maxCount: 1 },
  ]),
  moderateUpload({
    sourceType: "creator_track_upload",
    titleFields: ["title", "podcastSeries"],
    descriptionFields: ["description", "lyrics", "showNotes"],
    publishWithoutManualReview: true,
  }),
  updateTrack
);

router.get("/:trackId", optionalAuth, hideRawTrackMediaUrls, getTrackById);
router.get("/:trackId/stream", optionalAuth, getTrackStream);
router.delete("/:trackId", auth, creatorAuth, deleteTrack);

module.exports = router;
