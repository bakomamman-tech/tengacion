// backend/config/env.js

const path = require("path");
const dotenv = require("dotenv");

// Load env file (local/dev/test). On Render, env vars are injected, but this is harmless.
const envFile = process.env.NODE_ENV === "test" ? ".env.test" : ".env";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

// Helper: get env with default
const getEnv = (key, fallback = "") => {
  const val = process.env[key];
  return val === undefined || val === null || val === "" ? fallback : val;
};

// Helper: enforce required env keys
const requireEnv = (key) => {
  const val = process.env[key];
  if (!val) {
    const msg = `❌ Missing required env variable: ${key}`;

    // In tests, it's often better to throw than hard-exit the process.
    if (process.env.NODE_ENV === "test") {
      throw new Error(msg);
    }

    console.error(msg);
    process.exit(1);
  }
  return val;
};

// Required (backend runtime)
const MONGO_URI = requireEnv("MONGO_URI");
const JWT_SECRET = requireEnv("JWT_SECRET");

// Optional / defaults
const config = {
  MONGO_URI,
  JWT_SECRET,

  PAYSTACK_SECRET_KEY: getEnv("PAYSTACK_SECRET_KEY", ""),
  PAYSTACK_CALLBACK_URL: getEnv("PAYSTACK_CALLBACK_URL", ""),

  MEDIA_SIGNING_SECRET: getEnv("MEDIA_SIGNING_SECRET", JWT_SECRET),

  AWS_ACCESS_KEY_ID: getEnv("AWS_ACCESS_KEY_ID", ""),
  AWS_SECRET_ACCESS_KEY: getEnv("AWS_SECRET_ACCESS_KEY", ""),
  AWS_REGION: getEnv("AWS_REGION", ""),
  AWS_S3_BUCKET: getEnv("AWS_S3_BUCKET", ""),

  NODE_ENV: getEnv("NODE_ENV", "development"),

  // Ensure PORT is a number. Prefer Render's injected PORT.
  PORT: Number(getEnv("PORT", "5000")),
};

// Export both ways:
// 1) Preferred: const { config } = require("./config/env")
// 2) Backward compatible: const env = require("./config/env") -> env.PORT, env.MONGO_URI, etc.
module.exports = { config, ...config };