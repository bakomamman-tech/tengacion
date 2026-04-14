const { config } = require("../config/env");

const baseChecks = [
  { key: "MONGO_URI", label: "MongoDB URI", type: "hard" },
  { key: "JWT_SECRET", label: "JWT secret", type: "hard", minLength: 32 },
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
  { key: "PAYSTACK_SECRET_KEY", label: "Paystack secret", type: "warn" },
  { key: "STRIPE_SECRET_KEY", label: "Stripe secret", type: "warn" },
  { key: "STRIPE_WEBHOOK_SECRET", label: "Stripe webhook secret", type: "warn" },
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

const statusIcons = {
  ok: "OK",
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
  if (defaultedAkusoKeys.has(check.key)) {
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
      } else {
        status = "missing";
        note = "not set";
      }
    } else if (check.minLength && value.length < check.minLength) {
      status = "weak";
      note = `too short (needs >= ${check.minLength} chars)`;
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
