const MarketplaceOrder = require("../models/MarketplaceOrder");
const MarketplaceProduct = require("../models/MarketplaceProduct");
const MarketplaceSeller = require("../models/MarketplaceSeller");
const MarketplaceTransaction = require("../models/MarketplaceTransaction");
const User = require("../models/User");
const { config } = require("../config/env");
const { sanitizeMultilineText, sanitizePlainText } = require("./assistant/outputSanitizer");
const { calculateMarketplaceAmounts } = require("./marketplaceFeeService");
const { createPayoutForPaidOrder } = require("./marketplacePayoutService");
const {
  recordMarketplaceOrderLedgerEntries,
} = require("./revenueLedgerService");
const { createNotification } = require("./notificationService");
const {
  initializeMarketplaceTransaction,
  verifyMarketplaceTransaction,
} = require("./marketplacePaystackService");
const {
  createServiceError,
  toIdString,
} = require("./marketplaceSellerService");
const { validateCheckoutPayload } = require("../validators/marketplaceValidators");
const sendSecurityEmail = require("../utils/sendSecurityEmail");

const VALID_FULFILLMENT_STATUSES = new Set([
  "processing",
  "shipped_or_ready",
  "delivered",
  "completed",
  "cancelled",
]);

const escapeHtml = (value = "") =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatMoney = (amount = 0, currency = "NGN") =>
  `${String(currency || "NGN").toUpperCase()} ${Number(amount || 0).toLocaleString()}`;

const isEmailConfigured = () => Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);

const getSocketContext = (req = null) => ({
  io: req?.app?.get?.("io") || null,
  onlineUsers: req?.app?.get?.("onlineUsers") || null,
});

const mapGatewayFailureStatus = (status = "") => {
  const normalized = String(status || "").trim().toLowerCase();
  if (["ongoing", "pending", "processing"].includes(normalized)) {
    return "pending";
  }
  if (normalized === "abandoned") {
    return "failed";
  }
  return "failed";
};

const resolveMarketplaceReturnUrl = (value = "") => {
  const raw = String(value || "").trim();
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  if (raw.startsWith("/")) {
    return `${config.APP_URL || config.appUrl}${raw}`;
  }
  return `${config.APP_URL || config.appUrl}/marketplace/orders`;
};

const serializeOrderParty = (user = {}) =>
  user
    ? {
        _id: toIdString(user._id),
        name: user.name || "",
        username: user.username || "",
        email: user.email || "",
      }
    : null;

const serializeOrderSeller = (seller = {}) =>
  seller
    ? {
        _id: toIdString(seller._id),
        userId: toIdString(seller.user),
        storeName: seller.storeName || "",
        slug: seller.slug || "",
        fullName: seller.fullName || "",
        state: seller.state || "",
        city: seller.city || "",
      }
    : null;

const serializeOrder = (
  order = {},
  {
    buyer = null,
    seller = null,
    product = null,
    includeBuyer = false,
    includeDelivery = true,
  } = {}
) => ({
  _id: toIdString(order._id),
  buyerId: toIdString(order.buyer?._id || order.buyer),
  sellerId: toIdString(order.seller?._id || order.seller),
  productId: toIdString(order.product?._id || order.product),
  quantity: Number(order.quantity || 0),
  totalPrice: Number(order.totalPrice || 0),
  currency: order.currency || "NGN",
  platformFee: Number(order.platformFee || 0),
  sellerReceivable: Number(order.sellerReceivable || 0),
  paymentProvider: order.paymentProvider || "paystack",
  paymentReference: order.paymentReference || "",
  paystackAccessCode: order.paystackAccessCode || "",
  paymentStatus: order.paymentStatus || "initiated",
  orderStatus: order.orderStatus || "pending",
  deliveryMethod: order.deliveryMethod || "",
  deliveryAddress: includeDelivery ? order.deliveryAddress || "" : "",
  deliveryContactPhone: includeDelivery ? order.deliveryContactPhone || "" : "",
  fulfillmentNotes: order.fulfillmentNotes || "",
  productSnapshot: {
    title: order.productTitle || product?.title || "",
    slug: order.productSlug || product?.slug || "",
    imageUrl: order.productImageUrl || "",
  },
  storeSnapshot: {
    storeName: order.storeName || seller?.storeName || "",
    storeSlug: order.storeSlug || seller?.slug || "",
  },
  seller: serializeOrderSeller(seller || order.seller),
  buyer: includeBuyer ? serializeOrderParty(buyer || order.buyer) : null,
  createdAt: order.createdAt || null,
  updatedAt: order.updatedAt || null,
});

const serializeTransaction = (transaction = {}) => ({
  _id: toIdString(transaction._id),
  orderId: toIdString(transaction.order),
  buyerId: toIdString(transaction.buyer),
  sellerId: toIdString(transaction.seller),
  amount: Number(transaction.amount || 0),
  platformFee: Number(transaction.platformFee || 0),
  sellerReceivable: Number(transaction.sellerReceivable || 0),
  provider: transaction.provider || "paystack",
  reference: transaction.reference || "",
  status: transaction.status || "",
  createdAt: transaction.createdAt || null,
  updatedAt: transaction.updatedAt || null,
});

const resolveCheckoutDependencies = async ({ productId } = {}) => {
  const product = await MarketplaceProduct.findById(productId);
  if (!product) {
    throw createServiceError("Marketplace product not found", 404);
  }

  const seller = await MarketplaceSeller.findById(product.seller);
  if (!seller) {
    throw createServiceError("Marketplace seller not found", 404);
  }

  return { product, seller };
};

const releaseReservedStock = async (order, { markFailed = false } = {}) => {
  if (!order?._id || !order.stockReserved || order.stockReleasedAt) {
    return false;
  }

  const updatedOrder = await MarketplaceOrder.findOneAndUpdate(
    {
      _id: order._id,
      stockReserved: true,
      stockReleasedAt: null,
      paymentStatus: { $ne: "paid" },
    },
    {
      $set: {
        stockReserved: false,
        stockReleasedAt: new Date(),
        ...(markFailed
          ? {
              paymentStatus: "failed",
              orderStatus: "cancelled",
            }
          : {}),
      },
    },
    { returnDocument: "after" }
  );

  if (!updatedOrder) {
    return false;
  }

  await MarketplaceProduct.updateOne(
    { _id: updatedOrder.product },
    { $inc: { stock: Number(updatedOrder.quantity || 0) } }
  );

  return true;
};

const upsertMarketplaceTransaction = async ({ order, verified, status = "" } = {}) =>
  MarketplaceTransaction.findOneAndUpdate(
    { order: order._id },
    {
      $set: {
        order: order._id,
        buyer: order.buyer,
        seller: order.seller,
        amount: Number(order.totalPrice || 0),
        platformFee: Number(order.platformFee || 0),
        sellerReceivable: Number(order.sellerReceivable || 0),
        provider: order.paymentProvider || "paystack",
        reference: order.paymentReference || verified?.reference || "",
        status: status || verified?.status || order.paymentStatus || "",
        rawVerificationSnapshot: verified?.raw || verified || {},
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

const validateVerifiedOrderPayment = ({ order, verified } = {}) => {
  const expectedAmountKobo = Math.round(Number(order?.totalPrice || 0) * 100);
  const verifiedAmountKobo = Number(verified?.amountKobo || 0);
  const expectedCurrency = String(order?.currency || "NGN").trim().toUpperCase();
  const verifiedCurrency = String(verified?.currency || "").trim().toUpperCase();
  const verifiedStatus = String(verified?.status || "").trim().toLowerCase();

  if (verifiedStatus !== "success") {
    return {
      ok: false,
      nextStatus: mapGatewayFailureStatus(verifiedStatus),
      message: `Gateway status is ${verifiedStatus || "unknown"}`,
    };
  }

  if (verifiedAmountKobo !== expectedAmountKobo || verifiedCurrency !== expectedCurrency) {
    return {
      ok: false,
      nextStatus: "failed",
      message: "Payment verification mismatch",
    };
  }

  return {
    ok: true,
    nextStatus: "paid",
    message: "",
  };
};

const markOrderPaid = async ({ order, verified } = {}) => {
  const newlyPaidOrder = await MarketplaceOrder.findOneAndUpdate(
    {
      _id: order._id,
      paymentStatus: { $ne: "paid" },
    },
    {
      $set: {
        paymentStatus: "paid",
        orderStatus: "paid",
        paymentReference: verified?.reference || order.paymentReference || "",
      },
    },
    { returnDocument: "after" }
  );
  const updatedOrder = newlyPaidOrder || (await MarketplaceOrder.findById(order._id));

  if (!updatedOrder) {
    throw createServiceError("Marketplace order not found", 404);
  }

  const transaction = await upsertMarketplaceTransaction({
    order: updatedOrder,
    verified,
    status: "paid",
  });
  const payout = await createPayoutForPaidOrder({ order: updatedOrder });
  await recordMarketplaceOrderLedgerEntries({ order: updatedOrder }).catch(() => null);
  if (newlyPaidOrder) {
    await sendMarketplaceOrderConfirmations({ order: updatedOrder }).catch(() => null);
  }

  return {
    order: updatedOrder,
    transaction,
    payout,
  };
};

const sendMarketplaceOrderConfirmations = async ({ req = null, order } = {}) => {
  if (!order?._id) {
    return { sent: false, skipped: true, reason: "missing_order" };
  }

  const [buyer, seller] = await Promise.all([
    User.findById(order.buyer).select("_id email name username").lean(),
    MarketplaceSeller.findById(order.seller).select("_id user storeName slug").lean(),
  ]);
  const sellerUser = seller?.user
    ? await User.findById(seller.user).select("_id email name username").lean()
    : null;
  const socketContext = getSocketContext(req);
  const link = "/marketplace/orders";
  const orderId = toIdString(order._id);
  const title = order.productTitle || "Marketplace order";

  if (buyer?._id && sellerUser?._id && String(buyer._id) !== String(sellerUser._id)) {
    await createNotification({
      recipient: buyer._id,
      sender: sellerUser._id,
      type: "system",
      text: `Payment confirmed for ${title}. Track order status from your marketplace orders.`,
      entity: { id: sellerUser._id, model: "User" },
      metadata: {
        eventType: "marketplace_order_paid",
        orderId,
        paymentReference: order.paymentReference || "",
        link,
        dedupeKey: `marketplace_order_paid_buyer:${orderId}`,
      },
      ...socketContext,
    }).catch(() => null);
  }

  if (buyer?._id && sellerUser?._id && String(buyer._id) !== String(sellerUser._id)) {
    await createNotification({
      recipient: sellerUser._id,
      sender: buyer._id,
      type: "system",
      text: `${title} has been paid. Prepare fulfillment from seller orders.`,
      entity: { id: buyer._id, model: "User" },
      metadata: {
        eventType: "marketplace_order_paid_seller",
        orderId,
        paymentReference: order.paymentReference || "",
        link,
        dedupeKey: `marketplace_order_paid_seller:${orderId}`,
      },
      ...socketContext,
    }).catch(() => null);
  }

  if (buyer?.email && isEmailConfigured()) {
    await sendSecurityEmail({
      to: buyer.email,
      subject: "Your Tengacion marketplace order is confirmed",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;padding:16px;">
          <h2 style="margin:0 0 12px;">Marketplace payment confirmed</h2>
          <p>Your payment for <strong>${escapeHtml(title)}</strong> has been verified.</p>
          <table style="border-collapse:collapse;margin:16px 0;width:100%;max-width:520px;">
            <tr><td style="padding:8px;border:1px solid #e5e7eb;">Buyer paid</td><td style="padding:8px;border:1px solid #e5e7eb;"><strong>${escapeHtml(formatMoney(order.totalPrice, order.currency))}</strong></td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb;">Platform fee included</td><td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(formatMoney(order.platformFee, order.currency))}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb;">Reference</td><td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(order.paymentReference || "")}</td></tr>
          </table>
          <p>The Tengacion marketplace fee is included in the item price. Paystack charged only the verified order total.</p>
        </div>
      `,
    }).catch(() => null);
  }

  return { sent: true };
};

const initializeMarketplaceOrder = async ({
  req,
  buyerId,
  payload = {},
} = {}) => {
  const rawProductId = String(payload.productId || "").trim();
  if (!rawProductId) {
    throw createServiceError("productId is required", 400);
  }

  const { product, seller } = await resolveCheckoutDependencies({
    productId: rawProductId,
  });
  const { errors, value } = validateCheckoutPayload({
    payload,
    product,
    seller,
  });

  if (errors.length) {
    throw createServiceError("Checkout validation failed", 400, errors);
  }

  if (String(seller.user || "") === String(buyerId || "")) {
    throw createServiceError("You cannot buy your own marketplace listing", 400);
  }

  const buyer = await User.findById(buyerId).select("_id email name username");
  if (!buyer?.email) {
    throw createServiceError("A valid buyer email is required for Paystack checkout", 400);
  }

  const reservedProduct = await MarketplaceProduct.findOneAndUpdate(
    {
      _id: product._id,
      isPublished: true,
      isHidden: false,
      moderationStatus: "approved",
      stock: { $gte: value.quantity },
    },
    { $inc: { stock: -value.quantity } },
    { returnDocument: "after" }
  );

  if (!reservedProduct) {
    throw createServiceError("This listing no longer has enough stock", 409);
  }

  const amounts = calculateMarketplaceAmounts({
    unitPrice: product.price,
    quantity: value.quantity,
  });

  let order = null;
  try {
    order = await MarketplaceOrder.create({
      buyer: buyer._id,
      seller: seller._id,
      product: product._id,
      quantity: value.quantity,
      totalPrice: amounts.totalPrice,
      currency: product.currency || "NGN",
      platformFee: amounts.platformFee,
      sellerReceivable: amounts.sellerReceivable,
      paymentProvider: "paystack",
      paymentStatus: "initiated",
      orderStatus: "pending",
      deliveryMethod: value.deliveryMethod,
      deliveryAddress: value.deliveryAddress,
      deliveryContactPhone: value.deliveryContactPhone,
      fulfillmentNotes: "",
      productTitle: product.title || "",
      productSlug: product.slug || "",
      productImageUrl:
        product.images?.[0]?.secureUrl ||
        product.images?.[0]?.secure_url ||
        product.images?.[0]?.url ||
        "",
      storeName: seller.storeName || "",
      storeSlug: seller.slug || "",
      stockReserved: true,
    });

    const initialized = await initializeMarketplaceTransaction({
      order,
      buyerEmail: buyer.email,
      callbackUrl: resolveMarketplaceReturnUrl(payload.returnUrl),
      metadata: {
        buyerName: buyer.name || buyer.username || "",
        productTitle: product.title || "",
        storeName: seller.storeName || "",
      },
    });

    order.paymentReference = initialized.paymentReference;
    order.paystackAccessCode = initialized.payment.access_code || "";
    order.paymentStatus = "pending";
    await order.save();

    return {
      order: serializeOrder(order, {
        seller,
        buyer,
        includeBuyer: false,
      }),
      authorizationUrl: initialized.payment.authorization_url || "",
      accessCode: initialized.payment.access_code || "",
      reference: order.paymentReference || "",
    };
  } catch (error) {
    if (order?._id) {
      await releaseReservedStock(order, { markFailed: true }).catch(() => null);
    } else {
      await MarketplaceProduct.updateOne(
        { _id: product._id },
        { $inc: { stock: value.quantity } }
      ).catch(() => null);
    }
    throw error;
  }
};

const reconcileMarketplaceOrder = async ({ order } = {}) => {
  if (!order?._id) {
    throw createServiceError("Marketplace order not found", 404);
  }

  if (String(order.paymentStatus || "").trim().toLowerCase() === "paid") {
    const transaction = await upsertMarketplaceTransaction({
      order,
      verified: {
        reference: order.paymentReference,
        status: "success",
        raw: { idempotent: true },
      },
      status: "paid",
    });
    const payout = await createPayoutForPaidOrder({ order });
    await recordMarketplaceOrderLedgerEntries({ order }).catch(() => null);

    return {
      success: true,
      verified: true,
      order,
      transaction,
      payout,
      message: "Payment already verified",
    };
  }

  const verified = await verifyMarketplaceTransaction(order.paymentReference);
  const match = validateVerifiedOrderPayment({
    order,
    verified,
  });

  if (!match.ok) {
    const updatedOrder =
      (await MarketplaceOrder.findOneAndUpdate(
        {
          _id: order._id,
          paymentStatus: { $ne: "paid" },
        },
        {
          $set: {
            paymentStatus: match.nextStatus,
            ...(match.nextStatus === "failed"
              ? { orderStatus: "cancelled" }
              : {}),
          },
        },
        { returnDocument: "after" }
      )) || (await MarketplaceOrder.findById(order._id));

    if (match.nextStatus === "failed") {
      await releaseReservedStock(updatedOrder || order).catch(() => null);
    }

    const finalOrder = (await MarketplaceOrder.findById(order._id)) || updatedOrder || order;
    const transaction = await upsertMarketplaceTransaction({
      order: finalOrder,
      verified,
      status: match.nextStatus,
    });

    return {
      success: false,
      verified: false,
      order: finalOrder,
      transaction,
      payout: null,
      message: match.message,
    };
  }

  const settled = await markOrderPaid({
    order,
    verified,
  });

  return {
    success: true,
    verified: true,
    order: settled.order,
    transaction: settled.transaction,
    payout: settled.payout,
    message: "Payment verified",
  };
};

const listBuyerOrders = async ({
  buyerId,
  page = 1,
  limit = 20,
  status = "",
} = {}) => {
  const safePage = Math.max(1, Number(page || 1));
  const safeLimit = Math.min(50, Math.max(1, Number(limit || 20)));
  const query = { buyer: buyerId };

  if (status) {
    query.orderStatus = String(status || "").trim().toLowerCase();
  }

  const [rows, total] = await Promise.all([
    MarketplaceOrder.find(query)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate("seller")
      .lean(),
    MarketplaceOrder.countDocuments(query),
  ]);

  return {
    page: safePage,
    limit: safeLimit,
    total,
    orders: rows.map((row) =>
      serializeOrder(row, {
        seller: row.seller,
        includeBuyer: false,
        includeDelivery: true,
      })
    ),
  };
};

const listSellerOrders = async ({
  sellerId,
  page = 1,
  limit = 20,
  paymentStatus = "",
  orderStatus = "",
} = {}) => {
  const safePage = Math.max(1, Number(page || 1));
  const safeLimit = Math.min(50, Math.max(1, Number(limit || 20)));
  const query = { seller: sellerId };

  if (paymentStatus) {
    query.paymentStatus = String(paymentStatus || "").trim().toLowerCase();
  }
  if (orderStatus) {
    query.orderStatus = String(orderStatus || "").trim().toLowerCase();
  }

  const [rows, total] = await Promise.all([
    MarketplaceOrder.find(query)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate("buyer", "_id name username email")
      .lean(),
    MarketplaceOrder.countDocuments(query),
  ]);

  return {
    page: safePage,
    limit: safeLimit,
    total,
    orders: rows.map((row) =>
      serializeOrder(row, {
        buyer: row.buyer,
        includeBuyer: true,
        includeDelivery: true,
      })
    ),
  };
};

const updateSellerOrderStatus = async ({
  sellerId,
  orderId,
  status,
  notes = "",
} = {}) => {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  if (!VALID_FULFILLMENT_STATUSES.has(normalizedStatus)) {
    throw createServiceError("Invalid marketplace order status", 400);
  }

  const order = await MarketplaceOrder.findOne({
    _id: orderId,
    seller: sellerId,
  }).populate("buyer", "_id name username email");

  if (!order) {
    throw createServiceError("Marketplace order not found", 404);
  }

  if (String(order.paymentStatus || "").trim().toLowerCase() !== "paid") {
    throw createServiceError("Only paid marketplace orders can be fulfilled", 400);
  }

  order.orderStatus = normalizedStatus;
  if (notes) {
    order.fulfillmentNotes = sanitizeMultilineText(notes, 600);
  }
  await order.save();

  return serializeOrder(order, {
    buyer: order.buyer,
    includeBuyer: true,
    includeDelivery: true,
  });
};

const listMarketplaceOrdersForAdmin = async ({
  page = 1,
  limit = 20,
  paymentStatus = "",
  orderStatus = "",
  search = "",
} = {}) => {
  const safePage = Math.max(1, Number(page || 1));
  const safeLimit = Math.min(50, Math.max(1, Number(limit || 20)));
  const query = {};

  if (paymentStatus) {
    query.paymentStatus = String(paymentStatus || "").trim().toLowerCase();
  }
  if (orderStatus) {
    query.orderStatus = String(orderStatus || "").trim().toLowerCase();
  }
  if (search) {
    const needle = sanitizePlainText(search, 120);
    query.$or = [
      { paymentReference: { $regex: needle, $options: "i" } },
      { productTitle: { $regex: needle, $options: "i" } },
      { storeName: { $regex: needle, $options: "i" } },
    ];
  }

  const [rows, total, summaryRows] = await Promise.all([
    MarketplaceOrder.find(query)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate("buyer", "_id name username email")
      .populate("seller")
      .lean(),
    MarketplaceOrder.countDocuments(query),
    MarketplaceOrder.aggregate([
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          paidOrders: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0],
            },
          },
          grossVolume: { $sum: "$totalPrice" },
          totalFees: { $sum: "$platformFee" },
          totalNet: { $sum: "$sellerReceivable" },
        },
      },
    ]),
  ]);

  return {
    page: safePage,
    limit: safeLimit,
    total,
    summary: {
      totalOrders: Number(summaryRows[0]?.totalOrders || 0),
      paidOrders: Number(summaryRows[0]?.paidOrders || 0),
      grossVolume: Number(summaryRows[0]?.grossVolume || 0),
      totalFees: Number(summaryRows[0]?.totalFees || 0),
      totalNet: Number(summaryRows[0]?.totalNet || 0),
    },
    orders: rows.map((row) =>
      serializeOrder(row, {
        buyer: row.buyer,
        seller: row.seller,
        includeBuyer: true,
        includeDelivery: true,
      })
    ),
  };
};

module.exports = {
  initializeMarketplaceOrder,
  listBuyerOrders,
  listMarketplaceOrdersForAdmin,
  listSellerOrders,
  reconcileMarketplaceOrder,
  releaseReservedStock,
  serializeOrder,
  serializeTransaction,
  updateSellerOrderStatus,
};
