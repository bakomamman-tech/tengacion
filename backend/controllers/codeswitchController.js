const {
  MAX_TRANSCRIPT_CHARS,
  NORMALIZATION_VERSION,
  calculateWordErrorRate,
  normalizeTranscript,
} = require("../services/codeswitchService");
const {
  SaharaServiceError,
  transcribeWithSahara,
} = require("../services/saharaService");

const SERVICE_NAME = "Tengacion VoiceBridge";
const PHASE = 2;
const PHASE_TWO_MESSAGE =
  "Multi-model benchmarking and downstream agent integrations are not enabled in Phase 2.";
const LANGUAGE_PAIR_TO_SAHARA_LANGUAGE = Object.freeze({
  "ha-en": "ha",
  "pcm-en": "pcm",
});

const validateStringField = (body, field) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Request body must be a JSON object.";
  }

  if (typeof body[field] !== "string") {
    return `${field} must be a string.`;
  }

  if (body[field].length > MAX_TRANSCRIPT_CHARS) {
    return `${field} must not exceed ${MAX_TRANSCRIPT_CHARS} characters.`;
  }

  return "";
};

const health = (_req, res) =>
  res.set("Cache-Control", "no-store").json({
    ok: true,
    service: SERVICE_NAME,
    phase: PHASE,
  });

const normalize = (req, res) => {
  const error = validateStringField(req.body, "text");
  if (error) {
    return res.status(400).json({ error });
  }

  return res.json({
    original: req.body.text,
    normalized: normalizeTranscript(req.body.text),
    normalizationVersion: NORMALIZATION_VERSION,
  });
};

const wer = (req, res) => {
  const referenceError = validateStringField(req.body, "reference");
  const hypothesisError = validateStringField(req.body, "hypothesis");
  const error = referenceError || hypothesisError;
  if (error) {
    return res.status(400).json({ error });
  }

  try {
    return res.json(
      calculateWordErrorRate({
        reference: req.body.reference,
        hypothesis: req.body.hypothesis,
      })
    );
  } catch (calculationError) {
    if (calculationError instanceof RangeError) {
      return res.status(413).json({ error: calculationError.message });
    }
    throw calculationError;
  }
};

const transcribe = async (req, res) => {
  res.set("Cache-Control", "no-store");
  const languagePair =
    typeof req.body?.languagePair === "string" ? req.body.languagePair.trim() : "";
  const languageCode = LANGUAGE_PAIR_TO_SAHARA_LANGUAGE[languagePair];

  if (!languageCode) {
    return res.status(400).json({
      error: {
        code: "UNSUPPORTED_LANGUAGE_PAIR",
        message: "languagePair must be one of: ha-en, pcm-en.",
      },
    });
  }

  if (!req.file) {
    return res.status(400).json({
      error: {
        code: "AUDIO_REQUIRED",
        message: "An audio file is required in the audio field.",
      },
    });
  }

  try {
    const result = await transcribeWithSahara({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      languageCode,
    });

    return res.json({
      ok: true,
      ...result,
      languagePair,
    });
  } catch (error) {
    const safeError = error instanceof SaharaServiceError
      ? error
      : new SaharaServiceError(
          "SAHARA_REQUEST_FAILED",
          "Sahara transcription failed unexpectedly. Try again later."
        );

    console.warn("[voicebridge:sahara] transcription failed", {
      requestId: req.requestId || "",
      code: safeError.code,
      statusCode: safeError.statusCode,
      upstreamStatus: safeError.upstreamStatus,
      providerFileId: safeError.providerFileId,
      languagePair,
      extension: req.codeswitchAudioFormat?.extension || "",
      fileSize: Number(req.file.size || 0),
    });

    if (safeError.retryAfterSeconds !== null) {
      res.set("Retry-After", String(safeError.retryAfterSeconds));
    }

    return res.status(safeError.statusCode || 502).json({
      ok: false,
      error: {
        code: safeError.code,
        message: safeError.message,
      },
      ...(safeError.retryAfterSeconds !== null
        ? { retryAfterSeconds: safeError.retryAfterSeconds }
        : {}),
    });
  }
};

const phaseTwoPlaceholder = (endpoint) => (_req, res) =>
  res.status(501).json({
    ok: false,
    service: SERVICE_NAME,
    phase: PHASE,
    endpoint,
    integrationEnabled: false,
    message: PHASE_TWO_MESSAGE,
  });

module.exports = {
  benchmark: phaseTwoPlaceholder("benchmark"),
  health,
  intent: phaseTwoPlaceholder("intent"),
  normalize,
  transcribe,
  wer,
  LANGUAGE_PAIR_TO_SAHARA_LANGUAGE,
};
