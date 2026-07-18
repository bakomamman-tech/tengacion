const express = require("express");
const auth = require("../middleware/auth");
const creatorAuth = require("../middleware/creatorAuth");
const upload = require("../utils/upload");
const moderateUpload = require("../middleware/moderateUpload");
const { createAlbum } = require("../controllers/albumsController");

const router = express.Router();

router.post(
  "/albums",
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

module.exports = router;
