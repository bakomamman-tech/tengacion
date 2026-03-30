const path = require("path");
const dotenv = require("dotenv");

const envFile = process.env.NODE_ENV === "test" ? ".env.test" : ".env";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

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

const configuredOrigins = parseOriginList(
  process.env.ALLOWED_FRONTEND_ORIGINS,
  process.env.FRONTEND_ORIGINS,
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  process.env.APP_ORIGIN,
  process.env.WEB_ORIGIN
);
const defaultDevOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];
const allowedOrigins = [
  ...configuredOrigins,
  ...(isProduction ? [] : defaultDevOrigins),
].filter((origin, index, list) => origin && list.indexOf(origin) === index);

const livekitApiKey = toText(process.env.LIVEKIT_API_KEY);
const livekitApiSecret = toText(process.env.LIVEKIT_API_SECRET);
const livekitHost = toText(process.env.LIVEKIT_HOST);
const livekitWsUrl = toText(process.env.LIVEKIT_WS_URL);
const awsAccessKeyId = toText(process.env.AWS_ACCESS_KEY_ID);
const awsSecretAccessKey = toText(process.env.AWS_SECRET_ACCESS_KEY);
const awsRegion = toText(process.env.AWS_REGION);
const awsS3Bucket = toText(process.env.AWS_S3_BUCKET);
const awsS3MediaUrl = toText(process.env.AWS_S3_MEDIA_URL);
const paystackSecretKey = toText(process.env.PAYSTACK_SECRET_KEY);
const paystackCallbackUrl = toText(process.env.PAYSTACK_CALLBACK_URL);
const paystackBaseUrl = toText(process.env.PAYSTACK_BASE_URL) || "https://api.paystack.co";
const paystackCurrency = toText(process.env.PAYSTACK_CURRENCY) || "NGN";
const stripeSecretKey = toText(process.env.STRIPE_SECRET_KEY);
const stripePublishableKey = toText(process.env.STRIPE_PUBLISHABLE_KEY);
const stripeWebhookSecret = toText(process.env.STRIPE_WEBHOOK_SECRET);
const requireEmailOtp = toText(process.env.REQUIRE_EMAIL_OTP) || "false";

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

if (isProduction && !jwtRefreshSecretInput) {
  missing.push("JWT_REFRESH_SECRET");
}

if (isProduction && !authChallengeSecretInput) {
  missing.push("AUTH_CHALLENGE_SECRET");
}

if (isProduction && !mediaSigningSecretInput) {
  missing.push("MEDIA_SIGNING_SECRET");
}

if (isProduction && allowedOrigins.length === 0) {
  missing.push("FRONTEND_ORIGINS or CLIENT_URL or FRONTEND_URL");
}

if (missing.length > 0) {
  throw new Error(`Missing required env variables: ${missing.join(", ")}`);
}

const jwtRefreshSecret = jwtRefreshSecretInput || (isProduction ? "" : jwtSecret);
const mediaSigningSecret = mediaSigningSecretInput || (isProduction ? "" : jwtSecret);

const config = {
  nodeEnv,
  isProduction,
  port,
  mongoUri,
  jwtSecret,
  jwtRefreshSecret,
  authChallengeSecret: authChallengeSecretInput || (isProduction ? "" : jwtSecret),
  mediaSigningSecret,
  allowedOrigins,
  clientUrl: toText(process.env.CLIENT_URL),
  frontendUrl: toText(process.env.FRONTEND_URL),
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
  LOCAL_VIDEO_MOCK_URL: toText(process.env.LOCAL_VIDEO_MOCK_URL) ||
    "https://storage.googleapis.com/free-videos/sample.mp4",

  NODE_ENV: nodeEnv,
  PORT: port,
  MONGO_URI: mongoUri,
  JWT_SECRET: jwtSecret,
  JWT_REFRESH_SECRET: jwtRefreshSecret,
  AUTH_CHALLENGE_SECRET: authChallengeSecretInput || (isProduction ? "" : jwtSecret),
  MEDIA_SIGNING_SECRET: mediaSigningSecret,
  CLIENT_URL: toText(process.env.CLIENT_URL),
  FRONTEND_URL: toText(process.env.FRONTEND_URL),
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
  REQUIRE_EMAIL_OTP: requireEmailOtp,
  ALLOWED_FRONTEND_ORIGINS: allowedOrigins.join(","),
  LIVEKIT_API_KEY: livekitApiKey,
  LIVEKIT_API_SECRET: livekitApiSecret,
  LIVEKIT_HOST: livekitHost,
  LIVEKIT_WS_URL: livekitWsUrl,
};

module.exports = { config, ...config };
