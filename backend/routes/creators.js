const express = require("express");
const auth = require("../middleware/auth");
const optionalAuth = require("../middleware/optionalAuth");
const {
  getMyCreatorProfile,
  upsertMyCreatorProfile,
  getCreatorById,
  getCreatorTracks,
  getCreatorBooks,
  getCreatorAlbums,
  getCreatorVideos,
  getCreatorHub,
  toggleFollowCreator,
  archiveMyCreatorContent,
} = require("../controllers/creatorsController");
const creatorAuth = require("../middleware/creatorAuth");

const router = express.Router();

router.get("/me", auth, getMyCreatorProfile);
router.post("/me", auth, upsertMyCreatorProfile);

router.get("/:creatorId", getCreatorById);
router.get("/:creatorId/hub", optionalAuth, getCreatorHub);
router.get("/:creatorId/public", optionalAuth, getCreatorHub);
router.put("/:creatorId/follow", auth, toggleFollowCreator);
router.get("/:creatorId/tracks", getCreatorTracks);
router.get("/:creatorId/books", getCreatorBooks);
router.get("/:creatorId/albums", getCreatorAlbums);
router.get("/:creatorId/videos", getCreatorVideos);
router.post("/me/archive-content", auth, creatorAuth, archiveMyCreatorContent);

module.exports = router;
