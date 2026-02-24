const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const legacyAuth = require("../../../backend/middleware/auth");

router.get("/check-username", authController.checkUsername);
router.post("/request-otp", authController.requestOtp);
router.post("/verify-otp", authController.verifyOtp);
router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", legacyAuth, authController.getProfile);

module.exports = router;
