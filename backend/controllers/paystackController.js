const asyncHandler = require("../middleware/asyncHandler");
const Purchase = require("../models/Purchase");
const Entitlement = require("../models/Entitlement");
const Track = require("../models/Track");
const Book = require("../models/Book");
const Album = require("../models/Album");
const User = require("../models/User");
const { resolvePurchasableItem } = require("../services/catalogService");
const { hasCreatorSubscriptionAccess } = require("../services/entitlementService");
const {
  generatePaymentReference,
  initializeTransaction,
  validateWebhookSignature,
  verifyTransaction,
} = require("../services/paystackService");
const { config } = require("../config/env");

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

const normalizeType = (value = "") => {
  const raw = String(value || "").trim().toLowerCase();
  const aliases = {
    music: "track",
    song: "track",
    tracks: "track",
    book: "book",
    books: "book",
    ebook: "book",
    podcasts: "podcast",
    podcast: "podcast",
    albums: "album",
    album: "album",
    videos: "video",
    video: "video",
    subscription: "subscription",
    membership: "subscription",
    fanpass: "subscription",
  };

  return aliases[raw] || raw;
};

const toIdString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  return value.toString();
};

const toPurchasePayload = (purchase) => ({
  _id: purchase._id.toString(),
  itemType: purchase.itemType,
  itemId: purchase.itemId?.toString?.() || String(purchase.itemId || ""),
  creatorId: purchase.creatorId?.toString?.() || "",
  amount: Number(purchase.amount) || 0,
  currency: purchase.currency || "NGN",
  status: purchase.status || "pending",
  provider: purchase.provider || "paystack",
  providerRef: purchase.providerRef || "",
  billingInterval: purchase.billingInterval || "one_time",
  accessExpiresAt: purchase.accessExpiresAt || null,
  paidAt: purchase.paidAt || null,
  createdAt: purchase.createdAt,
});

const emitEntitlementGranted = ({ req, purchase }) => {
  const io = req.app?.get?.("io");
  if (!io || !purchase?.userId) {
    return;
  }

  io.to(`user:${String(purchase.userId)}`).emit("entitlement:granted", {
    purchaseId: purchase._id?.toString?.() || "",
    itemType: purchase.itemType || "",
    itemId: purchase.itemId?.toString?.() || "",
    creatorId: purchase.creatorId?.toString?.() || "",
    status: "paid",
    paidAt: purchase.paidAt || new Date(),
  });
};

const isPublishablePayload = (payload = {}) => {
  const status = String(payload?.publishedStatus || payload?.status || "").trim().toLowerCase();
  if (payload?.isPublished === false) {
    return false;
  }
  if (["draft", "blocked", "private", "archived"].includes(status)) {
    return false;
  }
  return true;
};

const validatePurchasableItem = (item) => {
  if (!item) {
    return "Item not found";
  }

  if (!item.creatorId) {
    return "Creator not found";
  }

  if (!isPublishablePayload(item.payload)) {
    return "Item is not published";
  }

  if (!Number.isFinite(Number(item.price)) || Number(item.price) <= 0) {
    return "Item is free and does not require payment";
  }

  return "";
};

const getReturnUrl = (value = "") => {
  const trimmed = String(value || "").trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return String(config.PAYSTACK_CALLBACK_URL || "").trim();
};

const settlePurchasedAccess = async (purchase, { paidAt = new Date() } = {}) => {
  if (!purchase) {
    return { purchase: null, granted: false, alreadyGranted: false };
  }

  const settledPurchase = await Purchase.findOneAndUpdate(
    {
      _id: purchase._id,
      status: { $in: ["pending", "abandoned"] },
    },
    {
      $set: {
        status: "paid",
        paidAt,
        ...(purchase.itemType === "subscription"
          ? {
              billingInterval: "monthly",
              accessExpiresAt: new Date(paidAt.getTime() + MONTH_MS),
            }
          : {}),
      },
    },
    { new: true }
  );

  const finalPurchase = settledPurchase || (await Purchase.findById(purchase._id));
  if (!finalPurchase) {
    return { purchase: null, granted: false, alreadyGranted: false };
  }

  const shouldIncrementContentCounters = Boolean(settledPurchase);
  if (shouldIncrementContentCounters) {
    if (finalPurchase.itemType === "track") {
      await Track.updateOne({ _id: finalPurchase.itemId }, { $inc: { purchaseCount: 1 } }).catch(() => null);
    } else if (finalPurchase.itemType === "book") {
      await Book.updateOne({ _id: finalPurchase.itemId }, { $inc: { purchaseCount: 1 } }).catch(() => null);
    } else if (finalPurchase.itemType === "album") {
      await Album.updateOne({ _id: finalPurchase.itemId }, { $inc: { purchaseCount: 1 } }).catch(() => null);
    }
  }

  if (finalPurchase.itemType !== "subscription") {
    await Entitlement.updateOne(
      {
        buyerId: finalPurchase.userId,
        itemType: finalPurchase.itemType,
        itemId: finalPurchase.itemId,
      },
      {
        $setOnInsert: {
          grantedAt: finalPurchase.paidAt || paidAt,
        },
      },
      { upsert: true }
    );
  }

  return {
    purchase: finalPurchase,
    granted: Boolean(settledPurchase),
    alreadyGranted: !settledPurchase,
  };
};

const buildFailureResponse = async (purchase, reason) => {
  if (!purchase) {
    return;
  }

  await Purchase.updateOne(
    { _id: purchase._id },
    {
      $set: {
        status: "failed",
      },
    }
  ).catch(() => null);

  return reason;
};

const resolveCheckoutTarget = async ({ productType, productId, userId }) => {
  const normalizedType = normalizeType(productType);
  const item = await resolvePurchasableItem(normalizedType, productId);
  const validationError = validatePurchasableItem(item);
  if (validationError) {
    return { error: validationError, item: null };
  }

  if (normalizedType === "subscription" && String(item.ownerUserId || "") === String(userId || "")) {
    return { error: "You cannot subscribe to your own creator page", item: null };
  }

  if (
    normalizedType === "subscription" &&
    item.creatorId &&
    (await hasCreatorSubscriptionAccess({ userId, creatorId: item.creatorId }))
  ) {
    return { error: "You already have an active subscription for this creator", item: null };
  }

  return { error: "", item };
};

exports.initializePaystackPayment = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const user = await User.findById(userId).select("email").lean();
  if (!user?.email) {
    return res.status(400).json({ error: "User email is required for payment" });
  }

  const productType = String(req.body?.productType || req.body?.itemType || "").trim();
  const productId = String(req.body?.productId || req.body?.itemId || "").trim();
  if (!productType || !productId) {
    return res.status(400).json({ error: "productType and productId are required" });
  }

  const checkout = await resolveCheckoutTarget({ productType, productId, userId });
  if (checkout.error) {
    return res.status(checkout.error === "Item not found" ? 404 : 400).json({ error: checkout.error });
  }

  const item = checkout.item;
  const reference = generatePaymentReference(item.itemType);
  const callbackUrl = getReturnUrl(req.body?.returnUrl);
  const amount = Number(item.price) || 0;

  const purchase = await Purchase.create({
    userId,
    creatorId: item.creatorId || undefined,
    itemType: item.itemType,
    itemId: item.itemId,
    amount,
    priceNGN: amount,
    currency: String(config.PAYSTACK_CURRENCY || "NGN").toUpperCase(),
    status: "pending",
    provider: "paystack",
    providerRef: reference,
    billingInterval: item.itemType === "subscription" ? "monthly" : "one_time",
  });

  try {
    const payment = await initializeTransaction({
      email: user.email,
      amountNgn: amount,
      reference,
      callbackUrl,
      metadata: {
        buyerId: userId,
        creatorId: item.creatorId?.toString?.() || "",
        productId: item.itemId?.toString?.() || "",
        productType: item.itemType,
        productTitle: item.title || "",
      },
    });

    return res.status(201).json({
      purchase: toPurchasePayload(purchase),
      authorization_url: payment.authorization_url,
      access_code: payment.access_code || "",
      reference,
    });
  } catch (error) {
    await buildFailureResponse(purchase, error.message || "Payment initialization failed");
    return res.status(502).json({ error: error.message || "Payment initialization failed" });
  }
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

  const verified = await verifyTransaction(reference);
  const expectedAmountKobo = Math.round(Number(purchase.amount || 0) * 100);
  const verifiedAmountKobo = Number(verified.amountKobo || 0);
  const verifiedCurrency = String(verified.currency || "").trim().toUpperCase();

  if (
    verified.status !== "success" ||
    verifiedAmountKobo !== expectedAmountKobo ||
    verifiedCurrency !== String(purchase.currency || "NGN").trim().toUpperCase()
  ) {
    await buildFailureResponse(purchase, "Payment verification mismatch");
    return res.status(400).json({
      error: "Payment verification mismatch",
    });
  }

  const result = await settlePurchasedAccess(purchase, { paidAt: new Date() });
  if (result.granted) {
    emitEntitlementGranted({ req, purchase: result.purchase });
  }

  return res.json({
    success: true,
    verified: true,
    payment: toPurchasePayload(result.purchase),
    accessGranted: true,
    entitlement: {
      itemType: result.purchase.itemType,
      itemId: toIdString(result.purchase.itemId),
      buyerId: toIdString(result.purchase.userId),
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

  const verified = await verifyTransaction(reference);
  const expectedAmountKobo = Math.round(Number(purchase.amount || 0) * 100);
  const verifiedAmountKobo = Number(verified.amountKobo || 0);
  const verifiedCurrency = String(verified.currency || "").trim().toUpperCase();

  if (
    verified.status !== "success" ||
    verifiedAmountKobo !== expectedAmountKobo ||
    verifiedCurrency !== String(purchase.currency || "NGN").trim().toUpperCase()
  ) {
    await buildFailureResponse(purchase, "Webhook verification mismatch");
    return res.status(200).json({ received: true });
  }

  const result = await settlePurchasedAccess(purchase, { paidAt: new Date() });
  if (result.granted) {
    emitEntitlementGranted({ req, purchase: result.purchase });
  }

  return res.status(200).json({ received: true });
});
