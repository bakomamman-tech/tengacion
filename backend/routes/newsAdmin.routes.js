const express = require("express");
const newsAdminController = require("../controllers/newsAdminController");

const router = express.Router();

router.post("/sources", newsAdminController.createSource);
router.patch("/sources/:id", newsAdminController.updateSource);
router.post("/contracts", newsAdminController.createContract);
router.post("/reingest", newsAdminController.reingest);
router.post("/recluster", newsAdminController.recluster);
router.post("/moderate/:storyId", newsAdminController.moderateStory);

module.exports = router;
