const express = require("express");

const auth = require("../middleware/auth");
const creatorAuth = require("../middleware/creatorAuth");
const optionalAuth = require("../middleware/optionalAuth");
const upload = require("../utils/upload");
const moderateUpload = require("../middleware/moderateUpload");
const { createAlbum } = require("../controllers/albumsController");
const { createBookUpload, createMusicUpload, createPodcastUpload } = require("../controllers/creatorUploadsController");
const {
  getCreatorAccess,
  getCreatorContentSummary,
  getCreatorDashboard,
  getCreatorPrivateContent,
  getCreatorProfile,
  registerCreator,
  updatePodcastSeries,
  updateCreatorProfile,
} = require("../controllers/creatorController");
const { getPublicCreatorContent, getPublicCreatorProfile } = require("../controllers/creatorsController");
const { createCreatorVideo } = require("../controllers/videosController");

const router = express.Router();

router.get("/access", auth, getCreatorAccess);
router.get("/profile", auth, getCreatorProfile);
router.post("/register", auth, registerCreator);
router.put("/profile", auth, updateCreatorProfile);
router.get("/dashboard", auth, getCreatorDashboard);
router.get("/me/content-summary", auth, getCreatorContentSummary);
router.get("/me/content", auth, getCreatorPrivateContent);
router.put("/podcasts/series", auth, creatorAuth, updatePodcastSeries);

router.post(
  "/music",
  auth,
  creatorAuth,
  upload.fields([
    { name: "audio", maxCount: 1 },
    { name: "preview", maxCount: 1 },
    { name: "cover", maxCount: 1 },
  ]),
  moderateUpload({
    sourceType: "creator_music_upload",
    titleFields: ["title"],
    descriptionFields: ["description", "lyrics"],
  }),
  createMusicUpload
);

router.post(
  "/music/tracks",
  auth,
  creatorAuth,
  upload.fields([
    { name: "audio", maxCount: 1 },
    { name: "preview", maxCount: 1 },
    { name: "cover", maxCount: 1 },
  ]),
  moderateUpload({
    sourceType: "creator_music_upload",
    titleFields: ["title"],
    descriptionFields: ["description", "lyrics"],
  }),
  createMusicUpload
);

router.post(
  "/music/albums",
  auth,
  creatorAuth,
  upload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "cover", maxCount: 1 },
    { name: "tracks", maxCount: 25 },
    { name: "tracks[]", maxCount: 25 },
    { name: "previews", maxCount: 25 },
    { name: "previews[]", maxCount: 25 },
  ]),
  moderateUpload({
    sourceType: "creator_album_upload",
    titleFields: ["title"],
    descriptionFields: ["description"],
  }),
  createAlbum
);

router.post(
  "/music/videos",
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

router.post(
  "/podcasts",
  auth,
  creatorAuth,
  upload.fields([
    { name: "media", maxCount: 1 },
    { name: "audio", maxCount: 1 },
    { name: "video", maxCount: 1 },
    { name: "preview", maxCount: 1 },
    { name: "cover", maxCount: 1 },
    { name: "transcript", maxCount: 1 },
  ]),
  moderateUpload({
    sourceType: "creator_podcast_upload",
    titleFields: ["title", "podcastSeries"],
    descriptionFields: ["description", "showNotes"],
  }),
  createPodcastUpload
);

router.post(
  "/podcasts/episodes",
  auth,
  creatorAuth,
  upload.fields([
    { name: "media", maxCount: 1 },
    { name: "audio", maxCount: 1 },
    { name: "video", maxCount: 1 },
    { name: "preview", maxCount: 1 },
    { name: "cover", maxCount: 1 },
    { name: "transcript", maxCount: 1 },
  ]),
  moderateUpload({
    sourceType: "creator_podcast_upload",
    titleFields: ["title", "podcastSeries"],
    descriptionFields: ["description", "showNotes"],
  }),
  createPodcastUpload
);

router.post(
  "/books",
  auth,
  creatorAuth,
  upload.fields([
    { name: "cover", maxCount: 1 },
    { name: "content", maxCount: 1 },
    { name: "preview", maxCount: 1 },
  ]),
  moderateUpload({
    sourceType: "creator_book_upload",
    titleFields: ["title", "authorName"],
    descriptionFields: ["description", "previewExcerptText"],
  }),
  createBookUpload
);

router.get("/:creatorId/public-profile", optionalAuth, getPublicCreatorProfile);
router.get("/:creatorId/content", optionalAuth, getPublicCreatorContent);

module.exports = router;
