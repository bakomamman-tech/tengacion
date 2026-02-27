const express = require("express");
const router = express.Router();
const liveRoutes = require("../../apps/api/routes/live");

router.use("/", liveRoutes);

module.exports = router;
