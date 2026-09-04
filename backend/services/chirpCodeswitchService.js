const { v2 } = require("@google-cloud/speech");
const {
  NORMALIZATION_VERSION,
  normalizeTranscript,
} = require("./codeswitchService");

const DEFAULT_PROJECT_ID = String(
  process.env.VOICEBRIDGE_GOOGLE_CLOUD_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    "voicebridge-sahara-2026"
).trim();

const DEFAULT_LOCATION = String(
  process.env.VOICEBRIDGE_CHIRP_LOCATION || "us"
).trim();

const DEFAULT_MODEL = String(
  process.env.VOICEBRIDGE_CHIRP_MODEL || "chirp_3"
).trim();

const DEFAULT_TIMEOUT_MS = 60000;

let cachedClient = null;

class ChirpCodeswitchError extends Error {
  constructor(
    code,
    message,
    statusCode = 502,
    upstreamStatus = null
  ) {
    super(message);
    this.name = "ChirpCodeswitchError";
    this.code = code;
    this.statusCode = statusCode;
    this.upstreamStatus = upstreamStatus;
  }
}

const getClient = () => {
  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = new v2.SpeechClient({
    apiEndpoint:
      DEFAULT_LOCATION + "-speech.googleapis.com",
  });

  return cachedClient;
};

const mapProviderError = (error) => {
  if (error instanceof ChirpCodeswitchError) {
    return error;
  }

  const status = Number(error?.code || 0);

  if (status === 3) {
    return new ChirpCodeswitchError(
      "CHIRP_BAD_REQUEST",
      "Chirp could not process this transcription request.",
      400,
      status
    );
  }

  if (status === 4) {
    return new ChirpCodeswitchError(
      "CHIRP_TIMEOUT",
      "Chirp transcription timed out.",
      504,
      status
    );
  }

  if (status === 7 || status === 16) {
    return new ChirpCodeswitchError(
      "CHIRP_AUTH_FAILED",
      "Chirp transcription is temporarily unavailable because Google Cloud authentication or permissions failed.",
      502,
      status
    );
  }

  if (status === 8) {
    return new ChirpCodeswitchError(
      "CHIRP_RATE_LIMITED",
      "Chirp transcription is temporarily rate limited.",
      429,
      status
    );
  }

  if (status === 5) {
    return new ChirpCodeswitchError(
      "CHIRP_MODEL_UNAVAILABLE",
      "The configured Chirp recognizer or model is unavailable.",
      502,
      status
    );
  }

  return new ChirpCodeswitchError(
    "CHIRP_REQUEST_FAILED",
    "Chirp transcription failed.",
    502,
    status || null
  );
};

const transcribeWithChirp = async ({
  buffer,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new ChirpCodeswitchError(
      "CHIRP_AUDIO_REQUIRED",
      "Audio data is required.",
      400
    );
  }

  try {
    const client = getClient();

    const recognizer =
      "projects/" +
      DEFAULT_PROJECT_ID +
      "/locations/" +
      DEFAULT_LOCATION +
      "/recognizers/_";

    const request = {
      recognizer,
      config: {
        autoDecodingConfig: {},
        languageCodes: ["auto"],
        model: DEFAULT_MODEL,
      },
      content: buffer,
    };

    const startedAt = Date.now();

    const [response] = await client.recognize(
      request,
      { timeout: timeoutMs }
    );

    const latencyMs = Date.now() - startedAt;

    const results = Array.isArray(response?.results)
      ? response.results
      : [];

    const transcript = results
      .map(
        (result) =>
          result?.alternatives?.[0]?.transcript || ""
      )
      .filter(Boolean)
      .join(" ")
      .trim();

    if (!transcript) {
      throw new ChirpCodeswitchError(
        "CHIRP_EMPTY_TRANSCRIPT",
        "Chirp returned an empty transcript.",
        502
      );
    }

    const detectedLanguageCodes = [
      ...new Set(
        results
          .map((result) =>
            String(result?.languageCode || "").trim()
          )
          .filter(Boolean)
      ),
    ];

    return {
      provider: "chirp",
      vendor: "google-cloud",
      model: DEFAULT_MODEL,
      transcript,
      normalizedTranscript:
        normalizeTranscript(transcript),
      normalizationVersion: NORMALIZATION_VERSION,
      latencyMs,
      detectedLanguageCodes,
      processingStatus: "FILE_TRANSCRIBED",
      benchmarkMode: true,
      automaticLanguageDetection: true,
    };
  } catch (error) {
    throw mapProviderError(error);
  }
};

module.exports = {
  DEFAULT_MODEL,
  DEFAULT_LOCATION,
  ChirpCodeswitchError,
  transcribeWithChirp,
};
