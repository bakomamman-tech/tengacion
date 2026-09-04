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
const {
  OpenAiCodeswitchError,
  transcribeWithOpenAI,
} = require("../services/openAiCodeswitchService");
const {
  WhisperCodeswitchError,
  transcribeWithWhisper,
} = require("../services/whisperCodeswitchService");
const {
  GeminiCodeswitchError,
  transcribeWithGemini,
} = require("../services/geminiCodeswitchService");
const {
  ChirpCodeswitchError,
  transcribeWithChirp,
} = require("../services/chirpCodeswitchService");

const SERVICE_NAME = "Tengacion VoiceBridge";
const PHASE = 3;
const PHASE_THREE_MESSAGE =
  "Downstream agent integration is not enabled in Phase 3.";
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

const transcribeOpenAI = async (req, res) => {
  res.set("Cache-Control", "no-store");

  const languagePair =
    typeof req.body?.languagePair === "string"
      ? req.body.languagePair.trim()
      : "";

  if (!LANGUAGE_PAIR_TO_SAHARA_LANGUAGE[languagePair]) {
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
    const result = await transcribeWithOpenAI({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
    });

    return res.json({
      ok: true,
      ...result,
      languagePair,
    });
  } catch (error) {
    const safeError =
      error instanceof OpenAiCodeswitchError
        ? error
        : new OpenAiCodeswitchError(
            "OPENAI_REQUEST_FAILED",
            "OpenAI transcription failed unexpectedly.",
            502
          );

    console.warn("[voicebridge:openai] transcription failed", {
      requestId: req.requestId || "",
      code: safeError.code,
      statusCode: safeError.statusCode,
      upstreamStatus: safeError.upstreamStatus,
      languagePair,
      extension: req.codeswitchAudioFormat?.extension || "",
      fileSize: Number(req.file?.size || 0),
    });

    return res.status(safeError.statusCode || 502).json({
      ok: false,
      error: {
        code: safeError.code,
        message: safeError.message,
      },
    });
  }
};
const transcribeGemini = async (req, res) => {
  res.set("Cache-Control", "no-store");

  const languagePair =
    typeof req.body?.languagePair === "string"
      ? req.body.languagePair.trim()
      : "";

  if (!LANGUAGE_PAIR_TO_SAHARA_LANGUAGE[languagePair]) {
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
    const result = await transcribeWithGemini({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
    });

    return res.json({
      ok: true,
      ...result,
      languagePair,
    });
  } catch (error) {
    const safeError =
      error instanceof GeminiCodeswitchError
        ? error
        : new GeminiCodeswitchError(
            "GEMINI_REQUEST_FAILED",
            "Gemini transcription failed unexpectedly.",
            502
          );

    console.warn(
      "[voicebridge:gemini] transcription failed",
      {
        requestId: req.requestId || "",
        code: safeError.code,
        statusCode: safeError.statusCode,
        upstreamStatus: safeError.upstreamStatus,
        languagePair,
        extension:
          req.codeswitchAudioFormat?.extension || "",
        fileSize: Number(req.file?.size || 0),
      }
    );

    return res
      .status(safeError.statusCode || 502)
      .json({
        ok: false,
        error: {
          code: safeError.code,
          message: safeError.message,
        },
      });
  }
};

const transcribeWhisper = async (req, res) => {
  res.set("Cache-Control", "no-store");

  const languagePair =
    typeof req.body?.languagePair === "string"
      ? req.body.languagePair.trim()
      : "";

  if (!LANGUAGE_PAIR_TO_SAHARA_LANGUAGE[languagePair]) {
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
    const result = await transcribeWithWhisper({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
    });

    return res.json({
      ok: true,
      ...result,
      languagePair,
    });
  } catch (error) {
    const safeError =
      error instanceof WhisperCodeswitchError
        ? error
        : new WhisperCodeswitchError(
            "WHISPER_REQUEST_FAILED",
            "Whisper transcription failed unexpectedly.",
            502
          );

    console.warn(
      "[voicebridge:whisper] transcription failed",
      {
        requestId: req.requestId || "",
        code: safeError.code,
        statusCode: safeError.statusCode,
        upstreamStatus: safeError.upstreamStatus,
        languagePair,
        extension:
          req.codeswitchAudioFormat?.extension || "",
        fileSize: Number(req.file?.size || 0),
      }
    );

    return res
      .status(safeError.statusCode || 502)
      .json({
        ok: false,
        error: {
          code: safeError.code,
          message: safeError.message,
        },
      });
  }
};

const transcribeChirp = async (req, res) => {
  res.set("Cache-Control", "no-store");

  const languagePair =
    typeof req.body?.languagePair === "string"
      ? req.body.languagePair.trim()
      : "";

  if (!LANGUAGE_PAIR_TO_SAHARA_LANGUAGE[languagePair]) {
    return res.status(400).json({
      error: {
        code: "UNSUPPORTED_LANGUAGE_PAIR",
        message:
          "languagePair must be one of: ha-en, pcm-en.",
      },
    });
  }

  if (!req.file) {
    return res.status(400).json({
      error: {
        code: "AUDIO_REQUIRED",
        message:
          "An audio file is required in the audio field.",
      },
    });
  }

  try {
    const result = await transcribeWithChirp({
      buffer: req.file.buffer,
    });

    return res.json({
      ok: true,
      ...result,
      languagePair,
    });
  } catch (error) {
    const safeError =
      error instanceof ChirpCodeswitchError
        ? error
        : new ChirpCodeswitchError(
            "CHIRP_REQUEST_FAILED",
            "Chirp transcription failed unexpectedly.",
            502
          );

    console.warn(
      "[voicebridge:chirp] transcription failed",
      {
        requestId: req.requestId || "",
        code: safeError.code,
        statusCode: safeError.statusCode,
        upstreamStatus: safeError.upstreamStatus,
        languagePair,
        extension:
          req.codeswitchAudioFormat?.extension || "",
        fileSize: Number(req.file?.size || 0),
      }
    );

    return res
      .status(safeError.statusCode || 502)
      .json({
        ok: false,
        error: {
          code: safeError.code,
          message: safeError.message,
        },
      });
  }
};

const benchmark = async (req, res) => {
  res.set("Cache-Control", "no-store");

  const languagePair =
    typeof req.body?.languagePair === "string"
      ? req.body.languagePair.trim()
      : "";

  const languageCode = LANGUAGE_PAIR_TO_SAHARA_LANGUAGE[languagePair];

  if (!languageCode) {
    return res.status(400).json({
      ok: false,
      error: {
        code: "UNSUPPORTED_LANGUAGE_PAIR",
        message: "languagePair must be one of: ha-en, pcm-en.",
      },
    });
  }

  if (!req.file) {
    return res.status(400).json({
      ok: false,
      error: {
        code: "AUDIO_REQUIRED",
        message: "An audio file is required in the audio field.",
      },
    });
  }

  const referenceTranscript =
    typeof req.body?.referenceTranscript === "string"
      ? req.body.referenceTranscript
      : "";

  if (referenceTranscript.length > MAX_TRANSCRIPT_CHARS) {
    return res.status(400).json({
      ok: false,
      error: {
        code: "REFERENCE_TOO_LONG",
        message: `referenceTranscript must not exceed ${MAX_TRANSCRIPT_CHARS} characters.`,
      },
    });
  }

  const audio = {
    buffer: req.file.buffer,
    filename: req.file.originalname,
    mimeType: req.file.mimetype,
  };

  const providers = [
    {
      provider: "sahara",
      execute: () =>
        transcribeWithSahara({
          ...audio,
          languageCode,
        }),
    },
    {
      provider: "openai",
      execute: () => transcribeWithOpenAI(audio),
    },
    {
      provider: "whisper",
      execute: () => transcribeWithWhisper(audio),
    },
    {
      provider: "chirp",
      execute: () => transcribeWithChirp(audio),
    },
  ];

  const settled = await Promise.allSettled(
    providers.map((provider) => provider.execute())
  );

  const models = settled.map((entry, index) => {
    const provider = providers[index].provider;

    if (entry.status === "fulfilled") {
      const result = entry.value;
      const safeResult = { ...result };
      delete safeResult.providerFileId;

      let evaluation = null;

      if (referenceTranscript.trim()) {
        evaluation = calculateWordErrorRate({
          reference: referenceTranscript,
          hypothesis: result.transcript,
        });
      }

      return {
        ok: true,
        ...safeResult,
        languagePair,
        evaluation,
      };
    }

    const error = entry.reason;

    const isKnownError =
      error instanceof SaharaServiceError ||
      error instanceof OpenAiCodeswitchError ||
      error instanceof WhisperCodeswitchError ||
      error instanceof ChirpCodeswitchError;

    console.warn("[voicebridge:benchmark] provider failed", {
      requestId: req.requestId || "",
      provider,
      code: isKnownError ? error.code : "PROVIDER_FAILED",
      statusCode: isKnownError ? error.statusCode : 502,
      languagePair,
      fileSize: Number(req.file?.size || 0),
    });

    return {
      ok: false,
      provider,
      error: {
        code: isKnownError ? error.code : "PROVIDER_FAILED",
        message: isKnownError
          ? error.message
          : `${provider} transcription failed unexpectedly.`,
      },
    };
  });

  const successfulModels = models.filter((model) => model.ok).length;

  return res.status(successfulModels > 0 ? 200 : 502).json({
    ok: successfulModels > 0,
    service: SERVICE_NAME,
    phase: PHASE,
    languagePair,
    normalizationVersion: NORMALIZATION_VERSION,
    benchmarkMode: true,
    sameSourceAudio: true,
    sourceAudioBytes: req.file.buffer.length,
    successfulModels,
    requestedModels: providers.length,
    models,
  });
};
const phaseThreePlaceholder = (endpoint) => (_req, res) =>
  res.status(501).json({
    ok: false,
    service: SERVICE_NAME,
    phase: PHASE,
    endpoint,
    integrationEnabled: false,
    message: PHASE_THREE_MESSAGE,
  });

module.exports = {
  benchmark,
  health,
  intent: phaseThreePlaceholder("intent"),
  normalize,
  transcribe,
  transcribeOpenAI,
  transcribeWhisper,
  transcribeGemini,
  transcribeChirp,
  wer,
  LANGUAGE_PAIR_TO_SAHARA_LANGUAGE,
};
