const asyncHandler = require("../middleware/asyncHandler");
const Purchase = require("../models/Purchase");
const {
  initializePaystackCheckout,
  reconcilePurchase,
  toPurchasePayload,
  validateWebhookSignature,
} = require("../services/paymentOpsService");

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

  if (!validateWebhookSignature({ rawBody, signature })) {
    return res.status(401).json({ error: "Invalid Paystack signature" });
  }

  const event = req.body || {};
  if (String(event?.event || "").trim() !== "charge.success") {
    return res.status(200).json({ received: true });
  }

  const reference = String(event?.data?.reference || "").trim();
  if (!reference) {
    return res.status(200).json({ received: true });
  }

  const purchase = await Purchase.findOne({ providerRef: reference });
  if (!purchase) {
    return res.status(200).json({ received: true });
  }

  await reconcilePurchase({
    req,
    purchase,
    actorUserId: purchase.userId?.toString?.() || "",
    actorRole: "system",
    source: "webhook",
  });

  return res.status(200).json({ received: true });
});
