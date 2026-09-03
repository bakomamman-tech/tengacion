const express = require("express");

const codeswitchController = require("../controllers/codeswitchController");

const router = express.Router();

router.get("/health", codeswitchController.health);
router.post("/normalize", codeswitchController.normalize);
router.post("/wer", codeswitchController.wer);
router.post("/transcribe", codeswitchController.transcribe);
router.post("/benchmark", codeswitchController.benchmark);
router.post("/intent", codeswitchController.intent);

module.exports = router;
