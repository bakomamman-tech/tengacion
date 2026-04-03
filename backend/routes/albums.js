const express = require("express");
const auth = require("../middleware/auth");
const creatorAuth = require("../middleware/creatorAuth");
const optionalAuth = require("../middleware/optionalAuth");
const upload = require("../utils/upload");
const { createAlbum, deleteAlbum, getAlbumById, updateAlbum } = require("../controllers/albumsController");

const router = express.Router();

router.post(
  "/",
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
  createAlbum
);

router.put(
  "/:albumId",
  auth,
  creatorAuth,
  upload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "cover", maxCount: 1 },
  ]),
  updateAlbum
);

router.get("/:albumId", optionalAuth, getAlbumById);
router.delete("/:albumId", auth, creatorAuth, deleteAlbum);

module.exports = router;
