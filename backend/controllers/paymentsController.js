const asyncHandler = require("../middleware/asyncHandler");
const Purchase = require("../models/Purchase");
const Entitlement = require("../models/Entitlement");
const Track = require("../models/Track");
const Book = require("../models/Book");
const Album = require("../models/Album");
const User = require("../models/User");
const { resolvePurchasableItem } = require("../services/catalogService");
const {
  createProviderReference,
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature,
} = require("../services/paymentProviders/paystack");
const { logAnalyticsEvent } = require("../services/analyticsService");

// TODO(phase2): add subscription Fan Pass and gifting payment intents.

const toPurchasePayload = (purchase) => ({
  _id: purchase._id.toString(),
  itemType: purchase.itemType,
  itemId: purchase.itemId?.toString?.() || String(purchase.itemId || ""),
  amount: Number(purchase.amount) || 0,
  currency: purchase.currency || "NGN",
  status: purchase.status || "pending",
  provider: purchase.provider || "paystack",
  providerRef: purchase.providerRef || "",
  paidAt: purchase.paidAt || null,
  createdAt: purchase.createdAt,
});

const emitEntitlementGranted = ({ req, purchase }) => {
  const io = req.app?.get?.("io");
  if (!io || !purchase?.userId) {
    return;
  }

  const payload = {
    purchaseId: purchase._id?.toString?.() || "",
    itemType: purchase.itemType || "",
    itemId: purchase.itemId?.toString?.() || "",
    creatorId: purchase.creatorId?.toString?.() || "",
    status: "paid",
    paidAt: purchase.paidAt || new Date(),
  };

  io.to(`user:${String(purchase.userId)}`).emit("entitlement:granted", payload);
};

const markPurchasePaidAndGrantEntitlement = async (purchase) => {
  if (!purchase) return;

  purchase.status = "paid";
  purchase.paidAt = new Date();
  await purchase.save();

  await Entitlement.findOneAndUpdate(
    {
      buyerId: purchase.userId,
      itemType: purchase.itemType,
      itemId: purchase.itemId,
    },
    {
      $set: {
        grantedAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (purchase.itemType === "track") {
    await Track.updateOne({ _id: purchase.itemId }, { $inc: { purchaseCount: 1 } }).catch(() => null);
  } else if (purchase.itemType === "book") {
    await Book.updateOne({ _id: purchase.itemId }, { $inc: { purchaseCount: 1 } }).catch(() => null);
  } else if (purchase.itemType === "album") {
    await Album.updateOne({ _id: purchase.itemId }, { $inc: { purchaseCount: 1 } }).catch(() => null);
  }
};

exports.initializePayment = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const itemType = String(req.body?.itemType || "").trim().toLowerCase();
  const itemId = String(req.body?.itemId || "").trim();

  if (!itemType || !itemId) {
    return res.status(400).json({ error: "itemType and itemId are required" });
  }

  const item = await resolvePurchasableItem(itemType, itemId);
  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }

  if (Number(item.price) <= 0) {
    return res.status(400).json({ error: "Item is free and does not require payment" });
  }

  const user = await User.findById(userId).select("email").lean();
  if (!user?.email) {
    return res.status(400).json({ error: "User email is required for payment" });
  }

  const providerRef = createProviderReference({
    userId,
    itemType: item.itemType,
    itemId: item.itemId.toString(),
  });

  const returnUrl = String(req.body?.returnUrl || "").trim();
  const callbackUrl = /^https?:\/\//i.test(returnUrl)
    ? returnUrl
    : process.env.PAYSTACK_CALLBACK_URL || "";

  const purchase = await Purchase.create({
    userId,
    creatorId: item.creatorId || undefined,
    itemType: item.itemType,
    itemId: item.itemId,
    amount: Number(item.price),
    priceNGN: Number(item.price),
    currency: "NGN",
    status: "pending",
    provider: "paystack",
    providerRef,
  });

  try {
    const payment = await initializeTransaction({
      email: user.email,
      amountNgn: Number(item.price),
      reference: providerRef,
      callbackUrl,
      metadata: {
        app: "tengacion",
        itemType: item.itemType,
        itemId: item.itemId.toString(),
        purchaseId: purchase._id.toString(),
        userId,
      },
    });

    return res.status(201).json({
      purchase: toPurchasePayload(purchase),
      authorization_url: payment.authorization_url,
      reference: payment.reference || providerRef,
      access_code: payment.access_code || "",
    });
  } catch (error) {
    await Purchase.updateOne(
      { _id: purchase._id },
      { $set: { status: "failed" } }
    );
    await logAnalyticsEvent({
      type: "purchase_failed",
      userId,
      actorRole: req.user?.role || "user",
      targetId: purchase._id,
      targetType: "purchase",
      contentType: item.itemType,
      metadata: {
        itemId: item.itemId.toString(),
        amount: Number(item.price || 0),
        reason: error.message || "Payment initialization failed",
      },
    }).catch(() => null);
    return res.status(502).json({ error: error.message || "Payment initialization failed" });
  }
});

const handlePaystackWebhook = async (req, res) => {
  const signature = String(req.headers["x-paystack-signature"] || "");
  const rawBody = req.rawBody || "";

  if (!verifyWebhookSignature({ rawBody, signature })) {
    return res.status(401).json({ error: "Invalid Paystack signature" });
  }

  const event = req.body || {};
  const reference = String(event?.data?.reference || "").trim();

  if (!reference) {
    return res.status(200).json({ received: true });
  }

  const purchase = await Purchase.findOne({ providerRef: reference });
  if (!purchase) {
    return res.status(200).json({ received: true });
  }

  if (purchase.status === "paid") {
    return res.status(200).json({ received: true });
  }

  const tx = await verifyTransaction(reference);
  const paid = tx.status === "success";
  const amountNgn = Number(tx.amount || 0) / 100;
  const currency = String(tx.currency || "").toUpperCase();

  if (
    !paid ||
    currency !== purchase.currency ||
    amountNgn < Number(purchase.amount)
  ) {
    purchase.status = "failed";
    await purchase.save();
    await logAnalyticsEvent({
      type: "purchase_failed",
      userId: purchase.userId,
      targetId: purchase._id,
      targetType: "purchase",
      contentType: purchase.itemType,
      metadata: {
        itemId: purchase.itemId?.toString?.() || "",
        amount: Number(purchase.amount || 0),
        reason: "Webhook verification mismatch",
      },
    }).catch(() => null);
    return res.status(200).json({ received: true });
  }

  await markPurchasePaidAndGrantEntitlement(purchase);
  emitEntitlementGranted({ req, purchase });
  await logAnalyticsEvent({
    type: "purchase_success",
    userId: purchase.userId,
    targetId: purchase._id,
    targetType: "purchase",
    contentType: purchase.itemType,
    metadata: {
      creatorId: purchase.creatorId?.toString?.() || "",
      itemId: purchase.itemId?.toString?.() || "",
      amount: Number(purchase.amount || 0),
      provider: purchase.provider || "",
    },
  }).catch(() => null);

  return res.status(200).json({ received: true });
};

exports.paystackWebhook = asyncHandler(handlePaystackWebhook);

exports.providerWebhook = asyncHandler(async (req, res) => {
  const provider = String(req.params?.provider || "").toLowerCase();
  if (provider !== "paystack") {
    return res.status(400).json({ error: "Unsupported provider webhook" });
  }
  return handlePaystackWebhook(req, res);
});
