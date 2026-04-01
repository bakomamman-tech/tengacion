const crypto = require("crypto");
const { config } = require("../config/env");

const PAYSTACK_BASE_URL = String(config.PAYSTACK_BASE_URL || "https://api.paystack.co").replace(/\/+$/, "");
const PAYSTACK_CHECKOUT_CHANNELS = ["card", "ussd", "bank_transfer"];

const getSecretKey = () => String(config.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET_KEY || "").trim();

const getCurrency = () => String(config.PAYSTACK_CURRENCY || process.env.PAYSTACK_CURRENCY || "NGN")
  .trim()
  .toUpperCase() || "NGN";

const normalizeProductTypeToken = (value = "") =>
  String(value || "")
    .trim()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase() || "PAYMENT";

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
  const secret = getSecretKey();
  if (!secret) {
    throw new Error("Paystack secret key is not configured");
  }

  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: Math.round(Number(amountNgn) * 100),
      reference,
      callback_url: callbackUrl || undefined,
      metadata,
      currency: getCurrency(),
      channels: PAYSTACK_CHECKOUT_CHANNELS,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.status !== true || !payload?.data?.authorization_url) {
    throw new Error(payload?.message || "Failed to initialize Paystack transaction");
  }

  return normalizePaystackResponse(payload);
};

const verifyTransaction = async (reference) => {
  const secret = getSecretKey();
  if (!secret) {
    throw new Error("Paystack secret key is not configured");
  }

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
  const secret = getSecretKey();
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
  generatePaymentReference,
  initializeTransaction,
  mapGatewayStatus,
  normalizePaystackResponse,
  validateWebhookSignature,
  verifyTransaction,
};
