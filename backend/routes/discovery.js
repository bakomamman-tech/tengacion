const express = require("express");
const auth = require("../middleware/auth");
const {
  getHomeDiscovery,
  getCreatorDiscovery,
  getLiveDiscovery,
  getCreatorHubDiscovery,
  postDiscoveryEvents,
} = require("../controllers/discoveryController");

const router = express.Router();

router.get("/home", auth, getHomeDiscovery);
router.get("/creators", auth, getCreatorDiscovery);
router.get("/live", auth, getLiveDiscovery);
router.get("/creator-hub", auth, getCreatorHubDiscovery);
router.post("/events", auth, postDiscoveryEvents);

module.exports = router;
