// backend/config/env.js

const requiredEnv = [
  "MONGO_URI",
  "JWT_SECRET"
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`❌ Missing required env variable: ${key}`);
    process.exit(1);
  }
}

module.exports = {
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY || "",
  PAYSTACK_CALLBACK_URL: process.env.PAYSTACK_CALLBACK_URL || "",
  MEDIA_SIGNING_SECRET: process.env.MEDIA_SIGNING_SECRET || process.env.JWT_SECRET,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || "",
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || "",
  AWS_REGION: process.env.AWS_REGION || "",
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || "",
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT || 5000
};
