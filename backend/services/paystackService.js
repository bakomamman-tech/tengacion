const crypto = require("crypto");
const { config } = require("../config/env");

const PAYSTACK_BASE_URL = String(config.PAYSTACK_BASE_URL || "https://api.paystack.co").replace(/\/+$/, "");
const PAYSTACK_CHECKOUT_CHANNELS = ["card", "ussd", "bank_transfer"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parseBooleanFlag = (value, fallback = false) => {
  if (value == null || value === "") {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
};

const getSecretKey = () => String(process.env.PAYSTACK_SECRET_KEY || config.PAYSTACK_SECRET_KEY || "").trim();

const getCurrency = () => String(process.env.PAYSTACK_CURRENCY || config.PAYSTACK_CURRENCY || "NGN")
  .trim()
  .toUpperCase() || "NGN";

const getPaystackKeyMode = (secret = getSecretKey()) => {
  const normalized = String(secret || "").trim();
  if (normalized.startsWith("sk_live_")) {
    return "live";
  }
  if (normalized.startsWith("sk_test_")) {
    return "test";
  }
  return normalized ? "unknown" : "missing";
};

const isPaystackLiveKeyRequired = () =>
  Boolean(config.isProduction || process.env.NODE_ENV === "production") ||
  parseBooleanFlag(
    process.env.PAYSTACK_REQUIRE_LIVE_KEY,
    parseBooleanFlag(config.PAYSTACK_REQUIRE_LIVE_KEY, false)
  );

const assertPaystackSecretUsable = (secret = getSecretKey()) => {
  if (!secret) {
    throw new Error("Paystack secret key is not configured");
  }

  if (isPaystackLiveKeyRequired() && getPaystackKeyMode(secret) !== "live") {
    throw new Error(
      "Paystack live secret key is required for production payments. Configure PAYSTACK_SECRET_KEY with an sk_live_ key before accepting real card payments."
    );
  }

  return secret;
};

const normalizeProductTypeToken = (value = "") =>
  String(value || "")
    .trim()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase() || "PAYMENT";

const createPaystackError = ({
  message = "Failed to initialize Paystack transaction",
  status = 503,
  providerHttpStatus = 0,
  providerStatus = "",
} = {}) => {
  const error = new Error(message);
  error.status = status;
  error.statusCode = status;
  error.isOperational = true;
  error.provider = "paystack";
  error.providerHttpStatus = providerHttpStatus;
  error.providerStatus = providerStatus;
  error.providerMessage = message;
  error.paystackStatus = providerStatus || providerHttpStatus || "";
  error.paystackMessage = message;
  return error;
};

const createValidationError = (message) =>
  createPaystackError({
    message,
    status: 400,
  });

const generatePaymentReference = (productType = "") => {
  const token = normalizeProductTypeToken(productType);
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `TGN_${token}_${timestamp}_${random}`;
};

const mapGatewayStatus = (status = "") => {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "success") return "success";
  if (normalized === "failed") return "failed";
  if (normalized === "abandoned") return "abandoned";
  if (normalized === "reversed") return "reversed";
  if (normalized === "ongoing" || normalized === "pending" || normalized === "processing") {
    return "pending";
  }
  return normalized || "pending";
};

const normalizePaystackResponse = (payload = {}) => {
  const data = payload?.data || payload || {};
  const amountKobo = Number(data.amount || 0);

  return {
    ...data,
    amount: Number.isFinite(amountKobo) ? amountKobo / 100 : 0,
    amountKobo: Number.isFinite(amountKobo) ? amountKobo : 0,
    currency: String(data.currency || getCurrency()).trim().toUpperCase() || getCurrency(),
    status: mapGatewayStatus(data.status || payload?.status || ""),
    authorization_url: String(data.authorization_url || ""),
    access_code: String(data.access_code || ""),
    reference: String(data.reference || ""),
    raw: data,
  };
};

const initializeTransaction = async ({
  email,
  amountNgn,
  reference,
  callbackUrl,
  metadata = {},
}) => {
  const secret = assertPaystackSecretUsable();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    throw createValidationError("A valid email is required to start payment.");
  }

  const amount = Number(amountNgn);
  const amountKobo = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(amountKobo) || amountKobo <= 0) {
    throw createValidationError("A valid amount is required to start payment.");
  }

  const normalizedReference = String(reference || "").trim();
  if (!normalizedReference) {
    throw createValidationError("A payment reference is required to start payment.");
  }

  let response;
  try {
    response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: normalizedEmail,
        amount: amountKobo,
        reference: normalizedReference,
        callback_url: callbackUrl || undefined,
        metadata,
        currency: getCurrency(),
        channels: PAYSTACK_CHECKOUT_CHANNELS,
      }),
    });
  } catch (error) {
    throw createPaystackError({
      message: error.message || "Paystack initialize request failed",
      providerStatus: "network_error",
    });
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.status !== true || !payload?.data?.authorization_url) {
    throw createPaystackError({
      message: payload?.message || "Failed to initialize Paystack transaction",
      providerHttpStatus: response.status,
      providerStatus: payload?.status === false ? "false" : String(payload?.status || ""),
    });
  }

  return normalizePaystackResponse(payload);
};

const verifyTransaction = async (reference) => {
  const secret = assertPaystackSecretUsable();

  const response = await fetch(
    `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secret}`,
      },
    }
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.status !== true || !payload?.data) {
    throw new Error(payload?.message || "Failed to verify Paystack transaction");
  }

  return normalizePaystackResponse(payload);
};

const validateWebhookSignature = ({ rawBody = "", signature = "" }) => {
  let secret = "";
  try {
    secret = assertPaystackSecretUsable();
  } catch {
    return false;
  }
  if (!secret || !rawBody || !signature) {
    return false;
  }

  let computed;
  try {
    computed = crypto.createHmac("sha512", secret).update(rawBody).digest();
  } catch {
    return false;
  }

  let received;
  try {
    received = Buffer.from(String(signature || "").trim(), "hex");
  } catch {
    return false;
  }

  if (computed.length !== received.length) {
    return false;
  }

  return crypto.timingSafeEqual(computed, received);
};

module.exports = {
  PAYSTACK_CHECKOUT_CHANNELS,
  assertPaystackSecretUsable,
  generatePaymentReference,
  getPaystackKeyMode,
  initializeTransaction,
  isPaystackLiveKeyRequired,
  mapGatewayStatus,
  normalizePaystackResponse,
  validateWebhookSignature,
  verifyTransaction,
};
