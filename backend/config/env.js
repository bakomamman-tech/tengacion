const path = require("path");
const dotenv = require("dotenv");

const envFile = process.env.NODE_ENV === "test" ? ".env.test" : ".env";
const envCandidates = [
  path.resolve(process.cwd(), envFile),
  path.resolve(__dirname, "..", "..", envFile),
];

for (const envPath of envCandidates) {
  const result = dotenv.config({ path: envPath });
  if (!result.error) {
    break;
  }

  if (result.error.code !== "ENOENT") {
    throw result.error;
  }
}

const toText = (value) =>
  typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();

const toBool = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
  }
  return false;
};

const parsePort = (value, fallback = NaN) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const parseInteger = (value, fallback = NaN, { min = Number.MIN_SAFE_INTEGER } = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  if (!Number.isInteger(parsed) || parsed < min) {
    return fallback;
  }
  return parsed;
};

const secretLogKeyLabels = new Map([
  ["OPENAI_API_KEY", "apiKeyConfigured"],
  ["openAiApiKey", "apiKeyConfigured"],
  ["apiKey", "apiKeyConfigured"],
  ["PAYSTACK_SECRET_KEY", "paystackSecretConfigured"],
  ["paystackSecretKey", "paystackSecretConfigured"],
  ["STRIPE_SECRET_KEY", "stripeSecretConfigured"],
  ["stripeSecretKey", "stripeSecretConfigured"],
  ["STRIPE_PUBLISHABLE_KEY", "stripePublishableKeyConfigured"],
  ["stripePublishableKey", "stripePublishableKeyConfigured"],
  ["STRIPE_WEBHOOK_SECRET", "stripeWebhookSecretConfigured"],
  ["stripeWebhookSecret", "stripeWebhookSecretConfigured"],
  ["MONGO_URI", "mongoUriConfigured"],
  ["mongoUri", "mongoUriConfigured"],
  ["JWT_SECRET", "jwtSecretConfigured"],
  ["jwtSecret", "jwtSecretConfigured"],
  ["JWT_REFRESH_SECRET", "jwtRefreshSecretConfigured"],
  ["jwtRefreshSecret", "jwtRefreshSecretConfigured"],
  ["AUTH_CHALLENGE_SECRET", "authChallengeSecretConfigured"],
  ["authChallengeSecret", "authChallengeSecretConfigured"],
  ["MEDIA_SIGNING_SECRET", "mediaSigningSecretConfigured"],
  ["mediaSigningSecret", "mediaSigningSecretConfigured"],
  ["LIVEKIT_API_KEY", "livekitApiKeyConfigured"],
  ["livekitApiKey", "livekitApiKeyConfigured"],
  ["LIVEKIT_API_SECRET", "livekitApiSecretConfigured"],
  ["livekitApiSecret", "livekitApiSecretConfigured"],
  ["CLOUDINARY_API_KEY", "cloudinaryApiKeyConfigured"],
  ["cloudinaryApiKey", "cloudinaryApiKeyConfigured"],
  ["CLOUDINARY_API_SECRET", "cloudinaryApiSecretConfigured"],
  ["cloudinaryApiSecret", "cloudinaryApiSecretConfigured"],
  ["AWS_ACCESS_KEY_ID", "awsAccessKeyConfigured"],
  ["awsAccessKeyId", "awsAccessKeyConfigured"],
  ["AWS_SECRET_ACCESS_KEY", "awsSecretAccessKeyConfigured"],
  ["awsSecretAccessKey", "awsSecretAccessKeyConfigured"],
]);

const sensitiveLogKeyPattern =
  /(?:api[_-]?key|apikey|apiSecret|api[_-]?secret|secret|token|password|mongo(?:db)?[_-]?uri|mongoUri|private[_-]?key|signing)/i;

const toConfiguredLogKey = (key) => {
  if (secretLogKeyLabels.has(key)) {
    return secretLogKeyLabels.get(key);
  }

  const raw = String(key || "secret");
  const camel = raw
    .replace(/^[^a-zA-Z0-9]+/, "")
    .replace(/[^a-zA-Z0-9]+([a-zA-Z0-9])/g, (_match, char) => char.toUpperCase());
  const normalized = camel ? camel.charAt(0).toLowerCase() + camel.slice(1) : "secret";
  return normalized.endsWith("Configured") ? normalized : `${normalized}Configured`;
};

const isConfiguredLogKey = (key) => /Configured$/i.test(String(key || ""));
const hasConfiguredLogValue = (value) =>
  typeof value === "boolean" ? value : Boolean(toText(value));

const isSensitiveLogKey = (key) =>
  !isConfiguredLogKey(key) &&
  (secretLogKeyLabels.has(key) || sensitiveLogKeyPattern.test(String(key || "")));

const redactSecretsForLog = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => redactSecretsForLog(entry));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.entries(value).reduce((safe, [key, entryValue]) => {
    if (isSensitiveLogKey(key)) {
      safe[toConfiguredLogKey(key)] = hasConfiguredLogValue(entryValue);
      return safe;
    }

    safe[key] = redactSecretsForLog(entryValue);
    return safe;
  }, {});
};

const normalizeOrigin = (value) => {
  const raw = toText(value);
  if (!raw) {
    return "";
  }

  const hasProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
  const isLocalHost =
    /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(raw) || /^\[::1\](?::\d+)?$/i.test(raw);
  const candidate = hasProtocol ? raw : `${isLocalHost ? "http" : "https"}://${raw}`;

  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname) {
      return "";
    }
    parsed.pathname = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.origin;
  } catch {
    return "";
  }
};

const parseOriginList = (...sources) => {
  const origins = [];
  for (const source of sources) {
    const entries = Array.isArray(source) ? source : String(source || "").split(",");
    for (const entry of entries) {
      const origin = normalizeOrigin(entry);
      if (origin && !origins.includes(origin)) {
        origins.push(origin);
      }
    }
  }
  return origins;
};

const isLikelyRenderRuntime = Boolean(
  process.env.RENDER ||
    process.env.RENDER_EXTERNAL_URL ||
    process.env.RENDER_SERVICE_ID ||
    process.env.RENDER_SERVICE_NAME
);

const rawNodeEnv = toText(process.env.NODE_ENV);
const nodeEnv = rawNodeEnv || (isLikelyRenderRuntime ? "production" : "development");
const validNodeEnvs = new Set(["development", "test", "production"]);
if (!validNodeEnvs.has(nodeEnv)) {
  throw new Error(`Invalid NODE_ENV value: ${nodeEnv}`);
}

const isProduction = nodeEnv === "production";
const mongoUri = toText(process.env.MONGO_URI);
const jwtSecret = toText(process.env.JWT_SECRET);
const jwtRefreshSecretInput = toText(process.env.JWT_REFRESH_SECRET);
const authChallengeSecretInput = toText(process.env.AUTH_CHALLENGE_SECRET);
const mediaSigningSecretInput = toText(process.env.MEDIA_SIGNING_SECRET);
const port = parsePort(process.env.PORT, isProduction ? NaN : 5000);

const defaultAppUrl = isProduction ? "https://tengacion.com" : "http://localhost:5173";
const appUrl =
  normalizeOrigin(
    process.env.APP_URL ||
      process.env.APP_ORIGIN ||
      process.env.WEB_ORIGIN ||
      process.env.CLIENT_URL ||
      process.env.FRONTEND_URL ||
      defaultAppUrl
  ) || defaultAppUrl;
const clientUrl =
  normalizeOrigin(process.env.CLIENT_URL || process.env.FRONTEND_URL || appUrl) || appUrl;

const appOrigin = (() => {
  try {
    return new URL(appUrl);
  } catch {
    return null;
  }
})();

const wwwAppUrl =
  appOrigin &&
  !["localhost", "127.0.0.1", "[::1]"].includes(appOrigin.hostname) &&
  !appOrigin.hostname.startsWith("www.")
    ? `${appOrigin.protocol}//www.${appOrigin.hostname}${appOrigin.port ? `:${appOrigin.port}` : ""}`
    : "";

const defaultDevOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

const configuredOrigins = parseOriginList(
  process.env.CORS_ORIGIN,
  process.env.ALLOWED_FRONTEND_ORIGINS,
  process.env.FRONTEND_ORIGINS,
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  process.env.APP_URL,
  process.env.APP_ORIGIN,
  process.env.WEB_ORIGIN
);

const allowedOrigins = Array.from(
  new Set(
    [
      ...configuredOrigins,
      appUrl,
      clientUrl,
      ...(wwwAppUrl ? [wwwAppUrl] : []),
      ...(isProduction ? [] : defaultDevOrigins),
    ].filter(Boolean)
  )
);

const corsOrigin = allowedOrigins.join(",");

const resolveCallbackUrl = (value, fallbackBase) => {
  const raw = toText(value);
  if (!raw) {
    return "";
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  if (raw.startsWith("/")) {
    return `${fallbackBase}${raw}`;
  }

  return "";
};

const livekitApiKey = toText(process.env.LIVEKIT_API_KEY);
const livekitApiSecret = toText(process.env.LIVEKIT_API_SECRET);
const livekitHost = toText(process.env.LIVEKIT_HOST);
const livekitWsUrl = toText(process.env.LIVEKIT_WS_URL);
const cloudinaryCloudName = toText(process.env.CLOUDINARY_CLOUD_NAME);
const cloudinaryApiKey = toText(process.env.CLOUDINARY_API_KEY);
const cloudinaryApiSecret = toText(process.env.CLOUDINARY_API_SECRET);
const awsAccessKeyId = toText(process.env.AWS_ACCESS_KEY_ID);
const awsSecretAccessKey = toText(process.env.AWS_SECRET_ACCESS_KEY);
const awsRegion = toText(process.env.AWS_REGION);
const awsS3Bucket = toText(process.env.AWS_S3_BUCKET);
const awsS3MediaUrl = toText(process.env.AWS_S3_MEDIA_URL);
const paystackSecretKey = toText(process.env.PAYSTACK_SECRET_KEY);
const paystackCallbackUrl =
  resolveCallbackUrl(process.env.PAYSTACK_CALLBACK_URL, appUrl) || `${appUrl}/payment/verify`;
const paystackBaseUrl = toText(process.env.PAYSTACK_BASE_URL) || "https://api.paystack.co";
const paystackCurrency = toText(process.env.PAYSTACK_CURRENCY) || "NGN";
const stripeSecretKey = toText(process.env.STRIPE_SECRET_KEY);
const stripePublishableKey = toText(process.env.STRIPE_PUBLISHABLE_KEY);
const stripeWebhookSecret = toText(process.env.STRIPE_WEBHOOK_SECRET);
const requireEmailOtp = toText(process.env.REQUIRE_EMAIL_OTP) || "false";
const assistantEnabledInput = toText(process.env.ASSISTANT_ENABLED);
const openAiApiKey = toText(process.env.OPENAI_API_KEY);
const openAiModel = toText(process.env.OPENAI_MODEL) || "gpt-5.4-mini";
const openAiModelPrimary = toText(process.env.OPENAI_MODEL_PRIMARY) || openAiModel || "gpt-5.4-mini";
const openAiModelFast = toText(process.env.OPENAI_MODEL_FAST) || openAiModelPrimary;
const openAiModelWriting = toText(process.env.OPENAI_MODEL_WRITING) || openAiModelPrimary;
const openAiModelReasoning = toText(process.env.OPENAI_MODEL_REASONING) || openAiModelPrimary;
const openAiModelTranscription =
  toText(process.env.OPENAI_MODEL_TRANSCRIPTION) || "gpt-4o-mini-transcribe";
const hasOpenAI = Boolean(openAiApiKey);
const assistantEnabled = assistantEnabledInput ? toBool(assistantEnabledInput) : true;
const assistantAbuseWindowMs = parsePort(process.env.ASSISTANT_ABUSE_WINDOW_MS, 10 * 60 * 1000);
const assistantThrottleDurationMs = parsePort(process.env.ASSISTANT_THROTTLE_DURATION_MS, 15 * 60 * 1000);
const assistantAbuseThreshold = parsePort(process.env.ASSISTANT_ABUSE_THRESHOLD, 4);
const assistantMemoryRetentionDays = parsePort(process.env.ASSISTANT_MEMORY_RETENTION_DAYS, 30);
const assistantFeedbackRetentionDays = parsePort(process.env.ASSISTANT_FEEDBACK_RETENTION_DAYS, 90);
const assistantModelTimeoutMs = parsePort(process.env.ASSISTANT_MODEL_TIMEOUT_MS, 9000);
const akusoRequestTimeoutMs = parseInteger(
  process.env.AKUSO_REQUEST_TIMEOUT_MS,
  assistantModelTimeoutMs || 12000,
  { min: 1000 }
);
const akusoMaxInputChars = parseInteger(process.env.AKUSO_MAX_INPUT_CHARS, 4000, {
  min: 200,
});
const akusoMaxOutputTokens = parseInteger(process.env.AKUSO_MAX_OUTPUT_TOKENS, 1800, {
  min: 64,
});
const akusoRateLimitWindowMs = parseInteger(
  process.env.AKUSO_RATE_LIMIT_WINDOW_MS,
  15 * 60 * 1000,
  { min: 1000 }
);
const akusoRateLimitMax = parseInteger(process.env.AKUSO_RATE_LIMIT_MAX, 40, { min: 1 });
const akusoEnableAuditLogs = toBool(process.env.AKUSO_ENABLE_AUDIT_LOGS || "true");
const akusoEnableStreaming = toBool(process.env.AKUSO_ENABLE_STREAMING || "false");
const akusoReady = assistantEnabled ? hasOpenAI : false;

const missing = [];

if (!mongoUri) {
  missing.push("MONGO_URI");
}

if (!jwtSecret) {
  missing.push("JWT_SECRET");
} else if (isProduction && jwtSecret.length < 32) {
  missing.push("JWT_SECRET (must be at least 32 characters)");
}

if (!Number.isInteger(port) || port <= 0) {
  missing.push("PORT");
}

if (isProduction && assistantEnabled && !hasOpenAI) {
  missing.push("OPENAI_API_KEY");
}

if (missing.length > 0) {
  throw new Error(`Missing required env variables: ${missing.join(", ")}`);
}

const jwtRefreshSecret = jwtRefreshSecretInput || (isProduction ? "" : jwtSecret);
const mediaSigningSecret = mediaSigningSecretInput || jwtSecret;

const akuso = {
  enabled: assistantEnabled,
  ready: akusoReady,
  hasOpenAI,
  requestTimeoutMs: akusoRequestTimeoutMs,
  maxInputChars: akusoMaxInputChars,
  maxOutputTokens: akusoMaxOutputTokens,
  rateLimitWindowMs: akusoRateLimitWindowMs,
  rateLimitMax: akusoRateLimitMax,
  enableAuditLogs: akusoEnableAuditLogs,
  enableStreaming: akusoEnableStreaming,
  models: {
    primary: openAiModelPrimary,
    fast: openAiModelFast,
    writing: openAiModelWriting,
    reasoning: openAiModelReasoning,
    transcription: openAiModelTranscription,
  },
  apiKeyConfigured: hasOpenAI,
};

const config = {
  nodeEnv,
  isProduction,
  port,
  mongoUri,
  jwtSecret,
  jwtRefreshSecret,
  authChallengeSecret: authChallengeSecretInput || "",
  mediaSigningSecret,
  appUrl,
  clientUrl,
  corsOrigin,
  allowedOrigins,
  cloudinaryCloudName,
  cloudinaryApiKey,
  cloudinaryApiSecret,
  cloudinary:
    cloudinaryCloudName || cloudinaryApiKey || cloudinaryApiSecret
      ? {
          cloudName: cloudinaryCloudName,
          apiKey: cloudinaryApiKey,
          configured: Boolean(cloudinaryCloudName && cloudinaryApiKey && cloudinaryApiSecret),
        }
      : {
          cloudName: "",
          apiKey: "",
          configured: false,
        },
  awsAccessKeyId,
  awsSecretAccessKey,
  awsRegion,
  awsS3Bucket,
  awsS3MediaUrl,
  paystackSecretKey,
  paystackCallbackUrl,
  paystackBaseUrl,
  paystackCurrency,
  stripeSecretKey,
  stripePublishableKey,
  stripeWebhookSecret,
  openAiApiKey,
  openAiModel,
  openAiModelPrimary,
  openAiModelFast,
  openAiModelWriting,
  openAiModelReasoning,
  openAiModelTranscription,
  hasOpenAI,
  assistantEnabled,
  assistantAbuseWindowMs,
  assistantThrottleDurationMs,
  assistantAbuseThreshold,
  assistantMemoryRetentionDays,
  assistantFeedbackRetentionDays,
  assistantModelTimeoutMs,
  akuso,
  requireEmailOtp,
  livekit:
    livekitApiKey || livekitApiSecret || livekitHost || livekitWsUrl
      ? {
          apiKey: livekitApiKey,
          apiSecret: livekitApiSecret,
          host: livekitHost,
          wsUrl: livekitWsUrl,
        }
      : undefined,
  USE_LOCAL_VIDEO_MOCK: toBool(process.env.USE_LOCAL_VIDEO_MOCK || "false"),
  LOCAL_VIDEO_MOCK_URL:
    toText(process.env.LOCAL_VIDEO_MOCK_URL) || "https://storage.googleapis.com/free-videos/sample.mp4",

  NODE_ENV: nodeEnv,
  PORT: port,
  MONGO_URI: mongoUri,
  JWT_SECRET: jwtSecret,
  JWT_REFRESH_SECRET: jwtRefreshSecretInput || "",
  AUTH_CHALLENGE_SECRET: authChallengeSecretInput || "",
  MEDIA_SIGNING_SECRET: mediaSigningSecret,
  APP_URL: appUrl,
  CLIENT_URL: clientUrl,
  CORS_ORIGIN: corsOrigin,
  APP_ORIGIN: appUrl,
  WEB_ORIGIN: clientUrl,
  FRONTEND_URL: clientUrl,
  ALLOWED_FRONTEND_ORIGINS: corsOrigin,
  CLOUDINARY_CLOUD_NAME: cloudinaryCloudName,
  CLOUDINARY_API_KEY: cloudinaryApiKey,
  CLOUDINARY_API_SECRET: cloudinaryApiSecret,
  AWS_ACCESS_KEY_ID: awsAccessKeyId,
  AWS_SECRET_ACCESS_KEY: awsSecretAccessKey,
  AWS_REGION: awsRegion,
  AWS_S3_BUCKET: awsS3Bucket,
  AWS_S3_MEDIA_URL: awsS3MediaUrl,
  PAYSTACK_SECRET_KEY: paystackSecretKey,
  PAYSTACK_CALLBACK_URL: paystackCallbackUrl,
  PAYSTACK_BASE_URL: paystackBaseUrl,
  PAYSTACK_CURRENCY: paystackCurrency,
  STRIPE_SECRET_KEY: stripeSecretKey,
  STRIPE_PUBLISHABLE_KEY: stripePublishableKey,
  STRIPE_WEBHOOK_SECRET: stripeWebhookSecret,
  OPENAI_API_KEY: openAiApiKey,
  OPENAI_MODEL: openAiModel,
  OPENAI_MODEL_PRIMARY: openAiModelPrimary,
  OPENAI_MODEL_FAST: openAiModelFast,
  OPENAI_MODEL_WRITING: openAiModelWriting,
  OPENAI_MODEL_REASONING: openAiModelReasoning,
  OPENAI_MODEL_TRANSCRIPTION: openAiModelTranscription,
  HAS_OPENAI: hasOpenAI,
  ASSISTANT_ENABLED: assistantEnabled,
  ASSISTANT_ABUSE_WINDOW_MS: assistantAbuseWindowMs,
  ASSISTANT_THROTTLE_DURATION_MS: assistantThrottleDurationMs,
  ASSISTANT_ABUSE_THRESHOLD: assistantAbuseThreshold,
  ASSISTANT_MEMORY_RETENTION_DAYS: assistantMemoryRetentionDays,
  ASSISTANT_FEEDBACK_RETENTION_DAYS: assistantFeedbackRetentionDays,
  ASSISTANT_MODEL_TIMEOUT_MS: assistantModelTimeoutMs,
  AKUSO_REQUEST_TIMEOUT_MS: akusoRequestTimeoutMs,
  AKUSO_MAX_INPUT_CHARS: akusoMaxInputChars,
  AKUSO_MAX_OUTPUT_TOKENS: akusoMaxOutputTokens,
  AKUSO_RATE_LIMIT_WINDOW_MS: akusoRateLimitWindowMs,
  AKUSO_RATE_LIMIT_MAX: akusoRateLimitMax,
  AKUSO_ENABLE_AUDIT_LOGS: akusoEnableAuditLogs,
  AKUSO_ENABLE_STREAMING: akusoEnableStreaming,
  REQUIRE_EMAIL_OTP: requireEmailOtp,
  LIVEKIT_API_KEY: livekitApiKey,
  LIVEKIT_API_SECRET: livekitApiSecret,
  LIVEKIT_HOST: livekitHost,
  LIVEKIT_WS_URL: livekitWsUrl,
};

module.exports = { config, redactSecretsForLog, ...config };
