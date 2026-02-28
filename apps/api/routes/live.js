const express = require("express");
const auth = require("../../../backend/middleware/auth");
const optionalAuth = require("../middleware/optionalAuth");
const liveController = require("../controllers/liveController");

const router = express.Router();

router.get("/active", optionalAuth, liveController.getActiveSessions);
router.get("/config", optionalAuth, liveController.getLiveConfig);
router.post("/create", auth, liveController.createLiveSession);
router.post("/token", auth, liveController.requestToken);
router.post("/end", auth, liveController.endLiveSession);
router.post("/viewers", auth, liveController.updateViewerCount);

module.exports = router;
