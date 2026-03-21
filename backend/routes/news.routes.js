const express = require("express");
const auth = require("../middleware/auth");
const optionalAuth = require("../middleware/optionalAuth");
const newsFeedController = require("../controllers/newsFeedController");
const newsPublisherController = require("../controllers/newsPublisherController");

const router = express.Router();

router.get("/feed", optionalAuth, newsFeedController.getFeed);
router.get("/local", optionalAuth, newsFeedController.getLocal);
router.get("/world", optionalAuth, newsFeedController.getWorld);
router.get("/topics", optionalAuth, newsFeedController.getTopics);
router.get("/topic/:slug", optionalAuth, newsFeedController.getTopic);
router.get("/source/:slug", optionalAuth, newsPublisherController.getSourcePage);
router.get("/clusters/:clusterId", optionalAuth, newsFeedController.getCluster);
router.get("/stories/:storyId", optionalAuth, newsFeedController.getStory);

router.get("/preferences", auth, newsFeedController.getPreferences);
router.post("/preferences", auth, newsFeedController.updatePreferences);
router.post("/save/:articleId", auth, newsFeedController.saveArticle);
router.delete("/save/:articleId", auth, newsFeedController.removeSavedArticle);
router.post("/impressions", auth, newsFeedController.postImpression);
router.post("/preferences/hide", auth, newsFeedController.hidePreference);
router.post("/preferences/follow-source", auth, newsFeedController.followSource);
router.post("/report", auth, newsFeedController.report);

module.exports = router;
