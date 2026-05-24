const express = require("express");
const auth = require("../middleware/auth");
const optionalAuth = require("../middleware/optionalAuth");
const requireStepUp = require("../middleware/requireStepUp");
const {
  savePlayerProgress,
  getContinueListening,
  createCheckout,
  getSavedContent,
  getMyEntitlements,
  getMyLibrary,
  getProtectedStream,
  getProtectedDownload,
  removeSavedContent,
  saveContentForLater,
} = require("../controllers/creatorHubController");

const router = express.Router();

router.post("/player/progress", auth, savePlayerProgress);
router.get("/player/continue-listening", auth, getContinueListening);
router.get("/player/continue", auth, getContinueListening);
router.post("/checkout/create", auth, requireStepUp(), createCheckout);
router.get("/entitlements/me", auth, getMyEntitlements);
router.get("/library/me", auth, getMyLibrary);
router.get("/library/saved", auth, getSavedContent);
router.post("/library/save", auth, saveContentForLater);
router.delete("/library/save/:itemType/:itemId", auth, removeSavedContent);
router.get("/stream/:itemType/:itemId", optionalAuth, getProtectedStream);
router.get("/download/:itemType/:itemId", auth, getProtectedDownload);

module.exports = router;
