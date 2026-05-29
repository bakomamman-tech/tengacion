const crypto = require("crypto");
const { config } = require("../config/env");

const PAYSTACK_BASE_URL = String(config.PAYSTACK_BASE_URL || "https://api.paystack.co").replace(/\/+$/, "");
const PAYSTACK_CHECKOUT_CHANNELS = ["card", "bank", "ussd", "bank_transfer"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAYSTACK_SECRET_PREFIX_PATTERN = /^sk_(test|live)_/i;
const PAYSTACK_PLACEHOLDER_PATTERN =
  /^sk_(test|live)_(x+|your[_-]?key|replace[_-]?me|placeholder|example|test[_-]?key)$/i;
const PAYSTACK_INVALID_KEY_PATTERN = /\binvalid\s+key\b/i;
const PAYSTACK_INVALID_KEY_MESSAGE =
  "Paystack rejected the configured secret key. Set PAYSTACK_SECRET_KEY to the active sk_live_ key from the Paystack dashboard and restart the backend.";

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

const normalizePaystackErrorMessage = (message = "") => {
  const normalized = String(message || "").trim();
  if (PAYSTACK_INVALID_KEY_PATTERN.test(normalized)) {
    return PAYSTACK_INVALID_KEY_MESSAGE;
  }
  return normalized || "Failed to initialize Paystack transaction";
};

const isPaystackLiveKeyRequired = () =>
  Boolean(config.isProduction || process.env.NODE_ENV === "production") ||
  parseBooleanFlag(
    process.env.PAYSTACK_REQUIRE_LIVE_KEY,
    parseBooleanFlag(config.PAYSTACK_REQUIRE_LIVE_KEY, false)
  );

const assertPaystackSecretUsable = (secret = getSecretKey()) => {
  const normalizedSecret = String(secret || "").trim();
  if (!normalizedSecret) {
    throw new Error("Paystack secret key is not configured");
  }

  if (PAYSTACK_PLACEHOLDER_PATTERN.test(normalizedSecret)) {
    throw new Error(
      "Paystack secret key is still a placeholder. Configure PAYSTACK_SECRET_KEY with an active sk_live_ key from the Paystack dashboard."
    );
  }

  if (!PAYSTACK_SECRET_PREFIX_PATTERN.test(normalizedSecret)) {
    throw new Error(
      "Paystack secret key must start with sk_live_ for live payments or sk_test_ for test payments. Do not use a public pk_ key here."
    );
  }

  if (isPaystackLiveKeyRequired() && getPaystackKeyMode(normalizedSecret) !== "live") {
    throw new Error(
      "Paystack live secret key is required for production payments. Configure PAYSTACK_SECRET_KEY with an sk_live_ key before accepting real card payments."
    );
  }

  return normalizedSecret;
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
  const providerMessage = String(message || "").trim();
  const safeMessage = normalizePaystackErrorMessage(providerMessage);
  const error = new Error(safeMessage);
  error.status = status;
  error.statusCode = status;
  error.isOperational = true;
  error.provider = "paystack";
  error.providerHttpStatus = providerHttpStatus;
  error.providerStatus = providerStatus;
  error.providerMessage = safeMessage;
  error.rawProviderMessage = providerMessage;
  error.paystackStatus = providerStatus || providerHttpStatus || "";
  error.paystackMessage = safeMessage;
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
  normalizePaystackErrorMessage,
  normalizePaystackResponse,
  validateWebhookSignature,
  verifyTransaction,
};
