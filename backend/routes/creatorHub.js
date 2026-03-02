const express = require("express");
const auth = require("../middleware/auth");
const optionalAuth = require("../middleware/optionalAuth");
const {
  savePlayerProgress,
  getContinueListening,
  createCheckout,
  getMyEntitlements,
  getMyLibrary,
  getProtectedStream,
  getProtectedDownload,
} = require("../controllers/creatorHubController");

const router = express.Router();

router.post("/player/progress", auth, savePlayerProgress);
router.get("/player/continue-listening", auth, getContinueListening);
router.post("/checkout/create", auth, createCheckout);
router.get("/entitlements/me", auth, getMyEntitlements);
router.get("/library/me", auth, getMyLibrary);
router.get("/stream/:itemType/:itemId", optionalAuth, getProtectedStream);
router.get("/download/:itemType/:itemId", auth, getProtectedDownload);

module.exports = router;
