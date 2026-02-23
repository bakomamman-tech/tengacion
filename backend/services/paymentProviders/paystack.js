const crypto = require("crypto");

const PAYSTACK_BASE_URL = "https://api.paystack.co";

const getSecretKey = () => process.env.PAYSTACK_SECRET_KEY || "";

const createProviderReference = ({ userId, itemType, itemId }) => {
  const seed = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `tengacion_${itemType}_${itemId}_${userId}_${seed}`.slice(0, 120);
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
      currency: "NGN",
    }),
  });

  const payload = await response.json();
  if (!response.ok || payload?.status !== true || !payload?.data?.authorization_url) {
    throw new Error(payload?.message || "Failed to initialize Paystack transaction");
  }

  return payload.data;
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

  const payload = await response.json();
  if (!response.ok || payload?.status !== true || !payload?.data) {
    throw new Error(payload?.message || "Failed to verify Paystack transaction");
  }

  return payload.data;
};

const verifyWebhookSignature = ({ rawBody = "", signature = "" }) => {
  const secret = getSecretKey();
  if (!secret || !rawBody || !signature) {
    return false;
  }

  const hash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  return hash === signature;
};

module.exports = {
  createProviderReference,
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature,
};
