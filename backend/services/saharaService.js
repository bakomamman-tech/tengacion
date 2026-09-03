const { config } = require("../config/env");
const {
  NORMALIZATION_VERSION,
  normalizeTranscript,
} = require("./codeswitchService");

const SAHARA_SYNC_URL = "https://infer.voice.intron.io/file/v1/upload/sync";
const SAHARA_STATUS_URL = "https://infer.voice.intron.io/file/v1/status";
const SAHARA_PROVIDER = "sahara";
const SAHARA_MODEL = "sahara-v2.5";
const BENCHMARK_MODE = true;
const LLM_CORRECTIONS_DISABLED = true;
const MAX_PROVIDER_RESPONSE_CHARS = 256 * 1024;

const PROCESSING_STATES = new Set([
  "FILE_QUEUED",
  "FILE_PENDING",
  "FILE_PROCESSING",
]);
const COMPLETED_STATE = "FILE_TRANSCRIBED";
const FAILED_STATE = "FILE_PROCESSING_FAILED";
const SUPPORTED_LANGUAGE_CODES = new Set(["ha", "pcm"]);

class SaharaServiceError extends Error {
  constructor(
    code,
    message,
    {
      statusCode = 502,
      upstreamStatus = null,
      retryAfterSeconds = null,
      providerFileId = null,
    } = {}
  ) {
    super(message);
    this.name = "SaharaServiceError";
    this.code = code;
    this.statusCode = statusCode;
    this.upstreamStatus = upstreamStatus;
    this.retryAfterSeconds = retryAfterSeconds;
    this.providerFileId = providerFileId;
    this.isOperational = true;
  }
}

const toPositiveInteger = (value, fallback, minimum = 1) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum ? parsed : fallback;
};

const sanitizeFilename = (filename = "audio.wav") => {
  const leafName = String(filename || "audio.wav")
    .split(/[\\/]/)
    .pop()
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  const safeName = leafName || "audio.wav";
  return safeName.slice(0, 180);
};

const isSafeProviderFileId = (value) =>
  typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);

const extractProviderData = (payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  return payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
    ? payload.data
    : null;
};

const extractProviderFileId = (payload) => {
  const fileId = extractProviderData(payload)?.file_id;
  return isSafeProviderFileId(fileId) ? fileId : null;
};

const containsSensitiveValue = (value, sensitiveValues) =>
  sensitiveValues.some(
    (sensitiveValue) =>
      typeof sensitiveValue === "string" &&
      sensitiveValue.length > 0 &&
      String(value).includes(sensitiveValue)
  );

const sanitizeDiagnosticStatus = (value, sensitiveValues) => {
  if (typeof value !== "string") return null;

  const sanitized = value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();

  if (!sanitized) return null;
  if (containsSensitiveValue(sanitized, sensitiveValues)) return "[REDACTED]";

  const truncated = sanitized.slice(0, 80);
  return /^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(truncated)
    ? truncated
    : "[UNSAFE_VALUE]";
};

const listDiagnosticKeys = (value, sensitiveValues) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.keys(value)
        .slice(0, 32)
        .map((key) => String(key).replace(/[\u0000-\u001f\u007f]/g, ""))
        .filter((key) => !/(?:authorization|api[_-]?key|token|secret)/i.test(key))
        .filter((key) => !containsSensitiveValue(key, sensitiveValues))
        .map((key) => key.slice(0, 80))
    : [];

const buildSafeProviderDiagnostics = (
  response,
  payload,
  { sensitiveValues = [] } = {}
) => {
  const data = extractProviderData(payload);
  const transcript = data?.audio_transcript;
  const rawDuration = data?.processed_audio_duration_in_seconds;
  const parsedDuration = rawDuration === null || rawDuration === undefined
    ? null
    : Number(rawDuration);
  const rawProcessingStatus = data?.processing_status;

  return {
    httpStatus: Number(response?.status || 0) || null,
    topLevelKeys: listDiagnosticKeys(payload, sensitiveValues),
    dataKeys: listDiagnosticKeys(data, sensitiveValues),
    providerStatus: sanitizeDiagnosticStatus(payload?.status, sensitiveValues),
    processingStatus: sanitizeDiagnosticStatus(rawProcessingStatus, sensitiveValues),
    hasFileId: Boolean(
      data &&
      Object.prototype.hasOwnProperty.call(data, "file_id") &&
      data.file_id !== null &&
      data.file_id !== ""
    ),
    hasAudioTranscript: Boolean(
      data && Object.prototype.hasOwnProperty.call(data, "audio_transcript")
    ),
    audioTranscriptLength: typeof transcript === "string" ? transcript.length : 0,
    processedAudioDurationInSeconds:
      Number.isFinite(parsedDuration) && parsedDuration >= 0 ? parsedDuration : null,
  };
};

const defaultDiagnosticLogger = (details) => {
  console.warn(
    "[voicebridge:sahara] sync response diagnostics",
    JSON.stringify(details)
  );
};

const logProviderDiagnostics = (
  diagnosticLogger,
  response,
  payload,
  { sensitiveValues = [] } = {}
) => {
  try {
    diagnosticLogger(
      buildSafeProviderDiagnostics(response, payload, { sensitiveValues })
    );
  } catch {
    // Diagnostics must never alter transcription control flow.
  }
};

const parseRetryAfterSeconds = (response) => {
  const raw = response?.headers?.get?.("retry-after");
  if (!/^\d+$/.test(String(raw || "").trim())) {
    return null;
  }
  const seconds = Number(raw);
  return Number.isSafeInteger(seconds) && seconds >= 0 && seconds <= 86400
    ? seconds
    : null;
};

const readProviderPayload = async (response, { required = false } = {}) => {
  let raw = "";
  try {
    raw = await response.text();
  } catch {
    if (!required) return null;
    throw new SaharaServiceError(
      "SAHARA_MALFORMED_RESPONSE",
      "Sahara returned an unreadable response."
    );
  }

  if (!raw) {
    if (!required) return null;
    throw new SaharaServiceError(
      "SAHARA_MALFORMED_RESPONSE",
      "Sahara returned an empty response."
    );
  }

  if (raw.length > MAX_PROVIDER_RESPONSE_CHARS) {
    throw new SaharaServiceError(
      "SAHARA_MALFORMED_RESPONSE",
      "Sahara returned an unexpectedly large response."
    );
  }

  try {
    const payload = JSON.parse(raw);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Provider payload must be an object");
    }
    return payload;
  } catch {
    if (!required) return null;
    throw new SaharaServiceError(
      "SAHARA_MALFORMED_RESPONSE",
      "Sahara returned malformed transcription data."
    );
  }
};

const buildUpstreamError = (response, { providerFileId = null } = {}) => {
  const upstreamStatus = Number(response?.status || 0) || null;
  const retryAfterSeconds = parseRetryAfterSeconds(response);

  if (upstreamStatus === 400) {
    return new SaharaServiceError(
      "SAHARA_REJECTED_REQUEST",
      "Sahara rejected the audio file or transcription options.",
      { statusCode: 400, upstreamStatus }
    );
  }

  if (upstreamStatus === 401 || upstreamStatus === 403) {
    return new SaharaServiceError(
      "SAHARA_AUTH_FAILED",
      "Sahara authentication was rejected. Contact the service administrator.",
      { statusCode: 502, upstreamStatus }
    );
  }

  if (upstreamStatus === 429) {
    return new SaharaServiceError(
      "SAHARA_RATE_LIMITED",
      "Sahara is rate limited. Try the transcription again later.",
      { statusCode: 429, upstreamStatus, retryAfterSeconds }
    );
  }

  if (upstreamStatus === 503) {
    return new SaharaServiceError(
      "SAHARA_UNAVAILABLE",
      "Sahara transcription is temporarily unavailable.",
      { statusCode: 503, upstreamStatus, retryAfterSeconds, providerFileId }
    );
  }

  return new SaharaServiceError(
    "SAHARA_UPSTREAM_ERROR",
    "Sahara transcription failed upstream. Try again later.",
    { statusCode: 502, upstreamStatus, retryAfterSeconds, providerFileId }
  );
};

const toNetworkError = (error) => {
  if (error instanceof SaharaServiceError) {
    return error;
  }

  const looksLikeTimeout =
    error?.name === "AbortError" ||
    error?.name === "TimeoutError" ||
    /timed?\s*out|timeout/i.test(String(error?.message || ""));

  return new SaharaServiceError(
    looksLikeTimeout ? "SAHARA_TIMEOUT" : "SAHARA_NETWORK_ERROR",
    looksLikeTimeout
      ? "Sahara transcription timed out."
      : "Sahara could not be reached. Try again later.",
    { statusCode: looksLikeTimeout ? 504 : 502 }
  );
};

const fetchWithTimeout = async (
  url,
  init,
  { fetchImpl, timeoutMs }
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();

  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    throw toNetworkError(error);
  } finally {
    clearTimeout(timeout);
  }
};

const parseCompletedData = (payload, { expectedFileId = null } = {}) => {
  const data = extractProviderData(payload);
  const processingStatus = data?.processing_status;
  const transcript = data?.audio_transcript;

  if (!data || processingStatus !== COMPLETED_STATE) {
    throw new SaharaServiceError(
      "SAHARA_MALFORMED_RESPONSE",
      "Sahara returned incomplete transcription data.",
      { providerFileId: expectedFileId }
    );
  }

  if (typeof transcript !== "string" || !transcript.trim()) {
    throw new SaharaServiceError(
      "SAHARA_EMPTY_TRANSCRIPT",
      "Sahara returned an empty transcript.",
      {
        statusCode: 502,
        providerFileId: extractProviderFileId(payload) || expectedFileId,
      }
    );
  }

  const responseFileId = isSafeProviderFileId(data.file_id) ? data.file_id : null;
  const rawDuration = data.processed_audio_duration_in_seconds;
  const parsedDuration = rawDuration === null || rawDuration === undefined
    ? null
    : Number(rawDuration);
  const processedAudioDurationSeconds =
    Number.isFinite(parsedDuration) && parsedDuration >= 0 ? parsedDuration : null;

  return {
    transcript,
    providerFileId: responseFileId || expectedFileId,
    processedAudioDurationSeconds,
    processingStatus,
  };
};

const pollSaharaStatus = async (
  fileId,
  {
    apiKey,
    fetchImpl,
    now,
    wait,
    requestTimeoutMs,
    pollTimeoutMs,
    pollDelayMs,
    pollMaxAttempts,
  }
) => {
  const pollingStartedAt = now();

  for (let attempt = 1; attempt <= pollMaxAttempts; attempt += 1) {
    const elapsedMs = Math.max(0, now() - pollingStartedAt);
    if (elapsedMs >= pollTimeoutMs) {
      break;
    }

    if (attempt > 1) {
      const remainingMs = Math.max(0, pollTimeoutMs - elapsedMs);
      await wait(Math.min(pollDelayMs, remainingMs));
    }

    const remainingMs = Math.max(1, pollTimeoutMs - Math.max(0, now() - pollingStartedAt));
    const response = await fetchWithTimeout(
      `${SAHARA_STATUS_URL}/${encodeURIComponent(fileId)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
      },
      {
        fetchImpl,
        timeoutMs: Math.min(requestTimeoutMs, remainingMs),
      }
    );

    const responseOk = Boolean(response?.ok);
    const payload = await readProviderPayload(response, { required: responseOk });

    const canUseProviderState = responseOk || response?.status === 503;
    if (!canUseProviderState) {
      throw buildUpstreamError(response, { providerFileId: fileId });
    }

    const data = extractProviderData(payload);
    const processingStatus = data?.processing_status;
    const responseFileId = extractProviderFileId(payload);

    if (processingStatus === COMPLETED_STATE) {
      return parseCompletedData(payload, { expectedFileId: fileId });
    }

    if (processingStatus === FAILED_STATE) {
      throw new SaharaServiceError(
        "SAHARA_PROCESSING_FAILED",
        "Sahara could not transcribe the uploaded audio.",
        { statusCode: 502, providerFileId: fileId }
      );
    }

    if (PROCESSING_STATES.has(processingStatus) && !responseFileId) {
      throw new SaharaServiceError(
        "SAHARA_MALFORMED_RESPONSE",
        "Sahara returned an in-progress response without a valid file id.",
        { providerFileId: fileId }
      );
    }

    if (PROCESSING_STATES.has(processingStatus)) {
      continue;
    }

    if (!responseOk) {
      throw buildUpstreamError(response, { providerFileId: fileId });
    }

    throw new SaharaServiceError(
      "SAHARA_MALFORMED_RESPONSE",
      "Sahara returned an unknown processing status.",
      { providerFileId: fileId }
    );
  }

  throw new SaharaServiceError(
    "SAHARA_POLL_TIMEOUT",
    "Sahara is still processing the audio after the bounded wait period.",
    { statusCode: 504, providerFileId: fileId }
  );
};

const transcribeWithSahara = async (
  { buffer, filename, mimeType, languageCode },
  dependencies = {}
) => {
  const saharaConfig = config.sahara || {};
  const apiKey = String(
    dependencies.apiKey !== undefined ? dependencies.apiKey : saharaConfig.apiKey || ""
  ).trim();
  const fetchImpl = dependencies.fetchImpl || global.fetch;
  const now = dependencies.now || Date.now;
  const wait = dependencies.wait || ((milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const diagnosticLogger =
    typeof dependencies.diagnosticLogger === "function"
      ? dependencies.diagnosticLogger
      : defaultDiagnosticLogger;
  const requestTimeoutMs = toPositiveInteger(
    dependencies.requestTimeoutMs,
    saharaConfig.requestTimeoutMs || 135000,
    1000
  );
  const pollTimeoutMs = toPositiveInteger(
    dependencies.pollTimeoutMs,
    saharaConfig.pollTimeoutMs || 30000,
    1000
  );
  const pollDelayMs = toPositiveInteger(
    dependencies.pollDelayMs,
    saharaConfig.pollDelayMs || 1500,
    1
  );
  const pollMaxAttempts = toPositiveInteger(
    dependencies.pollMaxAttempts,
    saharaConfig.pollMaxAttempts || 12,
    1
  );

  if (!apiKey) {
    throw new SaharaServiceError(
      "SAHARA_NOT_CONFIGURED",
      "Sahara transcription is not configured on this server.",
      { statusCode: 503 }
    );
  }

  if (!SUPPORTED_LANGUAGE_CODES.has(languageCode)) {
    throw new SaharaServiceError(
      "SAHARA_UNSUPPORTED_LANGUAGE",
      "Sahara does not support the requested VoiceBridge language mapping.",
      { statusCode: 400 }
    );
  }

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new SaharaServiceError(
      "SAHARA_INVALID_AUDIO",
      "A non-empty in-memory audio buffer is required.",
      { statusCode: 400 }
    );
  }

  if (typeof fetchImpl !== "function") {
    throw new SaharaServiceError(
      "SAHARA_NETWORK_ERROR",
      "Sahara could not be reached. Try again later.",
      { statusCode: 502 }
    );
  }

  const safeFilename = sanitizeFilename(filename);
  const form = new FormData();
  form.append("audio_file_name", safeFilename);
  form.append(
    "audio_file_blob",
    new Blob([buffer], { type: mimeType || "application/octet-stream" }),
    safeFilename
  );
  form.append("use_language_asr_input", languageCode);
  form.append("use_disable_llm_corrections", "TRUE");

  const startedAt = now();
  const response = await fetchWithTimeout(
    SAHARA_SYNC_URL,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    },
    { fetchImpl, timeoutMs: requestTimeoutMs }
  );

  const responseOk = Boolean(response?.ok);
  let payload;
  try {
    payload = await readProviderPayload(response, { required: responseOk });
  } catch (error) {
    logProviderDiagnostics(diagnosticLogger, response, null, {
      sensitiveValues: [apiKey],
    });
    throw error;
  }
  logProviderDiagnostics(diagnosticLogger, response, payload, {
    sensitiveValues: [apiKey],
  });
  let completed;

  if (responseOk || response.status === 503) {
    const data = extractProviderData(payload);
    const processingStatus = data?.processing_status;
    const fileId = extractProviderFileId(payload);

    if (processingStatus === COMPLETED_STATE) {
      completed = parseCompletedData(payload);
    } else {
      if (processingStatus === FAILED_STATE) {
        throw new SaharaServiceError(
          "SAHARA_PROCESSING_FAILED",
          "Sahara could not transcribe the uploaded audio.",
          { statusCode: 502, providerFileId: fileId }
        );
      }

      if (PROCESSING_STATES.has(processingStatus) && fileId) {
        completed = await pollSaharaStatus(fileId, {
          apiKey,
          fetchImpl,
          now,
          wait,
          requestTimeoutMs,
          pollTimeoutMs,
          pollDelayMs,
          pollMaxAttempts,
        });
      } else if (PROCESSING_STATES.has(processingStatus)) {
        throw new SaharaServiceError(
          "SAHARA_MALFORMED_RESPONSE",
          "Sahara returned an in-progress response without a valid file id."
        );
      } else if (!responseOk) {
        throw buildUpstreamError(response, { providerFileId: fileId });
      } else {
        throw new SaharaServiceError(
          "SAHARA_MALFORMED_RESPONSE",
          "Sahara returned an unknown transcription response."
        );
      }
    }
  } else {
    throw buildUpstreamError(response);
  }

  return {
    provider: SAHARA_PROVIDER,
    model: SAHARA_MODEL,
    languageCode,
    transcript: completed.transcript,
    normalizedTranscript: normalizeTranscript(completed.transcript),
    normalizationVersion: NORMALIZATION_VERSION,
    latencyMs: Math.max(0, Math.round(now() - startedAt)),
    providerFileId: completed.providerFileId,
    processedAudioDurationSeconds: completed.processedAudioDurationSeconds,
    processingStatus: completed.processingStatus,
    benchmarkMode: BENCHMARK_MODE,
    llmCorrectionsDisabled: LLM_CORRECTIONS_DISABLED,
  };
};

module.exports = {
  BENCHMARK_MODE,
  COMPLETED_STATE,
  FAILED_STATE,
  LLM_CORRECTIONS_DISABLED,
  PROCESSING_STATES,
  SAHARA_MODEL,
  SAHARA_PROVIDER,
  SAHARA_STATUS_URL,
  SAHARA_SYNC_URL,
  SUPPORTED_LANGUAGE_CODES,
  SaharaServiceError,
  buildSafeProviderDiagnostics,
  isSafeProviderFileId,
  pollSaharaStatus,
  transcribeWithSahara,
};
