const express = require("express");
const router = express.Router();
const User = require("../models/User");
const auth = require("../middleware/auth");

const {
  checkUsername,
  requestOtp,
  verifyOtp,
  register,
  login,
} = require("../controllers/authController");

router.get("/check-username", checkUsername);
router.post("/request-otp", requestOtp);
router.post("/verify-otp", verifyOtp);
router.post("/register", register);
router.post("/login", login);

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (err) {
    console.error("Auth /me error:", err);
    res.status(500).json({ error: "Failed to load user profile" });
  }
});

module.exports = router;
