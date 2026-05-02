const crypto = require("crypto");
const Stripe = require("stripe");
const { config } = require("../config/env");

const getSecretKey = () => String(config.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY || "").trim();
const getWebhookSecret = () =>
  String(config.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET || "").trim();

const createStripeClient = () => {
  const secret = getSecretKey();
  if (!secret) {
    throw new Error("Stripe secret key is not configured");
  }
  return new Stripe(secret);
};

const normalizeProductTypeToken = (value = "") =>
  String(value || "")
    .trim()
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase() || "PAYMENT";

const generateStripeReference = (productType = "") => {
  const token = normalizeProductTypeToken(productType);
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `TGN_STRIPE_${token}_${timestamp}_${random}`;
};

const appendQueryParams = (url = "", params = {}) => {
  const target = String(url || config.CLIENT_URL || config.APP_URL || "").trim();
  if (!target) {
    return "";
  }
  const pairs = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${String(value)}`);
  if (!pairs.length) {
    return target;
  }
  return `${target}${target.includes("?") ? "&" : "?"}${pairs.join("&")}`;
};

const normalizeStripeSession = (session = {}) => ({
  id: String(session.id || ""),
  authorization_url: String(session.url || ""),
  url: String(session.url || ""),
  reference: String(session.metadata?.providerRef || ""),
  amount: Number(session.amount_total || 0) / 100,
  amountMinor: Number(session.amount_total || 0),
  currency: String(session.currency || "usd").trim().toUpperCase() || "USD",
  payment_status: String(session.payment_status || ""),
  status: String(session.status || ""),
  metadata: session.metadata || {},
  raw: session,
});

const createCheckoutSession = async ({
  email,
  amountUsd,
  reference,
  purchaseId,
  item,
  returnUrl,
  metadata = {},
} = {}) => {
  const stripe = createStripeClient();
  const amountMinor = Math.round(Number(amountUsd || 0) * 100);
  if (!email) {
    throw new Error("User email is required for Stripe checkout");
  }
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
    throw new Error("Valid USD amount is required for Stripe checkout");
  }

  const successUrl = appendQueryParams(returnUrl || config.PAYSTACK_CALLBACK_URL || config.CLIENT_URL, {
    provider: "stripe",
    reference,
    session_id: "{CHECKOUT_SESSION_ID}",
  });
  const cancelUrl = appendQueryParams(returnUrl || config.PAYSTACK_CALLBACK_URL || config.CLIENT_URL, {
    provider: "stripe",
    reference,
    status: "cancelled",
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    client_reference_id: String(purchaseId || ""),
    success_url: successUrl || undefined,
    cancel_url: cancelUrl || undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amountMinor,
          product_data: {
            name: String(item?.title || "Tengacion purchase").slice(0, 120),
            description: String(item?.description || "").slice(0, 500) || undefined,
          },
        },
      },
    ],
    metadata: {
      app: "tengacion",
      providerRef: reference,
      purchaseId: String(purchaseId || ""),
      ...metadata,
    },
  });

  return normalizeStripeSession(session);
};

const retrieveCheckoutSession = async (sessionId) => {
  const stripe = createStripeClient();
  const session = await stripe.checkout.sessions.retrieve(String(sessionId || ""));
  return normalizeStripeSession(session);
};

const constructWebhookEvent = ({ rawBody = "", signature = "" } = {}) => {
  const webhookSecret = getWebhookSecret();
  if (!webhookSecret) {
    throw new Error("Stripe webhook secret is not configured");
  }
  if (!rawBody || !signature) {
    throw new Error("Stripe webhook signature is required");
  }

  const stripe = createStripeClient();
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
};

module.exports = {
  appendQueryParams,
  constructWebhookEvent,
  createCheckoutSession,
  generateStripeReference,
  normalizeStripeSession,
  retrieveCheckoutSession,
};
