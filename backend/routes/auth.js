const express = require("express");
const router = express.Router();

const {
  checkUsername,
  requestOtp,
  resendOtp,
  verifyOtp,
  register,
  login,
} = require("../controllers/authController");

// Username
router.get("/check-username", checkUsername);

// OTP
router.post("/request-otp", requestOtp);
router.post("/resend-otp", resendOtp);
router.post("/verify-otp", verifyOtp);

// Auth
router.post("/register", register);
router.post("/login", login);

module.exports = router;
