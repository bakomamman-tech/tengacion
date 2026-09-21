const express = require("express");

const codeswitchController = require("../controllers/codeswitchController");
const codeswitchAfricasTalkingController = require("../controllers/codeswitchAfricasTalkingController");
const codeswitchVoiceDiagnosticController = require("../controllers/codeswitchVoiceDiagnosticController");
const { codeswitchAudioUpload } = require("../middleware/codeswitchAudioUpload");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");

const router = express.Router();
const requireAdmin = requireRole(["admin", "super_admin"]);

router.get("/health", codeswitchController.health);

router.post(
  "/africastalking/voice/callback",
  codeswitchAfricasTalkingController.voiceCallback
);

router.post(
  "/africastalking/voice/language",
  codeswitchAfricasTalkingController.voiceLanguageSelection
);

router.post(
  "/africastalking/voice/events",
  codeswitchAfricasTalkingController.voiceEvents
);

router.post(
  "/africastalking/voice/recording",
  codeswitchAfricasTalkingController.voiceRecording
);

router.get(
  "/africastalking/voice/diagnostics/status",
  auth,
  requireAdmin,
  codeswitchVoiceDiagnosticController.status
);

router.post(
  "/africastalking/voice/diagnostics/enable",
  auth,
  requireAdmin,
  codeswitchVoiceDiagnosticController.enable
);

router.post(
  "/africastalking/voice/diagnostics/disable",
  auth,
  requireAdmin,
  codeswitchVoiceDiagnosticController.disable
);

router.get(
  "/africastalking/voice/diagnostics/latest",
  auth,
  requireAdmin,
  codeswitchVoiceDiagnosticController.latest
);

router.get(
  "/africastalking/voice/diagnostics",
  auth,
  requireAdmin,
  codeswitchVoiceDiagnosticController.list
);

router.get(
  "/africastalking/voice/diagnostics/:id",
  auth,
  requireAdmin,
  codeswitchVoiceDiagnosticController.reveal
);

router.delete(
  "/africastalking/voice/diagnostics/:id",
  auth,
  requireAdmin,
  codeswitchVoiceDiagnosticController.remove
);

router.delete(
  "/africastalking/voice/diagnostics",
  auth,
  requireAdmin,
  codeswitchVoiceDiagnosticController.clear
);

router.post("/normalize", codeswitchController.normalize);
router.post("/wer", codeswitchController.wer);
router.post("/transcribe", codeswitchAudioUpload, codeswitchController.transcribe);
router.post("/transcribe/openai", codeswitchAudioUpload, codeswitchController.transcribeOpenAI);
router.post("/transcribe/whisper", codeswitchAudioUpload, codeswitchController.transcribeWhisper);
router.post("/transcribe/gemini", codeswitchAudioUpload, codeswitchController.transcribeGemini);
router.post("/transcribe/chirp", codeswitchAudioUpload, codeswitchController.transcribeChirp);
router.post("/benchmark", codeswitchAudioUpload, codeswitchController.benchmark);
router.post("/intent", codeswitchController.intent);
router.post("/action", codeswitchController.action);

module.exports = router;
