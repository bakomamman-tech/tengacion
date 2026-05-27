const mongoose = require("mongoose");

const { config } = require("../config/env");

const DB_READY_STATE = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};
const DEFAULT_DB_PING_TIMEOUT_MS = 1500;

const nowIso = () => new Date().toISOString();

const getUptimeSeconds = () => Math.round(process.uptime());

const withTimeout = (promise, timeoutMs, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs).unref?.();
    }),
  ]);

const buildCheck = ({
  key,
  status = "ok",
  required = false,
  message = "",
  details = {},
} = {}) => ({
  key,
  status,
  required: Boolean(required),
  message,
  details,
});

const buildLivenessPayload = () => ({
  status: "ok",
  time: nowIso(),
  uptimeSeconds: getUptimeSeconds(),
  environment: config.nodeEnv,
});

const checkDatabase = async ({ timeoutMs = DEFAULT_DB_PING_TIMEOUT_MS } = {}) => {
  const readyState = Number(mongoose.connection.readyState);
  const stateLabel = DB_READY_STATE[readyState] || "unknown";
  const baseDetails = {
    readyState,
    state: stateLabel,
  };

  if (readyState !== 1 || !mongoose.connection.db) {
    return buildCheck({
      key: "database",
      status: "fail",
      required: true,
      message: `MongoDB is ${stateLabel}.`,
      details: baseDetails,
    });
  }

  try {
    await withTimeout(mongoose.connection.db.admin().ping(), timeoutMs, "MongoDB ping");
    return buildCheck({
      key: "database",
      status: "ok",
      required: true,
      message: "MongoDB connection is ready.",
      details: baseDetails,
    });
  } catch (error) {
    return buildCheck({
      key: "database",
      status: "fail",
      required: true,
      message: error?.message || "MongoDB ping failed.",
      details: baseDetails,
    });
  }
};

const checkSecuritySecrets = () => {
  const details = {
    jwtSecretConfigured: Boolean(config.jwtSecret),
    jwtRefreshSecretConfigured: Boolean(config.JWT_REFRESH_SECRET),
    authChallengeSecretConfigured: Boolean(config.AUTH_CHALLENGE_SECRET),
    mediaSigningSecretConfigured: Boolean(config.mediaSigningSecret),
  };
  const missing = [
    details.jwtRefreshSecretConfigured ? "" : "JWT_REFRESH_SECRET",
    details.authChallengeSecretConfigured ? "" : "AUTH_CHALLENGE_SECRET",
  ].filter(Boolean);
  const required = config.isProduction;

  if (missing.length > 0) {
    return buildCheck({
      key: "security_secrets",
      status: required ? "fail" : "warn",
      required,
      message: `Missing auth secret configuration: ${missing.join(", ")}.`,
      details,
    });
  }

  return buildCheck({
    key: "security_secrets",
    status: "ok",
    required,
    message: "Auth and signing secrets are configured.",
    details,
  });
};

const checkMediaStorage = () => {
  const cloudinaryConfigured = Boolean(config.cloudinary?.configured);
  const awsConfigured = Boolean(
    config.AWS_S3_BUCKET && config.AWS_REGION && config.AWS_ACCESS_KEY_ID && config.AWS_SECRET_ACCESS_KEY
  );
  const details = {
    cloudinaryConfigured,
    awsS3Configured: awsConfigured,
    localVideoMockEnabled: Boolean(config.USE_LOCAL_VIDEO_MOCK),
  };
  const required = config.isProduction;

  if (!cloudinaryConfigured && !awsConfigured) {
    return buildCheck({
      key: "media_storage",
      status: required ? "fail" : "warn",
      required,
      message: "No durable media storage provider is fully configured.",
      details,
    });
  }

  return buildCheck({
    key: "media_storage",
    status: "ok",
    required,
    message: "Durable media storage is configured.",
    details,
  });
};

const checkPayments = () => {
  const paystackSecret = String(config.paystackSecretKey || "");
  const paystackLiveKey = /^sk_live_/i.test(paystackSecret);
  const stripeConfigured = Boolean(config.stripeSecretKey && config.stripePublishableKey);
  const details = {
    paystackConfigured: Boolean(paystackSecret),
    paystackLiveKey,
    paystackLiveKeyRequired: Boolean(config.paystackRequireLiveKey),
    stripeConfigured,
    stripeWebhookSecretConfigured: Boolean(config.stripeWebhookSecret),
  };

  if (config.paystackRequireLiveKey && !paystackLiveKey) {
    return buildCheck({
      key: "payments",
      status: "fail",
      required: true,
      message: "Paystack live key is required but not configured.",
      details,
    });
  }

  if (!details.paystackConfigured && !stripeConfigured) {
    return buildCheck({
      key: "payments",
      status: config.isProduction ? "fail" : "warn",
      required: config.isProduction,
      message: "No payment provider credentials are configured.",
      details,
    });
  }

  return buildCheck({
    key: "payments",
    status: "ok",
    required: config.isProduction || Boolean(config.paystackRequireLiveKey),
    message: "Payment provider configuration is present.",
    details,
  });
};

const checkAssistant = () => {
  const details = {
    enabled: Boolean(config.assistantEnabled),
    openAiConfigured: Boolean(config.hasOpenAI),
    akusoReady: Boolean(config.akuso?.ready),
  };
  const required = config.isProduction && config.assistantEnabled;

  if (config.assistantEnabled && !config.hasOpenAI) {
    return buildCheck({
      key: "assistant",
      status: required ? "fail" : "warn",
      required,
      message: "Assistant is enabled but OpenAI is not configured.",
      details,
    });
  }

  return buildCheck({
    key: "assistant",
    status: "ok",
    required,
    message: config.assistantEnabled
      ? "Assistant configuration is ready."
      : "Assistant is disabled.",
    details,
  });
};

const checkAllowedOrigins = () =>
  buildCheck({
    key: "allowed_origins",
    status: config.allowedOrigins.length > 0 ? "ok" : "fail",
    required: true,
    message:
      config.allowedOrigins.length > 0
        ? "Allowed frontend origins are configured."
        : "No allowed frontend origins are configured.",
    details: {
      count: config.allowedOrigins.length,
      appUrl: config.appUrl,
      clientUrl: config.clientUrl,
    },
  });

const buildReadinessPayload = async (options = {}) => {
  const checks = [
    await checkDatabase(options),
    checkSecuritySecrets(),
    checkMediaStorage(),
    checkPayments(),
    checkAssistant(),
    checkAllowedOrigins(),
  ];
  const requiredFailures = checks.filter(
    (check) => check.required && check.status === "fail"
  );

  return {
    status: requiredFailures.length > 0 ? "degraded" : "ready",
    time: nowIso(),
    uptimeSeconds: getUptimeSeconds(),
    environment: config.nodeEnv,
    requiredFailures: requiredFailures.map((check) => check.key),
    checks: checks.reduce((acc, check) => {
      acc[check.key] = {
        status: check.status,
        required: check.required,
        message: check.message,
        details: check.details,
      };
      return acc;
    }, {}),
  };
};

module.exports = {
  buildLivenessPayload,
  buildReadinessPayload,
};
