const express = require("express");
const router = express.Router();
let rateLimit;
try {
  rateLimit = require("express-rate-limit");
} catch (_error) {
  console.warn("express-rate-limit not installed; rate limiting disabled");
  rateLimit = () => (_req, _res, next) => next();
}
const authController = require("../controllers/authController");
const legacyAuth = require("../../../backend/middleware/auth");

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
});
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many reset requests. Please try again later." },
});
const verifyEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many verification requests. Please try again later." },
});

router.get("/check-username", authController.checkUsername);
router.post("/request-otp", authController.requestOtp);
router.post("/verify-otp", authController.verifyOtp);
router.post("/register", authController.register);
router.post("/login", loginRateLimiter, authController.login);
router.get("/me", legacyAuth, authController.getProfile);
router.post("/logout", legacyAuth, authController.revokeSession);
router.post("/logout-all", legacyAuth, authController.revokeAllSessions);
router.get("/sessions", legacyAuth, authController.listSessions);
router.delete("/sessions/:sessionId", legacyAuth, authController.revokeSession);
router.post(
  "/verify-email/request",
  verifyEmailLimiter,
  legacyAuth,
  authController.requestEmailVerification
);
router.get("/verify-email/confirm", authController.confirmEmailVerification);
router.post("/password/forgot", forgotPasswordLimiter, authController.forgotPassword);
router.post("/password/reset", forgotPasswordLimiter, authController.resetPassword);
router.post("/password/change", legacyAuth, authController.changePassword);

module.exports = router;
