const express = require("express");
const auth = require("../middleware/auth");
const optionalAuth = require("../middleware/optionalAuth");
const newsFeedController = require("../controllers/newsFeedController");
const newsPublisherController = require("../controllers/newsPublisherController");

const router = express.Router();

router.get("/feed", optionalAuth, newsFeedController.getFeed);
router.get("/local", optionalAuth, newsFeedController.getLocal);
router.get("/world", optionalAuth, newsFeedController.getWorld);
router.get("/topic/:slug", optionalAuth, newsFeedController.getTopic);
router.get("/source/:slug", optionalAuth, newsPublisherController.getSourcePage);
router.get("/clusters/:clusterId", optionalAuth, newsFeedController.getCluster);
router.get("/stories/:storyId", optionalAuth, newsFeedController.getStory);

router.post("/impressions", auth, newsFeedController.postImpression);
router.post("/preferences/hide", auth, newsFeedController.hidePreference);
router.post("/preferences/follow-source", auth, newsFeedController.followSource);
router.post("/report", auth, newsFeedController.report);

module.exports = router;
