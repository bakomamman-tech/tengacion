const express = require("express");

const auth = require("../middleware/auth");
const {
  getCreatorAccess,
  getCreatorDashboard,
  getCreatorProfile,
  registerCreator,
  updateCreatorProfile,
} = require("../controllers/creatorController");

const router = express.Router();

router.get("/access", auth, getCreatorAccess);
router.get("/profile", auth, getCreatorProfile);
router.post("/register", auth, registerCreator);
router.put("/profile", auth, updateCreatorProfile);
router.get("/dashboard", auth, getCreatorDashboard);

module.exports = router;
