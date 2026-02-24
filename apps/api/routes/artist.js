const express = require("express");
const router = express.Router();
const artistController = require("../controllers/artistController");
const auth = require("../../../backend/middleware/auth");
const requireArtist = require("../middleware/requireArtist");

router.put("/me", auth, requireArtist, artistController.updateOwnArtist);
router.get("/:username", artistController.getArtistByUsername);

module.exports = router;
