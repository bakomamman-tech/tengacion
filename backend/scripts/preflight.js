const { config } = require("../config/env");

const getPaystackKeyMode = (value = "") => {
  const secret = String(value || "").trim();
  if (secret.startsWith("sk_live_")) return "live";
  if (secret.startsWith("sk_test_")) return "test";
  return secret ? "unknown" : "missing";
};

const baseChecks = [
  { key: "MONGO_URI", label: "MongoDB URI", type: "hard" },
  { key: "JWT_SECRET", label: "JWT secret", type: "hard", minLength: 32 },
  { key: "JWT_REFRESH_SECRET", label: "JWT refresh secret", type: "hard", minLength: 32 },
  { key: "AUTH_CHALLENGE_SECRET", label: "Auth challenge secret", type: "hard", minLength: 32 },
  { key: "MEDIA_SIGNING_SECRET", label: "Media signing secret", type: "warn", minLength: 32 },
  { key: "LIVEKIT_API_KEY", label: "LiveKit API key", type: "warn" },
  { key: "LIVEKIT_API_SECRET", label: "LiveKit API secret", type: "warn" },
  { key: "LIVEKIT_WS_URL", label: "LiveKit WebSocket URL", type: "warn" },
  { key: "LIVEKIT_HOST", label: "LiveKit host", type: "warn" },
  { key: "APP_URL", label: "App URL", type: "warn" },
  { key: "CLIENT_URL", label: "Client URL", type: "warn" },
  { key: "CORS_ORIGIN", label: "CORS origin", type: "warn" },
  { key: "CLOUDINARY_CLOUD_NAME", label: "Cloudinary cloud name", type: "warn" },
  { key: "CLOUDINARY_API_KEY", label: "Cloudinary API key", type: "warn" },
  { key: "CLOUDINARY_API_SECRET", label: "Cloudinary API secret", type: "warn" },
  { key: "PAYSTACK_CALLBACK_URL", label: "Paystack callback URL", type: "warn" },
  {
    key: "PAYSTACK_SECRET_KEY",
    label: "Paystack live secret",
    type: config.paystackRequireLiveKey ? "hard" : "warn",
    paystackLiveKey: config.paystackRequireLiveKey,
  },
  { key: "PLATFORM_SETTLEMENT_ACCOUNT_NAME", label: "Platform settlement account name", type: "warn" },
  { key: "PLATFORM_SETTLEMENT_BANK_NAME", label: "Platform settlement bank", type: "warn" },
  { key: "PLATFORM_SETTLEMENT_ACCOUNT_NUMBER", label: "Platform settlement account number", type: "warn" },
  { key: "STRIPE_SECRET_KEY", label: "Stripe secret", type: "warn" },
  { key: "STRIPE_WEBHOOK_SECRET", label: "Stripe webhook secret", type: "warn" },
  { key: "CONTACT_EMAIL", label: "Business contact email", type: "warn" },
  { key: "SUPPORT_EMAIL", label: "Support email", type: "warn" },
  { key: "ADMIN_NOTIFICATION_EMAIL", label: "Admin notification email", type: "warn" },
  { key: "EMAIL_FROM", label: "Transactional email sender", type: "warn" },
  { key: "SMTP_HOST", label: "SMTP host", type: "warn" },
  { key: "SMTP_PORT", label: "SMTP port", type: "warn" },
  { key: "SMTP_USER", label: "SMTP user", type: "warn" },
  { key: "SMTP_PASS", label: "SMTP password", type: "warn" },
];

const defaultedAkusoKeys = new Set([
  "OPENAI_MODEL_PRIMARY",
  "OPENAI_MODEL_FAST",
  "OPENAI_MODEL_WRITING",
  "OPENAI_MODEL_REASONING",
  "AKUSO_REQUEST_TIMEOUT_MS",
  "AKUSO_MAX_INPUT_CHARS",
  "AKUSO_MAX_OUTPUT_TOKENS",
  "AKUSO_RATE_LIMIT_WINDOW_MS",
  "AKUSO_RATE_LIMIT_MAX",
  "AKUSO_ENABLE_AUDIT_LOGS",
  "AKUSO_ENABLE_STREAMING",
]);

const defaultedPlatformSettlementKeys = new Set([
  "PLATFORM_SETTLEMENT_ACCOUNT_NAME",
  "PLATFORM_SETTLEMENT_BANK_NAME",
  "PLATFORM_SETTLEMENT_ACCOUNT_NUMBER",
]);

const defaultedBusinessEmailKeys = new Set([
  "CONTACT_EMAIL",
  "SUPPORT_EMAIL",
  "ADMIN_NOTIFICATION_EMAIL",
  "EMAIL_FROM",
]);

const statusIcons = {
  ok: "OK",
  skipped: "SKIP",
  missing: "ERR",
  weak: "WARN",
};

const buildChecks = () => {
  const checks = [...baseChecks];
  if (!config.assistantEnabled) {
    return checks;
  }

  return checks.concat([
    {
      key: "OPENAI_API_KEY",
      label: "Akuso OpenAI API key",
      type: config.isProduction ? "hard" : "warn",
    },
    { key: "OPENAI_MODEL_PRIMARY", label: "Akuso primary model", type: "warn" },
    { key: "OPENAI_MODEL_FAST", label: "Akuso fast model", type: "warn" },
    { key: "OPENAI_MODEL_WRITING", label: "Akuso writing model", type: "warn" },
    { key: "OPENAI_MODEL_REASONING", label: "Akuso reasoning model", type: "warn" },
    { key: "AKUSO_REQUEST_TIMEOUT_MS", label: "Akuso request timeout", type: "warn" },
    { key: "AKUSO_MAX_INPUT_CHARS", label: "Akuso max input chars", type: "warn" },
    { key: "AKUSO_MAX_OUTPUT_TOKENS", label: "Akuso max output tokens", type: "warn" },
    { key: "AKUSO_RATE_LIMIT_WINDOW_MS", label: "Akuso rate limit window", type: "warn" },
    { key: "AKUSO_RATE_LIMIT_MAX", label: "Akuso rate limit max", type: "warn" },
    { key: "AKUSO_ENABLE_AUDIT_LOGS", label: "Akuso audit logging flag", type: "warn" },
    { key: "AKUSO_ENABLE_STREAMING", label: "Akuso streaming flag", type: "warn" },
  ]);
};

const readCheckValue = (check) => {
  if (defaultedAkusoKeys.has(check.key) || defaultedPlatformSettlementKeys.has(check.key)) {
    return process.env[check.key] || config[check.key];
  }
  if (defaultedBusinessEmailKeys.has(check.key)) {
    return process.env[check.key] || config[check.key];
  }

  return process.env[check.key];
};

const runPreflight = () => {
  const results = [];
  let success = true;

  console.log("\n== Render preflight ==");

  buildChecks().forEach((check) => {
    const rawValue = readCheckValue(check);
    const value = rawValue == null ? "" : String(rawValue);
    let status = "ok";
    let note = "";

    if (!value) {
      if (defaultedAkusoKeys.has(check.key)) {
        note = "using config default";
      } else if (check.type === "hard") {
        status = "missing";
        note = "not set";
      } else {
        status = "skipped";
        note = "optional/not set";
      }
    } else if (check.minLength && value.length < check.minLength) {
      status = "weak";
      note = `too short (needs >= ${check.minLength} chars)`;
    } else if (check.paystackLiveKey && getPaystackKeyMode(value) !== "live") {
      status = "weak";
      note = "must start with sk_live_ for live charges";
    }

    if ((status === "missing" || status === "weak") && check.type === "hard") {
      success = false;
    }

    results.push({ ...check, status, note });
    const icon = statusIcons[status] || statusIcons.ok;
    const suffix = note ? ` - ${note}` : "";
    console.log(`${icon} ${check.label}${suffix}`);
  });

  if (!success) {
    console.error("\nPreflight failed: missing or invalid env vars detected.");
  } else {
    console.log("\nPreflight passed.");
  }

  return { success, results };
};

if (require.main === module) {
  const outcome = runPreflight();
  if (!outcome.success) {
    process.exit(1);
  }
}

module.exports = runPreflight;
