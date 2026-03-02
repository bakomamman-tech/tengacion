const express = require("express");
const auth = require("../middleware/auth");
const {
  savePlayerProgress,
  getContinueListening,
  createCheckout,
  getMyEntitlements,
  getProtectedDownload,
} = require("../controllers/creatorHubController");

const router = express.Router();

router.post("/player/progress", auth, savePlayerProgress);
router.get("/player/continue-listening", auth, getContinueListening);
router.post("/checkout/create", auth, createCheckout);
router.get("/entitlements/me", auth, getMyEntitlements);
router.get("/download/:itemType/:itemId", auth, getProtectedDownload);

module.exports = router;
