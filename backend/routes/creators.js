const express = require("express");
const auth = require("../middleware/auth");
const {
  getMyCreatorProfile,
  upsertMyCreatorProfile,
  getCreatorById,
  getCreatorTracks,
  getCreatorBooks,
} = require("../controllers/creatorsController");

const router = express.Router();

router.get("/me", auth, getMyCreatorProfile);
router.post("/me", auth, upsertMyCreatorProfile);

router.get("/:creatorId", getCreatorById);
router.get("/:creatorId/tracks", getCreatorTracks);
router.get("/:creatorId/books", getCreatorBooks);

module.exports = router;
