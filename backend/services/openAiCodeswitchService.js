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

const DEFAULT_MODEL = "gpt-transcribe";
const DEFAULT_TIMEOUT_MS = 60000;

let cachedClient = null;

class OpenAiCodeswitchError extends Error {
  constructor(code, message, statusCode = 502, upstreamStatus = null) {
    super(message);
    this.name = "OpenAiCodeswitchError";
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

const getModel = () =>
  String(
    process.env.VOICEBRIDGE_OPENAI_TRANSCRIPTION_MODEL ||
      DEFAULT_MODEL
  ).trim() || DEFAULT_MODEL;

const getClient = () => {
  if (cachedClient) {
    return cachedClient;
  }

  if (!config.OPENAI_API_KEY) {
    throw new OpenAiCodeswitchError(
      "OPENAI_NOT_CONFIGURED",
      "OpenAI transcription is not configured on this server.",
      503
    );
  }

  cachedClient = new OpenAI({
    apiKey: config.OPENAI_API_KEY,
  });

  return cachedClient;
};

const withTimeout = (promise, timeoutMs = DEFAULT_TIMEOUT_MS) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new OpenAiCodeswitchError(
          "OPENAI_TIMEOUT",
          "OpenAI transcription timed out.",
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
  if (error instanceof OpenAiCodeswitchError) {
    return error;
  }

  const status = Number(error?.status || error?.statusCode || 0);

  if (status === 429) {
    return new OpenAiCodeswitchError(
      "OPENAI_RATE_LIMITED",
      "OpenAI transcription is temporarily rate limited.",
      429,
      status
    );
  }

  if (status === 400) {
    return new OpenAiCodeswitchError(
      "OPENAI_INVALID_AUDIO",
      "OpenAI could not process this audio input.",
      400,
      status
    );
  }

  if (status === 401 || status === 403) {
    return new OpenAiCodeswitchError(
      "OPENAI_AUTH_FAILED",
      "OpenAI transcription is temporarily unavailable.",
      502,
      status
    );
  }

  return new OpenAiCodeswitchError(
    "OPENAI_REQUEST_FAILED",
    "OpenAI transcription failed.",
    502,
    status || null
  );
};

const transcribeWithOpenAI = async ({
  buffer,
  filename,
  mimeType,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new OpenAiCodeswitchError(
      "OPENAI_AUDIO_REQUIRED",
      "Audio data is required.",
      400
    );
  }

  if (typeof toFile !== "function") {
    throw new OpenAiCodeswitchError(
      "OPENAI_FILE_HELPER_UNAVAILABLE",
      "OpenAI audio upload support is unavailable.",
      500
    );
  }

  try {
    const client = getClient();
    const model = getModel();

    const upload = await toFile(
      buffer,
      sanitizeFilename(filename),
      mimeType ? { type: mimeType } : undefined
    );

    const startedAt = Date.now();

    const response = await withTimeout(
      client.audio.transcriptions.create({
        file: upload,
        model,
      }),
      timeoutMs
    );

    const latencyMs = Date.now() - startedAt;
    const transcript = String(response?.text || "").trim();

    if (!transcript) {
      throw new OpenAiCodeswitchError(
        "OPENAI_EMPTY_TRANSCRIPT",
        "OpenAI returned an empty transcript.",
        502
      );
    }

    return {
      provider: "openai",
      model,
      transcript,
      normalizedTranscript: normalizeTranscript(transcript),
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
  OpenAiCodeswitchError,
  transcribeWithOpenAI,
};
