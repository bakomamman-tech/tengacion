const express = require("express");
const router = express.Router();

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

module.exports = router;
