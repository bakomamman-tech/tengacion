const {
  MAX_TRANSCRIPT_CHARS,
  calculateWordErrorRate,
  normalizeTranscript,
} = require("../services/codeswitchService");

const SERVICE_NAME = "Tengacion VoiceBridge";
const PHASE = 1;
const PHASE_ONE_MESSAGE =
  "External ASR and agent integrations are not enabled in Phase 1.";

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

const phaseOnePlaceholder = (endpoint) => (_req, res) =>
  res.status(501).json({
    ok: false,
    service: SERVICE_NAME,
    phase: PHASE,
    endpoint,
    integrationEnabled: false,
    message: PHASE_ONE_MESSAGE,
  });

module.exports = {
  benchmark: phaseOnePlaceholder("benchmark"),
  health,
  intent: phaseOnePlaceholder("intent"),
  normalize,
  transcribe: phaseOnePlaceholder("transcribe"),
  wer,
};
