const express = require("express");
const optionalAuth = require("../middleware/optionalAuth");
const { recordRouteView } = require("../controllers/analyticsController");

const router = express.Router();

router.post("/route-views", optionalAuth, recordRouteView);

module.exports = router;
