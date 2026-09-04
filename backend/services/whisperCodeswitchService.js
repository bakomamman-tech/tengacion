const { config } = require("../config/env");
const {
  NORMALIZATION_VERSION,
  normalizeTranscript,
} = require("./codeswitchService");

const openaiModule = require("openai");

const OpenAI =
  openaiModule.OpenAI ||
  openaiModule.default ||
  openaiModule;

const toFile =
  openaiModule.toFile ||
  openaiModule.default?.toFile;

const DEFAULT_MODEL = "whisper-1";
const DEFAULT_TIMEOUT_MS = 60000;

let cachedClient = null;

class WhisperCodeswitchError extends Error {
  constructor(
    code,
    message,
    statusCode = 502,
    upstreamStatus = null
  ) {
    super(message);
    this.name = "WhisperCodeswitchError";
    this.code = code;
    this.statusCode = statusCode;
    this.upstreamStatus = upstreamStatus;
  }
}

const sanitizeFilename = (value = "") => {
  const safe = String(value || "")
    .replace(/[^\w.\-() ]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  return safe || "voicebridge-audio.wav";
};

const getClient = () => {
  if (cachedClient) {
    return cachedClient;
  }

  if (!config.OPENAI_API_KEY) {
    throw new WhisperCodeswitchError(
      "WHISPER_NOT_CONFIGURED",
      "Whisper transcription is not configured on this server.",
      503
    );
  }

  cachedClient = new OpenAI({
    apiKey: config.OPENAI_API_KEY,
  });

  return cachedClient;
};

const withTimeout = (
  promise,
  timeoutMs = DEFAULT_TIMEOUT_MS
) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new WhisperCodeswitchError(
          "WHISPER_TIMEOUT",
          "Whisper transcription timed out.",
          504
        )
      );
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });

const mapProviderError = (error) => {
  if (error instanceof WhisperCodeswitchError) {
    return error;
  }

  const status = Number(
    error?.status ||
      error?.statusCode ||
      error?.response?.status ||
      0
  );

  if (status === 429) {
    return new WhisperCodeswitchError(
      "WHISPER_RATE_LIMITED",
      "Whisper transcription is temporarily rate limited.",
      429,
      status
    );
  }

  if (status === 400) {
    return new WhisperCodeswitchError(
      "WHISPER_INVALID_AUDIO",
      "Whisper could not process this audio input.",
      400,
      status
    );
  }

  if (status === 401 || status === 403) {
    return new WhisperCodeswitchError(
      "WHISPER_AUTH_FAILED",
      "Whisper transcription is temporarily unavailable.",
      502,
      status
    );
  }

  return new WhisperCodeswitchError(
    "WHISPER_REQUEST_FAILED",
    "Whisper transcription failed.",
    502,
    status || null
  );
};

const transcribeWithWhisper = async ({
  buffer,
  filename,
  mimeType,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new WhisperCodeswitchError(
      "WHISPER_AUDIO_REQUIRED",
      "Audio data is required.",
      400
    );
  }

  if (typeof toFile !== "function") {
    throw new WhisperCodeswitchError(
      "WHISPER_FILE_HELPER_UNAVAILABLE",
      "Whisper audio upload support is unavailable.",
      500
    );
  }

  try {
    const client = getClient();

    const upload = await toFile(
      buffer,
      sanitizeFilename(filename),
      mimeType ? { type: mimeType } : undefined
    );

    const startedAt = Date.now();

    // Deliberately omit language and prompt so Whisper
    // performs multilingual recognition without provider hints.
    const response = await withTimeout(
      client.audio.transcriptions.create({
        file: upload,
        model: DEFAULT_MODEL,
      }),
      timeoutMs
    );

    const latencyMs = Date.now() - startedAt;

    const transcript = String(
      response?.text || ""
    ).trim();

    if (!transcript) {
      throw new WhisperCodeswitchError(
        "WHISPER_EMPTY_TRANSCRIPT",
        "Whisper returned an empty transcript.",
        502
      );
    }

    return {
      provider: "whisper",
      model: DEFAULT_MODEL,
      transcript,
      normalizedTranscript:
        normalizeTranscript(transcript),
      normalizationVersion: NORMALIZATION_VERSION,
      latencyMs,
      processingStatus: "FILE_TRANSCRIBED",
      benchmarkMode: true,
    };
  } catch (error) {
    throw mapProviderError(error);
  }
};

module.exports = {
  DEFAULT_MODEL,
  WhisperCodeswitchError,
  transcribeWithWhisper,
};
