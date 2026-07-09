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

const paystackRequest = async ({
  path,
  method = "GET",
  body = null,
  query = {},
  errorMessage = "Paystack request failed",
} = {}) => {
  const secret = assertPaystackSecretUsable();
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  const suffix = params.toString() ? `?${params.toString()}` : "";

  let response;
  try {
    response = await fetch(`${PAYSTACK_BASE_URL}${path}${suffix}`, {
      method,
      headers: {
        Authorization: `Bearer ${secret}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw createPaystackError({
      message: error.message || errorMessage,
      providerStatus: "network_error",
    });
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.status !== true) {
    throw createPaystackError({
      message: payload?.message || errorMessage,
      providerHttpStatus: response.status,
      providerStatus: payload?.status === false ? "false" : String(payload?.status || ""),
    });
  }

  return payload;
};

const normalizeBank = (bank = {}) => ({
  id: bank.id || "",
  name: String(bank.name || "").trim(),
  slug: String(bank.slug || "").trim(),
  code: String(bank.code || "").trim(),
  longcode: String(bank.longcode || "").trim(),
  country: String(bank.country || "").trim(),
  currency: String(bank.currency || "").trim().toUpperCase(),
  type: String(bank.type || "").trim(),
  active: bank.active !== false,
});

const listBanks = async ({
  country = "nigeria",
  currency = "NGN",
  type = "nuban",
  perPage = 100,
} = {}) => {
  const payload = await paystackRequest({
    path: "/bank",
    query: {
      country,
      currency,
      type,
      perPage,
    },
    errorMessage: "Failed to list Paystack banks",
  });

  return Array.isArray(payload?.data) ? payload.data.map(normalizeBank) : [];
};

const resolveBankAccount = async ({ accountNumber, bankCode } = {}) => {
  const normalizedAccountNumber = String(accountNumber || "").replace(/\D/g, "").slice(0, 20);
  const normalizedBankCode = String(bankCode || "").trim();
  if (!normalizedAccountNumber || !normalizedBankCode) {
    throw createValidationError("Bank code and account number are required.");
  }

  const payload = await paystackRequest({
    path: "/bank/resolve",
    query: {
      account_number: normalizedAccountNumber,
      bank_code: normalizedBankCode,
    },
    errorMessage: "Failed to resolve bank account",
  });

  return {
    accountNumber: String(payload?.data?.account_number || normalizedAccountNumber),
    accountName: String(payload?.data?.account_name || "").trim(),
    bankId: payload?.data?.bank_id || "",
    raw: payload?.data || {},
  };
};

const normalizeTransferRecipient = (recipient = {}) => ({
  id: recipient.id || "",
  recipientCode: String(recipient.recipient_code || recipient.recipientCode || "").trim(),
  type: String(recipient.type || "").trim(),
  name: String(recipient.name || "").trim(),
  accountNumber: String(recipient.details?.account_number || recipient.account_number || "").trim(),
  accountName: String(recipient.details?.account_name || recipient.account_name || "").trim(),
  bankCode: String(recipient.details?.bank_code || recipient.bank_code || "").trim(),
  bankName: String(recipient.details?.bank_name || recipient.bank_name || "").trim(),
  currency: String(recipient.currency || getCurrency()).trim().toUpperCase() || getCurrency(),
  active: recipient.active !== false,
  raw: recipient,
});

const createTransferRecipient = async ({
  name,
  accountNumber,
  bankCode,
  currency = getCurrency(),
  metadata = {},
} = {}) => {
  const normalizedName = String(name || "").trim();
  const normalizedAccountNumber = String(accountNumber || "").replace(/\D/g, "").slice(0, 20);
  const normalizedBankCode = String(bankCode || "").trim();
  const normalizedCurrency = String(currency || getCurrency()).trim().toUpperCase() || getCurrency();

  if (!normalizedName || !normalizedAccountNumber || !normalizedBankCode) {
    throw createValidationError("Recipient name, bank code, and account number are required.");
  }

  const payload = await paystackRequest({
    path: "/transferrecipient",
    method: "POST",
    body: {
      type: "nuban",
      name: normalizedName,
      account_number: normalizedAccountNumber,
      bank_code: normalizedBankCode,
      currency: normalizedCurrency,
      metadata,
    },
    errorMessage: "Failed to create Paystack transfer recipient",
  });

  return normalizeTransferRecipient(payload?.data || {});
};

const mapTransferStatus = (status = "") => {
  const normalized = String(status || "").trim().toLowerCase();
  if (["success", "successful"].includes(normalized)) return "success";
  if (["failed", "failure"].includes(normalized)) return "failed";
  if (normalized === "reversed") return "reversed";
  if (normalized === "otp") return "otp";
  if (["pending", "queued", "processing", "received"].includes(normalized)) return "pending";
  return normalized || "pending";
};

const normalizeTransferResponse = (payload = {}) => {
  const data = payload?.data || payload || {};
  const amountKobo = Number(data.amount || 0);

  return {
    id: data.id || "",
    amount: Number.isFinite(amountKobo) ? amountKobo / 100 : 0,
    amountKobo: Number.isFinite(amountKobo) ? amountKobo : 0,
    currency: String(data.currency || getCurrency()).trim().toUpperCase() || getCurrency(),
    reference: String(data.reference || "").trim().toLowerCase(),
    status: mapTransferStatus(data.status || payload?.status || ""),
    providerStatus: String(data.status || "").trim(),
    transferCode: String(data.transfer_code || data.transferCode || "").trim(),
    recipientCode: String(data.recipient || data.recipient_code || "").trim(),
    reason: String(data.reason || "").trim(),
    transferredAt: data.transferred_at || null,
    raw: data,
  };
};

const initiateTransfer = async ({
  amountNgn,
  recipient,
  reference,
  reason = "",
  currency = getCurrency(),
} = {}) => {
  const amount = Number(amountNgn);
  const amountKobo = Math.round(amount * 100);
  const normalizedRecipient = String(recipient || "").trim();
  const normalizedReference = String(reference || "").trim().toLowerCase();
  const normalizedCurrency = String(currency || getCurrency()).trim().toUpperCase() || getCurrency();

  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(amountKobo) || amountKobo <= 0) {
    throw createValidationError("A valid transfer amount is required.");
  }
  if (!normalizedRecipient) {
    throw createValidationError("A Paystack transfer recipient is required.");
  }
  if (!/^[a-z0-9_-]{16,50}$/.test(normalizedReference)) {
    throw createValidationError(
      "A transfer reference must be 16 to 50 lowercase letters, numbers, dashes, or underscores."
    );
  }

  const payload = await paystackRequest({
    path: "/transfer",
    method: "POST",
    body: {
      source: "balance",
      amount: amountKobo,
      recipient: normalizedRecipient,
      reference: normalizedReference,
      reason: reason || "Tengacion withdrawal",
      currency: normalizedCurrency,
    },
    errorMessage: "Failed to initiate Paystack transfer",
  });

  return normalizeTransferResponse(payload);
};

const verifyTransfer = async (reference) => {
  const normalizedReference = String(reference || "").trim();
  if (!normalizedReference) {
    throw createValidationError("Transfer reference is required.");
  }

  const payload = await paystackRequest({
    path: `/transfer/verify/${encodeURIComponent(normalizedReference)}`,
    errorMessage: "Failed to verify Paystack transfer",
  });

  return normalizeTransferResponse(payload);
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
  createTransferRecipient,
  generatePaymentReference,
  getCurrency,
  getPaystackKeyMode,
  initializeTransaction,
  initiateTransfer,
  isPaystackLiveKeyRequired,
  listBanks,
  mapGatewayStatus,
  mapTransferStatus,
  normalizePaystackErrorMessage,
  normalizePaystackResponse,
  normalizeTransferResponse,
  resolveBankAccount,
  validateWebhookSignature,
  verifyTransfer,
  verifyTransaction,
};
