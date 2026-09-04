const {
  NORMALIZATION_VERSION,
  normalizeTranscript,
} = require("./codeswitchService");

const DEFAULT_MODEL = "gemini-3.5-transcribe";
const DEFAULT_TIMEOUT_MS = 90000;
const DEFAULT_FILE_POLL_MS = 500;

let cachedClientPromise = null;

class GeminiCodeswitchError extends Error {
  constructor(
    code,
    message,
    statusCode = 502,
    upstreamStatus = null
  ) {
    super(message);
    this.name = "GeminiCodeswitchError";
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
    process.env.VOICEBRIDGE_GEMINI_TRANSCRIPTION_MODEL ||
      DEFAULT_MODEL
  ).trim() || DEFAULT_MODEL;

const getApiKey = () =>
  String(process.env.GEMINI_API_KEY || "").trim();

const getClient = async () => {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new GeminiCodeswitchError(
      "GEMINI_NOT_CONFIGURED",
      "Gemini transcription is not configured on this server.",
      503
    );
  }

  if (!cachedClientPromise) {
    cachedClientPromise = import("@google/genai").then(
      ({ GoogleGenAI }) =>
        new GoogleGenAI({
          apiKey,
        })
    );
  }

  return cachedClientPromise;
};

const withTimeout = (
  promise,
  timeoutMs = DEFAULT_TIMEOUT_MS
) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new GeminiCodeswitchError(
          "GEMINI_TIMEOUT",
          "Gemini transcription timed out.",
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

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const getFileState = (file) =>
  String(file?.state || "").trim().toUpperCase();

const waitForActiveFile = async ({
  client,
  file,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) => {
  if (!file?.name) {
    throw new GeminiCodeswitchError(
      "GEMINI_UPLOAD_FAILED",
      "Gemini did not return an uploaded file resource.",
      502
    );
  }

  let current = file;
  const deadline = Date.now() + timeoutMs;

  while (true) {
    const state = getFileState(current);

    if (state === "ACTIVE") {
      return current;
    }

    if (state === "FAILED") {
      throw new GeminiCodeswitchError(
        "GEMINI_FILE_PROCESSING_FAILED",
        "Gemini could not prepare the uploaded audio.",
        502
      );
    }

    if (Date.now() >= deadline) {
      throw new GeminiCodeswitchError(
        "GEMINI_FILE_PROCESSING_TIMEOUT",
        "Gemini audio preparation timed out.",
        504
      );
    }

    await sleep(DEFAULT_FILE_POLL_MS);

    current = await withTimeout(
      client.files.get({
        name: file.name,
      }),
      Math.max(1000, deadline - Date.now())
    );
  }
};

const mapProviderError = (error) => {
  if (error instanceof GeminiCodeswitchError) {
    return error;
  }

  const status = Number(
    error?.status ||
      error?.statusCode ||
      error?.response?.status ||
      0
  );

  if (status === 429) {
    return new GeminiCodeswitchError(
      "GEMINI_RATE_LIMITED",
      "Gemini transcription is temporarily rate limited.",
      429,
      status
    );
  }

  if (status === 400) {
    return new GeminiCodeswitchError(
      "GEMINI_BAD_REQUEST",
      "Gemini could not process this transcription request.",
      400,
      status
    );
  }

  if (status === 401 || status === 403) {
    return new GeminiCodeswitchError(
      "GEMINI_AUTH_FAILED",
      "Gemini transcription is temporarily unavailable.",
      502,
      status
    );
  }

  if (status === 404) {
    return new GeminiCodeswitchError(
      "GEMINI_MODEL_UNAVAILABLE",
      "The configured Gemini transcription model is unavailable.",
      502,
      status
    );
  }

  return new GeminiCodeswitchError(
    "GEMINI_REQUEST_FAILED",
    "Gemini transcription failed.",
    502,
    status || null
  );
};

const transcribeWithGemini = async ({
  buffer,
  filename,
  mimeType,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new GeminiCodeswitchError(
      "GEMINI_AUDIO_REQUIRED",
      "Audio data is required.",
      400
    );
  }

  let client = null;
  let remoteFileName = "";

  try {
    client = await getClient();
    const model = getModel();

    // Copy only the exact bytes belonging to this Buffer.
    const exactBytes = Uint8Array.from(buffer);

    const blob = new Blob(
      [exactBytes],
      {
        type: mimeType || "application/octet-stream",
      }
    );

    const startedAt = Date.now();

    let audioFile = await withTimeout(
      client.files.upload({
        file: blob,
        config: {
          mimeType:
            mimeType || "application/octet-stream",
          displayName: sanitizeFilename(filename),
        },
      }),
      timeoutMs
    );

    remoteFileName = String(audioFile?.name || "");

    audioFile = await waitForActiveFile({
      client,
      file: audioFile,
      timeoutMs,
    });

    if (!audioFile?.uri) {
      throw new GeminiCodeswitchError(
        "GEMINI_UPLOAD_FAILED",
        "Gemini did not return an audio file URI.",
        502
      );
    }

    const response = await withTimeout(
      client.models.generateContent({
        model,
        contents: [audioFile],
      }),
      timeoutMs
    );

    const latencyMs = Date.now() - startedAt;

    const transcript = String(
      response?.text || ""
    ).trim();

    if (!transcript) {
      throw new GeminiCodeswitchError(
        "GEMINI_EMPTY_TRANSCRIPT",
        "Gemini returned an empty transcript.",
        502
      );
    }

    return {
      provider: "gemini",
      model,
      transcript,
      normalizedTranscript:
        normalizeTranscript(transcript),
      normalizationVersion: NORMALIZATION_VERSION,
      latencyMs,
      processingStatus: "FILE_TRANSCRIBED",
      benchmarkMode: true,
      verbatimMode: true,
      automaticLanguageDetection: true,
    };
  } catch (error) {
    throw mapProviderError(error);
  } finally {
    if (client && remoteFileName) {
      try {
        await client.files.delete({
          name: remoteFileName,
        });
      } catch {
        // Best-effort cleanup only.
      }
    }
  }
};

module.exports = {
  DEFAULT_MODEL,
  GeminiCodeswitchError,
  transcribeWithGemini,
};
