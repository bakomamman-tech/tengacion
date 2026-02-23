const asyncHandler = require("../middleware/asyncHandler");
const Purchase = require("../models/Purchase");
const User = require("../models/User");
const { resolvePurchasableItem } = require("../services/catalogService");
const {
  createProviderReference,
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature,
} = require("../services/paymentProviders/paystack");

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
    itemType: item.itemType,
    itemId: item.itemId,
    amount: Number(item.price),
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
    return res.status(502).json({ error: error.message || "Payment initialization failed" });
  }
});

exports.paystackWebhook = asyncHandler(async (req, res) => {
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
    return res.status(200).json({ received: true });
  }

  purchase.status = "paid";
  purchase.paidAt = new Date();
  await purchase.save();

  return res.status(200).json({ received: true });
});
