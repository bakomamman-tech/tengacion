const express = require("express");
const auth = require("../middleware/auth");
const creatorAuth = require("../middleware/creatorAuth");
const { getCreatorDashboard } = require("../controllers/creatorsController");

const router = express.Router();

router.get("/dashboard", auth, creatorAuth, getCreatorDashboard);

module.exports = router;
