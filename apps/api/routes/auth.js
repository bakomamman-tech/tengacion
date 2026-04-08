const crypto = require("crypto");
const express = require("express");
const router = express.Router();
let rateLimit;
let ipKeyGenerator = (ip) => String(ip || "");
try {
  rateLimit = require("express-rate-limit");
  if (typeof rateLimit.ipKeyGenerator === "function") {
    ipKeyGenerator = rateLimit.ipKeyGenerator;
  }
} catch (_error) {
  console.warn("express-rate-limit not installed; rate limiting disabled");
  rateLimit = () => (_req, _res, next) => next();
}
const authController = require("../controllers/authController");
const legacyAuth = require("../../../backend/middleware/auth");
const requireStepUp = require("../../../backend/middleware/requireStepUp");

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9._]{3,30}$/;
const OTP_REGEX = /^\d{6}$/;

const trimText = (value) => String(value || "").trim();
const normalizeEmail = (value) => trimText(value).toLowerCase();
const isStrongPassword = (value) => trimText(value).length >= 8;
const hashLimiterIdentity = (value = "") =>
  crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 16);
const getIpRateKey = (req) => ipKeyGenerator(req.ip || req.socket?.remoteAddress || "");
const buildScopedKey = (req, scope, identity = "") => {
  const normalizedIdentity = trimText(identity);
  const ipKey = getIpRateKey(req);
  if (!normalizedIdentity) {
    return `${scope}:${ipKey}`;
  }
  return `${scope}:${ipKey}:${hashLimiterIdentity(normalizedIdentity)}`;
};
const buildLimiterMessage = (message, req, windowMs) => {
  const retryAfterHeader = Number(req.rateLimit?.resetTime)
    ? Math.max(1, Math.ceil((Number(req.rateLimit.resetTime) - Date.now()) / 1000))
    : Math.max(1, Math.ceil(Number(windowMs || 0) / 1000));

  return {
    error: message,
    retryAfterSeconds: retryAfterHeader,
  };
};
const createRateLimiter = ({
  scope,
  keyExtractor,
  message,
  windowMs,
  skipSuccessfulRequests = false,
  max,
}) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    requestWasSuccessful: (_req, res) => res.statusCode < 400,
    keyGenerator: (req) => buildScopedKey(req, scope, keyExtractor?.(req)),
    handler: (req, res, _next, options) => {
      res
        .status(options.statusCode)
        .json(buildLimiterMessage(message, req, options.windowMs));
    },
  });

const reject = (res, message) => res.status(400).json({ error: message });

const validateEmailBody = (field = "email") => (req, res, next) => {
  const email = normalizeEmail(req.body?.[field]);
  if (!EMAIL_REGEX.test(email)) {
    return reject(res, "Valid email is required");
  }
  req.body[field] = email;
  return next();
};

const validateUsernameQuery = (req, res, next) => {
  const username = normalizeEmail(req.query?.username);
  if (!USERNAME_REGEX.test(username)) {
    return reject(res, "Valid username is required");
  }
  req.query.username = username;
  return next();
};

const validateOtpBody = (req, res, next) => {
  const email = normalizeEmail(req.body?.email);
  const otp = trimText(req.body?.otp);
  if (!EMAIL_REGEX.test(email)) {
    return reject(res, "Valid email is required");
  }
  if (!OTP_REGEX.test(otp)) {
    return reject(res, "Valid OTP is required");
  }
  req.body.email = email;
  req.body.otp = otp;
  return next();
};

const validateLoginBody = (req, res, next) => {
  const email = normalizeEmail(req.body?.email);
  const password = trimText(req.body?.password);
  if (!EMAIL_REGEX.test(email)) {
    return reject(res, "Valid email is required");
  }
  if (!password) {
    return reject(res, "Password is required");
  }
  req.body.email = email;
  req.body.password = password;
  return next();
};

const validateRegisterBody = (req, res, next) => {
  const name = trimText(req.body?.name);
  const username = normalizeEmail(req.body?.username);
  const email = normalizeEmail(req.body?.email);
  const phone = trimText(req.body?.phone);
  const country = trimText(req.body?.country);
  const stateOfOrigin = trimText(req.body?.stateOfOrigin);
  const password = trimText(req.body?.password);

  if (!name) {
    return reject(res, "Name is required");
  }
  if (!USERNAME_REGEX.test(username)) {
    return reject(res, "Valid username is required");
  }
  if (!EMAIL_REGEX.test(email)) {
    return reject(res, "Valid email is required");
  }
  if (!phone) {
    return reject(res, "Mobile number is required");
  }
  if (!country) {
    return reject(res, "Country is required");
  }
  if (!stateOfOrigin) {
    return reject(res, "State of origin is required");
  }
  if (!isStrongPassword(password)) {
    return reject(res, "Password must be at least 8 characters");
  }

  req.body.name = name;
  req.body.username = username;
  req.body.email = email;
  req.body.phone = phone;
  req.body.country = country;
  req.body.stateOfOrigin = stateOfOrigin;
  req.body.password = password;
  return next();
};

const validateResetBody = (req, res, next) => {
  const token = trimText(req.body?.token);
  const newPassword = trimText(req.body?.newPassword);
  if (!token) {
    return reject(res, "Reset token is required");
  }
  if (!isStrongPassword(newPassword)) {
    return reject(res, "Password must be at least 8 characters");
  }
  req.body.token = token;
  req.body.newPassword = newPassword;
  return next();
};

const validatePasswordChangeBody = (req, res, next) => {
  const oldPassword = trimText(req.body?.oldPassword);
  const newPassword = trimText(req.body?.newPassword);
  if (!oldPassword) {
    return reject(res, "Current password is required");
  }
  if (!isStrongPassword(newPassword)) {
    return reject(res, "Password must be at least 8 characters");
  }
  req.body.oldPassword = oldPassword;
  req.body.newPassword = newPassword;
  return next();
};

const validateChallengeBody = (req, res, next) => {
  const challengeToken = trimText(req.body?.challengeToken);
  const code = trimText(req.body?.code);
  if (!challengeToken) {
    return reject(res, "Challenge token is required");
  }
  if (!code) {
    return reject(res, "Verification code is required");
  }
  req.body.challengeToken = challengeToken;
  req.body.code = code;
  return next();
};

const validateMfaCodeBody = (req, res, next) => {
  const code = trimText(req.body?.code);
  if (!OTP_REGEX.test(code)) {
    return reject(res, "Verification code is required");
  }
  req.body.code = code;
  return next();
};

const validatePasswordAndCodeBody = (req, res, next) => {
  const password = trimText(req.body?.password);
  const code = trimText(req.body?.code);
  if (!password) {
    return reject(res, "Password is required");
  }
  if (!code) {
    return reject(res, "Verification code is required");
  }
  req.body.password = password;
  req.body.code = code;
  return next();
};

const usernameCheckLimiter = createRateLimiter({
  scope: "username-check",
  keyExtractor: (req) => normalizeEmail(req.query?.username),
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many username checks. Please try again later.",
});
const loginRateLimiter = createRateLimiter({
  scope: "login",
  keyExtractor: (req) => normalizeEmail(req.body?.email),
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: "Too many login attempts. Please try again later.",
});
const registerRateLimiter = createRateLimiter({
  scope: "register",
  keyExtractor: (req) => normalizeEmail(req.body?.email),
  windowMs: 15 * 60 * 1000,
  max: 6,
  message: "Too many registration attempts. Please try again later.",
});
const refreshRateLimiter = createRateLimiter({
  scope: "refresh",
  windowMs: 15 * 60 * 1000,
  max: 120,
  skipSuccessfulRequests: true,
  message: "Too many session refreshes. Please try again later.",
});
const forgotPasswordLimiter = createRateLimiter({
  scope: "forgot-password",
  keyExtractor: (req) => normalizeEmail(req.body?.email),
  windowMs: 15 * 60 * 1000,
  max: 6,
  message: "Too many reset requests. Please try again later.",
});
const resetPasswordLimiter = createRateLimiter({
  scope: "reset-password",
  keyExtractor: (req) => trimText(req.body?.token),
  windowMs: 15 * 60 * 1000,
  max: 6,
  message: "Too many password reset attempts. Please try again later.",
});
const verifyEmailLimiter = createRateLimiter({
  scope: "verify-email",
  keyExtractor: (req) => normalizeEmail(req.body?.email),
  windowMs: 60 * 60 * 1000,
  max: 6,
  message: "Too many verification requests. Please try again later.",
});
const otpRequestLimiter = createRateLimiter({
  scope: "otp-request",
  keyExtractor: (req) => normalizeEmail(req.body?.email),
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many OTP requests. Please try again later.",
});
const otpVerifyLimiter = createRateLimiter({
  scope: "otp-verify",
  keyExtractor: (req) => normalizeEmail(req.body?.email),
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  message: "Too many OTP verification attempts. Please try again later.",
});
const authChallengeLimiter = createRateLimiter({
  scope: "auth-challenge",
  keyExtractor: (req) => trimText(req.body?.challengeToken),
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  message: "Too many challenge verification attempts. Please try again later.",
});

router.get("/check-username", usernameCheckLimiter, validateUsernameQuery, authController.checkUsername);
router.post("/request-otp", otpRequestLimiter, validateEmailBody(), authController.requestOtp);
router.post("/verify-otp", otpVerifyLimiter, validateOtpBody, authController.verifyOtp);
router.post("/register", registerRateLimiter, validateRegisterBody, authController.register);
router.post("/login", loginRateLimiter, validateLoginBody, authController.login);
router.post("/refresh", refreshRateLimiter, authController.refresh);
router.post(
  "/challenge/verify",
  authChallengeLimiter,
  validateChallengeBody,
  authController.verifyAuthChallenge
);
router.get("/me", legacyAuth, authController.getProfile);
router.post("/logout", legacyAuth, authController.revokeSession);
router.post("/logout-all", legacyAuth, authController.revokeAllSessions);
router.get("/sessions", legacyAuth, authController.listSessions);
router.delete("/sessions/:sessionId", legacyAuth, authController.revokeSession);
router.post(
  "/verify-email/request",
  verifyEmailLimiter,
  legacyAuth,
  validateEmailBody(),
  authController.requestEmailVerification
);
router.get("/verify-email/confirm", authController.confirmEmailVerification);
router.post(
  "/password/forgot",
  forgotPasswordLimiter,
  validateEmailBody(),
  authController.forgotPassword
);
router.post(
  "/password/reset",
  resetPasswordLimiter,
  validateResetBody,
  authController.resetPassword
);
router.post(
  "/password/change",
  legacyAuth,
  requireStepUp(),
  validatePasswordChangeBody,
  authController.changePassword
);
router.get("/mfa", legacyAuth, authController.getMfaStatus);
router.post("/mfa/setup", legacyAuth, authController.beginTwoFactorSetup);
router.post("/mfa/setup/verify", legacyAuth, validateMfaCodeBody, authController.verifyTwoFactorSetup);
router.post("/mfa/email/enable", legacyAuth, authController.enableEmailTwoFactor);
router.post(
  "/mfa/disable",
  legacyAuth,
  requireStepUp(),
  validatePasswordAndCodeBody,
  authController.disableTwoFactor
);
router.post("/mfa/step-up", legacyAuth, validateMfaCodeBody, authController.verifyStepUp);

module.exports = router;
