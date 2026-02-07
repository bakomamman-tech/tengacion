const express = require("express");
const router = express.Router();

const {
  checkUsername,
  requestOtp,
  resendOtp,
  verifyOtp,
  registerUser,
  loginUser,
  createAdminUser,
} = require("../controllers/authController");

// ✅ Test route (to confirm auth routes are working)
router.get("/ping", (req, res) => {
  res.json({ message: "auth route working ✅" });
});

// ✅ Username check
router.get("/check-username", checkUsername);

// ✅ OTP
router.post("/request-otp", requestOtp);
router.post("/resend-otp", resendOtp);
router.post("/verify-otp", verifyOtp);

// ✅ Register + Login
router.post("/register", registerUser);
router.post("/login", loginUser);

// ✅ CREATE ADMIN (TEMPORARY - FOR TESTING ONLY)
router.post("/create-admin", createAdminUser);

module.exports = router;
