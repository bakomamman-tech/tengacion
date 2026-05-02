const express = require("express");

const akusoController = require("../controllers/akusoController");
const requirePermissions = require("../middleware/requirePermissions");
const { attachAkusoUser, requireAkusoAuth } = require("../middleware/akusoAuthGuard");
const akusoPromptInjectionGuard = require("../middleware/akusoPromptInjectionGuard");
const akusoRateLimit = require("../middleware/akusoRateLimit");
const { akusoMediaUpload } = require("../middleware/akusoMediaUpload");
const {
  validateAkusoChatRequest,
  validateAkusoFeedbackRequest,
  validateAkusoHintsRequest,
  validateAkusoTemplateRequest,
} = require("../middleware/akusoRequestValidation");

const router = express.Router();

router.get(
  "/metrics",
  attachAkusoUser,
  requirePermissions(["view_audit_logs"]),
  akusoController.metrics
);

router.post(
  "/chat",
  attachAkusoUser,
  akusoRateLimit,
  akusoMediaUpload,
  validateAkusoChatRequest,
  akusoPromptInjectionGuard,
  akusoController.chat
);

router.get(
  "/hints",
  attachAkusoUser,
  akusoRateLimit,
  validateAkusoHintsRequest,
  akusoController.hints
);

router.post(
  "/feedback",
  attachAkusoUser,
  requireAkusoAuth(),
  validateAkusoFeedbackRequest,
  akusoController.feedback
);

router.post(
  "/templates/generate",
  attachAkusoUser,
  requireAkusoAuth(),
  akusoRateLimit,
  validateAkusoTemplateRequest,
  akusoPromptInjectionGuard,
  akusoController.generateTemplate
);

module.exports = router;
