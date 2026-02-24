const path = require("path");
const dotenv = require("dotenv");
const { z } = require("zod");

const envFile = process.env.NODE_ENV === "test" ? ".env.test" : ".env";
dotenv.config({ path: path.resolve(__dirname, "../../../", envFile) });

const parseNumber = (value) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.preprocess((val) => parseNumber(val) ?? 5000, z.number().int().positive()),
  MONGO_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32).optional(),
  MEDIA_SIGNING_SECRET: z.string().min(32).optional(),
  REQUIRE_EMAIL_OTP: z.enum(["true", "false"]).default("false"),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_CALLBACK_URL: z.string().url().optional(),
  PAYSTACK_BASE_URL: z.string().url().default("https://api.paystack.co"),
  PAYSTACK_CURRENCY: z.string().default("NGN"),
  AWS_S3_MEDIA_URL: z.string().url().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  FRONTEND_URL: z.string().url().optional(),
});
const result = envSchema.safeParse({
  ...process.env,
  MEDIA_SIGNING_SECRET: process.env.MEDIA_SIGNING_SECRET || process.env.JWT_SECRET,
});

if (!result.success) {
  console.error("Invalid environment configuration:\n", result.error.format());
  process.exit(1);
}

const config = {
  ...result.data,
  NODE_ENV: result.data.NODE_ENV,
  PORT: Number(result.data.PORT),
};

module.exports = { config };
