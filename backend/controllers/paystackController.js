const asyncHandler = require("../middleware/asyncHandler");
const Purchase = require("../models/Purchase");
const {
  handlePaystackWebhookEvent,
  handleStripeWebhookEvent,
  initializeCheckout,
  initializePaystackCheckout,
  reconcilePurchase,
  toLegacyCheckoutPayload,
  toPurchasePayload,
} = require("../services/paymentOpsService");

const buildCheckoutPayload = (checkout, currencyMode = "") => {
  const fallbackCurrencyMode =
    String(checkout.purchase?.currency || "").trim().toUpperCase() === "USD"
      ? "GLOBAL"
      : "NG";
  const resolvedCurrencyMode = currencyMode || fallbackCurrencyMode;

  return {
    purchase: toPurchasePayload(checkout.purchase),
    checkout: toLegacyCheckoutPayload({
      purchase: checkout.purchase,
      payment: checkout.payment,
      currencyMode: resolvedCurrencyMode,
    }),
    authorization_url: checkout.payment.authorization_url,
    checkoutUrl: checkout.payment.authorization_url,
    access_code: checkout.payment.access_code || "",
    reference: checkout.purchase.providerRef,
    provider: checkout.purchase.provider || "",
    providerSessionId: checkout.purchase.providerSessionId || checkout.payment.id || "",
  };
};

exports.initializePaystackPayment = asyncHandler(async (req, res) => {
  const productType = String(req.body?.productType || req.body?.itemType || "").trim();
  const productId = String(req.body?.productId || req.body?.itemId || "").trim();
  if (!productType || !productId) {
    return res.status(400).json({ error: "productType and productId are required" });
  }

  const checkout = await initializePaystackCheckout({
    req,
    userId: req.user.id,
    productType,
    productId,
    returnUrl: req.body?.returnUrl,
    currencyMode: req.body?.currencyMode,
    actorRole: req.user?.role || "user",
  });

  return res.status(201).json({
    purchase: toPurchasePayload(checkout.purchase),
    authorization_url: checkout.payment.authorization_url,
    access_code: checkout.payment.access_code || "",
    reference: checkout.purchase.providerRef,
  });
});

exports.initializePaymentCheckout = asyncHandler(async (req, res) => {
  const productType = String(req.body?.productType || req.body?.itemType || "").trim();
  const productId = String(req.body?.productId || req.body?.itemId || "").trim();
  if (!productType || !productId) {
    return res.status(400).json({ error: "productType and productId are required" });
  }

  const checkout = await initializeCheckout({
    req,
    userId: req.user.id,
    productType,
    productId,
    returnUrl: req.body?.returnUrl,
    currency: req.body?.currency,
    currencyMode: req.body?.currencyMode,
    actorRole: req.user?.role || "user",
  });

  return res.status(201).json(buildCheckoutPayload(checkout, req.body?.currencyMode));
});

exports.verifyPaystackPayment = asyncHandler(async (req, res) => {
  const reference = String(req.params?.reference || "").trim();
  if (!reference) {
    return res.status(400).json({ error: "reference is required" });
  }

  const purchase = await Purchase.findOne({ providerRef: reference });
  if (!purchase) {
    return res.status(404).json({ error: "Payment not found" });
  }

  if (String(purchase.userId || "") !== String(req.user.id || "")) {
    return res.status(403).json({ error: "You cannot verify this payment" });
  }

  const result = await reconcilePurchase({
    req,
    purchase,
    actorUserId: req.user.id,
    actorRole: req.user?.role || "user",
    source: "verify",
  });

  if (!result.success) {
    const pendingState = ["pending", "abandoned"].includes(String(result.purchase?.status || "").trim().toLowerCase());
    return res.status(pendingState ? 200 : 400).json({
      success: false,
      verified: false,
      accessGranted: false,
      status: result.purchase?.status || "failed",
      message: result.reason || "Payment verification failed",
      payment: toPurchasePayload(result.purchase),
    });
  }

  return res.json({
    success: true,
    verified: true,
    accessGranted: true,
    status: result.purchase?.status || "paid",
    payment: toPurchasePayload(result.purchase),
    entitlement: {
      itemType: result.purchase.itemType,
      itemId: result.purchase.itemId?.toString?.() || String(result.purchase.itemId || ""),
      buyerId: result.purchase.userId?.toString?.() || String(result.purchase.userId || ""),
    },
  });
});

exports.handlePaystackWebhook = asyncHandler(async (req, res) => {
  const signature = String(req.headers["x-paystack-signature"] || "");
  const rawBody = String(req.rawBody || "");
  const result = await handlePaystackWebhookEvent({
    req,
    rawBody,
    signature,
    event: req.body || {},
  });

  return res.status(200).json({ received: true, duplicate: Boolean(result.duplicate) });
});

exports.handleStripeWebhook = asyncHandler(async (req, res) => {
  const signature = String(req.headers["stripe-signature"] || "");
  const rawBody = String(req.rawBody || "");
  const result = await handleStripeWebhookEvent({
    req,
    rawBody,
    signature,
  });

  return res.status(200).json({ received: true, duplicate: Boolean(result.duplicate) });
});
