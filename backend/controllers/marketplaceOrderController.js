const asyncHandler = require("../middleware/asyncHandler");
const MarketplaceOrder = require("../models/MarketplaceOrder");
const {
  initializeMarketplaceOrder,
  listBuyerOrders,
  listSellerOrders,
  reconcileMarketplaceOrder,
  serializeOrder,
  serializeTransaction,
  updateSellerOrderStatus,
} = require("../services/marketplaceOrderService");
const {
  validateMarketplaceWebhookSignature,
} = require("../services/marketplacePaystackService");

const canVerifyOrder = (req, order) => {
  if (!req.user?.id || !order) {
    return false;
  }

  const role = String(req.user.role || "").trim().toLowerCase();
  if (["admin", "super_admin"].includes(role)) {
    return true;
  }

  return String(order.buyer || "") === String(req.user.id || "");
};

exports.initializeOrder = asyncHandler(async (req, res) => {
  const payload = await initializeMarketplaceOrder({
    req,
    buyerId: req.user.id,
    payload: req.body || {},
  });

  return res.status(201).json(payload);
});

exports.verifyOrder = asyncHandler(async (req, res) => {
  const reference = String(req.body?.reference || req.body?.paymentReference || "").trim();
  if (!reference) {
    return res.status(400).json({ error: "reference is required" });
  }

  const order = await MarketplaceOrder.findOne({ paymentReference: reference });
  if (!order) {
    return res.status(404).json({ error: "Marketplace order not found" });
  }

  if (!canVerifyOrder(req, order)) {
    return res.status(403).json({ error: "You cannot verify this marketplace payment" });
  }

  const result = await reconcileMarketplaceOrder({ order });
  const freshOrder = await MarketplaceOrder.findById(order._id).populate("seller").populate("buyer");

  return res.json({
    success: Boolean(result.success),
    verified: Boolean(result.verified),
    message: result.message || "",
    order: freshOrder
      ? serializeOrder(freshOrder, {
          buyer: freshOrder.buyer,
          seller: freshOrder.seller,
          includeBuyer: false,
          includeDelivery: true,
        })
      : null,
    transaction: result.transaction ? serializeTransaction(result.transaction) : null,
  });
});

exports.getBuyerOrders = asyncHandler(async (req, res) => {
  const payload = await listBuyerOrders({
    buyerId: req.user.id,
    page: req.query.page || 1,
    limit: req.query.limit || 20,
    status: req.query.status || "",
  });

  return res.json(payload);
});

exports.getSellerOrders = asyncHandler(async (req, res) => {
  const payload = await listSellerOrders({
    sellerId: req.marketplaceSeller._id,
    page: req.query.page || 1,
    limit: req.query.limit || 20,
    paymentStatus: req.query.paymentStatus || "",
    orderStatus: req.query.orderStatus || "",
  });

  return res.json(payload);
});

exports.updateSellerOrderStatus = asyncHandler(async (req, res) => {
  const order = await updateSellerOrderStatus({
    sellerId: req.marketplaceSeller._id,
    orderId: req.params.id,
    status: req.body?.status,
    notes: req.body?.notes || req.body?.fulfillmentNotes || "",
  });

  return res.json({ order });
});

exports.handlePaystackWebhook = asyncHandler(async (req, res) => {
  const signature = String(req.headers["x-paystack-signature"] || "");
  const rawBody = String(req.rawBody || "");

  if (!validateMarketplaceWebhookSignature({ rawBody, signature })) {
    return res.status(401).json({ error: "Invalid Paystack signature" });
  }

  if (String(req.body?.event || "").trim().toLowerCase() !== "charge.success") {
    return res.status(200).json({ received: true });
  }

  const reference = String(req.body?.data?.reference || "").trim();
  if (!reference) {
    return res.status(200).json({ received: true });
  }

  const order = await MarketplaceOrder.findOne({ paymentReference: reference });
  if (!order) {
    return res.status(200).json({ received: true });
  }

  await reconcileMarketplaceOrder({ order }).catch(() => null);

  return res.status(200).json({ received: true });
});
