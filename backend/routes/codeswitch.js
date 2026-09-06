const express = require("express");

const codeswitchController = require("../controllers/codeswitchController");
const codeswitchAfricasTalkingController = require("../controllers/codeswitchAfricasTalkingController");
const { codeswitchAudioUpload } = require("../middleware/codeswitchAudioUpload");

const router = express.Router();

router.get("/health", codeswitchController.health);

router.post(
  "/africastalking/voice/callback",
  codeswitchAfricasTalkingController.voiceCallback
);

router.post(
  "/africastalking/voice/events",
  codeswitchAfricasTalkingController.voiceEvents
);

router.post(
  "/africastalking/voice/recording",
  codeswitchAfricasTalkingController.voiceRecording
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
