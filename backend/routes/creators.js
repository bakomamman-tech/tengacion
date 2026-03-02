const express = require("express");
const auth = require("../middleware/auth");
const optionalAuth = require("../middleware/optionalAuth");
const {
  getMyCreatorProfile,
  upsertMyCreatorProfile,
  getCreatorById,
  getCreatorTracks,
  getCreatorBooks,
  getCreatorHub,
  toggleFollowCreator,
} = require("../controllers/creatorsController");

const router = express.Router();

router.get("/me", auth, getMyCreatorProfile);
router.post("/me", auth, upsertMyCreatorProfile);

router.get("/:creatorId", getCreatorById);
router.get("/:creatorId/hub", optionalAuth, getCreatorHub);
router.put("/:creatorId/follow", auth, toggleFollowCreator);
router.get("/:creatorId/tracks", getCreatorTracks);
router.get("/:creatorId/books", getCreatorBooks);

module.exports = router;
